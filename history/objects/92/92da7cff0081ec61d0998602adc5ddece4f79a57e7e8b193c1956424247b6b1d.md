# 第三轮：固定教学夹具与独立校验

状态：资源已制作，独立文件校验已执行；`lab_verified=false`，`database_verified=false`。执行日期：2026-10-18。此记录不把场景规格写成实际后端结果。

## 本轮范围

只写 `resources/campus-ai-course/fixtures/`、`resources/campus-ai-course/tools/validate-fixtures.mjs` 和本接力文件。没有修改共享合同、正文、原 system 工程；没有启动服务、请求远端、读取凭据或操作数据库。

新增文件：

- `fixtures/catalog.json`：4 空间、16 设备、28 个唯一 `deviceId+tagId` 点；每空间四类设备各一台，点数按 `4×(2+2+2+1)` 计算。
- `fixtures/selectors.json`：first-chain 为 1 空间、2 设备、4 点；full 为完整目录。
- `fixtures/quality-cases.json`：15 个 raw/expectedQuality 分离的案例，包含有效零、missing、非法类型和 60 秒/未来 5 秒边界。
- `fixtures/history-cases.json`：合法 ApiResponse，4 条历史样本含 1 条 null 和 1 条有效零。
- `fixtures/permission-scenarios.json`：四身份、撤 ADMIN 保留读取资格、A/B 本人范围的未执行规格。
- `fixtures/pagination-scenarios.json`：9 个事件列表分页规格，不冻结页内排序或具体 ID。
- `fixtures/concurrency-rollback-scenarios.json`：事件/责任各一组并发竞争、各一组时间线失败回滚规格，需要真实隔离 MySQL 实施。
- `fixtures/README.md`、`fixtures/schema.md`、`fixtures/manifest.json`：用法、文件格式、单位映射和 SHA-256。
- `tools/validate-fixtures.mjs`：无第三方依赖、只读的 Node 校验器。

## 已冻结并同步给前后端的内容

catalog 顶层为 `schemaVersion/source/simulated/observedAt/spaces/devices/points`。Device 沿合同完整字段，含 `spaceName/communicationTime/switchOn` 可空键，不添加 source。所有对象为教学模拟；ID 使用 teaching_ 前缀，不包含原平台项目 ID。

固定时钟：`1792303200000 = 2026-10-18T06:00:00.000Z`，由课程人工选择，不能拿运行时墙钟重新推导本案例质量。first-chain 使用 `teaching_space_01`、`teaching_env_01.online=true`、`teaching_energy_01.online=null`；full 再含 `teaching_facility_04.online=false`。

正文已使用的 `temperature/power` 保留。全套标签为 temperature、humidity、voltage、power、run_state、equipment_temperature、illuminance；单位分别为 °C、%、V、kW、空字符串、°C、lux。manifest 列出与原参考标签的对应关系。标签命名和固定时钟已发送给 backend `/root/course_source_audit` 及 frontend `/root/qwen_course_research`。

`quality-cases.json` 的 raw 故意包含非法类型，不能当 Point DTO 直接发给前端。`history-cases.json` 是合法响应，不是异常输入，issues 固定空数组仅用于该样本。多错误优先级、非法历史输入的报告结构/过滤顺序、历史排序及端点包含规则不在本轮擅定。

## 实际检查与结果

在本机 macOS、Node `v26.3.0` 下，从资源工程目录执行：

```sh
node tools/validate-fixtures.mjs
```

最终退出码 0，实际输出：

```text
PASS: 9 fixture validation groups; catalog 4 spaces / 16 devices / 28 unique points.
PASS: first-chain 1 / 2 / 4; 15 quality cases; 4 history samples; 14 damaged-catalog rejection checks.
SCOPE: standalone files and scenario specifications only. No HTTP/provider/database/browser checks; lab_verified=false.
```

覆盖 JSON 可解析、精确字段、计数、唯一点键、空间/设备/tag 外键、四分类、模拟与来源标记、单位、固定时间、first-chain、有效零/null、60 秒与未来 5 秒精确边界、四历史样本、规格内部角色/版本/分页一致性及 manifest 哈希。另在内存检查 NaN/±Infinity 分类，不将这些非法 JSON 数字写入文件；故意损坏目录的 14 个例子均被拒绝。多错误缺失/无效组合显式拒绝判定，避免通过校验器偷偷冻结错误优先级。

这些检查只证明固定文件内部一致。没有 Windows 实机运行、其他 Node 版本实测、Provider 实际输出、HTTP、登录、浏览器页面、MySQL 行锁并发或回滚证据；也没有课堂试讲。后端需将场景规格落实为隔离集成测试，保留写前/写后主记录和时间线证据；教师提供数据库不代表学生无需隔离。

## 后续接力

前后端按同一 catalog 和 selectors 读取，不各自复制出漂移的数组。Provider 返回合同 DTO，不把 schemaVersion 或 scenario 的 ownerKey/actorKey 当接口字段。逻辑身份和事件需由测试准备步骤映射为真实教学 uid/id。并发规格的两个请求都读取当前同版本后同步竞争，失败时间线注入必须验证同事务回滚，不能以此 JSON 的 expected 字段充当执行结果。

注意：selectors 是规范文件。本轮 `CatalogReader` 只读取 catalog，并按与 first-chain 相同的 ID 固定选取，尚未实现运行时 full 切换；README 已据此修正并更新 manifest 哈希，修正后独立校验再次退出 0。

## 追加只读交叉复核

按主会话追加任务，阅读 `tools/course.mjs`、`tools/make-student.mjs`、资源 README、跨平台启动说明、第 04 章操作单，以及对应任务块、tsconfig、Maven Windows 入口和数据库配置模板；未修改这些文件、未生成学生目录或执行其软件测试。

已向主会话报告两项：Windows doctor 允许仅 PATH 中有 Java 17，但当前 mvnw.cmd 强制 JAVA_HOME，预检与构建前置条件不一致；第 04 章通过修改 API 源码制造失败依赖 HMR 行为，不能保证请求路径切换同时保留同一快照，建议用不重载页面的单请求拦截。由主会话统一修订与验证，本记录保存发现时事实，不代表这些问题仍未修复。

学生 TODO 替换块按当前 TypeScript 配置在静态阅读上类型成立；没有实际编译学生版本，不能写成编译通过。生成器显式排除 .private、.env（保留 .env.example）、依赖和构建输出，数据库模板仅引用环境变量；此次未读取 .private 或任何真实密码。
