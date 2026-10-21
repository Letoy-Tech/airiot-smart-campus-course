# 同一份 app，逐站增加业务

本套件起于 CodeBuddy 学生实做工程 V1.2.0（**起点 215 个文件，不是当前文件数**）。业务页面由 IDE 内模型生成；后端、API、组件与测试为教师提供的公共底座。源码包不含密码、依赖和构建产物。

## 目录结构

```
campus-ai-lab/            # 套件根目录
├── app/                  # 本文所有命令都在此目录执行
│   ├── backend/ frontend/ fixtures/ docs/ tools/ evidence/
│   ├── .private/         # 本机生成：账号与数据库配置；不交付、不给AI
│   └── lesson-bundles/   # 教师参考；仅课程内部使用，交付包已排除
└── tools/                # 仅作者本机验收辅助（teacher-local-db.py 等）
```

- 只拿到 `app/` 一个目录也能运行，但**必须由教师提供数据库配置**（见 3B），不能声称自动可运行。
- `../tools/teacher-local-db.py` 是操作者把教师公共工具改为专属端口的辅助，不属于学生成果，也不是学生安装要求。

## 1. 环境前提

| 项目 | 要求 | 不满足时 |
| --- | --- | --- |
| Node | 22.21.1（脚本要求 22.x 且 ≥22.12） | `doctor` 报“本资源包冻结 Node 22” |
| JDK | 17.0.12，`JAVA_HOME` 指向 JDK 根目录，`PATH` 含 `$JAVA_HOME/bin` | 报“先设置JAVA_HOME到JDK17根目录” |
| 终端 | **每个新终端都要重设 JAVA_HOME 与 PATH**；`frontend` 子命令同样校验 | 前端启动也会失败 |
| 端口 | 8091 后端、5178 前端空闲 | 脚本只报端口被占用，不会结束占用进程 |
| 数据库 | 见第 3 节，二选一 | `migrate`/`backend-db` 直接失败 |
| 平台 | macOS arm64 已实测；Windows 未验证 | Windows 若 `npm.ps1` 受限，用 `npm.cmd` |

课程工具全部通过 `node tools/course.mjs <子命令>` 调用：`doctor`、`init`、`check`、`build`、`migrate`、`backend-db`、`backend`、`frontend`。

## 2. 安装与检查

```bash
cd campus-ai-lab/app
npm --prefix frontend ci

export JAVA_HOME="<JDK17 根目录>"        # 按本机实际安装路径替换
export PATH="$JAVA_HOME/bin:$PATH"

node tools/course.mjs doctor             # Node/JDK/关键文件/8091+5178 端口
node tools/course.mjs init               # 首次：生成 .private/accounts.json，不打印密码
node tools/course.mjs check              # fixtures 校验 + 后端 mvn test + 前端类型 + 单测
node tools/course.mjs build              # 产出 backend/target/campus-ai-course-0.1.0.jar
```

- `init` 已存在文件时保留原内容，不覆盖。
- **`build` 必须先于 `migrate`/`backend-db`**，否则报“缺少后端JAR，先执行 node tools/course.mjs build”。
- `check` 与 `build` 只证明类型、单测和构建，不证明真实 HTTP、MySQL、Windows 或 AIRIOT 通过。

## 3. 数据库准备（二选一）

### 3A. 本机含外层 `tools/`（作者/验收机）

macOS 已装 MySQL 8.4.10，辅助脚本固定使用 `/opt/homebrew/opt/mysql@8.4/bin` 与专属端口 23491（不用原平台端口）。

```bash
# 仍在 app/ 目录
python3 ../tools/teacher-local-db.py init          # 起 23491，建 campus_course_lab / campus_course_test，写 .private 数据库配置
node tools/course.mjs migrate                       # 明确的一次性 Flyway，只应用新迁移，不 clean
python3 ../tools/teacher-local-db.py use-runtime    # 切到只读写运行账号
```

- 本节只准备数据库，**不启动后端或前端**；启动统一在第 4 节的两个终端，避免重复启动撞 8091 端口。
- 先执行过 `course init` 时，`.private/accounts.json` 会被辅助脚本保留；它仍可首次建立本机数据库实例。
- 辅助脚本拒绝已有数据目录或已有管理配置，不覆盖已存在的实例；`migrate` 只针对 `.private/database.json` 指定的库。
- 数据库测试另用 `.private/test-database.json`（`campus_course_test`，带 `allowTestReset`），不碰交付库。

### 3B. 只有 `app/` 包（交给别人复现）

1. 教师按 `docs/02-教师数据库交接单.md` 提供本组独立库与 `.private/database.json`（`url`/`username`/`password`）。
2. 教师执行一次 `node tools/course.mjs migrate`，再提供日常运行账号配置写入 `.private/database.json`；启动按第 4 节。
3. 本包**不含任何密码、账号或数据库配置**；缺 `.private/database.json` 时命令会明确失败，此时“开箱即跑”的说法不成立。

## 4. 启动（两个终端）

终端 A（后端 8091）：

```bash
export JAVA_HOME="<JDK17 根目录>"; export PATH="$JAVA_HOME/bin:$PATH"
node tools/course.mjs backend-db
```

终端 B（前端 5178）：

```bash
export JAVA_HOME="<JDK17 根目录>"; export PATH="$JAVA_HOME/bin:$PATH"
node tools/course.mjs frontend
```

浏览器打开 http://127.0.0.1:5178 ，用教师分配的账号登录。尚未配置数据库的早期阶段，终端 A 改用 `node tools/course.mjs backend`（first-chain，不连数据库）。

