一键导出京东校园版电子书

## 如何使用

第一步: 下载代码, 安装依赖

```shell
git clone https://github.com/rmlzy/export_jd_read
cd export_jd_read
npm i
npm run start
```

第二步: 登录 gx.jd.com 登录状态下, 复制 cookie 中的 `_gx_ght_u_` 到 `config.js` 中的 `gx` 变量

第三步: 随便找一本书, 右键查看源代码, 搜索 `tob=` 的值到 `config.js` 中的 `tob` 变量

第四步: 执行 `npm run start` 后, 输入图书 URL 中的 `bookId` 即可



