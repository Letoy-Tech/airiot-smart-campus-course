# 第9轮零基础跟做审查：08—12

本轮只修改walkthroughs第08—12篇与本交接文件。按当前student-project源码、UI模板、prepare/hand-in脚本及数据库测试产物位置逐步对照；没有启动服务、读取凭据、写数据库或重新生成HTML。主任务另做fresh学生工程实操，本报告不替代它。

## 发现并直接修正的操作断点

| 位置 | 原断点 | 已补动作 |
| --- | --- | --- |
| 08第5步；09第6步；10第4/6步 | “打开Console执行”默认会找输入行，易在教程页或筛选框粘贴；刷新后函数/变量已丢失 | 明确5178应用标签、检查→Console、底部大于号输入行、只复制代码不复制围栏、粘贴后Enter、undefined不算结果；typeof courseWrite确认函数；重建整个片段上下文 |
| 08第5步 | 身份切换后可能重跑Date.now代码，变成另一名称，或结果不明就重复POST | 先保存实际name，再从账本复制到admin表单；写入未知先只读，不自动重发 |
| 09第4/5步；10第4/5步 | 重新登录后未讲怎样找回原事件；两章都叫E1易选错；筛选可能隐藏记录 | 清状态/范围、按完整ID逐页找、核对当前记录；浏览器查找仅当前页；明确第10段新E1不等于第09段E1 |
| 09第5步；10第7步 | 409/回读失败时缺明确停点，标签复制与共享会话容易误解 | 按UI实际文案回读、比较、人工确认；未知写结果先读，不重复提交；标签标题复制/新建替代、两标签同admin、结束关闭旧表单 |
| 09/10构建段 | 新手可能中途重启后又在运行JAR时build | 每次构建前确认Ctrl+C恢复提示符；误覆盖JAR出现类加载/CSRF500时停旧进程、重建成功后启动，不删依赖、不将所有500归为此因 |
| 11第四步 | 有报告路径但没教怎样从教师电脑取得并保存，可能造同名空文件或拿旧产物当新结果 | 教师专用命令与学生动作分开；下载原JSON及控制台结果→复制到app/evidence→正确后缀重命名→重开核对时间/四场景；未取得则读有来源历史样例并记未执行 |
| 12第一步 | A“第11章完成版”未必有实际提交或快照 | prepare12前用现有hand-in导出A，记录实际目录和已验证范围，不冒称全通过 |
| 12第二/四步 | C12提示未先交真实源码；README“手工合并”对新手不可操作 | 先发course.ts/CasesView全文；只替换C12标记内部；README旧全文与本人记录发AI，要求完整两文件、检查后替换、保存再重开 |
| 12第五/六步 | 导出与解压目录层级、原app与复现窗口容易混用；最终ZIP可能早于补录证据/提交号 | 以工具输出命名A/B、明确压缩父层选定目录；两系统解压动作；新窗口用process.cwd核对真实根；明确新配置位置；接手记录回到原app，再完成提交记录后重新导出最新目录 |
| 12第五/六步 | 只核对文件名无法确认HANDOFF和证据是新版本；教师报告与“包不含教师PASS”措辞冲突 | 打开导出内docs/HANDOFF、ch11/ch12及复现记录核对正文；保留实际JSON/txt，区分来源，不删合法教师原报告，不以其冒称个人运行 |

08—10同步已准备章节的保留行为：重复prepare保留源码；首次遇个人改动才拒绝覆盖；不删除.lesson-state.json。

## 与当前工程核对的依据

- frontend/src/App.vue、views/FullWorkspace.vue：登录、退出及导航文案。
- views/CasesView.vue：当前记录、状态/范围/分页、详情选择、409回读与人工确认；没有自动按ID搜索入口，因此文稿采用逐页找卡片。
- views/OwnersView.vue：同版本两标签、保留输入、重新读取和已核对最新责任按钮。
- api/auth.ts、domain/course.ts、OperationsService.java：严格Boolean能力、C09关闭条件、C10已有版本检查调用。
- backend/tools/test-mysql.mjs与TeacherDbTest.java：专用测试库授权；报告由AfterAll生成到backend/target/mysql-transaction-evidence.json，存在报告不等于全套成功。
- tools/hand-in.mjs：白名单实际包括docs、evidence、project-docs、.lesson-state.json；外层docs仅在无工程内project-docs时复制；排除秘密及生成目录。未发现会丢docs/HANDOFF.md或本人证据的白名单缺陷。

## 本轮实际检查

- 5篇Markdown的本地链接目标存在，代码围栏配对。
- 08的1段、09的1段、10的2段Console JavaScript用node --input-type=module --check作语法检查，4段通过；未执行其中fetch/写请求。
- 人工逐步核对路径、按钮、准备状态、文件归属与导出先后；新增文字不改API或教学状态合同。
- 本轮没有软件全套测试、浏览器实操、物理Windows、真实学生课堂或AIRIOT验收。主任务fresh演练结果应单独报告。

## 冻结与下一步

正文可统一重建阅读页。请主任务fresh操作特别保留：09/10停止后端后build；12最终导出中实际打开docs/HANDOFF.md及evidence/ch12-reproduction.md，比较文件内容/哈希与原app；从解压根复现。若只是作者同机演练，如实标明，不能改写为真实学生试教。
