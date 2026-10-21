# 第01站实际操作记录

2026-10-20，使用 CodeBuddy CN 4.12.2 独立 IDE，手动选择内置 Deepseek-V4.1-Flash（300K）。用户已允许 DeepSeek 替代 Qwen；本次服务渠道是 CodeBuddy，不是阿里云百炼。

先在 Ask 中读取 CODEBUDDY.md、journey-state.json，模型正确判断第1站未验证；再按教程生成项目卡，操作员把模型原文补进 docs/项目卡.md，并保存“查设备→看读数→处理事件”。随后用 @ 引用了实际 StaticDevices.vue 和项目卡，Craft 中发送教程 HTML 装配的本次目标提示及平台名验收要求。模型只修改 StaticDevices.vue，没有导入参考答案，没有 progress apply。

模型自己运行了类型检查、2项单元测试和构建并报告通过。操作员另在 IDE 检查终端切到 Node 22.21.1、Java 17 后执行 progress verify，退出码0，类型、2项测试及构建通过。实际浏览器 http://127.0.0.1:5178/ 可见“我的校园值班台”，两条教学模拟设备，一条在线、一条未知；未知没有写成离线，TEACHING_MOCK 和未发HTTP请求说明可见。截图与原始提示/回答在作业根 evidence/stage-01、evidence/screenshots。

模型业务修复次数0，参考救援0。教师底座包括初始静态样例、通用样式、三态帮助函数和检查工具；人工辅助包括 IDE 操作、环境变量、复制模型项目卡、浏览器观察与记录，没有人工代写业务代码。模型本次 Craft 的界面用量为0.70 Credits、281409 Tokens；实际上游模型ID和现金账单未由IDE暴露。

发现准备说明只设置 JAVA_HOME 时，当前终端的 java 仍可能为21；本机在当前终端将 JAVA_HOME/bin 放到 PATH 前面后才核对为17。尚未进行HTTP接口、数据库、Windows、真实AIRIOT验收。
