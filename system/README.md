# 完整智慧校园示范系统

本目录保留课程之外规模最大的完整示范系统：Vue 3 管理端、Java 17 / Spring Boot 3.4.2 后端、数据库迁移、权限、AIRIOT 适配、空间映射、监测与历史、设备责任人、本地演练事件闭环、审计，以及独立部署工具。

这是脱敏源码发布副本。真实凭据、账户文件、数据库、运行日志、原 Git 历史、真实服务器地址和未复核截图均未包含。`docs/` 中保留的历史技术证据经过脱敏，不能作为新环境的验收结果。

## 结构

| 路径 | 内容 |
| --- | --- |
| `Letoy WAGF MG/` | 管理端完整源码、锁文件与前端测试 |
| `Letoy WAGF BE/` | 后端完整源码、测试、Flyway V1–V10 与 Maven wrapper |
| `configuration/` | 无真实值的配置样例 |
| `scripts/local-runtime.py` | 本机独立 MySQL / Redis / BE / MG 管理工具 |
| `scripts/campus-demo-*.py` | 必须显式指定目标与执行开关的 Linux 部署工具 |
| `docs/api-contract.md` | API、角色、版本冲突与业务状态合同 |
| `docs/campus-demo-deployment.md` | 发布副本的部署配置与操作边界 |
| `docs/publication-verification.json` | 本次发布副本的构建与脱敏验证结果 |

## 本地构建

需要 Java 17、Node `^20.19.0 || >=22.12.0`、npm；第一次构建需要下载 Maven / npm 依赖。

```sh
cd 'system/Letoy WAGF BE'
./mvnw test
./mvnw package

cd '../Letoy WAGF MG'
npm ci
npm run test:unit -- --run
npm run build
```

`npm run build` 已包含 TypeScript 类型检查和生产构建。不要把带自动修改的 `lint` / `format` 当作只读检查。依赖、`target/`、`dist/` 都不提交。

## 独立本机运行

`local-runtime.py` 的默认数据库工具位置适用于 macOS Homebrew；可通过 `CAMPUS_DB_BIN` 指定 MySQL 和 Redis 可执行文件所在目录。先核对专属端口：MySQL `13316`、Redis `16379`、BE `8001`、MG `5173`。脚本遇到其他进程占用时退出，不停止占用者。

```sh
cd system
python3 scripts/local-runtime.py status
python3 scripts/local-runtime.py start
```

首次启动会在本目录 `.private/` 生成随机的新数据库、Redis 和 JWT 配置，在 `.runtime/` 创建独立数据；它们均被 Git 忽略。脚本不会导入原作者的账户或数据库。管理账户需通过系统自己的初始化/账户流程建立，相关 TEST 验证脚本会写测试数据，应先阅读脚本再按需要执行。停止命令保留数据，不能通过删除 `.private/` 或数据目录处理普通启动错误。

管理端入口 `http://127.0.0.1:5173`；后端仅监听回环。前端 `/api` 代理到 BE。

## 配置自己的 AIRIOT 示例项目

最大示范系统通过 MG → BE → AIRIOT 读取，不提供隐藏的 mock fallback。未配置时返回明确的接入不可用；构建通过不等于存在实时校园数据。可独立完成课程演练的学生版本在仓库的课程/实做目录。

本仓库固定项目 ID 已替换为合成值 `000000000000000000000001`。实际接入前，请为自己的独立模拟项目调整 `AiriotProperties.PROJECT_ID`、`CampusCatalog.PROJECT_ID`、对应测试和配置中的同一项目值，并重新执行测试。不要取消固定项目/对象白名单检查。对象设计保持 4 个模拟空间、16 台模拟设备、28 个点；实际接入应按 [AIRIOT 接入说明](Letoy%20WAGF%20BE/docs/airiot-integration.md) 建立独立示例模型。

复制 `configuration/airiot.properties.example` 到本机 `.private/airiot.properties`，将权限设为 `0600`，只填写自己拥有的示例网关和专用应用凭据。`local-runtime.py import-airiot` 更新独立本机配置，之后按需重启本系统应用。也可使用环境变量 `AIRIOT_BASE_URL`、`AIRIOT_PROJECT_ID`、`AIRIOT_APP_KEY`、`AIRIOT_APP_SECRET`；不要把秘密写入前端 `VITE_*`。

模拟标识、采样时间、质量、权限、`expectedVersion` 和写后回读均保留。默认禁用远端控制，外部通知不启用。能源点位的 V / kW 不代表 kWh、费用或节能率。

## 历史与验证边界

[脱敏历史系统概览](docs/historical-system-overview.md) 和原验收 JSON 保留原结果时间；其中域名、资源身份和机器路径已替换，不可作为连接入口。密码、API key fallback 与秘密指纹已移除。未复核截图以排除清单说明为准。

本仓库构建和测试验证与真实 AIRIOT 接入、远端部署、手机和课堂验收分别记录。此次整理不启停原系统，不迁移或发布原数据库。
