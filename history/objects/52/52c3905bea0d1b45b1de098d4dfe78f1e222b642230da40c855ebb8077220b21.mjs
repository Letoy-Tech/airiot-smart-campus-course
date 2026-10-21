import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { courseDir, launchBrowser } from './runtime.mjs';
const dir=path.join(courseDir,'lesson-plans'),out=path.join(dir,'qa');
const browser=await launchBrowser();const checks=[];
try{for(const width of [1440,390]){
const page=await browser.newPage({viewport:{width,height:1000}});const remote=[],errors=[];
await page.route(/https?:\/\//,r=>{remote.push(r.request().url());return r.abort()});page.on('pageerror',e=>errors.push(e.message));
await page.goto(pathToFileURL(path.join(dir,'index.html')).href);await page.evaluate(()=>document.fonts.ready);
await page.waitForFunction(()=>[...document.images].every(i=>i.complete&&i.naturalWidth>0));
assert.equal(await page.locator('section[id^="lesson-"]').count(),12);assert.equal(await page.locator('img').count(),12);
assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(remote,[]);assert.deepEqual(errors,[]);
for(const l of await page.locator('nav a').evaluateAll(a=>a.map(x=>x.getAttribute('href')))){await page.locator(`nav a[href="${l}"]`).click();assert.equal(await page.evaluate(()=>location.hash),l)}
await page.evaluate(()=>scrollTo(0,0));await page.screenshot({path:path.join(out,`lessons-${width}.png`)});
await page.locator('#lesson-09').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(out,`lesson-09-${width}.png`)});
checks.push({width,lessons:12,images:12,noOverflow:true,noRemoteRequests:true,allNavigationLinks:true});await page.close();
}}finally{await browser.close()}
fs.writeFileSync(path.join(out,'html-verification.json'),JSON.stringify({status:'PASS',at:new Date().toISOString(),sha256:crypto.createHash('sha256').update(fs.readFileSync(path.join(dir,'index.html'))).digest('hex'),checks},null,2)+'\n');
console.log('教案HTML 12课/12图/1440和390/导航/离线检查PASS');
