## 第2步：准备后端终端，确认它用的是 Java 17

**现在在哪：** 新建一个终端，命名为 **B-后端**。当前目录应为 `campus-lab`。A 继续运行，不在 A 中输入新命令。

**发给 CodeBuddy：**

```text
这一步只检查后端准备条件，不创建业务代码。
请检查当前工程有没有 materials/maven-wrapper，并告诉我里面哪些文件要复制到 backend。
在 docs/后端启动笔记.md 写明：Java使用17；JAVA_HOME指向JDK根目录；
PATH中的java也必须是17；A窗口跑页面，B窗口跑后端。
不要修改系统环境变量，不安装软件，不替我启动常驻服务。
如果缺少Java17，明确告诉我缺了什么，先不要继续生成后端。
```

**等 AI 完成并保存：** 等回复结束。它说“检查完毕”只代表回答完了，接下来还要由你执行下面的命令。

**亲自操作：** 在 B 中按自己的系统执行一组。

macOS，工作目录为 `campus-lab`：

```sh
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
export PATH="$JAVA_HOME/bin:$PATH"
java -version
node --version
pwd
```

Windows PowerShell，工作目录为 `campus-lab`；以下按课前安装的 Temurin 17 查找：

```powershell
$courseJdks = @(Get-ChildItem "C:\Program Files\Eclipse Adoptium" -Directory | Where-Object Name -Like "jdk-17*")
if ($courseJdks.Count -ne 1) { throw "请老师确认本机JDK17目录后再继续" }
$env:JAVA_HOME = $courseJdks[0].FullName
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
java -version
node --version
Get-Location
```

**应该看见：** Java 主版本是 `17`，Node 主版本是 `22`，当前目录最后一层是 `campus-lab`。若显示两个 JDK 安装目录，先请老师确认用哪个，不随意取第一个。以后新开后端终端，要在新窗口重新设置这两项环境变量。

**失败时，只发这段修复提示：**

```text
我还停在Java环境检查。操作系统是【Windows或macOS】；
java -version显示【版本】，当前目录最后一层是【目录名】。
请只帮助我让当前终端使用已安装的Java17，不改全局设置，不继续创建后端。
```

**下一步：** Java 17 和目录都确认后，生成最小后端。

