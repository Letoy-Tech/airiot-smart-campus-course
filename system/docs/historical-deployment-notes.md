> 脱敏历史运维记录，仅供设计复盘。原部署命令不作为本仓库执行入口；当前配置要求见 [部署说明](campus-demo-deployment.md)。未携带原主机或凭据。

# 学校展示 demo 部署与恢复

部署合同：`demo-host` / `demo-host`，入口 `https://demo.example.invalid/campus-demo/`。这是隔离的模拟校园展示，不是实体设备运营验收。共享 AIRIOT 平台及其项目采集保持原运行方式，校园 demo 禁用实体/模拟远端开关控制。

## 路径与服务

| 对象 | 专属位置 |
| --- | --- |
| BE | `campus-demo.service`，`127.0.0.1:18091` |
| MySQL | `campus-demo-mysql.service`，专属容器 `campus-demo-mysql`，`127.0.0.1:13391`，数据库 `smart_campus_demo` |
| Redis | `campus-demo-redis.service`，`127.0.0.1:16391` |
| 已验证版本 | `/srv/campus-demo/releases/<release>/backend.jar` 与 `mg/` |
| 当前版本 | `/srv/campus-demo/current` 原子符号链接 |
| 可持久化数据 | `/srv/campus-demo/shared/mysql`、`shared/redis`、`shared/log` |
| 普通配置 | `/srv/campus-demo/shared/application.properties`，无密码或 AppSecret |
| 加密凭据 | `/etc/credstore.encrypted/campus-demo/`，root 0700 / 密文 0600 |
| 备份与回退材料 | `/srv/campus-demo/backups/`，root 0700 |
| 专属前缀代理 | `/etc/nginx/snippets/campus-demo-routes.conf`，从现有 AIRIOT 443 vhost 引入 |

服务器 systemd 255 的 TPM2 检测只有部分支持，使用 `systemd-creds --with-key=host`，没有使用 null-key。BE 通过 `LoadCredentialEncrypted` 和 Spring configtree 读取密码、JWT 密钥、专用 AIRIOT AppKey/AppSecret；密钥不会写入全局环境、参数、普通 properties 或前端。MySQL 初始化的 `_FILE` 从该 unit 的运行时 credentials 读取；Redis 直接读取加密凭据生成的运行时配置文件。

MySQL 固定为预检过的缓存镜像 ID，专属持久卷。容器使用 host 网络，但 mysqld 严格绑定 `127.0.0.1:13391`，关闭 mysqlx，不占共享 3306 / 33060，也不设置广域 root 授权。应用数据库用户与 root 管理密钥独立生成。

## 分阶段执行

在 `system` 目录执行。命令不会打印密码、令牌或密钥。

```sh
python3 scripts/campus-demo-deploy.py prepare --report docs/campus-demo-deploy-prepared.json

python3 scripts/campus-demo-deploy.py stage --release RELEASE_ID \
  --jar "/absolute/path/to/verified/backend.jar" \
  --dist "/absolute/path/to/verified/dist" \
  --report docs/campus-demo-deploy-staged.json

python3 scripts/campus-demo-deploy.py start-backend --release RELEASE_ID \
  --report docs/campus-demo-deploy-backend.json
```

`prepare` 只安装三个专属 unit、目录及凭据，不启动服务或改代理。完成过的凭据不会因再次 prepare 而轮换。新机初次准备如中断在密文写入阶段，脚本会拒绝覆盖，需要先私下核对已存在密文与状态，不能通过删除凭据绕过检查。

`stage` 对已通过构建的 JAR 执行 ZIP 校验及专用 AIRIOT 凭据字面量扫描；采用 32 MiB 分块、最多 4 路 SCP，逐块核验后仅在 staging 重组。检查整件大小、SHA-256、ZIP 与全部前端文件 SHA-256 后，发布不可变版本目录，不切换 current 或重启服务。

