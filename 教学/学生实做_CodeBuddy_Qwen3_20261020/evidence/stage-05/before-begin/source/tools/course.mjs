import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import net from 'node:net';
import { spawnSync, spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readPrivateJson } from './private-json.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const windows = process.platform === 'win32';
const action = process.argv[2];
const privateFile = path.join(root, '.private', 'accounts.json');
const accountSpecs = [
  ['admin', 'COURSE_ADMIN_PASSWORD'], ['manager-a', 'COURSE_MANAGER_A_PASSWORD'],
  ['manager-b', 'COURSE_MANAGER_B_PASSWORD'], ['viewer', 'COURSE_VIEWER_PASSWORD'],
];
const java = process.env.JAVA_HOME ? path.join(process.env.JAVA_HOME, 'bin', windows ? 'java.exe' : 'java') : 'java';
const npm = windows ? 'npm.cmd' : 'npm';

function versionCheck() {
  if (!process.env.JAVA_HOME || !fs.existsSync(java)) throw new Error('先设置JAVA_HOME到JDK17根目录；doctor与Maven Wrapper使用同一JDK。');
  const [major, minor] = process.versions.node.split('.').map(Number);
  if (major !== 22 || minor < 12) throw new Error('本资源包冻结 Node 22（至少22.12）；请切换到22.21.1后重试。');
  const result = spawnSync(java, ['-version'], { encoding: 'utf8' });
  const output = `${result.stdout || ''}${result.stderr || ''}`;
  if (result.status !== 0 || !/version "17[.\"]/.test(output)) throw new Error('需要 JDK 17。用 JAVA_HOME 指向JDK根目录，再运行 doctor。');
  return output.split('\n')[0];
}
function run(command, args, cwd = root, env = process.env) {
  // Windows .cmd 需要命令解释器；所有参数均为本脚本固定常量，无用户拼接文本。
  const result = spawnSync(command, args, { cwd, env, stdio: 'inherit', shell: windows && command.endsWith('.cmd') });
  if (result.error) throw new Error(result.error.message);
  if (result.status !== 0) throw new Error(`命令失败，退出码 ${result.status}: ${path.basename(command)} ${args.join(' ')}`);
}
function maven(args) {
  const cwd = path.join(root, 'backend');
  if (windows) run('mvnw.cmd', args, cwd);
  else run('sh', ['./mvnw', ...args], cwd);
}
async function freePort(port) {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', () => reject(new Error(`127.0.0.1:${port} 已占用；先确认占用进程，本脚本不会结束它。`)));
    server.listen(port, '127.0.0.1', () => server.close(resolve));
  });
}
function databaseCredentials(test = false) {
  const file = path.join(root, '.private', test ? 'test-database.json' : 'database.json');
  if (!fs.existsSync(file)) throw new Error('请教师先配置 .private/database.json（见 docs/02-教师数据库交接单.md），不要把数据库密码交给网页AI。');
  const value = readPrivateJson(file);
  if (typeof value.url !== 'string' || !value.url.startsWith('jdbc:mysql://') || typeof value.username !== 'string' || !value.username || typeof value.password !== 'string' || !value.password) throw new Error('数据库配置需要 url、username、password 三个非空字符串。');
  return { COURSE_DB_URL: value.url, COURSE_DB_USERNAME: value.username, COURSE_DB_PASSWORD: value.password };
}
function localCredentials() {
  if (!fs.existsSync(privateFile)) throw new Error('先运行 node tools/course.mjs init 生成本机教学账号。');
  const data = readPrivateJson(privateFile);
  const env = { ...process.env };
  for (const [username, variable] of accountSpecs) {
    const password = data.accounts?.find(item => item.username === username)?.password;
    if (typeof password !== 'string' || password.length < 16) throw new Error('本地账号文件格式无效；保留文件并由教师检查，脚本不覆盖。');
    env[variable] = password;
  }
  return env;
}
async function main() {
  if (action === 'doctor') {
    console.log(`Node ${process.versions.node}; ${versionCheck()}; ${process.platform}/${process.arch}`);
    const checks = ['backend/pom.xml', 'backend/mvnw', 'backend/mvnw.cmd', 'frontend/package-lock.json', 'fixtures/catalog.json'];
    for (const file of checks) if (!fs.existsSync(path.join(root, file))) throw new Error(`缺少 ${file}`);
    await freePort(8091); await freePort(5178);
    console.log('文件与两个端口检查通过。尚未检查教师数据库、依赖下载或Windows实机兼容性。');
  } else if (action === 'init') {
    versionCheck();
    fs.mkdirSync(path.dirname(privateFile), { recursive: true, mode: 0o700 });
    const value = { purpose: '仅本机教学；不要上传、粘贴给AI或打入交付包', createdAt: new Date().toISOString(), accounts: accountSpecs.map(([username]) => ({ username, password: crypto.randomBytes(18).toString('base64url') })) };
    try { fs.writeFileSync(privateFile, JSON.stringify(value, null, 2) + '\n', { flag: 'wx', mode: 0o600 }); }
    catch (error) { if (error.code === 'EEXIST') { console.log('本地账号文件已存在，保留原内容。'); return; } throw error; }
    console.log('已生成 .private/accounts.json。用本机编辑器查看；密码不输出到终端。Windows文件权限沿用本机用户目录权限。');
  } else if (['backend', 'backend-db', 'migrate'].includes(action)) {
    versionCheck(); if (action !== 'migrate') await freePort(8091);
    const env = localCredentials();
    const full = action !== 'backend';
    env.SPRING_PROFILES_ACTIVE = full ? 'teacher-db' : 'first-chain';
    if (full) Object.assign(env, databaseCredentials());
    env.COURSE_DB_MIGRATE = action === 'migrate' ? 'true' : 'false';
    env.COURSE_CATALOG_PATH = path.join(root, 'fixtures', 'catalog.json');
    env.SERVER_PORT = '8091';
    const jar = path.join(root, 'backend', 'target', 'campus-ai-course-0.1.0.jar');
    if (!fs.existsSync(jar)) throw new Error('缺少后端JAR，先执行 node tools/course.mjs build。');
    console.log(action === 'migrate' ? '只对 .private/database.json 指定的课程库应用 Flyway 新迁移；请先核对教师交接单。' : full ? '启动 teacher-db 完整教学工程，绑定127.0.0.1:8091；不会自动迁移数据库。Ctrl+C停止。' : '启动本工程 first-chain，绑定127.0.0.1:8091，不连接数据库。Ctrl+C停止。');
    const args = ['-jar', jar];
    if (action === 'migrate') args.push('--spring.main.web-application-type=none', '--course.migrate-only=true');
    const child = spawn(java, args, { cwd: root, env, stdio: 'inherit' });
    child.on('error', error => { console.error(error.message); process.exitCode = 1; });
    child.on('exit', (code, signal) => { if (code && signal !== 'SIGINT') process.exitCode = code; });
    process.on('SIGINT', () => { if (!child.killed) child.kill('SIGINT'); });
    process.on('SIGTERM', () => { if (!child.killed) child.kill('SIGTERM'); });
  } else if (action === 'frontend') {
    versionCheck(); await freePort(5178);
    run(npm, ['run', 'dev'], path.join(root, 'frontend'));
  } else if (action === 'check') {
    versionCheck();
    run(process.execPath, ['tools/validate-fixtures.mjs']);
    maven(['test']);
    run(npm, ['run', 'type-check'], path.join(root, 'frontend'));
    run(npm, ['run', 'test:unit', '--', '--run'], path.join(root, 'frontend'));
  } else if (action === 'build') {
    versionCheck();
    maven(['package']);
    run(npm, ['run', 'build'], path.join(root, 'frontend'));
  } else throw new Error('用法：node tools/course.mjs doctor|init|backend|backend-db|migrate|frontend|check|build');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
