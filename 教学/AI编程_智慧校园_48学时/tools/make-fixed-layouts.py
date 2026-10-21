"""Deterministic SVG layouts for wide or long teaching diagrams.

Mermaid remains the editable logical source. Each metadata renderSource points to
the SVG layout actually rendered. Changing semantics requires updating both.
"""
from pathlib import Path
import html
import json

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'figure-sources/layouts'
OUT.mkdir(exist_ok=True)
INDEX = json.loads((ROOT / 'illustrations/chapter-figures.json').read_text())
FIGURES = {f['number']: f for f in INDEX['figures']}
PALETTE = {'blue': ('#edf4fb', '#487ca4'), 'green': ('#edf7f4', '#558c7e'), 'gold': ('#fff5df', '#b58429'), 'gray': ('#f3f6f9', '#8da6b8')}

def text(x, y, lines, size=24, weight=400, fill='#17334b', anchor='start'):
    if isinstance(lines, str):
        lines = [lines]
    return ''.join(f'<text x="{x}" y="{y+i*34}" font-size="{size}" font-weight="{weight}" fill="{fill}" text-anchor="{anchor}">{html.escape(line)}</text>' for i, line in enumerate(lines))

def card(x, y, w, h, title, lines=(), tone='blue'):
    fill, stroke = PALETTE[tone]
    return f'<g data-card="true"><rect x="{x}" y="{y}" width="{w}" height="{h}" rx="10" fill="{fill}" stroke="{stroke}" stroke-width="2"/>{text(x+24,y+42,title,26,600)}{text(x+24,y+82,lines,23)}</g>'

def arrow(points, label='', lx=None, ly=None, dashed=False):
    p=' '.join(('M' if i==0 else 'L')+f'{x} {y}' for i,(x,y) in enumerate(points))
    result=f'<path d="{p}" fill="none" stroke="#526b7c" stroke-width="2.6" stroke-linejoin="round" marker-end="url(#arrow)"'+(' stroke-dasharray="7 5"' if dashed else '')+'/>'
    if label:
        result += text(lx,ly,label,21,fill='#526b7c',anchor='middle')
    return result

def strip(y, lines, tone='gray', h=None):
    if isinstance(lines,str): lines=[lines]
    fill,_=PALETTE[tone]
    height=h or 38+34*len(lines)
    return f'<rect x="64" y="{y}" width="1152" height="{height}" rx="8" fill="{fill}"/>'+text(84,y+36,lines,23)

def save(number, height, content):
    f=FIGURES[number]
    meta_path=(ROOT/f['source']).with_suffix('.figure.json')
    meta=json.loads(meta_path.read_text())
    svg=f'''<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="{height}" viewBox="0 0 1280 {height}" role="img" aria-labelledby="title desc">
<title id="title">{html.escape(f['title'])}</title><desc id="desc">{html.escape(f['alt'])}</desc>
<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto"><path d="M1 1 L9 5 L1 9Z" fill="#526b7c"/></marker></defs>
<style>text{{font-family:"PingFang SC","Noto Sans CJK SC","Microsoft YaHei",sans-serif}}</style>
<rect width="1280" height="{height}" fill="white"/>
<rect x="48" y="38" width="5" height="64" rx="2" fill="#245b81"/>
{text(72,53,f['id']+' · 教学示意',17,fill='#526b7c')}{text(72,98,f['title'],32,600)}
{content}
<line x1="48" y1="{height-68}" x2="1232" y2="{height-68}" stroke="#cfdae2"/>
{text(48,height-32,'教学设计示意 · 非运行截图 · 不代表实验已验证',19,fill='#526b7c')}
</svg>'''
    out=OUT/(f['stem']+'.svg')
    out.write_text(svg)
    meta['renderSource']=str(out.relative_to(ROOT))
    meta['layoutNote']='固定 SVG 版式；原 Mermaid 保留逻辑关系，实际图面以本 SVG 为准。'
    meta_path.write_text(json.dumps(meta,ensure_ascii=False,indent=2)+'\n')
    print(number, out.relative_to(ROOT))