`start-backend` 启动专属数据库/Redis，以 Flyway 建立全新 schema，再原子切换当前版本并启动 BE。仅在直接 `/actuator/health` 返回 UP 后启用三个 unit 开机启动；失败恢复前一版，首版失败则停止 BE 并撤去 current，保留独立数据库和密文。

**账户初始化必须先于公网代理发布。** 通过受控 SSH 隧道访问远端回环 18091，由 `verify-campus-demo.py` 生成专属展示管理员、运营人员和查看者，完成 API 种子及授权验证。账户仅保存 `.private/campus-demo-accounts.json` 0600，不导入本地 JWT 会话或共享数据库。

```sh
ssh -F "/Users/learner/My Projects/城大服务器/server-ssh-config.txt" \
  -o BatchMode=yes -o ExitOnForwardFailure=yes \
  -N -L 127.0.0.1:18092:127.0.0.1:18091 demo-host

# 完成受控账户/API初始化与验收之后
python3 scripts/campus-demo-deploy.py publish --release RELEASE_ID \
  --report docs/campus-demo-deploy-published.json

python3 scripts/campus-demo-deploy.py verify \
  --report docs/campus-demo-deploy-technical.json
```

`publish` 要求该版本直接健康且数据库至少已有三个账号，验证全部静态文件可由实际 `www-data` worker 读取，备份原 vhost/原专属路由，仅增加 `/campus-demo` 精确前缀。Nginx 检查通过才 reload；保留 `/` 到 AIRIOT 13890 及 3941 运维入口。失败恢复原配置并证明 Nginx 检查/运行恢复。

技术验证报告包含 unit active/enabled、PID、三个监听、活跃 JAR 哈希、运行时 credential 文件存在性和模式，以及自有密钥在 unit、普通配置、参数、环境和 BE 日志中的暴露检测。正常运行/HTTP200仅是技术证据，业务、浏览器及权限验收另行记录。

## 仅更新 MG

当前 MG 版本为 `REL_20261005-0338-MG-UI`，`current` 指向这个独立版本目录；BE 仍运行 `REL_20261005-0151-SCHOOL-DEMO` 的已加载 JAR，PID `360464`，SHA-256 `374c26869b6decc13c8dd899c3b5cb6fd139df877142aa817d274a8e81e6862a`。新 MG 目录中的 `backend.jar` 是该远端原件的硬链接，inode 同为 `23860136`。MG 更新没有上传或重启 BE，没有改数据库、Redis、密钥或代理配置，也没有 reload Nginx。

```sh
python3 scripts/campus-demo-mg.py stage --release REL_20261005-0338-MG-UI \
  --dist "/absolute/path/to/verified/dist" \
  --expect-current REL_20261005-0151-SCHOOL-DEMO \
  --backend-sha 374c26869b6decc13c8dd899c3b5cb6fd139df877142aa817d274a8e81e6862a \
  --report docs/campus-demo-mg-staged.json

python3 scripts/campus-demo-mg.py activate --release REL_20261005-0338-MG-UI \
  --report docs/campus-demo-mg-activated.json

python3 scripts/campus-demo-mg-verify.py --release REL_20261005-0338-MG-UI \
  --preflight docs/campus-demo-mg-preflight.json \
  --report docs/campus-demo-mg-technical.json
```

以上命令记录本次发布参数，已经存在的版本目录会被拒绝覆盖。下次使用新的 release ID 和即时只读预检确定的 current；验证脚本比较预检前后的 BE 实际打开 JAR、服务 PID、代理配置和共享容器身份。`stage` 只上传前端压缩包及其逐文件清单，校验后准备两个独立不可变目录。`activate` 原子切换 current，校验 HTTPS 深路由的文档字节；失败自动切至兼容回退目录。

新旧版本的内容哈希资源并集同时保存在新 MG 目录和 `REL_20261005-0338-MG-UI-rollback` 目录，原始旧目录不被改写。已打开的旧页面仍可下载旧资源；回退后已经打开的新页面也能读取新资源。回退目录保留旧 index，并带有新旧资源，回退只需要切换 current：

