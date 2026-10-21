# 第一条贯通：教师后端参考骨架

这是课程资源包的本地参考实现，包名为 `edu.campus.course`。本轮已经实现单实例会话登录、能力读取及第一条贯通的空间和设备读取。校园创建、历史、事件、责任与事务实验尚未实现；本目录不是 12 章全部完成的学生答案。

## 固定版本与启动

- Java 编译目标 17；本机实际验证 Oracle JDK 17.0.6。
- Spring Boot 3.4.2；Spring Security 等依赖由该版本 BOM 固定。
- MyBatis Starter 3.0.4；Flyway、MySQL Connector 由同一 Boot BOM 固定。
- Maven Wrapper 3.1.0 下载 Maven 3.8.6；wrapper 属性只含 Maven Central 的 HTTPS 地址，未复制原工程运行配置。
- `first-chain` 为默认 profile，监听 `127.0.0.1:8091`；排除 DataSource、MyBatis、Flyway 自动配置。无需 MySQL、Redis或 AIRIOT。

优先使用资源包根目录的 `tools/course.mjs` 完成初始化和启动。它负责为本机教学账号生成随机密码并注入子进程；密码文件留在本机 `.private`，不要上传网页 AI 或版本库。手动运行时也必须先从本机安全配置注入以下变量，没有任何预置密码：

| 变量 | 用途 |
| --- | --- |
| `COURSE_ADMIN_PASSWORD` | admin；初始角色 ADMIN + CAMPUS_VIEWER |
| `COURSE_MANAGER_A_PASSWORD` | manager-a；CAMPUS_MANAGER |
| `COURSE_MANAGER_B_PASSWORD` | manager-b；CAMPUS_MANAGER |
| `COURSE_VIEWER_PASSWORD` | viewer；CAMPUS_VIEWER |
| `COURSE_CATALOG_PATH` | catalog.json 路径；默认相对 backend 工作目录的 `../fixtures/catalog.json`，推荐绝对路径 |
| `SPRING_PROFILES_ACTIVE` | 使用 `first-chain`；未设置时默认相同 |

四个密码缺少任一项或为空白，应用启动失败。超出 BCrypt 72 字节输入边界也拒绝启动；不记录或返回密码。运行环境的 `JAVA_HOME` 应指向 JDK 17，`java -version` 和构建输出都应核对。

在本目录执行（Maven 首次需要网络下载依赖）：

```text
macOS:   sh ./mvnw test
         sh ./mvnw package
Windows: .\mvnw.cmd test
         .\mvnw.cmd package
```

四个密码变量和 catalog 路径已经正确注入后，运行 `java -jar target/campus-ai-course-0.1.0.jar`。本轮实际测试环境为 macOS；Windows 命令和 wrapper 已提供，但未在 Windows 实机执行。

## 已实现接口

成功为 `{code:0,message:"ok",data:...}`，拒绝同时使用正确 HTTP 状态和非零 code。认证入口不会跳转到 HTML 登录页。

| 接口 | 输入和结果 |
| --- | --- |
| `GET /api/auth/csrf` | 可匿名调用；data={token,headerName}；同时创建会话。这里的 token 是浏览器 CSRF 防护值，不是上游访问凭据 |
| `POST /api/auth/login` | `application/x-www-form-urlencoded`；username/password；同时用上一步的 headerName/token 请求头；成功 data=null |
| `GET /api/auth/me` | data={uid,username,displayName,roles,source:"TEACHING_MOCK"} |
| `POST /api/auth/logout` | 需要当前 CSRF；成功 data=null；销毁会话 |
| `GET /api/campus/capabilities` | 固定合同中的角色和 Boolean 字段；canControl=false，canRunDemoScenarios=false（演练尚未实现） |
| `GET /api/campus/spaces` | data={items:[Space],observedAt}；仅 teaching_space_01 |
| `GET /api/campus/devices` | data={items:[Device,Device],observedAt}；仅 teaching_env_01、teaching_energy_01；不增添 Device.source |
| `GET /api/campus/locations` | 已认证校园角色返回 501/TEACHING_TODO_NOT_IMPLEMENTED |
| `POST /api/campus/locations/campuses` | 管理员且 CSRF 有效时返回 501；其他校园角色 403；不写入也不声称创建成功 |

