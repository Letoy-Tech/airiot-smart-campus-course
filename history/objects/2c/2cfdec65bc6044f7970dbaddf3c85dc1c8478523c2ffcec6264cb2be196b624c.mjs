import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {marked} from 'marked';
const VERSION='2.0.2';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),base=path.join(root,'handbook-v2');
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const lessonFiles=(await fs.readdir(path.join(base,'lessons'))).filter(x=>/^\d\d-.*\.md$/.test(x)).sort();
const files=['00-先准备再开始.md',...lessonFiles.map(x=>'lessons/'+x),'教师安排.md','教师验证记录.md'];
const items=[];for(let i=0;i<files.length;i++){const text=await fs.readFile(path.join(base,files[i]),'utf8');items.push({id:'chapter-'+i,file:files[i],title:text.split('\n')[0].replace(/^# /,''),text})}
const slug=s=>s.toLowerCase().replace(/<[^>]+>/g,'').replace(/[^\p{L}\p{N}\s_-]/gu,'').replace(/\s/g,'-');
let steps=0;
for(const item of items){
  item.sections=[];
  item.html=marked.parse(item.text).replace(/<h2>(.*?)<\/h2>/g,(_,text)=>{
    const id=item.id+'-step-'+(item.sections.length+1);
    item.sections.push({id,text:text.replace(/<[^>]+>/g,''),slug:slug(text)});
    if(/^第\s*\d+\s*步/.test(text))steps++;
    return `<h2 id="${id}">${text}</h2>`;
  });
}
const body=items.map((x,i)=>{
  const h=x.html.replace(/href="([^"]+\.md)(#[^"]*)?"/g,(full,url,fragment)=>{
    const target=items.find(a=>path.basename(a.file)===path.basename(decodeURIComponent(url)));
    if(!target)return full;
    let id=target.id;
    if(fragment){
      const anchor=decodeURIComponent(fragment.slice(1));
      const section=target.sections.find(s=>s.slug===anchor||s.id===anchor);
      if(!section)throw Error('章节链接找不到具体步骤：'+x.file+' → '+url+fragment);
      id=section.id;
    }
    return `href="#${id}"`;
  });
  return `<article id="${x.id}" data-chapter ${i?'hidden':''}><p class="eyebrow">${i===0?'开课准备':i<=12?'第 '+String(i).padStart(2,'0')+' 课 · 4学时':'教师资料'} · V${VERSION}</p>${h.replace(/(<\/h1>)/,'$1<div class="step-links">'+x.sections.map(s=>`<a href="#${s.id}">${esc(s.text)}</a>`).join('')+'</div>')}<div class="bottom-nav">${i?`<a href="#${items[i-1].id}">← 上一部分</a>`:'<span></span>'}${i<items.length-1?`<a href="#${items[i+1].id}">下一部分 →</a>`:''}</div></article>`;
}).join('\n');
const html=`<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>从空白页面做出智慧校园 · 手把手教程 V${VERSION}</title><style>
:root{font:17px/1.85 system-ui,-apple-system,"PingFang SC","Microsoft YaHei",sans-serif;color:#29382f;background:#fafbf7}*{box-sizing:border-box}body{margin:0}header{padding:22px 30px;border-bottom:1px solid #d9dfd3;display:flex;justify-content:space-between;align-items:center;gap:20px;background:#fff}header strong{font-size:22px}header small{display:block;color:#5b6a5e}.book{display:grid;grid-template-columns:275px minmax(0,1fr);max-width:1500px;margin:auto}nav{padding:26px 18px;position:sticky;top:0;max-height:100vh;overflow:auto;border-right:1px solid #d9dfd3}nav a{display:block;color:#354d3e;text-decoration:none;padding:8px 10px;font-size:14px;line-height:1.6;border-radius:4px}nav a[aria-current=page]{background:#185c40;color:#fff}main{padding:42px 54px;min-width:0}article{max-width:880px;margin:auto}[hidden]{display:none!important}h1{font-size:31px;line-height:1.45;letter-spacing:-.6px;margin:8px 0 24px}h2{font-size:24px;line-height:1.5;border-top:1px solid #d5dfd2;margin:52px 0 22px;padding-top:26px;scroll-margin-top:16px}h3{font-size:19px}p{margin:14px 0}a{color:#126244;text-underline-offset:3px}strong{font-weight:650}pre{background:#edf2e9;border:1px solid #d4dfce;border-radius:6px;padding:20px;overflow:auto;position:relative;line-height:1.65;font-size:14px;white-space:pre-wrap;overflow-wrap:anywhere}code{font-family:ui-monospace,"SFMono-Regular",Consolas,monospace;font-size:.91em}p code,li code,td code{background:#edf2e9;padding:2px 4px;border-radius:3px}pre code{font-size:inherit}table{border-collapse:collapse;width:100%;font-size:14px;display:block;overflow:auto}th,td{border:1px solid #d6ded1;padding:11px 13px;min-width:105px;text-align:left;vertical-align:top}th{background:#eef2e8}li{margin:8px 0}.eyebrow{color:#4d6755;font-size:13px;letter-spacing:.5px}.step-links{display:flex;flex-direction:column;border-left:3px solid #adc4aa;padding:6px 20px;margin:22px 0;font-size:14px}.step-links a{text-decoration:none;margin:3px 0}.bottom-nav{display:flex;justify-content:space-between;border-top:1px solid #d5dfd2;padding-top:28px;margin-top:42px}button{font:inherit;font-size:13px;padding:7px 12px;border:1px solid #7f9a80;color:#234d34;background:#fff;border-radius:4px;cursor:pointer}.copy{display:block;margin:0 0 10px}.copy-note{font-size:13px;color:#556750}.notice{position:fixed;bottom:20px;right:20px;background:#244632;color:white;padding:10px 20px;border-radius:4px}.notice:empty{display:none}img{max-width:100%}:focus-visible{outline:3px solid #a66a17;outline-offset:3px}@media(max-width:900px){.book{grid-template-columns:1fr}nav{position:static;max-height:250px;border-bottom:1px solid #d9dfd3;border-right:0;display:grid;grid-template-columns:1fr 1fr}main{padding:28px 20px}h1{font-size:26px}header{align-items:flex-start}header strong{font-size:19px}}@media print{header,nav,.step-links,.copy,.bottom-nav,.notice{display:none!important}.book{display:block}main{padding:0}article[hidden]{display:block!important}article{max-width:none;page-break-before:always}pre{white-space:pre-wrap;break-inside:avoid}h2{break-after:avoid}}
</style></head><body><header><div><strong>从空白页面做出智慧校园</strong><small>48学时 · 12次课 · ${steps}个小步骤 · CodeBuddy独立IDE</small></div><button onclick="window.print()">打印 / 保存为PDF</button></header><div class="book"><nav aria-label="课程目录">${items.map((x,i)=>`<a href="#${x.id}" ${i===0?'aria-current="page"':''}>${esc(x.title)}</a>`).join('')}<p class="copy-note">每次只发送当前步骤。完成实际检查后，再继续下一步。</p></nav><main>${body}</main></div><div id="notice" class="notice" role="status" aria-live="polite"></div><script>
const articles=[...document.querySelectorAll('[data-chapter]')];function show(){const id=location.hash.slice(1)||'chapter-0';const target=document.getElementById(id)||articles[0];const current=target.matches('[data-chapter]')?target:target.closest('[data-chapter]');if(!current)return;for(const a of articles)a.hidden=a!==current;for(const a of document.querySelectorAll('nav a')){if(a.hash==='#'+current.id)a.setAttribute('aria-current','page');else a.removeAttribute('aria-current')}if(target===current)window.scrollTo(0,0);else target.scrollIntoView();}window.addEventListener('hashchange',show);show();for(const pre of document.querySelectorAll('pre')){const button=document.createElement('button');button.className='copy';button.textContent='复制本段内容';pre.prepend(button);button.addEventListener('click',async()=>{const code=pre.querySelector('code'),notice=document.getElementById('notice');try{await navigator.clipboard.writeText(code.textContent);notice.textContent='已复制。请按正文说明粘贴到对应位置。'}catch{const range=document.createRange();range.selectNodeContents(code);const selection=window.getSelection();selection.removeAllRanges();selection.addRange(range);notice.textContent='已选中本段，请按 Ctrl+C（Mac：⌘C）复制。'}setTimeout(()=>notice.textContent='',4000)})}
</script></body></html>`;
await fs.writeFile(path.join(base,'index.html'),html);let standalone=html;for(const name of await fs.readdir(path.join(base,'author/evidence'))){const file=path.join(base,'author/evidence',name);const type=name.endsWith('.png')?'image/png':'application/json';const data=(await fs.readFile(file)).toString('base64');for(const ref of ['author/evidence/'+name,encodeURI('author/evidence/'+name)])standalone=standalone.replaceAll('href="'+ref+'"','download="'+name+'" href="data:'+type+';base64,'+data+'"')}await fs.writeFile(path.join(base,`从空白开始_手把手教程_V${VERSION}.html`),standalone);
await fs.writeFile(path.join(root,'course-index-v2.json'),JSON.stringify({schema_version:2,version:VERSION,course_title:'从空白页面做出智慧校园',total_class_hours:48,minutes_per_class_hour:45,steps,chapters:items.slice(1,13).map(x=>({id:x.file.slice(8,10),title:x.title,file:'handbook-v2/'+x.file,class_hours:4,student_trial_verified:false})),entry:'handbook-v2/index.html'},null,2)+'\n');
console.log('Built offline reader: '+lessonFiles.length+' lessons, '+steps+' steps.');
