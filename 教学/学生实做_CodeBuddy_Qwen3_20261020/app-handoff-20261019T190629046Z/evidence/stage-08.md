# 第08站实际验收

模型先给出具体计划，操作者在CodeBuddy IDE内确认后，内置DeepSeek仅实现CasesView.vue；未改教师后端、测试、认证或装配。操作提示、计划、确认、原始可见输出及源码差异分别保存，没有使用progress apply。

管理员通过学生页面触发temperature-patrol。本轮主事件ID：5bd33750-0afd-475d-8c99-c97b42f7429f，设备teaching_env_01，DEMO/LOCAL_DEMO，simulated=true。NEW/version1→管理员分派manager-a得到ASSIGNED/v2→A开始IN_PROGRESS/v3→A追加“已检查现场”后仍IN_PROGRESS/v4。刷新并重新选择同ID，时间线保留DEMO_TRIGGER、ASSIGN、START、NOTE及真实操作者时间。

B读取A事件但NOTE按钮disabled；viewer的NOTE与触发按钮disabled。操作者独立HTTP请求：manager-b和viewer追加NOTE均返回403，state/version/assignee/timeline完全不变，仍为IN_PROGRESS/v4。本人+IN_PROGRESS筛选命中1条，切NEW得成功空0条；当前仅1条，下一页disabled，未把这算多页浏览验证。

正式verify退出0，类型/46既有单测/构建通过。本阶段关闭区按装配保持隐藏，不把来源ACTIVE误当本地关闭。409两窗口和事务回滚留到第11站，不提前算通过。所有事件仅独立本机MySQL模拟数据，无真实故障、控制或外部通知。
