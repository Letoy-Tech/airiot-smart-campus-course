# 校园值班台 · 本机教学工程（V2.0.1）

这是“AI 编程 · 智慧校园”前 11 课逐步做出来的本机教学工程，第 12 课交付使用。

所有数据都是**教学模拟**：样本来自 `materials/mock-campus.json` 和本机课程 MySQL，不连接真实校园、AIRIOT 或任何设备，也不发送外部通知。

先记住三条：

- 口令只在本机根目录 `.env` 里。文档、聊天、截图、前端代码都不要出现口令值。
- 已有 `.env` 一律沿用，不要覆盖、不要重新生成后去连旧卷。
- MySQL 数据在命名卷里。不删卷、不执行 `docker compose down -v`。

按下面顺序做，每条命令都标了工作目录。

---

## 1. 需要安装的软件

| 软件 | 版本要求 | 用途 |
| --- | --- | --- |
| Node.js | 22.x | 页面静态服务、`.env` 生成工具 |
| JDK | 17 | 后端 Spring Boot |
| Docker Desktop | 能运行 `docker compose` | 本课程 MySQL 8.4 + Redis 7.4 |

检查（macOS 终端）：

```sh
# 工作目录：任意
node --version          # 期望 v22.x
java -version           # 期望 17.x（第一行含 17.）
docker --version
docker compose version
```

检查（Windows PowerShell）：

```powershell
# 工作目录：任意
node --version
java -version
docker --version
docker compose version
```

版本不对时只在**当前这个终端窗口**临时切换，不改系统环境变量。

macOS：

```sh
# 工作目录：任意
export JAVA_HOME=$(/usr/libexec/java_home -v 17)
export PATH="$JAVA_HOME/bin:$PATH"
java -version
```

Windows PowerShell：

```powershell
# 工作目录：任意
$env:JAVA_HOME = "C:\Program Files\Java\jdk-17"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
java -version
```

Node 用 nvm 时：macOS 先 `nvm use 22`，Windows（nvm-windows）执行 `nvm use 22`；不使用 nvm 就把 Node 22 安装目录的 `bin` 临时前置到当前窗口的 `PATH`。

> 每开一个新终端都要重新确认 `java -version` 是 17、`node --version` 是 22。上一窗口的 `export` 不会自动继承，这不是环境坏了。

---

## 2. 确认打开的是 campus-lab 根目录

根目录里应直接看到 `backend/`、`frontend/`、`tools/`、`docs/`、`notes/`、`materials/`、`compose.yaml`、`README.md`。

macOS：

```sh
# 工作目录：campus-lab/
pwd
ls
```

Windows PowerShell：

```powershell
# 工作目录：campus-lab\
Get-Location
Get-ChildItem
```

后面的命令都以这个目录为参照：**C、A 在根目录，B 在 `backend/`**。

---

## 3. 生成 .env

口令文件必须放在项目根目录，后端和 compose 都从这里读。

macOS：

```sh
# 工作目录：campus-lab/
node tools/setup-env.mjs
```

Windows PowerShell：

```powershell
# 工作目录：campus-lab\
node tools\setup-env.mjs
```

- 生成本机随机口令：`MYSQL_ROOT_PASSWORD`、`DB_PASSWORD`、`REDIS_PASSWORD`、`DEMO_PASSWORD`。
- 工具**不会在控制台显示口令**。已经存在 `.env` 时只提示“已保留”，不覆盖，并以非 0 退出码结束——这是正常现象，直接沿用即可。
- `.env` 已在 `.gitignore` 中，不要提交、不要复制到前端、README、聊天或截图。
- 根目录的 `.env.example` 只是字段说明，不含可用口令。

---

## 4. C 窗口：启动本课程 MySQL / Redis，等 healthy

macOS：

```sh
# 工作目录：campus-lab/
docker compose up -d
docker compose ps
```

Windows PowerShell：

```powershell
# 工作目录：campus-lab\
docker compose up -d
docker compose ps
```

