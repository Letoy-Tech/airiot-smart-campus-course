# 第 05—08 章交叉审阅

- 审阅日期：2026-10-18（Asia/Shanghai）。
- 快照时间：2026-10-18T18:33:34+08:00。
- 结论：全文、图源及 12/12 幅 PNG 已完成只读审阅；未发现权限、版本、数据质量或状态机规则上的阻塞问题。发现 1 处图文指代不一致、3 处排版问题，建议统稿修正后冻结阅读版。
- 范围：第 05—08 章全文、对应 9 份 Mermaid 和 3 份 SVG 图源、全部 12 幅 PNG 原图。已实际打开逐图查看，未将文件存在或渲染日志当作视觉检查。
- 已读取 `handoffs/figures-ready.md`；统稿插图后的文字与 `tools/.cache/phase2-baseline-20261018T182805/` 基线作了比对，本组变化为章标题间距、图注组织和插图形式，没有新增业务规则。
- 本报告只证明图文审阅完成。未运行教学软件、接口、数据库或业务服务；课程实验继续 `lab_verified=false`。本次仅写本交接单，未修改正文或图源。

## 需要统稿处理的具体问题

### E1：正文引用了图中不存在的标签

- 位置：`manuscript/08-登录角色与权限验证.md` 第 53 行；对应 `figure-sources/ch08-01-role-scope.mmd` 第 7 行及 `illustrations/ch08-01-role-scope.png`。
- 原文：“图中的‘管理员全部事件’不是绕过状态机。”
- 实际图中是 `ADMIN` 经“处置请求”箭头进入“事件业务检查”，没有“管理员全部事件”这个标签。规则本身正确，但读者无法在图中找到被引号引用的文字。
- 建议将首句改为：“图中的管理员处置路径仍进入业务检查，并不绕过状态机。”保留后续未分派、已关闭和旧版本的例子。
- 复核标准：正文引用能直接对应图中节点或箭头，仍清楚说明管理员也受业务条件约束。

### E2：角色代码被拆成两行

- 位置：`figure-sources/ch08-01-role-scope.mmd` 第 4 行，`Roles --> M[CAMPUS_MANAGER]`；成品 `illustrations/ch08-01-role-scope.png` 中上方的管理人员节点。
- 实际显示为第一行 `CAMPUS_MANAGE`、第二行单独 `R`。完整字符均存在，但初学者需要拼接才能识别合同中的角色代码。
- 建议加宽节点、调整该节点字号或设置该代码不换行，完整保留 `CAMPUS_MANAGER`。不要为适应版面改动角色值。
- 复核标准：完整角色代码在同一行可读，与正文角色表一致。

### E3：中文节点出现末字孤行

- 位置：`figure-sources/ch08-02-denial-path.mmd` 第 10 行，`Execute[执行并返回服务端事实]`；成品 `illustrations/ch08-02-denial-path.png` 右下角。
- 实际显示为“执行并返回服务端事”及下一行独立的“实”。没有裁掉文字，但拆开了“事实”这个词。
- 建议显式分为“执行并返回／服务端事实”两行，或适当加宽节点。
- 复核标准：没有孤立末字，成功分支含义与原稿相同。

### E4：设备标识边标签与连线重叠

- 位置：`figure-sources/ch06-02-components-state.mmd` 第 9 行，`List -->|deviceId| Detail[详情路由]`；成品 `illustrations/ch06-02-components-state.png` 左下方。
- “列表或卡片组件”到“详情路由”的斜线和竖线折点落在 `deviceId` 标签处，线条可见地穿过标签字形。
- 建议为边标签设置不透明背景及少量内边距，或将标签移到连线旁；保持箭头仍指向详情路由。
- 复核标准：完整 `deviceId` 不被线条穿过，箭头方向可追踪。图 08-01、08-02 的部分“处置请求”“是／否”标签也靠在线条上，统稿若统一处理边标签背景，可一并复核。

## 逐图实际查看清单

以下每项均已打开对应 PNG 原图，并与图源、正文说明交叉核对。没有发现画布边界裁切或中文缺字。

