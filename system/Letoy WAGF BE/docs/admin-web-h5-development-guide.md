# 后台 Web / H5 端开发指南

## 1. 这份文档是给谁看的

这份文档不是讲后端如何开发，而是讲：

- 如何基于当前后端接口开发一个后台 Web / H5 管理端
- 前端项目应该怎么分层
- 登录、权限、刷新 token、列表页、表单页应该怎么落地
- 哪些权限应该前端控制，哪些必须交给后端控制
- 如何和当前后端仓库稳定联调

适用对象：

- 管理后台前端开发
- H5 运维端 / 审核端 / 运营端开发
- 负责前后端联调的开发同学

注意：

- 当前仓库是“后端项目”
- 本文档讲的是“如何写一个单独的前端管理端来对接它”

---

## 2. 当前后端能提供什么能力

这个后端已经具备一个管理端最核心的基础能力：

- 用户名密码登录
- 手机验证码登录
- 首个管理员初始化
- 当前用户信息获取
- Refresh Token 刷新
- 用户管理
- 用户组管理
- 角色管理
- API 规则管理
- 阿里云验证码 / 短信能力
- AI 调试能力

你在做管理端前端时，不需要自己再设计认证协议或权限接口格式，优先复用后端现有规范。

当前主要接口模块：

- `/auth`
- `/users`
- `/groups`
- `/roles`
- `/security/api-rules`
- `/aliyun`
- `/ai`

---

## 3. 推荐的前端技术方案

因为当前仓库只包含后端代码，所以前端技术栈没有被强绑定。为了降低团队协作成本，推荐选一套稳定、常见、易维护的方案。

推荐方案：

- `Vue 3`
- `TypeScript`
- `Vite`
- `Pinia`
- `Vue Router`
- `Axios`
- UI 组件库二选一：
  - 桌面管理端优先：`Element Plus` / `Naive UI`
  - 偏移动端 H5 优先：`Vant`

如果你们团队用 React，也完全可以，但本文示例会偏 Vue 3 风格来描述。

### 3.1 Web 与 H5 的建议拆分

如果这个后台同时面向桌面 Web 和手机 H5，推荐优先判断业务是否一致：

- 如果页面逻辑基本一致，只是布局不同：
  - 用一个项目做响应式适配
- 如果流程差异很大：
  - Web 管理台单独项目
  - H5 运营端 / 审核端单独项目

不要为了“看起来统一”硬把完全不同的交互塞进一个页面体系里。

---

## 4. 推荐的前端项目结构

建议前端项目按下面的结构组织：

```text
src/
  api/
    auth.ts
    users.ts
    groups.ts
    roles.ts
    apiRules.ts
    aliyun.ts
    ai.ts
  components/
    common/
    business/
  layout/
    AdminLayout.vue
    MobileLayout.vue
  router/
    index.ts
    routes.ts
  store/
    auth.ts
    app.ts
    permission.ts
  views/
    auth/
    dashboard/
    users/
    groups/
    roles/
    api-rules/
    profile/
    ai/
  utils/
    request.ts
    token.ts
    permission.ts
    form.ts
    table.ts
  types/
    api.ts
    auth.ts
    user.ts
    group.ts
    role.ts
    permission.ts
  styles/
    index.scss
```

### 4.1 为什么这样拆

- `api/`：只放接口调用，不混业务状态
- `store/`：只放状态，不直接写页面逻辑
- `views/`：页面级容器
- `components/business/`：复用业务组件，如用户表单、角色选择器、组树选择器
- `utils/request.ts`：统一处理 token、刷新、错误提示

这样做的好处是：

- 联调成本低
- 页面多了以后不乱
- H5 和 Web 可以共享很多 API 层和状态层代码

---

## 5. 先理解后端返回格式

当前后端大部分接口都使用统一响应结构 `ApiResponse<T>`：

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

前端必须统一处理：

- `status`：HTTP 状态语义
- `code`：业务状态码
- `message`：弹窗 / toast / 表单错误提示
- `data`：真正业务数据

### 5.1 分页接口结构

分页接口返回的 `data` 一般是：

```json
{
  "list": [],
  "total": 100,
  "pageNum": 1,
  "pageSize": 10,
  "pages": 10,
  "hasNextPage": true,
  "hasPreviousPage": false
}
```

前端表格组件建议统一映射成：

- `tableData = list`
- `pagination.total = total`
- `pagination.current = pageNum`
- `pagination.pageSize = pageSize`

---

## 6. 登录与认证流程

### 6.1 登录接口

用户名密码登录：

- `POST /auth/login`

请求体：

```json
{
  "username": "admin",
  "password": "123456"
}
```

登录成功返回的 `data` 里会直接包含：

- `token`
- `refreshToken`
- `uid`
- `username`
- `roles`
- `groupIds`