- 只启动 `mysql` 与 `redis` 两个服务；MySQL 首次初始化和建库需要一点时间，`docker compose ps` 里先看到 `starting` 属正常，等到两行都显示 `healthy` 再做下一步。
- 本课程 Redis 关闭了持久化且不挂数据卷：重启 Redis 后登录会话消失，业务数据仍由 MySQL 保存。
- 不要用 `docker compose down -v`，不要 `docker volume rm` 删卷，也不要改成连学校或已有数据库。

---

## 5. B 窗口：在 backend 启动 Java

先确认 MySQL 已 `healthy`、根的 `.env` 已存在，再在 B 窗口确认 Java 是 17。

macOS：

```sh
# 工作目录：campus-lab/
cd backend              # 进入 campus-lab/backend/
java -version           # 必须是 17
sh ./mvnw spring-boot:run
```

Windows PowerShell：

```powershell
# 工作目录：campus-lab\
cd backend              # 进入 campus-lab\backend\
java -version
.\mvnw.cmd spring-boot:run
```

- 第一次运行 `mvnw` 会联网下载 Maven 3.8.6，属正常行为。`mvnw` 与 `.mvn/wrapper/` 已在 `backend/` 内，不需要另装 Maven。
- 看到启动完成后，另开一个临时终端验证（B 窗口保持运行）：

  ```sh
  # 工作目录：任意
  curl http://127.0.0.1:8098/api/health
  ```

  Windows PowerShell：

  ```powershell
  curl.exe http://127.0.0.1:8098/api/health
  ```

  期望返回 `code=0`、`message=ok`、`data.status=UP`。
- 后端只监听 `127.0.0.1:8098`；Flyway 启动时会执行 `V1`–`V4` 迁移，已执行过的不重复执行。
- 启动时可能看到 Flyway 提示“MySQL 8.4 高于其已测试的最高版本”，这是本课程已知提示；本机实测迁移成功，但不代表生产支持。

---

## 6. A 窗口：在根目录启动页面

macOS：

```sh
# 工作目录：campus-lab/
node tools/serve.mjs
```

Windows PowerShell：

```powershell
# 工作目录：campus-lab\
node tools\serve.mjs
```

浏览器打开 `http://127.0.0.1:5188`。

- 这个服务只公开 `frontend/`，并把 `/api/*` 转发到 `127.0.0.1:8098`；它不公开 `.env` 等隐藏文件。
- 改了 HTML/CSS/JS 保存后刷新浏览器即可；改了 Java 要在 B 窗口 `Ctrl+C` 后重启；只有改了 `tools/serve.mjs` 才需要重启 A。

---

## 7. 在本机查看 DEMO_PASSWORD 并登录

三个课堂账号 `admin` / `manager` / `viewer` 共用同一个 `DEMO_PASSWORD`，角色依次为 ADMIN / MANAGER / VIEWER。

macOS：

```sh
# 工作目录：campus-lab/
grep '^DEMO_PASSWORD=' .env
```

Windows PowerShell：

```powershell
# 工作目录：campus-lab\
Select-String -Path .env -Pattern '^DEMO_PASSWORD='
```

这会**在终端里显示口令值**，只在本机自己看：不要朗读、不要粘贴到聊天/文档/截图/前端代码。

登录步骤：页面顶部“数据方式”选 **连接后端** → 出现登录表单 → 输入账号与口令 → 登录。登录成功后顶部显示当前账号与角色。

---

## 8. 动手做一遍：看设备/历史，改空间/责任，完成一件演练

建议顺序（都在浏览器里操作）：

