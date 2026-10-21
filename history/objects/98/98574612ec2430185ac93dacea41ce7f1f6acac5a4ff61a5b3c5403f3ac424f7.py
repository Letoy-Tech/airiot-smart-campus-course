"""Create a new continuous student project; never overwrite existing work."""
from pathlib import Path
import shutil,json,re,hashlib


def freeze_quality_policy(project):
    """Upgrade only the new continuous project; historical checkpoints stay unchanged."""
    quality_path = project / 'fixtures/quality-cases.json'
    validator_path = project / 'tools/validate-fixtures.mjs'
    manifest_path = project / 'fixtures/manifest.json'
    quality = json.loads(quality_path.read_text(encoding='utf-8'))
    assert len(quality['cases']) == 15, 'Preserve the original single-variable cases'
    quality['policy']['combinedErrorPrecedence'] = 'INVALID_NON_NULL_FIELD_BEFORE_MISSING'
    quality['combinedCases'] = [
        {'id': 'invalid-value-missing-time', 'raw': {'value': 'bad', 'time': None},
         'expectedQuality': 'invalid',
         'reason': '与QualityPolicyTest已有组合断言相同：非空非法读数优先于缺失时间'},
        {'id': 'missing-value-invalid-time', 'raw': {'value': None, 'time': 'bad'},
         'expectedQuality': 'invalid',
         'reason': '同一规则用于两个字段：非空非法时间不能被缺失读数掩盖'},
        {'id': 'both-missing', 'raw': {'value': None, 'time': None},
         'expectedQuality': 'missing',
         'reason': '没有非空非法字段时，两项缺失仍为missing'},
    ]
    validator = validator_path.read_text(encoding='utf-8')

    def replace_once(old, new):
        nonlocal validator
        assert validator.count(old) == 1, f'Unexpected fixture validator baseline: {old[:80]}'
        validator = validator.replace(old, new, 1)

    replace_once(
        '// Only isolated conditions are classified. Deliberately refuses to decide the\n'
        '// unfrozen precedence between a missing field and another invalid field.',
        '// Matches QualityPolicy.classify: reject a non-null invalid field first,\n'
        '// then missing input, then the fixed-clock future/stale boundaries.')
    replace_once('const missingValue = raw.value === null;', 'const missingValue = raw.value == null;')
    replace_once('const missingTime = raw.time === null;', 'const missingTime = raw.time == null;')
    replace_once('const invalidTime = !missingTime && !epoch(raw.time);',
                 'const invalidTime = !missingTime && (!epoch(raw.time) || raw.time < 0);')
    replace_once("  assert(!((missingValue || missingTime) && (invalidValue || invalidTime)), 'combined missing/invalid precedence is not frozen');\n", '')
    replace_once("assert.equal(quality.policy.combinedErrorPrecedence, 'NOT_FROZEN');",
                 "assert.equal(quality.policy.combinedErrorPrecedence, 'INVALID_NON_NULL_FIELD_BEFORE_MISSING');")
    replace_once("  assert.throws(() => isolatedQuality({ value: null, time: 'bad' }, clock), /not frozen/);",
                 """  const requiredCombined = [
    { id: 'invalid-value-missing-time', raw: { value: 'bad', time: null }, expectedQuality: 'invalid' },
    { id: 'missing-value-invalid-time', raw: { value: null, time: 'bad' }, expectedQuality: 'invalid' },
    { id: 'both-missing', raw: { value: null, time: null }, expectedQuality: 'missing' },
  ];
  assert(Array.isArray(quality.combinedCases), 'combined quality cases required');
  assert.equal(quality.combinedCases.length, requiredCombined.length);
  unique([...quality.cases, ...quality.combinedCases].map(c => c.id), 'all quality ids');
  for (const required of requiredCombined) {
    const c = quality.combinedCases.find(item => item.id === required.id);
    assert(c, `required combined case ${required.id}`);
    keys(c.raw, ['value', 'time'], 'combined raw quality input');
    assert.deepEqual(c.raw, required.raw, `combined input ${c.id}`);
    assert.equal(c.expectedQuality, required.expectedQuality, `combined expectation ${c.id}`);
    assert.equal(isolatedQuality(c.raw, clock), c.expectedQuality, `combined quality ${c.id}`);
  }""")
    replace_once('15 quality cases; 4 history samples;',
                 '15 single-variable quality cases + 3 combined cases; 4 history samples;')
    validator = validator.replace('isolatedQuality', 'classifyQuality')

    quality_bytes = (json.dumps(quality, ensure_ascii=False, indent=2) + '\n').encode('utf-8')
    manifest = json.loads(manifest_path.read_text(encoding='utf-8'))
    entry = next(f for f in manifest['files'] if f['path'] == 'quality-cases.json')
    entry.update(bytes=len(quality_bytes), sha256=hashlib.sha256(quality_bytes).hexdigest())
    manifest['pendingProviderDecisions'] = [
        item for item in manifest['pendingProviderDecisions'] if item != '多错误优先级'
    ]
    quality_path.write_bytes(quality_bytes)
    validator_path.write_text(validator, encoding='utf-8')
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


