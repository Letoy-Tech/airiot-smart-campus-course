# 管理端后台开发文档

## 1. 文档目标

这份文档面向本项目的后端开发者，目标是把“这个管理端后台怎么启动、怎么扩展、怎么维护、怎么排错”一次讲清楚。

适用场景：

- 新成员接手项目，需要快速理解整体架构
- 基于当前仓库继续开发新的管理后台模块
- 对接前端管理端、测试、运维时，需要统一接口与运行方式
- 后续把该项目继续演进为公司内部可复用的后台模板

如果你只想快速跑起来项目，先看第 4 章和第 5 章。
如果你要新增功能模块，重点看第 7 章到第 10 章。

---

## 2. 项目定位

本项目是一个面向“管理端后台”场景的 Spring Boot 后端基础工程，已经内置了后台系统常见的核心能力：

- 账号认证与鉴权
- 用户、角色、用户组管理
- 动态接口权限控制
- JWT + Refresh Token
- Redis 缓存
- Flyway 数据库迁移
- MyBatis + XML Mapper
- OpenAPI 文档
- 阿里云短信/验证码
- Spring AI 对话接入

它不是一个单一业务系统，而是一个“后台母版工程”。新业务可以在它的基础上继续扩展，而不用每次从 0 开始搭鉴权、权限、用户体系和数据库迁移。

---

## 3. 技术栈与核心依赖

当前项目的主要技术栈如下：

- Java 17
- Spring Boot 3.4.2
- Spring Security
- Undertow
- MyBatis + XML Mapper
- MySQL
- Redis
- Flyway
- springdoc-openapi
- Spring AI
- Aliyun SMS / Captcha SDK

当前 `pom.xml` 的设计原则：

- 以 Spring Boot BOM 管理大多数基础依赖版本
- 第三方组件只保留必要的显式版本
- 文档组件只保留 `springdoc-openapi-starter-webmvc-ui`
- 默认保留 `actuator`，便于健康检查与后续监控接入

注意：

- `springdoc` 当前固定在 `2.8.14`，这是为了规避 `2.8.15+` 在当前 Spring MVC 路径匹配规则下的已知回归问题
- 如需升级 `springdoc`，必须先验证 Swagger UI 是否还能正常启动

---

## 4. 快速启动

### 4.1 启动前准备

本项目启动至少依赖：

- MySQL
- Redis

如果你不使用短信、验证码、AI，可以先不配置对应密钥，保留为空即可。

### 4.2 配置文件说明

主要配置文件位于：

- `src/main/resources/application.properties`
- `src/main/resources/application-dev.properties`
- `src/main/resources/application-publish.properties`
- `.env.example`

默认约定：

- `application.properties`：基础共享配置
- `application-dev.properties`：开发环境配置
- `application-publish.properties`：发布环境配置

### 4.3 常用启动命令

本地开发：

```bash
./mvnw spring-boot:run -Dspring-boot.run.profiles=dev
```

默认配置直接启动：

```bash
./mvnw spring-boot:run
```

编译打包：

```bash
./mvnw clean package
```

运行测试：

```bash
./mvnw test
```

运行打包后的 Jar：

```bash
java -jar target/letoy-wagf-be-0.0.1.jar --spring.profiles.active=publish
```

### 4.4 接口文档

项目启动后可访问：

- `http://localhost:8001/swagger-ui/index.html`

如果你配置了 context-path，则在前面补上对应前缀。

---

## 5. 数据库初始化与首个管理员

### 5.1 Flyway 迁移脚本

Flyway 脚本目录：

- `src/main/resources/db/migration`

当前包含：

- `V1__init_template_schema.sql`
- `V2__seed_template_data.sql`
- `V3__expand_template_permission_seed.sql`

这些脚本负责：

- 创建基础表
- 初始化默认用户组
- 初始化默认角色
- 初始化后台核心 API 权限规则

### 5.2 默认基础表

当前模板会创建以下核心表：

- `user_info`
- `token_info`
- `refresh_token`
- `groups_info`
- `sys_role`
- `sys_user_role`
- `api_rule`
- `flyway_schema_history`

### 5.3 Flyway 配置

当前基础配置中：

