# 第04站实际验收

CodeBuddy 内置 Deepseek-V4.1-Flash 在 Ask 后仅实现 LocationsView.vue。教师提供位置API、服务端权限与数据库；操作者据模型回答补两份文档、操作GUI和独立HTTP验收探针，没有手写学生业务代码，未用参考答案。

管理员通过学生表单创建“课程校园”、其下“教学楼A”，绑定 teaching_space_01 到该楼栋，楼层“1层”。刷新并重新登录 viewer，实时DOM仍显示课程校园/教学楼A/1层；查看者无保存表单。后台辅助树曾返回过渡/滞后页面，相关历史证据保留；以11-viewer-realtime-dom.txt、viewer-confirmed截图及独立HTTP回读确认实际结果。

操作者独立HTTP探针用本练习本机账号验证：不存在的楼栋返回404，完整locations前后相同；viewer直接PUT返回403，完整locations仍相同。首次探针误以为devices响应有顶层source而主动拒绝执行写入，改为核对overview的TEACHING_MOCK后重跑通过。探针属于验收辅助，不计入学生实现。

正式verify退出0：类型、8文件46测试、生产构建通过。模型先自行修复类型错误；其npm test命令无该脚本，不能算单测成功，正式verify使用正确test:unit。未接入真实校园或AIRIOT，数据库仍是独立教学库。
