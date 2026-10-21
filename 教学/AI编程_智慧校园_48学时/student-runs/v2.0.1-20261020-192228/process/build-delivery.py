"""Package the verified student export and public operator evidence; no student edits."""
from pathlib import Path
import datetime, difflib, hashlib, io, json, re, zipfile

BASE = Path(__file__).resolve().parent
COURSE = BASE.parents[2]
OUT = COURSE / 'deliverables'
state = json.loads((BASE / 'progress.json').read_text())
assert len(state['steps']) == 64 and all(s['status'] == 'PASS' for s in state['steps'])
export = json.loads((BASE / 'environment/final-export.json').read_text())
SOURCE = Path(export['path'])
assert SOURCE.is_relative_to(BASE.parent / 'campus-lab/.runtime')
OUT.mkdir(exist_ok=True)

secrets = []
for folder in ['campus-lab', 'campus-lab-handoff']:
    for line in (BASE.parent / folder / '.env').read_text().splitlines():
        if '=' not in line or line.startswith('#'):
            continue
        key, value = line.split('=', 1)
        if key in {'DB_PASSWORD', 'MYSQL_ROOT_PASSWORD', 'REDIS_PASSWORD', 'DEMO_PASSWORD'}:
            secrets.append(value.encode())
assert len(secrets) == 8 and len(set(secrets)) == 8

def inspect(name, data, depth=0):
    if any(value in data for value in secrets):
        raise RuntimeError('Known local credential found in ' + name)
    if depth < 3 and data[:4] == b'PK\x03\x04':
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            for item in z.infolist():
                if not item.is_dir():
                    inspect(name + '::' + item.filename, z.read(item), depth + 1)
    if Path(name).suffix in {'.json', '.jsonl', '.txt', '.md'}:
        text = data.decode('utf-8', errors='replace')
        for _ in range(3):
            text = text.replace('\\"', '"')
        if re.search(r'Bearer\s+[A-Za-z0-9_.-]{40,}', text):
            raise RuntimeError('Unredacted bearer pattern in ' + name)
        if re.search(r'"token"\s*:\s*"[A-Za-z0-9_.-]{32,}"', text):
            raise RuntimeError('Unredacted token pattern in ' + name)

def unique(name):
    path = OUT / name
    n = 2
    while path.exists():
        path = OUT / (Path(name).stem + '-' + str(n) + Path(name).suffix)
        n += 1
    return path

def package(name, mapping):
    for rel, data in mapping.items():
        inspect(rel, data)
    target = unique(name)
    manifest = [{'path': rel, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}
                for rel, data in sorted(mapping.items())]
    with zipfile.ZipFile(target, 'x', zipfile.ZIP_DEFLATED, compresslevel=9) as z:
        for rel, data in sorted(mapping.items()):
            z.writestr(rel, data)
        z.writestr('PACKAGE-MANIFEST.json', json.dumps(manifest, ensure_ascii=False, indent=2))
    with zipfile.ZipFile(target) as z:
        assert z.testzip() is None
        for row in manifest:
            assert hashlib.sha256(z.read(row['path'])).hexdigest() == row['sha256']
    return {'path': str(target), 'files': len(mapping), 'bytes': target.stat().st_size,
            'sha256': hashlib.sha256(target.read_bytes()).hexdigest()}

source = {}
for line in (SOURCE / 'SHA256SUMS.txt').read_text().splitlines():
    sha, rel = line.split('  ', 1)
    file = SOURCE / rel
    assert not file.is_symlink() and not any(p.is_symlink() for p in file.parents)
    assert rel == '.env.example' or not any(p.startswith('.env') for p in Path(rel).parts)
    data = file.read_bytes()
    assert hashlib.sha256(data).hexdigest() == sha
    source['campus-lab/' + rel] = data
assert len(source) == export['files']
source['campus-lab/SHA256SUMS.txt'] = (SOURCE / 'SHA256SUMS.txt').read_bytes()

# Actual chapter-to-chapter differences, separate from per-step hash/change records.
diff_dir = BASE / 'chapter-diffs'
diff_dir.mkdir(exist_ok=True)
chain = []
for chapter in ['08', '09', '10', '11']:
    path = BASE / ('snapshots/' + chapter + '-source-public.zip')
    with zipfile.ZipFile(path) as z:
        chain.append((chapter, {n: z.read(n) for n in z.namelist() if n.startswith('campus-lab/')}))
chain.append(('12-final', source))
for (old_label, old), (new_label, new) in zip(chain, chain[1:]):
    lines = []
    for rel in sorted(set(old) | set(new)):
        if rel.endswith('.jar') or rel.endswith('SHA256SUMS.txt'):
            continue
        before, after = old.get(rel, b''), new.get(rel, b'')
        if before == after:
            continue
        try:
            left, right = before.decode().splitlines(keepends=True), after.decode().splitlines(keepends=True)
        except UnicodeDecodeError:
            continue
        lines.extend(difflib.unified_diff(left, right, fromfile=old_label + '/' + rel,
                                         tofile=new_label + '/' + rel))
    (diff_dir / (old_label + '-to-' + new_label + '.patch')).write_text(''.join(lines))

allowed_dirs = {'steps', 'commands', 'screenshots', 'snapshots', 'source-text',
                'immutable-migrations', 'environment', 'chapter-diffs'}
allowed_suffixes = {'.md', '.txt', '.json', '.jsonl', '.png', '.sql', '.zip', '.patch', '.py', '.js'}
blocked = {'.runtime', '.private', '__pycache__', 'docker-parts', 'node_modules', 'target'}
skip_names = {'CURRENT.md', 'RESUME.md', 'reader-v202-12-handoff-mobile.png'}
evidence = {}
for file in sorted(BASE.rglob('*')):
    rel = file.relative_to(BASE)
    if any(p in blocked or p.startswith('.env') for p in rel.parts):
        continue
    if file.is_symlink():
        raise RuntimeError('Evidence symlink refused: ' + str(rel))
    if not file.is_file():
        continue
    if len(rel.parts) > 1 and rel.parts[0] not in allowed_dirs:
        continue
    if file.suffix not in allowed_suffixes or file.name in skip_names:
        continue
    evidence[str(rel)] = file.read_bytes()
evidence['README.md'] = ('# 64步电脑实做报告与证据\n\n先读[学生实做报告](学生实做报告.md)。\n\n'
    '冻结V2.0.1提示逐步运行，业务源码由CodeBuddy生成；Codex操作验证并记录。'
    'steps保留提示与IDE观察，commands保留实际命令/浏览器证据，screenshots保留实际画面，'
    'snapshots与chapter-diffs保留公开章节源码和派生差异；逐步修改还可由哈希清单核对。'
    '未保留Git提交历史，也不把作者参考、真人学生、Windows或另一台电脑说成已验收。'
    '安装镜像、私密配置、数据库、测试副本和临时缓存未打包。\n').encode()

result = {'createdAt': datetime.datetime.now().isoformat(), 'steps': 64,
          'knownLocalCredentialValuesChecked': len(secrets), 'credentialsIncluded': False,
          'sourceExport': str(SOURCE),
          'archives': [package('学生实做源码_64步_20261021.zip', source),
                       package('实做报告与证据_64步_20261021.zip', evidence)]}
(OUT / '学生实做交付校验_20261021.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps(result, ensure_ascii=False, indent=2))
