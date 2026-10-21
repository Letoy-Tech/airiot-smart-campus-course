# 05 后端空间与设备接口：让“保存位置”真的留下来

这一章做成一件看得见的事：把“教学空间01（模拟）”绑定到自己创建的校区、楼栋，退出后重新打开仍能看见；不存在的楼栋和只读用户不能改变它。仍使用桌面 `campus-ai-lab/app`，**不换一套工程，不覆盖第04章成果**。4学时仍按1＋2＋1安排：步骤1理解，步骤2—5操作，步骤6复核。

后端是接收请求、检查规则和保存数据的程序。页面、登录、数据库访问、设备读取都由教师起点提供，本章只补 `C05` 的两项存在性检查。AIRIOT不参与本章；设备源仍是 `TEACHING_MOCK`。

所有“AI示例”均为编写的教学示例，代码已对照课程参考源码，**不是你的实际运行结果**。你在网页AI里讨论，自己在VS Code中修改；代码不通过“保存AI回答”工具下载覆盖文件。

## 第1步：留在原工程，找到今天要补的两行

在VS Code点“文件→打开文件夹”，选桌面 `campus-ai-lab/app`。已有该窗口就继续用。先点运行后端、前端的两个终端，各按一次 `Ctrl+C` 停止自己的进程，再点“终端→新建终端”。终端应在 `app`，不是 `backend` 或 `frontend`。逐行执行：

**先核对新终端的Java位置：**第04章的 `JAVA_HOME` 命令只对当时那个终端有效。每次新建终端或重开VS Code，先按[第04章第三步“让后端找到同一个JDK17”](04-安装工具与第一次改代码.md)在这个终端重新设置；本章后面新开的两个服务终端也分别做一次。复用已经设置好的原终端无需重设。完成后再执行下面命令。

```text
node tools/chapter.mjs prepare 05
node tools/course.mjs doctor
```

`prepare 05`首次只把本章尚未编辑的 `C05` 教师块改成练习入口，保留之前成果；已经准备过本章时会保留当前代码。若首次准备发现个人改动而拒绝覆盖，就停下来检查提示，**不要删文件或 `.lesson-state.json` 重来**。`doctor`检查环境和端口，不证明组数据库已通。第04章已经初始化账号，本章继续使用，不重新生成密码。

按 `Ctrl+P`（macOS为 `Command+P`），输入下面路径，按Enter打开：

```text
backend/src/main/java/edu/campus/course/LocationService.java
```

按 `Ctrl+F` / `Command+F` 搜索 `STUDENT_TODO_C05_BEGIN`。应看到函数 `validateBinding`，块内暂时是 `throw new ApiFailure(501, "TODO_C05");`。它故意拒绝绑定，提醒你补作业，不能当作平台故障。

新建网页AI会话，发送下面提示；随后回VS Code只选中这个**源代码文件的全文**，复制发送。不要选择整个工程，不复制 `.private`。

```text
我在做智慧校园课程第05章，app是同一个长期工程。接下来一条消息是
backend/src/main/java/edu/campus/course/LocationService.java的完整源码。
请先只解释validateBinding在bind调用链中做什么，不修改代码。
固定规则：教师已提供登录、ADMIN授权、输入校验、事务和Mapper。
来源空间来自provider.spaces().items()，本地楼栋由mapper.building(id)查询。
存在性检查失败必须抛ApiFailure.missing()，它对应404。
不要创建不存在的对象，不重写安全基础，不声称访问了我的电脑。
```

AI应解释“先检查，再保存”，不是“报错后自动建一个楼栋”。在VS Code左侧 `app` 文件夹上右键→“新建文件”，输入 `evidence/ch05.md`。填入以下起始内容，`Ctrl+S` / `Command+S` 保存：

```markdown
# 第05章本人记录
我的预测：空间与楼栋都存在时允许绑定；单独缺空间或楼栋都应404；viewer写入403。
本章只修改：LocationService.java的C05。
prepare与doctor实际结果：待我执行后记录。
合法保存、404、403、重启回读：待执行。
```

