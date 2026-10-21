# 第四轮前端交接

本子任务仅写教师参考 `resources/campus-ai-course/frontend/`、本交接及经主任务授权的 `resources/campus-ai-course/evidence/full-browser/`。没有改原 system、后端、共享合同、夹具或学生副本，没有自行启停服务、清数据库或连接 AIRIOT。

## 实现与边界

- 保留第04章 FirstDeviceRead.vue 与 A/B 标记，入口 `#first-read`；默认 `#devices`。完整页继续复用原设备解包和三态标签。
- 05：LocationsView 校区、楼栋、空间本地绑定；所有写 CSRF、严格 canAdmin，后端最终判定。
- 06：DeviceCatalog 联合筛选、清除全部筛选、稳定 deviceId 的 URL 详情与刷新恢复；未知 ID 明确错误。
- 07：OverviewView 服务端质量与完整度；完成后15秒轮询、手动刷新重置、离页停止。HistoryView 使用真实样本与时间，ECharts line 的 connectNulls=false，无插值/补点/补零，原始表可核对。
- 08：保留完整教师登录/CSRF/sessionEpoch 框架，capabilities 只有 Boolean true 授权；401清会话、403拒绝区分。
- 09：CasesView 本地场景、过滤分页、详情和时间线；assign/start/notes/recover/verify-recovery/close 各携带准确body与expectedVersion。页面关闭预检说明记录、恢复、核实，后端门槛最终生效。
- 10：OwnersView 责任登记及时间线。修改责任人只影响未来事件，页面明确旧事件保持原分派。
- 11：useRequestScope 的序号/epoch/uid/卸载/abort 共同保护 success/catch/finally；事件与责任409保留输入，回读失败继续锁定，成功仍需人工核对，再明确下一次操作；不把400/403/409/500叫回滚成功。
- 12：state筛选所有变更skip归零，刷新恢复合法state但忽略旧skip；构建命令保持不变。
- AIRIOT为未配置/未验证的只读选做入口，远控与外部通知关闭。遥测固定时钟与业务服务端操作时间分别显示。

## 教学标记

`src/domain/course.ts`：C06=filterDevices，C08=strictCapability，C12=changeCaseState。root生成器已决定stub分别返回[]、false、{state:'',skip:0}；可编译但相关验收测试应失败。A/B两处原标记未删除。教师答案与学生起点/检查点由root同步，本子任务不替root写副本。

## 检查与记录

- Node22.21.1/npm10.9.4实际ci/test/type/build。锁生成用Node22运行现有npm11.16.0 CLI，处理上轮npm10 Arborist问题；所有npm始终使用frontend绝对cwd。
- ECharts原候选6.0.0实际audit发现1 moderate，已按官方6.1.0修复发布锁定ECharts6.1.0/zrender6.1.0。当前audit全量/omitdev均0；保留glob弃用提示但无审计命中。
- 前端单元最新为7文件41项：新增catalog-navigation稳定ID/未知ID/清筛选；其余三文件14项覆盖C06/C08/C12、null/0、关闭预检、竞态、完成后轮询及409交互。此前阶段38项是历史阶段结果。
- `frontend/validation/`保存教师验证与审计，不应夹入学生版。真实数据库事务由后端/root验证；前端mock不作为替代。
- 首轮浏览器空白由运行中Vite引用旧预构建依赖引起，root已仅重启本项目5178并force优化。又发现格式化工具把OwnersView内联多语句@click去分号导致动态模块失败，已提取acknowledge函数，之后41项通过，全部页面模块HTTP200。该问题没有隐瞒为首次即通过。
- 本交接写入时完整真实浏览器E2E在执行，最终以 `evidence/full-browser/verification.json` 的当次status为准；不能仅根据截图存在认定全部通过。最终补充见下方。

## 稳定选择器与复验

`node frontend/tools/verify-browser.mjs` 从资源工程根运行（或frontend下 `node tools/verify-browser.mjs`）。脚本内部读取本工程accounts.json，绝不输出密码、cookie、CSRF；创建独立教学演练/责任时间线，不清库、不重置旧记录。账号需有admin/manager-a/manager-b/viewer四身份。

导航：`nav-devices/locations/overview/history/cases/owners/integration/first-read`。台账：`device-search`、`online-filter`、`clear-device-filters`、`open-{deviceId}`、`device-detail`。历史：`history-device`、`history-tag`。

事件：`demo-scenario`、`trigger-demo`、`case-{id}`、`case-assignee`、`case-note`、`assign-case/start-case/note-case/recover-case/verify-case/close-case`、`case-disposition`、`case-version`、`case-state`、`case-page`、`case-conflict`、`ack-case-conflict`。责任：`owner-{deviceId}`、`owner-assignee`、`owner-note`、`save-owner`、`owner-version`、`owner-conflict`。

主资源页截图名：desktop-devices.png、mobile-devices.png、desktop-history.png、desktop-cases.png、desktop-owners.png。另输出desktop-locations/overview/case-conflict/case-closed及mobile-history/owners/case-closed。截图均在登录后，不含密码输入。


## 最终补充（2026-10-19 00:14 Asia/Shanghai）

完整真实浏览器验证PASS 10组，当前报告及执行时刻保留副本均已写入 `evidence/full-browser/`。验收事件2486fab5-d108-412d-8f9d-2368b9807cdf从v1到v8关闭；实际旧页面v3与外部HTTP新增NOTE v4冲突，确认未自动重放；manager-a实际处理本人，manager-b他人无入口，viewer390无写入口。监测真实观察第二次GET，离页16秒计数仍2；历史power含null和0；first-read16条阻断/恢复；无pageerror/水平页面溢出/浏览器存储令牌。没有声称Windows/手机真机或真实AIRIOT已验收。

最后 `npm run type-check`、`npm run test:unit -- --run`、`npm run build`全部exit0；7文件41项。最终构建主JS109.58kB，CSS20.44kB，按需历史图498.14kB。frontend源码此刻已冻结，主任务可同步学生起点/M检查点。新增E2E报告按时间另存，verification.json作为当前摘要；后续跑前会保留当前报告，不把历史结果改成新结果。

后端代理交叉复核修正了一处nullable：Space.type允许string|null，full.ts现已同步，当前fixture classroom不依赖这一修正才能通过。