1. **设备**：看到 16 台设备、4 个空间、28 个点位；`d03` 在线情况为未知、`d04` 为离线；打开详情看负责人、空间与点位读数。来源行会显示本次读取时间。
2. **历史**：从 `d05` 的功率 `power` 进入历史，看曲线与样本表。`0` 是有效值（`d05` 功率 0 kW），缺失样本显示为缺失、曲线断开、不补 0。
3. **空间**（ADMIN）：修改 `s1` 的楼栋/楼层并保存；保存后页面会独立回读，整页刷新并重新登录后仍与保存值一致。
4. **设备责任**（ADMIN）：给一台设备登记负责人与备注，提交时带上 `expectedVersion`。另开一个标签用旧版本提交，会得到 409 并只回读最新值，不会自动重发。刷新后重新登录仍能看到最新版本。
5. **演练事件**（创建/分派用 `admin`，开始/核实/关闭用 `manager`，恢复用 `admin`）：新建一件演练 → 分派 → 开始 → 记录处置 → 模拟恢复 → 独立核实 → 关闭。每步版本加 1、时间线加一条；不要重置已有事件。
6. **只读账号**：用 `viewer` 登录，九个菜单都能打开，但没有保存/创建/处置按钮；直接发写请求会被后端拒绝（403）。审计只有 ADMIN 能读。

小节原则：看到的与预期不符就照实记录，不要为了“通过”改数据或删卷重做。

---

## 9. 停止自己的服务

- A 窗口（页面）和 B 窗口（后端）：各自按 `Ctrl+C`。
- C 窗口（容器）：在项目根停止容器。

macOS：

```sh
# 工作目录：campus-lab/
docker compose stop
docker compose ps -a   # 默认 ps 只列运行中，加 -a 才能看到 mysql / redis 为 exited
```

Windows PowerShell：

```powershell
# 工作目录：campus-lab\
docker compose stop
docker compose ps -a
```

- `stop` 只停容器，容器与卷都保留；需要移除容器但保留数据时用 `docker compose down`（**不带 `-v`**）。
- 端口被占用时先确认是不是自己上一课的进程，不要杀不明进程。

本工程交付时的状态：A/B 与默认 `campus-v2` 容器均已停止，卷保留。

---

## 10. 端口与本机访问范围

| 服务 | 地址 | 说明 |
| --- | --- | --- |
| 页面（A） | `http://127.0.0.1:5188` | 只监听本机回环 |
| 后端（B） | `http://127.0.0.1:8098` | `server.address=127.0.0.1` |
| MySQL | `127.0.0.1:23501` → 容器 3306 | compose 中只映射回环地址 |
| Redis | `127.0.0.1:23502` → 容器 6379 | 同上 |

四个端口都只在本机使用，不开放给同网段其他机器，也不做端口转发。`serve.mjs` 只把 `/api/*` 转到 `127.0.0.1:8098`，跨机访问开关没有实现，也不要自己加。

---

## 11. 刷新页面会重新登录；数据分别存在哪

- **登录令牌只存在页面内存**：整页刷新或关标签后需要重新登录，这是设计如此，不是掉登录 bug。
- **MySQL 保存业务记录**：账号、空间、设备、点位、历史样本、原始报警、设备责任、演练事件与时间线、审计。刷新、重启后端、重启 Redis 都不会丢。
- **Redis 只保存短时会话**：`campus:v2:session:<token>`，有效期 30 分钟，且本课程 Redis 关闭了持久化；重启 Redis 后旧令牌立即失效（请求返回 401），重新登录即可，设备等记录仍在。
- **浏览器演示模式**只用于对照，不写数据库，也不显示演练与审计；连接后端失败时不会静默换回模拟数据。

---

## 12. 同机新目录：用项目名 campus-v2-handoff 隔离

第 12 课要把工程换个目录独立跑一遍，同时**不能碰旧目录的数据**。要点是新目录用独立项目名：卷名和网络随之隔离；容器名由 `compose.yaml` 固定，所以必须先把旧容器退出并释放名称。

### 12.1 先让旧服务退出

12.1 的 compose 命令操作的是**旧项目** `campus-v2`，所以故意不带 `-p`；从 12.3 起操作新环境的每条 compose 命令都必须带 `-p campus-v2-handoff`。

1. 旧目录的 A/B 窗口各按 `Ctrl+C`。
2. 旧目录（`campus-lab/`）停止容器：

   ```sh
   # 工作目录：旧 campus-lab/
   docker compose stop
   ```

