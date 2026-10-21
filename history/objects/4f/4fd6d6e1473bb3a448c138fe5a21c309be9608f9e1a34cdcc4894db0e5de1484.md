---
review_scope: manuscript_01_04_and_figures
review_status: COMPLETED_WITH_FINDINGS
reviewed_at: "2026-10-18T18:34:30+08:00"
lab_verified: false
---

# 第 01—04 章图文交叉审阅

审阅完成，发现 **2 项需修正的图形问题、3 项非阻断的排版或说明建议**。在 R1、R2 修正并重新目视检查之前，不宜将这 13 幅图标记为全部视觉验收通过。本报告的完成表示审阅完成，不表示课程实验完成。

本轮仅新增本报告；正文、图源、图片和公共课程文件由统稿会话修改。下文路径相对于本课程目录 `教学/AI编程_智慧校园_48学时/`。

## 审阅范围与实际方法

- 已完整阅读 `manuscript/01—04` 的四篇正文，逐一阅读其 13 份 Mermaid 图源。
- 已逐张实际打开全部 **13/13 幅原始 PNG**，检查中文、断行、裁切、重叠、箭头和图文一致性；没有只凭文件存在、图源语法或联系表判定通过。
- 对图 03-02 的上、下两组关系标签和图 04-03 的分支交叉位置，在读取原图后另作内存局部查看；未生成额外裁剪文件。
- 已阅读 `handoffs/figures-ready.md` 和对应 13 份 `.figure.json`。所有元信息均标记 `TEACHING_SCHEMATIC`、`labVerified: false`。
- 审阅过程中统稿替换了四章插图段落并更新 ER 图说明。已将当前正文与 `tools/.cache/phase2-baseline-20261018T182805/manuscript/` 的原审阅版本逐项比较，复核所有变化。13 份图源和 13 幅 PNG 的哈希与本轮实际查看版本一致。
- 未执行软件测试、课程实验、业务接口或真实平台操作。本轮也未检查整书 HTML/PDF 的最终显示比例；下述可读性结论针对列出的原始 PNG。

## 需修正的问题

### R1 · P2 · 图 03-02 的四个关系说明成为无字色块

**位置：** [illustrations/ch03-02-local-records-er.png](../illustrations/ch03-02-local-records-er.png)；对应 [figure-sources/ch03-02-local-records-er.mmd](../figure-sources/ch03-02-local-records-er.mmd) 第 2—5 行。

**实际观察：** 四条关系线上的标签都显示成实心蓝色矩形，没有可辨识文字。应显示的文字依次为“关联设备”“预建责任主行”“事件时间线”“零到多条责任历史”。原图 2560 × 3618；上方标签约在 y=950—1050，下方约在 y=2225—2325。上下两组均已局部查看，确认不是整图缩小导致看不清。

表格字段、实体名和关系端点可以看到，但初学者无法从图中读出关系含义。图源中四段中文都存在；SVG 文本元素也包含它们，因此仅通过 XML 或边界检查不能证明成品合格。具体样式或绘制顺序原因尚未定位，不将其写成已确认根因。

**建议修正：** 由统稿检查 ER 关系标签的文字颜色、背景与绘制顺序，修正后重新生成 SVG/PNG。验收时必须实际看到四段中文，确认标签没有挡住必要关系线及基数符号。

### R2 · P2 · 图 04-03 的 HTML 分支线穿过无请求分支节点

**位置：** [illustrations/ch04-03-debug-path.png](../illustrations/ch04-03-debug-path.png)；对应 [figure-sources/ch04-03-debug-path.mmd](../figure-sources/ch04-03-debug-path.mmd) 第 3—5 行。

**实际观察：** 从“响应是什么？”菱形通向“HTML 或路径不匹配／查代理前缀、重写目标与页面回退”的斜线，经过“查前端事件、加载逻辑和控制台错误”矩形右下区域；一段线被该节点遮住，在线条重新露出时看起来像从这个矩形继续出发。原图交叉约在 x=925—980、y=1525—1565，已局部查看确认。