- `spring.flyway.enabled=${FLYWAY_ENABLED:true}`
- `spring.flyway.locations=classpath:db/migration`
- `spring.flyway.baseline-on-migrate=true`
- `spring.flyway.baseline-version=0`

这意味着：

- 默认会自动执行迁移
- 空库首次启动时会自动建表和初始化种子数据
- 已存在库会通过 `flyway_schema_history` 控制版本

### 5.4 首个超级管理员

系统提供了一个公开的引导接口：

- `POST /auth/bootstrap`

用途：

- 当系统中还没有任何用户时，创建第一个管理员账号

约束：

- 只能在 `user_info` 为空时执行
- 一旦系统已有用户，再调用会失败

请求体示例：

```json
{
  "username": "admin",
  "password": "StrongPassword123!",
  "nickname": "System Administrator",
  "email": "admin@example.com"
}
```

引导成功后，系统会自动给首个管理员补齐：

- `groupIds=ROOT`
- `roles=SUPER_ADMIN,ADMIN,USER`

也就是说，这个账号默认就是最高级别管理员。

---

## 6. 系统架构总览

### 6.1 包结构

主包路径：

- `src/main/java/com/letoy/main`

模块划分如下：

- `common`
  - 公共配置、统一响应、异常处理、工具类、分页能力
- `auth`
  - 登录、JWT、Refresh Token、安全过滤器、认证用户模型
- `user`
  - 用户管理、当前用户资料、密码和手机号操作
- `group`
  - 用户组 / 组织树管理
- `role`
  - 角色管理与用户角色分配
- `permission`
  - API 规则、动态权限控制、规则管理
- `aliyun`
  - 阿里云验证码、短信发送
- `ai`
  - Spring AI 对话能力

### 6.2 每个模块的推荐分层

建议每个业务模块遵守下面的结构：

- `controller`
  - 只处理 HTTP 输入输出、参数校验、调用 service
- `dto/request`
  - 接口请求对象
- `dto/response`
  - 接口响应对象
- `entity`
  - 持久化实体
- `mapper`
  - MyBatis Mapper 接口
- `service`
  - 业务接口
- `service/impl`
  - 业务实现
- `assembler`
  - DTO 与 entity 之间的转换

### 6.3 为什么要这样分层

这样分层有几个好处：

- controller 不会堆积业务逻辑
- entity 不直接暴露给前端，接口更稳定
- assembler 统一做对象转换，避免转换逻辑散落在 controller/service
- service 更聚焦业务规则，便于测试和复用

---

## 7. 请求处理链路

下面是一个典型管理端请求的执行链路：

1. 前端请求进入 Controller
2. 参数由 `@Valid` 做校验
3. Spring Security 先执行认证过滤器
4. `MyOncePerRequestFilter` 解析 JWT 并构建 `SecurityContext`
5. `WebSecurityConfigurer` 进入授权流程
6. 白名单接口直接放行
7. 非白名单接口交给 `DynamicPermission` 动态鉴权
8. Service 执行业务逻辑
9. Mapper 调用 MyBatis 执行 SQL
10. 返回统一格式 `ApiResponse`

### 7.1 JWT 认证

核心入口：

- `src/main/java/com/letoy/main/auth/security/MyOncePerRequestFilter.java`

职责：

- 读取 `Authorization` 请求头
- 提取并解析 access token
- 校验 token 是否有效
- 校验 token 是否被撤销
- 从 `MyAuthUserService` 加载用户信息
- 写入 `SecurityContext`

如果认证失败：

- 直接返回 401

### 7.2 动态权限

核心类：

- `src/main/java/com/letoy/main/auth/security/DynamicPermission.java`
- `src/main/java/com/letoy/main/auth/security/ApiRuleMatcher.java`

工作机制：

- 先根据请求路径 + 方法匹配 `api_rule`
- 再根据规则里的 `group_policy` 做判定
- 用户组信息优先从缓存读取

支持的核心策略：

- `ANY`
- `ALLOWLIST`
- `DIRECT_PATH`
- `BY_USER_GROUP`

这套机制是管理端后台最重要的“访问控制核心”。

### 7.3 白名单

白名单定义在：

- `src/main/java/com/letoy/main/auth/security/WhitelistProperties.java`
- `src/main/resources/application.properties`