ROOT=Path(__file__).resolve().parents[1]
SRC=ROOT/'resources/student-chapters/ch04'
REF=ROOT/'resources/campus-ai-course'
OUT=ROOT/'resources/student-project'
assert not OUT.exists(), 'Refuse to overwrite student-project'
skip={'.private','.runtime','.git','node_modules','target','dist','__pycache__','.DS_Store','checkpoint.json'}
shutil.copytree(SRC,OUT,ignore=shutil.ignore_patterns(*skip,'*.log'))
freeze_quality_policy(OUT)
chapters={}
for ch in range(4,13):
    key=f'{ch:02}'
    cp=ROOT/'resources/student-chapters'/f'ch{key}'
    meta=json.loads((cp/'checkpoint.json').read_text())
    tasks=[]
    for t in meta['markers']:
        marker=t['marker'];file=t['file']
        rx=re.compile(r'(^[ \t]*// STUDENT_TODO_'+marker+r'_BEGIN[^\n]*\n)([\s\S]*?)(^[ \t]*// STUDENT_TODO_'+marker+r'_END[^\n]*)',re.M)
        orig=rx.search((REF/file).read_text());stub=rx.search((cp/file).read_text())
        assert orig and stub
        tasks.append({'file':file,'marker':marker,'referenceBodySha256':hashlib.sha256(orig[2].encode()).hexdigest(),'stub':stub[2].removesuffix('\n')})
    chapters[key]=tasks
(OUT/'tools/chapter-tasks.json').write_text(json.dumps({'chapters':chapters},ensure_ascii=False,indent=2)+'\n')
shutil.copy2(ROOT/'tools/chapter-template.mjs',OUT/'tools/chapter.mjs')
shutil.copy2(ROOT/'tools/hand-in-template.mjs',OUT/'tools/hand-in.mjs')
shutil.copy2(ROOT/'resources/teacher-guide/11-学生断言模板.md',OUT/'docs/ch11-assertions.md')
with (OUT/'.gitignore').open('a') as f:f.write('\n.lesson-backups/\n')
(OUT/'README.md').write_text('''# 智慧校园：同一个工程做到底

本目录是手把手带做专用起点。复制到桌面 campus-ai-lab/app，用 VS Code 打开 app。先按教程第04篇补 A/B，再进入05—12；不逐章换目录。

教师提供认证、请求、数据库、完整页面及其他基础；每章 `node tools/chapter.mjs prepare 05` 只把本章尚未编辑的参考标记块改为TODO，保留前章工作。脚本用 `.lesson-state.json` 记录已经准备过的章节，再次运行同章会保留全部现有代码；首次准备时遇到自定义修改会拒绝覆盖。不要删除该记录来重做，需要重新练习时另建副本。备份在忽略目录 `.lesson-backups/`。prepare是准备任务，不是完成证明。

代码和测试均源于完整教学参考，其他章节在进入本章前仍可能显示教师参考功能。不要把预置代码当本人从零完成，也不要用教师报告替代本人结果。

运行基线：Node22.21.1、JDK17，设置JAVA_HOME。首次安装 `npm --prefix frontend ci`，再 `node tools/course.mjs init`。第04篇使用 `backend` 的first-chain模式（无数据库、两设备）；05之后由教师提供本组库并明确迁移，再使用 `backend-db` 完整模式。前端一直 `node tools/course.mjs frontend`。8091/5178不能重复启动。

本工程 docs 中的旧分章操作单是补充参考，其中“换章节副本”的说明不适用于这条新主线。请以完整教学包 walkthroughs/index.html 的04—12带作为操作顺序。

每章记录保存在 evidence/ch04.md 到 ch12.md。设计文档放 app 同级 docs，交付时 `node tools/hand-in.mjs` 会复制为 project-docs；接手者再次交付优先保留工程根已有 project-docs，不再依赖原作者的上级目录。源文件与记录由你在VSCode保存；不要把代码下载到错误文件夹。

第12篇运行 check、build 后，`node tools/hand-in.mjs` 输出 app 同级的 app-handoff-时间 目录；检查后用系统压缩。账号由当前副本init生成，.private不分发。源码包不含依赖、数据库或构建产物，接手者须重新安装依赖、init及取得教师隔离库。
''')
print(f'Created {OUT}, {sum(map(len,chapters.values()))} task blocks')
