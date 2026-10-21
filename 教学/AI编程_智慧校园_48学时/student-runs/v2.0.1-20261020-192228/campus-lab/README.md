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
# 先找到本机 JDK 17 的真实安装目录，不要照抄下面的示例路径：
Get-ChildItem 'C:\Program Files\Java','C:\Program Files\Eclipse Adoptium' -ErrorAction SilentlyContinue

# 把 <你的 JDK17 安装目录> 换成上一步看到的实际路径，例如 ...\jdk-17 或 ...\jdk-17.x.x-hotspot
$env:JAVA_HOME = "<你的 JDK17 安装目录>"
$env:Path = "$env:JAVA_HOME\bin;$env:Path"
java -version
```

`<你的 JDK17 安装目录>` 是占位符，必须按本机实际安装路径填写；本工程未在 Windows 上实跑，任何具体路径都未经本机验证。

Node 用 nvm 时：macOS 先 `nvm use 22`，Windows（nvm-windows）执行 `nvm use 22`；不使用 nvm 就把 Node 22 安装目录的 `bin` 临时前置到当前窗口的 `PATH`。

> 每开一个新终端都要重新确认 `java -version` 是 17、`node --version` 是 22。上一窗口的 `export` 不会自动继承，这不是环境坏了。

---

## 2. 确认打开的是 campus-lab 根目录

根目录里应直接看到 `backend/`、`frontend/`、`tools/`、`docs/`、`materials/`、`compose.yaml`、`README.md`。

注意：公开导出与当前 `campus-lab-handoff` **都没有 `notes/` 目录**，`notes/` 只保留在原工程；第 01–06 课的文字已经合并到 `docs/本组实做记录.md`，在交付副本里读那一份即可，不要去找导出里不存在的目录。

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
docker compose -p campus-v2 up -d
docker compose -p campus-v2 ps
```

Windows PowerShell：

```powershell
# 工作目录：campus-lab\
docker compose -p campus-v2 up -d
docker compose -p campus-v2 ps
```

本项目名 `campus-v2` 与 `compose.yaml` 顶层的 `name` 一致，显式写出来是为了避免与第 12 课新目录的 `campus-v2-handoff` 混淆。

