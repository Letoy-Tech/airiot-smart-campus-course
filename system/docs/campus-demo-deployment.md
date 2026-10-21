# 在自己的环境部署示范系统

部署工具不附带原服务器、账户、网关或可用凭据。Linux 目标需预先具备 Java 17、Docker、Redis、MySQL 客户端、Nginx、systemd 与 `systemd-creds`，并具有自己的有效 HTTPS 站点。脚本仍按固定专属布局 `/srv/campus-demo`、三个 `campus-demo*.service` 和回环端口 `18091/13391/16391` 运行；使用前核对目标不存在同名但无关资源。

## 显式配置

复制 `../configuration/deployment.example.json` 到本机 `system/.private/deployment.json`，替换所有示例字段：

- `ssh_host`：本机 SSH config 中的目标别名；`ssh_config`：该配置的绝对路径。
- `expected_hostname`：目标系统 hostname，远端执行前必须精确匹配。
- `public_host`：自己拥有的 HTTPS 域名。`.invalid` 示例域名拒绝执行。
- `upload_user`：目标用于 staging 目录上传的用户和同名组。
- `mysql_image`：自己核对的不可变 MySQL 8.4 image digest；全零示例值拒绝执行。
- `airiot_base_url`：独立示例 AIRIOT 网关；要求 HTTPS，或明确的回环 HTTP 地址。
- `shared_compose_project` / `shared_entries`：确实需要保持和复核的共享 Compose 项目与 HTTPS `{host,path,status}` 列表；没有共享资源时使用空字符串/空数组。不会携带或探测原作者其他站点。

JSON 仅保存非秘密配置。AIRIOT 应用凭据放在独立 `system/.private/airiot.properties`，权限 `0600`。项目 ID 与两个后端常量必须一致，详见系统 README。所有 `.private` 和生成证据/运行资料均不提交。

## 命令入口

以下命令必须由维护者针对自己的目标主动执行。缺少 `--config` 或 `--execute` 时在任何 SSH 操作前退出；示例配置不能通过验证。此次源码发布仅验证本地参数解析、拒绝路径、构建与测试，没有执行远端部署。

```sh
cd system
python3 scripts/campus-demo-deploy.py --help
python3 scripts/campus-demo-deploy.py prepare --config .private/deployment.json --execute
```

后续操作仍分为 `stage`、`start-backend`、初始化自己新环境的账户/示例数据、`publish`；涉及版本的操作还要求 `--release`，stage 要求最终 `--jar` 和 `--dist`。必须先读取脚本并核对站点结构，尤其 `publish` 会变更专属 Nginx 子路径并 reload Nginx；它保留和校验旧配置、失败回退。

前端子路径构建：

```sh
cd 'Letoy WAGF MG'
npm run type-check
VITE_API_BASE_URL=/campus-demo/api npm run build-only -- --base=/campus-demo/
```

后端完整部署使用 `campus-demo-deploy.py`。仅 MG 更新使用 `campus-demo-mg.py`，同样需要 `--config` 和 `--execute`；保留后端进程与文件校验。`campus-demo-mg-verify.py` 仅读取指定远端，也要求显式配置和开关。

`verify-campus-demo-public.py` 要求 `--base-url` 和 `--output`；会使用自己新建的受限测试账户登录并撤销测试会话，不创建事件。`verify-airiot-reads.py` 要求 `--base-url` 和 `--output`，使用本机独立专用应用执行读取。它们没有内置公网目标，也不覆盖历史报告。

## 备份与边界

工具提供专属备份、隔离恢复检查和版本回退，保留原系统的加密凭据、不可变版本、校验和及冲突拒绝机制。配置和运行数据必须由部署者另行备份，不随源码归档。账号/角色 TEST 脚本会创建或修改测试数据，不能未经核对运行在实际校园库。

[脱敏历史部署记录](historical-deployment-notes.md) 仅供复盘原设计，不能代表本仓库在新主机已部署或验收。
