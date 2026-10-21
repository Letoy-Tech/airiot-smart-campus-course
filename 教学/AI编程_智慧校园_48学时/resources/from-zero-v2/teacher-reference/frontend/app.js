import {dataService as ds} from './data-service.js';
const $=s=>document.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const names={dashboard:'概览',devices:'设备',spaces:'空间',energy:'能源',history:'历史',alarms:'原始报警',cases:'演练事件',owners:'设备责任',admin:'管理'};
const categories={environment:'环境',energy:'能源',facility:'设施',lighting:'照明'};
const pointNames={temperature:'温度',humidity:'湿度',power:'功率',voltage:'电压',status:'状态',brightness:'亮度'};
const stateNames={NEW:'待分派',ASSIGNED:'已分派',IN_PROGRESS:'处理中',CLOSED:'已关闭'};
const quality={fresh:'正常',stale:'较旧',missing:'缺失',invalid:'无效'};
let lastSnapshot='',viewData,caseRows=[],owners=[],generation=0,detailSequence=0,timer;
function notify(text){$('#notice').textContent=text;clearTimeout(timer);timer=setTimeout(()=>$('#notice').textContent='',6000)}
const stamp=t=>t==null?'无采样时间':new Date(t).toLocaleString('zh-CN',{hour12:false});
const route=()=>{const [page='dashboard',query='']=location.hash.slice(1).split('?');return {page:names[page]?page:'dashboard',params:new URLSearchParams(query)}};
const link=(page,text,q='')=>`<a class="button" href="#${page}${q?'?'+esc(q):''}">${esc(text)}</a>`;
const query=obj=>new URLSearchParams(obj).toString();
const table=(heads,rows)=>`<div class="tablewrap"><table><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.length?rows.join(''):`<tr><td colspan="${heads.length}" class="empty">暂无记录</td></tr>`}</tbody></table></div>`;
const row=(cells,attrs='')=>`<tr ${attrs}>${cells.map(x=>`<td>${x}</td>`).join('')}</tr>`;
const deviceName=id=>viewData.devices.find(x=>x.id===id)?.name||id;
const floorName=floor=>/^\d+$/.test(String(floor))?floor+'层':String(floor);
const spaceName=id=>{const s=viewData.spaces.find(x=>x.id===id);return s?`${s.building} ${floorName(s.floor)} · ${s.name}`:'未绑定'};
const onlineLabel=x=>x===true?'在线':x===false?'离线':'未知';
const options=(items,value,lab)=>items.map(x=>`<option value="${esc(x.id)}" ${x.id===value?'selected':''}>${esc(lab(x))}</option>`).join('');
const heading=(title,desc)=>`<h2>${esc(title)}</h2><p class="muted">${esc(desc)}</p>`;
const roleOptions=()=>[['ADMIN','管理员 admin'],['MANAGER','处理人 manager'],['VIEWER','查看者 viewer']].map(([r,n])=>`<option value="${r}" ${r===ds.user?.role?'selected':''}>${n}</option>`).join('');
function clearViewState(){lastSnapshot='';viewData=null;caseRows=[];owners=[];detailSequence++}
function shell(){
 const {page}=route();$('#nav').innerHTML=Object.entries(names).map(([k,n])=>`<a href="#${k}" ${page===k?'aria-current="page"':''}>${n}</a>`).join('');
 $('#identity').textContent=ds.user?`${ds.user.username} · ${ds.user.role}`:'尚未登录';$('#logout').hidden=ds.mode!=='api'||!ds.user;
 let control=$('#header-demo-role');
 if(ds.mode==='mock'){
  if(!control){control=document.createElement('label');control.id='header-demo-role';$('header .toolbar').append(control)}
  control.innerHTML=`演示身份 <select id="demo-role-top">${roleOptions()}</select>`;
  $('#demo-role-top').addEventListener('change',e=>{ds.setDemoRole(e.target.value);clearViewState();render()});
 }else control?.remove();
}
function login(){return heading('登录本地课程后端','账号：admin、manager 或 viewer。口令在自己电脑项目根的 .env 中查看 DEMO_PASSWORD；请不要发给 AI。')+`<form id="login" class="panel stack login"><label>账号<input name="username" value="admin" autocomplete="username" required></label><label>本地练习口令<input name="password" type="password" autocomplete="current-password" required></label><button class="primary">登录</button><p class="muted">刷新页面需要重新登录；业务记录仍在 MySQL。</p></form>`}
function dashboard(d,mode){
 const stat=(label,count,page)=>`<a class="stat stat-link" href="#${page}"><span>${esc(label)}</span><b>${count}</b></a>`;
 const issues=d.points.filter(p=>p.quality!=='fresh');
 return heading('今天，从这里开始',mode)+`<div class="stats">${stat('设备总数',d.devices.length,'devices')}${stat('空间总数',d.spaces.length,'spaces')}${stat('点位总数',d.points.length,'devices')}<div class="stat"><span>通信未知</span><b>${d.devices.filter(x=>x.online===null).length}</b></div></div>`+
 `<div class="split"><section class="panel"><h3>按空间查看设备</h3><div class="action-row">${d.spaces.map(s=>link('devices',s.name+' · '+d.devices.filter(x=>x.spaceId===s.id).length+'台',query({spaceId:s.id}))).join('')}</div></section><section class="panel"><h3>按类型查看设备</h3><div class="action-row">${Object.entries(categories).map(([id,name])=>link('devices',name+' · '+d.devices.filter(x=>x.category===id).length+'台',query({category:id}))).join('')}</div></section></div>`+
 `<section class="panel"><h3>点位质量 · 共 ${d.points.length} 项</h3><div class="quality-stats">${Object.entries(quality).map(([id,name])=>`<div><span>${name}</span><strong>${d.points.filter(p=>p.quality===id).length}</strong></div>`).join('')}</div><p class="muted">这里统计读数点位，不能当成故障设备数。正常也是固定教学样本。</p></section>`+
 `<section class="panel"><h3>需要留意的读数</h3>${issues.length?table(['设备','点位','质量','原采样时间','查看'],issues.map(p=>row([esc(deviceName(p.deviceId))+' · '+esc(p.deviceId),esc(pointNames[p.tagId]||p.tagId),esc(quality[p.quality]||p.quality),stamp(p.time),link('devices','查看设备',query({deviceId:p.deviceId}))]))):'<p>当前样本没有需留意的读数。</p>'}</section>`+
 `<section class="panel"><h3>值班巡查路线</h3><p>先查设备与样本，再登记责任，最后走一遍本地演练。</p><div class="action-row">${link('devices','查看全部设备')}${link('energy','查看能源读数')}${link('cases','处理演练事件')}</div></section><p class="warning">固定日期的教学样本，刷新不会产生新的采样时间。未知值不是 0，模拟演练不表示校园真的发生故障。</p>`;
}
function devicePage(d,params,mode){return heading('设备台账',mode)+`<section class="panel"><div class="toolbar"><label>名称或编号<input id="filter-name" placeholder="例如 电表 或 d05"></label><label>类型<select id="filter-category"><option value="">全部</option>${Object.entries(categories).map(([id,name])=>`<option value="${id}" ${params.get('category')===id?'selected':''}>${name}</option>`).join('')}</select></label><label>空间<select id="filter-space"><option value="">全部</option>${options(d.spaces,params.get('spaceId'),x=>x.name)}</select></label><label>在线情况<select id="filter-online"><option value="">全部</option><option value="true">在线</option><option value="false">离线</option><option value="null">未知</option></select></label><button id="clear-filters">清空筛选</button></div><div id="devices-table"></div></section><section id="detail"></section>`}
function spacePage(d,params,mode){return heading('空间与位置',mode)+table(['空间','楼栋','楼层','关联设备','登记'],d.spaces.map(s=>row([esc(s.name)+' · '+esc(s.id),esc(s.building),esc(s.floor),link('devices',d.devices.filter(x=>x.spaceId===s.id).length+' 台',query({spaceId:s.id})),ds.user.role==='ADMIN'?`<form data-space="${esc(s.id)}"><input aria-label="${esc(s.name)}楼栋" name="building" value="${esc(s.building)}" required maxlength="60"><input aria-label="${esc(s.name)}楼层" name="floor" value="${esc(s.floor)}" required maxlength="20"><button>保存位置</button></form>`:'只读'],`id="space-${esc(s.id)}" tabindex="-1" ${params.get('spaceId')===s.id?'class="selected-row"':''}`)))}
function energyPage(d,params){
 const tagId=params.get('tagId')==='voltage'?'voltage':'power',unit=tagId==='power'?'kW':'V',devices=d.devices.filter(x=>x.category==='energy');
 return heading('能源读数','功率用 kW，电压用 V；这些样本不能直接算作耗电量或费用。')+`<label>查看指标<select id="energy-tag"><option value="power" ${tagId==='power'?'selected':''}>功率 kW</option><option value="voltage" ${tagId==='voltage'?'selected':''}>电压 V</option></select></label>`+
 table(['设备','空间','读数','样本时间','质量','查看'],devices.map(device=>{const p=d.points.find(x=>x.deviceId===device.id&&x.tagId===tagId&&x.unit===unit);return row([esc(device.name)+' · '+esc(device.id),esc(spaceName(device.spaceId)),!p?'没有这项样本':p.value===null?'缺失':esc(p.value)+' '+esc(p.unit),p?stamp(p.time):'无采样时间',p?esc(quality[p.quality]||p.quality):'缺失',link('devices','查看设备',query({deviceId:device.id}))+' '+link('history','历史样本',query({deviceId:device.id,tagId}))])}))+
 `<section class="panel"><h3>比较历史 · ${tagId==='power'?'功率 kW':'电压 V'}</h3><form id="energy-compare"><fieldset class="compare-options"><legend>选择 1 至 4 台能源设备</legend>${devices.map(device=>`<label><input type="checkbox" name="compareDevice" value="${esc(device.id)}">${esc(device.name)} · ${esc(device.id)}</label>`).join('')}</fieldset><button>比较历史</button></form><div id="energy-comparison"><p class="muted">选择设备后点击比较。切换功率或电压后需要重新比较。</p></div></section>`;
}
function historySection(h,samples){return `<section class="panel"><h3>${esc(deviceName(h.deviceId))} · ${esc(h.deviceId)} · ${esc(pointNames[h.tagId]||h.tagId)} (${esc(h.tagId)}) ${esc(h.unit)}</h3>${samples.length?chart(samples,h.unit):'<p class="empty">这个范围没有样本。</p>'}${table(['采样时间','原始值'],samples.map(s=>row([stamp(s.time),s.value===null?'缺失（曲线断开）':esc(s.value)+' '+esc(h.unit)])))}</section>`}
function historyPage(d,params){
 const deviceId=params.get('deviceId')||'d05',tagId=params.get('tagId')||d.history.find(x=>x.deviceId===deviceId)?.tagId||'power',selected=d.history.find(x=>x.deviceId===deviceId&&x.tagId===tagId);
 const value=params.get('minutes')||'all',minutes=['15','60','360'].includes(value)?Number(value):null,compare=params.get('compare'),sets=selected?[selected,...(compare?d.history.filter(x=>x.deviceId===compare&&x.tagId===tagId&&x.unit===selected.unit):[])]:[];
 const end=selected?.samples.length?Math.max(...selected.samples.map(s=>s.time)):null;
 let html=heading('原始历史样本','横轴是采样时间；缺失处断开，0 保留为 0。范围以当前所选样本末尾时间为终点。')+`<form id="history-filter" class="toolbar"><label>设备<select name="deviceId">${options(d.devices,deviceId,x=>x.name+' · '+x.id)}</select></label><label>指标<select name="tagId">${d.history.filter(x=>x.deviceId===deviceId).map(x=>`<option value="${esc(x.tagId)}" ${x.tagId===tagId?'selected':''}>${esc(pointNames[x.tagId]||x.tagId)} (${esc(x.tagId)})</option>`).join('')}</select></label><label>范围<select name="minutes">${[['all','全部样本'],['15','样本末时刻前15分钟'],['60','样本末时刻前1小时']].map(([n,label])=>`<option value="${n}" ${(minutes===null?n==='all':String(minutes)===n)?'selected':''}>${label}</option>`).join('')}</select></label><label>同单位比较<select name="compare"><option value="">不比较</option>${options(d.devices.filter(x=>x.id!==deviceId&&d.history.some(h=>h.deviceId===x.id&&h.tagId===tagId&&h.unit===selected?.unit)),compare,x=>x.name)}</select></label><button>查看</button></form><p class="muted">样本末时刻：${end===null?'无样本':stamp(end)}。固定教学样本，页面刷新时间不是采样时间。</p>`;
 for(const h of sets){const samples=[...h.samples].sort((a,b)=>a.time-b.time).filter(s=>minutes===null||(s.time>=end-minutes*60000&&s.time<=end));html+=historySection(h,samples)}
 if(!sets.length)html+='<p class="empty">这个点位没有历史样本，请重新选择设备或点位。</p>';
 return html;
}
function alarmPage(){return heading('原始报警 · 只读','公开教学样本，只查看原始内容，不会确认、恢复或关闭报警，也不会发送通知。')+`<section class="panel"><div class="toolbar"><label>搜索原始报警<input id="alarm-search" placeholder="编号、设备、内容、状态或等级"></label><button id="alarm-clear">清空搜索</button></div><div id="alarm-table"></div><div class="action-row"><button id="alarm-prev">上一页</button><span id="alarm-pages" role="status"></span><button id="alarm-next">下一页</button></div></section>`}
function ownerPage(d,params,mode){return heading('设备责任登记',mode)+table(['设备','当前负责人','登记说明','版本','操作'],d.devices.map(x=>{const o=owners.find(o=>o.deviceId===x.id);return row([esc(x.name)+' · '+esc(x.id),esc(o?.username||'尚未登记'),esc(o?.note||'—'),String(o?.version||0),ds.user.role==='ADMIN'?`<form data-owner="${esc(x.id)}"><select name="username" aria-label="${esc(x.name)}负责人"><option value="manager">manager 管理人员</option></select><input name="note" aria-label="${esc(x.name)}登记说明" placeholder="填写登记说明" required maxlength="500"><button>保存责任</button></form>`:'只读'],`id="owner-${esc(x.id)}" tabindex="-1" ${params.get('deviceId')===x.id?'class="selected-row"':''}`)}))}
function casesPage(d,mode){let html=heading('演练事件',mode+' 这是本地演练，不会改变设备本身。')+(ds.user.role==='ADMIN'?`<form id="create-case" class="panel toolbar"><label>设备<select name="deviceId">${options(d.devices,'d01',x=>x.name)}</select></label><label>演练说明<input name="message" value="教学演练：检查温度样本" required maxlength="500"></label><button class="primary">创建演练</button></form>`:'')+caseRows.map(c=>{const can=ds.user.role==='ADMIN'||(ds.user.role==='MANAGER'&&c.assignee===ds.user.username);return `<section class="panel" data-case="${esc(c.id)}"><h3>${esc(deviceName(c.deviceId))} · ${esc(stateNames[c.state]||c.state)} <span class="badge">v${c.version}</span></h3><p>事件编号：${esc(c.id)} · 设备：${esc(c.deviceId)}</p><p>${esc(c.message)}</p><p>负责人：${esc(c.assignee||'待分派')} · 来源：${c.sourceState==='RECOVERED'?'模拟已恢复':'模拟未恢复'} · 核实：${c.verified?'已通过':'待核实'}</p><p>处置：${esc(c.note||'尚未记录')}　关闭结论：${esc(c.conclusion||'尚未关闭')}</p>${can&&c.state!=='CLOSED'?`<label>本次记录／关闭结论<input data-note aria-label="本次记录或关闭结论" maxlength="500"></label><div class="action-row">${[['assign','分派给 manager'],['start','开始处理'],['note','保存处置记录'],['recover','模拟来源恢复'],['verify','核实恢复'],['close','关闭事件']].filter(([a])=>ds.user.role==='ADMIN'||!['assign','recover'].includes(a)).map(([a,n])=>`<button data-action="${a}">${n}</button>`).join('')}</div>`:'<p class="muted">当前记录只读</p>'}<details><summary>查看时间线</summary><ol class="timeline">${(c.timeline||[]).map(t=>`<li>${esc(t.action)} ${esc(t.username||t.actor||'')} ${esc(t.note||'')} ${stamp(t.time)}</li>`).join('')}</ol></details></section>`}).join('');if(!caseRows.length)html+='<p class="empty">还没有演练事件。用管理员创建第一条。</p>';return html}
async function adminPage(mode){const integration=await ds.getIntegration(),audits=ds.user.role==='ADMIN'?await ds.getAudit():[];return heading('角色、审计与接入',mode)+(ds.mode==='mock'?`<section class="panel"><h3>浏览器角色演示</h3><p>切换只用于练习；正式登录和权限在后端章节实现。顶部也可以切换演示身份。</p><label>演示角色<select id="demo-role">${roleOptions()}</select></label></section>`:'')+`<section class="panel"><h3>谁能做什么</h3><p>管理员登记空间和责任、创建分派和恢复演练来源；处理人处置分派给自己的事件；查看者只查看。</p><h3>接入状态</h3><p>来源：${esc(integration.source)} · 模拟数据：${integration.simulated?'是':'否'} · 设备控制：${integration.controlEnabled?'开启':'关闭'} · 外部通知：${integration.notificationsEnabled?'开启':'关闭'}</p></section><h3>${ds.mode==='mock'?'演示操作记录':'操作记录'}</h3>`+(ds.mode==='mock'?'<p class="muted">浏览器演示，正式审计在后端实现。</p>':'')+(ds.user.role==='ADMIN'?table(['动作','人员','对象','说明','时间'],audits.map(a=>row([esc(a.action),esc(a.username||a.actor),esc(a.target||''),esc(a.detail||a.note||''),stamp(a.time)]))):'<p>只有管理员可以查看审计。</p>')}
async function render(){
 const seq=++generation;detailSequence++;shell();const main=$('#main'),old=lastSnapshot;$('#mode').value=ds.mode;
 if(ds.mode==='api'&&!ds.user){lastSnapshot='';main.innerHTML=login();return}
 main.innerHTML='<p role="status">正在读取数据…</p>';
 try{
  const d=await ds.getOverview();if(seq!==generation)return;const {page,params}=route();
  if(page==='devices')d.devices=await ds.getDevices();if(page==='spaces')d.spaces=await ds.getSpaces();if(seq!==generation)return;viewData=d;
  const mode=ds.mode==='mock'?'浏览器演示：修改仅保存在这台浏览器。':'后端已连接：业务数据由本地 MySQL 保存。';let html='';
  if(page==='dashboard')html=dashboard(d,mode);
  if(page==='devices')html=devicePage(d,params,mode);
  if(page==='spaces')html=spacePage(d,params,mode);
  if(page==='energy')html=energyPage(d,params);
  if(page==='history')html=historyPage(d,params);
  if(page==='alarms')html=alarmPage();
  if(page==='owners'){owners=await ds.getOwners();html=ownerPage(d,params,mode)}
  if(page==='cases'){caseRows=await ds.getCases();html=casesPage(d,mode)}
  if(page==='admin')html=await adminPage(mode);
  if(seq!==generation)return;main.innerHTML=html;shell();
  if(page==='devices')renderDevices(params);if(page==='alarms')renderAlarms();
  if(page==='spaces'&&params.get('spaceId'))document.getElementById('space-'+params.get('spaceId'))?.scrollIntoView({block:'nearest'});
  if(page==='owners'&&params.get('deviceId'))document.getElementById('owner-'+params.get('deviceId'))?.scrollIntoView({block:'nearest'});
  lastSnapshot=main.innerHTML;
  if(ds.mode==='mock')$('#demo-role')?.addEventListener('change',e=>{ds.setDemoRole(e.target.value);clearViewState();render()});
 }catch(e){
  if(seq!==generation)return;
  if(e.status===401){clearViewState();main.innerHTML=login();shell();notify('登录已过期，请重新登录。')}
  else if(e.status===403){lastSnapshot='';main.innerHTML=`<h2>没有操作权限</h2><p class="error">${esc(e.message)}</p>`}
  else main.innerHTML=`<h2>这次读取没有成功</h2><p class="error">${esc(e.message)}</p><button id="retry">重新读取</button><p>未加载的数据不计为 0。服务恢复后再试。</p>${old&&!old.includes('正在读取数据')?`<section class="old-snapshot" inert>${old}</section>`:''}`;
 }
}
function chart(samples,unit){
 const vals=samples.filter(x=>x.value!==null).map(x=>x.value);if(!vals.length)return '<p>这段时间暂无有效样本</p>';
 const max=Math.max(...vals,1),min=Math.min(...vals,0),first=samples[0].time,last=samples.at(-1).time;
 const x=i=>35+(last===first?310:(samples[i].time-first)/(last-first)*620),y=v=>145-(v-min)/(max-min||1)*120;let out='',prev=null;
 samples.forEach((s,i)=>{if(s.value===null){prev=null;return}if(prev!==null)out+=`<line x1="${x(prev)}" y1="${y(samples[prev].value)}" x2="${x(i)}" y2="${y(s.value)}" stroke="#19634a" stroke-width="2"/>`;out+=`<circle cx="${x(i)}" cy="${y(s.value)}" r="4" fill="#19634a"><title>${esc(stamp(s.time))} · ${esc(s.value)} ${esc(unit)}</title></circle>`;prev=i});
 return `<svg class="chart" viewBox="0 0 690 195" role="img" aria-label="${esc(unit)}历史曲线，缺失位置断开。详细数值见下表。"><text x="5" y="20" font-size="12">${esc(max)} ${esc(unit)}</text><text x="5" y="160" font-size="12">${esc(min)}</text>${out}<text x="35" y="185" font-size="10">${esc(stamp(first))}</text><text x="655" y="185" font-size="10" text-anchor="end">${esc(stamp(last))}</text></svg>`;
}
function renderDevices(params){
 const filter=()=>{
  const n=$('#filter-name').value.trim().toLocaleLowerCase(),sp=$('#filter-space').value,on=$('#filter-online').value,category=$('#filter-category').value;
  const list=viewData.devices.filter(d=>(!n||d.name.toLocaleLowerCase().includes(n)||d.id.toLocaleLowerCase().includes(n))&&(!sp||d.spaceId===sp)&&(!on||String(d.online)===on)&&(!category||d.category===category));
  $('#devices-table').innerHTML=`<p>当前显示 ${list.length} 台 / 全部 ${viewData.devices.length} 台</p>`+(list.length?table(['设备','位置','类别','在线情况','操作'],list.map(d=>row([esc(d.name)+' <small>'+esc(d.id)+'</small>',esc(spaceName(d.spaceId)),esc(categories[d.category]||d.category),onlineLabel(d.online),`<button data-device="${esc(d.id)}">查看详情</button>`]))):'<p class="empty">没有符合条件的设备。</p>');
  lastSnapshot=$('#main').innerHTML;
 };
 ['#filter-name','#filter-space','#filter-online','#filter-category'].forEach(id=>$(id).addEventListener('input',filter));
 $('#clear-filters').addEventListener('click',()=>{['#filter-name','#filter-space','#filter-online','#filter-category'].forEach(id=>$(id).value='');filter()});
 filter();if(params.get('deviceId'))showDetail(params.get('deviceId'));
}
async function showDetail(id){
 const d=viewData.devices.find(x=>x.id===id);if(!d)return;const seq=++detailSequence,renderGeneration=generation;let currentOwner,ownerError='';
 try{currentOwner=(await ds.getOwners()).find(x=>x.deviceId===id)}catch(e){if(e.status===401){render();return}ownerError=e.message}
 if(seq!==detailSequence||renderGeneration!==generation||route().page!=='devices'||!$('#detail'))return;
 $('#detail').innerHTML=`<section class="panel"><div class="detail-heading"><h3>${esc(d.name)} · ${esc(d.id)}</h3><button id="close-detail">收起详情</button></div><p>${esc(categories[d.category]||d.category)} · ${onlineLabel(d.online)} · ${esc(spaceName(d.spaceId))}</p><p>责任人：${ownerError?'读取失败，请重试查看详情':esc(currentOwner?.username||'尚未登记')}</p>${ownerError?`<p class="error">${esc(ownerError)}</p>`:`<p>登记备注：${esc(currentOwner?.note||'尚未登记')}</p>`}${table(['指标','原始值','质量','样本时间','操作'],viewData.points.filter(p=>p.deviceId===id).map(p=>row([esc(pointNames[p.tagId]||p.tagId)+' ('+esc(p.tagId)+')',p.value===null?'缺失':esc(p.value)+' '+esc(p.unit),esc(quality[p.quality]||p.quality),stamp(p.time),link('history','看历史',query({deviceId:id,tagId:p.tagId}))])))}<div class="action-row">${link('owners','查看设备责任',query({deviceId:id}))}${link('spaces','查看所在空间',query({spaceId:d.spaceId}))}</div></section>`;
 lastSnapshot=$('#main').innerHTML;
}
function renderAlarms(){
 let page=1;const size=5;
 const update=()=>{
  const text=$('#alarm-search').value.trim().toLocaleLowerCase();
  const matches=viewData.alarms.filter(a=>[a.id,a.deviceId,deviceName(a.deviceId),a.message,a.status,a.level].some(value=>String(value??'').toLocaleLowerCase().includes(text)));
  const pages=Math.max(1,Math.ceil(matches.length/size));page=Math.min(page,pages);
  $('#alarm-table').innerHTML=matches.length?table(['报警编号','设备','内容','原始状态','级别','时间','查看'],matches.slice((page-1)*size,page*size).map(a=>row([esc(a.id),esc(deviceName(a.deviceId))+' · '+esc(a.deviceId),esc(a.message),esc(a.status),esc(a.level),stamp(a.time),link('devices','查看设备',query({deviceId:a.deviceId}))]))):'<p class="empty">没有符合条件的原始报警。</p>';
  $('#alarm-pages').textContent=`第 ${page} / ${pages} 页 · 共 ${matches.length} 条 · 每页 ${size} 条`;
  $('#alarm-prev').disabled=page===1;$('#alarm-next').disabled=page===pages;lastSnapshot=$('#main').innerHTML;
 };
 $('#alarm-search').addEventListener('input',()=>{page=1;update()});$('#alarm-clear').addEventListener('click',()=>{$('#alarm-search').value='';page=1;update()});
 $('#alarm-prev').addEventListener('click',()=>{page--;update()});$('#alarm-next').addEventListener('click',()=>{page++;update()});update();
}
function compareEnergy(form){
 const tagId=$('#energy-tag').value,unit=tagId==='voltage'?'V':'kW',ids=new FormData(form).getAll('compareDevice');
 if(ids.length<1||ids.length>4){notify('请选择 1 至 4 台能源设备。');return}
 const devices=ids.map(id=>viewData.devices.find(d=>d.id===id&&d.category==='energy'));
 if(devices.some(d=>!d)){notify('请只选择本页的能源设备。');return}
 $('#energy-comparison').innerHTML=devices.map(d=>{const history=viewData.history.find(h=>h.deviceId===d.id&&h.tagId===tagId&&h.unit===unit);return history?historySection(history,[...history.samples].sort((a,b)=>a.time-b.time)):`<section class="panel"><h3>${esc(d.name)} · ${esc(d.id)}</h3><p class="warning">没有历史样本；其他设备的结果继续保留。</p></section>`}).join('');
 lastSnapshot=$('#main').innerHTML;
}
function inputKey(input){const owner=input.closest('[data-owner]')?.dataset.owner,space=input.closest('[data-space]')?.dataset.space,event=input.closest('[data-case]')?.dataset.case;return [owner||'',space||'',event||'',input.form?.id||'',input.id||input.name||(input.hasAttribute('data-note')?'case-note':'')].join('|')}
function captureDrafts(){return [...document.querySelectorAll('#main input:not([type=password]),#main textarea')].filter(x=>x.form?.id!=='login'&&x.type!=='checkbox').map(x=>({key:inputKey(x),value:x.value}))}
function restoreDrafts(drafts){const current=[...document.querySelectorAll('#main input:not([type=password]),#main textarea')];let unmatched=[];for(const draft of drafts){const input=current.find(x=>inputKey(x)===draft.key);if(input)input.value=draft.value;else if(draft.value.trim())unmatched.push(draft.value)}if(unmatched.length){const box=document.createElement('section');box.className='panel';const title=document.createElement('h3');title.textContent='这次输入已保留，请根据最新状态重新决定';box.append(title);for(const value of unmatched){const field=document.createElement('textarea');field.readOnly=true;field.value=value;box.append(field)}$('#main').append(box)}}
async function mutate(fn,message){
 const drafts=captureDrafts();
 try{await fn();notify(message||(ds.mode==='mock'?'已保存到这台浏览器。':'已保存，正在读回后端结果。'));await render()}
 catch(e){if(e.status===409){await render();if(ds.user){restoreDrafts(drafts);notify(e.message+' 已读回最新记录，输入已保留；请重新决定，没有自动重试。')}}else if(e.status===401){clearViewState();await render();notify('请重新登录。')}else {if(ds.mode==='api'&&!ds.user)await render();notify(e.message)}}
}
$('#mode').addEventListener('change',e=>{ds.setMode(e.target.value);clearViewState();render()});
$('#logout').addEventListener('click',()=>{clearViewState();mutate(()=>ds.logout(),'已退出登录。')});
$('#main').addEventListener('change',e=>{if(e.target.id==='energy-tag')location.hash='energy?tagId='+e.target.value;if(e.target.name==='deviceId'&&e.target.form?.id==='history-filter')location.hash='history?deviceId='+encodeURIComponent(e.target.value)});
$('#main').addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.id==='retry')render();if(b.dataset.device)showDetail(b.dataset.device);
 if(b.id==='close-detail'){detailSequence++;$('#detail').innerHTML='';lastSnapshot=$('#main').innerHTML}
 if(b.dataset.action){const p=b.closest('[data-case]'),c=caseRows.find(x=>String(x.id)===p.dataset.case);mutate(()=>ds.caseAction(c.id,{action:b.dataset.action,expectedVersion:c.version,note:p.querySelector('[data-note]').value,username:'manager'}))}
});
$('#main').addEventListener('submit',e=>{
 e.preventDefault();const f=e.target,data=Object.fromEntries(new FormData(f));
 if(f.id==='login'){clearViewState();mutate(()=>ds.login(data.username,data.password),'登录成功。');f.reset()}
 if(f.dataset.space)mutate(()=>ds.saveSpace(f.dataset.space,data));
 if(f.dataset.owner)mutate(()=>ds.saveOwner(f.dataset.owner,{...data,expectedVersion:owners.find(x=>x.deviceId===f.dataset.owner)?.version||0}));
 if(f.id==='create-case')mutate(()=>ds.createCase(data));
 if(f.id==='history-filter')location.hash='history?'+new URLSearchParams(data);
 if(f.id==='energy-compare')compareEnergy(f);
});
window.addEventListener('hashchange',render);
$('#check-health').addEventListener('click',async()=>{$('#health').textContent='正在检查';try{$('#health').textContent=await ds.checkHealth()?'后端已连接':'暂时连不上后端'}catch{$('#health').textContent='暂时连不上后端'}});
$('#refresh').addEventListener('click',render);
render();
