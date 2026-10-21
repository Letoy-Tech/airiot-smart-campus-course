# Backend Template

这是一个面向后续业务项目复用的 Spring Boot 后端模板。

它的目标不是直接承载某一个具体业务，而是提供一套可持续扩展的基础工程能力：认证、用户、用户组、角色、动态接口权限、Flyway、Redis、阿里云能力、Spring AI，以及较规范的 request / response / assembler 分层。

## 文档入口

为了方便后续项目基于这个模板继续扩展，建议先看完整说明文档：

- 详细扩展手册：`docs/template-guide.md`
- 后台 Web / H5 端开发指南：`docs/admin-web-h5-development-guide.md`
- 后端管理端开发文档：`docs/admin-backend-development-guide.md`

## 模板包含的核心能力

- 认证模块
  - 用户名密码登录
  - 手机验证码登录
  - refresh token 刷新
  - JWT 鉴权
- 用户模块
  - 用户 CRUD
  - 当前用户资料维护
  - 密码修改
  - 手机号绑定 / 重置
- 用户组模块
  - 组织树
  - 子组与整棵子树查询
- 角色模块
  - 角色管理
  - 用户角色分配
- 权限模块
  - API 规则表 `api_rule`
  - 基于用户组的动态接口权限判断
- 基础集成
  - Redis
  - MyBatis
  - Flyway
  - Swagger / OpenAPI
  - 阿里云验证码 / 短信
  - Spring AI

## 当前工程结构

主包：`src/main/java/com/letoy/main`

- `common`
  - 公共配置、统一响应、公共异常、分页响应、工具类
- `auth`
  - 登录、JWT、安全过滤器、refresh token、手机号验证码能力
- `user`
  - 用户 request / response / entity / controller / service / assembler
- `group`
  - 用户组与组织树能力
- `role`
  - 角色管理能力
- `permission`
  - API 规则与动态权限匹配能力
- `behavior`
  - 用户行为日志采集、Kafka 投递、消费落库
- `aliyun`
  - 阿里云相关能力
- `ai`
  - Spring AI 能力

## 工程约定

本模板已经按后续项目复用需求做了几项基础规范：

- controller 内不再定义内部静态请求类
- request DTO 与 response DTO 独立分包
- controller 边界统一使用 `@Valid` 做参数校验
- request -> entity 与 entity -> response 转换下沉到 `assembler`
- 主要管理接口不再直接暴露持久化 entity

## 快速启动

1. 准备 MySQL 与 Redis
2. 修改配置文件或复制 `.env.example`
3. 启动项目：

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

4. 打开接口文档：

- `http://localhost:8001/api/swagger-ui/index.html`

## 初始化数据说明

Flyway 脚本目录：`src/main/resources/db/migration`

- `V1__init_template_schema.sql`
  - 初始化基础表结构
- `V2__seed_template_data.sql`
  - 初始化根用户组、基础角色、第一批 API 规则
- `V3__expand_template_permission_seed.sql`
  - 补充基础用户组与更完整的模板 API 权限规则
- `V8__add_user_behavior_log_table.sql`
  - 新增用户行为日志表，记录正常请求与可疑访问

## 用户行为日志

- 所有请求都会在 `MyOncePerRequestFilter` 收尾时生成一条行为日志，包含 `uid`、用户名、请求路径、状态码、耗时、IP、User-Agent、风险级别等字段
- 认证失败、权限拒绝、限流、参数异常、系统异常会统一标记为可疑或错误行为，便于后续风控分析
- 默认先发送到 Kafka topic `user-behavior-log`，消费者再落库到 `user_behavior_log` 表
- 如果 Kafka 不可用，且 `behavior.log.direct-fallback-enabled=true`，系统会自动降级为直接写库，避免日志完全丢失

### 相关配置

- `KAFKA_BOOTSTRAP_SERVERS`
  - Kafka 集群地址，开发环境默认 `127.0.0.1:9092`
- `BEHAVIOR_LOG_TOPIC`
  - 行为日志 topic，默认 `user-behavior-log`
- `BEHAVIOR_LOG_ENABLED`
  - 是否启用行为日志，默认 `true`
- `BEHAVIOR_LOG_PRODUCER_ENABLED`
  - 是否启用 Kafka 生产，默认 `true`
- `BEHAVIOR_LOG_CONSUMER_ENABLED`
  - 是否启用 Kafka 消费落库，默认 `true`
- `BEHAVIOR_LOG_DIRECT_FALLBACK_ENABLED`
  - Kafka 失败时是否直接落库，默认 `true`

## 模板默认基础用户组

模板初始化后默认会包含：

- `ROOT`
- `PLATFORM`
- `OPERATIONS`
- `BUSINESS`
- `AUDIT`

这些组的目的是让新项目从一开始就有一套可继续细化的管理分组，而不是每次从零设计。

## 模板默认基础角色

- `SUPER_ADMIN`
- `ADMIN`
- `USER`

## 模板默认基础 API 规则范围

模板已经为以下模块准备好基础 API 规则：

- `auth`
- `users`
- `groups`
- `roles`
- `security/api-rules`
- `aliyun`
- `ai`

后续新项目在增加业务模块时，只需要继续新增对应的 Flyway 脚本和 API 规则种子数据即可。

## 建议的新项目接入步骤

1. 替换项目名称、说明、数据库配置、JWT 密钥
2. 检查并调整默认用户组、角色、API 规则种子数据
3. 删除暂时不需要的模块（如 AI、阿里云）
4. 新增你的业务模块包结构
5. 为新模块新增表结构与 API 规则 Flyway 脚本
6. 更新 `readme.md` 和 `docs/template-guide.md`

## 常用命令

编译：

```bash
./mvnw clean package
```

测试：

```bash
./mvnw test
```

## 说明

如果你准备把这个模板作为后续所有项目的基础仓库，建议把 `docs/template-guide.md` 一并维护好。后续每增加一个基础模块，都同步补：

- 模块结构说明
- 配置项说明
- Flyway 脚本说明
- 默认权限规则说明
- 最小测试样例