前端代理保留 `/api` 原路径指向本机 8091；fetch 使用同源会话凭据。登录会更换 session ID 并使登录前 CSRF 失效，因此成功后必须重新 GET csrf；退出后下一次登录前也重新获取。缺少或错误 CSRF：匿名为 401，已登录为 403，message=CSRF_INVALID。错误用户名和密码统一为 401/BAD_CREDENTIALS。

会话 cookie 为 COURSESESSION、HttpOnly、SameSite=Strict，有效期 30 分钟。本地 HTTP 仅用于回环教学；此配置没有完成公网部署或多实例会话设计。

## 模拟数据与教学时钟

`CatalogReader` 启动时读取目录，要求顶层 source=TEACHING_MOCK、simulated=true，所有设备 simulated=true；校验重复 ID、关联、Boolean、时间戳及标签。全量目录中的其他设备也先校验，再选择第一条贯通的 1 个空间和 2 台设备。来源或标识不合格时启动失败，不降级返回一份看似正常的空数据。

`observedAt` 原样使用 catalog 的固定值，不换成运行电脑当前时间。设备 `online:null`、`communicationTime:null` 保持未知。固定夹具不会随墙钟自动变旧；本轮尚未实现 latest/history 质量计算及可控 Clock 接口。目录只在启动时读取，修改后需要重新启动本机实例。

`AccountDirectory` 是当前身份查验端口，过滤器在每次已登录校园请求授权之前重新查询启用状态和角色。测试通过替换目录返回值构造“禁用账户”和“仅撤销 ADMIN”；没有 HTTP 调试写接口。`LocalAccountDirectory` 本轮为启动时只读账号快照，课堂可操作的撤权管理工具仍待教师实现。

## 数据库与学生 TODO

`application-teacher-db.properties` 和 `db/migration/V1__local_campus.sql` 仅为教师模板；没有连接、创建或迁移任何教师数据库。不要同时启用 first-chain 和 teacher-db，否则 first-chain 的排除项会隐藏数据库配置问题。

teacher-db 要求外部提供 `COURSE_DB_URL`、`COURSE_DB_USERNAME`、`COURSE_DB_PASSWORD`，并由教师验证专属数据库及权限。`COURSE_DB_MIGRATE` 默认 false；教师明确执行迁移时才设 true。数据库凭据不放在学生前端或网页 AI。迁移脚本只包含本地 `course_campus(id,name)` 表，未替学生实现业务。后续迁移新增版本，不修改已经应用的 V1。

第 05 章可以从以下 TODO 开始；完整目标仍以课程合同和教师冻结说明为准：

1. DTO：创建输入仅接受 name，去除首尾空白后校验非空和最多 80 个字符；ID 由服务端生成。响应校园含 id/name。
2. Service：核对 ADMIN，在事务中创建本地校园；数据库唯一约束把同名冲突映射为 409。异常不能被吞掉后返回 code=0。
3. Mapper：使用 MyBatis 参数绑定 `#{name}`；禁止拼接 SQL。为读取和新增编写明确方法。
4. Controller：把当前 501 占位替换为实际 service 调用；成功后重新 GET locations 读回；请求成功并不代替持久化读回证据。
5. 测试：空名称 400、只读写入 403、合法创建读回、重复 409及重启后数据保留。在教师独立 MySQL 验证前，不将内存测试当作数据库通过。

之后的事件操作需按角色矩阵单独配置路径和对象范围；当前“所有校园写路径先要求 ADMIN”是第一条贯通的保守边界，不是第 09—12 章最终授权设计。canHandleAlarms/canAssignAlarms/canAudit 表达当前身份资格，不证明相应业务接口已实现。

## 已验证与限制

`mvnw test` 包含认证/CSRF/会话/角色/真实 catalog 选取测试；测试密码每次随机生成且禁止 MockMvc 自动输出登录请求。独立输入覆盖来源不符、字符串 Boolean、非法时间和重复 ID 的拒绝。没有数据源 Bean 的断言证明 first-chain 不依赖数据库。

数据库迁移、真实 AIRIOT、事件并发、事务回滚、浏览器交互和 Windows 实机，必须各自保留独立验收证据。本目录的构建通过不证明这些事项完成。
