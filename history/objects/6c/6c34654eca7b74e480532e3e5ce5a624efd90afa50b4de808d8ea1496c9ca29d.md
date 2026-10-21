# 第 09—12 章只读交叉审阅

审阅日期：2026-10-18（Asia/Shanghai）。版本核对截止：2026-10-18 18:35:16 +08:00。

**结论：已通读四章正文及 13 份 Mermaid 图源，实际看过全部 13 张 PNG，并核对 13 份图注/替代文字元信息。发现 1 项错误码表达需澄清、2 项图文或排版改进；未发现 P0/P1 问题。当前结果支持继续统稿，不代表最终整书排版或教学实验验收通过。**

本轮只新增本交接文件；未修改正文、图源或配图，未启动业务服务、运行软件测试或执行任何教学写入。课程仍为 `DRAFT_WRITTEN`、`lab_verified=false`。

## 审阅依据与方式

- 依据 [教学接口约定](../contracts/教学接口约定.md)、[考核与验收](../04-考核与验收.md)，并对照章节中的实验前提、代码示意、图注和待执行清单。
- 先保存只读审阅所需的临时副本，避免统稿中的并发更新混入同一结论。九张普通图直接打开完整 PNG；图 09-02、11-03、12-02、12-03 分别查看完整长图及原始像素局部，重点核对小字、分支标签、末端箭头和附注。没有用文件存在、XML 检查或联系表代替看图。
- 截止时间再次对比：13 张 PNG 和 13 份图源均与实际看图版本一致。正文期间发生的变化仅为把图源说明改为 PNG、图注和可编辑源链接；这些插图替换差异已逐项阅读。下文正文行号以插图后的版本为准。
- 本次未检查最终 `reading/index.html`、单文件阅读版或打印分页。后续图源/图片哈希改变时，本报告的视觉结论不能直接沿用；修改图和受影响的正文需重新查看。

## 需要处理的具体事项

### R01 · P2 · 图 09-02 应明确区分身份无效与权限不足

定位：[图源](../figure-sources/ch09-02-close-gates.mmd)第 5、8 行，[PNG](../illustrations/ch09-02-close-gates.png)中部的 `401 或 403 拒绝` 节点。

图中“当前身份有效”的否分支与“当前角色与对象范围允许”的否分支共同指向 `401 或 403 拒绝`，没有告诉学生每条分支的确定含义。[教学接口约定](../contracts/教学接口约定.md)第 7 行已分别固定“身份无效 401”和“权限不足 403”。如果按这张图编写断言，容易把任意一个状态码都当成正确结果。

建议把身份无效分支接到 `401 身份无效`，把角色或对象范围拒绝分支接到 `403 权限不足`；也可在两条边上分别标明确定状态码。修改后核对 PNG、图源、替代文字，保留其余关闭门槛。此项是教材图示的明确性问题，本轮没有运行接口，也不据此判断系统实现有缺陷。

### R02 · P3 · 图 10-02 应说明省略了开始处理，避免版本基线误读

定位：[第 10 章](../manuscript/10-设备责任与审计追踪.md)第 126、132、138 行；[图源](../figure-sources/ch10-02-future-assignment.mmd)第 12—15 行；[PNG](../illustrations/ch10-02-future-assignment.png)的 E1 创建与责任改为 B 两步之间。

正文实验第 4 步让 A 开始处理 E1，再存责任变更前基线；按本课程合同，此时 E1 应为 `IN_PROGRESS`、事件 v2。图中则从 E1 创建的 `ASSIGNED`、事件 v1 直接进入责任改为 B，并说明 E1 状态和版本保持。两条演示各自符合“责任变更不改旧事件”，但正文又把图称作“实验的判断基准”，初学者可能把图中 v1 当成第 6 步应回读的版本。

建议补画 A 开始处理及 E1 的 v2，或在图注明确“本图省略开始处理；旧事件不变以责任变更前实际回读基线为准”。同时把图后“只有显式 assign 才改变 E1”收窄为“只有显式 assign 才改变 E1 的负责人”，避免被理解为开始、记录、核实等动作都不会改变事件。

### R03 · P3 · 两个英文标识符发生不自然断行

