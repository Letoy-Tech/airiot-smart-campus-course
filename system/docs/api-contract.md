# 智慧校园接口合同

2026-10-04 用户确认：本地交付，MG → BE → AIRIOT；管理员、校园管理人员、只读查看者，无审批。演示项目固定为 `000000000000000000000001`。所有远端对象仍标为模拟。

2026-10-05 学校展示版本新增独立本地 DEMO 运营事件与设备责任人。AIRIOT 原始报警接口不变，不导入或改写上游报警。本合同描述已实现接口；部署和实际验收状态以独立交付报告为准。

BE 返回现有 `ApiResponse`：`{code:0,message,data}`。以下接口路径均为 BE 相对路径；本地 MG 的 `/api` 由 Vite 代理并去掉前缀，学校展示部署的 `/campus-demo/api/` 由 Nginx 代理到专属 BE 并去掉该前缀。上游鉴权异常应转为 502/503 的业务错误，不能返回 MG 会话 401。以下时间统一为 epoch 毫秒，未提供的可空字段为 null。

## 角色与能力

`GET /campus/capabilities` → `{roles:string[],canRead:boolean,canControl:boolean,canAdmin:boolean,canAudit:boolean,canHandleAlarms:boolean,canAssignAlarms:boolean,canRunDemoScenarios:boolean}`。

现有 SUPER_ADMIN/ADMIN 可管理；新角色 `CAMPUS_MANAGER` 读取和模拟控制；`CAMPUS_VIEWER` 只读。管理者不可管理账户/角色/接入秘密，审计仅管理员。BE 强制授权；MG 依能力显示入口。

| 新运营能力 | SUPER_ADMIN / ADMIN | CAMPUS_MANAGER | CAMPUS_VIEWER |
| --- | --- | --- | --- |
| 读取事件、时间线、设备责任人及候选处理人员 | 可以 | 可以 | 可以 |
| `canHandleAlarms`：开始处理、处置记录、核实、关闭 | 全部事件 | 仅分派给自己的事件 | 不可以 |
| `canAssignAlarms`：指派事件、配置设备责任人 | 可以 | 不可以 | 不可以 |
| `canRunDemoScenarios`：触发场景、模拟来源恢复 | 可以 | 不可以 | 不可以 |

能力依据当前启用账户及启用角色，禁用、锁定或撤销角色即时影响后续请求。ROOT 组和 JWT 中的旧权限不能代替数据库当前角色。`canControl` 同时要求允许控制的角色和 `campus.airiot.control-enabled=true`；学校展示将该配置设为 false，因此所有角色返回 `canControl=false`，MG 隐藏控制表单，BE 也拒绝控制请求。读取与运营事件处理仍按角色独立授权，不因禁控丢失。`campus.demo.enabled` 单独决定场景创建及模拟来源恢复是否启用。

## 空间、设备、监控

`GET /campus/overview` → `{source:"AIRIOT",projectId,observedAt,simulated:true,spaces:Space[],devices:Device[],points:Point[],issues:Issue[],completeness:{expectedSpaces:4,expectedDevices:16,expectedPoints:28,actualSpaces,actualDevices,actualPoints}}`。

Space：`{id,name,type:string|null,campusId:string|null,buildingId:string|null,floor:string|null}`。
Device：`{id,tableId,name,category:"environment"|"energy"|"facility"|"lighting",spaceId:string|null,spaceName:string|null,online:boolean|null,communicationTime:number|null,simulated:true,switchOn:boolean|null,tags:Tag[]}`。
Tag：`{id,name,unit}`。Point：`{deviceId,tableId,tagId,value:number|null,time:number|null,quality:"fresh"|"stale"|"missing"|"invalid",unit}`。
Issue：`{code,message,scope}`。

`GET /campus/spaces` → `{items:Space[],observedAt}`；`GET /campus/devices` → `{items:Device[],observedAt}`。业务页面可以直接用 overview 的真实对象，严禁将期望数填成实际数。空间字段缺失时保留 null，校园/楼栋通过独立本地映射管理，不写 AIRIOT 模型。加载失败须明确显示不可用，未加载值不当作0或关闭。

