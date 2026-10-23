# 工程图示源文件 · V2.1.2

七张 SVG 可直接离线打开，正文以图片引用。SVG 是可编辑的 XML；`render_diagrams.py` 保存各图文字、布局、节点和连线，是统一重建源，不依赖网络、浏览器、Mermaid 或第三方 Python 包。

教师在完整课程目录的本目录运行 `python3 render_diagrams.py` 可重建七张 SVG；页脚版本读取课程的 `tools/v2/course-config.json`。会覆盖同名图，修改时应先改源脚本，再检查输出。不要只改 SVG 而不更新脚本。

| 文件 | 解释内容 |
| --- | --- |
| use-cases.svg | 三角色、用例、系统边界 |
| architecture-deployment.svg | 页面、代理、后端、MySQL、Redis与工具终端 |
| er-model.svg | 参考10表、真实外键及逻辑关联 |
| event-state.svg | 状态变化、自动分派、动作与关闭门槛 |
| login-sequence.svg | 登录、会话检查、退出 |
| event-sequence.svg | 原始请求、校验、版本、事务、审计、独立回读 |
| concept-classes.svg | 概念对象关系与真实代码职责依赖 |

图示是课程设计模型，不是运行截图或验收证据。所有地址为本机教学入口；没有真实身份、设备、口令、令牌或校园地址。完整源码和数据库约束以文档所指教师参考文件为准，学生需按自己的实际迁移更新图。
