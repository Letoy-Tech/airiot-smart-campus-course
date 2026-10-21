# 第08课：把设备保存到 MySQL，再接回设备页

今天先在自己的电脑准备一个课程专用数据库，再让“设备台账”真正读到它。其他页面暂时继续用浏览器演示，页面会清楚标明数据来源。

本课4学时，共180分钟。六步建议用时：25、30、35、30、40、20分钟。

课前应已装好 Docker Desktop，打开后等它显示引擎正在运行。它负责帮我们运行课程数据库；现在不用掌握容器的全部知识。继续使用同一个 `campus-lab`。

**重新开课，先准备三个窗口：**

1. 用 CodeBuddy 打开原 `campus-lab`。若 A 已停止，新建 A-页面，在项目根运行 `node tools/serve.mjs`，浏览器打开 `http://127.0.0.1:5188`；原 A 仍在运行就沿用，不重复启动。
2. 准备 B-后端。若自己的旧后端还在运行，先在它原来的 B 按 Ctrl+C。新建 B 时，按[第07课第2步](07-看着页面做第一个后端.md#第2步准备后端终端确认它用的是-java-17)在**这个新窗口**设置 `JAVA_HOME` 和 `PATH`，亲自执行 `java -version`，确认是17。不能沿用上一个已关闭窗口的环境。
3. B 从项目根进入后端：macOS 执行 `cd backend`，Windows PowerShell 执行 `Set-Location backend`；已经在 `backend` 就不再进入一次。B 此时保持停止，第3步才运行修改后的后端。
4. 新建 C-工具，确认在 `campus-lab` 根目录。首次做到本课时还没有 `.env` 和 `compose.yaml`，先按第1、2步生成，不提前执行 Compose。若是继续上次未完成的本课，保留已有 `.env`，从未完成的小步继续，不重新生成密码。

## 第1步：生成自己的本机配置

**现在在哪：** CodeBuddy 打开 `campus-lab`。A 正在跑页面；B 已确认 Java 17并停止在 `backend` 目录；C-工具的工作目录是 `campus-lab`。

**发给 CodeBuddy：**

```text
请按materials/约定卡.md为课程准备本地配置工具，但这一步不生成业务代码。
新建tools/setup-env.mjs，使用Node自带crypto随机生成足够长的口令，
在项目根生成.env：DB_PASSWORD、MYSQL_ROOT_PASSWORD、REDIS_PASSWORD、DEMO_PASSWORD。
已有.env时拒绝覆盖，不打印口令。新建.env.example，只放说明和占位文字。
把.env、.private、.runtime、backend/target、node_modules和日志加入.gitignore。
不要读取已有私密配置，不要把口令写入前端、README或回复。
不要替我运行生成工具，我会亲自运行。
```

**等 AI 完成并保存：** 打开脚本看看它是否使用随机生成，检查 `.env.example` 里没有真实口令。此时没有 `.env` 是正常的，还没有执行生成。

**亲自操作：** C、`campus-lab` 根目录，两种系统相同：

```text
node tools/setup-env.mjs
```

**应该看见：** 工具提示本地配置已生成，但不显示口令。左侧文件树出现 `.env`。如果提示文件已存在，保留它，直接继续，不能为重做练习删除配置。

**失败时，只发这段修复提示：**

```text
配置工具运行后出现【不含口令的错误】。
请只修复setup-env.mjs，不读取或覆盖已有.env，不输出其中的值。
我需要它在缺文件时生成，在已有文件时明确保留。
```

**下一步：** 本机 `.env` 就绪后，再生成运行 MySQL 的说明。

## 第2步：让课程 MySQL 运行起来

**现在在哪：** C 仍在 `campus-lab` 根目录。不要关闭 Docker Desktop。

**发给 CodeBuddy：**

```text
请新建根目录compose.yaml，项目名campus-v2。
本步定义MySQL8.4服务mysql：只映射127.0.0.1:23501到容器3306，
数据库campus_course、用户campus，口令从.env读取DB_PASSWORD和MYSQL_ROOT_PASSWORD。
使用本课程专属命名卷保存MySQL数据，增加能判断数据库就绪的healthcheck。
顶层volumes只声明课程卷的键，不设置显式name，也不设置external，
让Compose自动在卷名前加项目名，方便第12课建立独立交付环境。
不连学校或已有数据库，不打印展开后的配置。
Redis留到下一课加入，本步不要提前启动它。
请告诉我docker compose ps中怎样分辨starting与healthy。
不要替我启动服务，不使用down -v。
```

**等 AI 完成并保存：** 看见 `compose.yaml` 新增后再运行。配置文件只引用变量名，不应写出真实口令。

**亲自操作：** C、`campus-lab` 根目录，两种系统相同：

```text
docker version
docker compose up -d mysql
docker compose ps
```

首次需要下载 MySQL 镜像。第一次 `ps` 若显示 `starting`，过一会再执行同一条 `docker compose ps`。看到 `healthy` 再继续。

**应该看见：** 只有本课程 MySQL 使用本机 `23501` 端口。`up -d` 会返回输入提示符，MySQL 在 Docker 中继续运行；这与 B 里持续显示日志的 Java 程序不同。

**失败时，只发这段修复提示：**

```text
我在项目根运行docker compose up -d mysql后出现【不含口令的错误】，
docker compose ps显示【状态】。
请先区分Docker没启动、镜像下载失败、端口占用、数据库尚未就绪。
只修改本课程配置；不结束未知进程，不删除卷，不输出.env。
```

**下一步：** MySQL 显示 `healthy` 后，才让 Java 连进去。

## 第3步：让 Java 认识数据库，并建立设备表

**现在在哪：** B 已停止，工作目录为 `campus-lab/backend`。C 中的 MySQL 保持运行。

**发给 CodeBuddy：**

```text
请给现有最小后端加入JdbcTemplate、MySQL驱动和Flyway所需依赖，
沿用Java17、Spring Boot3.4.2。
application.properties从optional:file:../.env[.properties]导入本机配置，
连接127.0.0.1:23501/campus_course，用户名campus，使用DB_PASSWORD占位，
不得读取或复制.env的真实内容。
新增V1建表迁移，先建spaces和devices，字段严格按materials/约定卡.md；
从公开materials/mock-campus.json生成4个空间与16台设备的初始化SQL。
online未知必须是SQL NULL，模拟标记保留，device的spaceId须能找到空间。
迁移只在第一次使用这个数据库时建立和填充，不在每次启动时删除重建。
本步保留health接口，不实现其他页面接口。不要启动常驻服务。
```

**等 AI 完成并保存：** 查看新的迁移文件，找到 `d01`、`d16` 与四个空间。看不懂全部 SQL 没关系，先确认这些是自己的练习数据。

**亲自操作：** 在 B 运行测试；完成后启动后端。

macOS，工作目录为 `campus-lab/backend`：

```sh
sh ./mvnw test
sh ./mvnw spring-boot:run
```

Windows PowerShell，工作目录为 `campus-lab/backend`：

```powershell
.\mvnw.cmd test
.\mvnw.cmd spring-boot:run
```

前一条失败时先修好，不执行后一条。在浏览器访问 `http://127.0.0.1:5188/api/health`；若 A 没有启动，在 A、项目根运行 `node tools/serve.mjs`。

**应该看见：** B 启动日志显示迁移完成，健康接口仍返回 `UP`。这表示 Java 已连到数据库并建立表，设备页还没切换数据来源。

**失败时，只发这段修复提示：**

```text
MySQL已healthy，但后端启动出现【不含口令的第一段错误】。
请检查.env相对backend的导入路径、23501端口、数据库名与Flyway配置。
不要硬编码口令，不删除数据库，不让启动失败自动退回模拟成功。
如果V1已执行，后续修正用新的迁移文件，不篡改已执行的V1。
```

**下一步：** 健康接口成功后，增加第一条数据库查询。

## 第4步：让设备接口读出十六台设备

**现在在哪：** 先在 B 按 Ctrl+C 停自己的后端。A、MySQL 保持运行。

**发给 CodeBuddy：**

```text
请在现有后端实现GET /api/devices。
本课暂时允许未登录读取，下一课再加登录。
使用JdbcTemplate从MySQL的devices表查询，按id排序；
返回{code:0,message:"ok",data:[设备数组]}，字段按约定卡。
online为NULL时返回JSON null，不能变成false；simulated保持true。
控制器接收请求，服务组织结果，查询代码单独放置，用简短注释说明各自作用。
增加测试检查true、false和null都能保持原意。
不要从mock-campus.json临时返回数据，不实现其他接口，不启动服务。
```

**等 AI 完成并保存：** 看 AI 列出的修改文件，再做一次“测试→启动”。新 Java 代码只有重新启动 B 后才生效。

**亲自操作：** B、`campus-lab/backend`：

| 系统 | 先测试，结束后再启动 |
| --- | --- |
| macOS | `sh ./mvnw test`，成功后 `sh ./mvnw spring-boot:run` |
| Windows PowerShell | `.\mvnw.cmd test`，成功后 `.\mvnw.cmd spring-boot:run` |

在浏览器新标签打开 `http://127.0.0.1:5188/api/devices`。

**应该看见：** `data` 中有16台设备，包含 `d01` 到 `d16`，四类各4台。数据来自 SQL 查询，不是为了凑16而写死响应。

**失败时，只发这段修复提示：**

```text
/api/devices实际返回【去掉无关信息的结果】。
请只检查V1初始化与devices查询：应有16台，ID不重复，未知online保持null。
不要在前端补出缺失设备，也不要删除数据库重新来过。
```

**下一步：** 接口可读后，再改已有设备页；不要同时重写整个网页。

## 第5步：只把设备页接到新接口

**现在在哪：** CodeBuddy 打开 `frontend/data-service.js` 和设备页相关代码。A、B、MySQL 都保持运行。

**发给 CodeBuddy：**

```text
请只把现有设备台账和详情中的设备基本信息改为读取同源GET /api/devices：
ID、名称、类别、spaceId、online、simulated来自MySQL。
在data-service.js实现请求与响应检查；其他页面的浏览器演示暂时保留。
设备详情里的点位读数、历史、责任信息本课还未有对应接口，
继续使用原公开样本或浏览器演示，并在这些区域分别标明来源，第10课再接后端。
保留设备页原有筛选、详情和历史入口，不新做另一套页面。
读取期间显示“正在读取”；成功显示“数据来自本机后端/MySQL”；
首次失败显示可重试的错误；成功后再失败时保留旧列表并明确标“上次成功结果”，
不能假装刷新成功、不能自动回退为模拟数据。
成功刷新后清除旧错误，显示本次读取时间；该时间不能冒充设备采样时间。
不要启动服务，告诉我具体点击哪里检查。
```

**等 AI 完成并保存：** 回复结束后保存并刷新校园网页。前端文件变了，不必重启 B。

**亲自操作：** 点击“设备”，用筛选选择能源设备，再打开其中一台详情，记下设备 ID。点击设备页的刷新按钮。

**应该看见：** 总数16、能源4台、详情仍对应刚点击的设备。设备基本信息明确写着本机后端；同一详情中的点位读数、历史、责任仍分别标为教学样本或浏览器演示。空间编辑、演练等尚未接通的页面也继续显示“浏览器演示”，不能因为一个页面部分接通就把整页都写成 MySQL 来源。

**失败时，只发这段修复提示：**

```text
设备接口返回正常，但设备页操作【具体按钮】后出现【现象】。
请只修复data-service与现有设备页面之间的连接，保留原有筛选和详情。
不要修改数据库，也不要换回mock数据掩盖问题。
```

**下一步：** 设备页成功后，用一次短暂停机确认它确实在请求后端。

## 第6步：确认数据保存了，失败也说清楚了

**现在在哪：** 浏览器停在已经成功读取的设备页，不关闭标签。

**发给 CodeBuddy：**

```text
请在docs/页面需要的数据.md更新实际进度：
设备台账和详情中的设备基本信息已接到MySQL；
详情中的点位读数、历史、责任仍为教学样本或浏览器演示，直到第10课才接通。
其他页面也按当前代码注明来源。
再在docs/后端启动笔记.md追加本课的人工检查表，结果先留“待我填写”：
成功读取、后端停止后刷新、后端恢复后刷新、MySQL重启后再次读取。
不要替我编写通过结论，不修改业务代码或启动服务。
```

**等 AI 完成并保存：** 看到四条待填写记录，再亲手操作。

**亲自操作：**

1. 在 B 按 Ctrl+C；设备页点击刷新，应保留旧结果并提示失败。
2. B 仍在 `backend`，执行本课第4步的启动命令；等启动完再刷新，应恢复正常。
3. 再停止 B。C 在项目根运行 `docker compose restart mysql`，随后执行 `docker compose ps`，等 `healthy`。
4. 在 B 重新启动后端，设备页再次读取。把实际结果填入笔记。

**应该看见：** MySQL 重启后仍是原来的16台设备，数据没有因进程停止而消失。失败提示与成功提示能相互切换。

**失败时，只发这段修复提示：**

```text
我执行到人工检查第【序号】项，实际看到【结果】。
请检查课程MySQL命名卷、启动迁移或设备页失败状态中与该现象有关的一处。
不要删除卷，不用重新导入一份临时数据冒充持久保存。
```

**下一步：** 下一课增加登录，Redis 才开始发挥作用。下课停止自己的 A、B；C 在项目根运行 `docker compose stop`，数据卷保留。
