# AIRIOT 大湾区高校产业联盟协作指南

本文件适用于本项目目录。进入 `system/Letoy WAGF BE/` 时，同时遵守该目录的 `AGENTS.md`。联盟文书与智慧校园软件是两类工作，先按用户任务定位范围。

## 目录与依据

- 根目录的联盟构想、加入协议及共建协议为文书；`scripts/build_proposal.py` 和 `scripts/build_membership_agreement.py` 分别生成相关 Markdown/HTML，后者也输出 `scripts/membership_agreement_source.json`。JSON 是脚本输出，正文定义在 Python 中；不要把生成结果单独改成另一套正文。
- `system/Letoy WAGF MG/`：Vue 3、TypeScript、Pinia、ECharts 管理端。校园 API 在 `src/api/campus.ts`，合同类型在 `src/types/campus.ts`，状态在 `src/store/campus.ts`。
- `system/Letoy WAGF BE/`：Java 17、Spring Boot 3.4.2；校园模块在 `src/main/java/com/letoy/main/campus/`，负责 AIRIOT 适配、权限、本地映射、演练与审计。
- `system/scripts/`：本地专属运行管理与验收脚本；`system/docs/`：接口合同、演示说明、部署流程和历史证据。
- 工作前读 `system/README.md`、`system/docs/api-contract.md`；文书改动回查对应 Python 正文与现有原文。不要把软件角色或测试账户规则写进高校加入协议。

## 开发与验证入口

以下命令在标明的目录运行，按任务范围选择；命令说明不授予部署、启停共享服务或对外发送的权限。

| 目录 | 命令 | 用途 |
| --- | --- | --- |
| 项目根 | `python3 scripts/build_proposal.py` | 重新生成构想 Markdown/HTML，会覆盖对应输出 |
| 项目根 | `python3 scripts/build_membership_agreement.py` | 重新生成加入协议 Markdown/HTML/JSON，会覆盖对应输出 |
| `system/Letoy WAGF BE` | `./mvnw test`、`./mvnw package` | 后端测试与构建 |
| `system/Letoy WAGF MG` | `npm run type-check`、`npm run test:unit -- --run`、`npm run build` | 类型、单元测试与生产构建 |
| `system` | `python3 scripts/local-runtime.py status` | 查看本系统专属进程 |
| `system` | `python3 scripts/local-runtime.py start` | 启动专属 MySQL、Redis、BE、MG；先核对端口与已有进程 |

- 本地脚本使用 BE `target/letoy-wagf-be-0.0.1.jar`，MG 要求 Node `^20.19.0 || >=22.12.0`。本地 BE/MG 端口为 `8001/5173`，专属 MySQL/Redis 为 `13316/16379`，运行脚本绑定回环地址。
- MG 的 `lint` 与 `format` 含自动修复/写入，不当作只读检查。学校 DEMO 子路径构建使用 `VITE_API_BASE_URL=/campus-demo/api npm run build-only -- --base=/campus-demo/`，类型检查单独运行；不要将参数直接传给 `npm run build`。
- 文书生成后比较 Markdown、HTML 和导出版的文字与排版；生成完成不等于协议已经签署或对外发送。软件本地构建、接口验证、浏览器检查和真实校园接入分别报告。

## 业务边界与工程约定

- MG → BE → AIRIOT；映射、演练事件、设备责任与审计保存于独立数据库。AIRIOT 原始报警保持读取用途，本地 DEMO 事件不替代上游报警或真实故障。
- 权限由 BE 的 `CampusAccess` 最终决定，MG capabilities 只接受 Boolean `true`。保留管理员、校园管理人员、只读查看者的范围及本人已分派事件限制。
- 演练与责任变更携带 `expectedVersion`；冲突回读最新记录，禁止自动重放旧决定或显示未确认成功。学校 DEMO 的远端控制与外部通知保持关闭；历史演练授权不可复用成新任务授权。
- 保留模拟标识、来源、采样时间与质量；未知值不补零。V/kW 不能直接当作 kWh、费用或节能率。
- Java 沿用 `controller/service/mapper/entity/dto` 分层、4 空格与现有响应结构；接口变化同步 MG 类型/调用与合同。Flyway 用新增迁移，保留已应用历史。
- `target/`、`dist/`、`.runtime/`、`tmp/` 为生成或运行资料；历史验收 JSON 不改写成新结果。`.private/` 保存专属凭据与账户，避免读取无关秘密、复制到源码、前端 `VITE_*`、聊天或证据。
- 保留用户未提交内容；仅修改当前任务涉及文件。发布、远端平台写入、数据库迁移、服务启停和协议发送均按用户当前明确授权执行，既有脚本或旧证据不构成授权。
