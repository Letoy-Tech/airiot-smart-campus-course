# 第四轮学生检查点交接

更新时间：2026-10-19（Asia/Shanghai）。本轮学生起点检查状态为 `PASS_STARTER_VALIDATION`，最终实际运行于 00:32:38—00:33:13。该状态表示可发放的任务起点符合预期，所有 `studentTaskCompleted` 仍为 `false`。

## 交付与改动范围

- 生成器：`resources/campus-ai-course/tools/student-checkpoints.mjs`。保留目标已存在时拒绝覆盖的保护；只在最初确认目标不存在后生成，后续同步均先验证现有文件符合本次生成记录。
- 教师复验工具：[verify-student-checkpoints.mjs](../resources/campus-ai-course/tools/verify-student-checkpoints.mjs)。生成器明确排除此工具，现有九份学生副本也不含此文件。配置 Java 17 和冻结 Node 后，在教师参考根目录执行 `node tools/verify-student-checkpoints.mjs --allow-test-reset`；显式参数与专属 TEST 配置缺一则拒绝运行数据库测试。
- 九个独立起点：`resources/student-chapters/ch04` 至 `ch12`。每个只留本章小块，其余为教师预置；第 11 章代码完整，另附四组空白预测与断言模板。
- 实测记录：[verification.json](../resources/student-chapters/verification.json)；生成索引：[manifest.json](../resources/student-chapters/manifest.json)。每章另有 `checkpoint.json` 文件哈希记录。
- 每个起点记录 118 个交付文件，第 11 章为 119 个（多一份断言模板）；上述数量不含 `checkpoint.json` 自身。

本轮没有修改原 `system/`、教师业务实现、总索引或打包脚本；没有执行共享 lab 的 E2E 或启停服务。

## 分发完整性

生成器明确排除整个 `frontend/tools/`、`frontend/validation/`，同时排除 `.private`、`.runtime`、`node_modules`、`target`、`dist`、Git 元数据、环境秘密文件与教师证据。每章的 `evidence/` 只含要求学生记录自身证据的空白说明。交付中没有符号链接。

每个副本有三处原 Markdown 链接指向副本外合同或未分发的教师证据，已转为注明课程总包位置与教师提供责任的纯文字，不制造悬空链接。每章 22 个保留的本地链接及 1 个标题锚点已检查。

首次运行夹具检查失败：`fixtures/schema.md` 的外部合同链接改写后，`fixtures/manifest.json` 仍保存教师原文的大小与哈希。修复为仅允许对生成时改写的 Markdown 重算 manifest；任何 JSON 数据夹具变化都会拒绝生成。九份 `schema.md` 的记录已重算，实际夹具数据未改，随后重新执行了全部验证。最终结果对应修复后的新运行，先前失败没有当作通过。

正文团队定稿的跨平台启动与第 04 章操作单已同步九份副本，随后重算 `checkpoint.json`。实际测试完成后再次逐文件核验，所有交付哈希仍一致。

## 实际执行

运行环境为 macOS arm64、Node `22.21.1`、npm `10.9.4`、JDK **17.0.12**。本轮不是教师主验证所用的 JDK 17.0.6，也没有将其记录成相同补丁版本。Windows 仍须按教师开课检查在实际设备上验证。

每章均执行并通过以下检查：

1. 在该章隔离临时副本根目录运行 `node tools/validate-fixtures.mjs`。
2. 在隔离副本 `frontend/` 运行 `npm run build`，包含 TypeScript 检查与 Vite 构建。
3. 在隔离副本 `backend/` 运行 `sh ./mvnw -B -q -o -DskipTests compile`。

临时副本只将冻结的教师 `frontend/node_modules` 链接用于验证；Vite 缓存移到各临时副本，避免修改共享依赖缓存。临时构建输出及依赖链接已移除，未写入交付副本。

| 起点 | 已实测的本章预期 | 实际结果 |
| --- | --- | --- |
| ch04 | A/B 未填，`http.test.ts` 与 `first-device-view.test.ts` | 15 项中 9 通过、6 按预期失败；包含业务 code、data 解包及 online 三态 |
| ch05 | `TeacherDbTest#spaceBindingRejectsMissingReferences` | 独立真实 TEST 数据库，指定断言期望 404、实际 501；测试运行错误为 0 |
| ch06 | `course-domain.test.ts -t C06` | 1 项筛选测试按预期失败，4 项未选中 |
| ch07 | 先 `-DskipTests compile`，再 `QualityPolicyTest#qualityBoundariesAndMalformedTypes` | 编译通过；`valid-number` 断言期望 fresh、实际 missing；测试运行错误为 0 |
| ch08 | `course-domain.test.ts -t C08` | 1 项严格 Boolean 能力测试按预期失败，4 项未选中 |
| ch09 | `CloseRulesTest#eachMissingCloseConditionIsIndependentlyRejected` | 完整关闭条件应通过的断言收到 `TODO_C09`；测试运行错误为 0 |
| ch10 | `TeacherDbTest#ownerRequiresCurrentVersionAndChangesOnlyFutureAssignment` | 独立真实 TEST 数据库，指定断言期望 200、实际 501；测试运行错误为 0 |
| ch11 | 代码无 TODO，前端全套及后端 `-Dtest=*Test test` | 前端 41 通过；后端 18 通过、11 个数据库测试明确跳过；四组学生断言仍为空白 |
| ch12 | `course-domain.test.ts -t C12` | 1 项筛选变更分页归零测试按预期失败，4 项未选中 |

ch05、07、09、10 的前端均另外跑全套 41 项并通过。预期失败必须有测试断言失败；环境启动异常、编译错误或数据库错误没有当作练习验收成功。

最终验证器逐项核对前端失败用例名称，以及后端失败方法名、Assertion 类型、期望/实际值与对应 TODO 原因，并在 JSON 保留脱敏短摘要。补充解析器首次把 C07 标签误写为 `good` 时，工具如预期拒绝判为通过；已核对合同改为 `fresh` 并完整重跑，最终报告的 `priorRun` 保留该前次校验状态与哈希。此修正仅涉及验证工具，学生源码与夹具未改。

前端指定测试命令为 `npm run test:unit -- --run <文件> [-t Cxx]`，后端指定测试为 `sh ./mvnw -B -q -o -Dtest=<类名#方法名> test`。验证时以教师专属配置在进程环境中提供 `campus_course_test` 的数据库连接，并开启明确的 TEST reset；只在 ch05、ch10 的测试阶段使用。未将凭据复制到学生包、日志或此交接中；未分发可能含环境属性的原始 Surefire XML。

第 11 章本轮仅验证空白任务模板与预置代码可用，不能据此声称学生本人已做真实数据库并发/回滚实验；课堂仍须填写预测、运行对应真实 TEST 实验、解释证据链，并由教师评阅。

## 答案恢复与最终冻结

对每章的 70 个前后端源码文件进行内存比较：仅在内存中把该章 TODO 替换回教师对应标记块，然后核对整文件 SHA-256；九章均与冻结教师实现完全一致。交付副本中的 TODO 和空白断言没有被填回。

- `manifest.json` SHA-256：`ba8f2c40fdbf2b030e20678fc9661694284b117669057eb0194f3f02f6442f8c`
- `verification.json` SHA-256：`c5213a61647ea2571661954cc27e9c865c66d7d067d26ed75cf3566dbf63c992`

可以按上述已冻结的九份副本打包。生成器遇到已有 `student-chapters` 会拒绝覆盖；教师以后重新生成时应保留原学生作品，并在新的教师资源副本中执行。