3. `compose.yaml` 里固定了 `container_name: campus-v2-mysql` / `campus-v2-redis`。Docker 的容器名全局唯一，**停止的容器仍占着名字**，所以新项目启动前要在旧目录释放容器名（保留卷）：

   ```sh
   # 工作目录：旧 campus-lab/
   docker compose down
   ```

   `down` 不带 `-v`：容器和网络移除，`campus-v2_mysql-data` 卷保留。**绝对不要加 `-v`**。

### 12.2 复制工程到新目录

macOS：

```sh
# 工作目录：campus-lab 的上一级
cp -R campus-lab campus-lab-handoff
rm -f campus-lab-handoff/.env
rm -rf campus-lab-handoff/backend/target
```

Windows PowerShell：

```powershell
# 工作目录：campus-lab 的上一级
Copy-Item -Recurse campus-lab campus-lab-handoff
Remove-Item campus-lab-handoff\.env -Force -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force campus-lab-handoff\backend\target -ErrorAction SilentlyContinue
```

新目录不复制 `.env`，改为自己生成（见 12.3）。这样旧口令不会跟着复制到交付目录。

### 12.3 新目录的每条 compose 命令都带 -p

`compose.yaml` 顶层有 `name: campus-v2`；命令行 `-p` 优先级更高，因此能覆盖它。**漏写一条 `-p` 就会操作回旧项目**，所以下面操作新环境的每条 compose 命令都带：

```sh
# 工作目录：campus-lab-handoff/
node tools/setup-env.mjs
docker compose -p campus-v2-handoff up -d
docker compose -p campus-v2-handoff ps
```

Windows PowerShell：

```powershell
# 工作目录：campus-lab-handoff\
node tools\setup-env.mjs
docker compose -p campus-v2-handoff up -d
docker compose -p campus-v2-handoff ps
```

B、A 窗口照第 5、6 节做，只是工作目录换成 `campus-lab-handoff/backend/` 和 `campus-lab-handoff/`；两边端口相同（8098 / 5188），**不能和旧目录同时启动**。

停止与清理新环境：

```sh
# 工作目录：campus-lab-handoff/
docker compose -p campus-v2-handoff stop
docker compose -p campus-v2-handoff down      # 需要移除容器时；仍然不带 -v
```

### 12.4 新卷是空的

- 新项目名会创建新卷 `campus-v2-handoff_mysql-data`，里面没有旧数据；MySQL 首次启动时用**新目录自己的 `.env`** 初始化账号与库。
- 旧卷 `campus-v2_mysql-data` 不受影响，也没有被新环境读取。
- 想回旧环境：旧目录 `docker compose up -d`，用旧 `.env` 登录，旧数据仍在。

---

## 13. 检查 Compose 顶层卷没有显式 name 或 external

`compose.yaml` 顶层只声明了键 `mysql-data`，没有 `name:`，也没有 `external: true`，因此卷名自动带项目名前缀：

- 默认项目 `campus-v2` → `campus-v2_mysql-data`
- 新目录 `-p campus-v2-handoff` → `campus-v2-handoff_mysql-data`

只读检查（不展开 `.env`）：

macOS：

```sh
# 工作目录：campus-lab/
grep -n -A3 '^volumes:' compose.yaml
docker volume ls
```

Windows PowerShell：

```powershell
# 工作目录：campus-lab\
Select-String -Path compose.yaml -Pattern '^volumes:' -Context 0,3
docker volume ls
```

- 看到 `mysql-data:` 且下面没有 `name` / `external` 即符合要求。
- Redis 不挂任何卷，所以卷列表里只有 MySQL 卷。
- **不要**输出 `docker compose config` 或 `docker inspect` 全文：它们会展开并显示 `.env` 里的口令。

---

## 14. .env 与卷的复用规则（最容易出错的地方）

