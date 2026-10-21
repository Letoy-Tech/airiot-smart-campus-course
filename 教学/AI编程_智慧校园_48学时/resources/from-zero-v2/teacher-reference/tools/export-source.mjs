import {cp,mkdir,readdir,writeFile,lstat,readFile,realpath} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {createHash} from 'node:crypto';

const root=await realpath(fileURLToPath(new URL('..',import.meta.url)));
const ix=process.argv.indexOf('--out');
if(ix<0||!process.argv[ix+1])throw Error('用法：node tools/export-source.mjs --out .runtime/hand-in-v1/campus-lab');
const out=path.resolve(root,process.argv[ix+1]);
if(!out.startsWith(path.join(root,'.runtime')+path.sep))throw Error('输出必须在本工程.runtime中');

// Check every existing ancestor: lstat on the final file alone misses parent links.
async function checkPath(p,allowMissing=false){
  const relative=path.relative(root,p);
  if(relative==='..'||relative.startsWith('..'+path.sep)||path.isAbsolute(relative))throw Error('路径超出本工程');
  let current=root;
  for(const part of relative.split(path.sep)){
    current=path.join(current,part);
    try{
      const info=await lstat(current);
      if(info.isSymbolicLink())throw Error('交付拒绝符号链接：'+path.relative(root,current));
    }catch(e){if(allowMissing&&e.code==='ENOENT')return;throw e}
  }
}
await checkPath(out,true);
try{await lstat(out);throw Error('输出目录已存在；请换一个新名字，保留旧交付')}catch(e){if(e.code!=='ENOENT')throw e}
const allow=['frontend','backend/src','backend/pom.xml','backend/mvnw','backend/mvnw.cmd','backend/.mvn','tools','materials','docs','compose.yaml','.env.example','.gitignore','README.md'];
const excluded=new Set(['.private','.runtime','node_modules','target','dist','.git','__pycache__','.DS_Store','.codebuddy']);
const skip=(name)=>excluded.has(name)||name==='.env'||name.startsWith('.env.')||name.endsWith('.log');

// Validate required sources before creating an output directory.
for(const item of allow){
  try{await checkPath(path.join(root,item))}catch(e){if(e.code==='ENOENT')throw Error('缺少交付文件：'+item);throw e}
}
async function cleanCopy(from,to){
  await checkPath(from);
  const s=await lstat(from);
  if(s.isDirectory()){
    await mkdir(to,{recursive:true});
    for(const name of await readdir(from)){
      if(skip(name))continue;
      await cleanCopy(path.join(from,name),path.join(to,name));
    }
  }else if(s.isFile()){
    await mkdir(path.dirname(to),{recursive:true});
    await cp(from,to,{errorOnExist:true,force:false});
  }else throw Error('交付只接受普通文件：'+path.relative(root,from));
}
await mkdir(out,{recursive:true});
for(const item of allow)await cleanCopy(path.join(root,item),path.join(out,item));

const privateValues=[];
try{
  await checkPath(path.join(root,'.env'));
  for(const line of (await readFile(path.join(root,'.env'),'utf8')).split(/\r?\n/)){
    if(line&&!line.startsWith('#')&&line.includes('=')){
      const value=line.slice(line.indexOf('=')+1);
      if(value.length>=12)privateValues.push(value);
    }
  }
}catch(e){if(e.code!=='ENOENT')throw e}
const files=[];
async function walk(dir){
  for(const name of (await readdir(dir)).sort()){
    const p=path.join(dir,name),s=await lstat(p);
    if(s.isDirectory())await walk(p);
    else{
      const data=await readFile(p);
      if(privateValues.some(v=>data.includes(Buffer.from(v))))throw Error('发现配置值进入交付文件：'+path.relative(out,p)+'；不要交付此目录，请先修复源码再换目录重新导出');
      files.push({path:path.relative(out,p),bytes:s.size,sha256:createHash('sha256').update(data).digest('hex')});
    }
  }
}
await walk(out);
await writeFile(path.join(out,'SOURCE-MANIFEST.json'),JSON.stringify({version:'2.0.1',files},null,2)+'\n');
console.log('已导出 '+files.length+' 个源码文件到 '+path.relative(root,out)+'。未包含本机.env或运行数据。请按README在新目录验证。');
