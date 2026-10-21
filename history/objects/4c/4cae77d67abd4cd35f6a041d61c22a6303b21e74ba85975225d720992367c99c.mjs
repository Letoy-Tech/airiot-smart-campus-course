import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'resources/student-project');
const output = path.join(root, 'resources/project-journey');
const authored = path.join(output, 'authoring');
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const skip = new Set(['.private', '.runtime', '.git', '.lesson-backups', 'node_modules', 'target', 'dist', 'validation', 'evidence', '__pycache__', '.DS_Store']);
const pendingAllowed = process.argv.includes('--allow-pending');
const refresh = process.argv.includes('--refresh');
const write = (directory, relative, bytes) => { const destination = path.join(directory, relative); fs.mkdirSync(path.dirname(destination), { recursive: true }); fs.writeFileSync(destination, bytes); };
const jsonText = value => JSON.stringify(value, null, 2) + '\n';
function walk(directory, prefix = '') {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    if (skip.has(entry.name) || entry.name.startsWith('.env') || entry.name.endsWith('.log') || entry.name.endsWith('.har') || entry.name === '.lesson-state.json') return [];
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error(`来源含符号链接，拒绝复制：${rel}`);
    return entry.isDirectory() ? walk(path.join(directory, entry.name), rel) : [rel];
  });
}
const lessonPlan = JSON.parse(fs.readFileSync(path.join(root, 'journey/lessons.json'), 'utf8'));
if (lessonPlan.length !== 12) throw new Error('需要12站元数据');
const original = new Map(walk(source).map(file => [file, fs.readFileSync(path.join(source, file))]));
const reference = new Map(original);
const transformations = [];
const pending = [];
const get = file => { if (!reference.has(file)) throw new Error(`缺少参考文件 ${file}`); return reference.get(file).toString(); };
const set = (file, text) => reference.set(file, Buffer.from(text));

// 作者验收证据不进入学生工程；保留可向教师索取的纯文字位置，避免悬空链接。
const backendReadme = get('backend/README.md');
const evidenceLink = '[本轮报告](evidence/round10/test-summary.json)';
if (backendReadme.includes(evidenceLink)) {
  set('backend/README.md', backendReadme.replaceAll(evidenceLink, '课程总包中的教师报告 `resources/student-project/backend/evidence/round10/test-summary.json`（本工程不附作者证据，请向教师索取）'));
  transformations.push({ file: 'backend/README.md', reason: 'replace-excluded-author-evidence-link-with-course-location' });
}

// 只恢复旧学生起点的A/B已知留空；不修改来源目录，也不猜其他个人实现。
for (const task of JSON.parse(get('tools/chapter-tasks.json')).chapters['04']) {
  const pattern = new RegExp(`(^[ \\t]*// STUDENT_TODO_${task.marker}_BEGIN[^\\n]*\\n)([\\s\\S]*?)(^[ \\t]*// STUDENT_TODO_${task.marker}_END[^\\n]*)`, 'm');
  const text = get(task.file); const current = text.match(pattern);
  if (!current) throw new Error(`找不到已知标记 ${task.marker}`);
  if (hash(current[2].replace(/\r\n/g, '\n')) === task.referenceBodySha256) continue;
  if (current[2].replace(/\r\n/g, '\n') !== task.stub + '\n') throw new Error(`A/B并非已知留空或参考答案：${task.file}；请人工确认，不自动覆盖。`);
  const teacher = fs.readFileSync(path.join(root, 'resources/campus-ai-course', task.file), 'utf8').match(pattern);
  if (!teacher || hash(teacher[2].replace(/\r\n/g, '\n')) !== task.referenceBodySha256) throw new Error(`教师答案与旧标记清单不符：${task.marker}`);
  set(task.file, text.replace(pattern, (_all, begin, _body, end) => begin + teacher[2] + end));
  transformations.push({ file: task.file, reason: 'restore-known-A/B-reference-body', marker: task.marker, teacherBodySha256: task.referenceBodySha256 });
}

