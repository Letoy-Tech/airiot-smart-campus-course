# 第四轮前端实施与验证

记录时刻：2026-10-19T00:04:23.409484+08:00。实现范围为本独立教师参考 frontend；真实数据库/浏览器联调由根任务统一执行，以下不冒充其结果。

## 已执行

- Node 22.21.1 / npm 10.9.4 在本 frontend 绝对 cwd 执行 `npm ci`：exit0，192 包。
- `npm run type-check`：exit0。
- `npm run test:unit -- --run`：7 文件、41 项通过；原 24 项保留，新增 17 项。
- `npm run build`：exit0；Vite 7.3.7，636 模块；初始 JS 109.58 kB，CSS 20.44 kB；历史图单独按需分块 498.14 kB（gzip 170.37 kB）。最终执行于2026-10-19 00:14（Asia/Shanghai），覆盖格式化修复与稳定ID详情新增。
- `npm audit --json` 与 `npm audit --omit=dev --json`：exit0，所有严重性及 total 均 0；原始 JSON 位于本目录。

## 新依赖

精确添加 ECharts 6.1.0 / zrender 6.1.0。原准备采用 6.0.0，但实际审计命中 1 moderate，已按 [ECharts 官方 6.1.0 发布说明](https://github.com/apache/echarts/releases/tag/6.1.0)的 lines tooltip XSS 修复升级；本实现使用 line 与 richText tooltip，也没有据此忽略审计。

锁生成工具继续为 Node22.21.1 运行 npm11.16.0 CLI；实际 ci、测试、构建、审计均 Node22/npm10。没有 audit fix --force、override 或跨主版本升级，没有修改原 system 依赖。

## 可核对的测试范围

- course-domain：C06 联合筛选与三态、C08 严格 true、C12 每次 state 改变 skip=0；历史 null/0/原始时间；关闭前置条件。
- request-scope：旧 success/catch/finally 不污染新请求/身份；401 与403；完成后15秒轮询、不重叠、离页 pending 不再创建定时器。
- workflow-views：NOTE409 保留输入并读新版本，不自动重放；责任409 回读失败继续阻写；URL state 恢复且忽略旧 skip；查看者无业务写入口。

前端 mock 通过不证明真实数据库事务回滚或后端鉴权。未在此报告声称 Windows 已执行；桌面和390px、完整后端业务链由根任务补真实浏览器证据。

## 依赖冻结标识

- package.json SHA-256：`8a4e5fdc7a8908e330bcb8426df52521e446ee9240acab2a6c6304d0e5d667d5`
- package-lock.json SHA-256：`4f3549bc5d2ca21ec828f7636ac68fef5563ba3f5ffeef54f36c33debc7261e7`

## 真实浏览器补充

`node tools/verify-browser.mjs` 已在2026-10-19 00:13（Asia/Shanghai）真实运行并PASS 10组，证据在工程 `evidence/full-browser/verification.json`，另有带执行时间的保留副本。平台Darwin/arm64、Chromium149.0.7827.55，访问本教学前端5178→后端8091→隔离MySQL；不是Windows或手机真机。

管理员台账16设备、4空间、28点；稳定deviceId刷新详情、清筛选；监测完成后再轮询，离页16秒请求数保持2；历史energy01/power有null及0并渲染canvas；页面责任登记manager-a；页面事件从v1到v8关闭；实际HTTP抢先NOTE造成旧页面409，保留输入、回读v4、人工确认前禁写且确认本身不重放；manager-a本人start/NOTE、manager-b他人无操作、viewer390无写入口；first-read16条和阻断请求后的旧快照/恢复；无未捕获JS错误、页面横向溢出或浏览器存储令牌。截图均登录后，无密码。

已人工检查desktop-devices、desktop-cases、mobile-history、mobile-devices像素。主图五张desktop-devices/mobile-devices/desktop-history/desktop-cases/desktop-owners.png，另7张。实际事件ID与版本见JSON；没有清理或重置旧测试记录。

第一次E2E遇到Vite旧依赖504，由root只重启本服务并force优化；随后格式化后的OwnersView内联多语句解析失败已改成acknowledge函数，再次通过41单元测试、type/build和上述真实E2E。阶段失败不会被称为一次即通过。

根任务仍负责学生起点/M检查点同步回归、教师真机预跑与后端事务证据汇总。AIRIOT配置未验证，真实连接不是完成证明；外部控制保持关闭。