定位：[图 09-02 PNG](../illustrations/ch09-02-close-gates.png)的版本冲突节点、[图源](../figure-sources/ch09-02-close-gates.mmd)第 10 行；[图 10-03 PNG](../illustrations/ch10-03-responsibility-timeline.png)的当前主记录节点、[图源](../figure-sources/ch10-03-responsibility-timeline.mmd)第 4 行。

原始像素检查确认：`VERSION_CONFLICT` 被拆成 `VERSION_CONFLI` / `CT`；`ownerUid=manager-b` 被拆成 `ownerUid=manager` / `-b`。文字没有丢失，但不利于学生准确识别错误键和 uid。

建议增加节点宽度，或在语义边界主动换行，例如 `409` 与完整错误键分行、`ownerUid=` 与完整 `manager-b` 分行；重新渲染后检查标识符完整性。避免通过整体缩小字号解决。

## 已知排版事项的复核记录

[配图初审通知](figures-ready.md)已登记四张长图的压缩/分组任务。本轮实际看到图 09-02 为 2560×5898、图 11-03 为 2560×5948、图 12-02 为 2560×5052、图 12-03 为 2560×5824，纵向留白和长连线明显。它们当前在完整图与局部放大下可读，未发现内容被画布裁去；最终按书页缩放是否仍可读，需要统稿在布局更新后验证。此项沿用已有任务，不重复记为新语义缺陷。

图 09-01、10-01、11-01、11-04、12-01 也已打开完整 PNG 核对小字；现有原图可辨认，最终页面中的缩放比例尚未验收。图 11-01 存在个别中文词语跨行，但未缺字，不影响本轮识别。

## 逐幅实际看图结果

下表“未见裁切/遮挡”限于本次已查看的图片版本；流程分支上的常规标签、注释虚线和时序生命线均按图源核对。

| 图号 | 实看文件 | 像素 | 实际观察与语义核对 |
| --- | --- | --- | --- |
| 09-01 | [PNG](../illustrations/ch09-01-state-machine.png) | 2560×944 | 已看完整原图。中文、状态名和回到 ASSIGNED 的箭头可读；CLOSED 无修改出口。未见裁切或妨碍阅读的遮挡。 |
| 09-02 | [PNG](../illustrations/ch09-02-close-gates.png) | 2560×5898 | 已看完整长图，并放大身份/权限、版本及条件节点。关闭门槛和事务提交链可追踪；R01、R03 待处理，长图需后续排版复核。 |
| 09-03 | [PNG](../illustrations/ch09-03-recovery-sequence.png) | 2560×3240 | 已看完整原图。UNKNOWN、恢复重置、匹配版本重复恢复、PASS、关闭与 v4→v8 账本一致；未见裁切或箭头压字。 |
| 10-01 | [PNG](../illustrations/ch10-01-owner-event-model.png) | 2560×1054 | 已看完整原图。当前责任、责任历史、事件独立负责人和事件时间线的关系可读；“仅创建时读取并核对资格”未被裁切。 |
| 10-02 | [PNG](../illustrations/ch10-02-future-assignment.png) | 2560×2000 | 已看完整原图。责任 A→B、E1 保持、E2 归 B 的主旨正确；R02 的实验步骤基线需补明。 |
| 10-03 | [PNG](../illustrations/ch10-03-responsibility-timeline.png) | 2560×1156 | 已看完整原图。v0、v1、v2、前后 uid 及旧历史保留关系清楚；R03 的 manager-b 断行需优化。 |
| 11-01 | [PNG](../illustrations/ch11-01-evidence-layers.png) | 2560×1040 | 已看完整原图。各证据层的证明范围可读；真实数据库和 mock 的边界未混淆。未见裁切，最终书页小字需复核。 |
| 11-02 | [PNG](../illustrations/ch11-02-concurrent-updates.png) | 2560×2340 | 已看完整原图。屏障、同版本、行锁等待、n+1、409 和独立连接回读顺序清楚；正文说明胜者不固定，未见图文规则冲突。 |
| 11-03 | [PNG](../illustrations/ch11-03-transaction-rollback.png) | 2560×5948 | 已看完整长图和原始像素局部。真实写入路径、提交前失败、异常回滚、清理前独立连接、基线比较及正向对照均可读；未见裁切，长图排版待复核。 |
| 11-04 | [PNG](../illustrations/ch11-04-debugging-loop.png) | 2560×766 | 已看完整原图。失败保留、假设、最小修复及回归路径可追踪；未见裁切或箭头遮挡，宽图缩入书页后的字号待复核。 |
| 12-01 | [PNG](../illustrations/ch12-01-delivery-flow.png) | 2560×798 | 已看完整原图。源码、构建、独立启动、业务验证、同伴复现分开；未把构建画成验收完成。未见裁切。 |
| 12-02 | [PNG](../illustrations/ch12-02-controlled-change.png) | 2560×5052 | 已看完整长图和原始像素局部。state 合同复用、基线 A/B、失败回路及浏览器验证与正文相符；未见裁切，长图布局待复核。 |
| 12-03 | [PNG](../illustrations/ch12-03-code-data-recovery.png) | 2560×5824 | 已看完整长图和原始像素局部。兼容性确认、代码副本回退、教师审查的数据恢复及重新核验路径分明；未见裁切，长图布局待复核。 |

