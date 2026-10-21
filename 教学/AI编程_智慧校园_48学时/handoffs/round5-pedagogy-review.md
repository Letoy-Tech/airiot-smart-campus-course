# 第五轮教学操作链路审校与修订交接

审校日期：2026-10-19。范围为当前12章manuscript、教师参考工程docs01—12、teacher-guide及lesson-source/生成源；结合实际TODO、API、身份和分页实现核对。此次由主会话批准修改后冻结；未修改9份student-chapters副本、后端/前端业务源码、运行工具或PDF。副本传播、清单更新、阅读版及教案重建由主会话统筹。

## 已修问题和位置

| 问题 | 实际修订 | 主要文件 |
| --- | --- | --- |
| 学生独立副本没有.git，却直接要求记录提交/分支 | 新增正常工程的Git起点路径：核对.gitignore及无秘密文件，识别现有仓库，init、身份、status、明确add清单、检查暂存、commit；已有本人仓库不重建。教师起点和学生差异分开标记，跨章覆盖不作为课堂要求 | resources/campus-ai-course/docs/01-跨平台启动.md；docs04—12；manuscript04、05 |
| R01正文、教师答案与教案存在三套必交情境 | 固定为正常返回2条、成功空数组、读取失败；未知通信与未登录列为后续阅读。T01承接01问题卡，T02合同、T03读取页面顺次依赖 | manuscript02；teacher-guide/02-教师参考.md；lesson-source.json第02条；prepare-lessons.py第02行数据 |
| 网页AI提示暗示学生重写教师预置框架 | 05仅C05引用存在性；07仅C07质量优先级；08仅C08严格布尔。扩查将06仅filterDevices、09仅requireClosable、10仅checkOwnerVersion写清。控制器、认证、事务、异步隔离等标为阅读/核验；05伪代码移除误导性TODO标签 | manuscript05—10 |
| 第10章E1未进入IN_PROGRESS即进行NOTE本人范围对照 | 加入A读取当前版本并start，回读IN_PROGRESS后保存责任变更基线。先验证责任变更不改E1，再由B以合法同版本NOTE得403、A同body/版本成功，避免状态错误掩盖授权判断 | docs10；teacher-guide10；lesson-source与prepare-lessons第10条 |
| 第11章任务卡是文档断言，正文却让学生改线程模板参数 | 明确教师执行既有隔离测试，学生在ch11-assertions.md写四组独立预测、实际值、证据与解释，不重写线程/数据库/安全设施；保留无实际执行时的证据边界 | manuscript11 |
| 第12章仍要求未完成A先干净复现，再加新需求 | 顺序统一为记录未完成起点A→只补C12→针对性回归形成B→完整检查/构建→同伴复现B→个人答辩。A不能冒充可交付的回退版本。1+2+1不变，四个45分钟活动与教案一致，30分钟复现只抽查核心路径并引用此前证据 | manuscript12；docs12；teacher-guide12 |
| 第12章只有4条/limit2的API规格，不能支撑UI每页10条 | 增加可执行教师准备说明：独立空库total0、env01无责任，14次逐次触发NEW，再选2条按当前版本分派给实际manager-a；核对NEW12/ASSIGNED2/IN_PROGRESS0。验证跨页、少量结果、空结果和刷新归零；不清空学生已有库 | docs12“教师课前准备”；teacher-guide12；lesson-source/prepare-lessons第12条 |
| 分页规格排序仍写未冻结 | 改为已实现createdAt DESC,id DESC，先筛选计数再分页；保留SCENARIO_SPEC/NOT_EXECUTED，不声称已自动建库或执行 | resources/campus-ai-course/fixtures/pagination-scenarios.json；manifest哈希交后端代理更新 |

第12章课堂顺序补充：第一学时的针对性回归使用单元/组件测试并预测浏览器结果；个人浏览器验证在第二模块build和完整启动后重做，教师投影只作观察。教师应提前准备依赖、独立分页演示库与同伴复现库，未准备则记环境阻塞并补做，不挤占为假通过。

## 当前文件修改清单

- manuscript：02、04、05、06、07、08、09、10、11、12（01、03未修改）。
- resources/campus-ai-course/docs：01、04、05、06、07、08、09、10、11、12（02数据库交接、03映射未修改）。
- resources/teacher-guide：02、10、12。
- lesson-plans/lesson-source.json和tools/prepare-lessons.py：第02、10、12对应条目同步；未运行教案生成器。
- resources/campus-ai-course/fixtures/pagination-scenarios.json：仅排序说明。

## 已实际完成的检查

1. 用Python AST读取prepare-lessons的12条教学数据，与lesson-source逐字段比较：一致。
2. 核对12课各4学时、各180分钟：合计48学时/2160分钟；12章frontmatter仍为1+2+1。
3. 检查43份相关Markdown的代码围栏和相对文件链接：无不配对围栏或断裂文件链接。
4. 只读核对Git明确add清单在9份章节起点均存在；未执行git init/add/commit，也未改动9份副本。
5. 实际代码核对：manager-a为有效教学账号标识；NOTE要求IN_PROGRESS；CasesView每页10条；事件排序createdAt DESC,id DESC；章节marker与文档函数匹配。
6. 逐页用view_image打开round5-render/page-1.png至page-19.png原始图：19页均PASS，无中文缺字、越界、裁切或空白孤页。第16时序图和第19UI图辅助字较小但原尺寸可辨。各页SHA与观察见[视觉记录](../lesson-plans/qa/round5-visual-pages-01-19.json)。

## 协调项与边界

- 冻结后发现docs05—12公共段“每份新副本必须init”易与Git初始化混淆，已交主会话统一改成明确的node tools/course.mjs init本机账号初始化说明。
- 图12-03仍有“恢复基线A代码”旧字样，已交主会话修改mmd/svg/生成源并重渲；A在新路径下含已知C12缺口，不应是已验证救援版本。图12-01/12-02和10-02的流程与新正文一致。教案选用每章01图，因此12-03的调整主要影响正文阅读版。
- 设备目录空态与请求超时的实现缺口已交前端代理；本报告不替该代理宣称源码修复或测试完成。
- 第12章14事件准备仅为核对实际API后写出的操作说明，本轮未向任何数据库写入。真实学校数据库、Windows实机、物理印刷和课堂试跑仍按各自记录验收。
- 本轮静态审校与图像检查不代表新增软件测试结果；不扩称“12章学生实验均通过”，不复用教师参考通过记录作个人成绩。AIRIOT仍0必修且无需真实连接。
