# 第三轮前端教师参考交接

更新时间：2026-10-18。工作范围为 `resources/campus-ai-course/frontend/` 和本交接文件；未改正文、共享合同、backend、fixtures、system。未自行启动前后端服务。主任务负责实际浏览器联调与整体资源状态。

## 已完成

- 独立 Vue 3 / TypeScript / Pinia / Vite 工程；Node 冻结 22.21.1。`dev` 固定 127.0.0.1:5178、strictPort；`/api` 原样代理到 127.0.0.1:8091。没有原系统地址、默认凭据、API Key 或大模型接入要求。
- 中文登录页和设备台账，浅色桌面与390px样式。明显标示 TEACHING_MOCK、模拟对象、固定教学时钟与北京时间，不以浏览器时钟判断 stale。数量从响应计算；支持简单关键词、通信状态筛选。
- 原生 fetch 同源会话、CSRF 前置取得、登录后轮换读取、me.uid 和 capabilities。HTTP、JSON 内容类型、响应外层、成功数据形状与业务 code 分开检查；401/403分别处理。服务端未知错误文本不直接输出。
- 请求成功才更新列表和观察时间。首次失败、成功空列表、筛选无匹配、旧快照刷新失败分别显示。退出立即清身份和资源；服务端退出失败显示“尚未确认”。
- 同一 Pinia 资源层管理 sessionEpoch、authSeq、requestSeq。所有成功、catch、finally 分支核对当前身份与序号；旧会话401不会清新身份，旧请求finally不会结束新请求的loading。
- 明确注明只完成第一条读取链路；事件、责任、历史与真实AIRIOT均未实现。UI样式依据 impeccable 产品规范，相关 PRODUCT.md / DESIGN.md 留在本独立前端内。

## 与同伴确认的合同

后端：`GET /api/auth/csrf`匿名可用，data为token/headerName；login是URLSearchParams表单，动态CSRF标头，login/logout成功data:null、code:0。登录后重取CSRF；me使用uid字符串及username/displayName/roles/source。capabilities按共享字段，只有Boolean true授权。设备/空间都使用data.items与observedAt。

夹具：Device保留完整可空键，tags单位允许字符串（空串表示无量纲）；Space完整可空映射。first-chain为env01:true、energy01:null；full含false。observedAt固定1792303200000。前端不硬编码这些对象或时刻，以上仅为联调预期。

## 学生版两个替换点

1. `src/api/campus.ts`：只替换 `STUDENT_TODO_A_BEGIN/END` 之间代码为 `throw new ApiError('TODO-A 尚未完成：请检查业务码并解包列表与观察时间。')`。学生补业务码及data.items/data.observedAt，教师JSON形状校验与资源状态层保留。
2. `src/views/FirstDeviceRead.vue`：只替换 `STUDENT_TODO_B_BEGIN/END` 之间代码为 `return '待完成 TODO-B'`，与主任务生成器决定一致。学生填写三态。若改为抛出ApiError，预制labelError/checkedOnlineLabel会显示待完成错误并保护页面。

未填版本应能build，但对应完成态测试应失败；不能把构建成功记为任务完成。A未填时首次读取显示待完成错误，A填完而B未填时每行标签仍明确待完成。两个入口和教材建议路径一致。

教材第04章原TODO-B还包含成功更新快照/失败保留。为控制本轮初次贯通负担，这部分由 `stores/campus.ts` 预制，学生阅读解释，不把仅填标签函数声称为独立实现整个资源层。主任务如需收紧对应关系，请在课堂任务映射中说明。

## 实际检查

执行目录均为本独立frontend，除下节明确记录的一次错误cwd；成功验证使用 `/Users/learner/.nvm/versions/node/v22.21.1/bin` 的 Node 22.21.1 / npm 10.9.4。

| 检查 | 实际结果 |
| --- | --- |
| 精确依赖与lock | 直接版本取自现有MG锁；裁剪保留243个所需包锁条目，源MG锁未修改；本平台npm ci实际安装194包 |
| `npm ci --prefer-offline --fetch-timeout=20000 --fetch-retries=1 --no-audit --no-fund` | 2026-10-18 23:13成功，exit 0；提示开发依赖glob10.5.0弃用，不代表完成依赖安全审计 |
| `npm run type-check` | exit 0 |
| `npm run test:unit -- --run` | 23:14:06，3文件24项通过，exit 0 |
| `npm run build` | exit 0，24模块；dist/index.html 0.46kB，CSS13.26kB，JS89.08kB |

测试覆盖合同/非JSON/业务失败、严格权限布尔、成功空数组、三态、首次失败与空目录分开、CSRF登录轮换、旧请求成功/失败/finally拒收、身份切换、401/403、保留旧快照与退出未确认。初次单测有1项因mock复用已消费Response失败；改为每次产生新Response后24项通过，没有放宽业务断言。

这些是前端单元和构建结果。真实登录/API链路、桌面/390px、键盘、错路径恢复、服务端退出效果由root继续验证。没有Windows实际运行、数据库集成、真实AIRIOT或公网部署证据。

## 安装失败与错误cwd审计

1. 初次 `npm install` 因registry元数据读取缓慢，在本次独立安装进程上终止（exit143），没有停止其他服务。改用prefer-offline后，npm10.9.4构建新peer依赖树出现 `Cannot read properties of null (reading 'edgesOut')`。最终从现有MG锁裁剪所需闭包后用npm ci成功，不依赖legacy-peer-deps或升级工具。
2. **一次npm ci错误cwd必须保留：**2026-10-18 23:13:30.644+08，cwd为`/Users/learner/projects/airiot-smart-campus-course`，命令为`npm ci --prefer-offline --fetch-timeout=20000 --fetch-retries=1 --no-audit --no-fund`。npm向上定位到用户级目录，在`/Users/learner/node_modules/.bin`的rmdir被EACCES拒绝；命令exit243，npm日志exit -13。没有提权、重试删除或自行修复共享目录。
3. 只读审计日志 `/Users/learner/.npm/_logs/2026-10-18T15_13_30_644Z-debug-0.log`：idealTree后直接记录上述拒绝，没有成功安装/移除条目；日志另记录npm日志轮转“removing 1 files”，属于npm日志行为，不能声称整个用户目录完全无写入。
4. 错误后只读遍历用户级node_modules：4136个目录，当前可写目录0，尝试前1秒（15:13:29Z）以来mtime/ctime变化目录0，遍历错误0；顶层与.bin为root所有、权限755、时间仍为2026-01-10。**未发现node_modules新增/移除/改动的证据，但缺少事前逐文件清单，不能绝对证明全部历史内容不变。**没有读取认证配置内容或环境秘密。
5. 后续npm命令均使用明确frontend工作目录；README新增运行前核对package名称、锁文件与vite.config的检查，避免npm向上寻找其他工程。

## 后续与边界

- root已计划使用本次产物启动5178并与8091联调，本子任务不启动第二份服务。
- root生成学生检查点后应实际build并验证A/B待完成反馈；本子任务没有将教师参考复制成学生完成证据。
- 附录、课堂命令、错误路径与代理图须由主任务统一到本轮 `/api` 保留前缀约定，不能沿旧章的“代理去掉/api”图而混用。
- 不因为本次前端通过而将09—12章、数据库事务实验或全课程标为LAB_VERIFIED。
