# 章节配图已具备初审条件

日期：2026-10-18（Asia/Shanghai）。38 幅章节图已全部生成 PNG 与 SVG，另有 2 幅公共样图；本报告用于启动只读交叉图审阅，不表示图文统稿已结束。课程实验继续 lab_verified=false。

## 当前状态与已知事项

- 图源与作者图注已一一对应，38 份 .figure.json 元信息已生成；源稿和原图源共 50 文件已冻结在 tools/.cache/phase2-baseline-*，manifest 记录 SHA-256。
- Mermaid 全部实际渲染，SVG 均通过 XML 与画布边界检查；38/38 PNG 已存在。原始渲染报告：illustrations/render-report.json。
- 图 03-02 已修正责任记录关系：每个纳入教学集的设备预建一条责任主记录，责任历史为零到多条；正文与 alt 的对应修订正在统一落盘。
- 图 07-01 的 SVG desc 已修复“以内容差”笔误。
- 待优化的长图：图 09-02、图 11-03、图 12-02、图 12-03。将压缩不必要纵向留白或改为多列/分组表达，保留规则。
- 需原图核对小字的宽图：图 01-01、图 01-02、图 01-03、图 02-02、图 04-01、图 09-01、图 10-01、图 11-01、图 11-04、图 12-01。联系表用于逐图筛查，小字和长图会打开原图核验。
- 本报告之后仍会修订布局，交叉审阅请记录图号、具体问题和检查时的图片/图源 SHA-256；统一修订由统稿会话落盘。
- 尚未完成正文插图与整书阅读检查，现有 manuscript 的 Mermaid 展示块会替换成对应 PNG，保留可编辑源链接。

## 图源与成品清单

