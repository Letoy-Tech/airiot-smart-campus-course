# 同一份app，逐站实现与验证

V1.2.1修订起点。将app整体复制到自己的campus-ai-lab/app，只复制一次；学习阶段保留lesson-bundles。不要覆盖已有作业。第01站为两台静态设备；后端、API、类型、组件和测试由教师提供，业务页面由学生在CodeBuddy中实现。这不是模型从零生成全栈系统的证明。

## 从环境到第02站

详细步骤见docs/01-跨平台启动.md。先用Node22.21.1安装`npm --prefix frontend ci`，第01站用`npm --prefix frontend run dev`。第01站不需Java、账号或数据库。

第02站begin后，**每个新终端同时设置JAVA_HOME和PATH中的JAVA_HOME/bin**。运行`node tools/course.mjs doctor-env`核对当前终端；Windows中npm.ps1受限则用npm.cmd，不改系统策略。

```sh
node tools/course.mjs init
node tools/course.mjs build-backend
node tools/course.mjs backend
```

build-backend不编译待写前端，因此不再被FirstDeviceRead骨架阻塞。另一个终端运行前端，页面完成再verify。后端旧JAR更新前先停本人后端，再构建、重启；不能将后端单独构建称为前端或业务通过。

第03站起，教师按docs/02-教师数据库交接单.md准备本组独立库、明确迁移、切回日常DML配置。停本人first-chain，再backend-db，重新登录；不清库、不改连原平台。

## 每站按计划操作

1. `node tools/progress.mjs plan 06`：看新增文件及“继续修改”的跨站组装文件。
2. `node tools/progress.mjs begin 06`：只加公共依赖、装配和新业务骨架，保留已做页面；重复begin不重置作业。
3. 在CodeBuddy Ask理解合同，用@引用本次**实际文件**，再在Craft按目标实施。第06站还要改已有DeviceCatalog/Energy，第09站还要改已有Cases；这些不会被begin自动覆盖。
4. 审阅IDE变更，确认无无关文件、测试或依赖变化。默认不读教师参考/备份，不自动apply。不在无.git工程强行用git status作为变更证明。
5. `node tools/progress.mjs verify`：当前类型、前端单测和构建；新增回归在功能对应站出现，不能拖到第11站才修。
6. 亲手操作页面并记录实际结果、错误分支和未测项到evidence/stage-06.md，再`node tools/progress.mjs accept 06 evidence/stage-06.md`。工具不判断文字真假。
7. `node tools/progress.mjs status`：分别看源码模式、前端构建与人工记录。百分比是教学目标，不是自动完成率。

确实需要参考救援时，由学生/教师明确选择并记录来源，再使用show或apply。apply会备份并拒绝覆盖个人修改，不能把参考导入写成AI生成；不要删除状态/备份或强制覆盖。此为可选救援，非AI主线步骤。CODEBUDDY.md只是行为约束，不是操作系统隔离。

## 第06/09站必须完成组装

第06站：台账详情生成实际deviceId/tagId的历史链接；能源页接已有CompareHistory，只传category=energy设备和当前power/kW或voltage/V，不混入温湿度、不换算kWh。一台失败保留该台旧快照，不拖垮其他设备。

第09站：只做CloseChecklist不够。继续改自己的Cases，读取journey/features开关并挂载组件；由工作台调用恢复、独立核实和关闭API，各带expectedVersion，成功后独立回读。恢复/核实不自动关闭；409保留输入、回读后仍需人工核对才允许重提，回读失败继续锁定。

## 第12站交付

先保留实际验收记录，完成check/build。请AI局部完善本README，写实际工具版本、安装、数据库前提、两个终端、主流程、已知未验证项；不要照抄作者通过记录。

```sh
node tools/course.mjs check
node tools/course.mjs build
node tools/hand-in.mjs
```

hand-in输出app同级的新目录与HANDIN-MANIFEST.json。默认排除.private、.codebuddy、lesson-bundles、journey-backups、依赖、构建产物和日志；不读上级docs。工程需交的材料先放本app/docs或project-docs。扫描本机已知密码不等于完整秘密检测，仍应检查文字和截图。

接手者在新目录安装依赖、配置两个终端、init自己的账号，取得自己的教师独立库并明确迁移后再启动；原作者服务不能冒充新目录进程。导出包没有lesson-bundles，因此不再用begin/show/apply；用course工具运行当前实现。新目录应从自己的空业务记录开始，查同一设备→历史→一件本地事件完整关闭，刷新确认。

工具构建、真实HTTP、MySQL事务、浏览器、新目录模拟、另一真人、Windows、学校库和真实AIRIOT分别记录。普通后端测试有SKIPPED不能称全通过；真实回滚另由教师在独立_test库运行。真实AIRIOT选做，远端控制与外部通知关闭。