这意味着前端登录成功后，不需要再额外调用一次登录换 token 的接口。

### 6.2 当前用户接口

- `GET /auth/me`
- 或 `GET /users/me`

两个都能拿到当前用户信息，前端可以统一只保留一个入口调用。

推荐：

- 登录后先使用登录接口返回值初始化状态
- 页面刷新后再调用 `/auth/me` 或 `/users/me` 恢复用户信息

### 6.3 Refresh Token 刷新

接口：

- `POST /auth/refresh`

请求体：

```json
{
  "refreshToken": "..."
}
```

返回：

```json
{
  "accessToken": "...",
  "tokenType": "Bearer",
  "expiresIn": 3600
}
```

### 6.4 退出登录

接口：

- `POST /auth/revoke`

请求体：

```json
{
  "refreshToken": "..."
}
```

前端退出时建议做 4 件事：

1. 调用 `/auth/revoke`
2. 清空本地 `accessToken`
3. 清空本地 `refreshToken`
4. 清空用户信息与权限缓存

---

## 7. Token 存储策略

推荐：

- `accessToken`：内存 + `localStorage`
- `refreshToken`：`localStorage`

如果你们更强调安全，可以考虑：

- `accessToken` 只放内存
- 刷新时通过更严格的策略恢复

但对纯管理端系统来说，先保证稳定联调比过度复杂的存储策略更重要。

### 7.1 推荐封装

```ts
export interface AuthState {
  accessToken: string
  refreshToken: string
  uid: string
  username: string
  roles: string[]
  groupIds: string[]
}
```

建议把后端里的 CSV 字段先转成数组：

- `roles: "SUPER_ADMIN,ADMIN,USER"` -> `["SUPER_ADMIN", "ADMIN", "USER"]`
- `groupIds: "ROOT,PLATFORM"` -> `["ROOT", "PLATFORM"]`

这样前端权限判断会简单很多。

---

## 8. 请求层封装标准

推荐做一个统一请求实例，例如 `src/utils/request.ts`。

职责：

- 自动带 `Authorization`
- 自动提取 `ApiResponse.data`
- 统一处理 401 / 403 / 500
- 自动触发 refresh token

### 8.1 请求拦截

请求拦截器做两件事：

1. 从 store 或本地缓存读取 access token
2. 写入请求头 `Authorization`

注意：

- 当前后端直接读取 `Authorization` 原始值
- 不强制要求你拼 `Bearer `
- 为了兼容性，建议前端统一传“纯 token 字符串”

### 8.2 响应拦截

响应拦截器建议统一逻辑：

- `HTTP 200 + code === 0`：正常返回
- `HTTP 401`：尝试 refresh
- `HTTP 403`：跳转无权限页或弹提示
- `HTTP 5xx`：统一错误提示 + 记录 traceId

### 8.3 Refresh 队列

如果多个请求同时过期，前端必须避免并发刷新。

推荐实现：

- 用一个 `refreshing` 状态锁
- 第一个 401 触发 refresh
- 其他请求等待 refresh 完成后重放

不要每个 401 都自己发一次刷新请求。

---

## 9. 前端权限设计：要分清“显示权限”和“真实权限”

后台权限一定要区分两层：

### 9.1 前端权限

前端权限只负责：

- 菜单是否显示
- 按钮是否显示
- 某些页面是否允许进入

它的作用是提升体验，不是安全边界。

### 9.2 后端权限

真正的权限控制在后端：

- Spring Security
- 白名单
- JWT
- `api_rule`
- `DynamicPermission`

所以前端绝不能因为“按钮没显示”就认为安全了。

### 9.3 前端推荐判断依据

当前后端能直接返回：

- `roles`
- `groupIds`

因此前端可以先做两层本地权限判断：

1. 基于角色：控制功能菜单
2. 基于用户组：控制某些管理域页面提示

但最终是否可调用接口，以后端返回为准。

---

## 10. 菜单与路由建议

建议把后台页面拆成这些一级模块：

- 登录
- 首页 / Dashboard
- 用户管理
- 用户组管理
- 角色管理
- API 规则管理
- 我的资料
- AI 调试页
- 短信 / 验证码工具页（可选）

### 10.1 推荐路由结构

```text
/login
/dashboard
/users
/users/:uid
/groups
/roles
/api-rules
/profile
/ai/chat
```

### 10.2 路由守卫建议

路由守卫做三件事：

1. 没 token -> 跳登录
2. 有 token 但用户信息未恢复 -> 拉取 `/auth/me`
3. 需要特定前端权限的路由 -> 做本地权限判断

如果 `/auth/me` 失败：

- 清空登录状态
- 回登录页

---

## 11. 页面设计建议：后台 Web 与 H5 的差异

### 11.1 桌面 Web 管理端

适合：

