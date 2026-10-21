# 第10轮后端与只读夹具交接

状态：`PASS_NO_DB`，2026-10-19。只修改当前 `resources/student-project/backend/`、`fixtures/`，另新增本交接；未改frontend、工具、旧guide、原system或历史参考工程。未读取凭据，未启动/停止服务，未连接共享或教师数据库。

## 已实现

| 能力 | 实际行为 |
| --- | --- |
| 原始报警 | `GET /api/campus/alarms`，3类校园角色读取；5条人工样例，保留原始status/level，未知设备/时间可空。time/recoveryTime与occurredAt/recoveredAt兼容同值；source=TEACHING_MOCK、simulated=true。 |
| 真分页 | limit默认50、1..100；skip默认0、0..10000。total为分页前数量，越界末页items空但total不变。报警按occurredAt倒序/未知时间最后/id倒序。 |
| 可确定的失败 | 报警、history和审计读取支持可选scenario=normal/empty/failure；默认normal。empty成功空；failure为503/MOCK_READ_FAILURE，data=null；无效值400。只影响当前模拟读取，不写文件/数据库、不改全局开关。 |
| 多设备历史 | 四空间temperature/humidity/voltage/power共16条可比较序列。原energy01/power四点不变；新15条序列各6点，包含null和真实0。原设施/照明点仍是目录单点回退。 |
| 独立审计读取 | 新 `GET /api/campus/command-audit`，仅当前有效ADMIN；3条虚构历史样例，按createdAt倒序/id倒序分页。顶层及每项均标HISTORICAL_TEACHING_SAMPLE/source/simulated。不存在写入路由，也没有执行命令。 |
| 时间解释 | observedAt仍为固定教学时钟1792303200000；time/occurredAt/createdAt为固定样例时刻；queriedAt为服务端本次查询墙钟。history/latest/overview及两个列表带queriedAt，不能据其宣称“刚采样”。 |
| 来源边界 | 真实AIRIOT仍是未配置503/PENDING；选择AIRIOT不会因scenario回退mock。历史审计是单独标注的教学记录，独立于所选数据provider；canControl保持false。 |

没有加入deviceId/status报警筛选，前端本轮按分页读取；现有事件assigneeUid查询参数未改变，可用于任意有效处理人筛选。真实AIRIOT接入、通用用户/组织/角色/访问规则管理、完整校园前端均不由本次后端工作宣称完成。

## 接口与源码

- [冻结增量合同](../resources/student-project/backend/docs/round10-read-api.json)：字段、路由、模拟样例。样例明确不是伪造的现场HTTP记录。
- [完整当前API](../resources/student-project/backend/docs/full-api.json)：同步RawAlarm、CommandAudit、queriedAt与只读scenario。
- `backend/src/main/java/edu/campus/course/TeachingReadSamples.java`：来源/字段/关联校验、原始状态保留、稳定分页、读场景。
- `MockCampusProvider.java`：新增历史序列、查询时刻、报警/审计样例。
- `CommandAuditController.java`、`SecurityConfiguration.java`：新只读路由、管理员权限、当前身份复核沿用。
- `CampusProvider.java`、`SelectedCampusProvider.java`、`FullCampusController.java`：保留原正常方法，增可选模拟场景和queriedAt。
- fixtures新增 `history-series.json`、`raw-alarms.json`、`command-audit.json`；README/schema/manifest同步。manifest共12文件。

旧 `fixtures/history-cases.json` 字节保持不变，SHA-256：`0bd348b9419652d5be20849cae5764c46293f01553183b06c2902684ffb02c0e`。原STUDENT_TODO学生任务标记及其业务块未改。

## 实际验证

使用 `/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home`，实测Oracle JDK17.0.6。backend目录执行普通 `sh ./mvnw test`，明确移除COURSE_TEST_MYSQL环境开关。

- **50项发现，34项执行通过，16项数据库测试跳过，失败0、错误0。**
- 新 `ReadOnlyModelsTest` 7项：实际MVC路由+真实当前夹具+真实安全过滤器；验证匿名/角色/撤权拒绝、5条分页及别名、成功空与503分离、16序列单位与null/0、局部失败独立、审计来源及POST405、非法查询拒绝。LocationService/OperationsService仅作不调用的替身，不打开数据库或HTTP监听端口。
- 新 `ReadFixtureValidationTest` 4项：错误来源/模拟标记/关联/时序/重复ID，审计Boolean和历史来源，历史单位/重复序列/非法值，缺文件不可假装成功空集合。
- `HistoryFixtureTest`原4点练习、原first-chain认证与CSRF等普通测试继续通过；`SourceSelectionTest`增加AIRIOT不接受模拟成功回退的断言。
- 初次新MVC测试装配出现两个CampusProvider候选，已在测试专用配置将夹具provider标为Primary；重新定向及全普通测试通过。未改生产选择规则来迎合测试。

证据：[测试统计](../resources/student-project/backend/evidence/round10/test-summary.json)、[源码hash与边界](../resources/student-project/backend/evidence/round10/verification.json)、[Maven原始文本](../resources/student-project/backend/evidence/round10/maven-test.txt)。日志敏感模式检查0命中；统计未复制Surefire系统属性。

本次没有package，**已有target JAR不是本轮交付依据**；总集成应重新build。没有运行MySQL集成/实际浏览器/Windows/课堂/真实AIRIOT；旧报告不补写成这次的PASS。

## 给课程与工具作者

1. frontend作者已收到冻结类型；可使用每条原始status/level，包括vendor:17和vendor-L7，不要求它们匹配本地事件状态枚举。
2. 根工具作者需同步 `tools/validate-fixtures.mjs` 原来写死的9文件名单，加入3个新文件；本代理按边界未改tools。Java新测试已验证新夹具结构和接口，manifest所有受改字节/hash已同步。
3. 当前生成脚本若仍从历史参考工程重建student-project，会抹掉本轮新功能；需要根作者调整增量生成来源。历史目录没有被本代理更新。
4. 新增 [CodeBuddy真实项目调试练习](../resources/student-project/backend/docs/debug-read-pagination.md)：把total误改成本页数量→IDE读3份真实文件→单个测试定位→一行修复→原测试复验。文档明确故障需在学生副本主动制造，预期不是学生已运行的结果。

冻结后，如修改Java或夹具，请重新执行对应测试并更新本轮源码hash；不要覆盖既有历史验收。