const settings = `export const projectSettings = {\n  projectTitle: '智慧校园教学平台',\n  shortName: '校园实验室',\n}\n`;
const exercises = `/** 学生长期保留的业务小函数；后续导入不覆盖此文件。 */\nexport function communicationLabel(value: boolean | null): string {\n  if (value === true) return '在线'\n  if (value === false) return '离线'\n  return '未知'\n}\n`;
const staticPage = `<script setup lang="ts">\nimport { communicationLabel } from '../domain/journey-exercises'\nconst devices = [\n  { id: 'teaching_env_01', name: '环境传感器01（模拟）', online: true },\n  { id: 'teaching_energy_01', name: '电能监测器01（模拟）', online: null },\n]\n</script>\n<template>\n  <section class="workspace full-page" data-testid="static-devices">\n    <p class="eyebrow">第01站 · 静态页面</p><h1>先看见两台设备</h1>\n    <p class="source-pill">TEACHING_MOCK · 这里只显示教学样例，尚未发送HTTP请求</p>\n    <table class="data-table"><thead><tr><th>设备</th><th>编号</th><th>通信状态</th></tr></thead>\n      <tbody><tr v-for="device in devices" :key="device.id"><td>{{ device.name }}</td><td>{{ device.id }}</td><td>{{ communicationLabel(device.online) }}</td></tr></tbody>\n    </table><p>未知不等于离线。下一站再把静态列表接到后端。</p>\n  </section>\n</template>\n`;
const staticApp = `<script setup lang="ts">\nimport StaticDevices from './views/StaticDevices.vue'\nimport { projectSettings } from './project-settings'\n</script>\n<template><header class="topbar"><strong>{{ projectSettings.projectTitle }}</strong><span>第01站 · 尚无后台业务</span></header><main><StaticDevices /></main></template>\n`;
const staticTest = `import { describe, expect, it } from 'vitest'\nimport { mount } from '@vue/test-utils'\nimport StaticDevices from '../views/StaticDevices.vue'\nimport { communicationLabel } from '../domain/journey-exercises'\ndescribe('连续项目起点', () => {\n  it('只显示两台明确模拟设备并保留未知', () => {\n    const view = mount(StaticDevices)\n    expect(view.findAll('tbody tr')).toHaveLength(2)\n    expect(view.text()).toContain('未知')\n    expect(view.text()).toContain('TEACHING_MOCK')\n    expect(view.text()).not.toContain('已连接AIRIOT')\n  })\n  it('通信标签区分三态，0不是设备状态输入', () => {\n    expect([true, false, null].map(communicationLabel)).toEqual(['在线', '离线', '未知'])\n  })\n})\n`;
set('frontend/src/project-settings.ts', settings);
set('frontend/src/domain/journey-exercises.ts', exercises);
set('frontend/src/views/StaticDevices.vue', staticPage);
set('frontend/src/tests/journey-start.test.ts', staticTest);

let authApp = get('frontend/src/App.vue');
authApp = authApp.replace('<script setup lang="ts">', `<script setup lang="ts">\nimport { projectSettings } from './project-settings'`)
  .replace('<span>校园实验室<small>', '<span>{{ projectSettings.shortName }}<small>')
  .replace('教师参考 · 智慧校园', '连续项目 · 公共认证基础');
