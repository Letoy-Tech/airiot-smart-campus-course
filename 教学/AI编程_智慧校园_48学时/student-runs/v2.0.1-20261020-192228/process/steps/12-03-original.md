## 第3步：在新目录生成新配置，用独立数据库重新启动

**现在在哪：** 如果原来的 A、B 仍在运行，在各自原窗口按 Ctrl+C；上次下课已停的窗口无需再操作。C 仍在原 `campus-lab` 根目录。打开 Docker Desktop并等引擎运行，接下来查看、停止旧课程容器并启动新环境。

**发给 CodeBuddy：**

```text
请只核对README的同机新目录步骤与当前工程一致，不替我执行。
旧项目用默认campus-v2停止；新项目所有Docker Compose命令使用-p campus-v2-handoff。
两个项目不能同时占用5188、8098、23501、23502。
新目录必须来自本次源码导出，不复制原.env，不连接原来的MySQL卷；
新.env只生成一次。相同交付目录再次检查时保留该.env与原项目名。
确认Compose的命名卷没有显式name和external；新卷名应以campus-v2-handoff_开头。
不使用down -v、不删除任何数据库卷、不结束未知进程。
如果说明有缺项，只修README并告诉我补了哪一句。
```

**等 AI 完成并保存：** 若 README 有修订，按第2步导出到新的输出目录；接下来使用最新导出。没有修订就使用 `hand-in-v1`。

**亲自操作，先停旧容器：** C、**原** `campus-lab` 根目录：

```text
docker compose stop
docker compose ps
```

在文件管理器里，把最新导出的 `campus-lab` 文件夹复制到原项目旁边，重命名为 **`campus-lab-handoff`**。目标名字已存在时，先确认它是不是你以前的交付副本；不要覆盖或合并。第一次本课实验使用一个确实不存在的新目录。

在 CodeBuddy 另开窗口，打开 `campus-lab-handoff`。为它新建 A-页面、B-后端、C-工具三个终端。以下 C 的工作目录都是**新目录根**：

```text
node tools/setup-env.mjs
docker compose -p campus-v2-handoff up -d
docker compose -p campus-v2-handoff ps
docker volume ls --filter label=com.docker.compose.project=campus-v2-handoff
```

等两个服务 `healthy`。最后一条命令只查看卷名：本次 MySQL 卷应以 `campus-v2-handoff_` 开头。若显示旧项目卷名，先在新 C、项目根运行 `docker compose -p campus-v2-handoff stop`，再修正 Compose 的卷声明，不继续使用旧卷。再在新 B 设置 Java 17：

macOS，新 B 从 `campus-lab-handoff` 根目录开始：

```sh
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
export PATH="$JAVA_HOME/bin:$PATH"
java -version
cd backend
sh ./mvnw test
sh ./mvnw spring-boot:run
```

Windows PowerShell，新 B 从 `campus-lab-handoff` 根目录开始：

```powershell
$courseJdks = @(Get-ChildItem "C:\Program Files\Eclipse Adoptium" -Directory | Where-Object Name -Like "jdk-17*")
if ($courseJdks.Count -ne 1) { throw "请老师确认本机JDK17目录后再继续" }
$env:JAVA_HOME = $courseJdks[0].FullName
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
java -version
Set-Location backend
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
```

测试失败先修，不继续启动。新 A、`campus-lab-handoff` 根目录，两种系统相同：

```text
node tools/serve.mjs
```

浏览器打开 `http://127.0.0.1:5188`，在“数据方式”选择 **“连接后端”**，手动使用**新目录** `.env` 中的 `DEMO_PASSWORD` 登录 `admin`。即使浏览器记住了上次模式，本步也亲眼确认一次。

**应该看见：** 初始16台设备已准备好，旧项目的个人事件、空间改动不会冒出来。这些是同一份源码重新建立的独立课程数据；登录用的是新配置。使用相同地址不代表仍在访问旧服务，所以要先停原 A、B 与原容器。

**失败时，只发这段修复提示：**

```text
我在新目录执行到【命令或登录】时出现【不含私密信息的错误】。
已停止旧项目A/B和默认Compose；新Compose项目名为campus-v2-handoff。
请检查新目录漏文件、端口、环境导入或项目名，不复制原.env、不删卷，
不要把连接旧服务当作新目录成功。
```

**下一步：** 新目录确实启动后，用它完成一件新事件。

