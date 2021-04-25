const fetch = require("node-fetch");
const fs = require("fs-extra");
const path = require("path");
const _ = require("lodash");
const cheerio = require("cheerio");
const iconv = require("iconv-lite");
const ProgressBar = require("progress");
const Epub = require("epub-gen");
const { encrypt, formatContent } = require("./PC");
const { thor, gx, tob } = require("../config");

const chapterMap = {};

const ajaxOptions = {
  headers: {
    accept: "*/*",
    "accept-language": "zh-CN,zh;q=0.9,en;q=0.8",
    "cache-control": "no-cache",
    pragma: "no-cache",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "x-requested-with": "XMLHttpRequest",
    cookie: `thor=${thor};_gx_ght_u_=${gx}`,
  },
  referrer:
    "https://cread.jd.com/read/startRead.action?bookId=30410212&readType=3",
  referrerPolicy: "strict-origin-when-cross-origin",
  mode: "cors",
  "user-agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 11_2_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/87.0.4280.141 Safari/537.36",
  timeout: 2000,
};

const decodeGbk = (text) => {
  return iconv.decode(text, "gbk");
};

const paraBuilder = (obj) => {
  let paras = "";
  let notNullObj = obj || {};
  let loop = 0;
  for (let p in notNullObj) {
    if (loop == 0) {
      paras += '"' + p + '":"' + notNullObj[p] + '"';
    } else {
      paras += ',"' + p + '":"' + notNullObj[p] + '"';
    }
    loop += 1;
  }
  paras = "{" + paras + "}";
  return paras;
};

/**
 * 判断章节是否是版权页
 * @param {String} htmlText
 * @returns {boolean}
 */
const isCopyright = (htmlText) => {
  if (htmlText.includes("版权信息")) {
    return true;
  }
  if (htmlText.includes("京东")) {
    return true;
  }
  if (htmlText.includes("著作权")) {
    return true;
  }
  if (htmlText.includes("经营许可证")) {
    return true;
  }
  return false;
};

/**
 * 读取 html 文件
 * @param {String} filePath 文件路径
 * @returns {Promise<String>}
 */
const readHtmlFile = async (filePath) => {
  let file = "";
  try {
    file = await fs.readFile(filePath, "UTF-8");
  } catch (e) {
    // pass
  }
  return file;
};

/**
 * 读取 html 文件中的 body
 * @param {String} htmlText
 * @returns {String}
 */
const getBodyInHtml = (htmlText) => {
  const $ = cheerio.load(htmlText);
  return $("body").html();
};

/**
 * 读取 html 文件中的 css 链接
 * @param {String} htmlText
 * @returns {[String]}
 */
const getCssInHtml = (htmlText) => {
  const $ = cheerio.load(htmlText);
  const cssList = [];
  $("[type='text/css']")
    // .find("")
    .each(function () {
      const href = $(this).attr("href");
      cssList.push(href);
    });
  return cssList;
};

const getCssTextFromUrls = async (urls) => {
  const result = [];
  for (let i = 0; i < urls.length; i++) {
    const url = urls[i];
    try {
      const res = await fetch(url);
      const text = await res.text();
      if (text) {
        result.push(text);
      }
    } catch (e) {
      // pass
    }
  }
  return result.join("\n");
};

/**
 * 获取图书信息
 * @param {String} bookId 图书ID
 * @returns {Promise<Object>}
 */
const fetchBookById = async (bookId) => {
  const res = await fetch(
    `https://gx.jd.com/gx/gx_bookDetail.action?bookId=${bookId}`,
    {
      ...ajaxOptions,
      method: "GET",
    }
  );
  const buffer = await res.buffer();
  const $ = cheerio.load(decodeGbk(buffer), {
    decodeEntities: false,
  });
  const bookName = $(".preview-detail h2").text().trim();
  return {
    bookId,
    bookName,
    readType: "0",
  };
};

/**
 * 获取目录
 * @param {String} bookId 图书ID
 * @param {String} readType 图书类型
 * @returns {Promise<[]>}
 */
const fetchCatalogList = async (bookId, readType) => {
  const k = encrypt(
    paraBuilder({
      bookId,
      tob,
    })
  );
  const url = `https://cread.jd.com/read/lC.action?k=${k}&readType=${readType}&tob=${tob}`;
  let catalogList = [];
  try {
    const res = await fetch(url, {
      ...ajaxOptions,
      method: "GET",
    });
    const json = await res.json();
    if (json.code !== "0") {
      console.log("❌ 抓取目录出错: ", json.msg);
      return catalogList;
    }
    const real = formatContent(json.content);
    catalogList = real.catalogList || [];
  } catch (e) {
    console.log("❌ 抓取目录出错: ", e.message);
  }
  return catalogList;
};

/**
 * 通过图书 id 获取章节 id 数组
 * @param {String} bookId 图书ID
 * @returns {Promise<[String]>}
 */