源码语义是 D→E；该矩形是“Network 没有请求”的 C 分支，不应位于这条路径上。成品可能使读者误以为无请求排查后继续进入代理检查，弱化本章分层定位的教学含义。

**建议修正：** 调整 C 节点所在行、分支间距或使用绕行折线，让 D→E 避开 C 的整个边框。复查四种响应路径均从“响应是什么？”出发，无请求路径保持独立，箭头终点和标签对应清楚。

## 非阻断建议

### R3 · P3 · 图 01-02 的左右次序与正文说明相反

**位置：** [manuscript/01-软件工程入门与网页AI协作.md](../manuscript/01-软件工程入门与网页AI协作.md) 第 88 行；[illustrations/ch01-02-prompt-comparison.png](../illustrations/ch01-02-prompt-comparison.png)。

正文写“左右两条路径分别显示信息不足与信息充分时，人工能否检查回答”，但当前图片左侧为“可检查的小任务”，右侧为“信息不足的提示”。图中各自标题明确，内容本身可读。

建议将这句改成不依赖布局次序的“两条路径对比信息不足与信息充分时，人工能否检查回答”，或明确写当前的左右顺序。不必为修正一句说明而强行改变图结构。

### R4 · P3 · 图 03-01 的类名被拆到词中

**位置：** [illustrations/ch03-01-architecture.png](../illustrations/ch03-01-architecture.png)；[figure-sources/ch03-01-architecture.mmd](../figure-sources/ch03-01-architecture.mmd) 第 4—5 行。

`CampusDataProvider` 显示为 `CampusDataProvid / er`，`TeachingMockProvider` 显示为 `TeachingMockProv / ider`。文字没有丢失，但教材初次介绍名称时易读性较差。

建议增加这两个节点宽度或适当缩小标识符字号，让完整类名单独占一行，中文说明另起一行。架构箭头和提供器边界未发现阻断问题。

### R5 · P3 · 图 04-01 的 diff 标签可保留完整命令

**位置：** [illustrations/ch04-01-git-workflow.png](../illustrations/ch04-01-git-workflow.png)；[figure-sources/ch04-01-git-workflow.mmd](../figure-sources/ch04-01-git-workflow.mmd) 第 4—5 行。

两个比较标签分别将 `git diff` 拆为 `git / diff`，将 `git diff --cached` 拆为 `git diff / --cached` 后再接说明。命令与注释合在一起自动换行，图下注释区稍显拥挤。

建议完整命令一行、中文比较对象另起一行，同时给虚线标签留出空隙。三种区域的含义、git add 与 git commit 顺序正确。

## 图文语义复核结果

以下为当前文稿与图源的静态审阅结论，不替代实际测试：

- **权限：** 三类角色与本人已分派事件限制有明确区分，后端承担最终授权；首次请求图从已认证会话开始，没有引导绕过认证。
- **版本和事务：** 同版本竞争、一方成功后一方 409、冲突后回读而不自动重发，以及主记录与时间线同事务的含义一致；文稿保留“待数据库集成测试”的边界。
- **质量与未知值：** `online=null` 没有被当成离线，未知值不补零；模拟来源、观察时间与质量保留。V、kW、kWh 没有被混作同一物理量。
- **状态：** 来源状态与处置状态分开，来源恢复不直接关闭；关闭关卡是检查条件而非新增业务状态。原始报警读取与本地演练事件边界清楚。
- **ER 修订已纳入：** 当前第 03 章第 144、148 行及图元信息已明确“纳入教学集的设备预建一条责任主记录、初始历史为空”，与图源 `DEVICE_REF ||--|| DEVICE_OWNER`、`DEVICE_OWNER ||--o{ OWNER_EVENT` 一致。旧版 alt 的“至多一条责任主记录”已被替换，不再作为未解决问题上报。第 142 行“当前责任关系则至多一条”可以理解为负责人关系为空或非空；如继续润色，可补一句“主行仍预建存在”以区分负责人和主行，当前上下文已给出解释。
- **证据：** 四章明确教材初稿、教学样例或待执行；第 04 章明确配套骨架尚未制作、没有贯通成功日志。13 幅图片的教学示意标识与正文一致，未发现把建议步骤写成已运行结果的阻断问题。

