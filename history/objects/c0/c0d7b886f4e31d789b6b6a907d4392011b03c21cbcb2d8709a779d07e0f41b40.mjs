// Author rehearsal of the student application's normal HTTP interface only.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {courseDir,launchBrowser,writeJson,dependency} from './runtime.mjs';
const app=process.env.COURSE_REHEARSAL_APP||path.join(courseDir,'.runtime/round9-lab/student/campus-ai-lab/app');
assert(app.startsWith(path.join(courseDir,'.runtime/round9-lab/')));
const out=path.join(courseDir,'walkthroughs/qa/round9',process.env.COURSE_REHEARSAL_APP?'receiver-http':'http');fs.mkdirSync(out,{recursive:true});
const state=path.join(app,'.private/rehearsal-browser.json');
const phase=process.argv[2];const browser=await launchBrowser();
const context=await browser.newContext({viewport:{width:1440,height:1000},...(phase==='restart'?{storageState:state}:{})});
const page=await context.newPage();const checks=[];
async function login(name='admin'){
 const a=JSON.parse(fs.readFileSync(path.join(app,'.private/accounts.json'),'utf8')).accounts.find(a=>a.username===name);
 await page.locator('#username').fill(name);await page.locator('#password').fill(a.password);
 await page.getByRole('button',{name:'登录并查看设备'}).click();
 await page.getByRole('button',{name:'退出 / 切换身份'}).waitFor();
}
const pass=(name,detail)=>checks.push({name,detail,passed:true});
const get=async url=>{const r=await context.request.get('http://127.0.0.1:5178/api/campus'+url);assert.equal(r.status(),200);return (await r.json()).data};
async function switchUser(name,route){await page.getByRole('button',{name:'退出 / 切换身份'}).click();await login(name);await page.goto('http://127.0.0.1:5178/#'+route)}
async function clickWrite(id,url){const done=page.waitForResponse(r=>r.url().endsWith(url)&&r.request().method()!=='GET');await page.getByTestId(id).click();const r=await done;assert.equal(r.status(),200);return (await r.json()).data}
try{
 if(phase==='first'){
  await page.goto('http://127.0.0.1:5178/#first-read');await login();
  await page.waitForFunction(()=>document.body.innerText.includes('teaching_energy_01'));
  const data=await (await context.request.get('http://127.0.0.1:5178/api/campus/devices')).json();
  assert.equal(data.data.items.length,2);assert.equal(data.code,0);
  await page.screenshot({path:path.join(out,'04-first-chain.png')});
  await context.storageState({path:state});fs.chmodSync(state,0o600);
  pass('04 fresh tutorial A/B code plus UI login',{devices:2,unknownVisible:(await page.locator('body').innerText()).includes('未知')});
 }else if(phase==='restart'){
  const r=await context.request.get('http://127.0.0.1:5178/api/campus/devices');assert.equal(r.status(),401);
  await page.goto('http://127.0.0.1:5178/#first-read');await login();
  await page.waitForFunction(()=>document.body.innerText.includes('teaching_energy_01'));
  pass('04 backend restart expires session; same account relogin restores devices',{beforeLogin:401,afterLogin:200});
 }else if(phase==='locations'){
  await page.goto('http://127.0.0.1:5178/#locations');await login();
  await page.getByRole('heading',{name:'空间归属',exact:true}).waitFor();
  const existing=await get('/locations');if(!existing.campuses.some(c=>c.name==='G01教学园区')){await page.getByLabel('校区名称').fill('G01教学园区');await page.getByRole('button',{name:'保存校区',exact:true}).click();}
  await page.getByLabel('所属校区').selectOption({label:'G01教学园区'});
  if(!existing.buildings.some(b=>b.name==='G01实验楼')){await page.getByLabel('楼栋名称').fill('G01实验楼');await page.getByRole('button',{name:'保存楼栋',exact:true}).click();}
  await page.getByRole('combobox',{name:/^空间/}).selectOption('teaching_space_01');
  await page.getByRole('combobox',{name:/^楼栋/}).selectOption({label:'G01教学园区 / G01实验楼'});
  await page.getByLabel('楼层（可选）').fill('1');await page.getByRole('button',{name:'保存绑定',exact:true}).click();
  await page.getByRole('button',{name:'刷新映射',exact:true}).click();
  const r=await (await context.request.get('http://127.0.0.1:5178/api/campus/locations')).json();
  const binding=r.data.bindings.find(x=>x.spaceId==='teaching_space_01');assert(binding);
  await page.screenshot({path:path.join(out,'05-location-binding.png')});
  pass('05 create campus/building and persist binding through UI',{campus:'G01教学园区',building:'G01实验楼',floor:binding.floor});
 }else if(phase==='console'){
  await page.goto('http://127.0.0.1:5178/#locations');await login();
  const {Marked}=await dependency('marked');
  const file=fs.readdirSync(path.join(courseDir,'walkthroughs')).find(x=>x.startsWith('05-')&&x.endsWith('.md'));
  const blocks=new Marked().lexer(fs.readFileSync(path.join(courseDir,'walkthroughs',file),'utf8')).filter(x=>x.type==='code'&&x.lang==='javascript').map(x=>x.text);
  assert.equal(blocks.length,4);
  async function execute(code){return page.evaluate(async({definition,code})=>new Function('return (async()=>{'+definition+'; return '+code+'})()')(),{definition:blocks[0],code})}
  const before=await get('/locations');
  assert.equal((await execute(blocks[1])).status,404);assert.equal((await execute(blocks[2])).status,404);
  await switchUser('viewer','locations');assert.equal((await execute(blocks[3])).status,403);
  await switchUser('admin','locations');assert.equal((await execute(blocks[3])).status,200);
  const after=await get('/locations');assert.deepEqual(after.bindings,before.bindings);
  pass('05 exact tutorial Console scripts',{missingBuilding:404,missingSpace:404,viewer:403,admin:200,bindingUnchanged:true});
 }else if(phase==='catalog'){
  await page.goto('http://127.0.0.1:5178/#devices');await login();
  const rows=page.locator('tbody tr[data-testid^="device-"]');await rows.first().waitFor();assert.equal(await rows.count(),16);
  await page.getByRole('combobox',{name:/^空间/}).selectOption('teaching_space_01');assert.equal(await rows.count(),4);
  await page.getByRole('combobox',{name:/^设备类型/}).selectOption('environment');assert.equal(await rows.count(),1);
  await page.getByTestId('online-filter').selectOption('unknown');assert.equal(await rows.count(),0);
  await page.getByTestId('clear-device-filters').click();assert.equal(await rows.count(),16);
  await page.getByTestId('open-teaching_env_01').click();await page.reload();await page.getByTestId('device-detail').waitFor();
  assert((await page.getByTestId('device-detail').innerText()).includes('teaching_env_01'));
  pass('06 filters and detail reload',{counts:[16,4,1,0,16],detailStable:true});
  await page.goto('http://127.0.0.1:5178/#history');await page.getByTestId('history-device').selectOption('teaching_energy_01');
  await page.getByTestId('history-tag').selectOption('power');await page.getByLabel('教学时钟之前').selectOption('15');
  const waiting=page.waitForResponse(r=>r.url().includes('/api/campus/history?')&&r.url().includes('tagId=power'));
  await page.getByRole('button',{name:'查询样本'}).click();const history=(await (await waiting).json()).data;
  assert.deepEqual(history.samples.map(s=>s.value),[1.2,null,0,1.8]);await page.screenshot({path:path.join(out,'07-history.png')});
  pass('07 actual history form query',{values:history.samples.map(s=>s.value)});
 }else if(phase==='workflow'){
  await page.goto('http://127.0.0.1:5178/#cases');await login();
  await page.getByTestId('demo-scenario').selectOption('temperature-patrol');
  let e=await clickWrite('trigger-demo','/demo-alarm-scenarios/temperature-patrol/trigger');
  await page.getByTestId('case-note').fill('第09段：交给管理人员A处理本地演练');await page.getByTestId('case-assignee').selectOption('manager-a');
  e=await clickWrite('assign-case',`/alarm-cases/${e.id}/assign`);
  await switchUser('manager-a','cases');await page.getByTestId('case-'+e.id).click();await page.getByTestId('case-note').fill('第09段：开始检查本地演练');
  e=await clickWrite('start-case',`/alarm-cases/${e.id}/start`);
  await page.getByTestId('case-note').fill('第09段：已完成模拟巡查，未操作真实设备');e=await clickWrite('note-case',`/alarm-cases/${e.id}/notes`);
  await switchUser('admin','cases');await page.getByTestId('case-'+e.id).click();e=await clickWrite('recover-case',`/demo-alarm-events/${e.id}/recover`);
  await switchUser('manager-a','cases');await page.getByTestId('case-'+e.id).click();e=await clickWrite('verify-case',`/alarm-cases/${e.id}/verify-recovery`);
  await page.getByTestId('case-disposition').fill('本地演练已恢复并核实，本次未操作真实设备');e=await clickWrite('close-case',`/alarm-cases/${e.id}/close`);
  await page.reload();await page.getByTestId('case-'+e.id).click();await page.getByText('事件已关闭，记录不可再修改。',{exact:true}).waitFor();
  assert.equal((await get('/alarm-cases/'+e.id)).state,'CLOSED');await page.screenshot({path:path.join(out,'09-closed.png')});
  pass('09 exact UI identity switching and persisted lifecycle',{id:e.id,state:e.state,version:e.version,actions:e.timeline.map(t=>t.action)});
  await switchUser('admin','owners');await page.getByTestId('owner-teaching_env_01').click();
  await page.getByTestId('owner-assignee').selectOption('manager-a');await page.getByTestId('owner-note').fill('第10段第一标签：交给A');
  const p2=await context.newPage();await p2.goto('http://127.0.0.1:5178/#owners');await p2.getByTestId('owner-teaching_env_01').click();
  await p2.getByTestId('owner-assignee').selectOption('manager-b');await p2.getByTestId('owner-note').fill('第10段第二标签：我仍准备交给B');
  const before=await get('/device-owners/teaching_env_01');await clickWrite('save-owner','/device-owners/teaching_env_01');
  const pending=p2.waitForResponse(r=>r.url().endsWith('/device-owners/teaching_env_01')&&r.request().method()==='PUT');await p2.getByTestId('save-owner').click();assert.equal((await pending).status(),409);
  await p2.getByRole('button',{name:'已核对最新责任'}).waitFor();assert.equal(await p2.getByTestId('owner-note').inputValue(),'第10段第二标签：我仍准备交给B');assert.equal(await p2.getByTestId('owner-assignee').inputValue(),'manager-b');
  await p2.getByRole('button',{name:'已核对最新责任'}).click();const after=await get('/device-owners/teaching_env_01');assert.equal(after.version,before.version+1);assert.equal(after.ownerUid,'manager-a');
  await p2.screenshot({path:path.join(out,'10-conflict-after-ack.png')});await p2.close();pass('10 two tabs stale version preserves input without replay',{status:409,versionBefore:before.version,versionAfter:after.version,ownerUid:after.ownerUid});
 }else if(phase==='seed'){
  await page.goto('http://127.0.0.1:5178/#cases');await login();
  assert.equal((await get('/alarm-cases?limit=20&skip=0')).total,0);
  assert.equal((await get('/device-owners/teaching_env_01')).ownerUid,null);
  const token=(await (await context.request.get('http://127.0.0.1:5178/api/auth/csrf')).json()).data;
  const post=async(url,data)=>{const r=await context.request.post('http://127.0.0.1:5178/api/campus'+url,{data,headers:{[token.headerName]:token.token}});assert.equal(r.status(),200);return (await r.json()).data};
  const ids=[];for(let i=0;i<14;i++){let e=await post('/demo-alarm-scenarios/temperature-patrol/trigger',{});if(i<2)e=await post('/alarm-cases/'+e.id+'/assign',{assigneeUid:'manager-a',note:'教师分页数据',expectedVersion:e.version});ids.push(e.id)}
  const counts={};for(const s of ['', 'NEW','ASSIGNED','IN_PROGRESS'])counts[s||'ALL']=(await get('/alarm-cases?limit=20&skip=0'+(s?'&state='+s:''))).total;
  assert.deepEqual(counts,{ALL:14,NEW:12,ASSIGNED:2,IN_PROGRESS:0});pass('teacher-only independent pagination schema seeded and read back',{counts,ids});
 }else if(phase==='pagination'){
  await page.goto('http://127.0.0.1:5178/#cases');await login();
  await page.getByRole('combobox',{name:/^每页/}).selectOption('10');
  async function query(action,state,skip,total,length){const pending=page.waitForResponse(r=>{if(!r.url().includes('/api/campus/alarm-cases?'))return false;const u=new URL(r.url());return u.searchParams.get('skip')===String(skip)&&(u.searchParams.get('state')||'')===state});await action();const r=await pending;const u=new URL(r.url());const data=(await r.json()).data;assert.equal(u.searchParams.get('state')||'',state);assert.equal(u.searchParams.get('skip'),String(skip));assert.equal(data.total,total);assert.equal(data.items.length,length);pass('12 pagination '+(state||'ALL')+' skip='+skip,{total,items:length,query:u.search});}
  await query(()=>page.getByRole('button',{name:'下一页',exact:true}).click(),'',10,14,4);
  await query(()=>page.getByTestId('case-state').selectOption('NEW'),'NEW',0,12,10);
  await query(()=>page.getByTestId('case-state').selectOption('IN_PROGRESS'),'IN_PROGRESS',0,0,0);
  await page.getByText('当前筛选没有事件。',{exact:true}).waitFor();
  await query(()=>page.getByTestId('case-state').selectOption(''),'',0,14,10);
  await query(()=>page.goto('http://127.0.0.1:5178/#cases?state=malformed'),'',0,14,10);
  await page.screenshot({path:path.join(out,'12-pagination.png')});
 }else if(phase==='readback'){
  await page.goto('http://127.0.0.1:5178/#locations');await login();const binding=(await get('/locations')).bindings.find(b=>b.spaceId==='teaching_space_01');assert(binding);assert.equal(binding.floor,'2');pass('05 restart persistence after API supplementary check set floor 2',{floor:binding.floor,bindingId:binding.buildingId});
 }else if(phase==='viewer'){
  await page.goto('http://127.0.0.1:5178/#locations');await login('viewer');await page.getByRole('heading',{name:'空间归属',exact:true}).waitFor();
  assert.equal(await page.getByRole('button',{name:'保存校区',exact:true}).count(),0);const before=await get('/locations');
  const token=(await (await context.request.get('http://127.0.0.1:5178/api/auth/csrf')).json()).data;
  const r=await context.request.post('http://127.0.0.1:5178/api/campus/locations/campuses',{data:{name:'接手副本只读身份对照'},headers:{[token.headerName]:token.token}});assert.equal(r.status(),403);assert.deepEqual(await get('/locations'),before);
  pass('receiver viewer UI hides write controls and server independently refuses valid write',{status:403,unchanged:true});
 }else throw Error('Unknown phase '+phase);
 writeJson(path.join(out,phase+'.json'),{status:'PASS',at:new Date().toISOString(),scope:'Student app HTTP browser only; offline tutorial browser not accessed',checks});
 console.log(JSON.stringify({phase,status:'PASS',checks:checks.length}));
}catch(e){writeJson(path.join(out,phase+'.json'),{status:'FAIL',error:e.message,pageText:await page.locator('body').innerText(),checks});throw e}finally{await browser.close()}