```sh
python3 scripts/campus-demo-mg.py rollback --release REL_20261005-0338-MG-UI \
  --report docs/campus-demo-mg-rollback.json
```

MG 回退使用上述专用脚本，保留正在运行的 BE。当前 index 的 SHA-256 为 `617a1faa340bfe1fbd6f8ed674e67bd1a048ac14f921b26a3ad7135bd8683248`，入口资源为 `index-DN13BjNm.js` 和 `index-DnuubypI.css`。本次没有运行账户初始化或业务种子；MG 发布不产生新的数据库快照要求。公网浏览器与业务权限验收由对应 MG 验收报告记录，不能以静态文件检查替代。

本次已完成逐文件清单与权限校验：新目录和兼容回退目录各 125 个文件，均可由 `www-data` 读取；新目录全部 125 个文件通过服务器 SNI HTTPS 字节哈希核对，旧版 57 个资源在新目录和回退目录中保持原字节。BE 实际打开 JAR 的文件描述符、inode、哈希、PID，以及 MySQL / Redis / Nginx PID 与代理配置哈希均保持一致；49 个共享容器的身份、镜像和运行状态无差异，9 个共享域名 HTTP / TLS 复核通过。未切换到回退目录。详细清单见 `campus-demo-mg-technical.json`，独立发布摘要见 `campus-demo-mg-final.json`。

本机按域名正常校验证书的公网请求、线上登录页及手机布局验收分别见 `campus-demo-mg-public-acceptance.json`、`campus-demo-mg-assets-acceptance.json`、`campus-demo-mg-browser-acceptance.json`。学校实际外部网络尚未连接验证，不能用本机代理的 fake-IP 解析或服务器回环 SNI 检查推断该网络可达性。

## 备份和隔离恢复验证

```sh
python3 scripts/campus-demo-deploy.py backup \
  --report docs/campus-demo-deploy-backup.json

python3 scripts/campus-demo-deploy.py restore-check \
  --backup /srv/campus-demo/backups/database-TIMESTAMP/smart_campus_demo.sql.gz \
  --report docs/campus-demo-deploy-restore.json
```

备份只处理 `smart_campus_demo`，采用专属加密管理凭据运行 mysqldump，数据库内容通过管道直接写入 root 0600 压缩备份；不将管理密码置于参数或临时明文配置。包含一致事务、表结构、例程、事件与触发器，记录大小及 SHA-256。

备份使用逐条 INSERT，从 dump 中提取一致性事务快照的逐表行数。恢复验证先核验备份哈希，创建临时 `campus_demo_restore_*` schema，导入并比较表名、表数及每张表的快照行数后删除临时 schema。实时日志/审计可能在备份后增长，报告另外记录 live 差异，不把后续增长误判为恢复失败。该步骤不覆盖运行数据库，也不代表灾难切换已经演练。

2026-10-05 的 BE 版本为 `REL_20261005-0151-SCHOOL-DEMO`，该次完整部署摘要见 `campus-demo-deploy-final.json`；之后的 MG 独立更新见上节及 `campus-demo-mg-*.json`。已验证的数据库快照包含 4 条独立 DEMO 事件及 18 条处置日志，18 张表完成了实际隔离导入和快照行数核对。初版及第二版完整部署的发布校验失败、配置自动恢复、后续复核结果分别保存在 `campus-demo-deploy-publish-attempts.json` 和 `campus-demo-deploy-publish-failures.json`。第二版沿用字节相同的前缀代理，最终检查没有再次 reload Nginx。

## 版本回退

```sh
python3 scripts/campus-demo-deploy.py rollback --release RELEASE_ID
```

回退恢复本版本激活前的 vhost/路由和已有前版 current，重启专属 BE 并检查健康；首版没有前版时撤去公开路由、停止和 disable BE，保留数据库、Redis、密文及备份。脚本不恢复或删除运行数据库，不能用代码回退掩盖不兼容数据库迁移。共享 AIRIOT 容器身份与镜像的前后比较保留在 publication 报告，已有自主重启单独记录。
