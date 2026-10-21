import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const course = path.resolve(root, '../..');
const destination = path.resolve(root, '..', 'student-chapters');
const java = 'backend/src/main/java/edu/campus/course/';
const blocks = {
 '04': [
  ['frontend/src/api/campus.ts','A',"  throw new ApiError('TODO-A：先核对业务code，再返回items与observedAt。')"],
  ['frontend/src/views/FirstDeviceRead.vue','B',"  void value\n  return '待完成 TODO-B'"],
 ],
 '05': [[java+'LocationService.java','C05','        throw new ApiFailure(501, "TODO_C05");']],
 '06': [['frontend/src/domain/course.ts','C06','  void devices; void filter\n  return []']],
 '07': [[java+'QualityPolicy.java','C07','        return "missing"; // TODO-C07：仅为可编译起点，须按合同实现所有质量分支。']],
 '08': [['frontend/src/domain/course.ts','C08','  void value\n  return false']],
 '09': [[java+'OperationsService.java','C09','        throw new ApiFailure(501, "TODO_C09");']],
 '10': [[java+'OperationsService.java','C10','        throw new ApiFailure(501, "TODO_C10");']],
 '11': [],
 '12': [['frontend/src/domain/course.ts','C12',"  void state\n  return { state: '', skip: 0 }"]],
};
const excludes = new Set(['node_modules','target','dist','.private','.runtime','.git','.DS_Store','validation','evidence','local-db.py','make-student.mjs','student-checkpoints.mjs','verify-student-checkpoints.mjs','__pycache__']);
const entries=['backend','frontend','fixtures','tools','docs','.gitignore','.nvmrc','package.json'];
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const walk = (dir) => fs.readdirSync(dir,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name)).flatMap(e=>{
 const file=path.join(dir,e.name);
 if(e.isSymbolicLink()) throw new Error(`拒绝分发符号链接：${path.relative(destination,file)}`);
 return e.isDirectory()?walk(file):[file];
});
function include(file) {
 const relative=path.relative(root,file).split(path.sep).join('/');
 if(relative==='frontend/tools'||relative.startsWith('frontend/tools/')) return false;
 if(relative==='frontend/validation'||relative.startsWith('frontend/validation/')) return false;
 if(relative.split('/').some(part=>excludes.has(part)||part.startsWith('.env')&&part!=='.env.example')) return false;
 if(fs.lstatSync(file).isSymbolicLink()) throw new Error(`源码存在符号链接，需人工确认而非跟随复制：${relative}`);
 return true;
}
function inside(base,file) { const relative=path.relative(base,file); return relative!== '..'&&!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative); }
function repairMarkdownLinks(output) {
 const adjustments=[];
 for(const file of walk(output).filter(file=>file.endsWith('.md'))) {
  const relative=path.relative(output,file);
  const sourceFile=path.join(root,relative);
  const text=fs.readFileSync(file,'utf8');
  const revised=text.replace(/(!?)\[([^\]\n]+)\]\((<[^>]+>|[^)\n]+)\)/g,(whole,image,label,raw)=>{
   let href=raw.startsWith('<')?raw.slice(1,-1):raw;
   if(/^(https?:|mailto:|data:|#)/i.test(href)) return whole;
   const hashIndex=href.indexOf('#');
   const local=hashIndex<0?href:href.slice(0,hashIndex);
   let decoded;try { decoded=decodeURIComponent(local); } catch { throw new Error(`链接不能解码：${relative}`); }
   const target=path.resolve(path.dirname(file),decoded);
   if(inside(output,target)&&fs.existsSync(target)) return whole;
   const original=path.resolve(path.dirname(sourceFile),decoded);
   const coursePath=inside(course,original)?path.relative(course,original).split(path.sep).join('/'):local;
   adjustments.push({file:relative.split(path.sep).join('/'),originalHref:href,coursePath,reason:inside(output,target)?'excluded-or-unavailable':'outside-checkpoint'});
   return `${label}（课程总包中的教师资料：\`${coursePath}\`；未随本练习副本分发，请由教师提供或从课程总包查阅）`;
  });
  if(revised!==text)fs.writeFileSync(file,revised);
 }
 return adjustments;
}
function refreshCopiedFixtureManifest(output) {
 const file=path.join(output,'fixtures/manifest.json');
 const manifest=JSON.parse(fs.readFileSync(file,'utf8'));
 const changed=[];
 for(const item of manifest.files) {
  const bytes=fs.readFileSync(path.join(output,'fixtures',item.path));
  const digest=hash(bytes);
  if(item.sha256!==digest||item.bytes!==bytes.length) {
   if(!item.path.endsWith('.md')) throw new Error(`数据夹具不应在生成学生版时变化：${item.path}`);
   item.sha256=digest;item.bytes=bytes.length;changed.push(item.path);
  }
 }
 if(changed.length)fs.writeFileSync(file,JSON.stringify(manifest,null,2)+'\n');
 return changed;
}
if (fs.existsSync(destination)) throw new Error('student-chapters 已存在，拒绝覆盖学生作业；请保留目录后在新的教师资源副本中生成。');
const validated = Object.entries(blocks).sort(([a],[b])=>a.localeCompare(b)).map(([chapter, edits])=>({chapter,edits:edits.map(([file,marker,stub])=>{
 const source=fs.readFileSync(path.join(root,file),'utf8');
 const regex=new RegExp(`(^[ \\t]*// STUDENT_TODO_${marker}_BEGIN[^\\n]*\\n)[\\s\\S]*?(^[ \\t]*// STUDENT_TODO_${marker}_END[^\\n]*)`,'m');
 if((source.match(new RegExp(`STUDENT_TODO_${marker}_BEGIN`,'g'))||[]).length!==1||!regex.test(source)) throw new Error(`标记不唯一或未找到 ${file}:${marker}`);
 return {file,marker,source,student:source.replace(regex,`$1${stub}\n$2`)};
})}));
const assertionFile=path.join(course,'resources/teacher-guide/11-学生断言模板.md');
if(!fs.existsSync(assertionFile)) throw new Error('等待第11章学生断言模板后再生成。');
fs.mkdirSync(destination);
const manifest={version:'1.1',generatedAt:new Date().toISOString(),purpose:'独立章节任务起点；前后章基础由教师预置，不代表从零独立实现整个系统',chapters:[]};
for(const item of validated){
 const output=path.join(destination,'ch'+item.chapter); fs.mkdirSync(output);
 for(const entry of entries) fs.cpSync(path.join(root,entry),path.join(output,entry),{recursive:true,filter:include});
 for(const edit of item.edits) fs.writeFileSync(path.join(output,edit.file),edit.student);
 fs.mkdirSync(path.join(output,'evidence')); fs.writeFileSync(path.join(output,'evidence/README.md'),'# 我的验证证据\n\n填写自己的时间、环境、预测、命令、实际结果与未通过项。教师的通过记录不属于本人的完成证据。\n');
 if(item.chapter==='11') fs.copyFileSync(assertionFile,path.join(output,'docs/ch11-assertions.md'));
 const sourceDoc=fs.readdirSync(path.join(root,'docs')).find(n=>n.startsWith(item.chapter+'-'));
 fs.writeFileSync(path.join(output,'README.md'),`# 第${item.chapter}章学生任务起点\n\n本目录是独立的课堂练习副本。教师提供项目框架及其他章参考实现，本章${item.edits.length?'标记块未完成':'断言任务未填写'}；完成本章不能声称整套平台均由本人从零编写。\n\n${item.edits.map(e=>`- ${e.marker}：${e.file}`).join('\n')}\n\n先读[本章操作单](docs/${sourceDoc})与[跨平台启动](docs/01-跨平台启动.md)。第04章使用\`node tools/course.mjs backend\`，第05—12章使用教师分配数据库及\`backend-db\`；迁移由教师明确执行。每个新副本需独立\`init\`，账号不复用原平台。\n\n${item.chapter==='11'?'本章是预测与断言文档任务，工程代码是教师参考实现；未填写任务单不能算完成，即使测试已经通过。':'当前块语法可编译，但预期功能/相关测试不通过；build含后端测试，C07未填时会阻断构建。先按操作单补块，再运行本章指定检查与build，记录自己的证据。'}不要删掉失败测试、复制教师通过报告或上传.private。保留学生上次作业，不要用本目录覆盖未提交的作品。将本章局部改动合入主项目作为课后选做，不额外叠加课内评分任务。${item.chapter==='11'?'本章填写docs/ch11-assertions.md。':''}\n`);
 const linkAdjustments=repairMarkdownLinks(output);
 const fixtureManifestRehashedFiles=refreshCopiedFixtureManifest(output);
 const files=walk(output).filter(f=>path.basename(f)!=='checkpoint.json');
 const record={chapter:item.chapter,linkAdjustments,fixtureManifestRehashedFiles,markers:item.edits.map(e=>({file:e.file,marker:e.marker,referenceSha256:hash(e.source),studentSha256:hash(e.student)})),files:files.map(f=>({path:path.relative(output,f).split(path.sep).join('/'),sha256:hash(fs.readFileSync(f))}))};
 fs.writeFileSync(path.join(output,'checkpoint.json'),JSON.stringify(record,null,2)+'\n');manifest.chapters.push({chapter:item.chapter,files:files.length,linkAdjustments:linkAdjustments.length,markers:record.markers});
}
fs.writeFileSync(path.join(destination,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(destination,'README.md'),'# 分章学生起点\n\nch04—ch12各是一份独立任务副本。前3章使用教材模板完成需求与设计；本目录用于从第04章开始的局部代码练习。只挖本章小块，其余基础由教师预置。教师参考工程在../campus-ai-course；答案由教师按教学进度开放。\n\n不要逐章整包覆盖自己的主项目。先保留上一章，再审阅本章任务差异；需要救援检查点时记录原因并独立解释关键逻辑。每章验证记录留在自己的evidence中。\n');
console.log(`已生成${manifest.chapters.length}个独立学生起点；未复制密码、依赖、构建产物、frontend/tools或教师验证记录；外部课程链接已改为明确的总包依赖文字。`);
