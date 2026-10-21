# 第一条贯通：前端教师参考

独立 Vue 3 / TypeScript / Pinia / Vite 前端。只实现教学登录、读取设备与空间、通信三态、简单筛选以及可靠的失败反馈；不包含后续章节的事件、责任、实时监测或 AIRIOT 接入。

## 运行前提

- 统一工具版本为 Node.js **22.21.1**，由课程资源根目录工具说明提供 Windows / macOS 安装与检查步骤。
- 本目录 `package.json` 的直接依赖使用精确版本，`package-lock.json` 锁定传递依赖；不删锁文件升级课堂依赖。
- 2026-10-18 已独立修复依赖并重新冻结：Vue 3.5.44、Vite 7.3.7、Vitest 4.1.12。教师参考的安全审计、锁生成工具与验证结果位于 `validation/DEPENDENCY_SECURITY.md`；学生副本不附带教师通过报告。原系统依赖不随本资源更新。
- 独立教学后端监听 `127.0.0.1:8091`，保留 `/api` 前缀。前端开发服务固定 `127.0.0.1:5178`，端口占用直接报错，不自动换端口。
- 账号由教师的本地工具生成并单独分配。源码、页面、测试证据没有可用默认账号或密码。测试中的字符串只用于 mock，不是登录凭据。

先确认当前目录中同时存在本前端的 `package.json`、`package-lock.json`、`vite.config.ts`，且 `package.json` 的 name 为 `campus-ai-course-frontend`。不要在课程文档根目录直接执行 npm。随后在本目录依次执行：

```sh
npm ci
npm run dev
```

浏览器打开终端实际给出的 `http://127.0.0.1:5178`。所有 fetch 使用相对 `/api` 地址及 `credentials: 'same-origin'`，Vite 将 `/api` 原样转发到本组回环后端。不要改成原平台地址或浏览器直连数据库。

```sh
npm run type-check
npm run test:unit -- --run
npm run build
```

`dist/` 只证明构建产物生成。当前 `preview` 是静态查看入口，没有开发代理，不能作为完整登录联调入口；完整链路使用 `npm run dev`。关闭时只停止本次启动的终端进程。

## 登录与读取合同

1. `GET /api/auth/csrf` 返回 `data:{token,headerName}`；匿名也可取得。
2. `POST /api/auth/login` 使用表单 `username/password` 和动态 CSRF 标头，成功只判断 `code=0`。
3. 登录成功后重取 CSRF，再读取 `GET /api/auth/me`，其字段为 `uid/username/displayName/roles/source`，来源固定 `TEACHING_MOCK`。
4. `GET /api/campus/capabilities` 按严格 Boolean true 授予前端入口。
5. 设备与空间均返回 `{code:0,message,data:{items,observedAt}}`。统一请求层检查 HTTP、JSON 内容类型、外层与字段形状，设备函数再判断业务成功并解包。
6. `POST /api/auth/logout` 必须带当前 CSRF。页面先清理旧身份与设备，服务端失败时明确显示“退出尚未确认”，不假报退出成功。

令牌和身份只保留在内存 store；不使用 localStorage 保存会话。服务端最终授权不由隐藏按钮代替。固定教学时钟来自后端，前端不把浏览器当前时间写成采样时间，也不重新计算 quality。

## 教师完成版与学生检查点

两个明确替换标记位于：

| 标记 | 文件 | 学生修改目标 |
| --- | --- | --- |
| `STUDENT_TODO_A_BEGIN/END` | `src/api/campus.ts` 的 `extractFirstRead` | 检查非零业务码，返回同一批 `data.items` 与 `data.observedAt` |
| `STUDENT_TODO_B_BEGIN/END` | `src/views/FirstDeviceRead.vue` 的 `onlineLabel` | true/false/null 分别返回在线/离线/未知 |

生成学生检查点时，只替换两标记之间的函数体为以下对应代码，保留标记、函数签名、教师校验层和资源状态层：

```ts
throw new ApiError('TODO-A 尚未完成：请检查业务码并解包列表与观察时间。')
```

```ts
return '待完成 TODO-B'
```

未填的学生版仍能类型检查与构建；TODO-A 以首次读取失败显示待完成信息，填好 A 后 TODO-B 在每行显示“待完成 TODO-B”，不会冒充正确三态。两个文件也已导入 `ApiError`，若教师将 B 改为抛出明确的待完成错误，页面会接住并显示错误区及“标签待完成”，不会崩溃。教师单元测试用于完成后的核验，未填版本相关测试不应标为通过。

本轮 TODO-B 只填写通信标签。资源层预制成功更新与失败保留快照；学生须沿 `stores/campus.ts` 解释并实际验证这些分支，不把填写标签函数声称为独立完成整套资源管理。

## 检查范围

单元测试核对合同、HTTP/业务失败、严格布尔、首次失败/空结果、三态、会话变更清理、迟到成功/失败/finally、刷新保留快照及退出未确认。mock 仅验证前端状态与请求规则，不证明后端认证、数据库或浏览器真实链路。真实登录、桌面/390px 和请求阻断与恢复由根任务单独联调记录。
