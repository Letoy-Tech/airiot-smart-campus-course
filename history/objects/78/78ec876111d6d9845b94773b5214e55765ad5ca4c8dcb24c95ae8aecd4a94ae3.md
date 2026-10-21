# 逐站工程资源

当前生成：参考模块已具备；本轮V1.2.1验证见课程总包journey/qa/student-feedback-v121。

- app/：整份复制到桌面后连续使用的起点，自带12站源码包。
- reference/：最终可读参考，不能覆盖个人工程。
- authoring/：生成器资源与工具测试；学生不用操作。
- evidence/：历史作者检查；本轮报告在课程总包journey/qa/student-feedback-v121，均不能当作学生记录。

生成命令：在课程根目录运行node tools/build-progress-project.mjs；更新已生成文件使用--refresh，工具仅允许原样生成内容被替换，发现个人修改会拒绝。--allow-pending只供工具开发，不能用于发布。

1. 静态两设备页面（静态；不需后端）
2. 首次HTTP读取（first-chain；无数据库）
3. 完整设备台账（teacher-db；教师独立库）
4. 本地位置登记（teacher-db）
5. 概览与能源（teacher-db）
6. 历史与原始报警（teacher-db）
7. 身份与权限验证（teacher-db；复用认证底座）
8. 事件接收与处理（teacher-db）
9. 恢复、核实与关闭（teacher-db）
10. 责任、审计与接入（teacher-db；AIRIOT选做）
11. 调试与测试（真实数据库另用独立_test库）
12. 交付与接力（本地或教师批准隔离环境）
