from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parents[1] / 'walkthroughs' / 'figures'
ROOT.mkdir(parents=True, exist_ok=True)
INK, GREEN, MUTED = '#17352f', '#126b53', '#536b63'

def text(x, y, lines, size=21, color=INK, weight=400, gap=33):
    if isinstance(lines, str): lines = [lines]
    return ''.join(f'<text x="{x}" y="{y+i*gap}" font-size="{size}" fill="{color}" font-weight="{weight}">{escape(s)}</text>' for i,s in enumerate(lines))

def box(x,y,w,h,fill='#f1f6f1',stroke='#d5e3dc',r=14):
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{r}" fill="{fill}" stroke="{stroke}"/>'

def arrow(x1,y1,x2,y2):
    return f'<path d="M{x1} {y1} L{x2} {y2}" stroke="{GREEN}" stroke-width="2.5" fill="none" marker-end="url(#a)"/>'

def save(name,title,subtitle,body,h=540):
    svg = f'''<svg xmlns="http://www.w3.org/2000/svg" width="1000" height="{h}" viewBox="0 0 1000 {h}" role="img" aria-labelledby="title desc"><title id="title">{escape(title)}</title><desc id="desc">{escape(subtitle)}</desc><defs><marker id="a" markerWidth="9" markerHeight="9" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8" fill="{GREEN}"/></marker></defs><rect width="1000" height="{h}" fill="#fffefa"/><g font-family="PingFang SC,Microsoft YaHei,sans-serif">{text(36,48,title,28,weight=700)}{text(36,82,subtitle,17,MUTED)}{body}{text(36,h-22,'智慧校园 AI 编程 · 教学示意 · 不是模型网页截图或运行结果',14,MUTED)}</g></svg>'''
    (ROOT / name).write_text(svg,encoding='utf-8')

parts = [(36,120,'01 复制要求',['教程里点“复制提示词”','不要复制整页']), (364,120,'02 发给 AI',['切到 AI 输入框，粘贴','点发送，等回答结束']), (692,120,'03 检查回答',['对照示例检查内容','有错就发纠偏提示']), (692,315,'04 保存文件',['复制回答到保存工具','选文件名，下载到 docs']), (364,315,'05 交给下一轮',['重新打开刚保存的文件','复制全文发给 AI'])]
b=''
for x,y,title,lines in parts:
    b+=box(x,y,272,145)+text(x+20,y+38,title,23,GREEN,700)+text(x+20,y+78,lines,18,gap=31)
b+=arrow(312,190,354,190)+arrow(640,190,682,190)+arrow(828,270,828,305)+arrow(684,387,647,387)
b+=text(42,365,['每次都能找到一个文件，','才算完成这一步。'],22,weight=600)
save('01-操作循环.svg','从提示词到自己的文件','不要只在聊天窗口里向下滚动：每轮都保存一份产物。',b)

b=box(36,120,928,335,'#f8faf7')+text(66,160,'桌面',25,weight=700)
b+=text(100,212,'▸ campus-ai-lab',25,GREEN,700)+text(140,260,'▸ docs',25,GREEN,700)
b+=text(188,306,['01-项目想法.md','02-范围确认.md','03-项目任务书.md','……直到 11-开发任务.md'],21,gap=37)
b+=box(605,165,315,215,'#fff9e9')+text(627,202,'保存后的检查',23,weight=700)+text(627,245,['1. 文件名与教程一致','2. 重新打开有正文','3. 中文显示正常','4. 文件在 docs 里面'],19,gap=32)
save('02-文件位置.svg','你的作业放在这里','蓝色文字是先建的两个文件夹；下面的文件随着教程逐个增加。',b,510)

b=box(36,120,444,320)+box(520,120,444,320,'#faf8f1')
b+=text(60,158,'A. 发给 AI：提出要求',23,GREEN,700)+text(60,203,['请只输出四行普通文字：','# 我的第一次项目记录','项目名称：智慧校园教学平台','本次目标：学会保存AI回答','完成状态：等待下载并检查'],18,gap=35)
b+=text(544,158,'B. 保存工具：放入回答',23,weight=700)+text(544,202,'文件名：00-保存练习.md',19)+box(544,220,396,132,'white')+text(560,250,['# 我的第一次项目记录','项目名称：智慧校园教学平台','本次目标：学会保存AI回答','完成状态：等待下载并检查'],16,gap=27)+box(544,372,220,44,GREEN,GREEN,8)+text(562,401,'下载这个 .md 文件',19,'white',600)
b+=arrow(484,280,510,280)
save('03-对话到文件.svg','发送的是要求，保存的是回答','先复制 AI 的回答，再回本教程下载；不要把“提问＋回答”整页当作文档。',b,500)