若看到的函数不同，发送：“我刚贴的是当前源文件。请指出C05开始与结束标记之间的原文；只解释差异，不让我替换整个文件。”未找到标记前不继续。

## 第2步：向AI要最小修复，并只替换标记里面

在刚才同一会话发送：

```text
现在只补validateBinding的STUDENT_TODO_C05_BEGIN与END之间。
spaceId必须存在于provider.spaces().items()，按s.id().equals(spaceId)判断；
buildingId必须能由mapper.building(buildingId)查到，查不到返回null。
任一不存在就throw ApiFailure.missing()；都存在则正常返回。
请只输出标记之间可直接替换的Java代码，再用中文解释||为什么表示任一失败。
不修改方法签名、标记、bind方法、Mapper、事务或授权，不新加依赖。
```

与实际参考代码一致的一种回答如下：

```java
if (provider.spaces().items().stream().noneMatch(s -> s.id().equals(spaceId))
        || mapper.building(buildingId) == null) throw ApiFailure.missing();
```

`noneMatch`在这里表示“没有一个空间ID匹配”；`||`表示两种错误任意一种成立就拒绝。先用手指分别指出“空间不存在”和“楼栋不存在”。如果AI用了 `&&`，两者必须同时错才拒绝，会漏掉只错一个的请求。

回VS Code选中两条标记之间的原始 `throw ...TODO_C05` 那一行，用AI检查通过的代码替换。**保留上下两条注释、方法的大括号以及文件其余内容。**保存后在 `app` 终端执行：

```text
git diff -- backend/src/main/java/edu/campus/course/LocationService.java
```

这是查看改动，不是执行Java。第04章已建立个人Git基线时，应只看到本章局部变化；若其他章节也有你的改动，保留它们，不用撤销命令清理。若底部显示 `(END)` 或冒号，按小写 `q` 退出查看，再输入下一条命令。

若AI给出整文件或编译报错，把当前 `validateBinding` 整个函数和报错全文分两条贴回，先发：

```text
请只检查我接下来贴的validateBinding及实际错误。目标是合法引用通过，
任一不存在返回404。不要改成总是成功，不删除检查，不改测试。
指出错误在括号、类型还是判断条件，重新给出C05标记内的完整替换代码。
我会自己保存、运行，你不能写“测试已通过”。
```

在 `evidence/ch05.md` 记下是否采纳AI代码，以及你对 `||` 的解释。

## 第3步：构建，再切到教师提供的组数据库

从本章起，保存的数据放在教师提供的本组数据库里。“迁移”在这里是按工程已有文件建好需要的表，由教师操作。**不要自行安装MySQL、猜地址，或把数据库口令发给AI。**完整说明位于 `app/docs/02-教师数据库交接单.md`；这份说明的示例里有大写占位符，不能当成可直接连接的配置。

先完成下面的实际交接：

1. 告诉教师自己的组号和系统，接收教师**单独交付的完整 `database.json` 文件**。请教师同时确认：这是本组日常库、是否需校园网/VPN、迁移是否完成、日常账号是否已换好。没有收到真实文件，或里面仍有 `DB_HOST`、`GROUP_USER` 之类占位符，就停在本步；不向AI要一组“能用”的参数。
2. 在VS Code左侧展开 `.private`。对其中的 `accounts.json` 点右键，选“Reveal in File Explorer/在文件资源管理器中显示”或“Reveal in Finder/在Finder中显示”。打开的文件窗口位于 `.private`；把教师发来的 `database.json` **复制到这个文件夹**，保留原 `accounts.json`。如果已存在数据库配置，先让教师确认本组原文件，不直接覆盖。
3. 回VS Code，展开左侧 `.private` 并双击 `database.json`。只在本机确认文件能打开，且 `url`、`username`、`password` 都由教师填好了。Windows 在文件资源管理器“查看→显示”中启用“文件扩展名”，确认不是 `database.json.txt`。不把内容截图、写进证据或发到AI；检查后关掉这个标签。
4. 在 `evidence/ch05.md` 只写“组号、教师交接日期、网络条件是否满足、迁移确认是否完成”，不写连接串和密码。教师尚未完成迁移时，先完成下面的构建，再由教师按交接单执行；迁移账号、日常运行账号的切换仍由教师负责。

