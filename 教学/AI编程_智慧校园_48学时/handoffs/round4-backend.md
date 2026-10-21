# 第四轮后端交接：完整教学业务与真实 MySQL 验证

- 日期：2026-10-19（Asia/Shanghai）。
- 写入范围：resources/campus-ai-course/backend/ 及本交接；未改 system、共享合同、前端、fixtures、正文或根运行工具。
- 状态：IMPLEMENTED_LOCAL_MYSQL_VERIFIED。first-chain 兼容保留；teacher-db 的 05—12 章后端教学业务已实现。本交接不代替根会话的独立 HTTP/浏览器验收。

## 实现交付

- FullCampusController：overview、latest、history、locations、报警读取、事件列表/详情/handlers/操作、演练、责任及 AIRIOT 状态接口。机器合同见 backend/docs/full-api.json。
- CampusProvider、MockCampusProvider、SelectedCampusProvider：显式选择 TEACHING_MOCK/AIRIOT；目录/最新点/历史使用固定来源时钟；非法、缺测、过期、未来值与 null 历史断点规则已实现。
- LocationService、CampusMapper、V2 迁移：校园、楼栋、空间绑定、身份、事件/责任主行和时间线持久化；SQL 均绑定值。V1 保留。
- OperationsService：对象范围、状态门槛、来源恢复/核实、expectedVersion、行锁和同事务时间线；详情/列表在只读事务读取，避免主行与时间线跨快照。
- DbAccountDirectory：每请求重读身份状态与角色；四身份、三角色。初始 admin=ADMIN+CAMPUS_VIEWER；账号禁用/撤权可影响已有会话。
- AccountAdmin 与 tools/account-admin.mjs：教师专用进程工具，无公开调试写接口，只可操作四身份和三角色。需 private 配置 allowAccountAdministration:true 和 campus_course_ 专属 schema 前缀。支持教师提供的 MySQL 地址，实际仅测试本机库。
- tools/test-mysql.mjs：Node 跨平台启动 Maven，无新增 Python 学生依赖。需独立 *_test schema、allowTestReset:true；Java 再校验实际数据库名后才清理测试表。
- 非 Web migrate-only 可完成 Flyway、种子初始化后正常退出。正常 teacher-db 默认不迁移。默认演练启用，可 COURSE_DEMO_ENABLED=false。
- 核心与测试 Java 已用现有 google-java-format 1.28.0 的 AOSP 4 空格统一展开；工具未加入 pom 或学生运行依赖。

## 实际执行与结果

在 backend 目录、JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home 执行：

```text
node tools/test-mysql.mjs package
```

最后完成时间 2026-10-19 00:12:21 +08:00。实际 Oracle JDK 17.0.6、Maven 3.8.6、隔离 MySQL 8.4.10 / campus_course_test。结果 29 tests / 0 failures / 0 errors / 0 skipped，BUILD SUCCESS；其中原第一条贯通 13 个测试保留并通过。无数据库的正常 test 为 18 个执行、11 个 MySQL 显式跳过，不应误标全量通过。

| 套件 | 数量 | 覆盖 |
| --- | ---: | --- |
| CatalogReaderTest | 5 | source/simulated、ID、Boolean、时间和关联拒绝 |
| FirstChainTest | 7 | 认证/CSRF/会话/角色/无数据库第一链 |
| LocalAccountDirectoryTest | 1 | 密码配置边界 |
| QualityPolicyTest | 3 | 质量夹具/类型/边界、历史过滤后截断/null、AIRIOT 拒绝 |
| SourceSelectionTest | 1 | AIRIOT 不回退 mock、非法配置失败 |
| CloseRulesTest | 1 | 满足所有关闭条件的基准及单变量否定反例 |
| TeacherDbTest | 11 | 实库 CRUD、监测、权限、动态身份、状态/版本、分页、双对象并发和回滚 |

V1/V2 在本轮隔离空库上实际应用成功，最后运行也完成 checksum 校验。Flyway 10.20.1 对 MySQL 8.4 提示超过其官方测试 8.1；没有掩盖该警告。本机迁移和事务测试通过，不宣称教师任意版本或远程配置已验证。

## 事务证据

文件 backend/evidence/mysql-transaction-evidence.json 包含 4 个场景：

1. 事件并发 NOTE：独立会话、线程、MySQL 连接 31/32，锁前屏障同时进入；结果 200+409，v7→v8，时间线只增加 1。
2. 责任并发：不同连接重叠提交；结果 200+409，v0→v1，时间线只增加 1，已有事件完全不变。
3. 事件回滚：主行 UPDATE affectedRows=1，事务内观察 v8 后，在时间线 INSERT 前注入异常；HTTP 500；DriverManager 物理连接 38（前）、39（后）与故障连接 31 不同，完整主行/时间线均保持 v7/7 条；清除故障后同对象同 v7 正常提交，200、v8/8 条。
4. 责任回滚：UPDATE affectedRows=1 后注入；HTTP 500；新物理连接 35/36 与故障连接 31 不同，主行 v0、时间线 0 保持；同对象同 v0 正常对照 200、v1/1 条。已有事件在失败与正常对照之后均未变化。

