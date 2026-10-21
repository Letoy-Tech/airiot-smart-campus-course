---
writer_group: "01-04"
status: DRAFT_WRITTEN
lab_verified: false
updated_at: 2026-10-18
---

# 第 01—04 章作者交接

本组四章连续阅读初稿已写入 `manuscript/`，共 20,770 个中文汉字（按 Unicode U+4E00—U+9FFF 计数，不含英文、标点和空格），另有 13 幅可编辑 Mermaid 图源。每章均保留 1＋2＋1 学时，合计 16 学时。状态为 `DRAFT_WRITTEN`、`lab_verified=false`；没有提升为资源齐备的 `WRITTEN`、实验已核验或正式教案。

## 已写正文

| 文件 | 中文汉字数 | 本章内容与图数 |
| --- | ---: | --- |
| [01-软件工程入门与网页AI协作.md](../manuscript/01-软件工程入门与网页AI协作.md) | 5,113 | 工程活动、好坏提示、三轮网页协作、反例审查、证据和接力；3 图 |
| [02-需求分析与项目计划.md](../manuscript/02-需求分析与项目计划.md) | 5,344 | 用户故事、范围、角色、验收、R/AC 追踪、五里程碑与变更；3 图 |
| [03-架构数据与接口设计.md](../manuscript/03-架构数据与接口设计.md) | 5,050 | 分层与提供器、DTO、两份完整读响应、ER、双状态和事务版本；4 图 |
| [04-开发环境版本控制与首次贯通.md](../manuscript/04-开发环境版本控制与首次贯通.md) | 5,263 | 环境核对、Git 独立练习、条件式启动步骤、请求时序、失败与复现；3 图 |

四章均含场景、进入条件与可观察目标、三模块、最小实验、可复制网页 AI 提示、人工检查、常见错误、验收、课后练习与答案要点、进阶选做及下一章接力。第 01 章明确区分真实在线协作与离线缺陷样例；第 04 章没有虚构可运行包、登录接口、端口或数据库配置。

## 图源清单与统稿位置

正文已经在相关段落引用图号，并给出图题、用途、相对图源链接及替代文字。以下是源文件交付，尚未生成或插入 PNG，不是运行截图。

| 图号 | 源文件 | 教学目的 |
| --- | --- | --- |
| 01-01 | [ch01-01-engineering-cycle.mmd](../figure-sources/ch01-01-engineering-cycle.mmd) | 工程活动与证据反馈 |
| 01-02 | [ch01-02-prompt-comparison.mmd](../figure-sources/ch01-02-prompt-comparison.mmd) | 含糊提示与可检查任务对照 |
| 01-03 | [ch01-03-ai-evidence-loop.mmd](../figure-sources/ch01-03-ai-evidence-loop.mmd) | 模型建议必须经过人工执行和核验 |
| 02-01 | [ch02-01-scope-map.mmd](../figure-sources/ch02-01-scope-map.mmd) | 用户需要、必修、选做与范围外 |
| 02-02 | [ch02-02-traceability.mmd](../figure-sources/ch02-02-traceability.mmd) | R06 到任务、AC07/08/09 和证据 |
| 02-03 | [ch02-03-milestones.mmd](../figure-sources/ch02-03-milestones.mmd) | M1—M5 与章节依赖 |
| 03-01 | [ch03-01-architecture.mmd](../figure-sources/ch03-01-architecture.mmd) | 前端、后端、独立库与提供器边界 |
| 03-02 | [ch03-02-local-records-er.mmd](../figure-sources/ch03-02-local-records-er.mmd) | 设备逻辑引用及四类本地业务记录 |
| 03-03 | [ch03-03-two-state-axes.mmd](../figure-sources/ch03-03-two-state-axes.mmd) | 来源恢复不能直接成为处置关闭 |
| 03-04 | [ch03-04-version-transaction.mmd](../figure-sources/ch03-04-version-transaction.mmd) | 行锁、版本竞争与同事务时间线 |
| 04-01 | [ch04-01-git-workflow.mmd](../figure-sources/ch04-01-git-workflow.mmd) | 工作区、暂存区、提交和两类 diff |
| 04-02 | [ch04-02-first-request.mmd](../figure-sources/ch04-02-first-request.mmd) | 已认证请求通过代理读取教学数据 |
| 04-03 | [ch04-03-debug-path.mmd](../figure-sources/ch04-03-debug-path.mmd) | 按网络现象定位错误层次 |

## 实际做过的检查

检查日期：2026-10-18。以下仅为文稿和独立片段检查，不构成课堂实验或完整工程验收。