在 `app` 终端执行：

```text
node tools/course.mjs build
```

等待命令回到提示符。预期Java打包和前端构建成功，没有失败退出；不要求输出耗时与示例相同。`C07`目前仍是教师预置实现，直到第07章才启用它的练习。

构建成功后，取得教师明确的“本组库迁移已完成、当前文件是日常运行账号”确认，再启动。配置文件存在不等于数据库已经可用。不要自己删库或反复初始化。

把当前已设置 `JAVA_HOME` 的终端作为A，在 `app` 执行后端命令，等出现 `teacher-db`、8091及 `Started CourseApplication`，保持它运行：

```text
node tools/course.mjs backend-db
```

再点“终端→新建终端”作为B，确认目录仍是 `app`，按第04篇第三步设置**B自己的** `JAVA_HOME`，再执行前端命令。不能把它输入仍在输出后端日志的A：

```text
node tools/course.mjs frontend
```

浏览器打开 `http://127.0.0.1:5178/#locations`，用本机第04章的 `admin` 账号登录。应看到“空间归属”和“1. 新建校区”“2. 新建楼栋”“3. 绑定空间”，表格应有4个教学空间。新的空组库显示“未绑定”正常；仍须完成下一步保存和回读，才能确认本组读写可用。如果只有两台设备或返回不支持的业务，检查后端启动命令是否误用了 `backend`。若提示登录失效，重新登录即可，不重建账号。

**启动没有成功时先看具体一层：**“缺少database.json/配置需要三个非空字符串”说明文件尚未放对或未填好；连接超时、账号拒绝或证书错误交教师检查网络与配置；缺表/迁移错误交教师确认迁移。把无秘密的错误名给教师，不自行关闭证书检查或改用别组库。`Started`只证明程序启动，下一步真实读取与写后回读仍要做。

需要AI排错时，先发送下段，再贴**去掉地址、用户名、口令后的错误正文**；不要贴配置文件：

```text
我运行的是app目录中的node tools/course.mjs backend-db，目标是教师组库。
接下来是脱敏错误，请区分环境/数据库连接/未迁移/业务TODO四类。
每次只给一项我能核对的操作；不要让我改用root、关TLS、删除迁移历史或
把数据库切成原平台。没有足够证据时明确缺哪条非秘密错误信息。
```

把构建是否完成、实际使用的启动模式和页面标题记到 `evidence/ch05.md`。这里记录“组库由教师提供”，不记录连接串。

## 第4步：亲手建立一条关系，再看服务器实际返回的ID

在“空间归属”页面按顺序操作。下面 `G01` 是示例组号；若你的组号不同，校区、楼栋两处名称都换成自己的组号。已做过就先检查原记录，不重复创建。

1. “校区名称”输入 `G01教学园区`，点“保存校区”，等到“服务端已确认保存。”。
2. “所属校区”选刚建立的 `G01教学园区`；“楼栋名称”输入 `G01实验楼`，点“保存楼栋”。
3. “空间”选 `教学空间01（模拟）`；“楼栋”选 `G01教学园区 / G01实验楼`；楼层填 `1`，点“保存绑定”。
4. 上方“空间与本地归属”表中，应出现 `G01教学园区 / G01实验楼 / 1`。点“刷新映射”，再看一次。

接着在页面空白处右键→“检查”，点“Network/网络”，在过滤框输入 `locations`，再点“刷新映射”。点刚出现的 `locations` GET，选“Response/响应”；只看JSON正文，**不复制Headers中的Cookie**。在 `data.campuses`、`data.buildings` 找到刚才名称及ID，在 `data.bindings` 找到 `spaceId=teaching_space_01` 对应楼栋ID。清空过滤框，改输入 `/spaces`，点同一次刷新随后出现的GET响应，核对该空间的 `campusId/buildingId/floor`。若列表里没有请求，保持Network打开后再点一次“刷新映射”，不要重复点击创建按钮。

