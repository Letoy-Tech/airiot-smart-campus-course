# Round 5 后端边界修复与独立验证

状态：四项已修复并完成本机回归；不是 Windows 实机、远程教师库或 AIRIOT 验收。仅修改教师参考工程及本交接，不修改原 system 或九份学生起点。

## 变更清单

1. `OperationsService.detail/list/owner`、`LocationService.locations/spaces` 的多次读取显式采用只读 `REPEATABLE_READ`，不依赖教师库/连接池默认级别。写事务内部回读仍复用原事务。
2. `CatalogReader.timestamp` 复用 `QualityPolicy.time`，目录 observedAt 和非空 communicationTime 统一接受 epoch 毫秒整数 `[0, 8640000000000000]`，拒绝负数、越界、非整数；学生 C07 块未改。
3. `MockCampusProvider` 只接受成功历史响应（JSON 整数 code=0）；历史单位必须为字符串且等于目录点单位（power 为 kW）。V/kWh、缺失、null、数字、空字符串都拒绝启动，以固定解释性错误报告，不将错误单位数值重新贴成 kW；合法 null/0 样本继续保留。
4. 新增 `tools/private-json.mjs`，统一读取私密配置，兼容单个 UTF-8 BOM，拒绝错误编码/JSON/非对象根节点时不回显原内容。接入 `tools/course.mjs`（账号与数据库）、`backend/tools/account-admin.mjs`、`backend/tools/test-mysql.mjs`、教师作者工具 `tools/verify-student-checkpoints.mjs`。
5. 新增 `HistoryFixtureTest`、`SnapshotConsistencyTest`，扩充 `CatalogReaderTest`；新增 `tools/private-json.test.mjs`。核心 Java 使用已有 google-java-format 1.28.0 的 AOSP 格式，未加入运行依赖。
6. 同步 `backend/README.md`；按主会话协调，将 `validate-fixtures.mjs` 排序校验明确解析并核对 `createdAt DESC, id DESC` 两个字段、优先次序与方向；`fixtures/README.md` 说明更新，manifest 只重算 README/pagination 的哈希。pagination 本文由教学审校代理修改。

## 实际验证

- 环境：macOS arm64；Node 22.21.1；Oracle JDK 17.0.6；独立 MySQL 8.4.10，127.0.0.1:13328，仅 `campus_course_test`。没有访问 lab、学校服务或原 system，没有 SET GLOBAL 或服务启停。
- 针对性 Java 边界测试 10/10；新增真实 MySQL 快照测试 5/5；最终 `JAVA_HOME=<JDK17> node backend/tools/test-mysql.mjs clean package`：**39 个测试，0 失败、0 错误、0 跳过**（23 无数据库 + 16 MySQL）。原并发两对象及故障回滚两对象测试仍通过。
- 快照测试将本测试连接池默认设为 READ COMMITTED；读取线程完成首个 SELECT 后通过屏障等待，独立 DriverManager 连接提交主行/时间线或关联变更，再继续第二次 SELECT。实际读取事务隔离为 REPEATABLE READ；前后数据一致，并确认池默认恢复 READ COMMITTED。五场景覆盖事件、责任、筛选列表/计数、校园/楼栋、楼栋/绑定。
- `node --test tools/private-json.test.mjs`：**10/10**，0 失败/跳过。三个实际脚本入口在合成 BOM 配置下运行到子进程启动处，子进程是测试替身，未运行 Java/Maven/数据库。这是跨平台格式兼容测试，不是 Windows 实机通过。
- `node tools/validate-fixtures.mjs`：**9 组、14 个损坏目录拒绝检查通过**；场景规格仍 NOT_EXECUTED，不把文件校验冒充数据库验收。
- 4 个 STUDENT_TODO 块哈希与修复前一致；旧 evidence 5 文件哈希不变；本轮可分发证据已内部扫描实际测试数据库密码，未命中。未复制 Surefire 的系统属性/环境凭据。
- 开发中首次快照测试因测试库名称断言写得过窄而在场景执行前失败；修正为既有前缀+后缀规则后，针对重跑和最终 clean package 均通过。初次失败日志单独保留，不混入最终 PASS。

## 证据和构建冻结

- [总验证](../resources/campus-ai-course/backend/evidence/round5/verification.json)
- [安全 Surefire 汇总](../resources/campus-ai-course/backend/evidence/round5/test-summary.json)
- [快照并发证据](../resources/campus-ai-course/backend/evidence/round5/mysql-snapshot-evidence.json)
- [原并发与回滚重跑证据](../resources/campus-ai-course/backend/evidence/round5/mysql-transaction-evidence.json)
- [源码及附加脚本哈希](../resources/campus-ai-course/backend/evidence/round5/source-manifest.json)
- 同目录保存已核对不含口令的可分发 `.txt` 日志，文件名见 verification.json.artifacts；包括 private-json-tests.txt、fixture-validation-final.txt、full-backend-package.txt 和原缺陷复现日志。`.log` 仅为本机中间资料。修复前 evidence 不覆盖。

后端源码 SHA-256：`788d3b2e4be1fbe6ae0d0408fe21b10fd8ad4c664e3068b021a9a712df327516`（51 个文件，规则见 manifest）。

本轮 JAR SHA-256：`89ab296699fbb0d8ad78d97a2edde36c1c22e6ddd5bb06a008f29b443269ae86`，产物 `backend/target/campus-ai-course-0.1.0.jar`。未启服务加载此 JAR。

数据库操作已完成，已通知主会话可停止专属 13328；由主会话决定进程收尾并同步九份学生起点。Windows 实机、远程教师库、真实 AIRIOT 仍未执行；Spring/JDK 未执行 SCA，Flyway 对 MySQL 8.4 超过其已测试 8.1 的原警告仍保留。
