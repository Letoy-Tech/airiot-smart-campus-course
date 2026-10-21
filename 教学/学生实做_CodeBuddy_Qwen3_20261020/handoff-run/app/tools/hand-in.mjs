import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const excluded=new Set(['.private','.runtime','.git','.lesson-backups','node_modules','target','dist','__pycache__','.DS_Store','validation','journey-backups']);
// 教师参考目录：整目录排除，不读取、不复制、不进入清单。
const teacherReference=new Set(['lesson-bundles']);
const entries=['CODEBUDDY.md','journey-state.json','backend','frontend','fixtures','tools','docs','project-docs','evidence','.lesson-state.json','.gitignore','.nvmrc','package.json','README.md'];
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function walk(dir,prefix=''){
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>{
    if(excluded.has(e.name)||teacherReference.has(e.name)||e.name.startsWith('.env')&&e.name!=='.env.example'||/\.(har|log)$/i.test(e.name))return [];
    const p=path.join(dir,e.name),rel=path.join(prefix,e.name);
    if(e.isSymbolicLink())throw new Error(`拒绝符号链接 ${rel}，请检查来源。`);
    return e.isDirectory()?walk(p,rel):[{source:p,relative:rel}];
  });
}
try{
  const files=[];
  for(const entry of entries){if(teacherReference.has(entry))continue;const p=path.join(root,entry);if(!fs.existsSync(p))continue;if(fs.lstatSync(p).isSymbolicLink())throw new Error(`拒绝符号链接 ${entry}，请检查来源。`);files.push(...(fs.statSync(p).isDirectory()?walk(p,entry):[{source:p,relative:entry}]));}
  const design=path.join(root,'../docs');
  if(!fs.existsSync(path.join(root,'project-docs')) && fs.existsSync(design)){if(fs.lstatSync(design).isSymbolicLink())throw new Error('拒绝上级docs符号链接，请检查来源。');files.push(...walk(design,'project-docs'));}
  const secrets=[];
  for(const name of ['accounts.json','database.json','test-database.json']){
    const p=path.join(root,'.private',name);if(!fs.existsSync(p))continue;
    const value=JSON.parse(fs.readFileSync(p,'utf8').replace(/^\uFEFF/,''));
    if(value.password)secrets.push(String(value.password));
    for(const a of value.accounts||[])if(a.password)secrets.push(String(a.password));
  }
  const records=files.map(f=>({...f,bytes:fs.readFileSync(f.source)}));
  for(const f of records)if(secrets.some(s=>s.length && f.bytes.includes(Buffer.from(s))))throw new Error(`待交付文件含本机配置中的密码：${f.relative}。先删掉文档中的秘密，再重新运行；不会打印密码。`);
  const stamp=new Date().toISOString().replace(/[-:.]/g,'');
  const destination=path.join(root,'..','app-handoff-'+stamp);
  fs.mkdirSync(destination);
  for(const f of records){const out=path.join(destination,f.relative);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,f.bytes,{flag:'wx'});}
  const manifest={createdAt:new Date().toISOString(),sourceOnly:true,excluded:[...excluded,...teacherReference,'*.har','*.log','.env'],note:'已排除教师参考目录 lesson-bundles（未读取、未复制）与私密目录，并扫描本机已知密码；仍须人工检查文字和截图。未执行接手者复现，不等于已部署。',files:records.map(f=>({path:f.relative.split(path.sep).join('/'),sha256:hash(f.bytes),bytes:f.bytes.length}))};
  fs.writeFileSync(path.join(destination,'HANDIN-MANIFEST.json'),JSON.stringify(manifest,null,2)+'\n');
  console.log(`已生成源码交付目录：${destination}\n共 ${records.length} 个文件；已排除教师参考目录 lesson-bundles（未读取、未复制）。请检查目录、文字和截图，再用系统“压缩”生成ZIP；本命令不发布到服务器。`);
}catch(e){console.error(e.message);process.exitCode=1;}