可以复制这两份响应正文到网页AI，先发：

```text
接下来是我本组GET locations和GET spaces的两份实际响应正文，不含请求头。
请只核对teaching_space_01：绑定的buildingId是否指向真实楼栋，楼栋的
campusId是否指向真实校区，spaces合并字段是否与locations一致。
请列出你实际找到的三个ID和floor，不猜ID，不把名称当ID，不宣布已测重启。
```

正常回答会把你实际返回的三个ID串起来；不会生成一套新的UUID。将ID与楼层记录到 `evidence/ch05.md`。如果“保存”后回读失败，先重读，不能再次点“保存校区”猜测是否成功。追问可直接发送：“写响应或回读不完整，请先告诉我怎样只读取现状确认，不重新POST创建，也不把结果未确认写成失败或成功。”

![绑定后独立读取两侧数据的示意](../illustrations/ch05-03-binding-readback.png)

这是流程示意，不是你的操作截图。

## 第5步：让服务器拒绝一条错误引用和一个只读身份

下拉框会阻止你选择不存在的楼栋，所以这一步使用浏览器的Console（控制台），直接向**本组当前页面**发请求。右键“检查”→“Console/控制台”。先阅读下面函数，再整段复制到输入行并按Enter。若浏览器禁止粘贴，按教师演示手动输入或由教师带做，不关闭浏览器防护。

```javascript
async function courseWrite(path, method, body) {
  if (location.origin !== 'http://127.0.0.1:5178' || !path.startsWith('/api/campus/')) {
    throw new Error('只用于本地教学页面');
  }
  const tokenResponse = await fetch('/api/auth/csrf', { credentials: 'same-origin' });
  const csrf = await tokenResponse.json();
  if (!tokenResponse.ok || csrf.code !== 0) throw new Error('请先核对教学会话');
  const response = await fetch(path, {
    method, credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', [csrf.data.headerName]: csrf.data.token },
    body: JSON.stringify(body)
  });
  const result = await response.json();
  return { status: response.status, code: result.code, message: result.message, data: result.data };
}
```

函数沿用页面当前登录身份；CSRF是服务器要求的防护值，函数内部获取，不打印，也不要截图它。出现 `undefined` 只是函数定义完成。它没有写入数据。刷新网页或换标签后函数可能消失，需要重新粘贴定义。

仍以 `admin` 登录，执行这一条；只把楼栋ID改为不存在的值：

```javascript
await courseWrite('/api/campus/locations/spaces/teaching_space_01', 'PUT', {
  buildingId: 'missing-classroom-building', floor: '1'
})
```

展开结果对象，预期 `status: 404`。回“空间归属”点“刷新映射”，原关系仍在。若返回501，检查是否保存并重建了C05；若返回200，不算成功，说明错误引用被接受了。

仍保持 `admin`，再测试另一项检查：这次楼栋合法，只让空间不存在。复制下面完整一段到Console执行；它先读取刚保存的合法楼栋ID，再尝试绑定不存在的空间，不需要手填UUID：

```javascript
await (async () => {
  const response = await fetch('/api/campus/locations', { credentials: 'same-origin' });
  const envelope = await response.json();
  if (!response.ok || envelope.code !== 0) throw new Error('先完成合法读取');
  const binding = envelope.data.bindings.find(item => item.spaceId === 'teaching_space_01');
  if (!binding) throw new Error('先回第4步完成绑定');
  return courseWrite('/api/campus/locations/spaces/missing-classroom-space', 'PUT', {
    buildingId: binding.buildingId, floor: binding.floor
  });
})()
```

也应是404。点“刷新映射”，确认原关系还在，`locations`响应的 `bindings` 中没有 `missing-classroom-space`。现在两个404分别只错一个引用，才能说明两项检查都有效。