| 图号及成品 | 实际查看的重点 | 结论 |
| --- | --- | --- |
| [05-01](../illustrations/ch05-01-device-request.png) | 请求经 Controller、Service、CampusAccess、Provider；权限先于受保护数据返回；消息文字与箭头 | 无阻塞，未出现前端直连来源的箭头 |
| [05-02](../illustrations/ch05-02-space-relations.png) | 来源目录、本地校园楼栋与绑定；箭头为引用方向；虚线跨来源关联；floor 归属 | 无阻塞，未画成外部数据库外键 |
| [05-03](../illustrations/ch05-03-binding-readback.png) | 管理授权、来源及本地校验、本地写入、成功响应后独立 GET 回读 | 无阻塞，未画出修改上游空间的动作 |
| [06-01](../illustrations/ch06-01-device-wireframe.png) | 桌面表格、窄屏卡片、中文、来源标识、结果数量、未知通信状态 | 无阻塞；正文明确两条样例不代表十六台设备已经加载 |
| [06-02](../illustrations/ch06-02-components-state.png) | 原始资源与筛选计算、列表和数量一致、稳定标识进入详情 | 语义无阻塞；边标签压线见 E4 |
| [06-03](../illustrations/ch06-03-page-states.png) | 加载、首次失败、空目录、筛选无匹配、再次读取失败与旧快照 | 无阻塞，分支及反馈可追踪；长图全部查看 |
| [07-01](../illustrations/ch07-01-quality-cases.png) | 合法零、60000/60001 毫秒、未来 5000/5001 毫秒、missing、invalid、数值字符串 | 无阻塞，阈值与正文一致 |
| [07-02](../illustrations/ch07-02-history-gaps.png) | 四条原始样本、有效零、null 断点、1.2/0.9 kW、秒与 epoch 毫秒区分 | 无阻塞；缺失处没有跨接，示意来源说明完整 |
| [07-03](../illustrations/ch07-03-refresh-lifecycle.png) | 请求完成后再等 15 秒；离页取消与迟到响应失效 | 无阻塞，未画成每 15 秒无条件启动请求 |
| [08-01](../illustrations/ch08-01-role-scope.png) | 三角色、本人已分派范围、管理员仍经业务条件、canControl=false | 语义无阻塞；正文指代及代码换行见 E1、E2 |
| [08-02](../illustrations/ch08-02-denial-path.png) | 身份、角色、对象范围、业务条件；401/403/400/404/409 与成功路径 | 语义无阻塞；末字孤行见 E3；长图全部查看 |
| [08-03](../illustrations/ch08-03-identity-race.png) | 管理员旧请求、退出与查看者身份、生命周期标识、丢弃旧能力 | 无阻塞，图中先后关系与正文一致 |

## 关键语义与教学表述复核

- 第 05 章保留 `online=null`、`communicationTime=null`；本地空间绑定与来源目录写入边界明确；明确映射接口没有 `expectedVersion`，后续事件与责任更新才依合同使用。独立回读失败没有被描述成事务必然回滚，也没有要求自动重放写入。
- 第 06 章把原始记录、筛选结果和页面反馈分开解释，数量来自实际结果；通信三态没有把未知改为离线；详情使用稳定设备标识，没有臆造后端详情接口。首次失败与成功空目录没有混用。
- 第 07 章区分来源、对象模拟标记、观察时间、采样时间和质量；保留合法零与空值；质量阈值一致。没有把 V/kW 直接换算成 kWh、费用或节能率。历史曲线没有补造样本，截断含义与空结果、失败不同，刷新和迟到响应清理有解释。
- 第 08 章明确服务端最终授权、当前有效角色、本人已分派范围，以及 Boolean `true` 才授予前端能力。管理员仍受状态、恢复、核实和版本条件约束；`sessionEpoch` 明确是前端生命周期标识，不是会话凭据或 `expectedVersion`。后续事件事务及并发实验被标明为后续工作。
- 四章都有学习目标、分模块讲解、图后解释、最小实验、人工检查点及练习答案要点。代码片段、拟定方法、待制作教师资源与待执行预期有清楚标识；未发现把本轮静态审阅误写成软件已运行或实验已验收的结论。
- 本次没有重复软件运行测试；最终阅读版的页面缩放、分页和插图后整体版式仍由统稿验收。

## 审阅快照 SHA-256

本表记录检查时的文件内容，供统稿在后续重渲染后定位本报告适用版本。修订后应按变更重新查看相应 PNG，不能将本报告自动套用到新图。

