import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const catalog=JSON.parse(fs.readFileSync(path.join(root,'tools/chapter-tasks.json'),'utf8'));
const [action,chapter]=process.argv.slice(2);
const stateFile=path.join(root,'.lesson-state.json');
const hash=s=>crypto.createHash('sha256').update(s).digest('hex');
function matchBlock(text,marker){
  const re=new RegExp(`(^[ \\t]*// STUDENT_TODO_${marker}_BEGIN[^\\n]*\\n)([\\s\\S]*?)(^[ \\t]*// STUDENT_TODO_${marker}_END[^\\n]*)`,'m');
  if((text.match(new RegExp(`STUDENT_TODO_${marker}_BEGIN`,'g'))||[]).length!==1)throw new Error(`标记 ${marker} 不唯一或不存在；保留文件，请教师检查。`);
  const m=text.match(re);if(!m)throw new Error(`标记 ${marker} 缺少结束行。`);
  return {re,body:m[2]};
}
try{
  if(action==='list'){
    for(const [id,tasks]of Object.entries(catalog.chapters).sort(([a],[b])=>a.localeCompare(b))) console.log(`${id}: ${tasks.map(t=>`${t.file} → ${t.marker}`).join('; ')||'填写 docs/ch11-assertions.md；不修改代码'}`);
  }else if(action==='prepare' && catalog.chapters[chapter]){
    const state=fs.existsSync(stateFile)?JSON.parse(fs.readFileSync(stateFile,'utf8')):{prepared:[]};
    if(!Array.isArray(state.prepared))throw new Error('.lesson-state.json 格式异常，保留源码并请教师检查。');
    if(state.prepared.includes(chapter)){
      console.log(`第 ${chapter} 章以前已经准备过，保留你现在的全部代码。继续本章操作与测试；需要重做时另建副本。`);
      process.exit(0);
    }
    const plans=[];
    for(const task of catalog.chapters[chapter]){
      const file=path.join(root,task.file);const text=fs.readFileSync(file,'utf8');
      const {re,body}=matchBlock(text,task.marker);
      const normalized=body.replace(/\r\n/g,'\n');
      const newline=text.includes('\r\n')?'\r\n':'\n';
      if(normalized===task.stub+'\n'){console.log(`${task.marker} 已是本章起点，不重复覆盖。`);continue;}
      if(hash(normalized)!==task.referenceBodySha256)throw new Error(`${task.file} 的 ${task.marker} 已被编辑，拒绝覆盖。继续你的现有实现并运行本章测试；需要重做时另用新的起点，不删自己的代码。`);
      plans.push({file,text,updated:text.replace(re,(_whole,begin,_body,end)=>begin+task.stub.replace(/\n/g,newline)+newline+end),task});
    }
    if(chapter==='11'){
      const file=path.join(root,'docs/ch11-assertions.md');
      if(!fs.existsSync(file))throw new Error('缺少 docs/ch11-assertions.md，请从教师包补回文档，脚本不会生成测试结果。');
    }
    if(plans.length){
      const backup=path.join(root,'.lesson-backups',chapter+'-'+Date.now());
      for(const p of plans){const dest=path.join(backup,p.task.file);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.writeFileSync(dest,p.text,{flag:'wx'});}
      for(const p of plans){fs.writeFileSync(p.file,p.updated);console.log(`已准备 ${p.task.marker}：${p.task.file}`);}
      console.log(`原文件备份在 .lesson-backups/${path.basename(backup)}；其他章节内容保留。`);
    }
    fs.writeFileSync(stateFile,JSON.stringify({prepared:[...state.prepared,chapter].sort()},null,2)+'\n');
    console.log(`第 ${chapter} 章任务已准备；这不表示已完成。按教程先预测，补当前块，再运行本章检查。`);
  }else throw new Error('用法：node tools/chapter.mjs list 或 node tools/chapter.mjs prepare 04（章节04—12）');
}catch(e){console.error(e.message);process.exitCode=1;}
