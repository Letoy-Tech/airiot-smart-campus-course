# 第03站实际验收

本次由 CodeBuddy CN 4.12.2 内置 Deepseek-V4.1-Flash 实作 DeviceCatalog.vue，未使用百炼 Qwen，未读取教师业务答案或执行 progress apply。教师 begin 提供 API、store、filterDevices、请求范围、轮询工具与测试；操作者按 Ask 回答补写项目卡并操作终端、浏览器和数据库准备，没有手写本站业务代码。

正式 verify 退出0：类型检查、8文件46测试、生产构建通过。模型完成前自行修正一次模板嵌套警告，未经操作者业务修补。

浏览器真实操作：16台→空间01的4台→输入 teaching_env_01 的1台→不存在设备的0台；显示“暂无匹配设备”，清空回到16台。环境+在线+名称组合筛出相同ID，卡片和表格一致。点击详情后刷新，URL和详情仍为 teaching_env_01，空间01、在线、模拟来源一致。截图和AX证据位于上级 evidence/stage-03 与 screenshots。

本地MySQL8.4.10，独立23491端口，2次迁移成功；运行账户仅独立lab库DML，另一schema访问被拒绝。Flyway对8.4有未充分测试版本警告，已保留日志。未接学校数据库或真实AIRIOT，未人工计时验收15秒轮询和离页取消；该部分只具有模型实现和给定工具测试证据。
