import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { courseDir, launchBrowser } from '../../../../tools/runtime.mjs'
const project = path.join(courseDir, 'resources/campus-ai-course')
const output = path.join(project, 'evidence/full-browser')
fs.mkdirSync(output, {recursive:true})
const latestReport=path.join(output,'verification.json')
if(fs.existsSync(latestReport)){
  const previous=JSON.parse(fs.readFileSync(latestReport,'utf8'))
  const archived=path.join(output,`verification-${String(previous.at).replaceAll(':','-')}.json`)
  if(!fs.existsSync(archived))fs.copyFileSync(latestReport,archived)
}
// 凭据只在内存用于本机登录，不记录密码、cookie、CSRF或请求头。
const accounts = JSON.parse(fs.readFileSync(path.join(project,'.private/accounts.json'),'utf8')).accounts
const account = name => { const value=accounts.find(a=>a.username===name);assert.ok(value,`missing teaching identity ${name}`);return value }
const baseURL='http://127.0.0.1:5178'
const browser=await launchBrowser()
const record={at:new Date().toISOString(),platform:`${process.platform}/${process.arch}`,browser:browser.version(),scope:'真实回环前后端、教学隔离MySQL与Chromium；无AIRIOT/外部控制；390px为浏览器视口而非手机/Windows真机',checks:[],status:'RUNNING'}
const contexts=[]
const check=(name,details={})=>record.checks.push({name,passed:true,...details})
async function screen(page,name,fullPage=true){await page.screenshot({path:path.join(output,`${name}.png`),fullPage})}
async function noOverflow(page){assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'page horizontal overflow')}
async function freshContext(width=1440){const context=await browser.newContext({baseURL,viewport:{width,height:1000},timezoneId:'Asia/Shanghai'});contexts.push(context);return context}
async function loginPage(context,name){const page=await context.newPage();page.errors=[];page.on('pageerror',e=>page.errors.push(e.message));await page.goto('/');await page.getByLabel('教学账号',{exact:true}).fill(account(name).username);await page.getByLabel('密码',{exact:true}).fill(account(name).password);await page.getByRole('button',{name:'登录并查看设备'}).click();await page.getByTestId('device-page').waitFor();await page.waitForFunction(()=>document.querySelectorAll('[data-testid="device-page"] .data-table tbody tr').length===16);return page}
async function nav(page,name){await page.getByTestId(`nav-${name}`).click();if(name==='first-read')await page.locator('.device-table').waitFor();else await page.getByTestId(`${name==='devices'?'device':name}-page`).waitFor()}
async function api(context,method,url,body){const options={};if(body!==undefined)options.data=body;if(method!=='GET'){const csrf=(await (await context.request.get('/api/auth/csrf')).json()).data;options.headers={[csrf.headerName]:csrf.token}}const response=await context.request.fetch(`/api/campus/${url}`,{method,...options});const result=await response.json();assert.equal(response.status(),200,`${method} ${url}: HTTP ${response.status()}`);assert.equal(result.code,0,`${method} ${url}: ${result.message}`);return result.data}
async function waitCaseVersion(page,version){await page.waitForFunction(version=>document.querySelector('[data-testid="case-version"]')?.textContent?.includes(`v${version} ·`),version)}
async function chooseCase(page,id){await page.getByTestId(`case-${id}`).click();await page.waitForFunction(id=>document.querySelector('.case-detail')?.textContent?.includes(id),id)}
try{
  const adminContext=await freshContext(),admin=await loginPage(adminContext,'admin')
  await noOverflow(admin);await screen(admin,'desktop-devices',false)
  await admin.getByTestId('online-filter').selectOption('unknown');assert.ok(await admin.locator('.data-table tbody tr').count()>0)
  await admin.getByTestId('online-filter').selectOption('all')
  await admin.getByTestId('open-teaching_energy_01').click();await admin.getByTestId('device-detail').waitFor();await admin.reload();await admin.getByTestId('device-detail').waitFor();await admin.getByTestId('device-detail').getByText('电能监测器01（模拟）',{exact:true}).waitFor();await admin.getByRole('button',{name:'收起详情'}).click();await admin.getByTestId('device-search').fill('不存在的设备');await admin.getByTestId('clear-device-filters').click();assert.equal(await admin.locator('.data-table tbody tr').count(),16);check('管理员真实登录与16设备台账',{width:1440,deviceCount:16,horizontalOverflow:false})

  await nav(admin,'locations');await admin.locator('.data-table tbody tr').first().waitFor();assert.equal(await admin.locator('.data-table tbody tr').count(),4);await noOverflow(admin);await screen(admin,'desktop-locations')
  let overviewRequests=0;admin.on('request',r=>{if(r.url().endsWith('/api/campus/overview'))overviewRequests++});await nav(admin,'overview');await admin.waitForFunction(()=>document.querySelectorAll('[data-testid="overview-page"] .data-table tbody tr').length===28);await noOverflow(admin);await screen(admin,'desktop-overview')
  await admin.waitForResponse(r=>r.url().endsWith('/api/campus/overview')&&r.status()===200,{timeout:20000});const overviewReadsBeforeLeave=overviewRequests;check('真实空间和点值质量',{spaces:4,points:28,completedPollObserved:true})

  await nav(admin,'history');await admin.getByTestId('history-device').selectOption('teaching_energy_01');await admin.getByTestId('history-tag').selectOption('power');await admin.getByRole('button',{name:'查询样本'}).click();await admin.waitForFunction(()=>document.querySelector('.chart-panel h2')?.textContent?.includes('power'))
  await admin.locator('.history-chart canvas').waitFor();const values=await admin.locator('.data-table tbody tr td:nth-child(2)').allTextContents();assert.ok(values.some(v=>v.trim().startsWith('null')),'history missing null');assert.ok(values.some(v=>/^0\s/.test(v.trim())),'history missing zero');await noOverflow(admin);await screen(admin,'desktop-history',false)
  await new Promise(resolve=>setTimeout(resolve,16000));assert.equal(overviewRequests,overviewReadsBeforeLeave,'overview polled after leaving page');check('真实浏览器离开监测后停止轮询',{requestsBeforeLeave:overviewReadsBeforeLeave,requestsAfterLeave:overviewRequests});check('历史power真实样本与图表',{device:'teaching_energy_01',tag:'power',hasNull:true,hasZero:true,canvasRendered:true})

  await nav(admin,'owners');await admin.getByTestId('owner-teaching_env_01').click();await admin.getByTestId('owner-version').waitFor();await admin.getByTestId('owner-assignee').selectOption('manager-a');await admin.getByTestId('owner-note').fill('浏览器验收：后续温度巡检由管理人员甲负责');await admin.getByTestId('save-owner').click();await admin.getByText('责任登记已确认；已有事件的分派保持不变。',{exact:true}).waitFor();await noOverflow(admin);await screen(admin,'desktop-owners',false)
  check('管理员在真实页面登记责任并显示时间线',{deviceId:'teaching_env_01',owner:'manager-a'})

  await nav(admin,'cases');await admin.getByTestId('demo-scenario').selectOption('temperature-patrol');await admin.getByTestId('trigger-demo').click();await admin.getByText('已创建本地模拟事件。',{exact:true}).waitFor();await waitCaseVersion(admin,1)
  const started=await api(adminContext,'GET','alarm-cases?limit=1&skip=0');const created=started.items[0];assert.equal(created.assigneeUid,'manager-a');record.caseId=created.id
  await admin.getByTestId('case-note').fill('浏览器验收：开始现场核对');await admin.getByTestId('start-case').click();await waitCaseVersion(admin,2)
  await admin.getByTestId('case-note').fill('浏览器验收：温度点值与教室环境已核对');await admin.getByTestId('note-case').click();await waitCaseVersion(admin,3)
  // 同一会话另一个实际HTTP客户端抢先写入，页面仍持有v3，构造真实数据库版本冲突。
  await admin.getByTestId('case-note').fill('409之后必须保留的人工输入')
  const external=await api(adminContext,'POST',`alarm-cases/${created.id}/notes`,{expectedVersion:3,note:'并发客户端：在旧页面提交前新增记录'})
  assert.equal(external.version,4)
  await admin.getByTestId('note-case').click();await admin.getByTestId('case-conflict').waitFor();await admin.getByTestId('ack-case-conflict').waitFor();await waitCaseVersion(admin,4)
  assert.equal(await admin.getByTestId('case-note').inputValue(),'409之后必须保留的人工输入');assert.equal(await admin.getByTestId('note-case').isDisabled(),true)
  const afterConflict=await api(adminContext,'GET',`alarm-cases/${created.id}`);assert.equal(afterConflict.version,4);assert.ok(!afterConflict.timeline.some(t=>t.note==='409之后必须保留的人工输入'))
  await screen(admin,'desktop-case-conflict');await admin.getByTestId('ack-case-conflict').click();const afterAck=await api(adminContext,'GET',`alarm-cases/${created.id}`);assert.equal(afterAck.version,4)
  await admin.getByTestId('note-case').click();await waitCaseVersion(admin,5)
  await admin.getByTestId('recover-case').click();await waitCaseVersion(admin,6)
  await admin.getByTestId('verify-case').click();await waitCaseVersion(admin,7)
  await admin.getByTestId('case-disposition').fill('浏览器验收结论：已完成处理记录，演练源恢复，服务端核实通过，关闭本次模拟事件。');await admin.getByTestId('close-case').click();await waitCaseVersion(admin,8);await admin.getByText('事件已关闭，记录不可再修改。',{exact:true}).waitFor();await noOverflow(admin);await screen(admin,'desktop-case-closed');await screen(admin,'desktop-cases',false)
  const closed=await api(adminContext,'GET',`alarm-cases/${created.id}`);assert.equal(closed.state,'CLOSED');assert.equal(closed.sourceCheckOutcome,'PASS');assert.equal(closed.timeline.length,8)
  check('真实页面事件闭环和409',{caseId:created.id,finalVersion:8,closed:true,conflictVersion:4,inputPreserved:true,readbackConfirmed:true,noAutomaticReplay:true})

  // 再建一个分派给甲的事件，供真实身份边界测试；不修改或清理历史验收记录。
  const assigned=await api(adminContext,'POST','demo-alarm-scenarios/temperature-patrol/trigger',{})
  const managerA=await loginPage(await freshContext(),'manager-a');await nav(managerA,'cases');await chooseCase(managerA,assigned.id);assert.equal(await managerA.getByTestId('start-case').count(),1);await managerA.getByTestId('case-note').fill('管理人员甲：处理本人分派事件');await managerA.getByTestId('start-case').click();await waitCaseVersion(managerA,2);await managerA.getByTestId('case-note').fill('本人角色已完成可操作性验收');await managerA.getByTestId('note-case').click();await waitCaseVersion(managerA,3)
  const managerB=await loginPage(await freshContext(),'manager-b');await nav(managerB,'cases');await chooseCase(managerB,assigned.id);for(const action of ['start-case','note-case','verify-case','close-case','assign-case','recover-case'])assert.equal(await managerB.getByTestId(action).count(),0,`manager-b must not see ${action}`)
  check('真实角色边界：本人处理/他人只读',{assignedUid:'manager-a',managerAActed:true,managerBWriteControlsAbsent:true})

  await nav(admin,'integration');await admin.getByText('AIRIOT 配置与真实连通性尚未通过课程验收。',{exact:true}).waitFor();await noOverflow(admin);check('AIRIOT选做边界',{configurationNotVerified:true,controlDisabled:true});const mobileContext=await freshContext(390),mobile=await loginPage(mobileContext,'viewer');await noOverflow(mobile);await screen(mobile,'mobile-devices')
  await nav(mobile,'history');await mobile.getByTestId('history-device').selectOption('teaching_energy_01');await mobile.getByTestId('history-tag').selectOption('power');await mobile.getByRole('button',{name:'查询样本'}).click();await mobile.waitForFunction(()=>document.querySelector('.chart-panel h2')?.textContent?.includes('power'));await mobile.locator('.history-chart canvas').waitFor();await noOverflow(mobile);await screen(mobile,'mobile-history')
  await nav(mobile,'owners');await mobile.getByTestId('owner-teaching_env_01').click();await mobile.getByTestId('owner-version').waitFor();assert.equal(await mobile.getByTestId('save-owner').count(),0);await noOverflow(mobile);await screen(mobile,'mobile-owners')
  await nav(mobile,'cases');await chooseCase(mobile,created.id);for(const key of ['trigger-demo','assign-case','note-case','close-case','recover-case'])assert.equal(await mobile.getByTestId(key).count(),0);await noOverflow(mobile);await screen(mobile,'mobile-case-closed')
  await nav(mobile,'first-read');await mobile.locator('.device-table tbody tr').first().waitFor();assert.equal(await mobile.locator('.device-table tbody tr').count(),16);await noOverflow(mobile)
  // 真实浏览器请求阻断，核对错误与旧快照而非改源代码。
  await mobile.route('**/api/campus/devices',route=>route.abort('blockedbyclient'));await mobile.getByRole('button',{name:'重新读取'}).click();await mobile.getByText('本次更新失败，以下保留上次成功快照。',{exact:true}).waitFor();assert.equal(await mobile.locator('.device-table tbody tr').count(),16);await mobile.unroute('**/api/campus/devices');await mobile.getByRole('button',{name:'重新读取'}).click();await mobile.waitForFunction(()=>!document.querySelector('.notice.error'))
  check('390px与查看者/first-read兼容',{horizontalOverflow:false,devices:16,history:true,owners:true,closedCase:true,writeControlsAbsent:true,blockedRequestSnapshotRetained:true})
  for(const page of [admin,managerA,managerB,mobile]){assert.deepEqual(page.errors,[]);assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[]);assert.deepEqual(await page.evaluate(()=>Object.keys(sessionStorage)),[])}
  check('全部页面无未捕获JavaScript错误且无浏览器存储令牌',{pageErrors:[],storageKeysEmpty:true})
  record.status='PASS'
}catch(error){record.status='FAIL';record.failure=String(error.message);record.pageErrors=contexts.flatMap(context=>context.pages().flatMap(page=>page.errors??[]));throw error}finally{const report=JSON.stringify(record,null,2)+'\n';fs.writeFileSync(path.join(output,`verification-${record.at.replaceAll(':','-')}.json`),report);fs.writeFileSync(latestReport,report);for(const context of contexts)await context.close();await browser.close()}
console.log(`完整教学浏览器验证 ${record.status}，${record.checks.length} 组；未输出凭据。`)