`GET /campus/locations` → `{campuses:[{id,name}],buildings:[{id,campusId,name}],bindings:[{spaceId,buildingId,floor}]}`。
`POST /campus/locations/campuses` `{name}`；`POST /campus/locations/buildings` `{campusId,name}`；`PUT /campus/locations/spaces/{spaceId}` `{buildingId,floor}`。仅管理员写；初始为空，不伪造真实校园/楼栋。

## 原始历史与报警

`GET /campus/history?deviceId=…&tagId=…&from=…&to=…` → `{source:"AIRIOT",deviceId,tagId,unit,from,to,observedAt,samples:[{time,value}],truncated:boolean,issues:Issue[]}`。from/to 毫秒；限制查询跨度与样本数，原始样本不补零/插值。仅查询四类16个既有设备的合法点。能源只有 V/kW，不能产生 kWh 或节能率。

`GET /campus/alarms?limit=50&skip=0` → `{items:[{id,deviceId:string|null,deviceName:string|null,tableId:string|null,tagId:string|null,message,time:number|null,recoveryTime:number|null,status:string,level:string,simulated:true}],total:number|null,observedAt,issues:Issue[]}`。status/level 保存实际上游枚举，待实测映射；仅读取，不确认/归档/删除报警、不发送通知。

## 独立本地 DEMO 运营事件

`/campus/alarm-cases` 只持久化本地 DEMO 场景，来源为 `sourceType:"DEMO"`、`sourceScope:"LOCAL_DEMO"`。事件可关联既有模拟设备，但 message 明确说明不是该设备实际异常。它不进入 `/campus/alarms`，不改变 AIRIOT 报警、遥测或开关，不触发外部通知。本轮没有上游报警导入、真实来源恢复核实或真实硬件控制能力。

AlarmCase 字段：

```text
{
  id, sourceType:"DEMO", sourceScope:"LOCAL_DEMO", sourceId, scenario,
  simulated:true, deviceId, deviceName, message, level:"DEMO_NOTICE", occurredAt,
  sourceState:"ACTIVE"|"RECOVERED"|"UNKNOWN", sourceRawStatus,
  sourceRecoveredAt:number|null, sourceObservedAt, sourceVerifiedAt:number|null,
  sourceCheckOutcome:"PENDING"|"PASS"|"UNKNOWN",
  state:"NEW"|"ASSIGNED"|"IN_PROGRESS"|"CLOSED",
  assigneeUid:string|null, assigneeName:string|null,
  createdAt, updatedAt, closedAt:number|null, disposition:string|null, version:number
}
```

列表不含 timeline；详情及写操作结果在相同字段上增加 `timeline:AlarmCaseEvent[]`，按 `caseVersion`、id 排序。

AlarmCaseEvent：`{id,caseId,action,actorUid,actorName,note,fromState:string|null,toState,previousAssigneeUid:string|null,assigneeUid:string|null,sourceState,createdAt,caseVersion}`。action 为 `DEMO_TRIGGER | ASSIGN | START | NOTE | DEMO_RECOVER | VERIFY_RECOVERY | CLOSE`。actor、时间及来源字段均由服务端生成。

| 接口 | 请求与结果 |
| --- | --- |
| `GET /campus/alarm-cases` | 可选筛选 `sourceType,state,assigneeUid`，默认 `limit=50,skip=0`；返回 `{items:AlarmCase[],total:number,observedAt}` |
| `GET /campus/alarm-cases/{id}` | 返回含 timeline 的事件详情；不存在返回404 |
| `GET /campus/alarm-cases/handlers` | 返回 `{items:[{uid,displayName}],currentUid}`；仅启用、未锁定且具有启用 SUPER_ADMIN/ADMIN/CAMPUS_MANAGER 角色的人员，不返回用户实体或凭据 |
| `POST /campus/alarm-cases/{id}/assign` | `{assigneeUid,note,expectedVersion}`；仅管理员，可指派或重新指派未关闭事件，结果 state 为 `ASSIGNED` |
| `POST /campus/alarm-cases/{id}/start` | `{note,expectedVersion}`；只允许已有负责人且 state 为 `ASSIGNED`，转为 `IN_PROGRESS` |
| `POST /campus/alarm-cases/{id}/notes` | `{note,expectedVersion}`；只允许 `IN_PROGRESS`，追加处置记录，状态保持不变 |
| `POST /campus/alarm-cases/{id}/verify-recovery` | `{expectedVersion}`；服务端核实本地 DEMO 来源，不能提交客户端恢复结论 |
| `POST /campus/alarm-cases/{id}/close` | `{disposition,expectedVersion}`；满足全部关闭条件后转为 `CLOSED` |

