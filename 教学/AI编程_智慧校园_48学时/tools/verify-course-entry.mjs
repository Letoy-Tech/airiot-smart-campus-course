import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { courseDir, launchBrowser, writeJson } from './runtime.mjs';
const output=path.join(courseDir,'walkthroughs/qa/entry');fs.mkdirSync(output,{recursive:true});
const browser=await launchBrowser();const checks=[];
try{
  for(const [name,relative]of [['entry','先打开这里.html'],['teaching','lesson-plans/手把手主线授课衔接.html'],['resources','resources/index.html']]){
    for(const width of [1440,390]){
      const page=await browser.newPage({viewport:{width,height:1000}});
      const errors=[],network=[];page.on('pageerror',e=>errors.push(e.message));
      await page.route(/^https?:/,r=>{network.push(r.request().url());return r.abort()});
      const file=path.join(courseDir,relative);await page.goto(pathToFileURL(file).href);
      await page.locator('img').evaluateAll(xs=>Promise.all(xs.map(x=>{x.loading='eager';return x.decode()})));
      const data=await page.evaluate(()=>({width:document.documentElement.scrollWidth,links:[...document.querySelectorAll('a[href]')].map(a=>a.href),images:[...document.images].every(i=>i.naturalWidth>0)}));
      assert(data.width<=width);assert(data.images);assert.equal(errors.length,0);assert.equal(network.length,0);
      const local=data.links.filter(h=>h.startsWith('file:')).map(h=>fileURLToPath(h.split('#')[0]));
      assert(local.every(f=>fs.existsSync(f)),'missing local link '+relative);
      await page.screenshot({path:path.join(output,`${name}-${width}.png`)});
      if(name==='entry'){
        await page.getByRole('link',{name:'开始手把手教程 →',exact:true}).click();
        assert.equal(await page.locator('section.part').count(),13);
      }
      checks.push({file:relative,width,passed:true,sha256:crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')});await page.close();
    }
  }
  writeJson(path.join(output,'verification.json'),{status:'PASS',at:new Date().toISOString(),checks});console.log('PASS: root entry, teacher handoff, resources at 1440/390px');
}finally{await browser.close()}
