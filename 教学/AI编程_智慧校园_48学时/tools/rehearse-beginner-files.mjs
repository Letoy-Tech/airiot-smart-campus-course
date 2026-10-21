import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {courseDir,dependency,writeJson} from './runtime.mjs';
const root=path.join(courseDir,'.runtime/round9-lab');
const app=path.join(root,'student/campus-ai-lab/app');
const qa=path.join(courseDir,'walkthroughs/qa/round9');fs.mkdirSync(qa,{recursive:true});
const {Marked}=await dependency('marked');const md=new Marked();
const readGuide=n=>{const f=fs.readdirSync(path.join(courseDir,'walkthroughs')).find(x=>x.startsWith(n+'-')&&x.endsWith('.md'));return {file:f,text:fs.readFileSync(path.join(courseDir,'walkthroughs',f),'utf8')}};
const blocks=n=>md.lexer(readGuide(n).text).filter(x=>x.type==='code');
const reportPath=path.join(qa,'student-files.json');const report=fs.existsSync(reportPath)?JSON.parse(fs.readFileSync(reportPath,'utf8')):{status:'RUNNING',steps:[],source:'Fresh V1.1.0 ZIP student-project; solutions extracted from tutorial code blocks, not teacher reference source.',aiMode:'Tutorial examples, no live model session',installers:'Existing author Node/JDK used; not fresh Windows/macOS installer execution'};
function run(name,cmd,args,expected=0){const r=spawnSync(cmd,args,{cwd:app,env:process.env,encoding:'utf8',maxBuffer:20*1024*1024});fs.writeFileSync(path.join(root,name+'.log'),(r.stdout||'')+(r.stderr||''));assert(!r.error,r.error?.message);assert(expected==='nonzero'?r.status!==0:r.status===expected,`${name}: exit ${r.status}`);report.steps.push({name,exit:r.status,expected});writeJson(reportPath,report);console.log(name+': PASS')}
const catalog=JSON.parse(fs.readFileSync(path.join(app,'tools/chapter-tasks.json'),'utf8'));
function replace(ch,marker,code){const t=catalog.chapters[ch].find(t=>t.marker===marker);assert(t,marker);const f=path.join(app,t.file);const re=new RegExp(`(^[ \\t]*// STUDENT_TODO_${marker}_BEGIN[^\\n]*\\n)([\\s\\S]*?)(^[ \\t]*// STUDENT_TODO_${marker}_END[^\\n]*)`,'m');const old=fs.readFileSync(f,'utf8');assert(re.test(old));const inner=code.match(re)?.[2]??code.trimEnd()+'\n';fs.writeFileSync(f,old.replace(re,(_,a,b,c)=>a+inner+c));report.steps.push({name:'apply-guide-'+marker,guide:readGuide(ch).file,codeSha256:crypto.createHash('sha256').update(code).digest('hex'),file:t.file});writeJson(reportPath,report)}
const action=process.argv[2];
if(action==='design'){
 const names=JSON.parse(fs.readFileSync(path.join(courseDir,'walkthroughs/build.json'),'utf8')).files.slice(1);const docs=path.join(app,'../docs');fs.mkdirSync(docs,{recursive:true});let count=0;
 for(const ch of ['01','02','03'])for(const b of blocks(ch).filter(b=>b.lang==='markdown')){assert(names[count]);fs.writeFileSync(path.join(docs,names[count++]),b.text+'\n')}
 assert.equal(count,11);assert(names.every(n=>fs.readFileSync(path.join(docs,n),'utf8').startsWith('# ')));report.steps.push({name:'11-design-example-files',count,mode:'Saved complete example documents as rehearsal fixtures, not claimed AI responses'});writeJson(reportPath,report);console.log('11 complete design files saved and reopened');
}else if(action==='04'){
 run('04-doctor',process.execPath,['tools/course.mjs','doctor']);run('04-install','npm',['--prefix','frontend','ci']);run('04-init',process.execPath,['tools/course.mjs','init']);run('04-prepare',process.execPath,['tools/chapter.mjs','prepare','04']);
 for(const [name,args]of [['git-init',['init']],['git-name',['config','--local','user.name','CourseRehearsal']],['git-email',['config','--local','user.email','rehearsal@example.invalid']],['git-add',['add','--','.gitignore','.nvmrc','.lesson-state.json','package.json','README.md','backend','frontend','fixtures','tools','docs','evidence']],['git-commit',['commit','-m','chore: record teacher-provided starting point']]])run('04-'+name,'git',args);
 const ts=blocks('04').filter(b=>['ts','typescript'].includes(b.lang));replace('04','A',ts.find(b=>b.text.includes('if (response.code !== 0)')).text);replace('04','B',ts.find(b=>b.text.includes("if (value === null) return '未知'")).text);
 run('04-tests','npm',['--prefix','frontend','run','test:unit','--','--run','src/tests/http.test.ts','src/tests/first-device-view.test.ts']);run('04-types','npm',['--prefix','frontend','run','type-check']);run('04-build',process.execPath,['tools/course.mjs','build']);
}else if(/^(05|06|07|08|09|10|12)$/.test(action)){
 const ch=action;run(ch+'-prepare',process.execPath,['tools/chapter.mjs','prepare',ch]);
 const selectors={'05':s=>s.includes('noneMatch'),'06':s=>s.includes('const keyword = filter.keyword'),'07':s=>s.includes('long age = observedAt'),'08':s=>s.trim()==='return value === true','09':s=>s.includes('noneMatch')&&s.includes('NOTE'),'10':s=>s.trim()==='ApiFailure.version(expected, actual);','12':s=>s.includes('return { state: validCaseState(state), skip: 0 }')};
 const chosen=blocks(ch).filter(b=>['java','typescript','ts'].includes(b.lang)).filter(b=>selectors[ch](b.text));assert.equal(chosen.length,1,'guide code '+ch);
 if(ch==='12')run('12-before-test','npm',['--prefix','frontend','run','test:unit','--','--run','src/tests/course-domain.test.ts','src/tests/workflow-views.test.ts'],'nonzero');
 replace(ch,'C'+ch,chosen[0].text);
 run(ch+'-check',process.execPath,['tools/course.mjs','check']);
 if(['05','07','09','10'].includes(ch))run(ch+'-build',process.execPath,['tools/course.mjs','build']);
}else if(action==='final'){
 run('12-final-check',process.execPath,['tools/course.mjs','check']);run('12-final-build',process.execPath,['tools/course.mjs','build']);report.status='PASS';writeJson(reportPath,report);
}else throw new Error('design|04|05|06|07|08|09|10|12|final');
