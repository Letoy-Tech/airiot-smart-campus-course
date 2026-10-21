import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const resource = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const option = name => process.argv.find(x => x.startsWith(name+'='))?.slice(name.length+1);
const requestedWork = option('--work-dir');
const work = requestedWork ? path.resolve(requestedWork) : fs.mkdtempSync(path.join(os.tmpdir(), 'campus-journey-validation-'));
if (requestedWork) fs.mkdirSync(work);
const app = path.join(work, 'app');
const evidence = option('--evidence-dir') ? path.resolve(option('--evidence-dir')) : path.join(resource, 'evidence');
if (fs.existsSync(path.join(evidence, 'author-verification.json'))) throw new Error('已有作者报告，保留旧证据并指定新的--evidence-dir。');
fs.mkdirSync(evidence, { recursive: true });
fs.cpSync(path.join(resource, 'app'), app, { recursive: true });
const node = process.execPath;
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const sha = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const report = { status: 'RUNNING', startedAt: new Date().toISOString(), node: process.version, platform: process.platform, isolatedCopy: true, dependencyInstall: 'npm ci from frozen lock; existing npm download cache may be reused', sourceManifestSha256: sha(fs.readFileSync(path.join(resource, 'BUILD-MANIFEST.json'))), toolTests: null, stages: [], backend: 'NOT_RUN', browser: 'NOT_RUN', database: 'NOT_RUN', windows: 'NOT_RUN', actualWorkDirectory: app };
const persist = () => fs.writeFileSync(path.join(evidence, 'author-verification.json'), JSON.stringify(report, null, 2) + '\n');
function run(label, command, args, cwd = app) {
  console.log(`CHECK ${label}`);
  const start = Date.now();
  const result = spawnSync(command, args, { cwd, encoding: 'utf8', env: process.env, shell: process.platform === 'win32' && command.endsWith('.cmd'), maxBuffer: 16 * 1024 * 1024 });
  fs.writeFileSync(path.join(evidence, `${label}.txt`), `$ ${path.basename(command)} ${args.join(' ')}\n${result.stdout || ''}${result.stderr || ''}`);
  const outcome = { label, command: [path.basename(command), ...args], exitCode: result.status, durationMs: Date.now() - start, log: `evidence/${label}.txt` };
  if (result.error || result.status !== 0) {
    report.failure = { ...outcome, reason: result.error?.message || 'command failed; inspect actual log' };
    throw new Error(`${label}失败，见${outcome.log}`);
  }
  return outcome;
}
try {
  report.toolTests = run('progress-tool-tests', node, ['--test', path.join(resource, 'authoring/progress.test.mjs')]);
  report.install = run('npm-ci', npm, ['ci', '--no-audit', '--no-fund'], path.join(app, 'frontend'));
  for (let stage = 1; stage <= 12; stage++) {
    const id = String(stage).padStart(2, '0');
    if (stage > 1) {
      run(`stage-${id}-begin`, node, ['tools/progress.mjs', 'begin', id]);
      if (stage === 2) {
        run('stage-02-environment', node, ['tools/course.mjs', 'doctor-env']);
        report.backendWithUnfinishedFrontend = run('stage-02-build-backend-before-business', node, ['tools/course.mjs', 'build-backend']);
      }
      run(`stage-${id}-apply-reference`, node, ['tools/progress.mjs', 'apply', id]);
    }
    // 证明真正个人改动可以一直保留；此文件后续包不再复制。
    if (stage === 1) {
      const file = path.join(app, 'frontend/src/project-settings.ts');
      fs.writeFileSync(file, fs.readFileSync(file, 'utf8').replace('智慧校园教学平台', '作者隔离验证项目'));
    }
    const result = run(`stage-${id}-verify`, node, ['tools/progress.mjs', 'verify']);
    const settingsPreserved = fs.readFileSync(path.join(app, 'frontend/src/project-settings.ts'), 'utf8').includes('作者隔离验证项目');
    if (!settingsPreserved) throw new Error('个人project-settings改动丢失');
    const state = JSON.parse(fs.readFileSync(path.join(app, 'journey-state.json'), 'utf8'));
    report.stages.push({ stage, ...result, sourceFingerprint: state.verification.sourceFingerprint, settingsPreserved, manualBusinessAcceptance: 'NOT_RUN', referenceImportedByAuthorFixture: true });
    persist();
  }
  if (process.env.JAVA_HOME) {
    report.backend = run('backend-package', process.platform === 'win32' ? 'mvnw.cmd' : 'sh', process.platform === 'win32' ? ['package'] : ['./mvnw', 'package'], path.join(app, 'backend'));
  }
  report.status = 'PASS_SOURCE_BUILD_CHECKS';
  report.finishedAt = new Date().toISOString();
  persist();
  console.log(JSON.stringify({ status: report.status, stages: report.stages.length, report: path.join(evidence, 'author-verification.json'), workDirectory: app }));
} catch (error) {
  report.status = 'FAIL'; report.finishedAt = new Date().toISOString(); persist();
  console.error(error.message); process.exitCode = 1;
}
