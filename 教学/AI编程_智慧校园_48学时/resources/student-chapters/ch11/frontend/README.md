# 智慧校园：完整前端教师参考

独立 Vue 3 / TypeScript / Pinia / Vite 前端，覆盖第 04—12 章的登录、台账、空间映射、点值质量、历史样本、本地演练事件及设备责任。教师参考已给出实现，学生按每章检查点填写局部任务。AIRIOT 保留只读选做入口，真实连接未验收，远端控制与外部通知关闭。

## 运行前提

- 统一工具版本为 Node.js **22.21.1**，由课程资源根目录工具说明提供 Windows / macOS 安装与检查步骤。
- 本目录 `package.json` 的直接依赖使用精确版本，`package-lock.json` 锁定传递依赖；不删锁文件升级课堂依赖。
- 2026-10-18 已独立修复依赖并重新冻结：Vue 3.5.44、Vite 7.3.7、Vitest 4.1.12；2026-10-19 新增 ECharts 6.1.0。教师参考的安全审计、锁生成工具与验证结果位于 `validation/DEPENDENCY_SECURITY.md`；学生副本不附带教师通过报告。原系统依赖不随本资源更新。
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

第 04 章的两个明确替换标记位于：

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

未填的学生版仍能类型检查与构建；TODO-A 以首次读取失败显示待完成信息，填好 A 后 TODO-B 在每行显示“待完成 TODO-B”，不会冒充正确三态。`#first-read` 页保留独立的标签错误区与首次贯通反馈。教师单元测试用于完成后的核验，未填版本相关测试不应标为通过。

本轮 TODO-B 只填写通信标签。资源层预制成功更新与失败保留快照；学生须沿 `stores/campus.ts` 解释并实际验证这些分支，不把填写标签函数声称为独立完成整套资源管理。

## 检查范围

单元测试核对合同、HTTP/业务失败、严格布尔、首次失败/空结果、三态、会话变更清理、迟到成功/失败/finally、刷新保留快照及退出未确认。mock 仅验证前端状态与请求规则，不证明后端认证、数据库或浏览器真实链路。真实登录、桌面/390px、事件闭环、409与角色边界现已由 `tools/verify-browser.mjs` 验证，结果保存在工程 evidence/full-browser；数据库并发/事务证据由根任务和后端工具独立保存。


## 模块入口与实现定位

登录后根地址默认进入设备台账；第 04 章使用 `http://127.0.0.1:5178/#first-read`。导航由 `views/FullWorkspace.vue` 维护受控 hash，不向服务端改变 API 路径。

| 章节 | hash | 页面 / 逻辑 |
| --- | --- | --- |
| 04 | `#first-read` | `views/FirstDeviceRead.vue`，原 A/B 标记与资源框架保留 |
| 05 | `#locations` | `views/LocationsView.vue`，校区、楼栋、空间绑定 |
| 06 | `#devices`、`#devices?deviceId=...` | `views/DeviceCatalog.vue`，联合筛选、清除、稳定ID详情与刷新恢复 |
| 07 | `#overview`、`#history` | 点值/质量/完整度、真实历史样本及 null 断点；图与原始表并列 |
| 08 | 顶栏身份、所有页面能力 | `api/auth.ts`、`stores/campus.ts`、`domain/course.ts` |
| 09 | `#cases` | 本地演练、列表、详情、七类动作、版本冲突与时间线 |
| 10 | `#owners` | 责任登记与审计时间线；变更不改旧事件 |
| 11 | 全模块 | `composables/useRequestScope.ts` 与 `src/tests/` |
| 12 | `#cases?state=CLOSED` | 合法 state 刷新保留；分页 skip 归零；构建与变更 |
| 选做 | `#integration` | 配置未验证说明、只读状态及上游报警边界 |

`first-chain` 后端只提供原登录与设备/空间读取；使用 `#first-read`。完整页面需要 `teacher-db` 后端，4 个空间、16 台设备、28 个点位来自教师夹具。first-chain 不支持的页面会显示接口失败，不假造业务结果。

### 后续学生小块

`src/domain/course.ts` 保留 `STUDENT_TODO_C06_BEGIN/END`（`filterDevices`）、C08（`strictCapability`）、C12（`changeCaseState`）。教师实现分别完成联合筛选、严格 Boolean 能力和状态改变后分页归零。根工具生成未完成起点时使用可编译但不能通过验收测试的 stub：C06 返回空数组，C08 返回 false，C12 返回空状态与 skip=0。不能把起点空列表、权限关闭或状态丢失当作完成。教师生成器保留前章已完成结果，当前章只替换对应块。

### 资源生命周期与业务边界

`api/full.ts` 按 `backend/docs/full-api.json` 校验 HTTP、业务码与 JSON DTO。写入 JSON 只携带允许字段和 CSRF；版本来自正在查看的服务端记录，不由客户端创造 actor 或时间。

每个资源使用 `useRequestScope`：请求序号、会话 epoch、uid、卸载状态与 AbortSignal 共同保护 success/catch/finally。监测使用完成后 15 秒的单次定时器，手动刷新重置计时，离页或换身份停止。非权限类读取失败保留上次成功快照；401 清会话，403 保留身份并报告权限拒绝。

事件和责任收到 409 时保留表单，自动回读最新记录；回读失败继续阻止写入，成功后仍须点击“已核对最新记录/责任”再明确选择操作，不自动重放。页面关闭预检包括处理记录、恢复与服务端核实；最终权限和状态门槛由后端决定。收到 400、403、409 或 500 均不被前端宣称为数据库回滚验证。

### 验证命令与证据边界

```sh
npm run test:unit -- --run src/tests/course-domain.test.ts
npm run test:unit -- --run src/tests/request-scope.test.ts
npm run test:unit -- --run src/tests/workflow-views.test.ts
```

上述 mock 测试只验证前端语义。真实数据库的并发、事务整体回滚、浏览器登录操作与 Windows 真机验证必须使用根课程工具和独立证据，不可用前端测试替代。教师验证记录在 `validation/ROUND4_FRONTEND.md`，该目录不随学生起点分发。