set('frontend/src/App.vue', authApp);
const workspace = `<script setup lang="ts">\nimport { computed, onBeforeUnmount, ref } from 'vue'\nimport { useCampusStore } from '../stores/campus'\nimport { pages, components, defaultPage } from '../journey/registry'\nconst store = useCampusStore()\nconst visiblePages = computed(() => pages.filter(([key]) => String(key) !== 'audit' || (store.capabilities?.canAdmin === true && store.capabilities?.canAudit === true)))\nconst hash = ref(location.hash)\nconst page = computed(() => { const name = hash.value.slice(1).split('?')[0] ?? ''; return name in components ? name : defaultPage })\nfunction changed() { hash.value = location.hash }\nwindow.addEventListener('hashchange', changed)\nonBeforeUnmount(() => window.removeEventListener('hashchange', changed))\n</script>\n<template>\n  <nav class="workspace-nav" aria-label="已制作的校园模块"><a v-for="[key,label,stage] in visiblePages" :key="key" :href="'#'+key" :data-testid="'nav-'+key" :aria-current="page===key?'page':undefined"><span>{{ stage }}</span>{{ label }}</a></nav>\n  <div v-if="store.capabilities?.canRead !== true" class="workspace"><p class="notice error" role="alert">当前身份没有校园读取权限。请退出后核对身份。</p></div>\n  <component v-else :is="components[page]" :key="page" />\n</template>\n`;
set('frontend/src/views/FullWorkspace.vue', workspace);
set('frontend/src/tests/journey-navigation.test.ts', `import { beforeEach, expect, it, vi } from 'vitest'\nimport { mount } from '@vue/test-utils'\nimport FullWorkspace from '../views/FullWorkspace.vue'\nconst context=vi.hoisted(()=>({capabilities:{canRead:true,canAdmin:false as unknown,canAudit:false as unknown}}))\nvi.mock('../stores/campus',()=>({useCampusStore:()=>context}))\nvi.mock('../journey/registry',()=>({pages:[['devices','设备','03'],['audit','审计','10']],components:{devices:{template:'<div>设备</div>'},audit:{template:'<div>审计</div>'}},defaultPage:'devices'}))\nbeforeEach(()=>{location.hash='';context.capabilities.canAdmin=false;context.capabilities.canAudit=false})\nit('查看者与字符串能力都不能看到审计导航',()=>{context.capabilities.canAdmin='true';context.capabilities.canAudit=true;const page=mount(FullWorkspace);expect(page.find('[data-testid="nav-audit"]').exists()).toBe(false);page.unmount()})\nit('管理员同时具有严格审计能力时显示入口',()=>{context.capabilities.canAdmin=true;context.capabilities.canAudit=true;const page=mount(FullWorkspace);expect(page.find('[data-testid="nav-audit"]').exists()).toBe(true);page.unmount()})\n`);
set('frontend/src/views/AccessView.vue', `<script setup lang="ts">\nimport { useCampusStore } from '../stores/campus'\nconst store=useCampusStore()\n</script>\n<template><section class="workspace full-page"><h1>当前身份与校园能力</h1><p>能力只认布尔true，最终授权仍由后端执行。</p><p>当前账号：{{ store.user?.username }}；角色：{{ store.user?.roles.join('、') }}</p><table class="data-table"><thead><tr><th>能力字段</th><th>服务端值</th><th>页面解释</th></tr></thead><tbody><tr v-for="(value,key) in store.capabilities" :key="key"><td>{{ key }}</td><td>{{ value }}</td><td>{{ value===true?'允许':'不据此授予能力' }}</td></tr></tbody></table><p>用查看者直接请求写入仍应被拒。这里没有重新实现账号、密码或组织管理。</p></section></template>\n`);
set('frontend/src/views/CloseChecklist.vue', `<script setup lang="ts">\nimport { computed } from 'vue'\nimport type { AlarmDetail } from '../types/full'\nimport { closeBlockers } from '../domain/course'\nconst props=defineProps<{detail:AlarmDetail}>()\nconst blockers=computed(()=>closeBlockers(props.detail))\n</script>\n<template><aside class="notice"><strong>第09站：核对当前事件再关闭</strong><p v-if="blockers.length">还缺：{{ blockers.join('；') }}</p><p v-else>页面可检查的条件已满足；仍须填写结论，由服务器核对来源、时间、权限与版本。</p></aside></template>\n`);
let cases = get('frontend/src/views/CasesView.vue');
cases = cases.replace('<script setup lang="ts">', `<script setup lang="ts">\nimport { journeyStage, closurePanel } from '../journey/features'`)
  .replace('async function act(action: CaseAction) {', `async function act(action: CaseAction) {\n  if (journeyStage < 9 && ['recover', 'verify-recovery', 'close'].includes(action)) return`)
  .replace(/v-if="store\.capabilities\?\.canRunDemoScenarios === true"(\s+class="button subtle"[\s\S]*?data-testid="recover-case")/, 'v-if="journeyStage >= 9 && store.capabilities?.canRunDemoScenarios === true"$1')
  .replace(/v-if="canHandle"(\s+class="button subtle"[\s\S]*?data-testid="verify-case")/, 'v-if="journeyStage >= 9 && canHandle"$1')
  .replace('<div v-if="canHandle" class="close-section">', `<div v-if="journeyStage >= 9 && canHandle" class="close-section">\n              <component v-if="closurePanel" :is="closurePanel" :detail="detail" />`);
if (!cases.includes('journeyStage >= 9 && canHandle') || !cases.includes('closurePanel" :is')) throw new Error('事件模板变化，阶段开关需人工核对。');
set('frontend/src/views/CasesView.vue', cases);
transformations.push({ file: 'frontend/src/views/CasesView.vue', reason: 'stage-08 hides and guards close/recovery; stage-09 enables; backend authorization unchanged' });

