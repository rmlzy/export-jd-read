const inquirer = require("inquirer");
const { gx, tob } = require("../config");
const { fetchBookById, exportToPdf } = require("./util");

run();

async function run() {
  if (gx === "") {
    console.log(
      "⚠️ 请事先将页面 cookie 中的 _gx_ght_u_ 值拷贝到 config.js 中的 gx 变量里!"
    );
    return;
  }
  if (tob === "") {
    console.log("⚠️ 请事先将页面 tob 的值拷贝到 config.js 中的 tob 变量里!");
    return;
  }
  const answers = await inquirer.prompt([
    {
      name: "step1",
      type: "input",
      message: `请输入图书ID (URL 中的 bookId):`,
    },
  ]);
  const book = await fetchBookById(answers.step1);
  await exportToPdf(book);
}