1. 读取根目录 `AGENTS.md`、`system/README.md`、`system/docs/api-contract.md`，以及课程约定、总纲、教学合同、本轮任务书、本组四章设计稿、AI 协作规范、任务/接力/追踪模板、考核基线和教师资源清单。参照当前文件编写，没有把参考系统历史验收挪成课程结果。
2. Python 结构检查：四章 YAML 状态均为 `DRAFT_WRITTEN`、`lab_verified=false`；三个模块学时顺序均为 `[1,2,1]`；代码围栏全部成对闭合。四章围栏块数分别为 3、1、3、7。
3. Python `json.loads` 检查：第 03 章两份完整 JSON 读响应均可解析。另人工对照共同合同核对外层、ID 关联、分类枚举、空值、毫秒时间、模拟标记与列表层级；没有调用 API。
4. Markdown 链接与表格检查：四章全部本地相对链接存在；13 个图号在本组内唯一，每图恰有一个源文件、对应图注与替代文字；全部表格的列数一致。检查中修正了字段字典中类型联合符号的 Markdown 转义。
5. Mermaid 语法检查：在一次性临时目录安装 Mermaid **12.2.0** 与 jsdom，逐一调用 `mermaid.parse`；13/13 通过，0 失败。类型为 10 个 flowchart、1 个 ER、2 个 sequence。未进行图片渲染或目视排版验收，统稿仍须用最终渲染器检查。
6. 第 04 章独立 JavaScript 片段：从正文提取后执行 `node --check`，再在本机 Node v26.3.0 的隔离 VM 上检查 `true/false/null` 的三个预期显示，以及 `"false"`、`0`、`undefined` 三个非法输入的抛错，6 个检查均符合预期。此检查不依赖教学工程，不证明目标机房或浏览器流程通过；该 Node 版本也不是课程已冻结版本。未执行本章 Git 提交练习、Maven、npm 工程安装或启动步骤。
7. 人工合同检查：三角色与本人范围、无控制/通知、来源与模拟属性分离、DEMO/LOCAL_DEMO、恢复与关闭分离、严格 expectedVersion、409 回读不重放、主记录与时间线同事务、责任变更仅影响未来事件、有效零与未知分离均保留。未使用原演示设备 ID 作为教学最小数据 ID。
8. 为正文技术说明查阅了 Qwen3 官方仓库、Git add/revert、npm ci 与 Vite server.proxy 官方文档，引用已放在相应段落附近。没有验证学生账号的实际网页型号、额度或校园网络可达性。

## 尚未实测与待制作资源

- 教学骨架、认证基础、最小读取桩、模拟提供器、固定种子和可控时钟尚未随本组交付；没有成功启动、浏览器贯通或数据库运行记录。
- Windows/macOS 目标环境、具体 Node 版本、数据库运行方式、端口分配和 Redis 是否保留仍由教师资源制作阶段冻结。本组未据此停止可独立完成的正文，也没有擅自做决定。
- 登录路径、配置加载方式、教学 profile、Wrapper 文件、`dev` 脚本等须随骨架实际交付核对。第 04 章只提供有明确执行条件的拟定步骤，不保证仅复制命令即可运行。
- 第 03 章 `teaching_space_01`、`teaching_env_01`、`teaching_energy_01` 来自共同合同；示例 `tableId`、空间 type 和标签取值是明确标注的教学样例，完整夹具冻结时应统一核对。两个固定时间为演示用 epoch 毫秒，不是实际观测记录。
- 真 MySQL 的并发、事务回滚、角色拒绝与撤权、浏览器刷新/恢复、他人复现和课堂试讲均未执行。没有 AIRIOT 真实接入或任何远端写入。

## 交给图文统稿与主会话

1. 在主会话确认作者交付后，将 13 幅图统一渲染为可直接显示的 PNG，并在现有图注附近插入；保留 `.mmd` 源。逐幅检查中文字形、节点裁切、连线及双向反馈，解析通过不能替代目视检查。
2. 图 03-02 的设备节点是提供器逻辑引用，不能在统稿时标为已建本地设备表或跨库外键；实体关系为概念模型。图 03-03 的关闭关卡不是新增状态，来源恢复不能画成直接关闭。图 03-04 说明并发顺序，不能改成自动重试旧决定。
3. 图 04-02 从已认证教学会话开始；不要为补图而添加临时免登录入口或伪造 Network 截图。所有图均为教学示意。
4. 列表 `/campus/spaces`、`/campus/devices` 保留 `{items,observedAt}`，没有私自增加 `source`；概览和历史保留合同的 `source`。若统稿决定新增列表来源字段，应先经主会话统一合同、DTO、前端类型和测试，避免各章自行扩展。
5. 第 04 章现阶段没有逐文件可运行实现，是按照任务要求提供拟定流程与独立练习。骨架制作后需用真实文件、配置和执行证据替换条件式说明，再进入 `WRITTEN` 与 `LAB_VERIFIED` 关卡。
6. 主会话更新索引、README、进度与总包时，可将本组四章登记为 `DRAFT_WRITTEN`，但须保持 `lab_verified=false`。本组未修改这些共享文件。

## 本组修改边界

本组工作区写入仅包括上列四份 `manuscript/` 正文、13 个 `figure-sources/ch01—04-*` 文件和本交接文件。旧 `chapters/`、共享合同、索引、README、其他组章节、现有 `system/` 与原 Word 大纲均未由本组修改；未读取 `.private`，未启动服务，未操作生产，未发送跨会话消息。