const specs = [
  ['静态两设备页面', '静态；不需后端', '看到两台设备，未知不等于离线', '没有网络请求；只读取本文件两条教学样例', '改项目名后页面更新；两台设备与模拟标识清楚'],
  ['首次HTTP读取', 'first-chain；无数据库', '从真实HTTP响应显示两台设备', 'GET /api/auth/csrf、/auth/me、/campus/capabilities；GET /campus/devices、/spaces，code=0再取items/observedAt', '登录后读取true/null两设备；业务失败不冒充空列表'],
  ['完整设备台账', 'teacher-db；教师独立库', '4空间16设备，筛选与稳定ID详情', 'devices与spaces使用完整固定目录；online严格true/false/null', '16→4→1→0→清除16；详情刷新仍同ID；无匹配与失败分开'],
  ['本地位置登记', 'teacher-db', '校园、楼栋、空间绑定保存并回读', 'GET /locations；POST campuses/buildings；PUT spaces/{spaceId}；管理员写，合法引用', '保存重读；非法引用拒绝；查看者403；原关系不变'],
  ['概览与能源', 'teacher-db', '概览及V/kW能源页', 'GET /overview；source/simulated/observedAt/points/quality；不以kW推电量', '0/null/质量有区别；统计对应响应；离页停止刷新'],
  ['历史与原始报警', 'teacher-db', '历史表曲线和原始报警只读', 'GET /history固定时间窗口；GET /alarms只读分页；保留原状态/等级', 'null断线、0保留；同单位对比；报警有记录/空/失败分开'],
  ['身份与权限验证', 'teacher-db；复用认证底座', '解释当前身份和严格能力', '身份来自me，能力只接受Boolean true；后端决定权限', 'viewer不能写；身份切换清旧数据；401/403分开'],
  ['事件接收与处理', 'teacher-db', '场景、列表、分派、开始、NOTE', '演练是DEMO/LOCAL_DEMO；expectedVersion；本人已分派范围', '创建→分派A→A开始/NOTE；B拒绝；来源与业务状态分开'],
  ['恢复、核实与关闭', 'teacher-db', '完成完整关闭链和拒绝反例', 'NOTE+恢复事实+服务端核实PASS与有效时间+结论；旧版本409不重放', '恢复不自动关闭；缺NOTE拒绝；闭环后独立回读'],
  ['责任、审计与接入', 'teacher-db；AIRIOT选做', '责任时间线、命令审计读取、接入状态', 'owner版本独立；责任不追改旧事件；审计只读，远端控制关闭', '责任A→B，新事件跟B旧事件不变；普通身份不能读审计；未接入不写PASS'],
  ['调试与测试', '真实数据库另用独立_test库', '修复真实缺陷并读并发回滚证据', '前端测试不是MySQL回滚证明；400/403/409不是事务回滚成功', '保留修复前后测试；真实DB因果链由实际报告证明'],
  ['交付与接力', '本地或教师批准隔离环境', '交接源码、记录和运行说明', '不携带.private/node_modules/target/dist；无公网毕业门槛', '另一人独立目录复现；对齐功能清单；未验证项如实保留'],
];
const routes = [
  [2, 'first-read', '首次读取', 'FirstDeviceRead.vue'], [3, 'devices', '设备台账', 'DeviceCatalog.vue'],
  [4, 'locations', '空间归属', 'LocationsView.vue'], [5, 'overview', '校园概览', 'OverviewView.vue'],
  [5, 'energy', '能源点位', 'EnergyView.vue'], [6, 'history', '历史样本', 'HistoryView.vue'],
  [6, 'raw-alarms', '原始报警', 'RawAlarmsView.vue'], [7, 'access', '身份与权限', 'AccessView.vue'],
  [8, 'cases', '事件工作台', 'CasesView.vue'], [10, 'owners', '责任登记', 'OwnersView.vue'],
  [10, 'audit', '命令审计', 'AuditView.vue'], [10, 'integration', '接入状态', 'IntegrationView.vue'],
];
for (const [, , label, filename] of routes) {
  const file = `frontend/src/views/${filename}`;
  if (!reference.has(file)) {
    if (!pendingAllowed) throw new Error(`等待并行作者完成 ${file}；仅工具开发可加 --allow-pending，交付不得使用待完成包。`);
    set(file, `<template><section class="workspace"><h1>${label}</h1><p>JOURNEY_IMPLEMENTATION_REQUIRED：本轮参考模块尚未冻结，不能交付。</p></section></template>\n`);
    pending.push(file);
  }
}

