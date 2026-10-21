> 发布副本说明：项目标识是合成示例值；未附带可用网关或凭据。实际接入前统一设置固定项目值并执行契约测试，见 [系统 README](../../README.md)。下文历史日期和验收边界保持原记录。

# AIRIOT 后端接入与验证

2026-10-04。此适配层仅服务独立演示项目 `000000000000000000000001`。本地 HTTP 契约测试通过不代表城大部署、专用机器 ACL、历史完整性或模拟控制已验收；这些由实际 MG → BE → AIRIOT 链路单独确认。

## 配置

`AiriotProperties` 与 `AiriotClient` 自动由 Spring 扫描。基础 profile 可引用下面的环境变量；专用应用秘密应保存于仓库外的受限 Spring 配置文件（目录0700、文件0600），通过启动配置导入。不要将真实值放入本文件、前端、源码、命令参数、shell历史或日志。没有凭证时返回明确不可用状态，不提供假数据。

```properties
campus.airiot.base-url=${AIRIOT_BASE_URL:}
campus.airiot.project-id=000000000000000000000001
campus.airiot.app-key=${AIRIOT_APP_KEY:}
campus.airiot.app-secret=${AIRIOT_APP_SECRET:}
campus.airiot.control-enabled=${AIRIOT_CONTROL_ENABLED:false}
campus.airiot.timeout-seconds=8
campus.airiot.page-size=100
campus.airiot.max-pages=100
campus.airiot.max-history-span-hours=168
```

`base-url` 是业务网关前缀，末尾 `/` 自动去除；适配器继续拼接 `/core/...` 或 `/warning/...`。远端要求 HTTPS；HTTP 只允许本地回环的测试桩或本地通道。项目头使用代码内固定项目ID，配置成其他项目会在网络调用前拒绝。`control-enabled` 是本地控制门开关，不能证明上游角色有写权限。

## 合法项目机器身份

1. 通过目标项目原生后台创建专用角色，选择五张校园表的读取、实时/历史与报警读取权限；获授权控制仅允许设施/照明模拟字段所需的记录编辑范围。不要修改旧只读角色或旧应用，不启用动态全选，不赋予共享服务或驱动指令权限。
2. 在该项目“扩展开发 → 扩展应用”注册专用应用，绑定该角色与获授权部门，由平台生成 AppKey/AppSecret。按用户授权将生成结果保存到受限后端配置；不提取管理员会话、cookies、token或浏览器秘密。
3. 适配器调用 `GET /rest/core/auth/token`，以查询参数传 `appkey`、`appsecret`，固定项目头。后续 `Authorization` 直接传返回 token。令牌按 `expiresAt` 缓存，并兼容 epoch 秒与毫秒，临近过期时刷新；401只重新取令牌并重试一次。403不会通过反复刷新解决权限不足。
4. 管理员查看 MG 接入状态，确认应用身份与 `isSuper`，再分别验收记录、28点、历史、报警与控制。该状态仅暴露白名单身份字段；业务能力全部保持 `PENDING`，防止将鉴权成功误写成业务验收。

官方 token 的 `expiresAt` 描述与示例单位不一致，实测时应记录归一化后的过期时间，不保存原始 token。token 的查询参数包含秘密，运维代理及 Java HTTP 调试日志也必须避免记录完整 URI；适配器本身不记录请求、原始响应和含秘密的异常原因。

## 固定对象与读写边界

| 表 | 记录范围 | 点范围 |
|---|---|---|
| `campus_space` | `demo_room_101`–`demo_room_104` | 无 |
| `campus_environment` | `env_demo_01`–`env_demo_04` | `temperature_c`、`humidity_pct` |
| `campus_energy` | `energy_demo_01`–`energy_demo_04` | `voltage_v`、`power_kw` |
| `campus_facility` | `facility_demo_01`–`facility_demo_04` | `run_state`、`equipment_temperature_c` |
| `campus_lighting` | `light_demo_01`–`light_demo_04` | `illuminance_lux` |

