# 智慧校园课程：教师后端参考实现

独立教学工程，包名 `edu.campus.course`。`first-chain` 保留无数据库的第一条贯通；`teacher-db` 已实现第 05—12 章的本地教学业务：校园与楼栋、空间绑定、监测与历史、动态身份、演练事件、责任记录、版本冲突和事务时间线。它不连接原平台，不执行设备控制或外部通知。

## 版本与运行模式

| 项目 | 固定值与行为 |
| --- | --- |
| Java | 编译目标 17；本轮实际 Oracle JDK 17.0.6 |
| Spring Boot | 3.4.2；Security、Flyway、MySQL Connector 等由 BOM 固定 |
| MyBatis Starter | 3.0.4 |
| Maven | wrapper 3.1.0 下载 Maven 3.8.6；属性仅用 Maven Central HTTPS 地址 |
| 运行地址 | 默认 127.0.0.1:8091；单实例 HttpSession，无需 Redis |
| first-chain | 默认 profile；1 个空间、2 台设备；排除数据库自动配置；校园写操作明确返回 501 |
| teacher-db | 教师提供独立 MySQL；4 个空间、16 台设备、28 个点；完整本地业务持久化 |

两种 profile 只启用一种。源码按 4 空格 AOSP 风格展开，格式工具没有加入运行依赖。

优先在资源包根目录使用 `node tools/course.mjs init`、`build`、`backend`。根工具生成本机随机账号配置并注入环境。完整模式由教师准备数据库配置后，先明确运行 `node tools/course.mjs migrate`，再运行 `node tools/course.mjs backend-db`。迁移使用非 Web 模式，完成后退出；正常启动默认不自动迁移。

## 外部配置

| 变量 | 含义 |
| --- | --- |
| COURSE_ADMIN_PASSWORD | admin；初始角色 ADMIN,CAMPUS_VIEWER |
| COURSE_MANAGER_A_PASSWORD、COURSE_MANAGER_B_PASSWORD | manager-a / manager-b；初始 CAMPUS_MANAGER |
| COURSE_VIEWER_PASSWORD | viewer；初始 CAMPUS_VIEWER |
| COURSE_CATALOG_PATH | 默认 ../fixtures/catalog.json，推荐绝对路径 |
| SPRING_PROFILES_ACTIVE | first-chain 或 teacher-db |
| COURSE_SOURCE | 默认 TEACHING_MOCK；可显式选 AIRIOT，见下方限制 |
| COURSE_DB_URL、COURSE_DB_USERNAME、COURSE_DB_PASSWORD | teacher-db 的 JDBC 地址与专属数据库身份 |
| COURSE_DB_MIGRATE | 默认 false；只在明确迁移时设 true |
| COURSE_DEMO_ENABLED | teacher-db 默认 true；false 时不允许新增或恢复演练 |

四个教学密码无默认值；缺少、空白或超出 BCrypt 72 字节边界均启动失败，不回显密码。数据库只保存启用状态和角色，密码来自外部配置。凭据留在资源包 `.private`，不要放进前端、网页 AI、截图或提交文件。

教师可以提供远程独立库，例如 campus_course_class01_g01；本轮仅实际连接过本机隔离库。角色工具额外要求 `database.json` 的 `allowAccountAdministration:true`。事务测试额外要求 `test-database.json` 的 `allowTestReset:true`，测试库必须以 campus_course_ 开头、_test 结尾，例如 campus_course_class01_g01_test。两类配置的其余键为 url/username/password。私密 JSON 保存为 UTF-8；统一读取器兼容 Windows PowerShell 5.1 常见的 UTF-8 BOM，拒绝 UTF-16 或损坏 JSON 时只显示固定错误，不摘录配置内容。测试会清理该测试库的教学业务表，不能指向日常演示库。

## 接口与认证

机器可读 HTTP 合同见 [docs/full-api.json](docs/full-api.json)。成功为 `{code:0,message:"ok",data:...}`；拒绝使用对应 HTTP 状态和非零 code。401/403/409/500 不包装成成功，不返回数据库异常或密码。

| 接口组 | 已实现内容 |
| --- | --- |
| /api/auth | 匿名 GET csrf；表单 POST login；GET me；POST logout |
| /api/campus/capabilities | 三角色的 Boolean 能力；canControl=false |
| spaces、devices、overview、latest、history | 模拟目录、质量判断、历史窗口与断点 |
| locations | GET 总表；POST campuses/buildings；PUT spaces/{id} 绑定 |
| alarm-cases | 先筛选再分页；详情/时间线/handlers；assign/start/notes/verify-recovery/close |
| demo/status、demo-alarm-scenarios/{scenario}/trigger、demo-alarm-events/{id}/recover | 三类明确标识的本地演练 |
| device-owners、device-owners/{id} | 责任列表、详情、变更和时间线 |
| alarms、integrations/airiot/status | 模拟来源上游报警为空；管理员读取 AIRIOT 未配置状态 |