def snake(number, steps, notes, labels=None):
    positions=[]
    body=''
    for i,(title,lines) in enumerate(steps):
        row=i//2; col=i%2 if row%2==0 else 1-i%2
        x=64 if col==0 else 716; y=190+row*200
        positions.append((x,y))
        body+=card(x,y,500,150,f'{i+1:02}　{title}',lines,'green' if i==len(steps)-1 else 'blue')
    for i,((x,y),(nx,ny)) in enumerate(zip(positions,positions[1:])):
        label=(labels or {}).get(i,'')
        if y==ny:
            start=(x+500,y+75) if nx>x else (x,y+75)
            end=(nx,ny+75) if nx>x else (nx+500,ny+75)
            body+=arrow([start,end],label,(start[0]+end[0])/2,y+58)
        else:
            body+=arrow([(x+250,y+150),(nx+250,ny)],label,x+350,y+183)
    bottom=190+((len(steps)-1)//2)*200+150
    body+=strip(bottom+44,notes,'gold')
    save(number,bottom+44+38+34*len(notes)+106,body)

snake('01-01',[
 ('使用问题',['先明确谁遇到了什么问题']),('需求',['用户故事与可观察验收']),
 ('设计',['数据模型与接口合同']),('实现',['在允许范围内完成局部代码']),
 ('验证',['比较预期与实际结果']),('交付',['记录版本、证据与接力'])
],['验证发现歧义 → 回到需求；发现设计缺口 → 回到设计。','交付后的新问题 → 开始下一轮，不抹去已有证据。'])

body=text(64,164,'先比较输入，再判断模型建议能否被检查。',23,fill='#526b7c')
for x,tone,heading,steps in [
 (64,'gold','信息不足的提示',[('含糊要求',['“完整系统”“专业一点”','“不要出错”']),('缺少共同边界',['角色和范围没有定义','输入、规则与验收不清楚']),('无法逐项验收',['回答很长，也难判断对错','先补齐问题，再请求修改'])]),
 (672,'green','可检查的小任务',[('给出目标和输入',['目标：设备台账需求','输入：通信三态字段']),('写明规则和边界',['未知不等于离线','本次不做远端控制']),('规定可观察验收',['true / false / null 分别检查','逐项核对模型建议'])])]:
    body+=text(x,216,heading,28,600)
    for i,(title,lines) in enumerate(steps):
        body+=card(x,250+i*210,544,156,title,lines,tone)
        if i<2: body+=arrow([(x+272,406+i*210),(x+272,460+i*210)])
save('01-02',950,body)

snake('01-03',[
 ('学生定义任务',['提供目标、合同和必要片段']),('网页 AI 提出建议',['给出方案、草稿与解释']),
 ('学生审查',['采纳或拒绝，核对业务规则']),('学生本地执行',['人工应用修改并运行核验']),
 ('比较预期与实际',['判断结果是否满足验收']),('记录证据并接力',['只记录实际结果与未决项'])
],['审查发现规则冲突 → 明确反馈给网页 AI；不直接执行。','实际不符或证据不足 → 回传真实、脱敏证据，再审查与核验。'],{4:'通过'})

body=card(64,240,336,160,'工作区',['正在编辑的文件'],'blue')+card(472,240,336,160,'暂存区',['准备提交的内容'],'blue')+card(880,240,336,160,'提交',['已记录的版本快照'],'green')
body+=arrow([(400,320),(472,320)],'git add',436,220)+arrow([(808,320),(880,320)],'git commit',844,220)
body+=arrow([(232,400),(232,500),(640,500),(640,400)],'git diff：工作区与暂存区',436,482)
body+=arrow([(640,400),(640,610),(1048,610),(1048,400)],'git diff --cached：暂存区与当前提交',844,650)
body+=strip(705,['普通 git diff 为空，不代表没有已暂存的改动。','已提交的问题通过追加修正记录处理；保留可解释的历史。'],'gold')
save('04-01',920,body)

body=card(64,190,500,140,'页面没有预期设备',['先观察 Network 是否有请求'])
body+=card(716,190,500,140,'没有请求',['检查前端事件、加载逻辑','以及控制台错误'],'gold')
body+=arrow([(564,260),(716,260)],'没有',640,244)
body+=card(64,410,500,120,'有请求：检查实际响应',['先看状态、类型和响应正文'],'green')
body+=arrow([(314,330),(314,410)],'有',355,375)
cases=[('HTML / 路径不匹配',['代理前缀与路径重写','目标地址与页面回退']),('401 / 403',['教学登录身份和权限','不要用绕过认证来调试']),('网络 / 服务错误',['后端日志与监听端口','再看依赖和数据源']),('合法成功 JSON',['data.items 的取值层级','字段类型和页面渲染'])]
for i,(title,lines) in enumerate(cases):
    x=64+(i%2)*652; y=640+(i//2)*210
    body+=card(x,y,500,150,title,lines)
body+=arrow([(564,470),(640,470),(640,590),(314,590),(314,640)])
body+=arrow([(640,590),(966,590),(966,640)])
body+=arrow([(640,590),(640,800),(314,800),(314,850)])
body+=arrow([(640,800),(966,800),(966,850)])
body+=strip(1050,'四个响应分支并列；只检查与观察现象对应的层次。')
save('04-03',1230,body)

body=card(350,190,580,130,'读取页面数据',['先区分首次加载和已有成功快照'],'green')
body+=text(64,376,'首次读取结束后，按真实结果选择对应反馈：',25,600)
cases=[('首次失败',['显示安全错误','提供重试','不显示假数据']),('原始目录为空',['请求成功','原始列表为 []','显示“目录为空”']),('筛选无匹配',['原始目录有数据','筛选后为空','提供清除筛选']),('有匹配结果',['显示列表 / 卡片','数量来自实际结果','按标识进入详情'])]
for i,(title,lines) in enumerate(cases):
    x=64+i*296
    body+=card(x,430,264,220,title,lines,'gold' if i==0 else 'blue')
    body+=arrow([(640,320),(640,397),(x+132,397),(x+132,430)])
body+=strip(720,['已有成功快照的再次读取失败：保留旧快照，并标明失败与最后成功时间。','重试 / 下一轮成功：重新依据原始列表与筛选结果分类，不保留假成功状态。'],'gold')
save('06-03',950,body)

body=''
rows=[('身份有效？',['当前请求有可信的教学身份'],'401 身份无效'),('角色有资格？',['读取、管理、处置按合同区分'],'403 权限不足'),('对象在范围内？',['管理人员只能处理本人已分派事件'],'403 对象范围不足'),('参数、对象与业务有效？',['仍须满足字段、存在性、状态和版本规则'],'400 / 404 / 409')]
for i,(title,lines,error) in enumerate(rows):
    y=190+i*190
    body+=card(64,y,620,140,title,lines)+card(836,y,380,140,error,['按合同拒绝，不写业务记录'],'gold')
    body+=arrow([(684,y+70),(836,y+70)],'否',760,y+52)
    if i<3: body+=arrow([(374,y+140),(374,y+190)],'是',414,y+176)
body+=card(64,990,1152,120,'全部适用条件满足后执行',['返回服务端事实；前端入口只接受 Boolean true 授权。'],'green')
body+=arrow([(374,900),(374,990)],'是',414,950)
body+=strip(1160,'图示为业务判断关系；实际认证与参数校验入口沿教师冻结的基础实现。')
save('08-02',1340,body)

body=card(64,200,480,150,'NEW　待分派',['当前没有有效事件负责人'])
body+=card(716,200,500,150,'创建独立演练事件',['有效责任人可成为初始 assignee','创建版本为 1，保留来源标记'],'green')
body+=arrow([(716,275),(544,275)],'无有效责任人',630,252)
body+=card(64,440,480,150,'ASSIGNED　待处理',['已保存负责人，等待明确开始'])
body+=arrow([(304,350),(304,440)],'ADMIN 分派',390,403)
body+=arrow([(966,350),(966,395),(544,395),(544,440)],'有有效责任人',810,384)
body+=card(716,440,500,150,'来源状态另存',['ACTIVE / RECOVERED / UNKNOWN','来源恢复不自动关闭'],'gold')
body+=card(64,700,480,150,'IN_PROGRESS　处理中',['可追加处置 NOTE','按规则核实来源并请求关闭'])
body+=arrow([(304,590),(304,700)],'有权处理者开始',420,653)
body+=arrow([(544,775),(608,775),(608,515),(544,515)],'ADMIN 重新分派',706,642)
body+=card(716,700,500,150,'CLOSED　已关闭',['全部关闭门槛满足','后续修改均禁止，包括重复恢复'],'green')
body+=arrow([(544,835),(650,835),(650,775),(716,775)],'全部门槛通过',820,884)
body+=strip(940,['ASSIGNED 可由 ADMIN 重新分派；IN_PROGRESS 追加 NOTE 时状态不变。','恢复与核实不自动推进处置状态；各动作仍检查权限、版本和适用条件。'],'gold')
save('09-01',1170,body)

body=card(64,190,1152,120,'先确认请求与身份',['字段白名单、非负整数 expectedVersion、非空结论；可信当前身份。'])
body+=arrow([(640,310),(640,370)])
body+=card(64,370,1152,120,'事务内锁定当前事件，并检查权限和版本',['事件必须存在；ADMIN 或本人范围内的处理者；expectedVersion 匹配。'],'green')
body+=arrow([(640,490),(640,550)])
body+=text(64,582,'关闭必须同时满足下列三组业务条件：',27,600)
body+=card(64,620,1152,120,'1　处置条件',['state = IN_PROGRESS；时间线至少已有一条 NOTE。'])
body+=card(64,774,1152,188,'2　本地演练确已有效恢复',['sourceType=DEMO；sourceScope=LOCAL_DEMO；sourceState=RECOVERED。','sourceRawStatus=DEMO_RECOVERED；sourceRecoveredAt 非空。','恢复时间不早于 occurredAt；来源恢复本身不自动关闭。'])
body+=card(64,996,1152,154,'3　服务端独立核实通过',['sourceCheckOutcome=PASS；sourceVerifiedAt 非空且不早于恢复时间。','核实结论与时间由后端决定，不接受前端自报 PASS。'])
body+=arrow([(640,1150),(640,1210)])
body+=card(64,1210,1152,120,'全部满足：关闭主记录，并追加 CLOSE 时间线',['同一事务提交；任一写入失败须整体回滚。'],'green')
body+=strip(1380,['任一适用检查失败即拒绝：400 格式，401 身份，403 权限，404 不存在。','版本不符返回 409 VERSION_CONFLICT；关闭门槛不符返回 409 STATE_CONFLICT。'],'gold')
save('09-02',1610,body)

body=card(350,190,580,120,'教学设备的逻辑引用',['用 deviceId 关联责任与事件'],'green')
body+=arrow([(640,310),(640,360),(314,360),(314,430)])
body+=arrow([(640,360),(966,360),(966,430)])
body+=card(64,430,500,160,'当前责任主记录',['ownerUid / version','登记当前设备责任人'])
body+=card(716,430,500,160,'独立事件主记录',['assigneeUid / state / version','创建时保存本事件的负责人'])
body+=arrow([(314,590),(314,710)],'同一责任事务追加',440,665)
body+=arrow([(966,590),(966,710)],'同一事件事务追加',1092,665)
body+=card(64,710,500,150,'责任时间线',['前后 uid、操作者、说明与版本','保留每次责任变更'])
body+=card(716,710,500,150,'事件时间线',['action / actor / caseVersion','保留每次事件业务动作'])
body+=strip(920,['创建新事件时才读取当前责任，并重新核对责任人的处理资格。','责任更新不改已有事件；已有事件的负责人只经显式 assign 改派。'],'gold')
save('10-01',1150,body)

body=card(64,190,500,150,'初始责任 · version=0',['ownerUid=null','尚无责任变更历史'])
body+=card(716,190,500,150,'第一条历史 · version=1',['null → manager-a','actor=ADMIN；说明：本轮分工'])
body+=arrow([(564,265),(716,265)],'登记 A',640,248)
body+=card(716,430,500,150,'第二条历史 · version=2',['manager-a → manager-b','actor=ADMIN；说明：轮值调整'])
body+=arrow([(966,340),(966,430)],'改为 B',1030,394)
body+=card(64,430,500,150,'当前主记录 · version=2',['ownerUid=manager-b','从最后一次合法变更解释当前分工'],'green')
body+=arrow([(716,505),(564,505)],'对应',640,488)
body+=strip(650,['历史 v1 与 v2 均保留：前后 uid、当次操作者、时间和说明可追溯。','显示名可以改变；不能用新显示名覆盖已经保存的历史 uid。'],'gold')
save('10-03',880,body)

body=text(64,170,'五类证据并列回答不同问题，不能互相替代。',25,600)
items=[('构建与单元',['类型、纯规则与组件分支','不能证明真实事务或完整页面']),('真实 MySQL 集成',['行锁、版本、唯一约束与回滚','必须观察实际数据库边界']),('带身份 API',['角色、对象范围与字段校验','请求、响应和独立回读对应']),('浏览器流程',['输入保留、状态提示与刷新','不能单独证明数据库原子性']),('选做外部接入',['只读路径与实际来源单独验证','基础课程不依赖真实平台']),('统一报告方式',['每类写明版本、范围、实际结果','未验证内容继续作为缺口'])]
for i,(title,lines) in enumerate(items):
    body+=card(64+(i%2)*652,230+(i//2)*210,500,156,title,lines,'gold' if i==4 else 'green' if i==5 else 'blue')
body+=strip(880,'Mock 不证明真实行锁与回滚；构建成功不代表浏览器流程通过。','gold')
save('11-01',1070,body)

snake('11-03',[
 ('记录基线',['事件或责任的主字段、版本、历史']),('业务事务锁行',['更新主记录；此时尚未提交']),
 ('经过真实时间线写入路径',['在提交前注入可识别的失败']),('异常传到事务边界',['整体回滚，请求以非成功结束']),
 ('用独立新连接回读',['业务事务结束后、测试清理之前']),('比较基线与回读',['主字段、版本、历史应全部不变'])
],['相等 → 关闭注入，再做正常请求共同提交的正向对照。','不相等 → 记录部分提交缺陷。事件与责任分别执行，不能用 mock 替代。'])

snake('11-04',[
 ('保存首次失败',['留下输入、版本和实际结果']),('固定最小复现',['减少同时变化的条件']),
 ('区分事实与假设',['把证据缺口单独列出']),('增加最少观察点',['用观察支持或推翻假设']),
 ('定位并解释现象',['没有解释清楚时继续定位']),('进行最小修复',['不放宽权限，不删断言']),
 ('重跑原失败与相邻回归',['比较实际结果与独立规则']),('记录结果并交接',['保留差异、证据与未覆盖项'])
],['未定位 → 回到事实、假设和观察；回归不符 → 保留失败继续定位。'],{4:'已定位',6:'符合规则'})

snake('12-01',[
 ('确认源码基线',['锁文件、迁移与种子版本']),('执行检查和构建',['保存实际命令与退出结果']),
 ('标识构建产物',['记录位置、版本或哈希']),('在独立环境运行',['核对地址、配置与进程']),
 ('验证真实身份的业务',['四身份与核心流程分别留证据']),('同伴按说明干净复现',['记录问题和实际覆盖范围']),
 ('形成交付包与交接',['证据索引、版本和剩余缺口'])
],['构建成功不等于业务通过；启动成功不等于他人可复现。','每一步保存自己的结果，未完成项目继续列为缺口。'])

snake('12-02',[
 ('定义状态筛选需求',['刷新后仍保留；写可观察验收']),('核对合同和影响范围',['复用已有 state 参数与业务规则']),
 ('保存基线 A',['保留原有代码和证据']),('实施最小变更',['页面、参数与对应测试一起调整']),
 ('运行受影响检查',['类型、刷新、清除、切换与失败']),('形成基线 B 并交接',['更新说明和变更记录；同伴复现'])
],['检查失败 → 保留证据，定位后回到最小修改；不可把失败写成通过。','确需修改合同或 schema → 先统一约定、测试及迁移审查。'],{4:'符合规则'})

body=card(64,190,1152,120,'变更失败：先保存现状与证据',['判断是否涉及数据或 schema；不确定时按需要审查的路径处理。'],'green')
body+=arrow([(640,310),(640,350),(314,350),(314,410)],'仅代码行为',314,385)
body+=arrow([(640,350),(966,350),(966,410)],'涉及数据或无法判断',966,385)
body+=card(64,410,500,160,'核对兼容性',['确认旧代码与当前数据可兼容','未确认时保留现状并请教师审查'])
body+=card(716,410,500,160,'教师审查恢复方案',['明确范围、备份与新增迁移','核对新记录和其他数据的影响'],'gold')
body+=arrow([(564,490),(716,490)],'不兼容',640,472)
body+=arrow([(314,570),(314,650)],'已确认兼容',416,618)
body+=arrow([(966,570),(966,650)],'方案明确',1050,618)
body+=card(64,650,500,160,'在隔离副本恢复已核验代码',['当前数据不会被代码回退自动还原','继续运行受影响检查'])
body+=card(716,650,500,160,'先做隔离恢复验证',['核对数据与后续记录影响','确认恢复结果并运行受影响检查'])
body+=arrow([(314,810),(314,865),(640,865),(640,920)])
body+=arrow([(966,810),(966,865),(640,865)])
body+=card(64,920,1152,120,'记录实际结果与交接',['代码回退与数据恢复是不同操作，禁止直接清库覆盖来掩盖问题。'],'green')
save('12-03',1160,body)