| 图号 | 可编辑源 | 成品 | PNG 像素 |
| --- | --- | --- | --- |
| 图 01-01 | [ch01-01-engineering-cycle.mmd](../figure-sources/ch01-01-engineering-cycle.mmd) | [PNG](../illustrations/ch01-01-engineering-cycle.png) / [SVG](../illustrations/ch01-01-engineering-cycle.svg) | 2560 × 910 |
| 图 01-02 | [ch01-02-prompt-comparison.mmd](../figure-sources/ch01-02-prompt-comparison.mmd) | [PNG](../illustrations/ch01-02-prompt-comparison.png) / [SVG](../illustrations/ch01-02-prompt-comparison.svg) | 2560 × 716 |
| 图 01-03 | [ch01-03-ai-evidence-loop.mmd](../figure-sources/ch01-03-ai-evidence-loop.mmd) | [PNG](../illustrations/ch01-03-ai-evidence-loop.png) / [SVG](../illustrations/ch01-03-ai-evidence-loop.svg) | 2560 × 774 |
| 图 02-01 | [ch02-01-scope-map.mmd](../figure-sources/ch02-01-scope-map.mmd) | [PNG](../illustrations/ch02-01-scope-map.png) / [SVG](../illustrations/ch02-01-scope-map.svg) | 2560 × 1894 |
| 图 02-02 | [ch02-02-traceability.mmd](../figure-sources/ch02-02-traceability.mmd) | [PNG](../illustrations/ch02-02-traceability.png) / [SVG](../illustrations/ch02-02-traceability.svg) | 2560 × 1118 |
| 图 02-03 | [ch02-03-milestones.mmd](../figure-sources/ch02-03-milestones.mmd) | [PNG](../illustrations/ch02-03-milestones.png) / [SVG](../illustrations/ch02-03-milestones.svg) | 2560 × 2692 |
| 图 03-01 | [ch03-01-architecture.mmd](../figure-sources/ch03-01-architecture.mmd) | [PNG](../illustrations/ch03-01-architecture.png) / [SVG](../illustrations/ch03-01-architecture.svg) | 2560 × 2928 |
| 图 03-02 | [ch03-02-local-records-er.mmd](../figure-sources/ch03-02-local-records-er.mmd) | [PNG](../illustrations/ch03-02-local-records-er.png) / [SVG](../illustrations/ch03-02-local-records-er.svg) | 2560 × 3618 |
| 图 03-03 | [ch03-03-two-state-axes.mmd](../figure-sources/ch03-03-two-state-axes.mmd) | [PNG](../illustrations/ch03-03-two-state-axes.png) / [SVG](../illustrations/ch03-03-two-state-axes.svg) | 2560 × 2432 |
| 图 03-04 | [ch03-04-version-transaction.mmd](../figure-sources/ch03-04-version-transaction.mmd) | [PNG](../illustrations/ch03-04-version-transaction.png) / [SVG](../illustrations/ch03-04-version-transaction.svg) | 2560 × 2436 |
| 图 04-01 | [ch04-01-git-workflow.mmd](../figure-sources/ch04-01-git-workflow.mmd) | [PNG](../illustrations/ch04-01-git-workflow.png) / [SVG](../illustrations/ch04-01-git-workflow.svg) | 2560 × 718 |
| 图 04-02 | [ch04-02-first-request.mmd](../figure-sources/ch04-02-first-request.mmd) | [PNG](../illustrations/ch04-02-first-request.png) / [SVG](../illustrations/ch04-02-first-request.svg) | 2560 × 2156 |
| 图 04-03 | [ch04-03-debug-path.mmd](../figure-sources/ch04-03-debug-path.mmd) | [PNG](../illustrations/ch04-03-debug-path.png) / [SVG](../illustrations/ch04-03-debug-path.svg) | 2560 × 2280 |
| 图 05-01 | [ch05-01-device-request.mmd](../figure-sources/ch05-01-device-request.mmd) | [PNG](../illustrations/ch05-01-device-request.png) / [SVG](../illustrations/ch05-01-device-request.svg) | 2560 × 1644 |
| 图 05-02 | [ch05-02-space-relations.mmd](../figure-sources/ch05-02-space-relations.mmd) | [PNG](../illustrations/ch05-02-space-relations.png) / [SVG](../illustrations/ch05-02-space-relations.svg) | 2560 × 1182 |
| 图 05-03 | [ch05-03-binding-readback.mmd](../figure-sources/ch05-03-binding-readback.mmd) | [PNG](../illustrations/ch05-03-binding-readback.png) / [SVG](../illustrations/ch05-03-binding-readback.svg) | 2560 × 2070 |
| 图 06-01 | [ch06-01-device-wireframe.svg](../figure-sources/ch06-01-device-wireframe.svg) | [PNG](../illustrations/ch06-01-device-wireframe.png) / [SVG](../illustrations/ch06-01-device-wireframe.svg) | 2560 × 1640 |
| 图 06-02 | [ch06-02-components-state.mmd](../figure-sources/ch06-02-components-state.mmd) | [PNG](../illustrations/ch06-02-components-state.png) / [SVG](../illustrations/ch06-02-components-state.svg) | 2560 × 2584 |
| 图 06-03 | [ch06-03-page-states.mmd](../figure-sources/ch06-03-page-states.mmd) | [PNG](../illustrations/ch06-03-page-states.png) / [SVG](../illustrations/ch06-03-page-states.svg) | 2560 × 4252 |
| 图 07-01 | [ch07-01-quality-cases.svg](../figure-sources/ch07-01-quality-cases.svg) | [PNG](../illustrations/ch07-01-quality-cases.png) / [SVG](../illustrations/ch07-01-quality-cases.svg) | 2560 × 1680 |
| 图 07-02 | [ch07-02-history-gaps.svg](../figure-sources/ch07-02-history-gaps.svg) | [PNG](../illustrations/ch07-02-history-gaps.png) / [SVG](../illustrations/ch07-02-history-gaps.svg) | 2560 × 1600 |
| 图 07-03 | [ch07-03-refresh-lifecycle.mmd](../figure-sources/ch07-03-refresh-lifecycle.mmd) | [PNG](../illustrations/ch07-03-refresh-lifecycle.png) / [SVG](../illustrations/ch07-03-refresh-lifecycle.svg) | 2560 × 2110 |
| 图 08-01 | [ch08-01-role-scope.mmd](../figure-sources/ch08-01-role-scope.mmd) | [PNG](../illustrations/ch08-01-role-scope.png) / [SVG](../illustrations/ch08-01-role-scope.svg) | 2560 × 2988 |
| 图 08-02 | [ch08-02-denial-path.mmd](../figure-sources/ch08-02-denial-path.mmd) | [PNG](../illustrations/ch08-02-denial-path.png) / [SVG](../illustrations/ch08-02-denial-path.svg) | 2560 × 4418 |
| 图 08-03 | [ch08-03-identity-race.mmd](../figure-sources/ch08-03-identity-race.mmd) | [PNG](../illustrations/ch08-03-identity-race.png) / [SVG](../illustrations/ch08-03-identity-race.svg) | 2560 × 2518 |
| 图 09-01 | [ch09-01-state-machine.mmd](../figure-sources/ch09-01-state-machine.mmd) | [PNG](../illustrations/ch09-01-state-machine.png) / [SVG](../illustrations/ch09-01-state-machine.svg) | 2560 × 944 |
| 图 09-02 | [ch09-02-close-gates.mmd](../figure-sources/ch09-02-close-gates.mmd) | [PNG](../illustrations/ch09-02-close-gates.png) / [SVG](../illustrations/ch09-02-close-gates.svg) | 2560 × 5898 |
| 图 09-03 | [ch09-03-recovery-sequence.mmd](../figure-sources/ch09-03-recovery-sequence.mmd) | [PNG](../illustrations/ch09-03-recovery-sequence.png) / [SVG](../illustrations/ch09-03-recovery-sequence.svg) | 2560 × 3240 |
| 图 10-01 | [ch10-01-owner-event-model.mmd](../figure-sources/ch10-01-owner-event-model.mmd) | [PNG](../illustrations/ch10-01-owner-event-model.png) / [SVG](../illustrations/ch10-01-owner-event-model.svg) | 2560 × 1054 |
| 图 10-02 | [ch10-02-future-assignment.mmd](../figure-sources/ch10-02-future-assignment.mmd) | [PNG](../illustrations/ch10-02-future-assignment.png) / [SVG](../illustrations/ch10-02-future-assignment.svg) | 2560 × 2000 |
| 图 10-03 | [ch10-03-responsibility-timeline.mmd](../figure-sources/ch10-03-responsibility-timeline.mmd) | [PNG](../illustrations/ch10-03-responsibility-timeline.png) / [SVG](../illustrations/ch10-03-responsibility-timeline.svg) | 2560 × 1156 |
| 图 11-01 | [ch11-01-evidence-layers.mmd](../figure-sources/ch11-01-evidence-layers.mmd) | [PNG](../illustrations/ch11-01-evidence-layers.png) / [SVG](../illustrations/ch11-01-evidence-layers.svg) | 2560 × 1040 |
| 图 11-02 | [ch11-02-concurrent-updates.mmd](../figure-sources/ch11-02-concurrent-updates.mmd) | [PNG](../illustrations/ch11-02-concurrent-updates.png) / [SVG](../illustrations/ch11-02-concurrent-updates.svg) | 2560 × 2340 |
| 图 11-03 | [ch11-03-transaction-rollback.mmd](../figure-sources/ch11-03-transaction-rollback.mmd) | [PNG](../illustrations/ch11-03-transaction-rollback.png) / [SVG](../illustrations/ch11-03-transaction-rollback.svg) | 2560 × 5948 |
| 图 11-04 | [ch11-04-debugging-loop.mmd](../figure-sources/ch11-04-debugging-loop.mmd) | [PNG](../illustrations/ch11-04-debugging-loop.png) / [SVG](../illustrations/ch11-04-debugging-loop.svg) | 2560 × 766 |
| 图 12-01 | [ch12-01-delivery-flow.mmd](../figure-sources/ch12-01-delivery-flow.mmd) | [PNG](../illustrations/ch12-01-delivery-flow.png) / [SVG](../illustrations/ch12-01-delivery-flow.svg) | 2560 × 798 |
| 图 12-02 | [ch12-02-controlled-change.mmd](../figure-sources/ch12-02-controlled-change.mmd) | [PNG](../illustrations/ch12-02-controlled-change.png) / [SVG](../illustrations/ch12-02-controlled-change.svg) | 2560 × 5052 |
| 图 12-03 | [ch12-03-code-data-recovery.mmd](../figure-sources/ch12-03-code-data-recovery.mmd) | [PNG](../illustrations/ch12-03-code-data-recovery.png) / [SVG](../illustrations/ch12-03-code-data-recovery.svg) | 2560 × 5824 |

## 后续动作

统稿继续处理排版、语义、正文插图和 reading/index.html 及单文件阅读版，不等待并行检查。最终以 handoffs/illustration-final.md 和最终产物哈希为准。本轮不修改公共索引、README、05 进度、压缩包或现有 system。