再从页面退出，登录 `viewer`，应看到“当前身份只读。校区、楼栋和空间映射由管理员维护。”。在此身份的控制台重新定义 `courseWrite`，执行下面整段。它先读取现有绑定，再用**同一个合法请求体**尝试保存，只改变身份：

```javascript
await (async () => {
  const response = await fetch('/api/campus/locations', { credentials: 'same-origin' });
  const envelope = await response.json();
  if (!response.ok || envelope.code !== 0) throw new Error('先完成合法读取');
  const binding = envelope.data.bindings.find(item => item.spaceId === 'teaching_space_01');
  if (!binding) throw new Error('先回第4步完成绑定');
  return courseWrite('/api/campus/locations/spaces/teaching_space_01', 'PUT', {
    buildingId: binding.buildingId, floor: binding.floor
  });
})()
```

预期403；重新读取后原绑定不变。退出再登录 `admin`，重新定义函数并运行同一段，预期200，作为合法对照。不要用“楼栋不存在+viewer”一次请求证明两个条件。

遇到与预期不同的结果，向AI发送下段，再分别贴函数、脱敏请求体和返回对象：

```text
我只测试本组教学空间绑定。管理员+不存在楼栋应404；管理员+合法楼栋但
不存在空间也应404。两个请求只错一个引用。viewer+已有合法
绑定应403；admin+同一合法绑定应200。请按身份、引用、输入逐项区分。
不要建议放宽权限或把异常改成成功；先检查C05与实际启动模式。
根据我实际结果指出哪个条件没有隔离，不把预期写成实际。
```

在证据文件分别记两次404、viewer的403、admin合法对照的200，以及各次回读结果，不保存Cookie或防护值。

## 第6步：重启回读，证明不是只留在页面里

点后端终端A，按 `Ctrl+C`（macOS也是Control+C）；确认回到输入提示符后，仍在 `app` 执行 `node tools/course.mjs backend-db`，等 `Started CourseApplication`。前端B继续运行。刷新浏览器，此时旧登录已失效，重新用原 `admin` 登录，打开“空间归属”，点“刷新映射”；三个ID与楼层应仍一致。不要重新创建校区来“证明保存”。

A、B此时都在运行服务。点“终端→新建终端”作为检查用的C，确认目录是 `app`，按第04篇第三步设置C自己的 `JAVA_HOME`，再执行：

```text
node tools/course.mjs check
```

普通检查包含夹具、后端普通测试、前端类型与单元测试；它**不会自动执行真实MySQL集成测试**。可以在VS Code打开 `backend/src/test/java/edu/campus/course/TeacherDbTest.java`，搜索 `spaceBindingRejectsMissingReferences`，读它怎样分别检查不存在空间、楼栋与合法绑定。需要实际运行它时，留给教师按第11章的独立测试库流程，不能在本章日常组库执行清理测试。

若重启后关系不见了或检查失败，先保存实际错误，不重建关系或重置数据库。在同一AI会话发下段，再分别贴脱敏错误和两个读取响应中的相关ID：

```text
我重启同一app的backend-db后正在核对空间绑定。接下来是实际错误和
locations/spaces中的相关ID。请先区分启动模式、读取失败、关系缺失及
测试失败；给一项只读核对动作。不再次POST创建，不清库，不猜连接信息。
```

最后把 `evidence/ch05.md` 全文交给AI，先发：

```text
请审查我接下来贴的ch05本人记录是否足以说明C05修改、合法绑定、两个404、
viewer403、admin对照和重启回读。只指出缺失证据，不替我填写通过。
若要整理文字，请完整返回记录，保留实际失败与未执行项，不编造测试日志。
```

保存最终记录。停点：一条真实保存的本地关系、两个错误引用分别404、viewer的403及admin对照、一次重启回读和本人代码解释；下章继续使用同一 `app`。未完成哪项就保留“未执行/失败”，不要借用教师截图当自己的结果。
