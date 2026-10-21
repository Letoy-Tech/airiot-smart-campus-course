# 图文统稿第一阶段交接

日期：2026-10-18（Asia/Shanghai）。状态：`ILLUSTRATION_PREPARATION_COMPLETE`。课程实验继续为 `lab_verified=false`。

## 本阶段结果

已建立可实际运行的 SVG/Mermaid → SVG + 2x PNG 渲染流程、整书 HTML 生成器、离线浏览器检查脚本和中文教材样式。已制作并实际打开两幅公共样图：

| 样图 | 可编辑源 | 已生成成品 | 实际用途 |
| --- | --- | --- | --- |
| 公共图 01：教学工程的请求与数据边界 | `figure-sources/shared/shared-01-教学工程边界.svg` | `illustrations/shared-01-教学工程边界.svg/.png`；PNG 2560×1936 | 分层、后端最终授权、本地持久化、显式数据源与只读选做 |
| 公共图 02：网页 AI 协作 | `figure-sources/shared/shared-02-网页AI协作.mmd` | `illustrations/shared-02-网页AI协作.svg/.png`；PNG 2560×2182 | 人工审查、本地执行、真实证据及未通过时的反馈 |

两图均带教学示意标签和 `.figure.json` 图题、替代说明、图注。公共样图不计入后续每章三幅图的最低数量。

预览入口：[相对路径阅读样张](../illustrations/reader-sample.html)、[单文件阅读样张](../illustrations/reader-sample-standalone.html)。本阶段未生成完整 `reading/index.html`。

统一样式和全部命令见 [工具使用说明](../tools/配图与阅读版说明.md)。主要脚本：`tools/render-figures.mjs`、`tools/build-reader.mjs`、`tools/verify-reader.mjs`；复用模块为 `tools/runtime.mjs`，样式为 `tools/mermaid-theme.json` 与 `tools/reader.css`。

## 已实际运行的命令

在课程目录执行：

```sh
node tools/render-figures.mjs
node tools/build-reader.mjs --sample
node tools/verify-reader.mjs --sample
node tools/build-reader.mjs --sample --embed-images --output illustrations/reader-sample-standalone.html
node tools/verify-reader.mjs --sample --input illustrations/reader-sample-standalone.html --output illustrations/qa/standalone --skip-pdf
```

本机固定 Mermaid 11.12.2，复用 Codex runtime 的 Playwright 1.62.1、marked 17.0.5；实际 Chromium 149.0.7827.55。已处理 Playwright 默认浏览器路径与本机缓存版本不同的问题，可通过环境变量显式指定运行库和浏览器。渲染不需要启动 HTTP 或业务服务。

## 实际检查

- 两幅 PNG 已用图像查看工具打开；检查了中文、文字边界、箭头、层级、选做虚线和教学标签。修复 Mermaid SVG id 遗失造成的样式未生效问题后重新查看，时序编号已改为白字。
- 相对路径样张和单文件样张均在离线模式以 1440px、390px 视口加载；共两幅图均加载成功、有替代文字和图注；页面无横向溢出、无重复锚点、无断裂书内链接、无远端资源请求或脚本错误。
- 实际点击单文件样张的目录及 PNG 下载；下载内容 SHA-256 与原 PNG 一致。
- 已将 A4 打印预览的全部 6 页渲染成 PNG 并查看，未见缺字或裁切。Poppler 有两次 Type 3 字形包围盒警告，保留在说明中；该 PDF 仅供排版核对。
- 对四个 `.mjs` 做了 Node 语法检查。向严格整书模式提供不含章节的夹具目录时，命令按预期失败，且没有写出伪完整阅读版。
- 完整 12 章生成、至少 36 幅章节图及业务图文一致性尚未检查；本轮没有将这些项目标为通过。

证据位置：`illustrations/render-report.json`、`illustrations/sample-visual-review.json`、`illustrations/qa/sample/verification.json`、`illustrations/qa/standalone/verification.json`、`illustrations/qa/standalone/interaction.json`。这些都是配图与版式证据，不是软件实验结果。

## 第二阶段图源要求

每图使用一个 `chNN-XX-短图名.mmd` 或 `.svg` 主源，避免同名双源；不要在 Mermaid 图内覆盖统一主题。SVG 保持矢量文字、合法 viewBox、title/desc，不依赖外部图片/字体或 HTML foreignObject。复杂图应拆分，不能通过缩小文字填塞。

建议补齐同名 `.figure.json` 的 id/title/alt/caption。作者已给出的正文图注应作为统稿依据，不用文件名代替图题。最终正文采用独占一段的 Markdown PNG 引用，附描述性 alt 和相邻图号引用；生成器自动形成图表目录。

## 第二阶段接力步骤

1. 等待主会话明确发出正式接力，读取三组作者交接和最终源稿；不轮询其他会话。
2. 对照共同合同及 `handoffs/parent-review-checklist.md` 核对 12 章与全部图源，逐章确认教学目的、权限、来源/处置状态、关闭门槛、版本冲突、事务和审计语义。
3. 渲染已交接图源，逐幅打开检查；将每章至少 3 幅成品 PNG 插入正文附近，保留 SVG/Mermaid 可编辑源及图题、解释与替代文字。共有图不能重复凑数。
4. 将 `07-图文初稿阅读指南.md` 作为整书前言，执行 `node tools/build-reader.mjs --strict`。默认固定输出 `reading/index.html`，图片相对引用 `../illustrations/`；该命令仍只读 Markdown，正文插图需统稿者先完成。
5. 执行整书浏览器和打印检查，检查单独文档包中的图片链接，写完整图表目录与统稿报告。实际 12 章/36 图输入尚未经过本轮验证，届时需修正发现的问题。
6. 交回主会话更新公共索引、README、进度和最终压缩包；保留 V0.1。排除 `tools/node_modules/`、缓存和浏览器运行库，检查资料 `illustrations/qa/` 可另存。

## 本轮文件边界

仅新增/修改 `tools/`、`figure-sources/shared/`、`illustrations/` 和本交接文件。未改 `manuscript/`、公共合同、索引、根 README、章节设计稿、现有 `system/` 或原 Word 大纲；未读取 `.private`，未启动现有业务服务，未连接或写入远端平台，未部署。未向其他会话发消息。
