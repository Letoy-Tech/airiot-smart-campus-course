# Round 9：00—03 零基础认知走查与修订交接

日期：2026-10-19。范围：只修改 `walkthroughs/00—03` 四份Markdown，保留全部11份完整产物示例；本交接为新增文件。后续新增的纯离线检查工具另见末尾，不改生成HTML、业务工程或版本元数据。

本轮采用“学生完成上一步后，下一步手里有什么、鼠标点哪里、剪贴板剩什么、电脑实际保存了哪一份”的认知走查。下表是从原文和当前保存工具源码可复核的问题，不是虚构的真人课堂观察。

## 具体发现与修复

| 问题 | 复现依据与影响 | 已修复位置 |
| --- | --- | --- |
| 收到ZIP后没有从零打开教程的路径 | 旧00直接假定已在教程页；新手可能在Windows压缩预览中打开HTML，或把单个HTML拖走导致相邻资源缺失 | 00新增“如果你刚收到一个ZIP”：Windows全部解压/macOS解压，定位包含walkthroughs/resources/reading的一层，打开walkthroughs/index.html，保留整包；缺包请教师核对 |
| 工具上次正文未清空，下一份直接粘贴可能拼接旧稿 | `tools/walkthrough.js`保存按钮使用整个answer.value，打开对话框不清空；旧00/01/02/03常写“粘贴到工具”而未统一全选替换 | 四篇统一“点文字框→先全选→再粘贴→核对下拉文件名与正文标题”；00区分下载教材源稿与下载本人回答 |
| 打开文件/改文字被误认为自动保存原文件 | importer直接用file.text覆盖answer.value；下载按钮创建新Blob，不回写原磁盘文件 | 00说明打开下一份会替换未保存草稿，修改后仍需下载并移入docs；补工具关闭与AI输入框清空动作 |
| 重复下载与隐藏后缀只被概括提醒 | `(1)`文件、旧稿和当前稿混在一起时，学生会继续发送旧稿或把后缀改成.md.md | 00补先用工具核对两份、保留旧稿、Windows/macOS重命名动作、Windows扩展名显示与只保留一个.md；其他篇引用同一办法 |
| 依次复制两份再粘贴，会只送出最后一份 | 旧03开始前先“分别读取两份，再复制”，后续才讲发送；剪贴板不能保留两份普通复制。01新会话又仅在“改过文件”时要求发全文 | 00补一次复制立即发送的完整循环；01每个新会话必须发本人已保存文件；03开头改为03复制即发送、再07复制即发送 |
| 新会话丢失上游、AI在材料未齐前生成 | 02/03各轮提示依赖前面文件，但中途新开聊天时只读“粘贴09”会缺07/08；只写文件名不传内容无法工作 | 00补先确认收到、资料已齐再任务、提前生成时停止、长文本分段；02/03新增每一输出所需完整输入表，并要求文件不存在先补上游 |
| 文件08与课程第08篇混淆 | 03说“08的七步”“粘贴09”时，读者可误点左侧08登录课程 | 03开头解释文件编号与篇章编号不同，三个小标题改成完整文件名；保留本文纯文字设计、不执行示例申请单的边界 |
| 术语先出现在长提示中，学生无法判断AI回答 | 02引入ADMIN/CAMPUS_MANAGER、items=[]、旧快照、状态与质量英文，原文只有部分词被解释 | 02加简短中英对照和5秒/60秒换算；01补AI问过多技术问题或索要真实调查时的可复制纠偏 |
| 03任务提示顺序与样例任务表矛盾 | 原提示“点值→演练→完整目录”与T2绑定/T3台账/T4点值及后续05—07顺序不一致，AI可能按错误顺序重排 | 03提示改为两设备→完整模式→空间绑定/完整台账→点值→演练→测试交付，保持T0—T7样例不删 |
| 最后只检查08—11，未核对全部11份内容 | 文件数量可被00练习、(1)与旧稿凑足；前几份可能未更新或只有半文 | 03新增11文件逐个打开到结尾的签收表，核对关键内容，再人工对照R02/本人范围/未知规则；02补07与05的实际内容交叉核对 |

## 本轮实际检查

