import {execFileSync} from 'node:child_process';
import {accessSync,constants,realpathSync,statSync} from 'node:fs';
import path from 'node:path';
import {parseArgs} from 'node:util';
import net from 'node:net';
let options;
try {
  options=parseArgs({options:{native:{type:'boolean'},mysqld:{type:'string'},mysql:{type:'string'},'redis-server':{type:'string'}}}).values;
} catch {
  console.error('参数无效：可用 --native，以及 --mysqld / --mysql / --redis-server 后接已安装程序路径。');
  process.exit(1);
}
const mode = options.native ? 'native' : 'docker';
function isExecutable(file) {
  try {accessSync(file,constants.X_OK);return statSync(file).isFile();} catch {return false;}
}
function onPath(name) {
  return (process.env.PATH||'').split(path.delimiter).map(dir=>path.resolve(dir,name)).find(isExecutable);
}
const results = [];
function check(name, command, args, accept) {
  try {
    const output = execFileSync(command, args, {encoding:'utf8', timeout:12000, stdio:['ignore','pipe','pipe']});
    results.push({name, status:accept(output)?'PASS':'CHECK_VERSION'});
  } catch (error) {
    // Java writes its version to stderr even when successful; use java --version below.
    results.push({name, status:'UNAVAILABLE'});
  }
}
results.push({name:'Node 22', status:process.versions.node.startsWith('22.')?'PASS':'CHECK_VERSION'});
check('Java 17','java',['--version'],s=>/\b(?:openjdk|java)\s+17[.\s]/.test(s));
check('Git','git',['--version'],s=>s.startsWith('git version'));
if (mode==='docker') {
  check('Docker Server','docker',['version','--format','{{.Server.Version}}'],s=>/^\d/.test(s.trim()));
  check('Compose','docker',['compose','version','--short'],s=>/^v?\d/.test(s.trim()));
} else {
  results.push({name:'Native macOS/Linux',status:['darwin','linux'].includes(process.platform)?'PASS':'UNSUPPORTED'});
  check('Python 3','python3',['--version'],s=>/^Python 3\./.test(s));
  const mysqld=options.mysqld||onPath('mysqld')||'mysqld';
  let resolvedServer=mysqld;
  try {resolvedServer=realpathSync(mysqld);} catch {}
  const sibling=path.resolve(path.dirname(resolvedServer),'mysql');
  const mysql=options.mysql||(isExecutable(sibling)?sibling:onPath('mysql'))||'mysql';
  check('MySQL 8.4 server',mysqld,['--version'],s=>/\b8\.4\./.test(s));
  check('MySQL 8.4 client',mysql,['--version'],s=>/\b8\.4\./.test(s));
  check('Redis 7.2+',options['redis-server']||'redis-server',['--version'],s=>{const m=s.match(/v=(\d+)\.(\d+)/);return m&&(Number(m[1])>7||(Number(m[1])===7&&Number(m[2])>=2));});
}
for(const port of [5188,8098,23501,23502]) {
 const status=await new Promise(resolve=>{const server=net.createServer();server.once('error',()=>resolve('BUSY'));server.listen(port,'127.0.0.1',()=>server.close(()=>resolve('PASS')));});
 results.push({name:`127.0.0.1:${port}`,status});
}
console.log(JSON.stringify({mode,checks:results,note:'首次启动前使用；BUSY 仅表示占用，不判断占用者，也不会停止进程。结果不含凭据；通过不等于课堂或业务验收。'},null,2));
if(results.some(r=>r.status!=='PASS'))process.exitCode=1;
