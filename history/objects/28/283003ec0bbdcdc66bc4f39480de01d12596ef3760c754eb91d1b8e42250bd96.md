# 逐站工程工具交接

已冻结。最终 BUILD-MANIFEST SHA256：`073768bb0e301178174c77351b49446686b9ac9dfb08aa38247431185b6b0c77`。

这是“前端业务逐站制作、后端完整参考服务复用”的连续工程。起点不是完整平台挖去九个 TODO：第 01 站只有静态两设备页面及七个前端源文件，没有 API、认证或未来业务页面。完整后端从第 02 站提供，必须如实称为教师底座。账户、组织等原平台通用后台的全量覆盖不能靠本工具宣称完成。

## 交付结构与命令

学生只复制一次 `app/`，放到桌面 `campus-ai-lab/app`。后续所有命令在这一个目录执行。`lesson-bundles/` 随 app 携带，不引用作者机器路径。

```text
npm --prefix frontend ci
node tools/progress.mjs verify
npm --prefix frontend run dev

node tools/progress.mjs list
node tools/progress.mjs plan 02
node tools/progress.mjs begin 02
node tools/progress.mjs show 02 frontend/src/views/FirstDeviceRead.vue
node tools/progress.mjs verify
node tools/progress.mjs accept 02 evidence/stage-02.md
node tools/progress.mjs status
```

第 01 站使用直接 npm 命令，不调用依赖 Java 的 course 启动工具。第 02 站 begin 后才有后端、fixtures、course.mjs；设置当前终端 JAVA_HOME 后，按 app README 执行 init/build/backend。第 03 站起由教师交接每组隔离数据库，切换到 backend-db。工具验证本身不迁移或清理数据库。

`begin` 加入公共依赖与明确未完成的业务骨架。CodeBuddy 根据本次 manifest、项目卡和接口文档修改当前业务文件；存在未完成标记时 verify 会拒绝。`apply 02` 是显式导入完整参考的恢复途径，不能称为学生或 AI 已自行实现。

`verify` 运行当前前端类型、单元测试与构建，允许学生实现与参考不同；不把答案哈希相同当通过。`accept` 只登记学生人工记录，不判断真实性。状态分别显示源码准备、前端构建、人工记录，不自动宣布 100%。

## 逐站目标文件

以下路径均在 `frontend/src/views/` 下；manifest 的 `businessFiles` 是相对 app 的完整路径。

| 站 | 新业务目标 |
| --- | --- |
| 01 | StaticDevices.vue；可长期修改 project-settings.ts、domain/journey-exercises.ts |
| 02 | FirstDeviceRead.vue |
| 03 | DeviceCatalog.vue |
| 04 | LocationsView.vue |
| 05 | OverviewView.vue、EnergyView.vue |
| 06 | HistoryView.vue、RawAlarmsView.vue |
| 07 | AccessView.vue；阅读 domain/course.ts 与公共授权底座 |
| 08 | CasesView.vue，先做列表、分派、开始和记录 |
| 09 | CloseChecklist.vue；开启已有事件页的恢复、核实、关闭入口 |
| 10 | OwnersView.vue、AuditView.vue、IntegrationView.vue |
| 11 | 不加业务页面；补完整测试和调试记录，实际排查 api/campus.ts |
| 12 | 不加业务页面；加入 tools/hand-in.mjs、交付核对文档 |

每站 `lesson-bundles/stage-NN/manifest.json` 包含 `stage/title/mode/goal/contract/acceptance/businessFiles/scaffoldingFiles/contextFiles/files`。每条 files 包含 path、sha256、bytes、role；业务骨架另有 stub。`show` 读取 `files/<path>` 完整参考。

各业务文件只在首次加入时导入，后站不覆盖它。阶段装配文件 App.vue、FullWorkspace.vue、src/journey/ 不作为日常练习目标。学生同名自建文件或改过的装配发生冲突时整个导入拒绝，双方文件备份在 journey-backups/before、incoming；没有 force。选择采用参考前可比较备份，仅手动复制确认的冲突文件再重跑，不能覆盖整份个人作业。

CODEBUDDY.md 已在 app 与 reference 根目录，规定先读当前状态和本次 manifest、不自动推进、不读秘密、不改认证或依赖、完工报告实际检查。这是行为约束，不是操作系统权限隔离。

## 实际验证

- 作者使用 Node 22.21.1、JDK 17.0.6、macOS。另建临时目录复制 app，`npm ci` 从冻结 lock 安装；可能复用本机 npm 下载缓存。Maven 使用已有本机缓存，不构成断网首装证明。
- progress 工具 12 项测试通过：路径和符号链接保护、顺序、旧验证失效、骨架、重复 begin、备份、个人冲突、包损坏、学生不同实现、检查中改动和人工记录。
- 隔离 app 从第 01 至 12 站逐一 begin/apply/verify，12 站类型、当前单元测试、build 全通过。第 01 站修改的项目名称跨全部阶段保留。最终前端 16 个测试文件、74 项通过。
- 后端 package 成功：50 项中 34 项执行通过、16 项真实数据库测试跳过。未访问或修改数据库，不能据此宣称 MySQL 通过。
- 第 11 站将成功条件 `response.code !== 0` 错改成 `=== 0`，实际出现两项业务断言失败，其中包括“成功空数组仍保留后端观察时间”；还原后同一文件的 10 项测试全过，源码 SHA 完全恢复。没有把任意非零退出当作预期成功。
- 审计导航新增两项严格能力回归。首轮修正后早期站被类型检查发现键类型过窄，已修成字符串判断并重新跑完 12 站；失败未计入通过。
- 构建仍提示历史图表块超过 500 kB，仅为体积提示，本轮未为消除提示改变依赖。

报告：[author-verification.json](author-verification.json)、[debug-wrong-fixed.json](debug-wrong-fixed.json)。最后仅修正作者证据悬空链接，并区分早期跳过数据库测试与随后独立 MySQL 复核；[doc-only-rebind.json](doc-only-rebind.json) 记录实际测试 manifest 与最终 manifest 的对应，3 份 README 和 3 份相关元数据变化，其余 551 项生成文件字节相同。

本工具作者验证未运行浏览器、CodeBuddy 实际生成、Windows 实机、真实学校数据库或 AIRIOT；其他人员的 HTTP/浏览器报告另行引用，不混入本报告。完整参考恢复路线通过不意味着任意 AI 输出都能通过，学生仍须执行 verify 与真实业务检查。

## 作者重建

```text
node tools/build-progress-project.mjs --refresh
node resources/project-journey/authoring/verify-built.mjs
node resources/project-journey/authoring/verify-debug.mjs
```

以上在课程根目录。生成器仅允许替换仍与上次清单一致的生成文件；拒绝个人修改和未知输出。`--allow-pending` 仅开发用，本轮未使用，pending 为空。重建会变更 manifest，应重新绑定检查报告；不能直接把旧报告改成新实测结论。
