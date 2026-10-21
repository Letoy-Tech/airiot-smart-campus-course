# 固定教学数据资源

本目录是独立教学 Mock 样本，不是校园实测数据，也不是从原平台导出的记录。全部名称、对象 ID、数值和时间由课程人工构造。`source=TEACHING_MOCK` 表示来源；目录顶层及每台设备的 `simulated=true` 表示模拟属性。二者含义不同，Device 合同中不新增 `source` 字段。

## 文件和使用边界

| 文件 | 内容 | 可证明什么 |
| --- | --- | --- |
| `catalog.json` | 4 空间、16 设备、28 个唯一采集点 | 固定样本的字段、关联和规模 |
| `selectors.json` | first-chain/full 选取规则 | 同一目录的两种教学规模 |
| `quality-cases.json` | 原始输入与预期质量分离的单变量案例 | 单独检查 60 秒、未来 5 秒及类型边界 |
| `history-cases.json` | 合法历史接口外层及 4 条样本 | 有效零、来源明确的 null 与未采样时间不同 |
| `permission-scenarios.json` | 四身份、撤权、本人范围的场景规格 | 需要后端实施的测试条件和预期 |
| `pagination-scenarios.json` | 事件列表分页场景规格 | 已有范围和数量预期，不定义排序 |
| `concurrency-rollback-scenarios.json` | 事件/责任竞争及时间线失败场景规格 | 需要真实隔离 MySQL 的验收设计 |
| `schema.md`、`manifest.json` | 字段说明、冻结映射和 SHA-256 | 文件可追溯性与一致性 |

后三种 `SCENARIO_SPEC` 的 `executionStatus` 均为 `NOT_EXECUTED`。读取 JSON 或通过下面的脚本，**不证明**认证、数据库授权、行锁、并发或事务回滚已经生效。逻辑身份没有密码、token 或实际账户，须由教师在隔离环境创建并映射；不得复制原系统账户。

## 第一条贯通和完整目录

`catalog.json` 始终是完整样本，不为第一条贯通改写文件。`selectors.json` 规定选取规则；本轮后端 `CatalogReader` 按其中 first-chain 的相同 ID 固定选取，并没有读取 selectors 文件，也尚无运行时 full 切换：

1. `first-chain` 选 `teaching_space_01`，并仅选 `teaching_env_01`、`teaching_energy_01`；两设备在线值依次为 Boolean `true` 和 `null`。
2. 保留被选设备的全部 tags，再按 `deviceId` 过滤 points，得到 1 空间、2 设备、4 点。第 03 章示例只有一个 tag 的节选不能当完整目录。
3. `full` 规定保留全部 4 空间、16 设备、28 点；`teaching_facility_04.online=false`，供后续 full Provider 与完整页面实现三种通信状态。该数据规则不表示本轮已实现 full 接口。

`online`、`switchOn` 与点质量是不同字段；不能由功率为零推断离线，也不能由通信状态推断开关状态。本样本没有远端控制能力。空间本地映射初始为 `null`；真实创建教学校园、楼栋与绑定后，由独立教学数据库承载映射，不回写本文件。

读取接口外层仍为 `{code:0,message,data}`。`/campus/spaces` 和 `/campus/devices` 的 data 是 `{items,observedAt}`，不能直接返回整个 catalog，也不能为了带来源给 Device 新增字段。`catalog.schemaVersion` 是资源格式版本，不是事件的 `version`。具体 Provider 方法、读响应包装和配置入口由教学后端实现并另行实测。

## 各类点与单位

每个空间放置每类设备各一台。下列 tagId 在同类的四台设备上重复使用，唯一点由 `deviceId + tagId` 决定。

| category / tableId | tagId | 单位 | 每台点数 |
| --- | --- | --- | ---: |
| environment / teaching_environment | temperature；humidity | °C；% | 2 |
| energy / teaching_energy | voltage；power | V；kW | 2 |
| facility / teaching_facility | run_state；equipment_temperature | 空字符串；°C | 2 |
| lighting / teaching_lighting | illuminance | lux | 1 |

合计 `4 × (2+2+2+1) = 28`。`run_state` 是本教学样本的数值状态码，0 表示停止、1 表示运行，空单位不是缺失单位；它与 Boolean `switchOn` 分开。能源只有电压 V 和功率 kW，没有 kWh、费用或节能率。完整目录中的 `teaching_energy_02/power=0` 与 `teaching_light_04/illuminance=0` 都是有效零；`teaching_env_04/humidity=null` 是有采样时间但没有数值。

标签在教学版缩短命名，来源映射列在 manifest 中。原模型仅作为点类别和量纲的参考，不导入原平台 projectId、设备 ID、连接地址或访问配置。

## 固定时钟与质量

固定观察时刻为 `1792303200000`，即 `2026-10-18T06:00:00.000Z`（北京时间 2026-10-18 14:00）。这是人工选定的教学时间，不是执行脚本时的墙钟，也不声称当时存在测量。校验和教学 Mock 的相同案例都应使用该时钟；否则经过数天后 fresh 样本会被误算为 stale。

相对该时钟，合法采样恰好 60 秒仍 fresh，超过才 stale；未来恰好 5 秒在容差内，超过才 invalid。`quality-cases.json` 中 raw 可以故意包含字符串、布尔值或非法时间，它不是合法 Point 响应。`expectedQuality` 单列为预期，不能直接当程序计算结果。JSON 中没有 `NaN` 或 `Infinity` 数字；校验脚本另在内存中检查非有限 Number 的分类。

`history-cases.json` 是独立合法响应：四条样本分别为数值、null、0、数值；它不是从当前点值推导出的历史。所有样本时间严格落在查询窗内部，避免在本夹具中擅定端点包含规则。空缺时刻不造行，null 不改零。`issues:[]` 仅表示此合法样本没有异常，不借此冻结异常条目结构。字符串等非法历史输入的处理、排序与多错误优先级仍需 Provider 明确实现。

## 在 Windows 或 macOS 独立校验

需要 Node.js，脚本不依赖 npm 包、数据库、网络或后端服务。先进入本资源工程 `campus-ai-course` 目录，然后运行同一命令：

```sh
node tools/validate-fixtures.mjs
```

退出码 0 表示 JSON、规模、唯一性、外键、标记、单位、固定时间、样本和场景规格内部一致；非零时按报错定位文件。脚本也校验 manifest 中的文件哈希，并用内存损坏样本确认能拒绝重复点、悬空关联、错误单位等问题。它只读取文件，不改写资源、不连接数据库、不执行 HTTP 请求。

本目录是第三轮资源制作结果。课程 `lab_verified` 不因独立夹具校验通过而自动升级；教学工程启动、MySQL 集成、Windows/macOS 干净环境复现均须另有证据。
