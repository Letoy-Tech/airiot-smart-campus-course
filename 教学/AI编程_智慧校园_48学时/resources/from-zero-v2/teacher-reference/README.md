# 教师参考工程 · V2.1.1

这是用于对照和作者验证的完整参考，学生从“学生空白起点”逐课生成自己的工程。参考成品将初始化表集中在V1；学生按课次新增V1/V2/V3等迁移，已经运行的迁移不能用参考文件覆盖。前端为HTML/CSS/JavaScript，后端Java17/Spring Boot3.4.2；样本4空间、16设备、28点。没有真实校园接入、设备控制或通知。

## 先只看前端

安装Node22，在本文件所在目录打开终端A，运行：

```sh
node tools/serve.mjs
```

打开 http://127.0.0.1:5188，数据方式选择“浏览器演示”。九个菜单都可以查看；修改存入此浏览器，身份切换在“管理”页。此时“检查后端连接”失败是正常的，因为还未启动后端。

## 选择数据库环境

下面主流程是Docker路线。无Docker但已有教师验收过的macOS/Linux原生MySQL8.4服务端及客户端与Redis7.2+时，可在工程根首次运行 `python3 materials/native-runtime.py init`，然后 `python3 materials/native-runtime.py start`；不再生成另一份.env，不执行Compose。再次开课只运行start；停止用stop；Redis实验用restart-redis。工具只管理本目录独立服务和数据；多版本或客户端与服务端分离安装时，init用 `--mysql /absolute/path/to/mysql` 指定8.4客户端。完整前置、端口、故障处理与新目录交接见教学包的《环境准入与备用路线》。Windows无Docker需使用已验收实验机。

原生新目录交接：停止旧A/B及native服务，只复制源码到全新短路径目录，在新目录init/start，再运行下面相同的B/A命令，使用新.env。不得复制旧.env/.runtime，不删除旧数据。

## 启动全部服务（Docker路线）

前提：Node22、Java17、Docker Desktop已安装，`docker version`能看到Server，`docker compose version`成功。安装帮助见课程“开课前”。以下工作目录都是本工程根目录，除明确进入backend外。A在跑页面时不要在A输入其他命令，新建C-工具。

首次在C生成本机口令。已存在.env时工具会拒绝覆盖；再次开课直接沿用：

```sh
node tools/setup-env.mjs
docker compose up -d
docker compose ps
```

等mysql和redis都显示healthy后再启动后端。首次下载可能较慢，失败时查看 `docker compose logs --tail=30 mysql` 或 `docker compose logs --tail=30 redis`；不要贴含口令的配置到聊天，不删除数据卷重试。

新建B-后端。macOS在B中：

```sh
export JAVA_HOME="$(/usr/libexec/java_home -v 17)"
export PATH="$JAVA_HOME/bin:$PATH"
java -version
cd backend
sh ./mvnw test
sh ./mvnw spring-boot:run
```

Windows PowerShell在B中（若Java已有17，可先检查；多JDK按课程第07课选择）：

```powershell
java -version
Set-Location backend
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
```

若A尚未启动，在根目录运行 `node tools/serve.mjs`。打开 http://127.0.0.1:5188，点击“检查后端连接”应显示“后端已连接”；选择“连接后端”。在本机编辑器打开根.env，自己查看DEMO_PASSWORD的值，填入登录表单。账号：admin、manager、viewer；三个本地教学账号初始使用该练习口令。它不是任何云账号的密码。

验证顺序：管理员查看16设备→登记d01责任→新建演练→已有责任人自动分派→管理人员开始/记录→管理员模拟恢复→管理人员独立核实/关闭→管理员查看审计。未登记的d02创建后须先管理员分派并填写说明。

刷新页面保留数据模式偏好，但清除内存令牌，因此重新登录。Redis保存30分钟登录凭条，MySQL保存业务；本配置关闭Redis持久化，`docker compose restart redis`后也需重新登录。MySQL命名卷保留已有记录；改.env口令不会自动修改已存在数据库账号，请保留原.env。

## 修改和停止

改HTML/CSS/JS：保存后刷新。改Java：只在B按Ctrl+C，等提示符回来后重新执行后端启动命令。改serve.mjs：只重启A。

结束时，在A、B各按一次Ctrl+C，在C的根目录运行 `docker compose stop`。不使用 `down -v`。如果端口被其他程序使用，先查清是哪个自己的窗口；不杀未知进程。服务只监听127.0.0.1，不作为公网发布方案。

## 导出源码并让新目录接手

在docs记录本组实际做过的检查。教师参考内的docs是说明和空白记录模板，不代表学生已完成。

```sh
node tools/export-source.mjs --out .runtime/hand-in-v1/campus-lab
```

工具只复制指定源码和公开docs，排除各层.env及.env.*变体（仅保留根.env.example）、数据库、target、日志与IDE缓存，检查是否误包含本机.env的长配置值，并拒绝嵌套归档、密钥和备份文件；Maven自带wrapper只允许课程固定文件。源路径及输出路径的每级父目录都拒绝符号链接；输出目录已存在时拒绝覆盖。人工再检查不包含个人截图、账号资料或聊天记录，随后用系统压缩功能打包这个campus-lab目录。

**同一台电脑新目录验证：** 先停止旧目录的A/B及 `docker compose stop`。把导出目录复制到新位置，用CodeBuddy打开新campus-lab。新目录运行setup-env，再统一使用以下项目名：

```sh
node tools/setup-env.mjs
docker compose -p campus-v2-handoff up -d
docker compose -p campus-v2-handoff ps
```

使用新.env配套的新数据卷。不要在handoff目录遗漏 `-p campus-v2-handoff`。新卷名称应以campus-v2-handoff_开头；检查用 `docker volume ls --filter label=com.docker.compose.project=campus-v2-handoff`。如果已经做过同名handoff验证，重新打开该目录并沿用其.env；不要给已有卷生成新密码。另一台从未运行过本课程的电脑可以使用默认项目名。

再按上面的B/A命令启动，亲手完成一条新事件并记录。新目录仍是教学种子数据，原浏览器演示记录和原数据库记录不会随源码自动搬过去。需要数据迁移的场景不在这一步内。

最后将新目录中的公开 `docs/本组实做记录.md`、`docs/交付说明.md`、`docs/交接与个人证据.md` 及其引用的公开证据合并回原工程，保留原记录；修过的源码也同步，绝不复制新.env。在原目录换新输出名再次导出，打开最终包确认三份交接文档及引用证据已更新。停止新A/B，在新目录运行 `docker compose -p campus-v2-handoff stop`，保留数据。

## 历史验证与V2.1.0边界

作者用独立原生MySQL8.4.10、Redis7.2.6检查参考工程，Compose目标为MySQL8.4/Redis7.4。Docker Desktop及Windows实际运行未完成，不能将原生服务验证写成Docker/Windows实测。详细结果在教学包的“教师验证记录”；单元测试不需要数据库，不能代替数据库接口检查。

V2.1.0新增严格整数JSON输入配置，防止expectedVersion数字字符串/小数被隐式转换；原始JSON请求边界有独立测试。新增原生环境管理工具，当前结果见教材验证记录。历史记录不自动代表本版的Windows或课堂验收。

V2.1.1修复原生客户端定位与目录保护、正文读取超时、导出归档保护及三份交接记录同步。本版验证范围见教材最新教师验证记录。
