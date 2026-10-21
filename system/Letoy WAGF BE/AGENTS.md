# 智慧校园后端协作指南

本目录继承项目根的 `../../AGENTS.md`。先阅读 `../README.md` 与 `../docs/api-contract.md`，按本系统实际源码工作。

## 结构与命令

- Java 17、Spring Boot 3.4.2，Maven artifact 为 `letoy-wagf-be`，版本 `0.0.1`。
- 主源码为 `src/main/java/com/letoy/main/`；`campus/` 是校园业务与 AIRIOT 适配，`auth/`、`user/`、`role/` 提供身份与角色支持。
- `src/main/resources/db/migration/` 是 Flyway 迁移，`mapper/` 是 MyBatis XML；测试放在 `src/test/java/com/letoy/main/`。
- 本目录执行 `./mvnw test` 或 `./mvnw package`；校园局部检查可用 `./mvnw -Dtest='Campus*Tests,CampusIdentitySecurityTests' test`。构建产物为 `target/letoy-wagf-be-0.0.1.jar`。
- 本地运行使用 `../scripts/local-runtime.py` 的专属配置与进程管理，入口与启停条件见 `../README.md`；不要使用模板 jar 名称或直接以生产 profile 启动。

## 编码与业务合同

- 4 空格缩进，类用 PascalCase、方法和字段用 camelCase，沿用现有 Lombok、SLF4J、`ApiResponse`。控制器验证输入，服务处理业务与权限，mapper 管理持久化。
- `CampusAccess` 校验启用用户和启用角色；前端隐藏入口不能替代 BE 对象与操作权限。
- 保留 `expectedVersion`、并发冲突、事务回滚、演练状态流和已关闭记录不可修改的边界。AIRIOT 原始报警、模拟演练和真实控制分别处理。
- 数据库演进新增迁移；DAO 方法与 XML namespace、SQL id、映射同步。接口变化同步 MG 与 API 合同。
- JUnit 5 测试沿用 `*Tests` 命名和对应包路径，覆盖拒绝、冲突与失败回滚；需要真实数据库或上游时单独说明环境，不能用编译替代集成验收。
- `target/` 与运行日志是生成资料，凭据在项目既有私有机制中；遵守根规则，保留用户未提交改动与历史证据。

## Commit & Pull Request Guidelines

- One logical change per commit; include motivation in the body when behavior shifts.
- PRs should state the problem, the solution, and manual or automated test notes; link issues or tasks and attach API contract updates or screenshots for user-visible changes.

## Security & Configuration Tips

- Secrets currently live in `application-*.properties`; do not commit real keys. Prefer environment overrides or a local `application-local.properties` kept out of version control.
- When adding new config, document defaults in `readme.md` and gate sensitive values behind profiles; avoid hardcoding hostnames or passwords in code.
