import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { safePath, readState, importStage, fingerprint, verify, accept, plan } from './progress.mjs';

const sha = value => crypto.createHash('sha256').update(value).digest('hex');
function write(root, relative, value) { const file = path.join(root, relative); fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, typeof value === 'object' ? JSON.stringify(value) : value); }
function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'journey-tool-test-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  write(root, 'frontend/src/project-settings.ts', 'export const title="mine"');
  const one = { schema: 1, stage: 1, title: '静态起点', files: [], acceptance: '人工观察两设备' };
  const bytes = '<template><h1>参考业务</h1></template>';
  const stub = '<template>JOURNEY_IMPLEMENTATION_REQUIRED</template>';
  const two = { schema: 1, stage: 2, title: '业务页', acceptance: '人工HTTP读取', files: [{ path: 'frontend/src/views/Read.vue', role: 'business', sha256: sha(bytes), stub }] };
  write(root, 'lesson-bundles/stage-01/manifest.json', one);
  write(root, 'lesson-bundles/stage-02/manifest.json', two);
  write(root, 'lesson-bundles/stage-02/files/frontend/src/views/Read.vue', bytes);
  write(root, 'journey-state.json', { schema: 1, stage: 1, managed: { 'frontend/src/project-settings.ts': sha('export const title="mine"') }, history: [], verification: null });
  return { root, bytes, two };
}
function verified(root) {
  const state = readState(root);
  state.verification = { stage: state.stage, sourceFingerprint: fingerprint(root) };
  write(root, 'journey-state.json', state);
}
test('路径不能逃逸，也不能写入秘密或依赖目录', t => {
  const { root } = fixture(t);
  for (const file of ['../secret', '/tmp/secret', 'frontend/../secret', '.private/accounts.json', '.codebuddy/models.json', 'frontend/node_modules/x', 'a\\b']) assert.throws(() => safePath(root, file));
});
test('符号链接目标不能被导入覆盖', t => {
  const { root } = fixture(t);
  fs.symlinkSync(os.tmpdir(), path.join(root, 'outside'));
  assert.throws(() => safePath(root, 'outside/file.txt'), /符号链接/);
});
test('上一站未验证时不允许推进', t => {
  const { root } = fixture(t);
  assert.throws(() => importStage(root, '02', 'begin'), /上一站/);
  assert.equal(readState(root).stage, 1);
});
test('验证后改源码必须重验，不能沿用旧PASS', t => {
  const { root } = fixture(t); verified(root);
  write(root, 'frontend/src/project-settings.ts', 'export const title="student changed"');
  assert.throws(() => importStage(root, '02', 'begin'), /验证后又改/);
});
test('begin写入明确骨架，并保留第一站个人设置', t => {
  const { root } = fixture(t); verified(root);
  importStage(root, '02', 'begin');
  assert.match(fs.readFileSync(path.join(root, 'frontend/src/views/Read.vue'), 'utf8'), /JOURNEY_IMPLEMENTATION_REQUIRED/);
  assert.equal(fs.readFileSync(path.join(root, 'frontend/src/project-settings.ts'), 'utf8'), 'export const title="mine"');
  assert.equal(readState(root).mode, 'SKELETON_READY');
  assert.throws(() => verify(root, () => assert.fail('不得执行构建')), /还未实现/);
});
test('重复begin不会重置学生已经写的文件', t => {
  const { root } = fixture(t); verified(root); importStage(root, '02', 'begin');
  write(root, 'frontend/src/views/Read.vue', '<template>我的实现</template>');
  importStage(root, '02', 'begin');
  assert.match(fs.readFileSync(path.join(root, 'frontend/src/views/Read.vue'), 'utf8'), /我的实现/);
});
test('apply只能安全替换原样骨架，备份保留', t => {
  const { root, bytes } = fixture(t); verified(root); importStage(root, '02', 'begin');
  importStage(root, '02', 'apply');
  assert.equal(fs.readFileSync(path.join(root, 'frontend/src/views/Read.vue'), 'utf8'), bytes);
  assert.ok(fs.readdirSync(path.join(root, 'journey-backups')).length >= 2);
});
test('个人实现与参考冲突时不改源码，保存双方供比较', t => {
  const { root } = fixture(t); verified(root); importStage(root, '02', 'begin');
  const mine = '<template>我自己的行为</template>';
  write(root, 'frontend/src/views/Read.vue', mine);
  assert.throws(() => importStage(root, '02', 'apply'), /源码冲突/);
  assert.equal(fs.readFileSync(path.join(root, 'frontend/src/views/Read.vue'), 'utf8'), mine);
  const backups = fs.readdirSync(path.join(root, 'journey-backups'));
  const conflict = backups.find(name => name.includes('conflict'));
  assert.ok(conflict);
  assert.equal(fs.readFileSync(path.join(root, 'journey-backups', conflict, 'before/frontend/src/views/Read.vue'), 'utf8'), mine);
});
test('参考包被改坏时拒绝，不能用任意源码冒充已冻结参考', t => {
  const { root } = fixture(t); verified(root);
  write(root, 'lesson-bundles/stage-02/files/frontend/src/views/Read.vue', 'changed');
  assert.throws(() => importStage(root, '02', 'apply'), /参考源码损坏/);
  assert.equal(readState(root).stage, 1);
});
test('verify接受学生实现；运行三项检查而非比较答案hash', t => {
  const { root } = fixture(t); verified(root); importStage(root, '02', 'begin');
  write(root, 'frontend/src/views/Read.vue', '<template>学生等价实现</template>');
  const commands = [];
  verify(root, (_root, args) => commands.push(args));
  assert.deepEqual(commands, [['run', 'type-check'], ['run', 'test:unit', '--', '--run'], ['run', 'build']]);
  assert.equal(readState(root).verification.frontendBuild, 'PASS');
  assert.equal(readState(root).verification.businessAcceptance, 'NOT_CHECKED');
});
test('检查中发生源码变化不能登记通过', t => {
  const { root } = fixture(t); verified(root); importStage(root, '02', 'apply');
  let changed = false;
  assert.throws(() => verify(root, () => { if (!changed) { write(root, 'frontend/src/project-settings.ts', 'changed during check'); changed = true; } }), /检查期间源码发生变化/);
  assert.equal(readState(root).verification, null);
});
test('人工记录独立登记，秘密路径不允许', t => {
  const { root } = fixture(t); verified(root);
  assert.throws(() => accept(root, '01', '.private/accounts.json'), /记录须为/);
  write(root, 'evidence/stage-01.md', '# 本人记录\n我实际打开了页面，看到两台明确标记为模拟的设备；我改了项目名称并保存。没有执行真实校园接入。');
  accept(root, '01', 'evidence/stage-01.md');
  assert.equal(readState(root).manualAcceptance.status, 'STUDENT_RECORDED_NOT_AUTOMATICALLY_VERIFIED');
});

