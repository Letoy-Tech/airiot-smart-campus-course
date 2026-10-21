# Round 9：第04—07篇完全新手跟做复核

- 日期：2026-10-19。
- 状态：四篇Markdown已修订并冻结；只读对照当前 `resources/student-project`，本轮没有启动服务、连接数据库、执行应用测试或读取私密配置。
- 写入范围：`walkthroughs/04—07`四篇与本交接文件。未改工具、工程、图源、HTML/PDF或历史验收。
- 验证边界：这是教材操作链审校。独立解压工程中的逐章执行由主会话另行记录；本报告不表示Windows、学校数据库或课堂试跑已通过。

## 本轮修正

| 章节 | 原先会卡住的动作或错误预期 | 已补内容 |
| --- | --- | --- |
| 04 | 新手可能用Safari套Chrome步骤、分不清终端类型；Git翻页界面误当卡死 | 明确Chrome/Edge、PowerShell选择入口、`git diff`按q退出、源文件全选复制快捷键 |
| 04 | 后端重新启动后直接点击读取被描述成自动恢复 | 按真实HttpSession与前端401分支改成：停止期间保留旧快照；重启后首次请求使旧登录失效；重新登录原账号后再确认两台读取恢复 |
| 04 | 密码复制边界、服务启动完成点不够明确 | 账号文件从文件树打开；密码只取引号内文字；关闭私密标签；看到`Started CourseApplication`才继续，不将失败退出当运行中 |
| 05 | 只有“教师放好数据库”，没有接收和确认动作 | 明确接收教师单独提供的完整database.json、从VSCode定位.private、保留accounts.json、检查扩展名、未交接参数不得猜；教师明确网络/迁移/日常账号确认，学生再启动及真实读写 |
| 05 | 两个后台服务占着终端，后续检查没有可输入的位置 | 明确A后端/B前端/C检查，各新终端独立设置JAVA_HOME；重启回读先刷新并重新登录 |
| 05 | 只以不存在楼栋验证两项存在性检查 | 新增“合法楼栋+不存在空间”的独立404；保留原绑定及不存在空间未落盘的读取对照；与viewer403及admin200分开记录 |
| 06 | 容易每行重置条件、误找查询按钮、把详情持久化误当筛选持久化 | 明确即时筛选、逐行累积条件；整页刷新检验稳定设备ID，筛选可回初始值；实验后收起详情并清除筛选 |
| 06 | 窄屏和网络阻止的按钮、恢复动作不清楚 | 明确Responsive与390输入、焦点回页面后Tab；只阻止设备URL、保持DevTools、不Offline；被浏览器阻止没有HTTP状态；手动取消规则后再读取；另开检查终端 |
| 07 | 预测表用自造1/O组合，实际夹具却用24.5/O-1000，难以逐条核对 | 八项预测输入与quality-cases完全一致；给四个边界案例ID、Surefire本次报告定位及跳过项的解释 |
| 07 | JsonNode、采样点定位、GET参数和轮询失败恢复缺操作桥梁 | 先用白话解释JsonNode；三条点值增加deviceId与时间；GET参数页签定位；明确阻止规则持续生效、须手动取消；A/B启动与第三检查终端说明 |

## 逐项对应的工程依据

均相对于 `resources/student-project/`：

- `tools/course.mjs`：doctor要求空闲端口8091/5178；所有course动作均检查JDK17/JAVA_HOME；first-chain与teacher-db命令不同；完整启动读取`.private/database.json`，不自动迁移。
- `tools/chapter.mjs`、`tools/chapter-tasks.json`：prepare04—07标记及状态记录；正文保留重复prepare不覆盖当前代码的规则。
- `frontend/src/api/campus.ts`、`views/FirstDeviceRead.vue`：A解包、B三态、first-read按钮和错误文字。
- `frontend/src/stores/campus.ts`、`App.vue`：401清理身份与旧目录、重新登录、实际按钮名称；本次修正文案的依据。
- `backend/src/main/java/edu/campus/course/LocationService.java`：C05两个存在性条件、404、检查在绑定写入之前。
- `frontend/src/views/LocationsView.vue`：三个表单、保存/刷新按钮；刷新依次读取locations与spaces。
- `docs/02-教师数据库交接单.md`：组库隔离、教师迁移、日常配置与专用_test的分工；没有把示例参数当实际学校环境。
- `frontend/src/domain/course.ts`、`views/DeviceCatalog.vue`、`components/ReadStatus.vue`：C06条件组合、稳定ID详情、样式类、空/失败文案。
- `backend/src/main/java/edu/campus/course/QualityPolicy.java`、`backend/src/test/java/edu/campus/course/QualityPolicyTest.java`：C07判断顺序、严格边界、夹具驱动测试及历史截断测试名。
- `frontend/src/views/OverviewView.vue`、`HistoryView.vue`、`composables/useRequestScope.ts`：监测/历史页面字段、查询参数、轮询及离页检查说明。
- `fixtures/catalog.json`、`quality-cases.json`及历史示例：按当前实际教学数据核对，未改数据。

## 本轮实际检查

1. 四篇代码框全数闭合：04为60条围栏、05为42、06为40、07为48，共95个代码块；四篇本地Markdown/图片链接均存在。这里只检查引用存在，未重新渲染或验图。
2. 内存读取catalog推演16→4→1→0，分别为完整目录、空间01、空间01且环境、再且online为null，与正文一致。
3. 逐字段核对07预测表八项value/time/expectedQuality，均与quality-cases中的对应项一致。
4. 核对零值/缺失/陈旧三个Point的deviceId/tagId/value/unit/time/quality，以及historySeries保留null与0的实现。
5. 第05篇4个JavaScript代码块通过`node --input-type=module --check`静态语法检查；未执行fetch、登录、写入或403/404实验。
6. 手工核对正文命令所指测试文件、关键测试名、源文件与TODO标记；未运行npm/Maven测试或构建，不报新增运行PASS。

## 已告知主会话的工程元数据问题

审查时`fixtures/quality-cases.json`中的`policy.combinedErrorPrecedence`仍为`NOT_FROZEN`，但当前源码、测试与新正文已明确非空非法类型优先于缺失。已通知主会话处理该说明及相关manifest；本代理未修改工程夹具。此条状态以主会话后续工程修复为准。

## 冻结SHA-256

| 文件 | SHA-256 |
| --- | --- |
| 04-安装工具与第一次改代码.md | `e4f3c70aa87721afd913a17d790c21142622975217a50b5e24780369f27940fc` |
| 05-后端空间与设备接口.md | `d1d1476f3da6ca2ff66afb1aa8e063eefead161f2d5a9c11bb87525b42dfcf6d` |
| 06-设备台账与自主UI.md | `4151f57b29a062d244c95bca1402a2c5d0e59d1d8e30c4ce64e22558a5ec26b5` |
| 07-监测历史与数据质量.md | `635b41f903b0853797a0a4c5c052ac552206e13e26e8c45d92ba273f36274e01` |

主会话需对更新后的Markdown重新生成阅读入口，再从新包按教程代码继续独立执行；不要用本轮静态审校代替该运行记录。