典型白名单包括：

- `/auth/bootstrap`
- `/auth/login`
- `/auth/refresh`
- `/auth/login/phone-code/send`
- `/auth/login/phone-code`
- `/v3/api-docs/**`
- `/swagger-ui/**`

白名单接口不会进入动态权限规则校验。

---

## 8. 模块能力说明

### 8.1 认证模块 `auth`

接口范围：

- `POST /auth/bootstrap`
- `POST /auth/login`
- `POST /auth/login/phone-code/send`
- `POST /auth/login/phone-code`
- `GET /auth/me`
- `POST /auth/refresh`
- `POST /auth/revoke`

它负责：

- 用户名密码登录
- 手机验证码登录
- 获取当前登录用户
- 刷新 access token
- 撤销 refresh token
- 首个管理员初始化

### 8.2 用户模块 `user`

接口范围：

- `/users`
- `/users/me`
- `/users/me/profile`
- `/users/me/password`
- `/users/me/phone/*`
- `/users/{uid}`

它负责：

- 用户分页查询
- 用户详情
- 新建用户
- 更新用户
- 修改状态
- 删除用户
- 当前用户资料维护
- 密码重置与手机号绑定/重置

### 8.3 用户组模块 `group`

接口范围：

- `/groups`

它负责：

- 创建根组
- 创建子组
- 更新组
- 查询单组
- 查询直接子组
- 查询完整子树
- 分页查询
- 删除组

它是整个后台“组织树”和“数据域”的基础。

### 8.4 角色模块 `role`

接口范围：

- `/roles`
- `/roles/user/{uid}`

它负责：

- 角色列表与详情
- 角色增删改
- 用户角色查看
- 用户角色分配

### 8.5 权限规则模块 `permission`

接口范围：

- `/security/api-rules`

它负责：

- API 规则增删改查
- 动态权限规则维护
- 后台权限调试与扩展

### 8.6 阿里云模块 `aliyun`

接口范围：

- `/aliyun/captcha/verify`
- `/aliyun/sms/template`
- `/aliyun/sms/global`

适用场景：

- 登录验证码
- 绑定手机号验证码
- 国际短信发送

### 8.7 AI 模块 `ai`

接口范围：

- `/ai/chat`

当前通过 `SpringAiConfig` 接入兼容 OpenAI 协议的模型服务，默认示例是 DashScope 兼容模式。

如果未来要切换供应商，建议在 service 层继续抽象，而不是把供应商细节直接扩散到 controller。

---

## 9. 统一接口规范

### 9.1 响应格式

统一响应封装类：

- `src/main/java/com/letoy/main/common/dto/ApiResponse.java`

返回示例：

```json
{
  "timestamp": "2026-03-21 23:00:00",
  "status": 200,
  "code": 0,
  "message": "操作成功",
  "data": {},
  "path": "/users/query",
  "traceId": "..."
}
```

设计原则：

- HTTP 状态码与业务码并存
- 成功和失败结构统一
- 支持 traceId，便于日志排查

### 9.2 异常处理

统一异常处理入口：

- `src/main/java/com/letoy/main/common/handler/GlobalExceptionHandler.java`

已覆盖：

- 参数校验异常
- 请求头缺失
- 认证异常
- 系统异常
- 数据库异常
- 兜底异常

开发要求：

- 业务错误优先抛出明确的异常，而不是直接返回字符串
- 不要在 controller 手工 `try/catch` 吞异常

---

## 10. 数据模型与权限模型

### 10.1 用户、角色、用户组的关系

项目里有三套概念，需要明确区分：

- 用户 `user_info`
- 角色 `sys_role`
- 用户组 `groups_info`

推荐理解方式：

- 角色：偏“功能身份”
- 用户组：偏“组织域 / 数据域 / 管理域”
- 用户：同时挂在角色和用户组上

### 10.2 当前权限控制的重点

虽然角色也存在，但当前动态 API 权限的主控制维度是“用户组”。

也就是说：

- 是否能访问某个接口，主要看 `groupIds`
- `roles` 更适合作为业务身份、菜单权限、页面展示控制等后续扩展依据

### 10.3 `api_rule` 的意义