// 既有学生文件不进入新增文件导入，plan仍必须列明后续组装任务。
test('跨站integrationFiles明确列出，但begin保留本人旧页面', t => {
  const { root, two } = fixture(t);
  const existing = 'frontend/src/views/MyPrevious.vue';
  const mine = '<template>学生前章自定义筛选</template>';
  write(root, existing, mine); two.integrationFiles = [existing];
  write(root, 'lesson-bundles/stage-02/manifest.json', two);
  const lines = []; const original = console.log; console.log = (...args) => lines.push(args.join(' '));
  try { plan(root, '02'); } finally { console.log = original; }
  assert.match(lines.join('\n'), /继续修改（begin不会覆盖）/);
  verified(root); importStage(root, '02', 'begin');
  assert.equal(fs.readFileSync(path.join(root, existing), 'utf8'), mine);
});
test('跨站目标不能借清单指向私密目录或缺失的旧文件', t => {
  const { root, two } = fixture(t); verified(root);
  two.integrationFiles = ['.private/accounts.json']; write(root, 'lesson-bundles/stage-02/manifest.json', two);
  assert.throws(() => importStage(root, '02', 'begin'), /不安全/);
  two.integrationFiles = ['frontend/src/views/Missing.vue']; write(root, 'lesson-bundles/stage-02/manifest.json', two);
  assert.throws(() => importStage(root, '02', 'begin'), /跨站组装文件缺失/);
  assert.equal(readState(root).stage, 1);
});