列表 `limit` 为1–100、`skip` 为0–10000；sourceType 筛选仅接受 DEMO/AIRIOT，state 筛选仅接受上述四种处置状态。本轮没有 AIRIOT 事件登记路径，选择 AIRIOT 不会将原始报警自动导入为处置事件。

处置状态与来源状态各自独立。事件初始为 `NEW`，若有效设备责任人存在则自动 `ASSIGNED`。重新指派会将未关闭事件恢复为 `ASSIGNED`，保留旧处置记录，新负责人需要重新开始处理。来源恢复不会自动关闭；处置关闭也不会写上游恢复状态。已关闭事件禁止继续修改。

关闭必须同时满足：

- `state="IN_PROGRESS"`，且时间线已有至少一条 `NOTE`。
- 来源确为本地 DEMO，`sourceState="RECOVERED"`、`sourceRawStatus="DEMO_RECOVERED"`，服务端恢复时间不早于发生时间。
- 服务端独立核实结果为 `sourceCheckOutcome="PASS"`，`sourceVerifiedAt` 非空且不早于恢复时间。
- 请求提供非空 disposition，操作者具备权限，expectedVersion 与当前版本一致。

`verify-recovery` 只核实本地演示来源：未恢复返回 `UNKNOWN`、sourceVerifiedAt 为 null，并记录核实动作；恢复后返回 `PASS` 及服务端核实时间。它不是实际 AIRIOT 报警或物理设备恢复证明。

## DEMO 场景开关与恢复

`GET /campus/demo/status` → `{enabled:boolean,label:"本地场景演示 · 非实时设备报警",scenarios:[{id,name,deviceId,description}],limitations:string[]}`。所有校园读取角色可查看。

| 场景 id | 名称 | 关联模拟设备 |
| --- | --- | --- |
| `temperature-patrol` | 温度巡查 | `env_demo_01` |
| `communication-patrol` | 设备通信巡查 | `facility_demo_01` |
| `lighting-patrol` | 照明巡查 | `light_demo_01` |

`POST /campus/demo-alarm-scenarios/{scenario}/trigger`：仅管理员，请求无 body 或 `{}`，不允许自定义来源、设备、内容。返回新事件详情，每次生成独立事件 id/sourceId，初始 version 为1，包含 DEMO_TRIGGER 时间线；保留此前全部历史。若关联设备已配置有效责任人，则按当前人员资格自动指派；责任人禁用、锁定或失去处理角色时不自动指派，并在创建时间线说明。

`POST /campus/demo-alarm-events/{id}/recover` `{expectedVersion}`：路径 id 是 **AlarmCase.id**，版本是该事件 version。仅管理员，来源必须为本地 DEMO；将 ACTIVE 改为 RECOVERED，设置服务端演示恢复时间和 `DEMO_RECOVERED`，清空 sourceVerifiedAt，并将核实结果设为 PENDING。事件的处置 state 不变，追加 DEMO_RECOVER 时间线。对已恢复且版本匹配的未关闭事件重复调用返回当前详情，不重复改版本或追加恢复事件。

`campus.demo.enabled` 默认 false；关闭时场景触发和模拟来源恢复返回503 `DEMO_DISABLED`。该开关不删除已有记录。学校展示启用此本地 DEMO 开关，同时保持 `campus.airiot.control-enabled=false`；两个开关互不代替。

## 设备责任人

仅为现有16个批准模拟设备建立本地责任关系，不修改 AIRIOT 模型，也不扩展为任意设备纳管。

DeviceOwner：`{deviceId,ownerUid:string|null,ownerName:string|null,version:number,updatedAt:number|null}`。初始未配置的设备仍有责任行，ownerUid/ownerName/updatedAt 为 null，version 为0。