const getChapterIdsByBookId = async (bookId) => {
  const chapterPath = path.join(__dirname, `../temp/${bookId}/chapters`);
  const chapterFileNames = (await fs.readdir(chapterPath)) || [];
  return chapterFileNames.map((item) => {
    return item.replace(".html", "");
  });
};

/**
 * 从 html 中解析所有章节内容
 * @param {String} bookId 图书ID
 * @returns {Promise<{css: string, content: []}>}
 */
const getChapterContents = async ({ bookId }) => {
  const tempDir = path.join(__dirname, `../temp/${bookId}`);
  const chapterIds = await getChapterIdsByBookId(bookId);
  const content = [];
  let cssUrls = ["https://cread.jd.com/skins/my_css/epub.css"];
  for (let i = 0; i < chapterIds.length; i++) {
    const chapterId = chapterIds[i];
    const chapterPath = path.join(tempDir, `chapters/${chapterId}.html`);
    const html = await readHtmlFile(chapterPath);
    const body = getBodyInHtml(html);
    if (body) {
      const title = chapterMap[chapterId];
      cssUrls = [...cssUrls, ...getCssInHtml(html)];
      content.push({
        title,
        cssUrls,
        data: body,
      });
    }
  }
  cssUrls = _.uniq(cssUrls);
  const css = await getCssTextFromUrls(cssUrls);
  return { content, css };
};

const generateEpub = async ({ bookId, bookName }) => {
  const outputPath = path.join(__dirname, `../output/${bookName}.epub`);
  const { content, css } = await getChapterContents({ bookId, bookName });
  const options = {
    title: bookName,
    author: "",
    tocTitle: "目录",
    output: outputPath,
    appendChapterTitles: false,
    css,
    content,
  };
  await new Epub(options).promise;
};

/**
 * 抓取并保存章节 html 到本机
 * @param {Object} book 图书信息
 * @returns {Promise<boolean>} 是否成功
 */
const fetchAndSaveChapter = async (book) => {
  const { bookId, readType, chapterId } = book;
  const chapterFlagTexts = [];
  try {
    const k = encrypt(paraBuilder({ bookId, chapterId }));
    const url = `https://cread.jd.com/read/gC.action?k=${k}&readType=${readType}&tob=${tob}`;
    const res = await fetch(url, { ...ajaxOptions, method: "GET" });
    const json = await res.json();
    if (json.code !== "0") {
      console.log(`❌ 抓取章节 ${chapterId} 出错: ${json.msg}`);
      return false;
    }
    const real = formatContent(json.content);
    const html = real.contentList[0].content;
    const flagText = html.substring(0, 300);
    if (chapterFlagTexts.includes(flagText)) {
      console.log(`⚠️ 章节 ${chapterId} 已存在`);
      return true;
    }
    chapterFlagTexts.push(flagText);
    await fs.outputFile(
      path.join(__dirname, `../temp/${bookId}/chapters/${chapterId}.html`),
      isCopyright(html) ? "<br/>" : html
    );
    return true;
  } catch (e) {
    // pass
    console.log(`❌ 抓取章节 ${chapterId} 出错: ${e.message}`);
  }
};

/**
 * 导出图书的 PDF 格式
 * @param {Object} book 图书信息
 * @returns {Promise<void>}
 */
const exportToPdf = async (book) => {
  const { bookId, bookName, readType } = book;
  console.log(`开始抓取《${bookName}》...`);
  const tempDir = path.join(__dirname, `../temp/${bookId}`);
  await fs.ensureDir(tempDir);

  console.log(`开始抓取目录...`);
  const catalogList = await fetchCatalogList(bookId, readType);

  console.log(`开始抓取章节...`);
  const progressBar = new ProgressBar(":bar :current/:total", {
    total: catalogList.length,
  });
  const retryQueue = [];
  for (let i = 0; i < catalogList.length; i++) {
    const chapterId = catalogList[i].catalogId;
    const chapterName = catalogList[i].catalogName;
    chapterMap[chapterId] = chapterName;
    const success = await fetchAndSaveChapter({ chapterId, ...book });
    if (!success) {
      retryQueue.push({ chapterId, ...book });
    }
    progressBar.tick();
  }

  if (retryQueue.length) {
    console.log(`\n开始重新抓取失败章节:`);
    const retryBar = new ProgressBar(":bar :current/:total", {
      total: retryQueue.length,
    });
    for (let i = 0; i < retryQueue.length; i++) {
      await fetchAndSaveChapter(retryQueue[i]);
      retryBar.tick();
    }
  }

  console.log(`开始导出 ${bookName}.epub...`);
  await generateEpub({ bookId, bookName });

  console.log(`开始清理临时目录...`);
  await fs.remove(tempDir);
  console.log(`🎉 抓取完毕!`);
};

module.exports = { fetchBookById, exportToPdf };
