import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const resource = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidence = path.join(resource, 'evidence');
const build = JSON.parse(fs.readFileSync(path.join(evidence, 'author-verification.json'), 'utf8'));
const app = build.actualWorkDirectory;
if (!app || !build.isolatedCopy || !fs.existsSync(path.join(app, 'journey-state.json'))) throw new Error('只使用作者隔离验证副本，不修改交付app或参考。');
const file = path.join(app, 'frontend/src/api/campus.ts');
const original = fs.readFileSync(file);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const correct = original.toString();
const marker = 'if (response.code !== 0) throw new ApiError';
if (correct.split(marker).length !== 2) throw new Error('故障注入边界变化，停止，不猜替换。');
const report = { status: 'RUNNING', sourceManifestSha256: build.sourceManifestSha256, beforeSha256: hash(original), actualWorkDirectory: app, cases: [], browser: 'NOT_RUN', database: 'NOT_RUN' };
function run(label, expectedFailure) {
  const jsonPath = path.join(evidence, `debug-${label}.json`);
  const args = ['--prefix', 'frontend', 'run', 'test:unit', '--', '--run', 'src/tests/http.test.ts', '--reporter=json', `--outputFile=${jsonPath}`];
  const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { cwd: app, encoding: 'utf8', shell: process.platform === 'win32', maxBuffer: 4 * 1024 * 1024 });
  fs.writeFileSync(path.join(evidence, `debug-${label}.txt`), `$ npm ${args.join(' ')}\n${result.stdout || ''}${result.stderr || ''}`);
  if (!fs.existsSync(jsonPath)) throw new Error('没有测试JSON，不能把环境错误当作预期失败');
  const testResult = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const failed = testResult.testResults.flatMap(suite => suite.assertionResults.filter(item => item.status === 'failed').map(item => ({ name: item.fullName, reason: item.failureMessages.join('\n').slice(0, 500) })));
  if (expectedFailure) {
    if (result.status === 0 || !failed.some(item => item.name.includes('成功空数组仍保留后端观察时间'))) throw new Error('未出现指定业务断言失败，不能算故障复现');
  } else if (result.status !== 0 || testResult.numFailedTests !== 0 || testResult.numPassedTests < 1) throw new Error('恢复后原测试没有通过');
  return { label, exitCode: result.status, passed: testResult.numPassedTests, failed: testResult.numFailedTests, failures: failed, sourceSha256: hash(fs.readFileSync(file)) };
}
try {
  fs.writeFileSync(file, correct.replace(marker, 'if (response.code === 0) throw new ApiError'));
  report.cases.push(run('wrong', true));
  fs.writeFileSync(file, original);
  report.cases.push(run('restored', false));
  report.status = 'PASS_EXPECTED_ASSERTION_FAILURE_THEN_RESTORED';
} finally {
  fs.writeFileSync(file, original);
  report.restoredSha256 = hash(fs.readFileSync(file));
  report.restoredExactly = report.beforeSha256 === report.restoredSha256;
  report.finishedAt = new Date().toISOString();
  fs.writeFileSync(path.join(evidence, 'debug-wrong-fixed.json'), JSON.stringify(report, null, 2) + '\n');
}
console.log(JSON.stringify({ status: report.status, cases: report.cases.map(x => ({ label: x.label, passed: x.passed, failed: x.failed })), restoredExactly: report.restoredExactly }));