`GET /campus/device-owners` → `{items:DeviceOwner[],observedAt}`；按 deviceId 排序。

`GET /campus/device-owners/{deviceId}` → 单个 DeviceOwner 加 `timeline:DeviceOwnerEvent[]`。DeviceOwnerEvent：`{id,deviceId,actorUid,actorName,note,previousOwnerUid:string|null,ownerUid,createdAt,version}`，按 version、id 排序。

`PUT /campus/device-owners/{deviceId}` `{ownerUid,note,expectedVersion}` → 更新后的 DeviceOwner 及完整 timeline。仅管理员，ownerUid 必须指向当前有效处理人员；首次写传 expectedVersion=0，更新后递增版本。该接口要求明确负责人，不接受 null 清空。责任人更改保留旧责任变更记录，不自动重新指派此前已创建的事件。

## 严格字段、版本与本地事务

新增本地运营接口的 POST/PUT 仅接受各接口列出的字段，拒绝 source、actor、时间、恢复结论等伪造字段及其他未知字段。除空请求场景触发外，expectedVersion 必须为可表示为 long 的非负 JSON 整数，不接受数字字符串、浮点数或 Boolean。负责人 uid 字段必须为1–64字符文字，note 为1–500字符文字，disposition 为1–2000字符文字，去除首尾空白后不能为空。

V10 使用四张独立本地表：`campus_alarm_case`、`campus_alarm_case_event`、`campus_device_owner`、`campus_device_owner_event`。事件来源 `(source_type,source_scope,source_id)` 唯一；事件时间线 `(case_id,case_version)` 唯一；设备责任时间线 `(device_id,version)` 唯一。

修改事件或责任人时在事务内 `SELECT … FOR UPDATE`，比对 expectedVersion，再更新主记录和追加时间线，同一事务提交。版本冲突返回409 `VERSION_CONFLICT`；不满足状态/关闭门槛返回409 `STATE_CONFLICT`。有效修改递增 version，时间线插入失败时主记录修改一并回滚；重复恢复的无变更分支例外。请求格式无效返回400、角色或本人范围不符返回403。响应采用既有安全业务错误，不向前端返回数据库、上游凭据或机器 token。

## 模拟控制和审计

`POST /campus/devices/{deviceId}/simulated-switch` `{on:boolean,reason:string,expectedState:boolean}` → `{auditId,deviceId,before:boolean,requested:boolean,confirmed:boolean,observedAt}`。仅设施/照明8个既有对象；严格 Boolean 字段 `simulated_switch_on`；只有写后 GET 确认才成功。expectedState 不符应返回冲突，不以 HTTP200/PATCH成功代替回读。

`GET /campus/audit?limit=50&skip=0` → `{items:[{id,actorId,actorName,deviceId,tableId,before:boolean|null,requested:boolean,confirmed:boolean|null,outcome,reason,createdAt:number,error:string|null}],total:number}`。成功、失败、回读不一致均入专属DB，不写秘密。管理员可查审计。

## 接入状态

`GET /campus/integrations/airiot/status` → `{configured:boolean,connected:boolean,projectId,baseUrl,identityId:string|null,isSuper:boolean|null,checkedAt:number,controlEnabled:boolean,capabilities:[{name,status:"PASS"|"FAIL"|"PENDING",detail}],message}`。仅管理员；不返回 AppKey/AppSecret/token。状态不等于历史/报警/控制已验收。

## AIRIOT Java 适配接口约定

包 `com.letoy.main.campus.airiot`：`AiriotProperties`（`campus.airiot.*`），`AiriotClient` 公开 `JsonNode records(String table)`, `JsonNode record(String table,String id)`, `JsonNode latest(List<Map<String,String>> refs)`, `JsonNode history(String table,String id,String tag,long from,long to,int limit)`, `JsonNode alarms(int limit,int skip)`, `void patchSwitch(String table,String id,boolean on)`, `Map<String,Object> status()`。

适配层负责固定项目头、token 缓存/刷新、超时、JSON类型核对、分页、秘密脱敏以及失败转换，严格限制远端表/设备/字段。不调用共享服务重启、仿真reload或驱动指令。只有专用应用能成功获取自身 token 后才启用真实连接，不提供 mock fallback。