function resolveImport(origin, specifier) {
  if (!specifier.startsWith('.')) return null;
  const base = path.posix.normalize(path.posix.join(path.posix.dirname(origin), specifier));
  for (const candidate of [base, base + '.ts', base + '.vue', base + '.json', base + '/index.ts']) if (reference.has(candidate)) return candidate;
  if (base.includes('/journey/')) return null;
  throw new Error(`本地依赖不存在：${origin} → ${specifier}`);
}
function collect(file, map) {
  if (map.has(file)) return;
  const bytes = reference.get(file);
  if (!bytes) throw new Error(`缺少 ${file}`);
  map.set(file, bytes);
  if (!/\.(ts|vue)$/.test(file)) return;
  const pattern = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*)['"]([^'"]+)['"]/g;
  for (const match of bytes.toString().matchAll(pattern)) { const dependency = resolveImport(file, match[1]); if (dependency) collect(dependency, map); }
}
function registry(stage) {
  const active = routes.filter(([n]) => n <= stage);
  return `import { defineAsyncComponent, type Component } from 'vue'\nexport const pages = ${JSON.stringify(active.map(([n, key, label]) => [key, label, String(n).padStart(2, '0')]))} as const\nexport const defaultPage = '${stage < 3 ? 'first-read' : 'devices'}'\nexport const components: Record<string, Component> = {\n${active.map(([, key, , file]) => `  '${key}': defineAsyncComponent(() => import('../views/${file}')),`).join('\n')}\n}\n`;
}
function features(stage) {
  return `${stage >= 9 ? "import CloseChecklist from '../views/CloseChecklist.vue'\n" : ''}export const journeyStage = ${stage}\nexport const closurePanel = ${stage >= 9 ? 'CloseChecklist' : 'null'}\n`;
}
const snapshots = [];
const initial = new Map();
for (const file of reference.keys()) if (/^frontend\/(?:[^/]+)$/.test(file) && !/README\.md$/.test(file)) initial.set(file, reference.get(file));
for (const file of ['frontend/src/main.ts', 'frontend/src/style.css', 'frontend/src/project-settings.ts', 'frontend/src/domain/journey-exercises.ts', 'frontend/src/views/StaticDevices.vue', 'frontend/src/tests/journey-start.test.ts']) initial.set(file, reference.get(file));
initial.set('frontend/src/App.vue', Buffer.from(staticApp));
initial.set('tools/progress.mjs', fs.readFileSync(path.join(authored, 'progress.mjs')));
initial.set('.gitignore', Buffer.from('.private/\n.codebuddy/\nlesson-bundles/**/files/\nnode_modules/\nfrontend/dist/\nbackend/target/\njourney-backups/\n*.log\n.DS_Store\n'));
initial.set('.nvmrc', Buffer.from('22.21.1\n'));
initial.set('package.json', reference.get('package.json'));
initial.set('README.md', fs.readFileSync(path.join(root, 'tools/journey-student-readme.md')));
initial.set('docs/01-跨平台启动.md', fs.readFileSync(path.join(root, 'tools/student-environment.md')));
initial.set('docs/项目卡.md', Buffer.from('# 我的校园平台\n\n使用者：待填写。\n先解决的问题：待填写。\n本次范围：教学模拟，UI可以自定；真实AIRIOT选做。\n本次观察：尚未执行。\n'));
initial.set('docs/接口与数据.md', Buffer.from('# 接口与数据\n\n第01站尚未调用接口。后续按本次manifest的contract逐条补充，不提前猜接口。\n密码和数据库配置不得写在这里。\n'));
initial.set('evidence/README.md', Buffer.from('# 本人的实际记录\n\n每站新建stage-NN.md，写操作、实际结果、失败和未执行项。\n不要把作者示例或静态构建写成真实浏览器、数据库通过。不要记录密码或请求头。\n'));
const codeBuddy = `# 当前教学工程规则\n\n你在CodeBuddy独立IDE中协助学生制作同一个校园平台。先读journey-state.json，再读lesson-bundles/stage-NN/manifest.json（NN是当前站），以及docs/项目卡.md和docs/接口与数据.md。不了解当前阶段时先说明缺什么，不猜当前完成状态。\n\n- 主线只读取本次实际源码、manifest、公共接口和测试；默认不得读取或检索lesson-bundles/**/files、reference、journey-backups。学生/教师明确选择参考救援后才可读对应参考，并记录来源，不把导入声称为AI原创或本人通过。\n- 每次只修改本次businessFiles、integrationFiles及documentationFiles中明确要求的文件。integrationFiles是需要继续修改的旧页面，begin不会覆盖它们；不要自行begin/apply或推进下一站。\n- begin只准备当前底座与未完成骨架；verify只检查当前前端类型、单元测试、构建，不能证明真实HTTP、MySQL、Windows或AIRIOT通过。\n- 不读取、检索、输出或上传.private、账号密码、数据库配置、Cookie、请求头、HAR。此文件是行为约束，不是操作系统权限隔离。需要环境时请教师配置；只引用脱敏错误。\n- 不更换依赖、不删除锁文件、不改认证/密码/CSRF、数据库配置或真实AIRIOT接入，不启用远端控制与外部通知。除非当前明确任务要求，不新建/修改/删除测试（包括临时测试）。\n- 不改阶段装配文件App.vue、FullWorkspace.vue、frontend/src/journey/，不删状态或备份来绕过冲突。需要改装配时先解释具体原因并由学生/教师确认。\n- 学生修改过的业务文件必须保留。apply冲突时停止，比较journey-backups中的before/incoming；不强制覆盖。\n- 用npm run test:unit -- --run，不猜npm test存在。无.git时用IDE变更或文件diff；git status失败不是源码审计。完成后列修改文件、行为、实际命令和结果；没执行写未执行，保留首错，不改测试预期凑通过。\n`;
initial.set('CODEBUDDY.md', Buffer.from(codeBuddy));
snapshots.push(new Map(initial));
const previous = new Map(initial);
for (let stage = 2; stage <= 12; stage++) {
  if (stage === 2) {
    for (const [file, bytes] of reference) if (file.startsWith('backend/') || file.startsWith('fixtures/')) previous.set(file, bytes);
    for (const file of ['tools/course.mjs', 'tools/private-json.mjs', 'tools/validate-fixtures.mjs', 'docs/02-教师数据库交接单.md']) previous.set(file, reference.get(file));
    collect('frontend/src/App.vue', previous);
    // App是阶段1的静态入口；第2站替换一次，此后不再覆盖。
    previous.set('frontend/src/App.vue', reference.get('frontend/src/App.vue'));
    collect('frontend/src/views/FullWorkspace.vue', previous);
  }
  for (const [n, , , filename] of routes) if (n === stage) collect(`frontend/src/views/${filename}`, previous);
  if (stage === 9) collect('frontend/src/views/CloseChecklist.vue', previous);
  previous.set('frontend/src/journey/registry.ts', Buffer.from(registry(stage)));
  previous.set('frontend/src/journey/features.ts', Buffer.from(features(stage)));
  // 回归随功能所在站加入；第11站再做全量复测，不等到结课才发现组装缺口。
  for (const [file] of reference) {
    if (!file.startsWith('frontend/src/tests/') || !file.endsWith('.test.ts') || previous.has(file)) continue;
    const earlyTests = {
      2: /\/(http|first-device-view|request-timeout|session-races)\.test\.ts$/,
      3: /\/(catalog-navigation|course-domain|request-scope)\.test\.ts$/,
      5: /\/energy-scope\.test\.ts$/,
      6: /\/(monitoring-views|comparison|read-api|read-models)\.test\.ts$/,
      8: /\/case-trigger-race\.test\.ts$/,
      9: /\/closure-wiring\.test\.ts$/,
      10: /\/(workflow-views|read-pages|journey-navigation)\.test\.ts$/,
    };
    const allowed = stage === 11 || earlyTests[stage]?.test(file);
    if (allowed) collect(file, previous);
  }
  if (stage === 11) previous.set('docs/调试记录.md', Buffer.from('# 本人调试与验证\n\n先记录现象、请求状态、业务code和失败测试，再给AI。\n修改后重跑同一检查。未执行不能写通过。\n真实MySQL并发与回滚另记独立_test库报告；普通verify不替代它。\n'));
  if (stage === 12) {
    const handIn = fs.readFileSync(path.join(root, 'tools/hand-in-template.mjs'), 'utf8');
    previous.set('tools/hand-in.mjs', Buffer.from(handIn));
    previous.set('docs/交付说明.md', Buffer.from('# 本人交付说明\n\n待填写：实际工具与服务路线、安装、独立数据库前提、两个终端、主流程、实际验证结果和未验证项。不要复制作者通过记录。\n'));
    previous.set('docs/交付核对.md', Buffer.from('# 交付核对\n\n先verify，再按README启动并实际验收，最后运行node tools/hand-in.mjs。\n交接者另建目录安装依赖，使用自己账号与教师交接的独立库，不复用作者秘密。\n对照原平台功能清单；软件构建、浏览器、真实DB、Windows、真实AIRIOT分别记录。\n'));
  }
  snapshots.push(new Map(previous));
}

