import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { courseDir, writeJson } from './runtime.mjs';
const work=path.join(courseDir,'.runtime/chapter-guard-'+Date.now());
const app=path.join(work,'app');
fs.cpSync(path.join(courseDir,'resources/student-project'),app,{recursive:true});
const catalog=JSON.parse(fs.readFileSync(path.join(app,'tools/chapter-tasks.json'),'utf8'));
const checks=[];
const prepare=ch=>spawnSync(process.execPath,['tools/chapter.mjs','prepare',ch],{cwd:app,encoding:'utf8'});
const block=(text,m)=>{
  const re=new RegExp(`(^[ \\t]*// STUDENT_TODO_${m}_BEGIN[^\\n]*\\n)([\\s\\S]*?)(^[ \\t]*// STUDENT_TODO_${m}_END[^\\n]*)`,'m');
  const match=text.match(re);assert(match);return {re,body:match[2]};
};
for(const ch of Object.keys(catalog.chapters).sort()){
  const tasks=catalog.chapters[ch];
  assert.equal(prepare(ch).status,0);
  for(const t of tasks){
    const f=path.join(app,t.file),text=fs.readFileSync(f,'utf8');
    const solution=block(fs.readFileSync(path.join(courseDir,'resources/campus-ai-course',t.file),'utf8'),t.marker).body;
    fs.writeFileSync(f,text.replace(block(text,t.marker).re,(_,a,_b,c)=>a+solution+c));
  }
  const saved=tasks.map(t=>[t.file,fs.readFileSync(path.join(app,t.file),'utf8')]);
  assert.equal(prepare(ch).status,0);
  for(const [f,s]of saved)assert.equal(fs.readFileSync(path.join(app,f),'utf8'),s);
  checks.push({chapter:ch,repeatedPreparePreservesReferenceEquivalentSolution:true});
}
// Unprepared custom code is refused without overwriting it.
const statePath=path.join(app,'.lesson-state.json');
const state=JSON.parse(fs.readFileSync(statePath,'utf8'));state.prepared=state.prepared.filter(c=>c!=='06');
fs.writeFileSync(statePath,JSON.stringify(state));
const target=path.join(app,catalog.chapters['06'][0].file);
const edited=fs.readFileSync(target,'utf8').replace('// STUDENT_TODO_C06_END','  // learner modification\n  // STUDENT_TODO_C06_END');
fs.writeFileSync(target,edited);assert.equal(prepare('06').status,1);assert.equal(fs.readFileSync(target,'utf8'),edited);
state.prepared.push('06');fs.writeFileSync(statePath,JSON.stringify(state));
fs.mkdirSync(path.join(work,'docs'));fs.writeFileSync(path.join(work,'docs/01-项目想法.md'),'# 原始设计，二次交付仍须保留\n');
const exported=spawnSync(process.execPath,['tools/hand-in.mjs'],{cwd:app,encoding:'utf8'});assert.equal(exported.status,0);
const folder=fs.readdirSync(work).find(n=>n.startsWith('app-handoff-'));assert(folder);
assert.deepEqual(JSON.parse(fs.readFileSync(path.join(work,folder,'.lesson-state.json'),'utf8')),state);
const receiver=path.join(work,'receiver/app');fs.cpSync(path.join(work,folder),receiver,{recursive:true});
const second=spawnSync(process.execPath,['tools/hand-in.mjs'],{cwd:receiver,encoding:'utf8'});assert.equal(second.status,0);
const secondFolder=fs.readdirSync(path.dirname(receiver)).find(n=>n.startsWith('app-handoff-'));assert(secondFolder);
assert.equal(fs.readFileSync(path.join(path.dirname(receiver),secondFolder,'project-docs/01-项目想法.md'),'utf8'),'# 原始设计，二次交付仍须保留\n');
const crlfApp=path.join(work,'crlf');fs.cpSync(path.join(courseDir,'resources/student-project'),crlfApp,{recursive:true});
const crlfFile=path.join(crlfApp,catalog.chapters['05'][0].file);fs.writeFileSync(crlfFile,fs.readFileSync(crlfFile,'utf8').replace(/\r?\n/g,'\r\n'));
const crlf=spawnSync(process.execPath,['tools/chapter.mjs','prepare','05'],{cwd:crlfApp,encoding:'utf8'});assert.equal(crlf.status,0);
const written=fs.readFileSync(crlfFile,'utf8');assert(!/(?<!\r)\n/.test(written));assert(written.includes('TODO_C05'));
fs.symlinkSync(path.join(work,'docs'),path.join(receiver,'project-docs-link'));
fs.renameSync(path.join(receiver,'project-docs'),path.join(receiver,'saved-project-docs'));
fs.renameSync(path.join(receiver,'project-docs-link'),path.join(receiver,'project-docs'));
assert.equal(spawnSync(process.execPath,['tools/hand-in.mjs'],{cwd:receiver,encoding:'utf8'}).status,1);
const report={status:'PASS',topLevelSymlinkRefused:true,secondHandoffPreservesDesign:true,crlfPreparationPreservesLineEndings:true,at:new Date().toISOString(),checks,unpreparedCustomBlockRefused:true,statePreservedInHandoff:true};
writeJson(path.join(courseDir,'walkthroughs/qa/chapter-guard.json'),report);console.log(JSON.stringify(report));
