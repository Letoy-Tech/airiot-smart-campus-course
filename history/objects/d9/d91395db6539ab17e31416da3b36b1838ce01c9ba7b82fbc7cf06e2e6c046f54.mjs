import {cp,mkdir,stat,readdir,writeFile,lstat,readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('..',import.meta.url));
const ix=process.argv.indexOf('--out');
if(ix<0||!process.argv[ix+1])throw Error('用法：node tools/export-source.mjs --out .runtime/hand-in-v1/campus-lab');
const out=path.resolve(root,process.argv[ix+1]);
if(!out.startsWith(path.join(root,'.runtime')+path.sep))throw Error('输出必须在本工程.runtime中');
try{await stat(out);throw Error('输出目录已存在；请换一个新名字，保留旧交付')}catch(e){if(e.code!=='ENOENT')throw e}
const allow=['frontend','backend/src','backend/pom.xml','backend/mvnw','backend/mvnw.cmd','backend/.mvn','tools','materials','docs','compose.yaml','.env.example','.gitignore','README.md'];
const excluded=new Set(['.env','.private','.runtime','node_modules','target','dist','.git','__pycache__','.DS_Store','.codebuddy']);
async function cleanCopy(from,to){const s=await lstat(from);if(s.isSymbolicLink())throw Error('交付拒绝符号链接：'+path.relative(root,from));if(s.isDirectory()){await mkdir(to,{recursive:true});for(const n of await readdir(from)){if(excluded.has(n)||n.endsWith('.log'))continue;await cleanCopy(path.join(from,n),path.join(to,n))}}else{await mkdir(path.dirname(to),{recursive:true});await cp(from,to,{errorOnExist:true,force:false})}}
await mkdir(out,{recursive:true});for(const item of allow){const p=path.join(root,item);try{await stat(p)}catch(e){if(e.code==='ENOENT')throw Error('缺少交付文件：'+item);throw e}await cleanCopy(p,path.join(out,item))}
const privateValues=[];try{for(const line of (await readFile(path.join(root,'.env'),'utf8')).split(/\r?\n/)){if(line&&!line.startsWith('#')&&line.includes('=')){const v=line.slice(line.indexOf('=')+1);if(v.length>=12)privateValues.push(v)}}}catch(e){if(e.code!=='ENOENT')throw e}
const files=[];async function walk(dir){for(const n of await readdir(dir)){const p=path.join(dir,n),s=await stat(p);if(s.isDirectory())await walk(p);else {const data=await readFile(p);if(privateValues.some(v=>data.includes(Buffer.from(v))))throw Error('发现配置值进入交付文件：'+path.relative(out,p)+'；不要交付此目录，请先修复源码再换目录重新导出');files.push({path:path.relative(out,p),bytes:s.size,sha256:createHash('sha256').update(await readFile(p)).digest('hex')})}}}await walk(out);
await writeFile(path.join(out,'SOURCE-MANIFEST.json'),JSON.stringify({version:'2.0.0',files},null,2)+'\n');console.log('已导出 '+files.length+' 个源码文件到 '+path.relative(root,out)+'。未包含本机.env或运行数据。请按README在新目录验证。');
