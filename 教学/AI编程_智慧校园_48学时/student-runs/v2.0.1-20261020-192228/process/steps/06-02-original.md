## 第 2 步：创建一条独立的演练事件

**现在在哪：**CodeBuddy 对话框。我们在“演练事件”菜单里新建记录，不改原始报警。

```prompt
只完成第06课第2步，完善现有演练事件页。
管理员可选择设备并填写“这次练习要处理什么”，点击“创建演练”。页面明确写“不会操作实际设备，不发送外部通知”。
增加异步getCases()与createCase({deviceId,message})。新事件包含id、deviceId、message、state、assignee、sourceState、verified、note、conclusion、version、timeline，创建version=1、sourceState=ACTIVE、verified=false，记录初始时间线。
若该设备已有责任人，自动填入assignee且state=ASSIGNED；没有责任人则assignee为空、state=NEW。message去空格后不能为空。
保存到campus-v2-demo的cases，保留spaces和owners。创建成功后重新getCases读取列表并打开刚创建的事件详情，显示设备、状态、处理人和版本。
状态中文为NEW待分派、ASSIGNED已分派、IN_PROGRESS处理中、CLOSED已关闭。本步先不加后续处理按钮。
保存文件，不启动服务，不修改原始alarms。
```

**等到什么：**等 AI 保存完成，刷新浏览器，确认身份为管理员，打开“演练事件”。

**自己点看：**选择未登记责任人的 `d02`，说明填写 `练习检查教室温湿度读数`，点“创建演练”，记下新事件编号。

**应该看到：**新事件为“待分派”、版本 1、来源未恢复；详情中的设备是 `d02`。刷新后同一条记录还在。原始报警页的报警数量和内容没有因此改变。

如果你选择的是已经登记负责人的设备，应看到“已分派”和该负责人，版本仍为 1。这是自动分派成功，不需要再分派一次。

**如果创建的事件出现在原始报警里：**单独发送：

```prompt
第06课第2步创建演练后改动了原始报警。请分开演练cases和只读alarms：创建只写campus-v2-demo中的cases，原始报警继续使用练习原始集合。保留已创建的演练记录，不通过清空全部数据修复。
```

独立事件能保留后，进入第 3 步。