## 正文规则与证据边界

- 第 09 章区分事件处置状态与来源状态；恢复不等于核实，核实不等于关闭。NOTE、恢复与核实的有效时间、非空结论、权限和版本条件齐备。重新分派后重新开始，旧记录保留；正文没有额外发明“新负责人必须重新写一条 NOTE”规则。
- 第 10 章把设备当前责任与事件负责人分开；初始化责任 v0、责任版本与事件版本独立，历史保留。资格失效夹具明确待教师制作，未臆造禁用账户接口。
- 第 11 章以真实 MySQL 验证并发与事务；目标负责人 A/B 和实际写入者 ADMIN 分开，不预先固定并发胜者。故障注入发生在提交前，清理前用独立连接检查，并有正向对照；没有用测试框架外层回滚冒充业务事务回滚。
- 第 12 章区分构建、启动、业务验证和他人复现；条件式命令未声称已执行。筛选需求复用 state，代码回退与数据恢复分开，并保留隔离环境和新增迁移要求。
- 四章的实验结果均标为教学样例或待执行预期，13 份图元信息均为 `TEACHING_SCHEMATIC`、`labVerified=false`。未发现把模拟读数、UNKNOWN 核实或未执行操作包装成已验证事实；本次审稿也不产生任何软件实验通过结论。

## 审阅版本记录

正文最初全文阅读后，已复核统稿插图差异；下列为最终核对过的正文 SHA-256。

| 正文 | SHA-256 |
| --- | --- |
| [09-演练事件与状态机.md](../manuscript/09-演练事件与状态机.md) | `c2ef8f4979328c5a9fcc7b9b0b2b9bc9d37725d405fd476f33e037cfc3356c3e` |
| [10-设备责任与审计追踪.md](../manuscript/10-设备责任与审计追踪.md) | `11021b9c8047cc35c9ce54be1fab3b495d9999c4e99645539281e244080ed108` |
| [11-测试调试与质量改进.md](../manuscript/11-测试调试与质量改进.md) | `af9ffafc43a313ac4e0f8b58522c0704ccf54834b3ecb5225e21ae52aaf8bfae` |
| [12-构建交付变更与答辩.md](../manuscript/12-构建交付变更与答辩.md) | `23520c383bcaf6abace8192d821e40932fc5974500fb7c06b8423d7a82b8ffe0` |

以下是实际看图版本的 PNG 与图源 SHA-256。每个图号对应上表同名文件；图源扩展名均为 `.mmd`。

- [ch09-01-state-machine 图源](../figure-sources/ch09-01-state-machine.mmd)

  PNG：`15daa2ff002d6cc526c53178fc7eea8c34df96a2c439795fb85610a3d1b49ac3`  
  图源：`39217452ef34cc8f2148364a5d9bf44487ed04cf1523226f2ed62bd5dec47b3d`

- [ch09-02-close-gates 图源](../figure-sources/ch09-02-close-gates.mmd)

  PNG：`83c7c7dba808a4f45d026f1825a7d8a07a66d6667c9d8b9349c8c22306687ff4`  
  图源：`0b19b5266e1cc491390fb5691b2e72f477b2fbe0c2aeeeac48440e0bd8735a35`

