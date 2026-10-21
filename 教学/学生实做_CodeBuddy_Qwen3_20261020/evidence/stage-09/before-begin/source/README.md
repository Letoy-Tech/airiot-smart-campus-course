# 同一份 app，逐站增加业务

把这个app文件夹整体复制到桌面campus-ai-lab/app，只复制一次。lesson-bundles必须一起保留；所有命令在app目录运行。源码包不含密码、依赖或构建产物。

起点是静态两设备页面。前端业务逐站组装；后端为完整、可读可改的公共参考服务，不声称从空实现后端或认证。通用账户/组织后台是否完整复刻，须对照最终功能清单，不能只凭本工具宣布完成。

## 第一次运行

使用Node22.21.1；先执行npm --prefix frontend ci，再执行node tools/progress.mjs verify。然后npm --prefix frontend run dev，在浏览器打开http://127.0.0.1:5178。第01站不需Java、账号或数据库。Windows若npm.ps1被限制，用npm.cmd替代npm。

## 每站操作

1. node tools/progress.mjs plan 02 ——读本次文件、契约和检查动作。
2. node tools/progress.mjs begin 02 ——上一站verify通过后，准备公共依赖、装配与明确未完成的业务骨架。
3. 在CodeBuddy IDE打开plan列出的业务文件，在CodeBuddy中用@文件引用本次接口与相关源码，请它只修改目标文件；不要引用.private。
4. node tools/progress.mjs show 02 frontend/src/views/FirstDeviceRead.vue ——需要时读一份完整参考；也可直接打开lesson-bundles对应文件。
5. node tools/progress.mjs verify ——检查当前实现的类型、前端单元测试和构建，接受自己的代码，不比较答案哈希。
6. 实际点页面并写evidence/stage-02.md，再运行node tools/progress.mjs accept 02 evidence/stage-02.md登记。工具不替你核实这份文字。
7. node tools/progress.mjs status ——分别看已导入、构建、人工记录；再plan/begin下一站。

遇到AI方案暂时无法修好，可以node tools/progress.mjs apply 02导入本站完整参考。它先备份，仅替换未被修改的骨架或旧参考。个人代码冲突时整个导入停止，并在journey-backups提供before/incoming供比较；确认需要参考后，仅复制该incoming文件到原位置再重跑。原个人文件备份仍在。没有强制覆盖选项。

业务文件加入后不在后站重写；请把自己的页面修改留在该文件。project-settings.ts与domain/journey-exercises.ts从第一站长期保留。App.vue、FullWorkspace.vue和journey目录是阶段装配，不作为日常练习修改；确需改动时按冲突流程人工保留。

## 从第02站开始使用后端

后端已由教师提供全部参考业务。第02站：设置当前终端JAVA_HOME到JDK17，node tools/course.mjs init生成本机账号（不打印密码），node tools/course.mjs build；终端A执行node tools/course.mjs backend，无数据库。终端B运行npm --prefix frontend run dev。前端构建验证不等于后端或HTTP验证。

第03站起先由教师交接每组隔离数据库和迁移，见docs/02-教师数据库交接单.md。退出旧登录，停止本人旧backend，确认配置，再node tools/course.mjs backend-db并重新登录；不要清库。Java改动需停后端→build→重新启动。每个新终端分别设置JAVA_HOME。

## 验证边界

verify不启服务、不写数据库，不表示浏览器、Windows或真实AIRIOT已验证。业务记录由人实际操作填写；第11站真实并发回滚另用独立可清理_test库，分页验收用独立数据。1%—100%只是教学里程碑，本工具不会自动宣布100%。真实AIRIOT选做，远端控制与外部通知关闭。

第12站才加入tools/hand-in.mjs，导出源码时排除.private、node_modules、target、dist和备份，并检查已知本机密码。交付后仍须别人独立复现。
