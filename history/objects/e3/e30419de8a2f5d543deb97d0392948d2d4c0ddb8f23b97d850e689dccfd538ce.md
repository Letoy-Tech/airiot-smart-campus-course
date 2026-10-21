# 轮10前端功能补齐交接

本记录仅说明源码、单元测试和构建。真实 HTTP/浏览器联调将在独立 reference 副本另行记录，不能由这里推断通过。

## 已完成

- `views/EnergyView.vue`：独立能源页；kW/V切换、按全部空间展示最新值、服务端质量和采样时间；不计算kWh/费用/节能率。
- `components/CompareHistory.vue`：能源与环境共用同单位、多设备历史比较；15分钟/1小时/6小时；逐设备读取失败保留上次成功快照，独立列出成功查询时刻、查询范围、错误、截断与原始样本。null断开、0保留，响应设备/点位/单位/范围不符拒绝。401会话清理、403清快照并停止查询。
- `views/OverviewView.vue`：空间/类型统计可钻取台账hash筛选；空间质量矩阵；温度/湿度历史比较。
- `views/DeviceCatalog.vue`：表格/卡片切换；hash恢复空间、类型、在线、关键词；点位最新值/质量/时间及携带deviceId/tagId的历史链接；两类读取完成后15秒再刷新，离页停止。
- `views/HistoryView.vue`：稳定点位链接恢复；未知设备/点位明确拒绝；独立成功查询时间。
- `views/RawAlarmsView.vue`：只读报警分页，完成后30秒刷新；正常/成功空/失败教学情境；失败快照仍标明原页码；状态原文保留，不映射本地处置状态。
- `views/AuditView.vue`：严格管理员与审计能力读取；分页和三情境；明确历史教学样本与控制关闭；无命令写入口。
- `views/CasesView.vue`：任意有效handler筛选；本页四状态计数按钮，点击回到第一页；保留409回读、输入保留、不自动重放。
- `views/FullWorkspace.vue`接入新入口，非管理员隐藏审计导航；直接地址进入仍由页面和服务端分别拒绝。

## 其他文件

新增 `api/read-models.ts`、`types/read-models.ts`、`domain/read-models.ts`、`composables/useReadPage.ts`；修改 `api/full.ts`（可选queriedAt形状校验）、`types/full.ts`、`components/HistoryChart.vue`（同单位多曲线）、`style.css`。

新增测试 `read-models.test.ts`、`read-api.test.ts`、`read-pages.test.ts`、`comparison.test.ts`、`monitoring-views.test.ts`；扩展 `workflow-views.test.ts`。本轮增加16项，合计70项。

## 实际检查

使用Node22.21.1。按锁文件安装依赖；type-check、Vite build通过。最后复选框CSS权重调整后再次完整build通过。

- 原student-project保留第04章A/B起点TODO：70项中63通过、7失败。7项均为A/B未实现导致，未删除或弱化测试。
- 仅在frontend内临时隔离副本补A/B参考实现：70/70通过、type-check/build通过。临时副本已移除，源A/B未改。
- 证据：`resources/student-project/frontend/evidence/round10-source-tests.json`、`round10-completed-tests.json`、`round10-summary.json`。summary包含源码SHA-256。
- 构建提示：异步ECharts图表包516.32kB，超过默认500kB提醒；仍成功构建，未把阈值调高掩盖提示。

## 接口与边界

已与后端对齐 `backend/docs/round10-read-api.json`：alarms/command-audit使用limit、skip、scenario；正常报警5条、历史审计3条；history新增queriedAt与可选scenario。前端只接收TEACHING_MOCK/simulated=true及审计HISTORICAL_TEACHING_SAMPLE。未调用真实AIRIOT、外部通知或设备控制。

此次实现阶段未启动服务、未浏览器测试；后续真实运行必须引用独立联调报告。Windows物理设备、真实学生课堂及真实AIRIOT仍无本轮证明。
