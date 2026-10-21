## 第 1 步：把练习数据放进自己的前端

**现在在哪：**CodeBuddy 文件区，先点开 `materials/mock-campus.json`。不用逐字看完，找到 `spaces`、`devices`、`points` 三处：它们分别是空间、设备、设备读数。

在 Craft 对话框发送：

```prompt
继续 campus-lab，只完成第02课第1步。先读 materials/约定卡.md 和 materials/mock-campus.json。
创建 frontend/mock-data.js，将公开 JSON 完整转换成可导入的 JavaScript 数据，导出名为 mockCampus。不要编造、删减或修改练习数据。
创建 frontend/data-service.js，导出异步方法 getOverview()、getDevices()、getSpaces()。getOverview返回包含spaces、devices、points、history、alarms的完整练习数据；另两个方法分别返回devices、spaces。每次返回独立副本，页面不要直接改原始mockCampus。
app.js以后统一从data-service取业务数据，不直接导入mock-data。保留现有外观和菜单。在概览底部增加一句“数据方式：浏览器演示（教学模拟）”，读取成功后显示练习数据的设备、空间、点位数量；暂不改上面的三张卡片。
不要请求后端，不把materials整个目录开放到浏览器，不安装依赖。保存文件，不启动服务，不继续下一步。
```

**等到什么：**等 AI 保存并回复完成。左边应新增 `mock-data.js`、`data-service.js`。确认文件位于 `frontend`，然后刷新浏览器。

**自己点看：**打开“概览”，读底部那一句。

**应该看到：**“浏览器演示（教学模拟）”，以及 **16 台设备、4 个空间、28 个点位**。这三个数量是从练习数据数出来的；上方卡片暂时仍是“尚未载入”。

**如果数量不对或页面空白：**只发下面这段，并补充实际显示的数量：

```prompt
第02课第1步预期从公开练习JSON读到16台设备、4个空间、28个点位，实际结果不一致。我将补上看到的内容。请核对JSON转换、模块导入和返回的数据，修复本步问题。不要把16、4、28硬写成显示结果，不修改练习JSON，也不要引入后端。
```

三个数量正确后，进入第 2 步。

