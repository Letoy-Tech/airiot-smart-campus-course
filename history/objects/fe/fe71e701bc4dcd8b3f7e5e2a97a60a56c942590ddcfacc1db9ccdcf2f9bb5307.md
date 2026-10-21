# 先准备，再做第一张页面

这条主线只用一个工程：桌面 `campus-ai-lab/app`。前端业务页面逐站增加；认证、请求、数据库和完整后端服务由教师提供可读源码。你会让CodeBuddy 写页面，也会读和修改后端业务规则。参考源码是失败时的对照，不是你的完成记录。

## 先装工具，再复制工程

先从 [CodeBuddy官方下载](https://www.codebuddy.cn/downloads/) 选择独立 IDE：Windows选对应Windows版本；Mac按“关于本机”中的Apple芯片或Intel选择。安装后按屏幕提示登录账号。Node 22.21.1、JDK 17和Git的安装细节见[工具安装步骤](../walkthroughs/index.html#part-04)；只看安装部分，不必另外安装VS Code。回来复制本页的project-journey/app，不复制旧student-project。

1. 完整解压教学包，打开 `resources/project-journey`。
2. 把其中的 `app` 复制到桌面 `campus-ai-lab`。若已有同名作业，保留它，新建 `campus-ai-lab-v12`；不要覆盖。
3. 在 CodeBuddy IDE 点“文件 → 打开文件夹”，选择刚复制的 `app`。左边应直接看到 frontend、tools、lesson-bundles；backend会在第02站加入。
4. 顶部点“终端 → 新建终端”。后面所有命令默认在这里执行，逐行粘贴、按回车、等结束。

```sh
node --version
java -version
node -p "process.cwd()"
```

预期 Node 为22.21.1，Java为17，当前目录以app结尾。找不到命令：安装后完全退出再打开CodeBuddy IDE；仍失败让教师看第一条错误。

## Java只设置当前终端

macOS：

```sh
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
```

Windows PowerShell（默认Temurin安装位置）：

```powershell
$courseJdk = Get-ChildItem "C:\Program Files\Eclipse Adoptium" -Directory | Where-Object Name -Like "jdk-17*" | Select-Object -First 1
if (-not $courseJdk) { throw "请教师确认JDK17安装位置" }
$env:JAVA_HOME = $courseJdk.FullName
```

每个新终端都要设置。不要把bin目录当JAVA_HOME。

## 第一次启动

```sh
npm --prefix frontend ci
```

Windows遇到npm.ps1限制时，把npm改成npm.cmd。不要改系统策略。5178端口被占用时，先检查自己之前的终端，不结束未知进程。

第01站只启动前端：

```sh
npm --prefix frontend run dev
```

看到本地地址后，在浏览器打开 http://127.0.0.1:5178 。这个终端保持运行；要停，在这个终端按Ctrl+C。教程在浏览器中阅读，代码和AI在CodeBuddy IDE中操作，运行结果在上述本地程序地址查看。

## 第02站才启动后端

先运行第02站begin加入后端文件，再另开终端，设置JAVA_HOME，检查、初始化和构建：

```sh
node tools/course.mjs init
node tools/course.mjs build
node tools/course.mjs backend
```

后端保持运行。登录密码在本机 `.private/accounts.json`，用编辑器查看，不复制给AI。第03站起让教师按数据库交接单准备本组库；停掉first-chain后用下面命令启动：

```sh
node tools/course.mjs backend-db
```

数据库配置和迁移由教师确认；学生不需要安装MySQL。出现连接错误时，先检查本组配置和网络，不能改连原平台数据库。

## 第一次和 CodeBuddy 协作

1. 确认IDE打开的是自己的app。右侧打开CodeBuddy对话；若你进入的是Agents首页，先选择“编程模式”。
2. 打开模式选择，选 **Ask**。先发送：“只读取CODEBUDDY.md和journey-state.json，告诉我现在第几站，先不要改文件。”预期它引用本工程的实际文件；找不到就先检查打开的文件夹。
3. 对话输入框输入 `@`，选“Files & Folders/文件与文件夹”，输入本页目标文件名，点选它。看到文件引用后，再发送本页提示词。不要引用整个电脑目录。
4. 讲清需求后切 **Craft**，让它改本次文件。复杂的多文件任务用 **Plan**，先读计划，确认只涉及本次目标再执行。
5. 完成后打开本次变更/差异，逐个点文件名。新增/删除的行是什么？是否只改了本次文件？按“保存全部”，再在终端运行本页的verify。AI写“完成”不代表程序通过。
6. 报错就在同一对话贴第一条错误，让它先定位再改。改完重跑刚才失败的命令。

菜单名称可能随IDE版本变化；课堂先由教师统一安装版本并演示入口。模型选择使用学校允许、账号实际可用的模型，课前记录其名称；本教程不假定每个账号都有Qwen3，也不要求学生购买API。没有可用额度时，先用本站参考源码完成运行与检查，保留“AI未执行”的记录。

[官方概述：Ask/Craft/Plan与文件引用](https://www.codebuddy.cn/docs/ide/User-guide/Overview) · [官方项目规则](https://www.codebuddy.cn/docs/ide/User-guide/Rules) · [官方结果查看](https://www.codebuddy.cn/docs/ide/User-guide/Agent-Mode/Results)。核对日期：2026-10-19。本文描述操作方法，没有声称已在学生账号中实际执行AI任务。

## 保留自己的改动

每站开始前，工具检查前站是否构建通过，并保护已改文件。看到冲突先停止，让CodeBuddy对比当前文件、参考文件和备份，只合并本次新增功能。不要让它删除状态文件或用reset跳过检查。

参考源码是对照。用了哪些、自己写了哪些，都在evidence里记一行。`.private`中的账号和数据库密码不交给AI，CODEBUDDY.md是行为约定，不是阻止AI读取文件的安全隔离。
