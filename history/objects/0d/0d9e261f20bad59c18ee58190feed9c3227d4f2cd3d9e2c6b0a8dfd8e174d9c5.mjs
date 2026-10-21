// 教师工具；student-checkpoints.mjs 明确排除此文件，不随学生起点分发。
// 前置：Node 22.21.1、Java 17、教师 frontend/node_modules、Maven 缓存、
// .private/test-database.json 指向明确允许 reset 的 campus_course_*_test 库。
// 运行：node tools/verify-student-checkpoints.mjs --allow-test-reset
// 只对 ch05/ch10 的独立 TEST 库运行数据库测试，不访问共享 lab 或浏览器。
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readPrivateJson } from './private-json.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.resolve(root, '../student-chapters');
const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const reportPath = path.join(output, 'verification.json');
const priorReport = fs.existsSync(reportPath) ? JSON.parse(fs.readFileSync(reportPath, 'utf8')) : null;
const env = { ...process.env, COURSE_TEST_MYSQL: 'false', COURSE_ALLOW_TEST_RESET: 'false' };
for (const key of ['COURSE_DB_URL', 'COURSE_DB_USERNAME', 'COURSE_DB_PASSWORD']) delete env[key];
const npm = process.platform === 'win32' ? 'npm.cmd' : path.join(path.dirname(process.execPath), 'npm');
const java = process.env.JAVA_HOME
  ? path.join(process.env.JAVA_HOME, 'bin', process.platform === 'win32' ? 'java.exe' : 'java')
  : 'java';
const expectedChapters = ['04', '05', '06', '07', '08', '09', '10', '11', '12'];
const report = {
  version: 2,
  at: new Date().toISOString(),
  status: 'RUNNING',
  scope: '九个学生起点结构、编译及指定任务断言失败；不代表学生完成，不运行共享lab/E2E',
  environment: { node: process.version, platform: `${process.platform}/${process.arch}` },
  dependencyStrategy: '隔离临时副本链接冻结node_modules，交付目录无依赖链接及编译输出',
  priorRun: priorReport ? { at: priorReport.at, completedAt: priorReport.completedAt, status: priorReport.status, sha256: hash(fs.readFileSync(reportPath)) } : null,
  chapters: [],
};
let scratch;
let secretValues = [];

