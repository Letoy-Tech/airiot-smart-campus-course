import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { courseDir, writeJson } from './runtime.mjs';
const work=path.join(courseDir,'.runtime/round8-lab');
const app=path.join(work,'app');
const reference=path.join(courseDir,'resources/campus-ai-course');
const reportFile=path.join(courseDir,'walkthroughs/qa/continuous-project.json');
fs.mkdirSync(path.dirname(reportFile),{recursive:true});
assert(!fs.existsSync(work),'preserve existing verification workspace');
fs.mkdirSync(work,{recursive:true});
fs.cpSync(path.join(courseDir,'resources/student-project'),app,{recursive:true});
const results=[];
function run(name,cmd,args,cwd=app,expected=0){
  const r=spawnSync(cmd,args,{cwd,env:process.env,encoding:'utf8',maxBuffer:15*1024*1024});
  const log=path.join(work,name+'.log');fs.writeFileSync(log,(r.stdout||'')+(r.stderr||''));
  assert(!r.error,`${name}: ${r.error?.message}`);
  assert(expected==='nonzero'?r.status!==0:r.status===expected,`${name}: unexpected exit ${r.status}; inspect private author log`);
  results.push({name,passed:true,exit:r.status,expected});console.log(name+': PASS');
  return r;
}
function block(s,m){const re=new RegExp(`(^[ \\t]*// STUDENT_TODO_${m}_BEGIN[^\\n]*\\n)([\\s\\S]*?)(^[ \\t]*// STUDENT_TODO_${m}_END[^\\n]*)`,'m');const a=s.match(re);assert(a,m);return{re,body:a[2]};}
try{
  run('dependencies','npm',['--prefix','frontend','ci']);
  const tasks=JSON.parse(fs.readFileSync(path.join(app,'tools/chapter-tasks.json'),'utf8')).chapters;
  const tests={
    '04':['src/tests/http.test.ts','src/tests/first-device-view.test.ts'],
    '06':['src/tests/course-domain.test.ts','src/tests/catalog-navigation.test.ts'],
    '08':['src/tests/course-domain.test.ts','src/tests/session-races.test.ts'],
    '12':['src/tests/course-domain.test.ts','src/tests/workflow-views.test.ts'],
  };
  for(const ch of Object.keys(tasks).sort()){
    const before=new Map();
    for(const ts of Object.values(tasks))for(const t of ts)if(!before.has(t.file))before.set(t.file,fs.readFileSync(path.join(app,t.file),'utf8'));
    run('prepare-'+ch,process.execPath,['tools/chapter.mjs','prepare',ch]);
    for(const t of tasks[ch])assert.equal(block(fs.readFileSync(path.join(app,t.file),'utf8'),t.marker).body,t.stub+'\n');
    for(const [other,ts]of Object.entries(tasks))if(other!==ch)for(const t of ts)assert.equal(block(fs.readFileSync(path.join(app,t.file),'utf8'),t.marker).body,block(before.get(t.file),t.marker).body,'other chapter preserved '+other);
    run('prepare-idempotent-'+ch,process.execPath,['tools/chapter.mjs','prepare',ch]);
    if(tests[ch])run('expected-failure-'+ch,'npm',['--prefix','frontend','run','test:unit','--','--run',...tests[ch]],app,'nonzero');
    for(const t of tasks[ch]){
      const dest=path.join(app,t.file),s=fs.readFileSync(dest,'utf8');
      const solution=block(fs.readFileSync(path.join(reference,t.file),'utf8'),t.marker).body;
      fs.writeFileSync(dest,s.replace(block(s,t.marker).re,(_,a,_b,c)=>a+solution+c));
    }
    const repairedFiles=new Map(tasks[ch].map(t=>[t.file,fs.readFileSync(path.join(app,t.file),'utf8')]));
    run('prepare-after-repair-'+ch,process.execPath,['tools/chapter.mjs','prepare',ch]);
    for(const [f,body]of repairedFiles)assert.equal(fs.readFileSync(path.join(app,f),'utf8'),body,'completed chapter must survive repeated prepare');
    if(tests[ch])run('repaired-'+ch,'npm',['--prefix','frontend','run','test:unit','--','--run',...tests[ch]]);
  }
  // A learner's edited future block must never be overwritten by prepare.
  const target=path.join(app,tasks['06'][0].file);const original=fs.readFileSync(target,'utf8');
  fs.writeFileSync(target,original.replace('// STUDENT_TODO_C06_END','  // my reviewed implementation\n  // STUDENT_TODO_C06_END'));
  const edited=fs.readFileSync(target,'utf8');
  // Simulate a future chapter edited before first preparation.
  const statePath=path.join(app,'.lesson-state.json');
  const savedState=fs.readFileSync(statePath,'utf8');
  const state=JSON.parse(savedState);state.prepared=state.prepared.filter(c=>c!=='06');fs.writeFileSync(statePath,JSON.stringify(state));
  run('refuse-edited-block',process.execPath,['tools/chapter.mjs','prepare','06'],app,'nonzero');
  assert.equal(fs.readFileSync(target,'utf8'),edited);fs.writeFileSync(target,original);fs.writeFileSync(statePath,savedState);
  run('full-check',process.execPath,['tools/course.mjs','check']);
  run('full-build',process.execPath,['tools/course.mjs','build']);
  run('init',process.execPath,['tools/course.mjs','init']);
  // Known-secret fixture verifies export refusal; it is not a real credential.
  const bad=path.join(app,'evidence/test-export-secret.md');
  const actual=JSON.parse(fs.readFileSync(path.join(app,'.private/accounts.json'),'utf8')).accounts[0].password;
  fs.writeFileSync(bad,actual);
  run('export-refuses-secret',process.execPath,['tools/hand-in.mjs'],app,'nonzero');fs.unlinkSync(bad);
  fs.mkdirSync(path.join(work,'docs'));fs.writeFileSync(path.join(work,'docs/01-项目想法.md'),'# 作者隔离验证的设计文件\n');
  run('source-export',process.execPath,['tools/hand-in.mjs']);
  const exported=fs.readdirSync(work).find(n=>n.startsWith('app-handoff-'));assert(exported);
  const manifest=JSON.parse(fs.readFileSync(path.join(work,exported,'HANDIN-MANIFEST.json'),'utf8'));
  assert(manifest.files.some(f=>f.path==='project-docs/01-项目想法.md'));
  assert(!manifest.files.some(f=>f.path.split('/').some(p=>['.private','node_modules','target','dist','.lesson-backups'].includes(p))));
  writeJson(reportFile,{status:'PASS',at:new Date().toISOString(),scope:'Same project prepares 9 task blocks sequentially; reviewed reference solutions exercised. Not a real Qwen/student session.',results,sourceExportFiles:manifest.files.length,mysqlTest:'pending separate run',classroomTrial:false,windowsPhysicalMachine:false});
}catch(e){writeJson(reportFile,{status:'FAIL',at:new Date().toISOString(),results,error:e.message});throw e;}