1. **已有 `.env` 必须重用**。`node tools/setup-env.mjs` 遇到已存在的 `.env` 只提示保留，不覆盖、不重新生成（退出码非 0 是正常的）。
2. **相同 Compose 项目名会重用已有卷**。卷里的 MySQL 账号与口令是**首次初始化**时写入的；之后再改 `.env` 不会改数据库里的口令。
3. 所以：同一个项目名 `campus-v2` + 新的 `.env` + 旧卷 = 用新口令去连旧库，认证失败。这不是“服务坏了”，是配置与数据不匹配。
4. 正确做法二选一：
   - 继续用原目录、原 `.env`、原卷（推荐，数据完整）；
   - 换项目名（如 `-p campus-v2-handoff`）得到**新空卷**，再配新 `.env`，如第 12 节。
5. 无论哪种，都**不要删卷、不要 `down -v`、不要用一套新口令硬连旧卷**。卷里是前 11 课的实做数据，删了不可恢复。

---

## 15. 教学模拟、已实测、未实测

### 教学模拟（不是真实系统）

- 设备、点位、历史、报警都是固定教学样本；MySQL 的初始数据也由迁移从 `materials/mock-campus.json` 写入。
- 原始报警只读，页面不提供确认、恢复、关闭或设备控制。
- 接入状态恒为 `TEACHING_MOCK`：不连真实校园、不连 AIRIOT、不控制设备、不发外部通知、不接外部账号系统。
- 页面上的“模拟”标记是有意保留的，不要为了好看去掉。

### 已在本机实际做过（2026-10-21，macOS，同一台电脑）

- 安装与版本：Java 17、Node 22 检查通过；MySQL 与 Redis 容器 healthy。
- 登录：`/api/login`、`/api/me`、`/api/logout` 可用；刷新后需重新登录；Redis 重启后旧会话 401，重新登录仍读到 16 台设备。
- 设备与读数：16 台 / 4 空间 / 28 点位；`d03` 未知、`d04` 离线；`d05` 功率 0 kW 保留，缺失不补 0。
- 历史：`d05` 功率、`d06` 电压、`a01`→`d01` 路径实际打开过；功率 0 与 null 断点的显示符合预期。
- 空间与责任：独立 GET 回读、刷新重登后一致；责任版本 0→1→2→3 与 409 冲突、十项负向输入检查均实际回读。
- 演练与审计：`case-34586bbc372f` 从 v1 走到 v7（创建、分派、开始、记事、恢复、核实、关闭），时间线 7 条；审计 12 条与成功动作对应。
- 失败恢复：停后端后请求 503、保留上次成功结果；恢复后重试 200，无 mock 顶替。
- 权限：`viewer` 写操作 403，`manager` 越权分派/恢复 403，伪造 role 仍 403。
- 后端测试：`backend/` 实际跑过 153 项测试，0 失败 0 错误；MySQL 卷 `CreatedAt` 在重启实验前后未变。

### 未实测（不要当成已验证）

- Windows PowerShell 命令：本工程未在 Windows 上实跑。
- 同机新目录（`-p campus-v2-handoff`）流程：按 Docker 规则编写，本机尚未实际执行。
- 另一台电脑、跨机访问、局域网共享。
- 真人学生/同伴独立验收；记录均来自同一人操作。
- 真实校园网络、AIRIOT、真实设备、设备控制、外部通知。
- 原始报警多页翻页：公开样本只有 1 条，两个翻页按钮均禁用。
- 长延迟响应下的 5 秒超时表现（只核对了代码，未构造慢响应）。

---

## 16. 记录与边界

- 本组实做记录：`docs/本组实做记录.md`（前端 01–06 课笔记已合并到“前端实做”，后端记录保留在各课小节）。
- 其他文档：`docs/页面需要的数据.md`（九个菜单与接口对照）、`docs/后端启动笔记.md`（Java/Node 版本与启动细节）、`notes/`（前六课原始笔记，保留不动）。
- 数据边界：只连本机课程容器；不连学校数据库、不连公网设备、不做外部通知。
- 交付边界：不提交 `.env`，不复制个人截图、聊天记录或账号资料进文档。
- 工程状态：A/B 与默认 `campus-v2` 容器已停止，MySQL 卷保留；下一课按第 12 节在新目录独立验证。