故障拦截器仅在 src/test 中；未引入业务服务故障开关、HTTP 参数或运行包测试接口。证据记录 faultHit、对象 ID、受影响行数、连接 ID、前后版本和数量、正常对照，不含凭据。

## 学生任务锚点

| 标记 | 函数 | 测试 |
| --- | --- | --- |
| C05 | LocationService.validateBinding(String spaceId,String buildingId) | TeacherDbTest#spaceBindingRejectsMissingReferences |
| C07 | QualityPolicy.classify(JsonNode value,JsonNode time,long observedAt) | QualityPolicyTest#qualityBoundariesAndMalformedTypes |
| C09 | OperationsService.requireClosable(AlarmCase c,List<CaseEvent> timeline) | CloseRulesTest#eachMissingCloseConditionIsIndependentlyRejected；TeacherDbTest#closeRequiresAllServerFacts |
| C10 | OperationsService.checkOwnerVersion(long expected,long actual) | TeacherDbTest#ownerRequiresCurrentVersionAndChangesOnlyFutureAssignment |

每个 BEGIN/END 仅一处。参考实现完整；生成学生章节起点时替换单块为 UnsupportedOperationException("STUDENT_TODO_Cxx")。C08 角色 CLI、C11 测试工具的参数与授权约束已写 README 并交给正文代理。

## 可分发证据与哈希

- backend/evidence/test-summary.json：只从 Surefire XML 提取 suite 名、tests/failures/errors/skipped/time；总计 29，0/0/0。没有复制系统属性、stdout 或配置。
- backend/evidence/mysql-transaction-evidence.json：真实 MySQL 的四场景结果。
- backend/evidence/source-manifest.json：48 个源码/配置/文档/工具文件的 SHA-256，包含排序清单摘要；不含 target、evidence 或 private。
- 最后源码摘要：`2c0d7669b69e8f81924f805f4b41f34e0c67ffd17591adf28a834cc7d3ac593e`。
- 最后 JAR：target/campus-ai-course-0.1.0.jar；SHA-256 `c204f43bee13ad48be1b919c0c03fc64ace409dbe1a7522b92cd392f4d6bded2`。
- 原始 Maven 日志仅本机 target/round4-mysql-package.log；target 不进入课程资源分发。运行包或源码后续变化须重新生成哈希。

## 明确限制

真实 AIRIOT 保持未配置：选该 source 时目录/监测读取 503，状态 PENDING；没有真实上游调用、设备控制、通知或真实故障恢复。Windows 命令及 wrapper 已提供，但未在 Windows 实机执行；教师远程库支持配置，未连接远程。Spring/JDK 的 SCA 本轮未执行，不将功能测试当作依赖安全审计。浏览器、真实 HTTP、重启持久化和角色 CLI 的外部运行证据由根会话另行汇总；本交接只对本人实际执行的构建和实库测试负责。

## 最终运行收尾补充（2026-10-19 00:21 +08:00）

- 已精确核对原 PID 70488 的 Java 路径和课程 JAR，再仅对该专属 8091 进程发送 TERM；未停止 MySQL、5178 前端或其他服务。最终 JAR 哈希保持上文值。
- 用 Node 22.21.1、JDK 17.0.6、tools/course.mjs backend-db 启动最终 JAR；课程 tools/verify-full-api.mjs 实际通过 7 组。
- 随后只切换课程后端为 first-chain，tools/verify-first-chain-v1.mjs 实际通过 6 组：四身份 HTTP/CSRF/会话/退出，以及 1440/390 宽度页面筛选、失败快照、恢复、退出清理；无需兼容性源码修复。
- 前次 full-api/first-chain-v1 证据先复制到 resources/campus-ai-course/evidence/archive/，未把旧运行伪装为新运行。当前各 verification.json 与截图来自本次收尾。
- 最后恢复 teacher-db；Java PID 95408，exec session 17237。通过 5178 同源代理登录读回 16 台设备，并确认刚才创建的校园/空间绑定和已关闭事件（版本及时间线）重启后保持。结束验证会话已退出，服务继续供复查。
- 汇总见 backend/evidence/final-runtime-verification.json。此补充将上文“本人未执行真实 HTTP/浏览器”的旧边界更新为上述具体实测范围；真实 AIRIOT、远程教师库、Windows 仍未执行。
- Windows 静态检查见 backend/evidence/windows-static-check.json：三份 Node 脚本语法通过，核对 .cmd 入口、JAVA_HOME/中文空格路径的参数边界、Windows wrapper、环境注入。未发现文档内固定命令的确定阻塞问题；Windows 首次下载、实际中文空格目录和 Ctrl+C 仍需实机验证。Node 官方说明：https://nodejs.org/download/release/v22.23.3/docs/api/child_process.html#spawning-bat-and-cmd-files-on-windows 。没有将静态审查标作 Windows PASS。
