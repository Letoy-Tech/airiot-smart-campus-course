import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { courseDir, launchBrowser, writeJson } from './runtime.mjs';

const root=path.join(courseDir,'walkthroughs');
const qa=path.join(root,'qa'); fs.mkdirSync(qa,{recursive:true});
const browser=await launchBrowser();
const inputHash=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,'index.html'))).digest('hex');
const checks=[];
const assert=(name,condition,detail='')=>{checks.push({name,passed:!!condition,detail});if(!condition)throw new Error(name+': '+detail);};
try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,permissions:['clipboard-read','clipboard-write']});
  const page=await context.newPage();
  const errors=[],network=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:/,route=>{network.push(route.request().url());return route.abort();});
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
  await page.locator('img').evaluateAll(xs=>Promise.all(xs.map(i=>{i.loading='eager';return i.decode();})));
  assert('all 13 chapters present',await page.locator('section.part').count()===13);
  assert('all illustrations load',await page.locator('img').count()>=20 && await page.locator('img').evaluateAll(xs=>xs.every(x=>x.naturalWidth>0)));
  const broken=await page.locator('a[href]').evaluateAll(xs=>xs.map(x=>x.getAttribute('href')).filter(h=>h.startsWith('#')&&!document.getElementById(h.slice(1))));
  assert('internal navigation',!broken.length,JSON.stringify(broken));
  const links=await page.locator('a[href]').evaluateAll(xs=>xs.map(x=>x.href).filter(h=>h.startsWith('file:')));
  assert('local file links',links.every(h=>fs.existsSync(fileURLToPath(h.split('#')[0]))));
  assert('no desktop page overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(qa,'01-桌面入口.png')});
  const copy=page.locator('.prompt [data-copy]').first();
  const expected=await copy.evaluate(b=>document.getElementById(b.dataset.copy).textContent);
  await copy.click();
  assert('copy prompt to actual browser clipboard',await page.evaluate(()=>navigator.clipboard.readText())===expected);
  await page.locator('#open-saver').click();
  await page.locator('#download-md').click();
  assert('empty save gives useful feedback',(await page.locator('#save-status').innerText()).includes('还没有回答'));
  const practice='# 我的第一次项目记录\n项目名称：智慧校园教学平台\n本次目标：学会把AI回答保存成文件\n完成状态：等待我自己下载并检查';
  await page.locator('#answer').fill(practice);
  await page.locator('#filename').selectOption('00-保存练习.md');
  await page.screenshot({path:path.join(qa,'02-保存工具.png')});
  await page.locator('#saver').screenshot({path:path.join(root,'figures','09-保存工具实图.png')});
  const downloadEvent=page.waitForEvent('download');
  await page.locator('#download-md').click();
  const download=await downloadEvent;
  const saved=path.join(qa,'00-保存练习.md');
  await download.saveAs(saved);
  assert('download filename',download.suggestedFilename()==='00-保存练习.md');
  assert('UTF8 download retains exact text',fs.readFileSync(saved,'utf8')===practice);
  await page.locator('#answer').fill('故意替换以验证重新打开');
  await page.locator('#import-md').setInputFiles(saved);
  await page.waitForFunction(()=>document.querySelector('#answer').value.startsWith('# 我的第一次'));
  assert('reopen saved file',await page.locator('#answer').inputValue()===practice);
  await page.locator('#copy-answer').click();
  assert('copy reopened answer',await page.evaluate(()=>navigator.clipboard.readText())===practice);
  assert('all fixed output names',await page.locator('#filename option').count()===12);
  await page.locator('#close-saver').click();
  assert('close does not erase draft',await page.locator('#answer').inputValue()===practice);
  assert('no external requests',network.length===0,JSON.stringify(network));
  assert('no page JS errors',errors.length===0,JSON.stringify(errors));
  await page.setViewportSize({width:390,height:844});
  await page.goto('about:blank');
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
  assert('no mobile page overflow',await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  await page.screenshot({path:path.join(qa,'03-手机入口.png')});
  await page.locator('#open-saver').click();
  await page.locator('#answer').fill(practice);
  assert('mobile dialog fits',await page.locator('#saver').evaluate(x=>x.getBoundingClientRect().width<=innerWidth));
  await page.screenshot({path:path.join(qa,'04-手机保存.png')});
  await page.locator('#close-saver').click();
  await page.locator('h2').filter({hasText:'把场景改成能判定对错的需求'}).scrollIntoViewIfNeeded();
  await page.screenshot({path:path.join(qa,'05-手机正文.png')});
  for(const part of ['04','11','12']){
    for(const width of [1440,390]){
      await page.setViewportSize({width,height:900});
      await page.locator('#part-'+part).evaluate(el=>window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-90,behavior:'instant'}));
      assert(`chapter ${part} ${width}px no overflow`,await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      await page.screenshot({path:path.join(qa,`chapter-${part}-${width}.png`)});
    }
  }
  await context.close();

  const art=await browser.newPage({viewport:{width:1000,height:560},deviceScaleFactor:1});
  const names=fs.readdirSync(path.join(root,'figures')).filter(n=>n.endsWith('.svg')).sort();
  for(const name of names){
    const svg=fs.readFileSync(path.join(root,'figures',name),'utf8');
    const height=Number(svg.match(/height="(\d+)"/)[1]);
    await art.setViewportSize({width:1000,height});
    await art.goto(pathToFileURL(path.join(root,'figures',name)).href);
    await art.screenshot({path:path.join(root,'figures',name.replace('.svg','.png'))});
  }
  await art.setViewportSize({width:1000,height:Math.ceil(names.length/2)*279});
  await art.goto('about:blank');
  await art.setContent('<style>body{margin:0;display:grid;grid-template-columns:1fr 1fr;background:#d5e3dc;gap:4px}img{width:498px;height:275px;object-fit:contain;background:white}</style>'+names.map(n=>`<img src="data:image/svg+xml;base64,${fs.readFileSync(path.join(root,'figures',n)).toString('base64')}">`).join(''));
  await art.locator('img').evaluateAll(xs=>Promise.all(xs.map(x=>x.decode())));
  await art.screenshot({path:path.join(qa,'06-配图总览.png')});
  await art.close();
  const report={at:new Date().toISOString(),passed:true,inputSha256:inputHash,checks,browser:browser.version(),classroomTrial:false,windowsPhysicalMachine:false,realQwenSession:false};
  writeJson(path.join(qa,'verification.json'),report);
  console.log(JSON.stringify(report,null,2));
}catch(error){writeJson(path.join(qa,'verification.json'),{at:new Date().toISOString(),passed:false,checks,error:error.message});throw error;}
finally{await browser.close();}