b=''
cols=[(36,'本次必做','#eef6ec',['查到设备和位置','看模拟点值','完成本地演练','保留必要的权限和失败处理']),(356,'以后选做','#fff9e9',['真实 AIRIOT 只读接入','更多图表','自主调整页面外观','有条件、有余力时再做']),(676,'本次不做','#f8efed',['远程重启真实设备','发送真实短信邮件','费用与节能率推算','未经依据的 AI 故障预测'])]
for x,t,c,lines in cols:
    b+=box(x,126,288,278,c)+text(x+20,167,t,24,weight=700)+text(x+20,216,lines,18,gap=43)
b+=text(40,454,'学生的决定：把 AI 额外加入的“短信提醒、远程重启”删掉，再保存范围文件。',20,GREEN,600)
save('04-范围取舍.svg','AI 给方案，你来决定做到哪里','完整的学习主线，是在已确认范围内做成一个小平台。',b,515)

b=''
rows=[('正常','读取成功，items 有设备','显示设备、位置与真实状态'),('空目录','读取成功，items 是空数组','显示“目录暂无设备”'),('请求失败','没有成功取得数据','显示“读取失败”，提供重试'),('状态未知','设备的 online 为 null','显示“未知”，不能显示离线')]
b+=text(58,136,'情况',19,GREEN,700)+text(247,136,'AI 文档里要写的条件',19,GREEN,700)+text(598,136,'未来页面应该怎样显示',19,GREEN,700)
for i,(a,c,d) in enumerate(rows):
    y=158+i*78
    b+=box(36,y,928,64,'#f1f6f1' if i%2==0 else '#faf8f1',r=9)+text(58,y+40,a,20,weight=650)+text(247,y+40,c,19)+text(598,y+40,d,19)
b+=text(40,502,'这张图写的是检查目标。此时还没有程序，不能把它写成“测试通过”。',19,MUTED)
save('05-需求判断.svg','把“设备页要好用”改成可以检查的要求','同样没有设备列表，可能是查询成功为空，也可能是请求失败。两者必须分开。',b,555)

b=box(36,122,928,340,'white')+box(36,122,180,340,'#eef5ed',r=0)
b+=text(55,158,'教学智慧校园',20,GREEN,700)+text(58,213,['设备目录','位置管理','演练事件'],19,gap=50)
b+=text(240,158,'设备目录',23,weight=700)+text(760,157,'教学模拟数据',17,GREEN)
b+=box(240,181,325,42,'#fafaf7',r=7)+text(255,209,'搜索设备名称…',16,MUTED)+box(580,181,180,42,'#fafaf7',r=7)+text(594,209,'空间01  ▾',16,MUTED)
b+=text(240,265,'设备名称 / ID',18,MUTED)+text(623,265,'通信状态',18,MUTED)+text(785,265,'操作',18,MUTED)
b+=text(240,307,'环境设备 / teaching_env_01',17)+text(623,307,'在线',19,GREEN,650)+text(785,307,'查看点值 →',17,GREEN)
b+=text(240,350,'能耗设备 / teaching_energy_01',17)+text(623,350,'未知',19,'#896618',650)+text(785,350,'查看点值 →',17,GREEN)
b+=text(240,413,'空目录、读取失败、未知状态分别显示不同提示。',17,MUTED)
b+=text(40,503,'位置管理只有管理员能写；查看者即使看到页面也不能修改。',19,GREEN,600)
save('06-页面草图.svg','先画页面承载什么信息，再决定颜色和样式','简化线框：位置、字样和按钮用于讨论功能；它不是已经实现的平台。',b,555)

b=''
for x,title,lines in [(36,'页面：提出请求',['我要看设备目录','GET /api/campus/devices']),(364,'后端：检查并取数',['先检查是谁、有无权限','再从教学数据源读取']),(692,'数据源：给出记录',['teaching_env_01','online: true'])]:
    b+=box(x,135,272,200)+text(x+18,177,title,22,GREEN,700)+text(x+18,225,lines,16,gap=38)
b+=arrow(313,235,353,235)+arrow(640,235,681,235)
b+=box(36,380,928,92,'#fff9e9')+text(58,415,'接口约定就是两边事先说好：',21,weight=700)+text(58,448,'要哪个地址、带什么条件、返回什么字段、失败时怎样解释。先写约定，再写程序。',18)
save('07-接口传话.svg','页面和后台怎样传话','以设备目录为例；本图省略字段，仅用于解释接口的作用。',b,530)