- 用户列表
- 权限规则管理
- 组织树维护
- 复杂筛选表格

推荐交互：

- 左侧菜单 + 顶部导航
- 表格 + 抽屉 / 弹窗表单
- 高密度信息布局

### 11.2 H5 管理端

适合：

- 审核操作
- 快速查询
- 简单新增 / 编辑
- 登录、个人中心、待办操作

推荐交互：

- 底部 tab 或顶部 tabs
- 卡片列表
- 单列表单
- 少量核心字段优先展示

### 11.3 不建议的做法

- 直接把 PC 后台页面强行缩成手机尺寸
- 复杂表格原样搬到 H5
- 把所有筛选项全堆到一个 H5 顶部区域

更好的方式是：

- Web 和 H5 共用接口层
- 页面层单独适配

---

## 12. 页面与接口映射建议

### 12.1 登录页

用到接口：

- `POST /auth/login`
- `POST /auth/login/phone-code/send`
- `POST /auth/login/phone-code`

建议页面元素：

- 用户名密码登录 tab
- 手机验证码登录 tab
- 验证码倒计时
- 登录失败提示

### 12.2 首次初始化页

用到接口：

- `POST /auth/bootstrap`

适用场景：

- 新系统第一次部署
- 后台尚无管理员

前端建议：

- 启动时可探测是否已存在用户
- 如果没有现成接口探测，也可以在 bootstrap 调用失败后给出明确提示

### 12.3 用户管理页

用到接口：

- `POST /users/query`
- `GET /users/{uid}`
- `POST /users`
- `PUT /users/{uid}`
- `PATCH /users/{uid}/status`
- `PUT /users/{uid}/password`
- `DELETE /users/{uid}`

推荐页面：

- 列表页
- 新建 / 编辑抽屉
- 详情页
- 重置密码弹窗
- 状态切换

### 12.4 用户组管理页

用到接口：

- `GET /groups/all`
- `GET /groups/{groupId}/children`
- `GET /groups/{groupId}/subtree`
- `POST /groups/root`
- `POST /groups/child`
- `PUT /groups/{groupId}`
- `DELETE /groups/{groupId}`

推荐页面：

- 组织树 + 右侧详情编辑
- 或列表 + 树切换布局

### 12.5 角色管理页

用到接口：

- `GET /roles`
- `GET /roles/{roleCode}`
- `POST /roles`
- `PUT /roles/{roleCode}`
- `DELETE /roles/{roleCode}`
- `GET /roles/users/{uid}`
- `PUT /roles/users/{uid}`

推荐页面：

- 角色列表
- 角色编辑弹窗
- 用户角色分配弹窗

### 12.6 API 规则管理页

用到接口：

- `POST /security/api-rules/query`
- `GET /security/api-rules/{id}`
- `POST /security/api-rules`
- `PUT /security/api-rules/{id}`
- `PATCH /security/api-rules/{id}/enabled`
- `DELETE /security/api-rules/{id}`
- `POST /security/api-rules/rebuild-cache`

这个页面很关键，建议：

- 有筛选区
- 有启停开关
- 有规则详情抽屉
- 有重建缓存按钮

### 12.7 个人中心页

用到接口：

- `GET /users/me`
- `PUT /users/me/profile`
- `PUT /users/me/password`
- `POST /users/me/phone/bind-code/send`
- `PUT /users/me/phone/bind`
- `POST /users/me/phone/reset-code/send`
- `PUT /users/me/phone/reset`

### 12.8 AI 调试页

用到接口：

- `POST /ai/chat`

推荐用途：

- 后台运营 prompt 调试
- AI 能力验证

---

## 13. 推荐的数据类型定义

前端建议统一定义接口类型，不要在页面里随手写 `any`。

### 13.1 统一响应类型

```ts
export interface ApiResponse<T> {
  timestamp: string
  status: number
  code: number
  message: string
  data: T
  path?: string
  traceId?: string
}
```

### 13.2 分页类型

```ts
export interface PageResponse<T> {
  list: T[]
  total: number
  pageNum: number
  pageSize: number
  pages: number
  hasNextPage: boolean
  hasPreviousPage: boolean
}
```

### 13.3 当前用户类型

```ts
export interface CurrentUser {
  uid: string
  username: string
  nickname?: string
  phoneNumber?: string
  email?: string
  groupIds: string
  roles: string
  token?: string
  refreshToken?: string
  active: boolean
  accountLocked: boolean
}
```

前端落库或存 store 前，建议转换成：

```ts
export interface CurrentUserViewModel {
  uid: string
  username: string
  nickname?: string
  phoneNumber?: string
  email?: string
  groupIdsRaw: string
  rolesRaw: string
  groupIds: string[]
  roles: string[]
  accessToken?: string
  refreshToken?: string
  active: boolean
  accountLocked: boolean
}
```

