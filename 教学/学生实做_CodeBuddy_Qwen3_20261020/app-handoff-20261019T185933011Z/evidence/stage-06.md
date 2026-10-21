# 第06站实际验收

CodeBuddy内置DeepSeek分别实现HistoryView.vue和RawAlarmsView.vue。真实浏览器验收发现跨站入口缺失后，另发2次最小修复提示，由同一IDE模型补DeviceCatalog点位历史链接及EnergyView接入教师CompareHistory。操作者没有手写业务代码；教师API、HistoryChart、CompareHistory、轮询和请求隔离复用均单列，不算本轮从零实现。

从teaching_energy_01详情点击power进入历史，设备/点位参数一致；15分钟、1小时、6小时样本表均保留1.2/null/0/1.8，截图实见null断口和0落在零点。查询时刻为2026-10-20本机实际时间，固定采样时钟为2026-10-18，两者分开。历史成功空结果与失败提示分别验证。

能源四台kW历史先全部成功；再让01失败，其02:06:32旧快照保留，另外三台成功查询更新到02:06:37，图中四条曲线仍在。切换V后比较为V，失败选择重置，4台成功。该故障为给定后端scenario受控样例，不是实际设备故障。

原始报警5条，limit=2时实走skip=0/2/4三页。保留ACTIVE/RECOVERED/vendor:17/ACK_PENDING/UNMAPPED_RAW_STATUS及原始等级、空时间；无关闭/确认/恢复上游按钮。成功空结果与读取失败各验证，失败保留上次成功快照并明确不是新的空结果。

正式verify退出0：类型、8文件46测试、生产构建。ECharts chunk大于500kB的构建提示保留。模型有多次内部自查修补，操作者额外业务修复提示2轮。为避免通用课程规则与本轮禁止答案要求冲突，操作者只收紧CODEBUDDY.md的参考读取规则并加.gitignore忽略，属于操作辅助，非学生代码；不将其视为操作系统隔离证明。未接真实AIRIOT或学校数据库，未测Windows。