b=''
cards=[('想解决的问题',['值班人员找不到设备']),('需求 R01',['能筛选目录','未知不等于离线']),('页面＋数据＋接口',['目录页显示三种状态','保留 online 原值']),('开发与检查',['先做一次读取','再分别检查空与失败'])]
for i,(t,l) in enumerate(cards):
    x=36+i*244
    b+=box(x,138,220,188)+text(x+16,181,t,21,GREEN,700)+text(x+16,229,l,17,gap=34)
    if i<3:b+=arrow(x+224,233,x+237,233)
b+=box(36,367,928,95,'#faf8f1')+text(58,405,'每次往后走，都要回头对照同一条需求。',23,weight=650)+text(58,440,'例如需求写了“位置绑定”，页面、数据、接口、开发任务中也必须找得到它。',19,MUTED)
save('08-贯穿追踪.svg','不要让一个需求走着走着消失了','文档的价值在于前后能接上，不是数量越多越好。',b,515)
b=''
for i,(title,lines) in enumerate([
    ('1 找文件',['Ctrl/Command+P','输入完整源文件路径']),
    ('2 发上下文',['复制当前源文件给AI','再发送本步提示词']),
    ('3 只换小块',['定位BEGIN和END','保留标记与外层函数']),
    ('4 保存并检查',['Ctrl/Command+S','运行本章针对性测试'])]):
    x=36+i*244
    b+=box(x,135,220,205)+text(x+16,180,title,23,GREEN,700)+text(x+16,232,lines,17,gap=40)
    if i<3:b+=arrow(x+224,236,x+237,236)
b+=box(36,377,928,100,'#fff9e9')+text(58,417,'出错时：复制失败用例或错误原文，让 AI 只改本步代码。',22,weight=700)+text(58,453,'代码留在 app；运行记录留在 app/evidence；前面设计仍在 campus-ai-lab/docs。',18)
save('10-编辑到验证.svg','从网页建议到真正保存的代码','AI 的“已完成”不会改变电脑上的文件。你要亲自替换、保存和执行。',b,540)

b=box(36,135,438,255)+box(526,135,438,255,'#faf8f1')
b+=text(60,178,'终端 A：后端',25,GREEN,700)+text(60,224,['位置：campus-ai-lab/app','第04篇：node tools/course.mjs backend','第05篇起：node tools/course.mjs backend-db','同一时间只运行其中一个','Ctrl+C 停止本人后端'],18,gap=35)
b+=text(550,178,'终端 B：前端',25,GREEN,700)+text(550,224,['位置：同一份 app','node tools/course.mjs frontend','浏览器打开 127.0.0.1:5178','修改前端并保存后观察刷新','Ctrl+C 停止本人前端'],18,gap=35)
b+=text(40,440,'修改 Java：停止 A → build → 重启 A。修改前端：保存 → 看 Vite 与页面。',20,weight=600)
save('11-两个终端.svg','为什么要开两个终端','终端在持续输出服务日志时，不再往里面粘贴下一条构建命令。',b,505)

b=''
for i,(a,c,d) in enumerate([
    ('函数测试','给定输入 → 比较输出','能说明小规则是否符合预期'),
    ('浏览器与接口','实际点击 → 检查响应/页面','能说明本次页面链路发生了什么'),
    ('真实数据库测试','同版本竞争 / 注入故障','看版本、时间线与独立回读'),
    ('同伴解压复现','另一目录/机器 → 按README启动','能说明接手者能否完成关键路径')]):
    y=128+i*83
    b+=box(36,y,928,68)+text(55,y+42,a,20,GREEN,700)+text(245,y+42,c,18)+text(575,y+42,d,18)
save('12-测试证据.svg','每一种测试回答不同的问题','不要把“构建成功”填写成“所有业务已验收”，也不要把教师报告写成本人执行。',b,510)

b=''
for x,t,l in [(36,'原工程 app',['自己的代码、锁文件','docs/evidence与设计资料','本机.private留在原地']), (364,'生成交付目录',['node tools/hand-in.mjs','排除密码、依赖、运行目录','人工检查后压缩ZIP']), (692,'同伴解压复现',['新目录安装依赖、init','取得教师分配的隔离库','记录成功、失败与未执行'])]:
    b+=box(x,140,272,215)+text(x+18,182,t,23,GREEN,700)+text(x+18,227,l,18,gap=37)
b+=arrow(313,243,353,243)+arrow(640,243,681,243)
b+=box(36,393,928,75,'#fff9e9')+text(58,439,'交付是别人按说明能接手；压缩成功不等于已经部署，更不等于接入真实设备。',20,weight=600)
save('13-交付接力.svg','从自己的电脑，交给下一位同学','保留原工程和原记录；接手者使用自己的账号与教师分组数据库。',b,530)
print(f'Created 12 SVG illustrations in {ROOT}')
