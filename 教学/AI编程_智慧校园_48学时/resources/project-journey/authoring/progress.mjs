import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const hash = value => crypto.createHash('sha256').update(value).digest('hex');
const prohibited = new Set(['.private', '.codebuddy', '.git', 'node_modules', 'target', 'dist', '.runtime', 'journey-backups', 'lesson-bundles']);
const json = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const save = (file, value) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); };
const pad = number => String(number).padStart(2, '0');

export function safePath(root, relative) {
  if (typeof relative !== 'string' || !relative || relative.includes('\\') || path.isAbsolute(relative) || relative.split('/').some(part => !part || part === '..' || part === '.' || prohibited.has(part))) throw new Error(`不安全的源码路径：${relative}`);
  const destination = path.resolve(root, relative);
  if (!destination.startsWith(path.resolve(root) + path.sep)) throw new Error('路径越出 app，已拒绝。');
  let current = path.resolve(root);
  for (const part of relative.split('/')) {
    current = path.join(current, part);
    if (fs.existsSync(current) && fs.lstatSync(current).isSymbolicLink()) throw new Error(`拒绝向符号链接写入：${relative}`);
  }
  return destination;
}

function filesUnder(root, relative = '') {
  if (!fs.existsSync(root)) return [];
  return fs.readdirSync(root, { withFileTypes: true }).flatMap(entry => {
    if (prohibited.has(entry.name) || entry.name.startsWith('.DS_Store')) return [];
    const rel = relative ? `${relative}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) return [];
    return entry.isDirectory() ? filesUnder(path.join(root, entry.name), rel) : [rel];
  });
}

export function fingerprint(root) {
  const records = filesUnder(root).filter(file => /^(frontend|backend|fixtures)\//.test(file) || file.startsWith('tools/') || file === 'package.json')
    .sort().map(file => [file, hash(fs.readFileSync(path.join(root, file)))]);
  return hash(JSON.stringify(records));
}

export function readState(root) {
  const state = json(path.join(root, 'journey-state.json'));
  if (state.schema !== 1 || !Number.isInteger(state.stage) || state.stage < 1 || state.stage > 12 || !state.managed || !Array.isArray(state.history)) throw new Error('journey-state.json 无效。保留文件，请教师核对；不要删除进度重新导入。');
  return state;
}

function stageData(root, input) {
  if (!/^\d{1,2}$/.test(String(input))) throw new Error('站号应为01—12。');
  const stage = Number(input);
  if (stage < 1 || stage > 12) throw new Error('站号应为01—12。');
  const directory = path.join(root, 'lesson-bundles', `stage-${pad(stage)}`);
  const manifest = json(path.join(directory, 'manifest.json'));
  if (manifest.schema !== 1 || manifest.stage !== stage || !Array.isArray(manifest.files)) throw new Error('阶段清单无效。');
  const seen = new Set();
  for (const record of manifest.files) {
    safePath(root, record.path);
    if (seen.has(record.path)) throw new Error(`阶段重复路径：${record.path}`);
    seen.add(record.path);
    const source = path.join(directory, 'files', record.path);
    if (!fs.existsSync(source) || fs.lstatSync(source).isSymbolicLink() || hash(fs.readFileSync(source)) !== record.sha256) throw new Error(`参考源码损坏：${record.path}。重新取得教师阶段包，不要绕过校验。`);
    if (record.stub !== undefined && typeof record.stub !== 'string') throw new Error(`骨架格式错误：${record.path}`);
  }
  if (manifest.integrationFiles !== undefined && !Array.isArray(manifest.integrationFiles)) throw new Error('跨站组装目标格式无效。');
  for (const file of manifest.integrationFiles ?? []) safePath(root, file);
  if (manifest.documentationFiles !== undefined && !Array.isArray(manifest.documentationFiles)) throw new Error('文档目标格式无效。');
  for (const file of manifest.documentationFiles ?? []) safePath(root, file);
  return { directory, manifest };
}

export function plan(root, input) {
  const { manifest } = stageData(root, input);
  console.log(`第${pad(manifest.stage)}站 ${manifest.title}\n模式：${manifest.mode}\n目标：${manifest.goal}`);
  for (const file of manifest.files) console.log(`  ${file.role === 'business' ? '学生业务' : file.role === 'assembly' ? '阶段装配' : '公共参考'}  ${file.path}`);
  for (const file of manifest.integrationFiles ?? []) console.log(`  继续修改（begin不会覆盖）  ${file}`);
  for (const file of manifest.documentationFiles ?? []) console.log(`  交付文档（由本人完善）  ${file}`);
  if (manifest.verificationFiles?.length) console.log(`本次新增回归：${manifest.verificationFiles.join('、')}`);
  console.log(`\n本次契约：${manifest.contract}\n人工过关：${manifest.acceptance}\n完整参考：lesson-bundles/stage-${pad(manifest.stage)}/files/\n先读 plan；begin 只准备底座与业务骨架。apply 是完整参考恢复，不是 AI 自动生成。`);
}

function backup(root, label, records) {
  const name = `${new Date().toISOString().replace(/[:.]/g, '-')}-${label}-${crypto.randomBytes(3).toString('hex')}`;
  const directory = path.join(root, 'journey-backups', name);
  fs.mkdirSync(directory, { recursive: true });
  const inventory = [];
  for (const record of records) {
    const target = safePath(root, record.path);
    if (fs.existsSync(target)) {
      const destination = path.join(directory, 'before', record.path);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.copyFileSync(target, destination);
      inventory.push({ path: record.path, existed: true, sha256: hash(fs.readFileSync(target)) });
    } else inventory.push({ path: record.path, existed: false });
    if (record.bytes) {
      const destination = path.join(directory, 'incoming', record.path);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, record.bytes);
    }
  }
  fs.copyFileSync(path.join(root, 'journey-state.json'), path.join(directory, 'journey-state.before.json'));
  save(path.join(directory, 'inventory.json'), inventory);
  return { directory, name, inventory };
}

export function importStage(root, input, mode) {
  if (!['begin', 'apply'].includes(mode)) throw new Error('导入模式无效。');
  const state = readState(root);
  const { directory, manifest } = stageData(root, input);
  const sameStage = manifest.stage === state.stage;
  if (!sameStage && manifest.stage !== state.stage + 1) throw new Error(`当前第${pad(state.stage)}站；只能继续第${pad(state.stage + 1)}站，不跳站。`);
  if (sameStage && mode === 'begin') { console.log('本站已经准备，保留当前代码。继续编辑与 verify；不重新挖空。'); return; }
  if (!sameStage && (!state.verification || state.verification.stage !== state.stage || state.verification.sourceFingerprint !== fingerprint(root))) throw new Error('上一站尚未构建验证，或验证后又改了源码。先运行 node tools/progress.mjs verify；它允许你的实现，不要求答案哈希相同。');

  for (const file of manifest.integrationFiles ?? []) if (!fs.existsSync(safePath(root, file))) throw new Error(`跨站组装文件缺失：${file}。请保留当前目录并核对前站，不自动用参考覆盖。`);

  const records = manifest.files.map(file => {
    const bytes = mode === 'begin' && file.role === 'business' && file.stub !== undefined
      ? Buffer.from(file.stub) : fs.readFileSync(path.join(directory, 'files', file.path));
    const destination = safePath(root, file.path);
    const current = fs.existsSync(destination) ? hash(fs.readFileSync(destination)) : null;
    return { ...file, bytes, current, next: hash(bytes) };
  });
  const conflicts = records.filter(file => file.current !== null && file.current !== file.next && file.current !== state.managed[file.path]);
  if (conflicts.length) {
    const saved = backup(root, `stage-${pad(manifest.stage)}-conflict`, conflicts);
    console.error(`未改动任何 app 源码。发现个人修改：\n${conflicts.map(file => `  ${file.path}`).join('\n')}\n已保存双方文件：journey-backups/${saved.name}/before 与 incoming。`);
    console.error(`手动处理：在 CodeBuddy IDE 比较 before 和 incoming，把需要的代码合并回原文件；不要覆盖整份个人作业。接着用 begin ${pad(manifest.stage)} 继续时，遇同名自建业务文件仍会保留并拒覆盖；请教师确认导入范围。若选择采用参考，先核对备份，再只将 incoming 中冲突文件复制到原位置，然后重跑 ${mode} ${pad(manifest.stage)}。`);
    throw new Error('源码冲突已保护；没有自动重放或强制覆盖选项。');
  }
  const changes = records.filter(file => file.current !== file.next);
  const saved = backup(root, `stage-${pad(manifest.stage)}-${mode}`, changes);
  try {
    for (const file of changes) {
      const destination = safePath(root, file.path);
      fs.mkdirSync(path.dirname(destination), { recursive: true });
      fs.writeFileSync(destination, file.bytes);
    }
    for (const file of records) state.managed[file.path] = file.next;
    state.stage = manifest.stage;
    state.mode = mode === 'begin' ? 'SKELETON_READY' : 'REFERENCE_IMPORTED';
    state.verification = null;
    state.manualAcceptance = null;
    state.history.push({ stage: state.stage, action: mode, at: new Date().toISOString(), backup: `journey-backups/${saved.name}`, files: changes.map(file => file.path) });
    save(path.join(root, 'journey-state.json'), state);
  } catch (error) {
    for (const record of saved.inventory) {
      const destination = safePath(root, record.path);
      if (record.existed) fs.copyFileSync(path.join(saved.directory, 'before', record.path), destination);
      else if (fs.existsSync(destination)) fs.unlinkSync(destination);
    }
    fs.copyFileSync(path.join(saved.directory, 'journey-state.before.json'), path.join(root, 'journey-state.json'));
    throw new Error(`导入失败，已还原本次文件，备份保留：${error.message}`);
  }
  console.log(`${mode === 'begin' ? '已准备骨架' : '已导入完整参考'}：第${pad(state.stage)}站。\n${changes.map(file => `  ${file.path}`).join('\n')}\n备份：journey-backups/${saved.name}\n这不是构建或业务验收通过。下一步编辑业务文件，再运行 verify。`);
}

function runNpm(root, args) {
  const windows = process.platform === 'win32';
  const result = spawnSync(windows ? 'npm.cmd' : 'npm', args, { cwd: path.join(root, 'frontend'), stdio: 'inherit', shell: windows });
  if (result.error || result.status !== 0) throw new Error(`前端检查失败：npm ${args.join(' ')}。保留输出，修好后重跑 verify。`);
}

export function verify(root, runner = runNpm) {
  const state = readState(root);
  const { manifest } = stageData(root, state.stage);
  const outstanding = filesUnder(path.join(root, 'frontend', 'src')).filter(file => {
    const text = fs.readFileSync(path.join(root, 'frontend', 'src', file), 'utf8');
    return text.includes('JOURNEY_IMPLEMENTATION_REQUIRED');
  });
  if (outstanding.length) throw new Error(`还未实现这些业务文件：\n${outstanding.map(file => `frontend/src/${file}`).join('\n')}\n按 plan 中契约完成；不能只删除标记冒充完成。`);
  const before = fingerprint(root);
  state.verification = null;
  save(path.join(root, 'journey-state.json'), state);
  runner(root, ['run', 'type-check']);
  runner(root, ['run', 'test:unit', '--', '--run']);
  runner(root, ['run', 'build']);
  if (before !== fingerprint(root)) throw new Error('检查期间源码发生变化，不能沿用结果。停止编辑后重新 verify。');
  state.verification = { stage: state.stage, at: new Date().toISOString(), sourceFingerprint: before, typeCheck: 'PASS', unitTests: 'PASS', frontendBuild: 'PASS', backendBuild: 'NOT_CHECKED', businessAcceptance: 'NOT_CHECKED', node: process.version, platform: process.platform };
  save(path.join(root, 'journey-state.json'), state);
  console.log(`第${pad(state.stage)}站前端检查通过，接受当前学生实现。\n尚未替你验收：${manifest.acceptance}\n请把实际操作写到 evidence/stage-${pad(state.stage)}.md，再运行 accept ${pad(state.stage)} evidence/stage-${pad(state.stage)}.md。人工记录不等于工具证明。`);
}

export function accept(root, input, relative) {
  const state = readState(root);
  if (Number(input) !== state.stage) throw new Error('只能登记当前站的人工记录。');
  if (!state.verification || state.verification.sourceFingerprint !== fingerprint(root)) throw new Error('先验证当前源码，再登记人工记录。');
  if (!/^evidence\/[^/]+\.md$/.test(relative ?? '')) throw new Error('记录须为 evidence/文件名.md，不接受秘密文件或外部路径。');
  const file = safePath(root, relative);
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8').trim().length < 40) throw new Error('请先写至少40字的本人操作、实际结果与未完成项；工具不替你生成通过。');
  state.manualAcceptance = { status: 'STUDENT_RECORDED_NOT_AUTOMATICALLY_VERIFIED', stage: state.stage, file: relative, sha256: hash(fs.readFileSync(file)), at: new Date().toISOString() };
  save(path.join(root, 'journey-state.json'), state);
  console.log('已登记本人业务记录；工具未判断内容真假，也不会自动宣布100%完成。');
}

export function status(root) {
  const state = readState(root);
  const current = state.verification?.sourceFingerprint === fingerprint(root);
  const manual = state.manualAcceptance;
  const evidenceCurrent = manual && fs.existsSync(path.join(root, manual.file)) && hash(fs.readFileSync(path.join(root, manual.file))) === manual.sha256;
  console.log(`当前：第${pad(state.stage)}站 / 12站\n源码：${state.mode}\n前端构建：${current ? '本次源码已通过' : '未验证或验证后有修改'}\n人工业务：${evidenceCurrent && current ? '本人记录已登记（工具未自动核实）' : '未登记或记录已变化'}\n后端/数据库/浏览器：由对应真实操作单独验证。没有自动100%结论。`);
}

export function main(root, args) {
  const [action, stage, extra] = args;
  if (action === 'list') {
    for (let n = 1; n <= 12; n++) { const { manifest } = stageData(root, n); console.log(`${pad(n)} ${manifest.title} · ${manifest.mode}`); }
  } else if (action === 'status') status(root);
  else if (action === 'plan') plan(root, stage);
  else if (action === 'show') {
    const { directory, manifest } = stageData(root, stage);
    if (!extra || !manifest.files.some(file => file.path === extra)) throw new Error('show 后须给 plan 列出的完整相对文件路径。');
    process.stdout.write(fs.readFileSync(path.join(directory, 'files', extra), 'utf8'));
  } else if (action === 'begin' || action === 'apply') importStage(root, stage, action);
  else if (action === 'verify') verify(root);
  else if (action === 'accept') accept(root, stage, extra);
  else throw new Error('用法：node tools/progress.mjs list|status|plan 02|begin 02|show 02 路径|apply 02|verify|accept 02 evidence/stage-02.md');
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { main(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), process.argv.slice(2)); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