---

## 14. 表单与表格的统一规范

### 14.1 列表页建议统一交互

列表页建议固定结构：

1. 筛选区
2. 工具栏
3. 表格 / 卡片区
4. 分页器

筛选区常见字段：

- 关键词
- 状态
- 时间范围
- 组织 / 角色

### 14.2 表单建议

建议统一做一个表单弹窗 / 抽屉规范：

- 新建与编辑共用一个组件
- 通过 `mode=create | edit` 区分
- 校验规则集中定义
- 提交按钮统一 loading

### 14.3 删除操作

建议：

- 删除必须二次确认
- 删除成功后刷新当前页
- 如果当前页删空了，自动回到上一页

---

## 15. 前端与后端的权限协作规则

前端要记住一个原则：

后端权限是硬权限，前端权限是体验优化。

因此建议这样分工：

### 15.1 前端负责

- 菜单展示
- 路由守卫
- 按钮隐藏
- 空态提示

### 15.2 后端负责

- 认证合法性
- 接口可访问性
- 动态权限规则判断
- 跨用户组数据边界控制

### 15.3 当前项目的特殊点

这个后端的真实接口权限主要基于：

- `groupIds`

不是纯角色系统。

所以前端如果要做页面级权限展示，优先看：

- 当前用户所属组
- 当前用户角色

但不要只看角色。

---

## 16. 联调顺序建议

推荐前端联调顺序：

1. 先打通 `/auth/login`
2. 再打通 `/auth/me` / `/users/me`
3. 再做刷新 token
4. 再做用户列表页
5. 再做角色、组、权限规则页
6. 最后接 AI / 阿里云等扩展能力

这样做的原因是：

- 登录链路最基础
- 用户列表最能验证 token + 分页 + 权限
- 规则页和 AI 页不是起步阻塞项

---

## 17. 常见联调问题

### 17.1 登录成功但页面刷新后掉线

常见原因：

- token 没持久化
- 刷新后没有恢复用户信息
- `Authorization` 请求头没有自动带上

### 17.2 页面看得到，但接口 403

说明前端本地权限判断和后端真实权限不一致。

优先排查：

- 当前用户 `groupIds`
- 对应接口在 `api_rule` 中是否有规则
- 规则允许的组是否匹配

### 17.3 分页接口表格不显示

检查：

- 是否取了 `response.data.list`
- 而不是直接取 `response.list`

### 17.4 401 死循环刷新

说明 refresh 逻辑没有做并发锁或失败兜底。

正确做法：

- refresh 失败后立即清空登录态并跳登录
- 不要继续无限重试

### 17.5 Swagger 里能调通，前端调不通

优先检查：

- `baseURL`
- context path
- CORS 配置
- `Authorization` 是否漏传

---

## 18. H5 管理端的额外建议

如果你做的是“偏移动端的后台 H5”，建议页面优先级这样排：

第一层：

- 登录
- 首页概览
- 我的资料
- 用户查询 / 审核

第二层：

- 组织管理
- 角色管理
- AI 调试

第三层：

- 权限规则管理
- 系统调试页

原因：

- API 规则管理这类页面不适合高频 H5 操作
- H5 更适合轻量任务和移动处理

---

## 19. 推荐的前端开发 Checklist

每做完一个页面，建议自查：

- 接口类型是否定义了 TypeScript 类型
- 表单是否有校验
- 是否正确处理 loading / empty / error 三态
- 是否处理了 401 / 403 / 500
- 是否有路由守卫
- 是否做了移动端适配
- 是否区分了前端权限和后端权限

---

## 20. 一个最小可用版本应该包含什么

如果你要先快速交付一个“能用”的后台 Web / H5 端，最小集合建议是：

### 必做

- 登录页
- token 持久化
- `/auth/me` 恢复用户状态
- 首页布局
- 用户列表页
- 用户编辑页
- 角色列表页
- 用户组列表 / 树页
- 个人中心页

### 第二阶段

- API 规则管理页
- AI 调试页
- 手机验证码登录页
- 手机绑定 / 重置页

### 第三阶段

- 审计日志页
- 操作留痕
- 菜单 / 按钮权限体系
- 多端主题与品牌化

---

## 21. 最后的建议

这个后端的价值在于：

- 认证链路已经统一
- 管理端核心数据模型已经有了
- 动态权限模型已经建立

所以前端开发不要再重复发明一套登录、权限、分页协议。

最稳的做法是：

1. 严格贴合现有接口模型
2. 先把请求层和状态层打稳
3. 再逐步扩展页面体验

如果后续你愿意，我可以继续直接帮你补下一版：

- 一个“基于 Vue3 + Vite + TS”的后台 Web/H5 目录模板
- 或者一份“页面清单 + 路由表 + API 文件拆分方案”的可执行前端架构文档