function sourceStub(file, label) {
  if (!file.endsWith('.vue')) return undefined;
  // 明确未完成，不伪造读取成功；verify会在编译前指出具体待实现文件。
  return `<template>\n  <section class="workspace full-page"><h1>${label}</h1><p role="alert">JOURNEY_IMPLEMENTATION_REQUIRED：请按本站契约创建这个业务页面。不要只删提示。</p></section>\n</template>\n`;
}
const artifacts = new Map();
const manifests = [];
for (let index = 0; index < 12; index++) {
  const stage = index + 1; const snapshot = snapshots[index]; const before = snapshots[index - 1] || new Map();
  const [title, mode, goal, contract, acceptance] = specs[index];
  const changed = [...snapshot].filter(([file, bytes]) => !before.has(file) || hash(before.get(file)) !== hash(bytes));
  const records = changed.map(([file, bytes]) => {
    const assembly = ['frontend/src/App.vue', 'frontend/src/views/FullWorkspace.vue', 'frontend/src/journey/registry.ts', 'frontend/src/journey/features.ts'].includes(file);
    const business = file.startsWith('frontend/src/views/') && !assembly;
    const role = assembly ? 'assembly' : business ? 'business' : 'foundation';
    const stub = role === 'business' && stage > 1 ? sourceStub(file, title) : undefined;
    return { path: file, sha256: hash(bytes), bytes: bytes.length, role, ...(stub ? { stub } : {}) };
  });
  const businessFiles = records.filter(file => file.role === 'business').map(file => file.path);
  const scaffoldingFiles = records.filter(file => file.role !== 'business').map(file => file.path);
  const integrationFiles = Object.keys(lessonPlan[index].integrationTargets ?? {});
  for (const file of integrationFiles) if (!before.has(file)) throw new Error(`跨站目标缺少前站来源：${file}`);
  const documentationFiles = lessonPlan[index].documentationFiles ?? [];
  const verificationFiles = records.filter(file => /frontend\/src\/tests\/.*\.test\.ts$/.test(file.path)).map(file => file.path);
  const contextFiles = [...new Set(['docs/01-跨平台启动.md', ...integrationFiles, ...documentationFiles, ...verificationFiles, 'docs/项目卡.md', 'docs/接口与数据.md', ...businessFiles, ...(stage >= 2 ? ['frontend/src/api/campus.ts', 'frontend/src/stores/campus.ts'] : ['frontend/src/project-settings.ts']), ...(stage >= 4 ? ['frontend/src/api/full.ts', 'backend/docs/full-api.json'] : [])])];
  const manifest = { schema: 1, stage, title, mode, goal, contract, acceptance, businessFiles, integrationFiles, documentationFiles, verificationFiles, scaffoldingFiles, contextFiles, files: records, teacherBackend: 'Complete readable reference service, not student-written from zero', pendingReference: pending };
  manifests.push(manifest);
  const prefix = `app/lesson-bundles/stage-${String(stage).padStart(2, '0')}`;
  artifacts.set(`${prefix}/manifest.json`, Buffer.from(jsonText(manifest)));
  artifacts.set(`${prefix}/README.md`, Buffer.from(`# 第${String(stage).padStart(2, '0')}站 ${title}\n\n模式：${mode}\n\n目标：${goal}\n\n契约：${contract}\n\n人工过关：${acceptance}\n\n这些是完整可读参考源码。主线用begin准备业务骨架，让CodeBuddy按本站文件实现；apply为遇错恢复，绝不把导入说成AI生成。\n\n${records.map(file => `- ${file.role}：${file.path}`).join('\n')}\n`));
  for (const [file, bytes] of changed) artifacts.set(`${prefix}/files/${file}`, bytes);
}
for (const [file, bytes] of snapshots[0]) artifacts.set(`app/${file}`, bytes);
const state = { schema: 1, stage: 1, mode: 'STATIC_STARTER', managed: Object.fromEntries([...snapshots[0]].map(([file, bytes]) => [file, hash(bytes)])), verification: null, manualAcceptance: null, history: [{ stage: 1, action: 'starter', files: [...snapshots[0].keys()] }] };
artifacts.set('app/journey-state.json', Buffer.from(jsonText(state)));
for (const [file, bytes] of reference) {
  if (file.startsWith('frontend/src/tests/') || file.startsWith('frontend/') || file.startsWith('backend/') || file.startsWith('fixtures/')) artifacts.set(`reference/${file}`, bytes);
}
for (const [file, bytes] of snapshots[11]) artifacts.set(`reference/${file}`, bytes);
for (const [file, bytes] of [...artifacts]) if (file.startsWith('app/lesson-bundles/')) artifacts.set(file.replace(/^app\//, 'reference/'), bytes);
artifacts.set('reference/journey-state.json', Buffer.from(jsonText({ schema: 1, stage: 12, mode: 'TEACHER_REFERENCE_NOT_STUDENT_EVIDENCE', managed: Object.fromEntries([...snapshots[11]].map(([file, bytes]) => [file, hash(bytes)])), verification: null, manualAcceptance: null, history: [] })));
artifacts.set('reference/README.md', Buffer.from('# 最终可读参考\n\n来自student-project源码快照，已恢复已知A/B起点；加入逐站装配壳。不是学生已经完成的证据。使用app作为连续起点，不把reference覆盖到已有个人工程。\n\n本轮V1.2.1作者修订验证见课程总包的journey/qa/student-feedback-v121；旧evidence仅保留历史，不代表本轮重新执行。\n'));
const readme = fs.readFileSync(path.join(root, 'tools/journey-student-readme.md'), 'utf8');
artifacts.set('app/README.md', Buffer.from(readme));
artifacts.set('README.md', Buffer.from(`# 逐站工程资源\n\n当前生成：${pending.length ? '开发中，缺模块，不可交付' : '参考模块已具备；本轮V1.2.1验证见课程总包journey/qa/student-feedback-v121'}。\n\n- app/：整份复制到桌面后连续使用的起点，自带12站源码包。\n- reference/：最终可读参考，不能覆盖个人工程。\n- authoring/：生成器资源与工具测试；学生不用操作。\n- evidence/：历史作者检查；本轮报告在课程总包journey/qa/student-feedback-v121，均不能当作学生记录。\n\n生成命令：在课程根目录运行node tools/build-progress-project.mjs；更新已生成文件使用--refresh，工具仅允许原样生成内容被替换，发现个人修改会拒绝。--allow-pending只供工具开发，不能用于发布。\n\n${specs.map(([title, mode], i) => `${i + 1}. ${title}（${mode}）`).join('\n')}\n`));

const previousManifestFile = path.join(output, 'BUILD-MANIFEST.json');
let old = null;
if (fs.existsSync(previousManifestFile)) {
  if (!refresh) throw new Error('输出已存在。核对后使用--refresh；不会默认覆盖。');
  old = JSON.parse(fs.readFileSync(previousManifestFile, 'utf8'));
  if (old.generator !== 'build-progress-project-v1') throw new Error('不是本生成器的目录，拒绝覆盖。');
  const conflicts = old.files.filter(record => fs.existsSync(path.join(output, record.path)) && hash(fs.readFileSync(path.join(output, record.path))) !== record.sha256);
  if (conflicts.length) throw new Error(`生成输出已被编辑，先保存个人工作；拒绝覆盖：${conflicts.slice(0, 12).map(x => x.path).join(', ')}`);
}
for (const [file] of artifacts) if (!old && fs.existsSync(path.join(output, file))) throw new Error(`未知已有文件，拒绝覆盖：${file}`);
for (const record of old?.files || []) if (!artifacts.has(record.path) && fs.existsSync(path.join(output, record.path))) fs.unlinkSync(path.join(output, record.path));
for (const [file, bytes] of artifacts) write(output, file, bytes);
const authoringSources = ['tools/build-progress-project.mjs', 'tools/course-template.mjs', 'tools/hand-in-template.mjs', 'tools/student-environment.md', 'tools/journey-student-readme.md', 'journey/lessons.json', 'resources/project-journey/authoring/progress.mjs'].map(file => ({ path: file, sha256: hash(fs.readFileSync(path.join(root, file))) }));
const manifest = { version: JSON.parse(fs.readFileSync(path.join(root, 'course-index.json'), 'utf8')).version, authoringSources, generator: 'build-progress-project-v1', generatedAt: new Date().toISOString(), source: 'resources/student-project', sourceFiles: [...original].map(([file, bytes]) => ({ path: file, sha256: hash(bytes) })), transformations, pending, files: [...artifacts].map(([file, bytes]) => ({ path: file, sha256: hash(bytes), bytes: bytes.length })), stages: manifests.map(m => ({ stage: m.stage, title: m.title, files: m.files.length, business: m.files.filter(f => f.role === 'business').map(f => f.path) })), exclusions: [...skip], verification: 'NOT_RUN_BY_GENERATOR' };
write(output, 'BUILD-MANIFEST.json', jsonText(manifest));
console.log(jsonText({ status: pending.length ? 'PENDING_REFERENCE' : 'GENERATED_NOT_YET_VERIFIED', output: path.relative(root, output), files: artifacts.size, stages: 12, pending }));
