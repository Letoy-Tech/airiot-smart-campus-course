import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { courseDir, launchBrowser } from './runtime.mjs';
const extracted=path.join(courseDir,'.runtime/package-v1.1.0/AI编程_智慧校园_48学时');
assert(fs.existsSync(extracted));
const browser=await launchBrowser();const checks=[];
try{
  const page=await browser.newPage({viewport:{width:1440,height:1000},permissions:['clipboard-read','clipboard-write']});
  const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));await page.route(/^https?:/,r=>{requests.push(r.request().url());return r.abort()});
  await page.goto(pathToFileURL(path.join(extracted,'先打开这里.html')).href);
  await page.getByRole('link',{name:'开始手把手教程 →',exact:true}).click();
  assert.equal(await page.locator('section.part').count(),13);
  const imgs=await page.locator('img').evaluateAll(xs=>Promise.all(xs.map(async i=>{i.loading='eager';await i.decode();return i.naturalWidth>0})));assert(imgs.every(Boolean));
  const local=await page.locator('a[href]').evaluateAll(xs=>xs.map(x=>x.href).filter(h=>h.startsWith('file:')));
  for(const h of local){const p=fileURLToPath(h.split('#')[0]);assert(p.startsWith(extracted+path.sep));assert(fs.existsSync(p),p)}
  const button=page.locator('[data-copy]').first();const expected=await button.evaluate(b=>document.getElementById(b.dataset.copy).textContent);await button.click();assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),expected);
  await page.getByRole('link',{name:'12 构建交付与接力',exact:false}).first().count();
  await page.addStyleTag({content:'html{scroll-behavior:auto!important}'});
  await page.locator('#part-12').evaluate(el=>window.scrollTo({top:el.getBoundingClientRect().top+window.scrollY-90,behavior:'instant'}));
  await page.screenshot({path:path.join(courseDir,'.runtime/package-v1.1.0/extracted-ch12.png')});
  await page.setViewportSize({width:390,height:844});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  assert.equal(errors.length,0);assert.equal(requests.length,0);
  const manifest=JSON.parse(fs.readFileSync(path.join(extracted,'delivery-manifest-v1.1.0.json'),'utf8'));
  for(const f of manifest.files)assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(extracted,f.path))).digest('hex'),f.sha256,f.path);
  checks.push('Fresh extraction, entry click, 13 chapters, images, local links, clipboard, mobile width, all manifest hashes');
  const reportPath=path.join(courseDir,'../AI编程_智慧校园_48学时_V1.1.0_交付校验.json');const report=JSON.parse(fs.readFileSync(reportPath,'utf8'));report.freshUnzipBrowserCheck={status:'PASS',at:new Date().toISOString(),checks,images:imgs.length,localLinks:local.length,filesHashed:manifest.files.length};fs.writeFileSync(reportPath,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report.freshUnzipBrowserCheck));
}finally{await browser.close()}