function run(command, args, cwd, environment = env) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    // npm.cmd requires cmd.exe on Windows; no user-supplied text is interpolated.
    const windowsNpm = process.platform === 'win32' && command === npm;
    const child = spawn(windowsNpm ? 'cmd.exe' : command,
      windowsNpm ? ['/d', '/s', '/c', 'npm.cmd', ...args] : args,
      { cwd, env: environment });
    let text = '';
    child.stdout.on('data', data => { text += data; });
    child.stderr.on('data', data => { text += data; });
    child.on('error', () => reject(new Error('验证进程无法启动；检查 Node/npm/Java/Maven 环境')));
    child.on('close', exitCode => resolve({ exitCode, ms: Date.now() - start, text }));
  });
}
function maven(args, cwd, environment = env) {
  return process.platform === 'win32'
    ? run('cmd.exe', ['/d', '/s', '/c', 'mvnw.cmd', ...args], cwd, environment)
    : run('sh', ['./mvnw', ...args], cwd, environment);
}
function recordStep(chapter, name, result, expected) {
  const accepted = expected === 'PASS' ? result.exitCode === 0 : result.exitCode === 1;
  chapter.steps.push({ name, expected, exitCode: result.exitCode, durationMs: result.ms, accepted });
  assert.ok(accepted, `ch${chapter.chapter}: ${name}: unexpected exit ${result.exitCode}`);
}
function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name)).flatMap(entry => {
    assert.ok(!entry.isSymbolicLink(), '交付目录不允许符号链接');
    const file = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(file) : [file];
  });
}
function inside(base, file) {
  const relative = path.relative(base, file);
  return relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative);
}
const markerPattern = marker => new RegExp(`(^[ \\t]*// STUDENT_TODO_${marker}_BEGIN[^\\n]*\\n)([\\s\\S]*?)(^[ \\t]*// STUDENT_TODO_${marker}_END[^\\n]*)`, 'm');
function safeExcerpt(value) {
  let text = String(value ?? '').replace(/\u001b\[[0-9;]*m/g, '');
  for (const secret of secretValues) if (secret) text = text.split(secret).join('[REDACTED]');
  text = text.split(/\n\s*(?:at |❯ )/)[0].replace(/\s+/g, ' ').trim();
  return text.slice(0, 400);
}
function decodeXml(value) {
  return String(value ?? '').replace(/&#(x[\da-f]+|\d+);/gi, (_, number) => String.fromCodePoint(number[0].toLowerCase() === 'x' ? parseInt(number.slice(1), 16) : Number(number)))
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
}
const attribute = (tag, key) => decodeXml(tag.match(new RegExp(`(?:^|\\s)${key}="([^"]*)"`))?.[1]);
function readSurefire(dir) {
  const suites = [], failedTests = [];
  for (const name of fs.readdirSync(dir).filter(name => /^TEST-.*\.xml$/.test(name))) {
    const xml = fs.readFileSync(path.join(dir, name), 'utf8');
    const header = xml.match(/<testsuite\s[^>]+>/)?.[0] ?? '';
    suites.push({ name: attribute(header, 'name'), ...Object.fromEntries(['tests', 'failures', 'errors', 'skipped'].map(key => [key, Number(attribute(header, key))])) });
    for (const match of xml.matchAll(/<testcase\s([^>]+)>([\s\S]*?)<\/testcase>/g)) {
      const failure = match[2].match(/<failure\s([^>]+)>/);
      if (failure) failedTests.push({ name: attribute(match[1], 'name'), className: attribute(match[1], 'classname'), type: attribute(failure[1], 'type'), messageExcerpt: safeExcerpt(attribute(failure[1], 'message')) });
    }
  }
  return { suites, failedTests };
}
function checkStatic(chapter) {
  const base = path.join(output, 'ch' + chapter);
  const checkpoint = JSON.parse(fs.readFileSync(path.join(base, 'checkpoint.json'), 'utf8'));
  const files = walk(base), records = new Map(checkpoint.files.map(file => [file.path, file.sha256]));
  let links = 0, anchors = 0, restored = 0;
  for (const file of files) {
    const relative = path.relative(base, file).split(path.sep).join('/');
    assert.ok(!relative.split('/').some(part => ['.private', 'node_modules', 'target', 'dist', '.runtime', '.git', 'validation'].includes(part)), `禁止分发目录：${relative}`);
    assert.ok(!relative.startsWith('frontend/tools/'));
    assert.notEqual(relative, 'tools/verify-student-checkpoints.mjs');
    if (relative !== 'checkpoint.json') {
      assert.ok(records.has(relative));
      assert.equal(hash(fs.readFileSync(file)), records.get(relative), `文件哈希：${relative}`);
    }
    if (file.endsWith('.md')) for (const match of fs.readFileSync(file, 'utf8').matchAll(/(!?)\[([^\]\n]+)\]\((<[^>]+>|[^)\n]+)\)/g)) {
      const href = match[3].replace(/^<|>$/g, '');
      if (/^(https?:|mailto:|data:)/i.test(href)) continue;
      const [local, fragment] = href.split('#');
      const target = local ? path.resolve(path.dirname(file), decodeURIComponent(local)) : file;
      assert.ok(inside(base, target));
      assert.ok(fs.existsSync(target), `缺少链接目标：${relative}:${href}`);
      links++;
      if (fragment && target.endsWith('.md')) {
        const slugs = [...fs.readFileSync(target, 'utf8').matchAll(/^#{1,6}\s+(.+)$/gm)].map(match => match[1].replace(/[`*_~]/g, '').replace(/[^\p{L}\p{N}\p{M}_\-\s]/gu, '').trim().toLowerCase().replace(/\s+/g, '-'));
        assert.ok(slugs.includes(decodeURIComponent(fragment)), `缺少标题锚点：${relative}:${href}`);
        anchors++;
      }
    }
    if (/^(backend|frontend)\/src\//.test(relative)) {
      let student = fs.readFileSync(file, 'utf8');
      const teacher = fs.readFileSync(path.join(root, relative), 'utf8');
      for (const marker of checkpoint.markers.filter(marker => marker.file === relative)) {
        assert.equal((student.match(new RegExp(`STUDENT_TODO_${marker.marker}_BEGIN`, 'g')) ?? []).length, 1);
        assert.equal(hash(teacher), marker.referenceSha256);
        assert.equal(hash(student), marker.studentSha256);
        const match = teacher.match(markerPattern(marker.marker));
        assert.ok(match);
        student = student.replace(markerPattern(marker.marker), () => match[0]);
      }
      assert.equal(hash(student), hash(teacher), `内存恢复答案后不一致：${relative}`);
      restored++;
    }
  }
  assert.equal(records.size, files.length - 1);
  if (chapter === '11') {
    assert.equal(checkpoint.markers.length, 0);
    for (const term of ['C11-A', 'C11-B', 'C11-C', 'C11-D']) assert.ok(fs.readFileSync(path.join(base, 'docs/ch11-assertions.md'), 'utf8').includes(term));
  }
  return { chapter, studentTaskCompleted: false, markers: checkpoint.markers.map(marker => marker.marker), static: { files: files.length, hashesMatch: true, forbiddenPathsAbsent: true, symlinksAbsent: true, links, anchors, externalLinksConverted: checkpoint.linkAdjustments.length, restoredSourceFiles: restored, answersRestoreExactReferenceHash: true }, steps: [] };
}

const frontendTargets = {
  '04': ['src/tests/http.test.ts', 'src/tests/first-device-view.test.ts'],
  '06': ['src/tests/course-domain.test.ts', '-t', 'C06'],
  '08': ['src/tests/course-domain.test.ts', '-t', 'C08'],
  '12': ['src/tests/course-domain.test.ts', '-t', 'C12'],
};
const ch04Failures = [
  '页面事实与三态 online=true 明确显示 在线',
  '页面事实与三态 online=false 明确显示 离线',
  '页面事实与三态 online=null 明确显示 未知',
  '页面事实与三态 非法字符串不能冒充 Boolean 或合法未知',
  '统一请求边界 200 与非零业务码仍是失败',
  '统一请求边界 成功空数组仍保留后端观察时间',
];
async function compileAndTestFrontend(chapter) {
  const base = path.join(scratch, 'ch' + chapter.chapter), frontend = path.join(base, 'frontend'), backend = path.join(base, 'backend');
  recordStep(chapter, 'fixture schema', await run(process.execPath, ['tools/validate-fixtures.mjs'], base), 'PASS');
  const [front, back] = await Promise.all([
    run(npm, ['run', 'build'], frontend),
    maven(['-B', '-q', '-o', '-DskipTests', 'compile'], backend),
  ]);
  recordStep(chapter, 'frontend type-check + build', front, 'PASS');
  recordStep(chapter, 'backend compile -DskipTests', back, 'PASS');
  const json = path.join(base, 'tests.json');
  const expected = frontendTargets[chapter.chapter] ? 'EXPECTED_FAILURE' : 'PASS';
  const result = await run(npm, ['run', 'test:unit', '--', '--run', ...(frontendTargets[chapter.chapter] ?? []), '--reporter=json', `--outputFile=${json}`], frontend);
  recordStep(chapter, 'frontend selected tests', result, expected);
  const parsed = JSON.parse(fs.readFileSync(json, 'utf8'));
  const failedTests = parsed.testResults.flatMap(suite => suite.assertionResults.filter(test => test.status === 'failed').map(test => ({ name: test.fullName, messageExcerpt: safeExcerpt(test.failureMessages?.[0]) })));
  if (expected === 'PASS') assert.equal(parsed.numFailedTests, 0);
  else if (chapter.chapter === '04') assert.deepEqual(failedTests.map(test => test.name).sort(), [...ch04Failures].sort());
  else {
    assert.equal(failedTests.length, 1);
    assert.ok(failedTests[0].name.includes('C' + chapter.chapter));
    assert.ok(failedTests[0].messageExcerpt.includes('AssertionError'), '预期失败必须来自任务断言');
  }
  assert.equal(parsed.numFailedTests, failedTests.length);
  chapter.frontendTests = { total: parsed.numTotalTests, passed: parsed.numPassedTests, failed: parsed.numFailedTests, skipped: parsed.numPendingTests, failedNames: failedTests.map(test => test.name), failedTests, expectedTaskFailuresVerified: expected === 'EXPECTED_FAILURE' };
  console.log(`ch${chapter.chapter} 编译和前端测试：${expected}`);
}

const backendTargets = [
  { chapter: '05', target: 'TeacherDbTest#spaceBindingRejectsMissingReferences', database: true, patterns: [/404/, /501/], reason: '空间绑定应拒绝未知空间为404；未完成的C05返回501。' },
  { chapter: '07', target: 'QualityPolicyTest#qualityBoundariesAndMalformedTypes', database: false, patterns: [/fresh/, /missing/], reason: '有效点值应判为fresh；未完成的C07固定返回missing。' },
  { chapter: '09', target: 'CloseRulesTest#eachMissingCloseConditionIsIndependentlyRejected', database: false, patterns: [/TODO_C09/], reason: '完整关闭条件应通过；未完成的C09抛出TODO_C09。' },
  { chapter: '10', target: 'TeacherDbTest#ownerRequiresCurrentVersionAndChangesOnlyFutureAssignment', database: true, patterns: [/200/, /501/], reason: '合法责任变更应返回200；未完成的C10返回501。' },
  { chapter: '11', target: '*Test', database: false, patterns: [] },
];

try {
  assert.ok(process.argv.includes('--allow-test-reset'), '需显式 --allow-test-reset，仅允许教师授权的独立TEST库');
  assert.equal(process.version, 'v22.21.1', '请使用课程冻结的Node22.21.1');
  const npmVersion = await run(npm, ['--version'], root);
  const javaVersion = await run(java, ['-version'], root);
  assert.equal(npmVersion.exitCode, 0);
  assert.equal(javaVersion.exitCode, 0);
  report.environment.npm = npmVersion.text.trim();
  report.environment.java = javaVersion.text.match(/version\s+"([^"]+)"/)?.[1];
  assert.match(report.environment.java ?? '', /^17\./, '请使用Java17');
  const manifest = JSON.parse(fs.readFileSync(path.join(output, 'manifest.json'), 'utf8'));
  assert.deepEqual(manifest.chapters.map(chapter => chapter.chapter), expectedChapters);
  const config = readPrivateJson(path.join(root, '.private/test-database.json'));
  assert.ok(typeof config.url === 'string' && config.url.startsWith('jdbc:mysql://'), '测试数据库配置必须使用MySQL');
  const schema = new URL(config.url.replace(/^jdbc:/, '')).pathname.slice(1);
  assert.equal(config.allowTestReset, true, '配置未授权独立TEST库重置');
  assert.match(schema, /^campus_course_[A-Za-z0-9_]+$/);
  assert.ok(schema.endsWith('_test'), '拒绝非TEST数据库');
  secretValues = [config.url, config.username, config.password].filter(value => typeof value === 'string' && value.length > 3);
  const dbEnv = { ...env, COURSE_TEST_MYSQL: 'true', COURSE_ALLOW_TEST_RESET: 'true', COURSE_DB_URL: config.url, COURSE_DB_USERNAME: config.username, COURSE_DB_PASSWORD: config.password, COURSE_DB_MIGRATE: 'true' };
  report.testDatabase = { schema, explicitReset: true, scope: '独立TEST教学表，非lab' };
  scratch = fs.mkdtempSync(path.join(os.tmpdir(), 'campus-student-verification-'));
  for (const chapter of expectedChapters) {
    report.chapters.push(checkStatic(chapter));
    const temp = path.join(scratch, 'ch' + chapter);
    fs.cpSync(path.join(output, 'ch' + chapter), temp, { recursive: true });
    fs.symlinkSync(path.join(root, 'frontend/node_modules'), path.join(temp, 'frontend/node_modules'), process.platform === 'win32' ? 'junction' : 'dir');
    const vite = path.join(temp, 'frontend/vite.config.ts');
    const original = fs.readFileSync(vite, 'utf8');
    assert.ok(original.includes('plugins:'));
    fs.writeFileSync(vite, original.replace('plugins:', "cacheDir: './.isolated-cache', plugins:"));
  }
  console.log('9份静态检查通过；开始隔离编译与指定断言验证');
  let next = 0;
  const workers = await Promise.allSettled([0, 1].map(async () => {
    while (next < report.chapters.length) await compileAndTestFrontend(report.chapters[next++]);
  }));
  const rejected = workers.find(worker => worker.status === 'rejected');
  if (rejected) throw rejected.reason;
  for (const spec of backendTargets) {
    const chapter = report.chapters.find(chapter => chapter.chapter === spec.chapter);
    const backend = path.join(scratch, 'ch' + spec.chapter, 'backend');
    const expected = spec.chapter === '11' ? 'PASS' : 'EXPECTED_FAILURE';
    const result = await maven(['-B', '-q', '-o', `-Dtest=${spec.target}`, 'test'], backend, spec.database ? dbEnv : env);
    recordStep(chapter, `backend ${spec.target}${spec.database ? ' [isolated TEST DB]' : ''}`, result, expected);
    const { suites, failedTests } = readSurefire(path.join(backend, 'target/surefire-reports'));
    chapter.backendTests = { usesDatabase: spec.database, target: spec.target, suites, failedTests, expectedTaskFailuresVerified: false };
    assert.ok(suites.length);
    assert.equal(suites.reduce((count, suite) => count + suite.errors, 0), 0, '运行异常不能算预期任务失败');
    const failures = suites.reduce((count, suite) => count + suite.failures, 0);
    if (expected === 'PASS') assert.equal(failures, 0);
    else {
      assert.equal(failures, 1);
      assert.equal(failedTests.length, 1);
      assert.equal(failedTests[0].name, spec.target.split('#')[1]);
      assert.match(failedTests[0].type, /Assertion/);
      for (const pattern of spec.patterns) assert.match(failedTests[0].messageExcerpt, pattern, '失败原因与指定TODO不一致');
      failedTests[0].reason = spec.reason;
    }
    chapter.backendTests.expectedTaskFailuresVerified = expected === 'EXPECTED_FAILURE';
    console.log(`ch${spec.chapter} 后端：${expected}（已核对方法名、断言类型与原因）`);
  }
  for (const chapter of report.chapters) {
    checkStatic(chapter.chapter); // 再确认实际执行没有写回交付副本。
    chapter.validationStatus = 'PASS';
    if (chapter.chapter === '11') chapter.assertionTemplate = '四组空白预测/断言仍待本人填写；教师测试通过不是学生完成';
  }
  report.status = 'PASS_STARTER_VALIDATION';
  report.completedAt = new Date().toISOString();
  report.noSharedLabOrE2E = true;
  report.answerRestoration = 'in-memory only; delivered holes remain';
  report.postValidationHashesMatch = true;
} catch (error) {
  report.status = 'FAIL';
  report.failure = safeExcerpt(error.message);
  process.exitCode = 1;
} finally {
  if (scratch) fs.rmSync(scratch, { recursive: true, force: true });
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2) + '\n');
  console.log(`状态 ${report.status}；已清理本次临时副本，不输出凭据或原始测试日志`);
}