`api_rule` 表是整个后台管理端接口权限的路由规则中心。

每条规则至少包含：

- 接口路径
- HTTP 方法
- group policy
- allowed group ids
- priority
- enabled

如果你新加一个后台模块，必须同步思考：

- 这个模块的接口是否要加到 `api_rule`
- 哪些组可以访问
- 是否要加入 Flyway 种子脚本

---

## 11. 新增一个业务模块的标准开发流程

假设你要新增一个“公告管理”模块，推荐流程如下。

### 11.1 第一步：设计数据库表和迁移脚本

新增 Flyway 脚本，例如：

- `src/main/resources/db/migration/V4__add_notice_tables.sql`

原则：

- 永远追加新脚本，不要改已经执行过的旧迁移
- 表结构变化通过新版本脚本表达
- 如果需要默认权限，也一起补种子数据

### 11.2 第二步：建立包结构

建议新增：

- `notice/controller`
- `notice/service`
- `notice/service/impl`
- `notice/mapper`
- `notice/entity`
- `notice/dto/request`
- `notice/dto/response`
- `notice/assembler`

### 11.3 第三步：写 entity 和 mapper

建议：

- entity 贴近数据库字段
- mapper 接口只定义持久化操作
- 复杂 SQL 放到 XML，而不是全塞注解

### 11.4 第四步：写 service

service 负责：

- 参数合法性二次校验
- 业务规则判断
- 事务边界
- 调用 mapper

不要把复杂业务逻辑写进 controller。

### 11.5 第五步：写 controller

controller 只做三件事：

1. 接参
2. 校验
3. 调 service 并返回 `ApiResponse`

### 11.6 第六步：补权限规则

如果是管理端接口，必须考虑权限：

- 在 Flyway 脚本里增加 `api_rule` 种子
- 或通过 `/security/api-rules` 管理端接口手动维护

推荐模板化做法：

- 所有后台模块接口默认都补一份基础权限种子

### 11.7 第七步：补文档和测试

至少同步更新：

- `readme.md`
- `docs/template-guide.md`
- 本文档

如果模块比较核心，建议增加：

- service 层单元测试
- controller / integration 测试

---

## 12. 开发约定与编码规范

### 12.1 Controller 层

约定：

- 类名以 `*Controller` 结尾
- 使用 `@RestController`
- 接口入参使用 `@RequestBody` + `@Valid`
- 出参统一用 `ApiResponse`

不建议：

- controller 内写大量业务逻辑
- controller 直接返回 entity

### 12.2 Service 层

约定：

- 接口放在 `service`
- 实现放在 `service/impl`
- 事务放在 service 层而不是 controller 层

### 12.3 DTO / Assembler

约定：

- request DTO 和 response DTO 分开
- 不直接暴露数据库实体给前端
- 转换逻辑集中到 assembler

### 12.4 Mapper / XML

建议：

- 简单查询可写接口方法
- SQL 显式放 XML
- XML 名称与 Mapper 接口一一对应

### 12.5 日志

建议：

- 记录关键业务动作，不刷无意义日志
- 错误日志必须带上下文
- 权限拒绝、登录失败、关键状态变更要有结构化日志

---

## 13. 配置管理建议

### 13.1 环境变量优先

开发环境可以用默认值，但正式环境建议全部走环境变量：

- `DB_URL`
- `DB_USERNAME`
- `DB_PASSWORD`
- `REDIS_HOST`
- `REDIS_PASSWORD`
- `JWT_SECRET`
- `ALIBABA_CLOUD_*`
- `DASHSCOPE_*`

### 13.2 不要提交真实密钥

注意：

- `application.properties` 现在仍有示例敏感配置
- 作为模板继续对外复用前，建议清理成占位值或环境变量

### 13.3 Profile 建议

推荐做法：

- 本地：`dev`
- 线上：`publish`

开发环境侧重：

- 可观察性
- 调试日志
- 宽松白名单和本地依赖

生产环境侧重：

- 严格白名单
- 外部化配置
- 更保守的日志级别

---

## 14. Redis、缓存与异步任务

### 14.1 Redis 的用途

当前 Redis 主要用于：

- 登录态相关缓存
- API 规则缓存
- Principal 缓存
- 可能的验证码与限流扩展