## 实际查看的 13 幅 PNG

| 实际打开的原图 | 像素 | 目视结果 |
| --- | --- | --- |
| [ch01-01-engineering-cycle.png](../illustrations/ch01-01-engineering-cycle.png) | 2560 × 910 | 原图已查看；活动、制品及反馈箭头清楚，未见裁切或遮挡。 |
| [ch01-02-prompt-comparison.png](../illustrations/ch01-02-prompt-comparison.png) | 2560 × 716 | 原图已查看；文字完整。正文对左右次序的描述需同步，见 R3。 |
| [ch01-03-ai-evidence-loop.png](../illustrations/ch01-03-ai-evidence-loop.png) | 2560 × 774 | 原图已查看；人工执行、核验与反馈路径完整，未见阻断问题。 |
| [ch02-01-scope-map.png](../illustrations/ch02-01-scope-map.png) | 2560 × 1894 | 原图已查看；角色、必修范围、选做虚线与范围外事项清楚。 |
| [ch02-02-traceability.png](../illustrations/ch02-02-traceability.png) | 2560 × 1118 | 原图已查看；R06、AC07/08/09 与待执行证据对应清楚。 |
| [ch02-03-milestones.png](../illustrations/ch02-03-milestones.png) | 2560 × 2692 | 原图已查看；五个里程碑、章节区间和选做分支完整，未见裁切。 |
| [ch03-01-architecture.png](../illustrations/ch03-01-architecture.png) | 2560 × 2928 | 原图已查看；架构边界清楚，两个类名有不理想断行，见 R4。 |
| [ch03-02-local-records-er.png](../illustrations/ch03-02-local-records-er.png) | 2560 × 3618 | 原图及上下两组关系标签局部均已查看；四个关系标签不可读，见 R1。 |
| [ch03-03-two-state-axes.png](../illustrations/ch03-03-two-state-axes.png) | 2560 × 2432 | 原图已查看；来源恢复与处置关闭分开，关闭关卡和返回路径完整。 |
| [ch03-04-version-transaction.png](../illustrations/ch03-04-version-transaction.png) | 2560 × 2436 | 原图已查看；版本 3→4、等待锁、409 与不追加成功时间线表达清楚。 |
| [ch04-01-git-workflow.png](../illustrations/ch04-01-git-workflow.png) | 2560 × 718 | 原图已查看；三种区域和流向正确，diff 命令标签断行可优化，见 R5。 |
| [ch04-02-first-request.png](../illustrations/ch04-02-first-request.png) | 2560 × 2156 | 原图已查看；认证、前缀重写、后端授权、提供器与 data.items 链路清楚。 |
| [ch04-03-debug-path.png](../illustrations/ch04-03-debug-path.png) | 2560 × 2280 | 原图及交叉位置局部均已查看；HTML 分支线穿过无关节点，见 R2。 |

## 本轮版本指纹

这些指纹用于区分后续统稿生成的新版本；新哈希不自动继承本轮目视结论。图源和 PNG 的 SHA-256 如下。

