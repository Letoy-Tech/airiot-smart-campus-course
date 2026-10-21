# 当前终端、独立服务与数据库

课程冻结 Node 22.21.1、JDK 17；脚本接受 Node 22.x（至少22.12）。第01站只需Node；第02站起再核对Java。Windows实机仍须教师课前试跑，不把macOS成功写成Windows通过。

## 每个新终端都要配置

先确认CodeBuddy打开的是自己的app，终端目录直接包含frontend和tools。不能只在一个终端设置JAVA_HOME后就假定其他终端相同。

macOS（当前终端）：

```sh
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
export PATH="$JAVA_HOME/bin:$PATH"
node --version
java -version
node -p "process.cwd()"
```

Windows PowerShell（先核对安装位置，以下只接受唯一的Temurin 17目录）：

```powershell
$courseJdks = @(Get-ChildItem "C:\Program Files\Eclipse Adoptium" -Directory | Where-Object Name -Like "jdk-17*")
if ($courseJdks.Count -ne 1) { throw "请教师确认唯一JDK17根目录；不要猜安装路径" }
$env:JAVA_HOME = $courseJdks[0].FullName
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
node --version
java -version
node -p "process.cwd()"
```

JAVA_HOME是JDK根目录，不能指向bin。只设置JAVA_HOME而PATH仍是Java21，会导致不同命令使用不同JDK；`doctor-env`现在会明确拒绝此情况。不要修改全局shell或系统执行策略来处理一个课程终端的问题。PowerShell中npm.ps1受限时用npm.cmd。

第02站begin之后：

```sh
node tools/course.mjs doctor-env
```

它只核对当前Node、JAVA_HOME和PATH中的java；可在前端已运行时执行。`doctor`还会检查文件和8091/5178端口，因此应在本人服务尚未启动时运行。端口占用只报告，不能结束未知进程。

## 第02站先让后端独立运行

先安装前端依赖 `npm --prefix frontend ci`。begin02后业务页仍待实现，完整build预期可能失败；不要为启动后端而复制答案、删除测试或改依赖。

```sh
node tools/course.mjs init
node tools/course.mjs build-backend
node tools/course.mjs backend
```

build-backend只构建教师后端，不编译未完成前端。终端A保持后端运行；终端B在app内执行`npm --prefix frontend run dev`。前端5178，后端8091，都仅回环。业务页完成后再`node tools/progress.mjs verify`；完整check/build仍是后续验收步骤，build-backend不能替代它们。

init只生成当前副本的.private/accounts.json，已有文件不覆盖，密码不输出到终端。只在本机查看，不贴给AI。

## 第03站由教师交接数据库

学生不必自行安装MySQL。教师提供本组独立数据库、一次性迁移配置和日常DML运行配置，按docs/02-教师数据库交接单.md核对目标，再明确运行migrate。完成后换回日常账号，不能让日常账号长期保有DDL或其他组权限。

停止本人first-chain后端（原终端Ctrl+C），切`node tools/course.mjs backend-db`并重新登录。16设备来自固定教学目录，不是数据库连接成功就等于真实校园接入。第11站可清理测试另用带allowTestReset的_test库；绝不把lab/学校库改成可清理测试库。

## 交接必须在新目录

导出不带.private、.codebuddy、lesson-bundles、journey-backups、依赖、产物或日志。hand-in只读取当前app；要交的设计材料先放app/docs或app/project-docs，不再自动读取上级目录。

接手者安装依赖→设置两个终端的环境→doctor→init新账号→check/build→教师准备其独立库并迁移→启动backend-db与前端→用新账号登录→查同一设备、历史、完成一件本地事件→刷新确认持久化。缺数据库配置应停在明确的前置条件，不能写“开箱即跑”。如果同一机器已运行作者服务，先由作者停自己的进程；不要连接作者旧服务冒充接手成功。

新目录模拟、另一名真人接手、Windows、学校数据库、真实AIRIOT分别记录。Ctrl+C停止自己的两个服务；数据库按教师专属工具停止或保持，不能关闭共享数据库。
