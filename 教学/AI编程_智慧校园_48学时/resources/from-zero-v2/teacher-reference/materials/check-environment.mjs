import {execFileSync} from 'node:child_process';
import net from 'node:net';
const mode = process.argv.includes('--native') ? 'native' : 'docker';
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
  check('MySQL 8.4 on PATH','mysqld',['--version'],s=>/\b8\.4\./.test(s));
  check('Redis 7.2+ on PATH','redis-server',['--version'],s=>{const m=s.match(/v=(\d+)\.(\d+)/);return m&&(Number(m[1])>7||(Number(m[1])===7&&Number(m[2])>=2));});
}
for(const port of [5188,8098,23501,23502]) {
 const status=await new Promise(resolve=>{const server=net.createServer();server.once('error',()=>resolve('BUSY'));server.listen(port,'127.0.0.1',()=>server.close(()=>resolve('PASS')));});
 results.push({name:`127.0.0.1:${port}`,status});
}
console.log(JSON.stringify({mode,checks:results,note:'首次启动前使用；BUSY 仅表示占用，不判断占用者，也不会停止进程。结果不含凭据；通过不等于课堂或业务验收。'},null,2));
if(results.some(r=>r.status!=='PASS'))process.exitCode=1;