## 5. 主流程（按页面顺序）

1. 登录：取 CSRF → 登录 → 重新取 CSRF → 读身份与能力位。
2. 查设备：设备与空间并发读取，同一批观察时间。
3. 看统计：空间/类型/在线/质量筛选；点位 `null` 为缺失，`0` 是有效样本。
4. 查历史：必须带 `deviceId`、`tagId`、`from`、`to`，毫秒跨度 ≤ 6 小时。
5. 处理事件：演练触发 → 分派 → 开始 → 追加说明 → 来源恢复 → 核实 → 关闭，每步带 `expectedVersion` 并写时间线。
6. 设备负责人：A 改 B 后旧事件保留 A，新事件按当时负责人快照分派。
7. 接入页：只读展示 AIRIOT `configured`/`connected`，`control=false`，远端控制与外部通知关闭。
8. 失效处理：401 清会话并提示重登；403 清目录并提示权限变化。

## 6. 打包交付

```bash
node tools/hand-in.mjs
```

生成 `../app-handoff-<时间戳>/` 与 `HANDIN-MANIFEST.json`。

- 排除：`.private`、`.runtime`、`node_modules`、`target`、`dist`、`journey-backups`、`.har`/`.log`/`.env`，以及 **`lesson-bundles`（教师参考，未读取、未复制、不入清单）**。
- 仍保留：密码扫描（命中本机已知密码即中止，不打印密码）与符号链接拒绝。
- 生成的目录需人工检查文字和截图，再用系统“压缩”成 ZIP；本命令不发布到服务器，也不代表接手者已复现。

## 7. 课程内的实际生成方式

本次只使用以下流程，全程不读取任何教师参考：

1. `node tools/progress.mjs plan 02` —— 读本次文件清单、契约与检查动作。
2. `node tools/progress.mjs begin 02` —— 上一站 verify 通过后，准备公共依赖、装配与未完成骨架。
3. 在 CodeBuddy IDE 打开 plan 列出的业务文件，由 IDE 内模型实际生成实现；只改目标文件，不引用 `.private`。
4. `node tools/progress.mjs verify` —— 只查类型、前端单测和构建。
5. 实际点页面，手工写 `evidence/stage-02.md`。
6. `node tools/progress.mjs accept 02 evidence/stage-02.md` 登记该份人工证据。

- 本次**不使用** `progress show`，**不使用** `progress apply`；不做参考导入，也不做备份对照。
- 交付包已排除 `lesson-bundles`，因此课程内部的 `begin`/`show`/`apply` 在交付包中不可用；交付复现一律走 `node tools/course.mjs`（doctor/init/check/build/migrate/backend-db/frontend）。
- 业务文件加入后不在后站重写；`App.vue`、`FullWorkspace.vue` 与 `journey` 目录是阶段装配，不作为日常练习修改。

## 8. 验证边界与已知未验证项

- 第 01–11 站已 accept；第 12 站（新目录交接）已由**同一操作者**完成交接模拟并验证（见第 9 节）。第 12 站已由操作者依据 `evidence/stage-12.md` 完成 accept 登记（exit 0）；这是人工验收记录，工具验证与新目录模拟证据另列。
- 前端 16 个文件 74 项测试通过；后端在独立 `_test` 库完整运行 50 项、0 失败、0 跳过（含事务回滚、并发、快照 JSON）。
- 普通非 DB 测试运行 50 项中 16 项跳过，**不表述为全部通过**，也不宣称任何通过率。
- 未验证：另一名真人独立复现、Windows 实机、学校/校园真实数据库、真实 AIRIOT 下发（仅状态展示，`control=false`）。
- 全部设备、点位、事件为教学模拟数据（`TEACHING_MOCK`/`DEMO`/`LOCAL_DEMO`/`DEMO_NOTICE`）。
- `verify` 不启服务、不写数据库，不代表浏览器、Windows 或真实 AIRIOT 已验证；真实 AIRIOT 为选做，远端控制与外部通知保持关闭。

## 9. 第 12 站新目录交接模拟（2026-10-20）

同一操作者在 `handoff-run/app` 新目录复现，用于验证交付包可复制运行，**不是另一名真人验收**。

- 从已审查（无教师答案、私密配置、依赖与构建产物）的 162 文件源码导出，逐文件 SHA-256 核验后复制。
- `npm ci` 重新安装 192 个包；`doctor`/`init`/`check`/`build` 均 exit 0；新账号与原账号密码全部不同。
- 数据库为新物理数据目录 MySQL 8.4.10、端口 23491；空库应用 2 个迁移，随后切 DML 运行账号。
- 旧服务先停止，新的 8091/5178 从新目录启动；浏览器用新账号登录。
- 查询同一 `teaching_energy_01` 的 `power` 历史：4 个样本，其中 1 个 `null` 断口、1 个有效 `0`。
- 新事件列表初始为 0；首件 `8f35eeea-3d65-4ac1-ae9e-7b0683dc4d7f` 依次经历 NEW/v1 → 分派 A/v2 → 开始 v3 → 人工 NOTE/v4 → 来源恢复 v5 → 独立核实 PASS/v6（仍处理中）→ 明确关闭 v7；完整刷新后保持 CLOSED 与关闭结论。
- 全程未改新目录业务源码。

边界：另一名真人独立复现、Windows 实机、真实学校数据库与真实 AIRIOT 仍未验证；交付仍为只读模拟，远端控制与外部通知关闭。