| 文件 | SHA-256 | PNG 像素 |
| --- | --- | --- |
| `manuscript/05-后端空间与设备接口.md` | `268986bcc5a44e6c5ed02495d90ae5ea831f07166989539ae2c96e40b17d75c2` | — |
| `manuscript/06-前端设备台账与自主UI.md` | `1a0a144cac6b5e42b714b5f574c890fe3b5bf681e79e711d5706a077b61c0759` | — |
| `manuscript/07-实时监测历史与数据质量.md` | `6c19e5d38576df82d54f58e461f6cda26c0d5121783c1f18f05e3cab2c1b77b3` | — |
| `manuscript/08-登录角色与权限验证.md` | `4af224c6b2d440d3ae0c4b585348b3c4e8a5c28163204442692653f675becbb8` | — |
| `figure-sources/ch05-01-device-request.mmd` | `1f422324c6d6762188ab820bfe3682674439503a8494973d94500b89baf4ad37` | — |
| `figure-sources/ch05-02-space-relations.mmd` | `23a633459bfc261202c76dbae13d8a078a03fea3c7fe2b57b76a8225522b669e` | — |
| `figure-sources/ch05-03-binding-readback.mmd` | `065774bb6283c58bcb97356c20194e0b8924681dc3403287747ab05e6f658511` | — |
| `figure-sources/ch06-01-device-wireframe.svg` | `135277a087dffe3a82be5de98579ce5ec49c030da798aa506fbd037604ce469d` | — |
| `figure-sources/ch06-02-components-state.mmd` | `cd65e1192bd0ddac7ef02d9923ac4e2a89d447656a4e244e4a113bc432f827c2` | — |
| `figure-sources/ch06-03-page-states.mmd` | `72a2d99f3a68bf86f256d459a82ea09533da42ae2fd02b6411d1b355e909ff5b` | — |
| `figure-sources/ch07-01-quality-cases.svg` | `0352ec27a9a58985353764c18b88c9931d885af96ddee99cfc24fa67db00bbfd` | — |
| `figure-sources/ch07-02-history-gaps.svg` | `f547fb82bf24e4863c40ff36b8f0afa32f4b5c027f5db58a02cc01ba000a803e` | — |
| `figure-sources/ch07-03-refresh-lifecycle.mmd` | `3c42357678211f59da8be8dc86076009f3df7e086e89daf1ba32d4c443f830ff` | — |
| `figure-sources/ch08-01-role-scope.mmd` | `f35607b088ebe3830c89710eafefcbd546b88cbd4816c1f3a24cbee6d9e395a8` | — |
| `figure-sources/ch08-02-denial-path.mmd` | `6f798ac549f8bccdff19e9f5c73b037c57e6fb0ac8250646808de99364f21943` | — |
| `figure-sources/ch08-03-identity-race.mmd` | `13948d6ad0cae2259691d298baeb1859e0f08fa20fecd6018ca1aedfe2832375` | — |
| `illustrations/ch05-01-device-request.png` | `8074d043724f78624078f74f8f429f0d89264c27384085138eb48ef1b4bb754e` | 2560 × 1644 |
| `illustrations/ch05-02-space-relations.png` | `de85d7cad02e7c62a538c5e2c60b224f0fb8648e515bd4e3ab1b452feebd30a9` | 2560 × 1182 |
| `illustrations/ch05-03-binding-readback.png` | `86dcd9d92cf6d23c5103c6c945027173ebb6c2edac176e5587900343ca8644db` | 2560 × 2070 |
| `illustrations/ch06-01-device-wireframe.png` | `e6918999774c111d7439dada2ea24e1ac91bb466e1f9117899f744ac4b65a567` | 2560 × 1640 |
| `illustrations/ch06-02-components-state.png` | `bebc4d1b27022801d639b216a61481053c0f79574d33cd3a699cd4d2617f55ad` | 2560 × 2584 |
| `illustrations/ch06-03-page-states.png` | `002c2e05a4e5b08d55bde4e724bb161fcb84e569519a9350eea61690aaa705d6` | 2560 × 4252 |
| `illustrations/ch07-01-quality-cases.png` | `9b4e9b42e033aed0e507a6ce52267bad8b7509c3208d198ef11f3fbe6a0cb251` | 2560 × 1680 |
| `illustrations/ch07-02-history-gaps.png` | `740e2b588254e51f3c4722c5fd4b23da697601df67f03c600a06209461ab9ead` | 2560 × 1600 |
| `illustrations/ch07-03-refresh-lifecycle.png` | `fd06e754347f1c3df0e199bfc9ca16b6424795866d96ebe067e48a910d37bd91` | 2560 × 2110 |
| `illustrations/ch08-01-role-scope.png` | `a15f918ffe076547a8c3305f803695e4332eb7996324d8a6121871e77d9df8d6` | 2560 × 2988 |
| `illustrations/ch08-02-denial-path.png` | `85173fdb0c79d7b2d644adcb3b72add50da1b6dfd54b5b91e47cb1de2eb8c0e4` | 2560 × 4418 |
| `illustrations/ch08-03-identity-race.png` | `454df10e0cded1c9b8c693f97028ec68e86b39bd919b891e5fcbc27821fa6f93` | 2560 × 2518 |

