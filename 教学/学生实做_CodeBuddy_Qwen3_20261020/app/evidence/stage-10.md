# 第10站实际验收

CodeBuddy内置DeepSeek按三个独立HTML目标提示分别实现OwnersView.vue、AuditView.vue、IntegrationView.vue，复用教师API及权限；无参考导入、无操作者业务代码实现。正式verify退出0：类型、46既有测试、构建。

学生UI将teaching_env_01责任设A（责任v1），触发事件8fda017a-c8d1-443d-9cbc-90e9f39c1655自动ASSIGNED/A；改B（责任v2），触发1f5cdc11-c79c-45d7-b2f8-93d2d44714ff自动ASSIGNED/B。独立GET确认旧A新B均未被追改，事件版本独立。

经Chrome“文件→打开新的窗口”创建第二物理窗口，两窗口都读责任v2。第一窗改A成功v3；第二窗第一次选B与其旧快照当前责任相同，被前端拦截未发请求，不计409通过。随后在仍为v2的第二窗实际改选A并提交，真实显示409、回读v3，原说明文字保留。约85秒后独立HTTP回读仍v3/A、时间线仅1/2/3，无自动重放。操作者人工重判后用最新v3把既定责任改B成功v4；再次HTTP确认旧事件A、新事件B仍分别保持，最终责任B/v4。

审计实际3条带HISTORICAL_TEACHING_SAMPLE/TEACHING_MOCK/simulated=true，CONFIRMED是虚构历史样例，不代表本轮下发；成功空与失败分别验证，无控制或通知按钮。当前样例3条、最小每页5，只实际看到单页，不称完成多页浏览。

接入真实响应configured=false、connected=false、controlEnabled=false，6项能力PENDING并显示AIRIOT_NOT_CONFIGURED。viewer无审计导航，直接已知hash路由也只显示拒绝且无内容；接入页同样拒绝。独立HTTP viewer审计403/admin200、viewer及manager接入403/admin200。所有场景仅本地，未尝试真实AIRIOT连接或控制。
