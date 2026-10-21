# 第07站实际验收

CodeBuddy内置DeepSeek仅实现AccessView.vue，使用给定strictCapability，不改认证、权限、测试或domain函数。操作者在IDE打开domain/course.ts核对；正式46测试包含true允许、false/字符串true/false/数字1/0/null/undefined/对象/数组均拒绝的既有用例，未把页面静态说明当测试结果。

浏览器实际三次身份：viewer显示1/7能力，仅canRead true；manager-a为2/7，增加canHandleAlarms；admin为6/7，canControl恒false。账号、角色与当前身份同步，未展示CSRF/Cookie/密码。viewer实读16台台账和教学楼A/1层位置，无写入口；同一服务的独立HTTP探针再测viewer直接PUT为403且绑定不变。切回admin后保存绑定入口恢复，没有重做写入。

独立HTTP补验：匿名读devices返回401；viewer及manager-a读接入状态返回403；admin返回200且controlEnabled=false。正式verify退出0：类型、8文件46测试、构建通过。全部为独立本机教学环境；manager本人事件的后端限制将在第08站用真实本地事件验证，未提前算通过。无参考导入，无操作者业务代码修补。
