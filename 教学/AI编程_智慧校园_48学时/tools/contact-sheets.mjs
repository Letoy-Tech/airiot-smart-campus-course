import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { courseDir, launchBrowser, escapeHtml, option, assertCoursePath, writeJson } from './runtime.mjs';
const output = path.resolve(courseDir, option('--output', 'illustrations/qa/contact-sheets'));
assertCoursePath(output);
fs.mkdirSync(output,{recursive:true});
const report=JSON.parse(fs.readFileSync(path.join(courseDir,'illustrations/render-report.json'),'utf8'));
const figures=report.figures.filter(f=>f.source.startsWith('figure-sources/ch'));
const browser=await launchBrowser();
const sheets=[];
try {
  const page=await browser.newPage({viewport:{width:1500,height:1900},deviceScaleFactor:1});
  for(let offset=0;offset<figures.length;offset+=4){
    const batch=figures.slice(offset,offset+4);
    const stem=`sheet-${String(offset/4+1).padStart(2,'0')}`;
    const html=`<!doctype html><meta charset="utf-8"><style>body{margin:0;background:#eef2f5;font:20px 'PingFang SC',sans-serif;color:#17334b}main{display:grid;grid-template-columns:1fr 1fr;gap:20px;padding:20px}section{background:white;padding:20px;border:1px solid #bccbd6}h2{font-size:24px;height:60px;margin:0 0 10px}img{width:100%;height:780px;object-fit:contain;object-position:top}p{font-size:14px;overflow-wrap:anywhere;margin:10px 0 0}</style><main>${batch.map(f=>`<section><h2>${escapeHtml(f.id+'　'+f.title)}</h2><img src="${pathToFileURL(path.join(courseDir,f.png)).href}"><p>${escapeHtml(f.png)}<br>SHA-256 ${f.pngSha256}</p></section>`).join('')}</main>`;
    const file=path.join(output,stem+'.html');fs.writeFileSync(file,html);
    await page.goto(pathToFileURL(file).href,{waitUntil:'load'});
    await page.screenshot({path:path.join(output,stem+'.png'),fullPage:true});
    sheets.push({file:path.relative(courseDir,path.join(output,stem+'.png')),figures:batch.map(f=>({id:f.id,png:f.png,sha256:f.pngSha256}))});
  }
  writeJson(path.join(output,'index.json'),{generatedAt:new Date().toISOString(),figures:figures.length,sheets,labVerified:false});
} finally{await browser.close()}
console.log(`已生成 ${sheets.length} 张联系表，覆盖 ${figures.length} 幅章节图。`);
