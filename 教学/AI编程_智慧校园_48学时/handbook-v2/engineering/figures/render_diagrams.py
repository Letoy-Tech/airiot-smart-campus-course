#!/usr/bin/env python3
"""Rebuild the seven editable, offline SVG teaching diagrams (Python stdlib only)."""
from pathlib import Path
from html import escape
import json
P = Path(__file__).resolve().parent
VERSION = json.loads((P.parents[2] / 'tools/v2/course-config.json').read_text())['version']
FONT = 'system-ui,-apple-system,BlinkMacSystemFont,"PingFang SC","Microsoft YaHei",sans-serif'
class Figure:
    def __init__(self,name,title,subtitle,h):
        self.name=name; self.h=h
        self.items=[f'<svg xmlns="http://www.w3.org/2000/svg" width="1120" height="{h}" viewBox="0 0 1120 {h}" role="img" aria-labelledby="title desc"><title id="title">{escape(title)}</title><desc id="desc">{escape(subtitle)}</desc><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#406b72"/></marker></defs><style>text{{font-family:{FONT};fill:#18373d}}.title{{font-size:28px;font-weight:700}}.subtitle{{font-size:17px;fill:#49656b}}.label{{font-size:18px}}.small{{font-size:16px}}.head{{font-size:20px;font-weight:650}}</style><rect width="1120" height="{h}" fill="#f8fbfa"/>']
        self.text(36,45,title,'title'); self.text(36,77,subtitle,'subtitle')
    def text(self,x,y,t,cls='label',anchor='start'):
        self.items.append(f'<text x="{x}" y="{y}" class="{cls}" text-anchor="{anchor}">{escape(t)}</text>')
    def box(self,x,y,w,h,title,lines=(),fill='#ffffff'):
        self.items.append(f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="12" fill="{fill}" stroke="#80a5a8" stroke-width="1.6"/>')
        self.text(x+18,y+30,title,'head')
        for i,t in enumerate(lines): self.text(x+18,y+60+i*25,t,'small')
    def ellipse(self,x,y,rx,ry,title,sub=''):
        self.items.append(f'<ellipse cx="{x}" cy="{y}" rx="{rx}" ry="{ry}" fill="#ffffff" stroke="#6b9696" stroke-width="1.6"/>')
        self.text(x,y-3 if sub else y+6,title,'label','middle')
        if sub:self.text(x,y+23,sub,'small','middle')
    def path(self,d,label=None,lx=0,ly=0,dash=False,arrow=True):
        self.items.append(f'<path d="{d}" fill="none" stroke="#406b72" stroke-width="1.8"'+(' stroke-dasharray="7 5"' if dash else '')+(' marker-end="url(#arrow)"' if arrow else '')+'/>')
        if label:self.text(lx,ly,label,'small')
    def actor(self,x,y,label):
        self.items.append(f'<circle cx="{x}" cy="{y}" r="16" fill="#e5f0ec" stroke="#406b72" stroke-width="2"/><path d="M{x},{y+16}v43 M{x-27},{y+34}h54 M{x},{y+59}l-25,34 M{x},{y+59}l25,34" fill="none" stroke="#406b72" stroke-width="2"/>')
        self.text(x,y+121,label,'head','middle')
    def save(self):
        self.text(36,self.h-22,f'AIRIOT 智慧校园课堂 · V{VERSION} · 本地教学样本 / 可编辑 SVG','small')
        (P/(self.name+'.svg')).write_text(''.join(self.items)+'</svg>',encoding='utf-8')

f=Figure('use-cases','用例图｜角色、目标与系统边界','边界内是课堂业务；所有登录角色可读，写入和审计按角色限制。',910)
f.items.append('<rect x="245" y="112" width="840" height="720" rx="16" fill="#edf5f1" stroke="#9bb6ad"/>')
f.text(270,144,'本地智慧校园课堂系统','head')
f.actor(110,205,'ADMIN 管理员'); f.actor(110,420,'MANAGER 处理人'); f.actor(110,640,'VIEWER 查看者')
f.ellipse(475,218,185,51,'编辑空间与登记责任','FR-03 / UC-02'); f.ellipse(875,218,185,51,'创建、分派、模拟恢复','UC-03 管理动作')
f.ellipse(475,353,185,51,'查看业务审计','FR-09，仅管理员');f.ellipse(875,430,185,59,'开始、记录、核实、关闭','UC-03：管理员或本人已分派')
f.ellipse(475,596,185,55,'查询设备与历史等资料','UC-01 / 三个角色都可读')
f.ellipse(875,745,185,51,'登录与退出','UC-04 / 三个角色')
f.path('M137 239 H290',arrow=False); f.path('M170 239 V165 H875 V167',arrow=False);f.path('M170 239 V353 H290',arrow=False)
f.path('M200 239 V430 H690',arrow=False);f.path('M137 454 H645 V430 H690',arrow=False)
f.path('M137 674 H265 V596 H290',arrow=False)
f.path('M225 239 V596 H290',arrow=False);f.path('M137 454 H225',arrow=False)
f.path('M225 596 V745 H690',arrow=False)
f.text(280,803,'无设备控制、外部通知、报警写入、注册和账户管理用例。','label');f.save()

f=Figure('architecture-deployment','分层部署图｜一台电脑上的协作','所有网络入口绑定 127.0.0.1；箭头表示调用，数据保存位置单独注明。',790)
f.box(35,125,300,180,'浏览器 / frontend',['HTML、CSS、app.js','data-service.js → 同源 /api','令牌仅内存；演示数据localStorage'])
f.box(410,125,280,180,'A：Node 页面服务',['127.0.0.1:5188','只公开 frontend','/api 原路径转发；不做业务授权'])
f.box(765,125,320,180,'B：Spring Boot 后端',['127.0.0.1:8098','拦截器 → 控制器 → 服务/规则','JdbcTemplate；业务权限与事务'])
f.path('M335 213 H410','HTTP',352,199);f.path('M690 213 H765','/api',710,199)
f.box(400,415,320,150,'MySQL 8.4',['宿主23501 → 容器3306','业务 / 用户摘要 / 审计','命名卷：停止或重启后仍保存'])
f.box(765,415,320,150,'Redis 7.4',['宿主23502 → 容器6379','仅短时会话，TTL 1800秒','本课无持久化；重启后重登'])
f.path('M850 305 V355 H560 V415','SQL / 事务',596,344);f.path('M965 305 V415','校验会话',976,366)
f.box(35,415,300,150,'C：工具终端',['Compose / 配置 / 检查','命令结束可继续输入','不是第三个常驻业务服务'])
f.box(35,620,1050,95,'隔离与边界',['页面不直连数据库；不公开.env；不连接真实校园；端口冲突先确认自己的进程。'],'#edf5f1');f.save()

f=Figure('er-model','ER 图｜教师参考物理表','实线：真实外键（箭头指被引用表）；虚线：逻辑关联。0..N 表示可以没有，也可以多条。',1120)
f.box(40,130,285,110,'spaces / 空间',['PK id','name, building, floor'])
f.box(415,130,285,110,'devices / 设备',['PK id；FK space_id','online 可空；simulated'])
f.box(790,130,285,110,'users / 用户',['PK username','password_hash, role'])
f.path('M415 185 H325','0..N → 1',334,164)
f.box(40,340,285,110,'points / 当前点',['PK (device_id, tag_id)','FK device_id；payload JSON'])
f.box(40,535,285,110,'history / 历史',['PK (device_id, tag_id)','FK device_id；payload JSON'])
f.box(40,730,285,110,'alarms / 原始报警',['PK id；FK device_id','payload JSON；只读'])
f.path('M325 395 H360 V270 H500 V240','点0..N → 设备1',375,290)
f.path('M325 590 H375 V305 H550 V240')
f.path('M325 785 H390 V315 H600 V240')
f.text(42,306,'当前点 / 历史 / 报警各属于1台设备','small')
f.path('M180 535 V450','同device/tag；无联合FK',50,498,True,False)
f.box(415,365,285,135,'owners / 当前责任',['PK/FK device_id','FK username；note, version','每台设备0..1条责任'])
f.path('M540 365 V240','责任0..1 → 设备1',550,331)
f.path('M700 410 H747 V180 H790','0..N → 用户1',764,314)
f.box(790,365,285,165,'cases / 演练事件',['PK id；FK device_id','FK assignee 可空','state, version 等','timeline JSON：无独立时间线表'])
f.path('M875 365 V280 H670 V240','事件0..N → 设备1',748,265)
f.path('M1010 365 V240','事件0..N → 用户0..1',800,346)
f.box(790,660,285,135,'audit / 审计',['PK id；time, username','action, target, detail','无任何外键'])
f.path('M930 660 V530','target可指事件ID',945,599,True)
f.text(795,830,'username与用户是逻辑关联；','small');f.text(795,856,'target还可指空间/设备，无统一FK。','small')
f.box(415,730,285,110,'course_seed / 初始化',['PK id；applied_at','独立初始化标记，无业务外键'])
f.box(40,910,1035,120,'读图提醒',['案例与原始报警无alarmId关系；两者只是都关联设备。','MySQL业务表10张；Redis会话不在此图；Flyway内部历史表不计入课程业务模型。'],'#edf5f1');f.save()

f=Figure('event-state','状态图｜演练进度与关闭门槛','依据 CaseRules；权限、expectedVersion 与未关闭检查适用于每次后续动作。',900)
f.box(385,120,350,85,'创建演练 / ADMIN',['设备存在；message非空；version=1'])
f.box(65,290,260,110,'NEW / 待分派',['设备无责任人','assignee=null'])
f.box(455,290,260,110,'ASSIGNED / 已分派',['设备已有责任人或已assign','assignee=manager'])
f.path('M445 205 V245 H195 V290','无责任人',220,234);f.path('M635 205 V290','有责任人',646,252)
f.path('M325 345 H455','assign / ADMIN',329,329)
f.path('M715 345 H790 V250 H585 V290','assign：可再次分派',796,299)
f.box(455,490,260,110,'IN_PROGRESS / 处理中',['start：ADMIN或本事件manager','记录、恢复、核实不改状态'])
f.path('M585 400 V490','start',600,454)
f.box(45,485,325,180,'独立条件',['note：处置记录非空','recover：来源变RECOVERED','verify：满足前两项才核实','note/recover会清除旧verified'],'#edf5f1')
f.path('M455 550 H370',arrow=False)
f.path('M715 540 H950 V590 H715','note / recover / verify',765,520)
f.box(455,720,260,95,'CLOSED / 已关闭',['关闭后拒绝所有修改'])
f.path('M585 600 V720','close + 非空关闭结论',600,654)
f.box(45,690,365,140,'关闭须同时满足',['处理中；已有非空处置记录','来源已恢复；已经独立核实','本次填写非空关闭结论'],'#edf5f1')
f.text(45,850,'状态/版本不符返回409；成功版本+1并保存时间线与审计；恢复不等于关闭。','small');f.save()

f=Figure('concept-classes','概念类图｜对象关系与代码职责','上部是业务概念，不表示源码都有同名Java类；下部标明参考工程真实职责依赖。',950)
f.box(40,130,250,110,'Space / 空间',['id, name','building, floor'])
f.box(435,130,250,110,'Device / 设备',['id, spaceId, category','online, simulated'])
f.box(830,130,250,110,'User / 账号',['username, role','实际Java record'])
f.path('M290 185 H435','1 — 0..N',328,172,False,False)
f.box(40,355,250,130,'Point / History',['deviceId + tagId','value / samples','概念关联，不表示相互FK'])
f.path('M165 355 V290 H510 V240','0..N — 1',195,279,False,False)
f.box(435,355,250,130,'Owner / 责任',['deviceId, username','note, version','概念对象，响应使用Map'])
f.path('M560 355 V240','0..1 — 1',576,298,False,False)
f.path('M685 415 H760 V185 H830','0..N — 1',770,327,False,False)
f.box(830,355,250,130,'CaseRecord / 事件',['state, assignee, version','sourceState, verified','timeline；实际Java类'])
f.path('M955 355 V240','0..N — 0..1',965,298,False,False)
f.path('M890 355 V275 H650 V240','事件0..N — 设备1',704,264,False,False)
f.box(40,610,300,160,'CampusController',['请求DTO与路径','依赖 CampusService / AuthService','调用入口，不保存页面状态'])
f.box(410,610,300,160,'CampusService',['JdbcTemplate + ObjectMapper','事务 / 查询 / 保存 / 审计','调用 CaseRules.apply'])
f.box(780,610,300,160,'CaseRules + User',['纯状态与权限规则','操作 CaseRecord','不直接连数据库'])
f.path('M340 690 H410','调用',349,675);f.path('M710 690 H780','调用',720,675)
f.text(42,840,'概念模型回答“有哪些对象及关系”；源码模型回答“哪些类承担这些职责”。','label');f.text(42,872,'参考Map/JSON的教学简化不等于数据库没有约束，实际约束以ER图和SQL为准。','label');f.save()

# Sequence diagrams use numbered messages and fixed lifelines for clear offline reading.
def sequence(name,title,subtitle,actors,events,h):
    f=Figure(name,title,subtitle,h)
    xs=[125,415,705,995]
    for x,a in zip(xs,actors):
        f.box(x-100,112,200,65,a)
        f.path(f'M{x} 177 V{h-115}',dash=True,arrow=False)
    for y,a,b,label,ret in events:
        f.path(f'M{xs[a]} {y} H{xs[b]}',dash=ret)
        f.text((xs[a]+xs[b])/2,y-13,label,'small','middle')
    return f
f=sequence('login-sequence','时序图｜登录、受保护读取与退出','浏览器的请求经A代理到B；图中为简洁起见将A转发折叠，口令/令牌不写入证据。',['浏览器 / 数据层','后端认证服务','MySQL / 用户','Redis / 会话'],[
(235,0,1,'1. POST /api/login {username,password}',False),(295,1,2,'2. 查询规范账号与BCrypt摘要',False),(355,2,1,'3. 用户记录；后端校验口令',True),(425,1,3,'4. 随机令牌 → 保存会话，TTL1800秒',False),(495,3,1,'5. 保存完成',True),(565,1,0,'6. 200 {token,user}；令牌只存页面内存',True),(635,0,1,'7. GET /api/me + Bearer令牌',False),(695,1,3,'8. 读取并验证会话（不续期）',False),(755,3,1,'9. 当前用户；不存在则401',True),(815,1,0,'10. 200 {username,role}；随后读取业务',True),(885,0,1,'11. POST /api/logout + Bearer令牌',False),(945,1,3,'12. 验证会话后删除当前会话',False),(1005,1,0,'13. 200 {loggedOut:true}；清理前端身份',True)],1180)
f.box(36,1050,1048,75,'分支',['口令/令牌错误401；存储不可用503；刷新会丢失内存令牌；MySQL业务记录仍保留。'],'#edf5f1');f.save()
f=sequence('event-sequence','时序图｜带版本的事件动作','每个写动作独立执行；本图以 /cases/{id}/actions 为例，不把网络超时当作写入已回滚。',['浏览器 / 数据层','控制器 + 会话检查','业务服务与规则','MySQL'],[
(235,0,1,'1. POST actions {action,expectedVersion,...}',False),(295,1,2,'2. 已认证User + 校验后的请求',False),(355,2,3,'3. 开启事务；SELECT ... FOR UPDATE',False),(415,3,2,'4. 当前事件、状态与版本',True),(515,2,3,'5. 规则通过：更新主记录及timeline JSON',False),(575,2,3,'6. 同事务 INSERT audit',False),(635,3,2,'7. 事务成功提交',True),(695,2,1,'8. 返回新版本与状态',True),(755,1,0,'9. HTTP200 / code0 / CaseRecord',True),(825,0,1,'10. 独立 GET /api/cases 回读',False),(885,1,0,'11. 显示服务器保存的状态',True)],1120)
f.box(36,945,1048,115,'第4步后的规则检查与失败分支',['依次检查角色、版本、未关闭状态，再检查动作条件；无权限403，冲突/错误状态409，非法内容400。','失败不执行成功写入；409先回读，由人重新决定，不自动重发；失联结果不明也先回读。'],'#edf5f1');f.save()
print('Rendered 7 SVG diagrams.')
