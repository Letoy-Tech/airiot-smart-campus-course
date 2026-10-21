> 脱敏历史记录。以下部署状态和验收数字仅对应原记录时间，域名、身份、路径和项目标识已替换；不表示本仓库已部署。当前操作入口见 [系统 README](../README.md)。

# 智慧校园管理系统：本地运行与学校演示交付

本系统在本目录独立开发和运行，通过 **MG → BE → AIRIOT** 接入项目 `000000000000000000000001`。当前范围为4个模拟空间、16台模拟设备和28个采集点，包含校园/楼栋映射、设备台账、实时点值、原始历史、能源点位、AIRIOT 报警读取、演示事件处置、设备责任人、角色权限与审计。

**2026-10-05 学校展示 DEMO 已在现有城大服务器上线。** 最终版本 `REL_20261005-0151-SCHOOL-DEMO`，入口：[学校展示 DEMO](https://demo.example.invalid/campus-demo/)。远端业务/API、正常 HTTPS 静态资源、管理员实际桌面及390px视口、备份隔离恢复均已有独立证据；2026-10-04 本地历史结果另列。讲解及账户用途见 [学校展示说明](campus-demo-school-guide.md)。

全部远端对象保留模拟标识。学校 DEMO 全面关闭实体及远端模拟开关控制，关闭外部通知；本地演练事件及责任登记仅写入 DEMO 的独立数据库，不修改上游报警、设备读数或开关。能源只有 V/kW，不生成 kWh、费用或节能率。学校展示不等于真实校园接入、硬件恢复或运营验收。

## 目录与入口

| 位置 | 用途 |
| --- | --- |
| `Letoy WAGF MG/` | Vue、TypeScript、Pinia、ECharts 业务管理界面 |
| `Letoy WAGF BE/` | Spring Boot 接口、AIRIOT 适配、本地映射与审计 |
| `scripts/local-runtime.py` | 管理本系统专属 MySQL、Redis、BE、MG 进程 |
| `docs/api-contract.md` | 业务接口和角色能力合同 |
| `docs/campus-demo-deployment.md` | 学校 DEMO 的独立服务、子路径代理、发布、备份与恢复流程 |
| `docs/*acceptance*.json` | 各层实际验收证据，不能相互替代 |
| `.private/` | 受限凭据与 TEST 账户文件，不进入源码或前端 |
| `.runtime/` | 专属数据库、缓存、PID 和运行日志，保留用于再次启动 |

本地浏览器入口：[智慧校园 MG](http://localhost:5173)。BE 地址为 `http://localhost:8001`；MG 的 `/api` 代理到 BE 并去掉该前缀。本地 MySQL 为 `127.0.0.1:13316`，数据库 `smart_campus`；Redis 为 `127.0.0.1:16379`。本地服务仅绑定本机地址。

学校 DEMO 使用 `demo-host` / `demo-host` 上的专属 `campus-demo.service`、MySQL 和 Redis；BE 绑定 `127.0.0.1:18091`，数据库 `smart_campus_demo` 绑定 `127.0.0.1:13391`，Redis 绑定 `127.0.0.1:16391`。版本及持久化数据分别位于 `/srv/campus-demo/releases/` 和 `/srv/campus-demo/shared/`，通过现有域名的 `/campus-demo/` 子路径访问。具体隔离、凭据与回退安排见 [部署与恢复说明](campus-demo-deployment.md)。

## 启动、停止与更新

在 `system` 目录执行命令。运行脚本使用当前 `java`、`node` 和 `/opt/homebrew/bin` 下的 MySQL、Redis 工具；当前环境已具备这些依赖。MG 要求 Node `^20.19.0 || >=22.12.0`。首次恢复源码时，如缺少 `node_modules`，在 MG 目录按锁文件执行 `npm ci`。

```sh
cd "/Users/learner/system"
python3 scripts/local-runtime.py status
python3 scripts/local-runtime.py start
```

`start` 初始化或复用本系统专属数据目录，再启动数据库、缓存、BE 和 MG。`init` 只准备数据库与缓存。脚本核对本系统 PID/命令标记；遇到其他进程占用端口时退出，不停止占用者。

| 命令 | 作用 |
| --- | --- |
| `python3 scripts/local-runtime.py status` | 查看四个专属进程状态与端口 |
| `python3 scripts/local-runtime.py init` | 准备专属 MySQL、Redis 和本地配置 |
| `python3 scripts/local-runtime.py stop-apps` | 停止 BE、MG，保留数据库与缓存 |
| `python3 scripts/local-runtime.py restart-apps` | 重启本系统 BE、MG |
| `python3 scripts/local-runtime.py stop` | 停止四个专属进程，保留数据 |
| `python3 scripts/local-runtime.py import-airiot` | 安全导入专用应用配置，重启 BE 后生效 |

修改代码后先构建，再重启本地应用：

```sh
cd "Letoy WAGF BE"
./mvnw package
cd "../Letoy WAGF MG"
npm run build
npm run test:unit -- --run
cd ..
python3 scripts/local-runtime.py restart-apps
```

BE 运行产物为 `Letoy WAGF BE/target/letoy-wagf-be-0.0.1.jar`。当前 MG 本地运行使用 Vite 开发服务；`Letoy WAGF MG/dist/` 是构建产物，不能将生成 `dist` 等同于已部署。

学校 DEMO 的前端必须按公开子路径单独构建：

```sh
cd "/Users/learner/system/Letoy WAGF MG"
npm run type-check
VITE_API_BASE_URL=/campus-demo/api npm run build-only -- --base=/campus-demo/
```

`VITE_API_BASE_URL` 仅指定 BE 代理地址。`--base` 直接交给 `build-only` 的 Vite，不使用 `npm run build -- --base=...`；后者经过 `run-p`，不能可靠传递该参数。子路径代理与 history fallback 也必须一致，发布流程见部署文档。

## 凭据与本地账户

四个本地 TEST 账户仅保存在 `.private/local-accounts.json`，涵盖管理员、校园管理人员、只读查看者及单独 ADMIN 角色测试账户。登录信息由用户在本地受限文件中查看，本 README 不复制账户秘密。

学校 DEMO 使用独立生成的管理员、运营人员、只读查看者账户，受限账户文件为 [.private/campus-demo-accounts.json](.private/campus-demo-accounts.json)，在远端初始化时生成。文件权限为 `0600`，不复用本地会话或共享数据库账户；本 README 不复制登录秘密。

专用 AIRIOT 凭据位于 `.private/airiot.properties`，仅允许 `campus.airiot.app-key`、`campus.airiot.app-secret`、`campus.airiot.control-enabled` 三项。文件权限必须为 `0600`。脚本将其与独立数据库、Redis、JWT 配置合并到 `.private/local.properties`。旧只读应用对比文件 `.private/airiot-readonly.properties` 仅供验收，不是 BE 运行凭据。

BE 不向 MG 暴露 AppKey、AppSecret 或机器 token，配置不使用 `VITE_*`。2026-10-04 检查源码、前端产物、交付文本与本地日志时，未发现所用凭据值；当日上游网关日志未检查。不要删除 `.private/` 或 `.runtime/mysql/` 来处理普通启动失败；前者关联本地身份，后者保存账户、映射与审计。维护和迁移前应保留专属数据库及其受限配置。2026-10-04 本地交付未进行备份恢复验收，本轮学校 DEMO 的备份与恢复需按独立部署流程另行验证。

## 业务操作

学校 DEMO 的角色范围如下，实体与远端模拟开关控制对所有角色均关闭：

| 角色 | 读取监控、历史、原始报警与演练记录 | 处置演练事件 | 分派、触发/恢复演练、登记设备责任人 | 管理映射、账户/角色、接入与审计 |
| --- | --- | --- | --- | --- |
| SUPER_ADMIN / ADMIN | 可以 | 可以处理全部事件 | 可以 | 可以 |
| CAMPUS_MANAGER | 可以 | 仅本人已分派事件 | 不可以 | 不可以 |
| CAMPUS_VIEWER | 可以 | 不可以 | 不可以 | 不可以 |

MG 先严格读取 BE capabilities 再呈现入口，只有 Boolean `true` 才授予能力；缺失、字符串或数字标志不授予权限。演练流程使用 `canHandleAlarms`、`canAssignAlarms`、`canRunDemoScenarios`，设备责任登记使用 `canAdmin`。BE 根据当前账户、启用角色和操作范围强制授权。校园角色即使处于 ROOT 组，也不因此获得管理能力。自定义角色名称不会自动授予校园权限。

1. **空间与楼栋**：管理员添加本地校园和楼栋，再关联 AIRIOT 模拟空间与楼层。映射写入 BE 的专属数据库，不改远端模型；当前 TEST 映射是验收数据，不代表真实校园建档。
2. **设备台账**：默认卡片巡查，可切换表格，按类型、空间、通信三态或名称过滤；分布图跟随当前筛选。窄屏默认收起分布图，优先巡查设备。检查来源、采样时间和质量；通信时间未返回时保留未知。
3. **设备详情**：点击实际采集点查看原始历史，可选15分钟/1小时/6小时、勾选曲线或展开样本表。概览和能源页支持同单位多设备比较。结果不补零或插值，截断与缺失会提示；部分失败逐台保留旧快照并标记查询时间。
4. **演示运营**：学校讲解路径为“看校园运行 → 看事件处置 → 看设备责任”。管理员可触发温度巡查、设备通信巡查、照明巡查三个独立本地场景；场景不代表关联设备实际发生异常。队列展示实际返回的 DEMO 事件、状态与负责人，状态图只统计本页返回记录。
5. **事件详情**：流程为待分派 → 待处理 → 处理中 → 已关闭。设备已有有效责任人时，创建演练事件按责任人自动分派。管理员可重新分派；管理人员只处理本人已分派事件。关闭前必须开始处理、保存处置记录、模拟演练来源恢复并独立核实通过，再填写关闭结论。各动作及版本进入持久化时间线；已关闭记录不可修改。
6. **设备责任人**：设备读取 AIRIOT 模拟项目，责任登记由 BE 独立保存。管理员选择已授权处置账户并填写登记说明，保存后回读设备、负责人及版本，保留责任变更记录。
7. **AIRIOT 原始报警**：只读实际记录，保留上游枚举，不确认、归档、删除或发送通知。2026-10-04 查询实际为空，不能据此证明真实报警发生、恢复和非空字段映射已验收。本地 DEMO 事件不计入 AIRIOT 原始报警。

所有本地演练与责任写入携带 `expectedVersion`。HTTP409 时回读最新版本并保留输入；失败不清空输入，回读未确认不显示成功。不发送外部消息或通知。

2026-10-04 的旧本地验收曾授权仅对 `facility_demo_01–04`、`light_demo_01–04` 的 `simulated_switch_on` Boolean 字段进行模拟操作，采用理由、expectedState、写后回读和独立审计。该历史授权与证据不代表学校 DEMO 开放控制；远端学校 DEMO 的控制能力全面关闭。

概览、设备、能源每15秒静默刷新，报警每30秒刷新；请求不重叠，离页停止。刷新失败保留最后成功数据及时间，未知值不显示为零或关闭。

## 验收证据与边界

以下为2026-10-04已记录的本地历史结果，各层独立报告：

| 层次 | 当前证据 | 结论 |
| --- | --- | --- |
| 源码 / 本地构建 | BE package 含60项测试；MG build 含类型检查，另有18项单元测试 | 本地通过，不能替代运行验收 |
| AIRIOT 机器读取 | [airiot-read-acceptance.json](airiot-read-acceptance.json) | 专用非超级身份读取5表4空间/16设备/28点；两轮间隔16.010秒，28点时间均推进；28个合法点最近一小时原始历史成功 |
| 本地 API / 真实链路 | [local-api-acceptance.json](local-api-acceptance.json) | 71项通过，含实际 MG 合同接口、授权、模拟写后回读、审计与恢复 |
| 本地安全边界 | [local-security-acceptance.json](local-security-acceptance.json) | 独立安全验证通过，具体检查见报告 |
| 真实数据库并发 | [local-concurrency-acceptance.json](local-concurrency-acceptance.json) | 4项通过：相同预期状态并发一200/一409，CONFLICT独立提交；8台初始false恢复 |
| MG 浏览器 | [browser-acceptance.json](browser-acceptance.json) | 当日桌面与Chrome CDP 390px窄屏仿真范围通过：4/16/28、TEST映射保存回读、719条原始历史图与样本表；管理员与移动视口manager分别开启/关闭回读恢复；viewer没有控制控件，直接访问审计被拒，真实空报警保留机制未验收提示 |
| MG 可视化改版 | [ui-visualization-acceptance.json](ui-visualization-acceptance.json) | 浅色驾驶舱、真实趋势/质量/空间比较与矩阵钻取、设备卡片/台账切换；该轮仅读取，具体桌面与390px视口覆盖以报告为准 |
| 最终实时状态 | [final-state.json](final-state.json) | 最终4空间/16设备/28个fresh点、issues为0、8个模拟开关均恢复false |
| 2026-10-04 公网状态 | 无 | 当日本地交付未部署公网；不描述本轮学校 DEMO 发布结果 |

2026-10-05 学校 DEMO 的当前交付证据如下，远端结果需在实际验证后追加：

| 层次 | 当前证据 | 结论 |
| --- | --- | --- |
| 源码 / 本地构建 | BE package 80项测试；MG 27项单元测试、type-check、build、改动文件 ESLint | 通过，不能替代远端运行或浏览器验收 |
| 学校 DEMO 本地 API | [campus-demo-local-acceptance.json](campus-demo-local-acceptance.json) | 49项通过，覆盖演练流程、责任登记、三角色范围及回读 |
| 学校 DEMO 本地事务回滚 | [campus-demo-local-transaction-acceptance.json](campus-demo-local-transaction-acceptance.json) | 13项通过，覆盖失败后的本地记录与时间线回滚 |
| 远端发布 | [发布报告](campus-demo-deploy-published.json)、[技术报告](campus-demo-deploy-technical.json) | 最终版本已生效，3专属服务 active/enabled，回环监听；9既有域名状态与49共享容器身份/镜像保持 |
| 远端业务 API | [campus-demo-api-acceptance.json](campus-demo-api-acceptance.json) | 49项通过；通过私有SSH隧道完成初版种子、角色边界及处置闭环 |
| 公网 HTTPS / 最终权限 | [campus-demo-public-acceptance.json](campus-demo-public-acceptance.json) | 19项通过；正常证书验证，根/深链接/资产哈希、4账户权限、监测与已存事件回读；所有角色 canControl=false |
| 远端实际浏览器 | [campus-demo-public-browser-acceptance.json](campus-demo-public-browser-acceptance.json) | 管理员桌面和390px仿真通过，新事件完整处置并刷新保留；禁控表单隐藏、矩阵钻取、责任记录、筛选与退出子路径均核对 |
| 远端备份 / 隔离恢复 | [备份报告](campus-demo-deploy-backup.json)、[恢复报告](campus-demo-deploy-restore.json) | 最终4案例/18时间线/16责任人已备份，18表全部恢复行数等于快照，临时schema已移除；未覆盖运行库 |

本轮远端浏览器只实际登录管理员；只读查看者的界面拒绝另有[本地浏览器证据](campus-demo-local-browser-acceptance.json)，其他账户在公网 API 验证。部署单实例 BE 重启期间出现一次502，页面保留旧队列并明确最后成功时间；发布校验曾自动恢复代理后复核正常，失败及记录缺口见 [发布尝试记录](campus-demo-deploy-publish-attempts.json)。未实际从学校网络或实体手机测试。

`GET /campus/integrations/airiot/status` 的业务 capabilities 显示 `PENDING`，是因为该接口只检查当前连接和配置，不自动消费离线验收 JSON。它不会将历史报告冒充当前实时检查；具体业务已测范围、时间和限制以各验收报告为准。

2026-10-04 的本地窄屏验收使用Chrome CDP视口仿真，确认390px文档无横向溢出、导航与角色入口、manager模拟操作和viewer拒绝行为；它不等于真实手机或微信客户端验收。浏览器报告仅对应当日实际操作和截图覆盖，不替代所有设备、未来数据、非空报警测试或本轮远端验收。

专用 AIRIOT 角色具有目标表级编辑权限；**上游字段 ACL 不等于 BE 的严格字段限制**。BE 只允许8个既有模拟对象的一个 Boolean 字段，机器凭据不得交给前端。专用 schema 只读200符合已核对的 table.view 范围，role读取403；没有进行 schema 写入测试。

旧只读应用保留原权限：照明记录读取403，但代表照明历史仍能读取；报警、schema和role读取403。这说明记录权限不能推导历史路径权限，详情见机器报告。未改变旧角色/应用。上游跨项目拒绝、字段 ACL、非空报警映射及报警生命周期仍待独立验收，不用本地范围校验或空列表代替。

## 重新检查与排障

只读机器重验调用当前编译的 Java `AiriotClient`，要求已 package，且两套受限应用文件完整：

```sh
python3 scripts/verify-airiot-reads.py
```

本地 API TEST 验收会创建或复用 TEST 账户，并临时测试角色启停、账户锁定后恢复；它不是纯只读脚本。`--controls` 额外对8个批准模拟对象暂时切换并恢复初态。仅在独立演示范围且无人同时控制这些对象时执行：

```sh
python3 scripts/verify-local-system.py
python3 scripts/verify-local-system.py --controls
```

| 现象 | 检查方向 |
| --- | --- |
| MG不能打开 | `status` 检查MG进程和5173端口，确认从本机访问 |
| 登录或接口不可用 | 检查BE8001、MySQL13316、Redis16379及本系统 `.runtime/` 日志 |
| 接入未配置/鉴权失败 | 检查受限应用文件完整性和0600权限，import后重启本地BE；不从浏览器取AIRIOT会话秘密 |
| 最新值有但记录业务字段缺失 | 当前部署记录查询需要固定 `query.project` 投影，已由适配层处理；缺字段不能直接归因于角色权限 |
| 报警查询400 | 当前 warning 查询按外键 `tableId` 与固定 `uid` 范围过滤；旧 `table.id` 形式已在实测后修正 |
| 过期/缺失/通信时间未知 | 按界面质量与实际源时间排查，不补零，不直接重启共享AIRIOT或仿真服务 |
| 模拟操作409 | 其他操作已改变状态，刷新并重新核对目标；审计保留冲突，不自动覆盖 |
| 演练事件/责任登记409 | 最新版本或状态已经改变；保留输入，回读最新负责人及时间线后重新核对，不自动覆盖 |
| 学校 DEMO 深链接或静态文件404 | 核对构建 base 为 `/campus-demo/`、API地址为 `/campus-demo/api`，以及专属 Nginx history fallback |

接口细节见 [api-contract.md](api-contract.md)，前端运行和产品/视觉约定见 [MG README](../Letoy%20WAGF%20MG/README.md)、[PRODUCT.md](../Letoy%20WAGF%20MG/PRODUCT.md)、[DESIGN.md](../Letoy%20WAGF%20MG/DESIGN.md)。
