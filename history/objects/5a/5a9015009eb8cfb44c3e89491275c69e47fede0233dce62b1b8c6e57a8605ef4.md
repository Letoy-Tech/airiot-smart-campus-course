# 智慧校园 AI 编程教学工程

这是48学时课程的完整教师参考实现，独立于原有智慧校园平台。必修使用固定模拟数据和教师提供的MySQL，覆盖设备、空间、监测、历史、身份权限、事件闭环、责任与时间线。AIRIOT保留只读选做组件，尚未接入真实平台。学生通过小块实现、请求实验和证据解释完成学习，不要求从零编写认证或数据库框架。

## 从哪里开始

- [跨平台启动](docs/01-跨平台启动.md)：JDK17、Node22、依赖、四个随机本地账号、两个终端。
- [教师数据库交接](docs/02-教师数据库交接单.md)：每组独立库、显式迁移与运行账号。
- [逐章资源与任务映射](docs/03-资源与章节映射.md)：第04—12章的实际文件与操作单。
- [学生分章起点](../student-chapters/README.md)：每章一个独立副本，只保留本章TODO；不要覆盖学生已有作业。
- [教师参考答案与讲评](../teacher-guide/README.md)：逐章答案、评分、故障与M1—M5验收。

## 启动与验证

先按启动说明设置JAVA_HOME并切换Node22。在本目录执行：

```sh
node tools/course.mjs doctor
npm --prefix frontend ci
node tools/course.mjs init
node tools/course.mjs build
```

第04章终端A运行 `node tools/course.mjs backend`，终端B运行 `node tools/course.mjs frontend`，打开 `http://127.0.0.1:5178/#first-read`。这个模式不连接MySQL，仅一空间两设备。

第05—12章先由教师核对 `.private/database.json` 并执行 `node tools/course.mjs migrate`；再用 `node tools/course.mjs backend-db` 代替终端A命令，打开 `http://127.0.0.1:5178/#devices`。完整目录为4空间、16设备、28点。两种后端模式都占用8091端口，不同时启动。停止时在对应终端按Ctrl+C。

`node tools/course.mjs check`运行固定夹具、普通后端测试、前端类型及单元测试。真实MySQL测试由教师配置独立 `_test` 库并明确允许清理后执行 `node backend/tools/test-mysql.mjs test`；它不是普通check的隐含步骤。详细场景见第11章操作单。

## 工程地图

| 目录 | 作用 |
| --- | --- |
| backend/src/main/java/edu/campus/course | 控制器、provider、服务、Mapper、权限与事务 |
| backend/src/main/resources/db/migration | 只新增的Flyway迁移 |
| backend/src/test | 规则测试与真实MySQL集成、竞争、故障回滚 |
| frontend/src/api、stores、domain | 请求合同、会话隔离、学生实现的小块规则 |
| frontend/src/views、components | 设备、空间、监测、历史、事件、责任及图表 |
| fixtures | 可重复目录、时钟、质量、历史和场景预期 |
| docs | 跨平台启动、数据库交接与每章操作单 |
| evidence | 作者实际验证记录；不是学生个人完成证据 |

数据观测时钟固定为2026-10-18 14:00北京时间；事件、责任、审计使用服务端操作时间。网页刷新会重新读取模拟样本，不代表设备正在实时采样。数值0保留，null明确缺失；电压V、功率kW不能换算成电量或费用。

## 验证边界

作者本机以macOS、独立MySQL8.4.10和Chromium验证参考工程。学校数据库、Windows实机、学生独立复现和课堂耗时仍需教师课前试跑。AIRIOT显示未配置，不把模拟结果当外部接入证据。后端Flyway版本对MySQL8.4有兼容提示，本机迁移与事务验证另有实际记录；学校版本变化须重跑。

账号、数据库密码和本地运行数据均位于忽略目录，不随资源包分发；用 `init`为每份工程生成自己的账号。不要把 `.private`、node_modules、target、dist或教师PASS记录提交为学生源码成果。