先 GET csrf 并保留 cookie；POST login 使用 application/x-www-form-urlencoded 的 username/password，同时携带返回的 headerName/token 请求头。登录更换 session ID 并清除旧 CSRF；登录与退出后均重新 GET csrf。会话 cookie 为 COURSESESSION、HttpOnly、SameSite=Strict、30 分钟。前端通过同源 /api 代理发送请求。

每次校园请求授权前重查当前账号状态和角色。管理人员只能处理本人已分派事件；ADMIN 可分派、演练和变更责任；VIEWER 只读。前端按钮仍可见也不能越过后端权限。请求伪造 actor、时间、来源状态等字段会被拒绝。

## 采样、历史与 AIRIOT 边界

CatalogReader 校验 source=TEACHING_MOCK、顶层及所有设备 simulated=true、ID 唯一性、关联、Boolean 和标签；observedAt 与非空 communicationTime 共用 QualityPolicy.time，只接受 0—8640000000000000（含端点）的 epoch 毫秒整数；失败即拒绝启动。MockCampusProvider 使用目录固定 observedAt 判断质量，绝不用电脑当前时间把固定夹具自动变成 stale。业务事件时间另外使用服务端 Clock.systemUTC()。

质量先检查非空的非法类型与时间，再区分 missing；超过观察时间 5000 ms 为 invalid，超过 60000 ms 为 stale，其余为 fresh。历史先校验，再闭区间过滤、去重、升序并截断至 1000 条。重复、非法、截断都有 issue；有时间但缺测的 value:null 保留为断点，真实零保留为 0，不制造不存在的记录。功率示例使用 history-cases.json；其成功响应 code 必须为整数 0，unit 必须与目录点的单位一致（power 为 kW）。缺失、非字符串或不匹配单位会以固定解释性错误拒绝启动，绝不把 V/kWh 数值重新贴成 kW。其他点只返回夹具实际存在的样本。

CampusProvider 保留只读接入端口。COURSE_SOURCE=AIRIOT 仅可用于 teacher-db；目录与监测调用明确返回 503/AIRIOT_NOT_CONFIGURED，绝不降级为 mock。管理员状态仍报告 configured=false、connected=false、各能力 PENDING；first-chain 选择 AIRIOT 直接拒绝启动。本轮没有真实 AIRIOT 网络连接、凭据、设备控制或真实恢复证明。

## 状态机、版本与事务

业务输入只接受合同字段；expectedVersion 必须是非负 JSON 整数，字符串、Boolean、小数均拒绝。关闭事件要求 IN_PROGRESS、至少一条 NOTE、DEMO/LOCAL_DEMO 的服务端恢复事实、有效恢复时间、核实 PASS、核实时间不早于恢复以及非空处置说明。改派回到 ASSIGNED 并清除核实结果，新负责人需重新开始。已关闭事件不可继续变更。

事件和责任变更在同一 MySQL 事务中执行 SELECT ... FOR UPDATE、版本比较、主行修改和时间线插入。409 后应回读，禁止自动重放旧决定。详情、分页计数及空间关联读取显式使用只读 REPEATABLE_READ 事务，保持多次 SELECT 处于同一快照，不依赖教师数据库或连接池的默认隔离级别。写事务内部的回读继续使用原事务，读取本次已写入的版本与时间线。责任变化只影响之后新事件的自动分派，不改旧事件。

V1 保留校园表；新增 V2 建立楼栋、绑定、身份、责任、事件及时间线，使用 InnoDB 和参数绑定。不要修改已应用迁移；后续变化继续新增版本。

## 学生修改块与教师操作

教师参考已完成；分章学生起点另行生成，每章只移除对应标记内的一小段，保留鉴权、SQL 参数绑定、事务和测试底座。

| 标记 | 文件及函数 | 定向验证 |
| --- | --- | --- |
| C05 | LocationService.validateBinding(spaceId,buildingId) | TeacherDbTest#spaceBindingRejectsMissingReferences |
| C07 | QualityPolicy.classify(value,time,observedAt) | QualityPolicyTest#qualityBoundariesAndMalformedTypes |
| C09 | OperationsService.requireClosable(c,timeline) | CloseRulesTest#eachMissingCloseConditionIsIndependentlyRejected；TeacherDbTest#closeRequiresAllServerFacts |
| C10 | OperationsService.checkOwnerVersion(expected,actual) | TeacherDbTest#ownerRequiresCurrentVersionAndChangesOnlyFutureAssignment |

标记为 STUDENT_TODO_Cxx_BEGIN/END。挖空起点应抛 UnsupportedOperationException("STUDENT_TODO_Cxx")，不能返回伪成功。C08 撤权由教师运行以下 Node 工具，无需学生安装 Python，没有公开 HTTP 调试写接口。在 backend 目录运行，读取资源包 .private/database.json：

```text
node tools/account-admin.mjs admin --roles CAMPUS_VIEWER
node tools/account-admin.mjs admin --roles ADMIN,CAMPUS_VIEWER
node tools/account-admin.mjs admin --enabled false
node tools/account-admin.mjs admin --enabled true
```

仅允许四个教学身份和三种既定角色。实验结束恢复原集合与 enabled=true；禁用使现有会话失效，恢复后需重新登录。普通启动 INSERT IGNORE 不会重置教师刚修改的角色。

