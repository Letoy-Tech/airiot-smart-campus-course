# 第三轮交接：第一条贯通后端

时间：2026-10-18。责任范围：仅 `resources/campus-ai-course/backend/` 与本交接文件。未改正文、共享合同、前端、fixtures 或原 `system/`，未读取 `.private`、连接教师数据库或启动共享服务。

## 已交付

- Java 17、Spring Boot 3.4.2、Maven Wrapper 3.8.6 工程；包名 `edu.campus.course`；产物 `backend/target/campus-ai-course-0.1.0.jar`。MyBatis Starter 3.0.4；其余依赖由 Boot 固定 BOM 管理。
- 默认 `first-chain`，回环 127.0.0.1:8091；禁用 DataSource/MyBatis/Flyway 自动配置；HttpSession 单实例认证，没有 Redis 或上游凭据。
- 4 账号 admin / manager-a / manager-b / viewer，3 角色；admin 初始 ADMIN+CAMPUS_VIEWER。密码全部由四个外部环境变量提供，缺任一启动失败，不硬编码默认密码。
- 标准 Spring Security CSRF；匿名 GET csrf；表单 POST login；GET me；POST logout；登录换 session ID，登录后重新获取 token，退出后再次登录前也重新获取。
- me 含 uid/username/displayName/roles/source=TEACHING_MOCK；capabilities 严格使用合同中的字段，canControl=false；不擅加 Device.source。
- 从 `COURSE_CATALOG_PATH`（默认 ../fixtures/catalog.json）读取并校验全量目录，然后仅返回 teaching_space_01、teaching_env_01、teaching_energy_01。顶层来源、模拟标识及全体设备 simulated 标识不合格时失败。observedAt 使用 catalog 固定时间，不使用墙钟；unknown Boolean/时间保持 null。
- 身份校验端口每次授权前读取当前身份是否启用及角色。测试 fixture 能证明同一会话撤销 ADMIN 后读 200/写 403、禁用账号后 401；没有开放调试写接口。当前本地目录是启动时只读快照，课堂手工撤权工具尚未实现。
- GET locations 与管理员 POST campuses 返回 501/TEACHING_TODO_NOT_IMPLEMENTED；其余校园角色写入返回 403；没有伪造写入成功。
- teacher-db 外部配置模板及首个 `course_campus` Flyway 迁移；README 解释 DTO/Service/Mapper/Controller/读回测试 TODO、参数绑定、同名 409、权限和后续路径授权边界。

## 接口与外部变量

已实现：GET /api/auth/csrf、POST /api/auth/login、GET /api/auth/me、POST /api/auth/logout、GET /api/campus/capabilities、GET /api/campus/spaces、GET /api/campus/devices。API 成功 envelope 为 code=0/message=ok/data。登录和退出成功 data=null。

必需密码变量：COURSE_ADMIN_PASSWORD、COURSE_MANAGER_A_PASSWORD、COURSE_MANAGER_B_PASSWORD、COURSE_VIEWER_PASSWORD。路径变量 COURSE_CATALOG_PATH 推荐绝对路径。SPRING_PROFILES_ACTIVE=first-chain。

仅 teacher-db 模板使用 COURSE_DB_URL、COURSE_DB_USERNAME、COURSE_DB_PASSWORD、COURSE_DB_MIGRATE（默认 false）。本轮不提供地址或凭据，也不执行数据库迁移。

## 实际验证

在 backend 工作目录使用 `JAVA_HOME=/Library/Java/JavaVirtualMachines/jdk-17.jdk/Contents/Home` 执行：

1. `sh ./mvnw test`：通过，13 项，0 failure/0 error/0 skipped。
2. 因补充 README 并关闭 MockMvc 自动打印登录请求，重新执行 `sh ./mvnw -B package`：通过，13 项再次通过且成功打包。
3. `sh ./mvnw -version`：Apache Maven 3.8.6；Oracle Java 17.0.6；macOS aarch64。不是仅用 Java 21 编译 release=17。
4. 校验复制的 wrapper properties：仅 Maven Central HTTPS 的 Maven 3.8.6 和 wrapper 3.1.0；没有复制原工程 settings、properties 或运行凭据。
5. 测试读取真实共享 catalog，验证 first-chain 返回 1 空间/2 设备，保留 true/null 和固定 observedAt。单独的 backend 测试夹具保证认证用例不依赖共享目录的具体文案。

实际 jar 依赖核对：Spring Security 6.4.2、MyBatis 3.5.17 / Spring 3.0.4 / Starter 3.0.4、Flyway 10.20.1、MySQL Connector/J 9.1.0。产物 SHA-256：`1662cf6f06e567c43ecc50abc66d0d41394615fd2f635d3f16a77aa5a3de469b`；这是本次打包证据，未来重新打包应重新记录，不把时间相关二进制哈希当作可重复构建承诺。

测试覆盖：匿名请求与缺 CSRF 的 JSON 401；错误用户名/密码统一响应；四身份读取与能力 Boolean；登录 session ID 更换；旧 CSRF 失效；缺 CSRF 的登出 403；正常登出销毁会话；viewer/manager 写 403；管理员 TODO 501；撤权/禁用动态生效；错误 source、simulated、字符串 Boolean、分数时间、重复 ID、缺失选择对象拒绝；缺外部密码拒绝；没有 DataSource Bean。

## 留给统稿和联调

- jar 已通知主代理可供 Node 启动脚本使用；本代理未自行启动 8091，避免与根流程抢占端口。
- MockMvc 不能证明 Servlet 容器真正发出的 Cookie 属性；根流程需实际 HTTP 检查 HttpOnly、SameSite=Strict，并与前端登录/登出联调。
- Windows wrapper 和启动说明已提供，但没有 Windows 实机证据。
- 未完成数据库迁移、校园持久化业务、latest/history 质量计算、可控 Clock、事件/责任、并发、事务回滚或真实 AIRIOT；不能把本轮测试改写为这些模块已通过。
- canHandleAlarms/canAssignAlarms/canAudit 是角色资格；相关业务尚未实现。canRunDemoScenarios=false。后续各写接口必须替换第一条贯通的统一 ADMIN 写入门槛，增加管理人员本人范围等规则。
- 这份资源是第一条贯通教师参考骨架；课程整体的 lab_verified 状态需继续按章和实验分别记录。
