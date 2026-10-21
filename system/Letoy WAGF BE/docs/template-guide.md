# Backend Template 使用与扩展指南

## 1. 模板定位

本项目是一个面向后续业务项目的 Spring Boot 后端开发模板，目标不是承载某一个具体业务，而是提供一套可以直接复用和继续扩展的基础能力：

- 统一认证与鉴权体系
- 用户、用户组、角色、API 权限规则基础模型
- 可配置的动态接口权限控制
- Redis、MyBatis、Flyway、Swagger/OpenAPI 基础设施
- 阿里云验证码 / 短信能力
- Spring AI 接入能力
- 清晰的 request / response / assembler 分层结构

建议把它当成“母版项目”使用：新项目从本模板复制后，优先替换配置、种子数据、文档名称，再逐步增加具体业务模块。

补充阅读：

- 后台 Web / H5 端开发指南：`docs/admin-web-h5-development-guide.md`
- 后端管理端开发文档：`docs/admin-backend-development-guide.md`

## 2. 技术栈

- Java 17
- Spring Boot 3.4.2
- Spring Security
- MyBatis + XML Mapper
- MySQL
- Redis
- Flyway
- springdoc-openapi
- Spring AI
- Aliyun SMS / Captcha SDK

## 3. 当前工程结构

主包路径：`src/main/java/com/letoy/main`

### 3.1 模块划分

- `common`
  - 公共配置、公共异常、统一响应、通用工具、分页响应等
- `auth`
  - 登录、刷新 Token、JWT、安全过滤器、手机号验证码登录
- `user`
  - 用户实体、请求 DTO、响应 DTO、controller、service、assembler
- `group`
  - 用户组 / 组织树相关能力
- `role`
  - 角色管理与用户角色分配
- `permission`
  - API 规则、动态权限匹配、权限规则管理
- `aliyun`
  - 阿里云验证码、模板短信、国际短信能力
- `ai`
  - Spring AI 对话能力

### 3.2 工程分层约定

每个业务模块尽量遵守以下分层：

- `controller`
  - 只负责接收请求、参数校验、调用 service、返回 response DTO
- `dto/request`
  - 接口入参对象，只负责数据承载与字段校验
- `dto/response`
  - 接口出参对象，不直接暴露数据库实体
- `entity`
  - 持久化实体 / 领域对象
- `mapper`
  - MyBatis Mapper 接口
- `service`
  - 业务接口
- `service/impl`
  - 业务实现
- `assembler`
  - request / entity / response 转换器

## 4. 启动前准备

### 4.1 数据库与缓存

启动前请准备：

1. MySQL 数据库
2. Redis
3. 按环境修改配置文件或环境变量

默认配置文件：

- `src/main/resources/application.properties`
- `src/main/resources/application-dev.properties`
- `src/main/resources/application-publish.properties`
- `.env.example`

### 4.2 常用环境变量

#### 基础运行

- `DB_URL`
- `DB_USERNAME`
- `DB_PASSWORD`
- `REDIS_HOST`
- `REDIS_PORT`
- `REDIS_PASSWORD`
- `JWT_SECRET`

#### 阿里云能力

- `ALIBABA_CLOUD_ACCESS_KEY_ID`
- `ALIBABA_CLOUD_ACCESS_KEY_SECRET`
- `ALIBABA_CLOUD_SMS_SIGN_NAME`
- `ALIBABA_CLOUD_CAPTCHA_SCENE_ID`
- `ALIBABA_CLOUD_LOGIN_TEMPLATE_CODE`
- `ALIBABA_CLOUD_BIND_PHONE_TEMPLATE_CODE`
- `ALIBABA_CLOUD_RESET_PHONE_TEMPLATE_CODE`

#### Spring AI / DashScope

- `SPRING_AI_CHAT_MODEL`
- `DASHSCOPE_API_KEY`
- `DASHSCOPE_MODEL`
- `DASHSCOPE_BASE_URL`
- `DASHSCOPE_TEMPERATURE`
- `DASHSCOPE_MAX_TOKENS`

## 5. 启动方式

### 5.1 本地开发

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

### 5.2 编译打包

```bash
./mvnw clean package
```

### 5.3 运行测试

```bash
./mvnw test
```

### 5.4 接口文档

启动后访问：

- `http://localhost:8001/api/swagger-ui/index.html`

## 6. 数据库初始化说明

Flyway 脚本目录：`src/main/resources/db/migration`

### 6.1 表结构脚本

- `V1__init_template_schema.sql`

负责创建基础表：

- `user_info`
- `token_info`
- `refresh_token`
- `groups_info`
- `sys_role`
- `sys_user_role`
- `api_rule`

### 6.2 初始种子脚本

- `V2__seed_template_data.sql`
  - 初始化根用户组
  - 初始化基础角色
  - 初始化第一批 API 规则
- `V3__expand_template_permission_seed.sql`
  - 补充基础用户组
  - 细化管理端 API 规则
  - 补充公开接口、权限规则管理、群组管理、角色管理、AI、阿里云等基础规则

## 7. 权限模型说明

本模板的权限控制核心依赖三层：

1. **白名单**
   - 配置在 `WhitelistProperties`
   - 白名单接口不经过动态权限规则校验
   - 典型场景：登录、刷新 token、验证码校验、Swagger 文档