- 只启动 `mysql` 与 `redis` 两个服务；MySQL 首次初始化和建库需要一点时间，`docker compose -p campus-v2 ps` 里先看到 `starting` 属正常，等到两行都显示 `healthy` 再做下一步。
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
docker compose -p campus-v2 stop
docker compose -p campus-v2 ps -a   # 默认 ps 只列运行中，加 -a 才能看到 mysql / redis 为 exited
```

Windows PowerShell：

```powershell
# 工作目录：campus-lab\
docker compose -p campus-v2 stop
docker compose -p campus-v2 ps -a
```

- `stop` 只停容器，容器与卷都保留；不要用 `down -v`，也不要在第 12 课交接时自行删除旧容器（见 12.1）。
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

第 12 课要把工程换个目录独立跑一遍，同时**不能碰旧目录的数据**。要点是新目录用独立项目名：容器名、卷名和网络都随项目名变化。

`compose.yaml` 里**不再写 `container_name`**（2026-10-21 已改）：服务名保持 `mysql` / `redis`，**今后新建**的容器名由 Compose 按项目名自动生成——旧项目会是 `campus-v2-mysql-1` / `campus-v2-redis-1`，新项目实际是 `campus-v2-handoff-mysql-1` / `campus-v2-handoff-redis-1`。

**注意区分“实际存在的旧容器”和“今后新建的默认名”**：旧环境已经存在的两个容器仍是写死名字 `campus-v2-mysql` / `campus-v2-redis`，当前状态 `Exited`，**没有改名、也没有被重建**；`campus-v2-mysql-1` 这类带序号的名字只是删掉 `container_name` 以后新建时才会用到的默认名。

旧项目使用 `compose.yaml` 里写死的默认项目名 `campus-v2`（显式写 `-p campus-v2` 与不写 `-p` 的默认行为等价），新项目 `campus-v2-handoff` 的每条 compose 命令都显式写 `-p campus-v2-handoff`，不要省略任何一条。

### 12.1 只停止旧服务，不删除旧容器

1. 旧目录的 A/B 窗口各按 `Ctrl+C`，确认 5188 / 8098 已释放；端口被占用时先确认是不是自己的进程，不结束未知进程。
2. 旧目录（`campus-lab/`）停止容器（显式 `-p campus-v2`）：

   ```sh
   # 工作目录：旧 campus-lab/
   docker compose -p campus-v2 stop
   docker compose -p campus-v2 ps -a
   ```

   Windows PowerShell：

   ```powershell
   # 工作目录：旧 campus-lab\
   docker compose -p campus-v2 stop
   docker compose -p campus-v2 ps -a
   ```

   只停止，不移除：容器留在 `Exited`，`campus-v2_mysql-data` 卷保留。不要 `down -v`，不删除任何数据库卷。

3. **这一点已在 2026-10-21 实际踩到并修好**：早先的 `compose.yaml` 写死了 `container_name: campus-v2-mysql` / `campus-v2-redis`，Docker 容器名全局唯一，**停止的旧容器仍占着这个名字**；新目录执行 `docker compose -p campus-v2-handoff up -d` 时已建好新网络/新卷，却在创建容器阶段报 `Conflict ... container name "/campus-v2-mysql" is already in use`。
4. 修法只改新目录 `compose.yaml`：删掉 mysql 与 redis 的 `container_name` 两行，其余（顶层 `name`、回环端口、`mysql-data` 卷声明、镜像、认证、healthcheck、持久化设置）保持不变。旧容器、旧卷、旧 `.env` 一律不动：不 `down`、不删除、不改名、不复用。
5. 修复后的实际状态：旧容器仍叫 `campus-v2-mysql` / `campus-v2-redis`，保持 `Exited`，未被改名也未被重建；新容器是 `campus-v2-handoff-mysql-1` / `campus-v2-handoff-redis-1`，已 `healthy`。两组名称不再冲突，可以并存（但端口仍相同，见 12.3）。

### 12.2 从第 12 课第 2 步的公开导出复制，不用原目录

新目录必须来自**第 12 课第 2 步导出工具产出的公开副本**，不是原 `campus-lab`：

- 来源：`.runtime/hand-in-v*/campus-lab`，取其中**最新的一版** `hand-in-v*`。
- 目标：与原目录并列、**全新且尚不存在**的 `campus-lab-handoff`。
- 导出工具已随工程提供：`tools/export-source.mjs`。本次实际导出完成 140 个文件，清单在该导出目录的 `SHA256SUMS.txt`；具体哪个 `hand-in-v*` 可用，以你本机 `.runtime/` 的实际结果为准（本文不查看 `.runtime`）。**没有可用导出目录就停下等第 2 步产出**，不要拿原 `campus-lab` 或其他旧副本顶替。
- 导出工具在首次导出后按边界测试修过（大文件口令比对、项目根祖先符号链接）；**早于修正的导出不作为交接来源**，用当前工具重新导出到新的 `hand-in-v*`（工具拒绝覆盖已有目录），再由新导出复制。

操作方式：用文件管理器（macOS 访达 / Windows 资源管理器）把导出的 `campus-lab` 目录**整份复制**，粘贴到旁边并命名为 `campus-lab-handoff`。

- 目标目录必须原本不存在；**不覆盖、不合并**到任何已有文件夹。
- 本步不复制原目录的 `.env`，也不应带出 `.private`、`.runtime` 与构建产物；公开导出应以不含这些内容为前提，复制后用下面的只读核对确认。若发现混入，先停下反馈，不要自行删除。
- 原 `campus-lab` 的源码、配置、`.env`、`backend/target` 一律不动，旧环境仍可原样启动。
- 新目录只使用自己生成的 `.env` 和新命名卷，不连接、不挂载、不复用原来的 `campus-v2_mysql-data`。

复制完成后只做只读核对：

macOS：

```sh
# 工作目录：campus-lab 的上一级
ls -a campus-lab-handoff
```

Windows PowerShell：

```powershell
# 工作目录：campus-lab 的上一级
Get-ChildItem -Force campus-lab-handoff
```

核对重点：应有项目主体（`backend/`、`frontend/`、`tools/`、`compose.yaml`、`README.md` 等），且**没有** `.env`、`.private`、`.runtime`、`backend/target`。若目标目录已存在或混入了本机私密内容，先停下反馈，不要自行删除。

新目录的 `.env` 由 12.3 自己生成，不复用旧口令。

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

`ps` 里看到的容器名应是 `campus-v2-handoff-mysql-1` 与 `campus-v2-handoff-redis-1`（Compose 自动命名）；出现 `campus-v2-mysql` / `campus-v2-redis` 就说明漏了 `-p`，操作落到了旧项目上，立即停下核对。

如果 `up -d` 曾因名称冲突失败过：`compose.yaml` 修好后**直接重跑同一条 `docker compose -p campus-v2-handoff up -d`** 即可，上次建好的 `campus-v2-handoff_default` 网络与 `campus-v2-handoff_mysql-data` 卷会被继续使用；不要 `down`，不要删那个新卷，也不要重新生成 `.env`。本次修复就是这样重跑成功的，没有重建卷。

B、A 窗口照第 5、6 节做，只是工作目录换成 `campus-lab-handoff/backend/` 和 `campus-lab-handoff/`。

两套环境的宿主端口完全相同：页面 5188、后端 8098、MySQL 23501、Redis 23502。旧项目的 A/B 进程或任意一个旧容器还在运行时，新环境启动就会端口冲突，因此**两组不能同时启动**。

`node tools/setup-env.mjs` 只生成一次 `.env`；同一交付目录再次检查时，工具会提示已保留并以非 0 退出码结束，这是正常的：**保留该 `.env` 与原项目名 `campus-v2-handoff`**，不要重新生成口令，也不要换成别的项目名去连这个目录的卷。

结束新环境只停止，不移除：

```sh
# 工作目录：campus-lab-handoff/
docker compose -p campus-v2-handoff stop
docker compose -p campus-v2-handoff ps -a
```

本课不要求移除新容器，也不要用 `down -v`；交接时容器和卷全部留着。

### 12.4 新卷是空的

- 新项目名会创建新卷 `campus-v2-handoff_mysql-data`，里面没有旧数据；MySQL 首次启动时用**新目录自己的 `.env`** 初始化账号与库。
- 已实测（2026-10-21）：新卷 `campus-v2-handoff_mysql-data` 创建时间 `2026-10-20T20:47:14Z`；旧卷 `campus-v2_mysql-data` 仍是 `2026-10-20T15:52:09Z`。时间戳未变**只说明旧卷没有被重建**，不等于验证了旧数据完整；本轮没有重新启动旧库逐条回读业务数据。
- 想回旧环境：先停止新环境，再启动旧环境，旧 `.env` 与旧卷都不动：
  1. 新目录 `campus-lab-handoff/` 只停不移：`docker compose -p campus-v2-handoff stop`，再 `docker compose -p campus-v2-handoff ps -a` 确认 `campus-v2-handoff-mysql-1` / `campus-v2-handoff-redis-1` 为 `exited`。
  2. 旧目录 `campus-lab/` 启动：`docker compose -p campus-v2 up -d`（必须带 `-p campus-v2`）。**这一步本轮没有演练过**，下面只是按配置推出的预期，不要当成已验证：旧环境当前停着的容器仍叫 `campus-v2-mysql` / `campus-v2-redis`（未改名）；但旧目录的 compose 若也同步了去掉 `container_name` 的写法，重跑时 Compose 可能按新配置重建容器、改用 `campus-v2-mysql-1` 这类默认名，也可能沿用原容器——以实际 `docker compose -p campus-v2 ps -a` 输出为准。等 `healthy` 后再用旧 `.env` 登录，旧数据是否原样同样以实际回读为准。
  3. 用完再回新环境时，顺序反过来：先在旧目录 `docker compose -p campus-v2 stop`（只停），再在新目录 `docker compose -p campus-v2-handoff up -d`。
- 两组容器名已隔离、可以并存，但**宿主端口完全相同**（5188 / 8098 / 23501 / 23502），所以仍然只能一组在跑：切换时只 `stop`，不 `down`、不删容器、不删卷。

---

## 13. 检查 Compose 顶层卷没有显式 name 或 external

`compose.yaml` 顶层只声明了键 `mysql-data`，没有 `name:`，也没有 `external: true`，因此卷名自动带项目名前缀：

- 默认项目 `campus-v2` → `campus-v2_mysql-data`
- 新目录 `-p campus-v2-handoff` → `campus-v2-handoff_mysql-data`（以 `campus-v2-handoff_` 开头）

只读检查（不展开 `.env`）：

macOS：

```sh
# 工作目录：campus-lab/
grep -n -A3 '^volumes:' compose.yaml
grep -n 'container_name' compose.yaml    # 期望没有任何输出
docker volume ls
```

Windows PowerShell：

```powershell
# 工作目录：campus-lab\
Select-String -Path compose.yaml -Pattern '^volumes:' -Context 0,3
Select-String -Path compose.yaml -Pattern 'container_name'   # 期望没有匹配
docker volume ls
```

- 看到 `mysql-data:` 且下面没有 `name` / `external` 即符合要求。
- `grep container_name` 没有输出，说明容器名由 Compose 按项目名生成，新旧项目不会互相占用名称。
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
- 新目录首次启动的名称冲突（2026-10-21，保留原始记录）：`campus-lab-handoff` 生成 `.env` 后执行 `docker compose -p campus-v2-handoff up -d`，新网络与新卷已创建，但创建容器时报 `Conflict ... container name "/campus-v2-mysql" is already in use`，占用者是旧 `campus-v2` 的已停止容器。已按 12.1 第 4 条停下，只停新项目，旧容器与旧卷原样保留；修法是只删掉本目录 `compose.yaml` 里 mysql / redis 的 `container_name` 两行，其余字段未改。
- 修复后新环境实跑成功：`docker compose -p campus-v2-handoff up -d` 正常创建容器，`campus-v2-handoff-mysql-1` / `campus-v2-handoff-redis-1` 均 `healthy`。
- 卷隔离：新卷 `campus-v2-handoff_mysql-data` 创建于 `2026-10-20T20:47:14Z`；旧卷 `campus-v2_mysql-data` 仍是 `2026-10-20T15:52:09Z`，未被重建。旧容器 `campus-v2-mysql` / `campus-v2-redis` 保持 `Exited`，**未改名、未重建**。
- 新后端：在 `campus-lab-handoff/backend/` 实跑 153 项测试，0 失败 0 错误；Flyway 在 Empty schema 上应用 V1–V4 后启动成功。
- 新前端：A 窗口从 `campus-lab-handoff/frontend/` 启动，页面可用。
- 新环境数据隔离：用新目录自己的 `.env` 在本机登录 `admin`（口令只在本机查看，不记录在此），读到 16 台设备、4 个空间；**启动基线**为设备责任 0 条、演练事件 0 条（这是新空卷初始化后的起点，不是最终结果），旧目录里的个人改动没有出现。
- 新目录六项走查（第 12 课，2026-10-21，全部在同一台电脑的 `campus-lab-handoff`、项目名 `campus-v2-handoff` 下完成）：
  - 设备到历史：设备 16 台；`d01` 详情点温度进入 `d01/temperature/°C`，走 `GET /api/overview`；设备页来源文字已说明负责人走 `/api/owners`。
  - 空间保存：`s1` 楼栋改为“交接教学楼”、楼层 3 层；`PUT` 成功、独立 `GET` 回读，整页刷新并用新目录口令重新登录后仍为相同值。
  - 责任登记：`d01` 备注“新目录接手巡查责任”，提交 `expectedVersion` 0，独立 `GET` 回读 `manager` / v1。
  - 新建演练：`case-a4b66d456baa`（“新目录接手温度巡查演练”），自动 `ASSIGNED` 给 `manager` / v1，创建时间线 1 条。
  - 处置闭环：`manager` 开始 v2、记事 v3；`admin` 模拟恢复 v4（仍 `IN_PROGRESS`、未核实）；`manager` 核实 v5（仍 `IN_PROGRESS`、`verified=true`）并写结论关闭 v6；最终 `CLOSED` / `RECOVERED` / `manager`，时间线 6 条。
  - 审计与只读：ADMIN `GET /api/audit` 实读 8 条（空间 1、责任 1、事件创建与 5 个动作各 1）；VIEWER 九菜单无写按钮、审计 403、接入状态可读；独立 HTTP 伪造 body role 的空间 `PUT` 仍 403，四项快照无变化。整页刷新后用新口令登录 `viewer`，仍读到该事件 `CLOSED` v6、`verified=true`、时间线 6 条。
- 导出与复制的实际校验（操作者补记，2026-10-21）：`hand-in-v1` 导出 140 文件，副本 8 项边界检查漏拦两项；补救后导出 `hand-in-v2`，**140 个文件逐个 SHA256 一致、同样 8 项边界全部通过**；`hand-in-v3` 用访达复制到全新 handoff 目录，**140 项再逐个比对与源一致**，且未复制 `.env`；命名修复同步回原工程后导出 `hand-in-v4`，**140 项与新目录运行副本逐字节/哈希一致**。
- 两件不同的事：上述校验说明导出与复制当时是完整一致的；但 12-04/12-05 又改过 `compose.yaml`、`README.md`、`frontend/app.js`、`frontend/data-service.js`，所以 handoff 根目录的 `SHA256SUMS.txt` 现在只是**初始导出的历史清单**，对这几个已改文件不再匹配；没有手改旧清单（收尾时另用 `hand-in-final` 重新导出核对，见下两条）。
- 第 12 课实际收尾（2026-10-21，操作者补记）：原 C 执行 `node tools/export-source.mjs --out .runtime/hand-in-final/campus-lab`，得到 **141 个公开文件**与新的 `SHA256SUMS.txt`；**141 项逐个哈希与原工程源码、新目录运行副本全部一致**，最终导出里的两份说明也已实际打开核对；旧导出（`hand-in-v1`…`v4`）保留未覆盖。
- 实际停机：新 A、新 B 各自 `Ctrl+C`；新 C 执行 `docker compose -p campus-v2-handoff stop` 与 `ps -a`，**两新容器均 `Exited(0)`，两旧 `campus-v2` 容器也保持 `Exited(0)`**；新旧两个 MySQL 卷保留，未 `down`、未删卷/删容器，两个 `.env` 的文件哈希与生成时一致。
- 后续若再同步收尾文字：会同步回原工程、用**未使用过的新输出名**重新导出并核对，**不手改历史 SHA 清单**，最终以最后一次导出的完整清单与过程报告为准。

### 未实测（不要当成已验证）

- Windows PowerShell 命令：本工程未在 Windows 上实跑，JDK 路径只能按本机实际安装位置自行确认。
- 新旧环境来回切换未实际演练：新环境停止后回旧 `-p campus-v2` 启动、旧库是否原样、再切回新环境，这三步都只按 12.4 写成步骤；旧容器在去掉 `container_name` 后是否被复用或重建，也未经实测。
- 另一台电脑、跨机访问、局域网共享。
- 真人学生/同伴独立验收；记录均来自同一人操作。
- 真实校园网络、AIRIOT、真实设备、设备控制、外部通知。
- 原始报警多页翻页：公开样本只有 1 条，两个翻页按钮均禁用。
- 长延迟响应下的 5 秒超时表现（只核对了代码，未构造慢响应）。

---

## 16. 记录与边界

- 本组实做记录：`docs/本组实做记录.md`（前端 01–06 课笔记已合并到“前端实做”，后端记录保留在各课小节）。
- 其他文档：`docs/页面需要的数据.md`（九个菜单与接口对照）、`docs/后端启动笔记.md`（Java/Node 版本与启动细节）、`docs/交付说明.md`（本交付稿）。
- 关于 `notes/`：`notes/` 只保留在**原工程**，公开导出与当前 `campus-lab-handoff` 里没有这个目录。第 01–06 课原始文字已合并到 `docs/本组实做记录.md` 的“前端实做”一节，交付副本从这里阅读即可。
- 数据边界：只连本机课程容器；不连学校数据库、不连公网设备、不做外部通知。
- 交付边界：不提交 `.env`，不复制个人截图、聊天记录或账号资料进文档。
- 工程状态（2026-10-21 收尾后）：旧环境 A/B 已停，`campus-v2-mysql` / `campus-v2-redis` 保持 `Exited(0)` 未改名，旧卷 `campus-v2_mysql-data` 保留；新项目 `campus-v2-handoff` 已用自己生成的 `.env` 在 `campus-v2-handoff_mysql-data` 新卷上跑通（两容器 healthy，后端 V1–V4 + 153 项测试通过，页面可登录），六项业务走查完成（`case-a4b66d456baa` 关闭于 v6、时间线 6 条、审计 8 条）；新 A/B 已 `Ctrl+C`，新 C `stop` 后两新容器 `Exited(0)`，未 `down`、未删卷/容器，两个 `.env` 保留。`hand-in-final` 已导出 141 个公开文件并逐项核对一致。
- 本稿时点说明：`docs/交付说明.md` 与本文档按上述实际记录整理；若之后再同步收尾文字，会回原工程重导新版本并重核，不手改历史 SHA 清单；最终以最后一次导出的完整清单与过程报告为准。