这些是接入白名单和期望范围，不是当前读取成功数量。所有对象保持模拟标识。

- `records(table)` 请求记录ID过滤、固定 `project` 字段投影、稳定排序和 `withCount`；投影显式包含名称、模型、在线时间、位置、模拟标记、模拟开关与空间类型。AIRIOT 默认列表只返回元数据，不带投影不能据此判定字段缺失或权限失败。按实际页长推进 `skip`，没有总数时继续到空页。重复页、未知对象、总数变化或安全分页上限会返回错误，不返回部分成功结果。
- `latest(refs)` 仅接受明确的 `tableId/id/tagId` 三元组，不允许 `allTag`。检查返回点属于请求且没有重复；缺失或无效点值交由业务层明确显示质量问题，不替换成0。
- `history(...)` 只查询允许点，最多7天、10000返回行的请求上限；业务层采用1001用于识别1000样本截断。查询使用UTC、`time asc`、明确limit，省略 `group` 和 `fill`。原始 `results/series/columns/values` 保留，业务层按列名读取，不假定列位置。空结果保持空结果。
- `alarms(limit,skip)` 返回 `{items,total}`；total仅取实际 `count` 响应头，缺失时为null。查询使用 `filter.tableId.$in` 与 `filter.uid.$in` 限制四类设备表和16设备；核对返回 `table.id` 与 `uid`/`tableData.id`。当前城大版本的表外键查询使用 `tableId`，不能写 `table.id`。状态/级别保持上游值。真实空数组只能确认当前查询成功、总数为0，非空记录映射仍待验收；接口失败或未知对象不会变成“0报警”。
- `patchSwitch(table,id,on)` 只允许8个设施/照明对象，仅发送 `{"simulated_switch_on": Boolean}`。此方法检查实际 `status:OK`；业务服务仍必须GET目标回读确认Boolean、核对expectedState并记录审计，才能报成功。不会调用物理设备指令、仿真reload或共享服务重启。

上游401/403及协议错误通过 `AiriotException` 映射成502；未配置、禁控、超时、限流及服务不可用映射成503。非法目标是400。异常只有安全代码和固定消息，没有上游body、URI或cause，不能变成MG会话401。

## 验证

```sh
./mvnw -Dtest=AiriotClientTests test
```

17项契约测试使用JDK本地HTTP服务器，验证真实HTTP方法、头、查询体和响应解析，不依赖城大服务、私密凭证或共享设备。覆盖token单位/缓存/刷新、非法范围拒绝、分页完整性、最新值范围、原始历史列序/null、报警状态与范围、PATCH布尔字段、身份白名单，以及HTML/业务错误/网络失败/重定向和异常脱敏。

部署验收还需独立专用应用的允许/拒绝与有效项目之间的隔离测试，16设备28点两轮采样、真实保存窗口的原始历史、报警记录映射、8模拟对象逐步写后回读及不串写。未经这些验收不得将上游能力标为PASS或移除模拟标识。

## 官方依据

- [扩展应用与凭证生成](https://docs.airiot.cn/user-manual/扩展开发/扩展应用/)
- [角色和数据范围](https://docs.airiot.cn/user-manual/权限管理/角色管理/)
- [平台接口调用指南](https://airiot.apifox.cn/doc-4296563)
- [项目token](https://airiot.apifox.cn/api-172107040)、[身份权限](https://airiot.apifox.cn/api-172107041)
- [记录列表](https://airiot.apifox.cn/api-172107298)、[单条记录](https://airiot.apifox.cn/api-172107311)、[普通记录PATCH](https://airiot.apifox.cn/api-172107314)
- [最新值](https://airiot.apifox.cn/api-172107105)、[原始历史](https://airiot.apifox.cn/api-172107108)、[报警](https://airiot.apifox.cn/api-81302955)、[通用query](https://airiot.apifox.cn/doc-2485527)
