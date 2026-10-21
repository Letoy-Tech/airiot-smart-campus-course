import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { courseDir, launchBrowser, writeJson } from './runtime.mjs';
const app=path.join(courseDir,'.runtime/round9-lab/student/campus-ai-lab/app');
const output=path.join(courseDir,'walkthroughs/qa/round9/lab-browser');
fs.mkdirSync(output,{recursive:true});
const source=path.join(app,'frontend/src/api/campus.ts');
const original=fs.readFileSync(source,'utf8');
const account=JSON.parse(fs.readFileSync(path.join(app,'.private/accounts.json'),'utf8')).accounts.find(a=>a.username==='admin');
const browser=await launchBrowser();
const context=await browser.newContext({viewport:{width:1440,height:1000}});
const page=await context.newPage();const checks=[];
const pass=(name,detail)=>checks.push({name,passed:true,detail});
try{
  await page.goto('http://127.0.0.1:5178/#devices');
  await page.locator('#username').fill(account.username);await page.locator('#password').fill(account.password);
  await page.getByRole('button',{name:'登录并查看设备'}).click();
  await page.getByRole('button',{name:'刷新台账'}).waitFor();
  await page.waitForFunction(()=>document.body.innerText.includes('teaching_env_01'));
  await page.screenshot({path:path.join(output,'01-设备台账.png')});
  pass('actual UI login and device ledger','Own isolated teaching accounts; password absent from screenshots');
  for(const [route,title]of [['locations','空间归属'],['overview','校园监测'],['history','历史样本'],['cases','事件工作台']]){
    await page.goto('http://127.0.0.1:5178/#'+route);
    await page.getByRole('heading',{name:title,exact:true}).waitFor();
    await page.screenshot({path:path.join(output,route+'.png')});
    pass('page '+route,title);
  }
  assert(original.includes('if (response.code !== 0)'));
  fs.writeFileSync(source,original.replace('if (response.code !== 0)','if (response.code === 0)'));
  const before=spawnSync('npm',['--prefix','frontend','run','test:unit','--','--run','src/tests/http.test.ts'],{cwd:app,env:process.env,encoding:'utf8'});
  assert.notEqual(before.status,0);assert((before.stdout+before.stderr).includes('成功空数组仍保留后端观察时间'));
  await page.goto('about:blank');
  const response=page.waitForResponse(r=>r.url().endsWith('/api/campus/devices')).then(async r=>({status:r.status(),body:await r.json()}));
  await page.goto('http://127.0.0.1:5178/#devices');const {status,body}=await response;
  assert.equal(status,200);assert.equal(body.code,0);assert.equal(body.data.items.length,16);
  await page.getByText('设备读取未成功，请核对业务响应。',{exact:false}).first().waitFor();
  await page.screenshot({path:path.join(output,'02-成功回信与页面失败.png')});
  pass('chapter11 deliberate defect',{http:200,code:0,items:16,targetedTestExit:before.status,pageFailed:true});
  fs.writeFileSync(source,original);
  const after=spawnSync('npm',['--prefix','frontend','run','test:unit','--','--run','src/tests/http.test.ts'],{cwd:app,env:process.env,encoding:'utf8'});
  assert.equal(after.status,0);
  await page.reload();await page.waitForFunction(()=>document.body.innerText.includes('teaching_env_01'));
  await page.screenshot({path:path.join(output,'03-修复后设备台账.png')});
  pass('chapter11 minimal repair',{targetedTestExit:after.status,ledgerRestored:true});
  writeJson(path.join(output,'verification.json'),{status:'PASS',at:new Date().toISOString(),scope:'Author local browser check and chapter11 deliberate defect/repair; not student classroom trial. No real AIRIOT.',checks});
  console.log(JSON.stringify({status:'PASS',checks:checks.length}));
}catch(e){writeJson(path.join(output,'verification.json'),{status:'FAIL',checks,error:e.message});throw e;}
finally{fs.writeFileSync(source,original);await browser.close();}