| 图名 | Mermaid 图源 SHA-256 | PNG SHA-256 |
| --- | --- | --- |
| ch01-01-engineering-cycle | `8bd7f349d326aa9d1c44828efbc147e58865111b7edb574753e3474065a4b0cf` | `899ee73b0407a9712503a6c1ae017d6fcacc2e6af9bf1bbeff0807d0c22defb6` |
| ch01-02-prompt-comparison | `db384d25afeed3892ed1b2ab38efed93234668a0dbe18f9dbb66264c82e33410` | `8e5f7961416440ece6104f27806ec579698eb1f8f5c9e81185a0c5d38b0ccbab` |
| ch01-03-ai-evidence-loop | `aca7a01e47545bebe0e6a1d397cd5fe0d87a8a35daa413268447d12b80e7ce45` | `c07a6ecea0a2033964a01014350052b06bc9c08fe65887db729fcd0fbda7b440` |
| ch02-01-scope-map | `5c496e8d1b0d81cc21f64f2b9cd2b5ea589bc49bbc9771414243b4b80ee4e708` | `43539c217d98ce51a37c89a9ce11e25cc0e53db9df2860c648a1e626d97792ad` |
| ch02-02-traceability | `3511505a597b34ac91fbd2dbbeab89556eaa8a140e60aedb4f9eaa8f65883f20` | `9a8477ddfc186be9cc2df688401fda0300df0dd22300afd17c4c28e4048fbece` |
| ch02-03-milestones | `b7f7117988c44556000ec05f2478a72a477ad2c8ff6f9f7a6e56e802098d495d` | `9bd8fb7a9bd504bf39a8e8e77e94df100ee6ce9d8e8d0fe92614e33326ded160` |
| ch03-01-architecture | `db16bed72a30e2f3ff35707c9977fba2d0196192888b9e1e5574cf67d59cbd4b` | `711074c408877d57314f99d38666a5ed1f73172b46797ecb79913718d3cbd497` |
| ch03-02-local-records-er | `27382da398ce746ca6cae2a9d4b1b9c669ac5b1904cc26a067a1d989af0980c7` | `58ea00ac11d48446ac31b69d0b051bb3c130d2ccf3e192faaa60fbe6b64e81f0` |
| ch03-03-two-state-axes | `9ec9d1fa405f639a806d79f1ac420f081c7d2e014ce77b936abb6fc76d9e0587` | `0e093e076576481c60a6e548be2c614e232140d414ca3018148b66f2feed6245` |
| ch03-04-version-transaction | `fd3ea825fd71a212cc32ad62cac99abde9e1f158521bad9ddc83f01d0cd7c874` | `fa3be38303d306e1a4ad9d39f5158409c1c9edf97f93b84e8e2e365aa98080c9` |
| ch04-01-git-workflow | `a4c00374a095478ad5b7248cf8d20180761893526396f65d3483ce3448d01cd6` | `ce16a90d69c3c396dea486ca8a92d8215cad474494b4b44e5ff62204daa67547` |
| ch04-02-first-request | `952d84bae02d28c27e0c0abe54928f1dbebbd1f74024aa6e9aa82cd4228e8c93` | `da97163ef27d53952292fb564e91996c53a9fb8cb17426b53b9414a2c204edda` |
| ch04-03-debug-path | `230b778d8084dddefe04a190cdc7ff7a56f2de332fd16701e69335d7210179de` | `b3f9fb9c383a27427052cda40961d177c643cdfefb322ccf82194a71cca7873e` |

已完整阅读的四章及本轮统稿差异复核后的 SHA-256：

| 当前文稿 | SHA-256 |
| --- | --- |
| [01-软件工程入门与网页AI协作.md](../manuscript/01-软件工程入门与网页AI协作.md) | `09290250aa43270a71fe43bc95b4671ee5e41942abe6987cfb684246175c804e` |
| [02-需求分析与项目计划.md](../manuscript/02-需求分析与项目计划.md) | `d4a25dcb90023233e363f55e39a6e4e039d5331ca55a784c889039092df7a9a4` |
| [03-架构数据与接口设计.md](../manuscript/03-架构数据与接口设计.md) | `a72843703c83a4456738f1f55b3a45186ceebe069ebad96c0a27db3739c73bc5` |
| [04-开发环境版本控制与首次贯通.md](../manuscript/04-开发环境版本控制与首次贯通.md) | `c9cbb188a954a38b5e29abba28e159c666c20f649df3ddd91981c958997c6b83` |

## 交接与复查条件

统稿会话修正 R1、R2 后，应重新打开两幅原始 PNG，分别确认四段关系文字可见、HTML 分支不穿过无关节点，再更新最终视觉结论。R3—R5 可随排版一并处理。

本轮未修改正文、图源、图片、公共索引或其他交接文件，未接触 `system/`、凭据或业务服务，也未向其他会话或外部发送消息。`lab_verified=false` 保持不变。

