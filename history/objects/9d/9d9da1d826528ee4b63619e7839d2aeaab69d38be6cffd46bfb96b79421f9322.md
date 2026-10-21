# 智慧校园：同一个工程做到底

本目录是手把手带做专用起点。复制到桌面 campus-ai-lab/app，用 VS Code 打开 app。先按教程第04篇补 A/B，再进入05—12；不逐章换目录。

教师提供认证、请求、数据库、完整页面及其他基础；每章 `node tools/chapter.mjs prepare 05` 只把本章尚未编辑的参考标记块改为TODO，保留前章工作。脚本用 `.lesson-state.json` 记录已经准备过的章节，再次运行同章会保留全部现有代码；首次准备时遇到自定义修改会拒绝覆盖。不要删除该记录来重做，需要重新练习时另建副本。备份在忽略目录 `.lesson-backups/`。prepare是准备任务，不是完成证明。

代码和测试均源于完整教学参考，其他章节在进入本章前仍可能显示教师参考功能。不要把预置代码当本人从零完成，也不要用教师报告替代本人结果。

运行基线：Node22.21.1、JDK17，同时设置当前终端JAVA_HOME与PATH（见docs/01-跨平台启动.md）。后端单独构建用build-backend，完整build在业务完成后执行。首次安装 `npm --prefix frontend ci`，再 `node tools/course.mjs init`。第04篇使用 `backend` 的first-chain模式（无数据库、两设备）；05之后由教师提供本组库并明确迁移，再使用 `backend-db` 完整模式。前端一直 `node tools/course.mjs frontend`。8091/5178不能重复启动。

本工程 docs 中的旧分章操作单是补充参考，其中“换章节副本”的说明不适用于这条新主线。请以完整教学包 walkthroughs/index.html 的04—12带作为操作顺序。

每章记录保存在 evidence/ch04.md 到 ch12.md。要交付的设计文档放本app/docs或project-docs；hand-in只读当前app，不再自动读取上级目录，也不带lesson-bundles/.codebuddy/备份。源文件与记录由你在VSCode保存；不要把代码下载到错误文件夹。

第12篇运行 check、build 后，`node tools/hand-in.mjs` 输出 app 同级的 app-handoff-时间 目录；检查后用系统压缩。账号由当前副本init生成，.private不分发。源码包不含依赖、数据库或构建产物，接手者须重新安装依赖、init及取得教师隔离库。
