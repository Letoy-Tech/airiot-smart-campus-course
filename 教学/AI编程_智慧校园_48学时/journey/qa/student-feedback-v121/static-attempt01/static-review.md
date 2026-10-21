# 新主线静态审读

结论：**PASS_STATIC**。仅静态，不是实机或课堂验收。

检查时间：2026-10-19T22:20:16.482146+00:00
源摘要：`6755f29416b25d7b6850cec277c7b60cde494962051bc22ceaa6696a7ddbc3fd`

## 覆盖

- 两个根入口及 journey HTML 本地 href/src、唯一 id、锚点与 12 站 plan/begin/verify；不访问外链。
- 12 篇正文各有具体动作、prompt、预期和失败分支；已复核第 04/07/09 站既有合同修复及完成范围。
- 总清单与 12 个阶段：引用存在、SHA-256/bytes、角色、骨架、累计上下文文件；不实际导入阶段。
- 按实际 progress.mjs 分派器和 npm scripts 核对命令；verify 仅前端，后端/业务保留 NOT_CHECKED。
- 入口 build.json 绑定当前 HTML、Markdown、元数据、生成器、CSS/JS；所有审计输入再绑定独立摘要。

统计：assertions=2389；htmlIds=231；htmlLinks=125；localLinks=118；anchors=48；externalLinksNotFetched=7；htmlPages=3；stationMarkdown=12；manifestFileReferences=952；stageManifests=12；businessTargets=14

## 需修正

本轮所列静态规则无未解决阻断。

## 边界

PASS_STATIC 仅证明列出的当前文件与静态规则；四要素存在不证明新手操作成功，不能据此签课程业务完成。

未执行：browser/file://、HTTP server or API、CodeBuddy AI session、Windows runtime、Node/npm/Maven builds or tests、database、classroom timing、real AIRIOT。

完整逐文件 SHA-256 与字节数见同目录 static-review.json。源变更后必须重跑；旧摘要不覆盖新文件。