## 构建、测试与证据

在 backend 执行，JAVA_HOME 指向 JDK 17。首次 Maven 下载需网络。

```text
macOS:   sh ./mvnw test
Windows: .\mvnw.cmd test

教师完整 MySQL 测试并打包（两平台同一命令）：
node tools/test-mysql.mjs package

教师定向测试：
node tools/test-mysql.mjs -Dtest=TeacherDbTest#spaceBindingRejectsMissingReferences test
```

第10轮最初普通 test 共发现50项：34项无数据库测试通过，16项MySQL测试显式跳过，不能据此声称数据库通过；该阶段实际统计见课程总包中的教师报告 `resources/student-project/backend/evidence/round10/test-summary.json`（本工程不附作者证据，请向教师索取）。教师完整命令要求独立测试配置和清理授权。最初后端单元复核未执行数据库测试；随后新主线作者在本机隔离 MySQL 完成50项测试，结果见教学包 `journey/qa/round10/mysql-verification.json`。作者本机结果不能替代学校数据库验收。round5的39项、原29项报告均保留为历史证据，不能替代新增代码的数据库验收。私密JSON工具另从资源包根执行 `node --test tools/private-json.test.mjs`；它的结果以该次独立报告为准。

并发测试用两个线程、两个登录会话、不同 MySQL 连接 ID 和锁前屏障构造重叠请求，验证恰好一个 200、一个 409，版本和时间线只增加一次。事件与责任回滚分别在主行 UPDATE 返回 affectedRows=1 后、时间线 INSERT 前注入测试异常；接口返回 500，使用 DriverManager 新物理连接回读主行和时间线均不变，再以同对象同版本正常提交，验证各增加一次。注入拦截器仅存在 src/test，不进运行 JAR，也无 HTTP 开关。

round5 增加 5 个真实 MySQL 快照测试：连接池默认 READ COMMITTED，由独立物理连接在两次 SELECT 间提交写入，检查事件、责任、列表计数和两类空间聚合保持一致；连接返回池后仍恢复原隔离级别。新增报告见 evidence/round5/test-summary.json（课程总包中的教师资料：`resources/campus-ai-course/backend/evidence/round5/test-summary.json`；未随本练习副本分发，请由教师提供或从课程总包查阅）、快照证据（课程总包中的教师资料：`resources/campus-ai-course/backend/evidence/round5/mysql-snapshot-evidence.json`；未随本练习副本分发，请由教师提供或从课程总包查阅） 和 修复与验证记录（课程总包中的教师资料：`resources/campus-ai-course/backend/evidence/round5/verification.json`；未随本练习副本分发，请由教师提供或从课程总包查阅）。

原可分发报告见 evidence/test-summary.json（课程总包中的教师资料：`resources/campus-ai-course/backend/evidence/test-summary.json`；未随本练习副本分发，请由教师提供或从课程总包查阅） 和 evidence/mysql-transaction-evidence.json（课程总包中的教师资料：`resources/campus-ai-course/backend/evidence/mysql-transaction-evidence.json`；未随本练习副本分发，请由教师提供或从课程总包查阅）。前者只提取测试套件统计，不复制 Surefire 系统属性。固定 Flyway 版本对 MySQL 8.4 给出超出官方已测试 8.1 的兼容警告；本机实际 V1/V2 和事务测试通过，教师仍须验证所用版本。

Windows 命令和 wrapper 已提供，但未在 Windows 实机执行。远程教师数据库、真实 AIRIOT 和公网部署未执行；浏览器验收由资源包总报告另行记录。本轮未对 Spring/JDK 执行完整 SCA，构建通过不等于漏洞扫描通过。

## 第10轮只读业务补齐

完整模式的原始报警读取现在有5条人工样例、真实分页total和原始status/level；不是AIRIOT实际导出，不能导入或当作本地DEMO事件处置。`GET /api/campus/command-audit`仅管理员可读，返回3条带 `HISTORICAL_TEACHING_SAMPLE` 标识的虚构历史样例；没有写接口、没有发出命令，`canControl`继续为false。接入AIRIOT仍明确503/PENDING，没有模拟回退。

环境/能源的4空间×4类采样点共有16条可比较历史。原energy01/power四点文件不变，另外15条序列各6点；设施/照明仍采用目录单点回退。历史保留null和0，不以功率推电量。`observedAt`为固定教学采样基准，`queriedAt`为本次服务端查询墙钟；刷新不伪造新采样。

报警、审计、历史的可选 `scenario=normal|empty|failure` 只影响本次模拟读取：normal默认；empty成功空；failure为503/MOCK_READ_FAILURE；无效值400。它不是全局故障开关，也不写库。AIRIOT不接受模拟empty/failure场景。完整字段见[接口增量](docs/round10-read-api.json)，IDE调试可用[分页总数案例](docs/debug-read-pagination.md)。

新增7项MVC测试和4项夹具损坏测试直接读当前fixtures，验证权限、分页、时间、逐设备失败及错误拒绝，均无需数据库或监听端口；原测试继续保留。没有因此补成通用用户/组织/角色/访问规则管理，也不表示全部原平台功能完成。