### 14.2 API 规则缓存

`ApiRuleMatcher` 会从 Redis 读取规则集合并编译成本地缓存。

优势：

- 降低数据库读取频率
- 动态规则生效更快

开发注意：

- 如果你改了 `api_rule` 表，记得确认缓存同步逻辑
- 生产环境建议开启规则同步配置

### 14.3 异步线程池

异步线程池配置位于：

- `src/main/java/com/letoy/main/common/config/AsyncConfig.java`

当前有两个线程池：

- `applicationTaskExecutor`
- `apiRuleSyncExecutor`

适用场景：

- 非关键路径异步任务
- API 规则同步
- 后续消息通知、审计埋点

---

## 15. OpenAPI 与联调方式

OpenAPI 配置位于：

- `src/main/java/com/letoy/main/common/config/OpenApiConfig.java`

用途：

- 生成接口文档
- 标注认证方式
- 供前后端联调和测试使用

建议：

- 所有管理端接口都写 `@Operation`
- DTO 字段尽量补 `@Schema`
- 大版本变更后及时回归 Swagger UI

---

## 16. 测试策略建议

当前项目具备 Spring Boot Test 能力，建议按以下层次补测试。

### 16.1 单元测试

适合：

- util
- assembler
- 纯业务规则判断

### 16.2 集成测试

适合：

- service + mapper 联动
- 鉴权和权限流程
- controller 接口

### 16.3 推荐优先补的测试

优先级最高的测试点：

- `/auth/bootstrap`
- `/auth/login`
- `/auth/refresh`
- 动态权限放行 / 拒绝
- 用户创建、状态修改、删除
- 用户组树结构查询
- 角色分配

---

## 17. 常见问题与排查建议

### 17.1 项目启动成功，但表没建

检查：

- `spring.flyway.enabled` 是否为 `true`
- 当前连接的数据库是否正确
- `flyway_schema_history` 是否存在

### 17.2 Swagger UI 启动报路径匹配错误

如果看到类似：

```text
/swagger-ui/**/*swagger-initializer.js
```

说明是 `springdoc` 版本和当前 Spring MVC 组合存在兼容问题。

当前项目已回退到：

- `springdoc-openapi-starter-webmvc-ui:2.8.14`

不要随意升到有问题的版本而不验证。

### 17.3 登录成功但接口仍然 401

检查：

- 是否正确带了 `Authorization`
- JWT secret 是否一致
- token 是否过期
- token 是否被撤销

### 17.4 登录成功但接口 403

检查：

- 是否命中白名单
- `api_rule` 是否存在对应规则
- 当前用户 `groupIds` 是否满足规则
- Redis 中的 API 规则缓存是否同步

### 17.5 bootstrap 失败

如果提示只能在系统为空时执行，说明库里已经有用户。

解决方式：

- 清库重建
- 或手工在数据库中维护管理员账号

---

## 18. 管理端项目的推荐演进方向

如果这个后台后续会长期演进，建议优先补这些能力：

1. 审计日志
2. 操作人、操作对象、前后值变更记录
3. 统一分页查询协议
4. 统一排序、筛选协议
5. 菜单/按钮级权限
6. Actuator + Prometheus 监控
7. 更完整的自动化测试
8. 配置中心与多环境密钥管理
9. 登录限流、风控、设备管理

---

## 19. 开发 Checklist

每开发一个新的管理端模块，建议按下面的 checklist 自查。

- 表结构是否通过 Flyway 管理
- 是否有 request / response DTO
- 是否没有直接暴露 entity
- 是否补了 assembler
- 是否写了 `@Valid`
- 是否补了动态权限规则
- 是否更新了文档
- 是否至少做了基本接口验证

---

## 20. 结语

这套后台的核心价值，不只是“能跑”，而是：

- 认证链路统一
- 权限规则可扩展
- 结构清晰
- 适合作为业务后台母版继续演进

如果后续你要在这个仓库上长期开发，建议把本文档和 `docs/template-guide.md` 一起维护。代码结构、配置项、Flyway 版本、权限策略一旦变化，文档也要同步更新，这样项目才真的具备“可交接、可复用、可持续维护”的价值。
