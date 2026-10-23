// Isolated fixtures with fake data. Does not read the real course .env.
import {mkdir,mkdtemp,writeFile,readFile,copyFile,symlink,rename,readdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';

const root=fileURLToPath(new URL('../..',import.meta.url));
const runtime=path.join(root,'.runtime/recheck-v2');
await mkdir(runtime,{recursive:true});
const run=await mkdtemp(path.join(runtime,'export-check-'));
const source=path.join(root,'resources/from-zero-v2/teacher-reference/tools/export-source.mjs');
const results=[];
async function fixture(name){
  const dir=path.join(run,name);
  for(const d of ['frontend','backend/src','backend/.mvn','tools','materials','docs'])await mkdir(path.join(dir,d),{recursive:true});
  for(const f of ['frontend/index.html','backend/src/App.java','backend/.mvn/wrapper.properties','backend/pom.xml','backend/mvnw','backend/mvnw.cmd','materials/sample.json','docs/readme.md','compose.yaml','.env.example','.gitignore','README.md'])await writeFile(path.join(dir,f),'public fixture\n');
  await copyFile(source,path.join(dir,'tools/export-source.mjs'));
  await writeFile(path.join(dir,'.env'),'DEMO_PASSWORD=temporary-fixture-value-12345\n');
  return dir;
}
function execute(dir,out='.runtime/hand-in/campus-lab'){
  return spawnSync(process.execPath,['tools/export-source.mjs','--out',out],{cwd:dir,encoding:'utf8'});
}
function pass(name){results.push({check:name,passed:true})}
function denied(result,pattern){assert.notEqual(result.status,0);assert.match(result.stderr,pattern)}
let dir=await fixture('normal');
await writeFile(path.join(dir,'frontend/.env.local'),'nested-secret-fixture');
await writeFile(path.join(dir,'docs/.env.backup'),'another-secret-fixture');
await writeFile(path.join(dir,'docs/.env.example'),'nested-private-example');
assert.equal(execute(dir).status,0);
let out=path.join(dir,'.runtime/hand-in/campus-lab');
let manifest=JSON.parse(await readFile(path.join(out,'SOURCE-MANIFEST.json'),'utf8'));
for(const file of manifest.files){
  const bytes=await readFile(path.join(out,file.path));
  assert.equal(createHash('sha256').update(bytes).digest('hex'),file.sha256);
  const parts=file.path.split(path.sep);
  assert.ok(!parts.some(p=>p==='.env'||p.startsWith('.env.'))||file.path==='.env.example');
}
assert.ok(manifest.files.some(x=>x.path===path.join('docs','readme.md')));
assert.ok(manifest.files.some(x=>x.path==='.env.example'));
pass('normal export includes docs and root template; excludes root/nested env variants; manifest hashes match');
denied(execute(dir),/输出目录已存在/);pass('existing output rejected');
denied(execute(dir,'../outside'),/输出必须/);pass('outside output rejected');
dir=await fixture('source-link');await symlink(path.join(dir,'README.md'),path.join(dir,'frontend/linked.txt'));
denied(execute(dir),/拒绝符号链接/);pass('source file symlink rejected');
dir=await fixture('source-parent');await rename(path.join(dir,'backend'),path.join(dir,'backend-real'));await symlink('backend-real',path.join(dir,'backend'));
denied(execute(dir),/拒绝符号链接/);pass('allowlisted source ancestor symlink rejected');
dir=await fixture('output-parent');await mkdir(path.join(dir,'.runtime'));const external=path.join(run,'external-output');await mkdir(external);await symlink(external,path.join(dir,'.runtime/hand-in'));
denied(execute(dir),/拒绝符号链接/);assert.deepEqual(await readdir(external),[]);pass('output ancestor symlink rejected without writing destination');
dir=await fixture('runtime-link');await symlink(external,path.join(dir,'.runtime'));
denied(execute(dir),/拒绝符号链接/);assert.deepEqual(await readdir(external),[]);pass('runtime directory symlink rejected');
dir=await fixture('leak');await writeFile(path.join(dir,'docs/readme.md'),'password accidentally pasted: temporary-fixture-value-12345');
const leak=execute(dir);denied(leak,/发现配置值进入交付文件/);assert.ok(!leak.stderr.includes('temporary-fixture-value-12345'));pass('fake credential leakage detected without printing value');
dir=await fixture('private-link');await rename(path.join(dir,'.env'),path.join(dir,'private-config'));await symlink('private-config',path.join(dir,'.env'));
denied(execute(dir),/拒绝符号链接/);pass('private config symlink rejected');
dir=await fixture('public-loopback-url');
const localUrl='jdbc:mysql://127.0.0.1:23501/campus_course?useUnicode=true&characterEncoding=UTF-8&serverTimezone=UTC&allowPublicKeyRetrieval=true&useSSL=false';
await writeFile(path.join(dir,'.env'),'DB_URL='+localUrl+'\nDEMO_PASSWORD=temporary-fixture-value-12345\n');
await writeFile(path.join(dir,'backend/src/App.java'),'documented local default: '+localUrl);
assert.equal(execute(dir).status,0);pass('documented loopback URL is not confused with a credential');
dir=await fixture('credential-bearing-url');
const privateUrl='jdbc:mysql://127.0.0.1:23501/campus_course?password=temporary-fixture-value-12345';
await writeFile(path.join(dir,'.env'),'DB_URL='+privateUrl+'\n');
await writeFile(path.join(dir,'backend/src/App.java'),privateUrl);
denied(execute(dir),/发现配置值进入交付文件/);pass('credential-bearing connection URL still rejected');
const report={date:new Date().toISOString(),passed:results.length,results,scope:'isolated synthetic fixtures; no real credentials or services'};
await writeFile(path.join(runtime,'export-results.json'),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