- 逐段阅读00—03，并从ZIP入口、建文件夹、网页切换、复制提示、处理偏题、下载、移动、重命名、重新打开、逐份发上下文、合并纠偏到11份签收追踪每一步的输入/输出。
- 只读检查当前 `tools/build-walkthrough.mjs` 与 `tools/walkthrough.js`：保存对话框、导入覆盖、文件名选择、下载Blob、两种下载按钮和复制行为。它们是实现依据，不是本轮浏览器点击证据。
- Python纯文件检查：四份Markdown围栏闭合、相对链接存在；01/02/03分别仍有3/4/4份完整Markdown样例，共11份，首尾均存在；03最终清单11个固定文件名与保存工具支持的名称全部一致。
- 官方网页只读核对：[千问官网](https://www.qianwen.com/)，2026-10-19返回标题“千问-阿里 AI 助手”。未登录、未发送课程内容，没有验证当前模型选择、额度或真实回答质量。

## 浏览器边界与未验证项

尝试Cua的iab入口返回 `Browser is not available: iab`。随后对Chrome的同一本地文件访问被URL安全策略拒绝，未改用localhost、其他浏览器通道、原始协议或其他方式绕过。

调用目标：

```text
file:///Users/learner/My%20Projects/Airiot%E5%A4%A7%E6%B9%BE%E5%8C%BA%E9%AB%98%E6%A0%A1%E4%BA%A7%E4%B8%9A%E8%81%94%E7%9B%9F/%E6%95%99%E5%AD%A6/AI%E7%BC%96%E7%A8%8B_%E6%99%BA%E6%85%A7%E6%A0%A1%E5%9B%AD_48%E5%AD%A6%E6%97%B6/walkthroughs/index.html
```

拒绝原文：

```text
Browser Use rejected this action due to browser security policy. Reason: The browser URL policy blocks this action. Browser use could not acquire authority to trigger network egress. The URL policy gate did not grant access. The requested URL protocol is not allowed. Allowed protocols: "http:", "https:". The agent must not attempt to achieve the same outcome via workaround, indirect execution, raw CDP or browser commands, alternate browser surfaces, or policy circumvention. Proceed only with a materially safer alternative that does not require this blocked browser action; if none exists, stop and request user input.
```

因此本轮没有本地教程浏览器点击、复制下载/文件选择弹窗实测，也没有Windows/macOS文件管理器逐项操作、真实零基础学生试教或课堂计时。源码/认知检查不能冒称上述项目通过。未启停任何服务，未读取凭据，未调用外部AI聊天。

## 冻结文件

| 文件 | 修订前SHA256 | 修订后SHA256 |
| --- | --- | --- |
| 00-第一次用AI做项目.md | 8cbd14bc0db9f535e89b7bd46953517bfa36c11d0ecdc6b9e829c3cd984eb40f | 23d9245a26184a05b47a6149fb4b9ade62540edafc1c7c66cbefe70f67976170 |
| 01-从想法到项目任务书.md | 01b3376c1c43176a7997c753a64fd7dfb2ce9ce84da21594797d574759c3c1cc | 8cfec9dfbb7d78a814583ab4712343ec78a14cf6c88f8d567ed998cd086a82e8 |
| 02-从项目任务书到需求规格.md | e4d2ef6788472fa9f8dcd8dfc42838ea6d69e99cadb6ebd571fe652f36763b3e | f4b4ce5782252efc96b2cd7b1cf9cd11051a8ba9fda84288e32fbef0d7fa2724 |
| 03-从需求规格到系统设计.md | ee4793526ff35ad45dde3e17ef5c522bd88fa9096ab0a923b5724a219e3ed73b | b3882c5568f7b4ffc94e198e6fb5d166ba85f2ad2ab9cf4e164fa6e44c075e5e |

本轮不生成HTML、不更新包；主代理完成其他章节后统一重建。最终页面静态检查结果由统一构建后的报告给出。

## 追加任务：纯文件离线检查器

按主代理追加授权新增 `tools/verify-beginner-offline.mjs`，SHA256为 `9fab63141022f79db92863b2ac6a7c5c0ca3f56223623f2f56ea95965eb2b84a`。未使用浏览器、HTTP服务、截图或网络调用。

从课程根目录执行：

```sh
node tools/verify-beginner-offline.mjs --self-test
node tools/verify-beginner-offline.mjs
```

第二条应在主代理统一重建 `walkthroughs/index.html` 和根入口后执行；默认写 `walkthroughs/qa/round9/offline-static.json`。可使用 `--output walkthroughs/qa/round9/另一个报告.json`，报告位置必须在课程内且不能是.private。依赖现有tools锁定的marked和Python标准库HTMLParser；默认Python命令是python3，可通过 `COURSE_PYTHON` 明确指定已安装解释器。不导入浏览器或安装依赖。

检查范围：

- 00—12必须各有且仅有一份MD，使用marked词法分析提取主步骤；代码框内的样例标题不误算步骤。
- 每步记录具体操作、可复制AI提示、预期结果、失败处理四类文字证据、近似行号和缺项。关键词存在只是辅助检查，不代表说明充分或学习有效；整份报告保留 `manualReviewRequired:true`。
- Python HTMLParser只解析根index.html及walkthroughs/index.html的本地href/src；核对目标文件、HTML/SVG目标锚点唯一存在、图像引用及文件非空。外部URL仅记录不访问；课程外路径或.private目标拒绝读取。
- 核对11个设计文件在03最终签收表和生成页保存下拉选项均存在；核对walkthroughs/build.json中的13份源文件hash及HTML hash，旧HTML会报 `HTML_SOURCE_STALE`。

退出码：0=`PASS_STATIC`；1=`FAIL_STATIC`（缺文件、锚点、未重建等结构错误）；2=`REVIEW_REQUIRED`（结构无误，但某步没有识别到所需说明，需人工看原文）。报告不生成“课堂通过”结论。近似行号来自去掉代码后的文字片段，应结合对应步骤标题定位。

实际执行：2026-10-19，Node22.21.1、Python3.14.6，`--self-test` 的11项断言通过，覆盖围栏内假步骤、缺四项、HTML属性实体、空图、锚点分解、外链不访问、越界和.private拒绝。第二条完整检查留给主代理重建后运行；本交接不提前宣称其通过。