2. **认证信息**
   - 登录成功后签发 access token 和 refresh token
   - access token 携带用户身份
   - 动态权限检查时从缓存或数据库读取当前用户组信息

3. **API 规则表 `api_rule`**
   - 每条接口规则记录接口路径、方法、组策略、允许访问的组等信息
   - 动态权限模块根据路径 + method 匹配规则，再根据 group policy 判断是否可访问

### 7.1 group policy 说明

- `ANY`
  - 任意已认证用户可访问
- `ALLOWLIST`
  - 当前用户的 `groupIds` 与规则的 `allowedGroupIds` 有交集即可访问
- `DIRECT_PATH`
  - 用于路径里直接带 groupId 的场景
- `BY_USER_GROUP`
  - 用于根据目标用户归属组判断是否允许访问

## 8. 默认基础用户组

模板默认种子包含以下基础组，便于后续项目直接扩展：

- `ROOT`
  - 系统根管理组
- `PLATFORM`
  - 平台管理 / 后台研发 / 系统配置组
- `OPERATIONS`
  - 运营组
- `BUSINESS`
  - 业务组
- `AUDIT`
  - 审计 / 只读组

建议：

- 超级管理员保留 `ROOT`
- 后台管理人员可使用 `PLATFORM`
- 业务支持人员按需要分配 `OPERATIONS` / `BUSINESS`
- 审计或报表查看类人员可使用 `AUDIT`

## 9. 默认基础角色

模板默认角色：

- `SUPER_ADMIN`
- `ADMIN`
- `USER`

说明：

- 本模板中“角色”与“用户组”并存
- 角色更偏业务身份 / 功能身份
- 用户组更偏数据域 / 管理域 / API 访问范围
- 动态 API 权限当前主要基于用户组控制

## 10. 默认 API 规则范围

模板已经为以下模块准备了基础 API 规则：

- 认证模块 `auth`
- 用户模块 `users`
- 用户组模块 `groups`
- 角色模块 `roles`
- API 规则管理模块 `security/api-rules`
- 阿里云能力 `aliyun`
- AI 能力 `ai`

这意味着新项目复制后：

- 不需要从 0 手工录入基础接口权限
- 可以直接在已有规则基础上追加业务模块规则
- 可以保留模板规则，也可以删减不需要的能力

## 11. 新项目接入时建议先改的内容

建议复制模板后，第一时间处理以下内容：

1. 修改项目名、artifactId、应用名称
2. 修改数据库名、Redis key 前缀、JWT 密钥
3. 替换 readme 与 docs 中的项目说明
4. 检查 Flyway 种子数据是否符合当前项目组织结构
5. 删除暂时不用的模块（如 AI、阿里云）
6. 增加项目自己的业务模块包，例如：`course`、`order`、`notice`
7. 为新模块增加对应的 `entity / dto / controller / service / mapper / assembler`
8. 为新模块补充 `api_rule` 种子数据

## 12. 新增业务模块的推荐步骤

以新增 `notice` 模块为例：

1. 新建包结构
   - `notice/controller`
   - `notice/dto/request`
   - `notice/dto/response`
   - `notice/entity`
   - `notice/service`
   - `notice/service/impl`
   - `notice/mapper`
   - `notice/assembler`

2. 新建数据库表与 Flyway 脚本

3. 编写 Mapper 接口与 XML

4. 编写 Service 与业务实现

5. 编写 Request / Response DTO

6. 编写 Assembler

7. 编写 Controller

8. 在 Flyway 新版本脚本中追加该模块的 API 规则种子数据

## 13. 开发约定

### 13.1 接口层约定

- controller 不直接处理复杂业务
- controller 不直接暴露数据库 entity
- 所有入参尽量使用 `dto/request`
- 所有返回尽量使用 `dto/response`
- 参数校验放在 controller 边界，使用 `@Valid`

### 13.2 数据转换约定

- request -> entity：放到 `assembler`
- entity -> response：放到 `assembler`
- 不建议在 DTO 内部编写复杂转换逻辑

### 13.3 权限扩展约定

新增受保护接口时，必须同时考虑：

- 是否需要加入白名单
- 是否需要新增 `api_rule` 种子数据
- 对应接口应该归属于哪个基础用户组

## 14. 模板裁剪建议

如果新项目暂时不需要某些模块，可以直接裁剪：

- 不需要 AI：删除 `ai` 模块和相关配置
- 不需要阿里云能力：删除 `aliyun` 模块和相关配置
- 不需要手机号验证码登录：删除对应 auth 手机号能力和短信模板配置

如果保留模块但暂不启用，也建议：

- 保留表结构与代码
- 关闭配置
- 在项目文档中标记“可选模块”

## 15. 推荐的交付习惯

为了让后续项目基于本模板开发更稳定，建议每次模板升级时：

- 同时更新 `readme.md`
- 同时更新 `docs/template-guide.md`
- 同时新增或修正 Flyway 脚本
- 至少执行一次 `./mvnw test`
- 对新增模块补一条最小测试样例

## 16. 当前建议

如果后续继续打磨模板，推荐优先做：

1. 给 response DTO 补齐 Swagger 字段说明
2. 给 controller / assembler 增加模板化测试样例
3. 给每个模块补一个最小业务示例，便于新项目照着复制
4. 把 API 规则管理接口也统一包装成 `ApiResponse`
