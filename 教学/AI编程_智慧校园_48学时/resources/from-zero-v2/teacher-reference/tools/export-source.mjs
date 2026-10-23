import {cp,mkdir,readdir,writeFile,lstat,readFile,realpath,open} from 'node:fs/promises';
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
const forbiddenExtensions=new Set(['.zip','.tar','.gz','.bz2','.xz','.7z','.rar','.tgz','.tbz','.tbz2','.txz',
  '.zst','.pem','.key','.p12','.pfx','.jks','.keystore','.db','.sqlite','.sqlite3','.dump','.bak','.backup','.old']);
const forbiddenNames=new Set(['.npmrc','.netrc','.pypirc','id_rsa','id_dsa','id_ecdsa','id_ed25519']);
function rejectNonSource(p){
  const name=path.basename(p).toLowerCase();
  if(forbiddenExtensions.has(path.extname(name))||forbiddenNames.has(name)||name.endsWith('~')||
     /(?:^|[._-])(?:backup|dump)(?=[._-]|$).*\.sql$/.test(name)){
    throw Error('交付拒绝归档、密钥或备份文件：'+path.relative(root,p)+'；请保留原资料，将公开源码整理到指定目录再导出');
  }
}
async function rejectArchiveContent(p){
  // The existing course Maven launcher needs this reviewed binary. Only this
  // exact artifact is allowed, never an arbitrary JAR or an archive at its path.
  if(path.relative(root,p).split(path.sep).join('/')==='backend/.mvn/wrapper/maven-wrapper.jar'){
    const digest=createHash('sha256').update(await readFile(p)).digest('hex');
    if(digest!=='46b0acdfe3da08b3f40d25bd135858b6014ee62b92883768995c946a3b446bd6'){
      throw Error('Maven wrapper 与本课已核对版本不一致；停止导出，请教师核对来源，勿使用其他归档替代');
    }
    return;
  }
  const file=await open(p,'r');
  const header=Buffer.alloc(512);
  let size;
  try {size=(await file.read(header,0,header.length,0)).bytesRead;} finally {await file.close();}
  const signatures=['504b0304','504b0506','504b0708','1f8b','425a68','fd377a585a00',
    '377abcaf271c','526172211a07','28b52ffd','53514c69746520666f726d6174203300'];
  if(signatures.some(hex=>{const magic=Buffer.from(hex,'hex');return size>=magic.length&&header.subarray(0,magic.length).equals(magic);})||
     (size>=262&&header.toString('ascii',257,262)==='ustar')){
    throw Error('交付拒绝归档或数据库内容：'+path.relative(root,p)+'；更改扩展名不能把运行资料变成源码');
  }
}

// Validate required sources before creating an output directory.
for(const item of allow){
  try{await checkPath(path.join(root,item))}catch(e){if(e.code==='ENOENT')throw Error('缺少交付文件：'+item);throw e}
}
async function cleanCopy(from,to){
  await checkPath(from);
  rejectNonSource(from);
  const s=await lstat(from);
  if(s.isDirectory()){
    await mkdir(to,{recursive:true});
    for(const name of await readdir(from)){
      if(skip(name))continue;
      await cleanCopy(path.join(from,name),path.join(to,name));
    }
  }else if(s.isFile()){
    await rejectArchiveContent(from);
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
      const key=line.slice(0,line.indexOf('=')),value=line.slice(line.indexOf('=')+1);
      // A documented loopback JDBC URL contains no credential and also appears in the source defaults.
      const publicLocalUrl=key==='DB_URL'&&/^jdbc:mysql:\/\/127\.0\.0\.1:\d+\/campus_course\?useUnicode=true&characterEncoding=UTF-8&serverTimezone=UTC&allowPublicKeyRetrieval=true&useSSL=false$/.test(value);
      if(value.length>=12&&!publicLocalUrl)privateValues.push(value);
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
await writeFile(path.join(out,'SOURCE-MANIFEST.json'),JSON.stringify({version:'2.1.1',files},null,2)+'\n');
console.log('已导出 '+files.length+' 个源码文件到 '+path.relative(root,out)+'。未包含本机.env或运行数据。请按README在新目录验证。');