- [ch09-03-recovery-sequence 图源](../figure-sources/ch09-03-recovery-sequence.mmd)

  PNG：`fefee02c110551ec2f4b1de1141d977ad698b0c89f15fb8a588bf98787de3577`  
  图源：`8c189eb71dd4d9905f5a3b35c0a1ac968d1cd024e1f97f695bb6d792d1aba72c`

- [ch10-01-owner-event-model 图源](../figure-sources/ch10-01-owner-event-model.mmd)

  PNG：`374e4c31d3afa60f13fb272c5f5abbdb84478528df39560a33aae5c15705ed01`  
  图源：`833ddbccc57f4e573580c17b8f0e2e66e3abda0a8fadbc6b57f3fd86d93d35f8`

- [ch10-02-future-assignment 图源](../figure-sources/ch10-02-future-assignment.mmd)

  PNG：`0efd47f421984c67fb341ec243f30ca7adeb7593268b523011fde248fe494cd8`  
  图源：`d611ee2ccf35dc936896aa33a7d8f7e350cabf3f976b82e105d4b2b2ad98e484`

- [ch10-03-responsibility-timeline 图源](../figure-sources/ch10-03-responsibility-timeline.mmd)

  PNG：`a95a552c4f4cb28cbd84d69ea1e2ef427e7b8618d3e779a9b63f909aa7f0a12c`  
  图源：`721536729c204fb26273a7c0a898bf708601eec3814e19b3741c35811eee39ca`

- [ch11-01-evidence-layers 图源](../figure-sources/ch11-01-evidence-layers.mmd)

  PNG：`946845ef4f24a0d52bd5ebd5d16de6068da101c5478cf14809b83c5ead06b4f3`  
  图源：`64be72660c2bdf4ac764a63dd5ebdc5e9b59bb6b5138a0616086cd3674a5ef42`

- [ch11-02-concurrent-updates 图源](../figure-sources/ch11-02-concurrent-updates.mmd)

  PNG：`0b4ccca9da06f5f3b1da7ba53d22b27da362666cedfe01e02d2e2326f66dbca1`  
  图源：`7d9597ff3c6658a1725f78a9a2b3c61e0b38abb27a7feaae533f2cc1ff4b866f`

- [ch11-03-transaction-rollback 图源](../figure-sources/ch11-03-transaction-rollback.mmd)

  PNG：`f7bd766424fe063e46743baed45a37ccf0d46ce7a4bfd1251d599987380fdb22`  
  图源：`20b9a5d96c9439035b59402799676061db7d0ad53fd8d97e043a593e331812b4`

- [ch11-04-debugging-loop 图源](../figure-sources/ch11-04-debugging-loop.mmd)

  PNG：`086e580ebe7bfed6cc3cb8a40fab5d2fefbe8592ad397dd546cc1e18d1edffc2`  
  图源：`ac97133357522cde19ee17e1b10061f0df4b8af6bd739461e568e01d702d8a48`

- [ch12-01-delivery-flow 图源](../figure-sources/ch12-01-delivery-flow.mmd)

  PNG：`354621cfd845754532eb70dc8e7e43f6dd444d50c9980eaf90d6ccdf4275aa31`  
  图源：`862d002f7be346e7c57e57ce15659403c4313ce0faa4838d33f51bf52699275a`

- [ch12-02-controlled-change 图源](../figure-sources/ch12-02-controlled-change.mmd)

  PNG：`3cc097c876099b690a0a32409c57bade05ca1d018b8fa1fb11e690e1c328bd13`  
  图源：`29c51fcdad293bd2fe2472ecc737450734ad6d7746c8fb3cb8a8849532f8c3c1`

- [ch12-03-code-data-recovery 图源](../figure-sources/ch12-03-code-data-recovery.mmd)

  PNG：`b15ec192b9ce8be07e6f2392db83bdfcf9a0ce822f740bc2ca0fafcbe00a5d36`  
  图源：`4d01037f3bcba9e7e14998871300c50a66cb34d52c5fd4efd31ec1dc55bd9835`

统稿交接建议：先落实 R01，随图文整理处理 R02/R03；重新渲染后复看改动图，并在最终阅读版检查长图、宽图的实际字号、连线和分页。后续是否关闭这些事项，应由修改后的实看结果决定。
