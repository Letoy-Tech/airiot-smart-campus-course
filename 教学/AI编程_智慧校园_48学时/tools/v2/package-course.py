"""Package current public teaching files after verifying the reader's build inputs."""
from pathlib import Path
import argparse
import datetime
import hashlib
import json
import re
import stat
import zipfile

ROOT = Path(__file__).resolve().parents[2]
CONFIG = json.loads((ROOT / 'tools/v2/course-config.json').read_text())
VERSION = CONFIG['version']
ap = argparse.ArgumentParser(description=__doc__)
ap.add_argument('--check-only', action='store_true', help='Verify inputs and paths without writing')
ap.add_argument('--output-dir', type=Path, default=ROOT / '.runtime/releases' / ('v' + VERSION))
args = ap.parse_args()
OUT = args.output_dir.resolve()
if any(p.is_symlink() for p in [args.output_dir, *args.output_dir.parents]):
    raise RuntimeError('Refusing symlink output')
IGNORE = {'.env', '.private', '.runtime', '.git', 'node_modules', 'target', 'dist',
          '__pycache__', '.DS_Store', '.codebuddy'}
BANNED_SUFFIXES = {'.zip', '.tar', '.gz', '.tgz', '.bz2', '.xz', '.7z', '.rar', '.bak',
                   '.pem', '.key', '.p12', '.pfx', '.jks', '.keystore'}


def assert_regular_source(p):
    if p.is_symlink() or any(parent.is_symlink() for parent in p.parents):
        raise RuntimeError('Refusing symlink path ' + str(p.relative_to(ROOT)))
    if not p.is_file():
        raise RuntimeError('Not a regular source file ' + str(p.relative_to(ROOT)))
    if p.suffix.lower() in BANNED_SUFFIXES:
        raise RuntimeError('Refusing nested archive, backup or secret file ' + str(p.relative_to(ROOT)))


def current_reader():
    manifest_path = ROOT / 'tools/v2/reader-build-manifest.json'
    hint = '请先在tools/v2安装依赖，再从课程根目录运行 python3 tools/v2/verify-course.py。'
    if not manifest_path.exists():
        raise RuntimeError('阅读版缺少构建清单；' + hint)
    assert_regular_source(manifest_path)
    manifest = json.loads(manifest_path.read_text())
    if manifest.get('schema_version') != 1 or manifest.get('version') != VERSION:
        raise RuntimeError('阅读版构建版本不匹配；' + hint)
    lessons = sorted((ROOT / 'handbook-v2/lessons').glob('[0-9][0-9]-*.md'))
    expected = {'tools/v2/build-reader.mjs', 'tools/v2/course-config.json',
                'handbook-v2/00-先准备再开始.md', 'handbook-v2/教师安排.md', 'handbook-v2/教师验证记录.md'}
    expected.update(p.relative_to(ROOT).as_posix() for p in lessons)
    expected.update('handbook-v2/engineering/' + name for name in CONFIG['engineering_documents'])
    expected.update('handbook-v2/' + name for name in CONFIG.get('supplementary_documents', []))
    if len(lessons) != CONFIG['lessons'] or not expected <= set(manifest.get('sources', {})):
        raise RuntimeError('阅读版未包含当前全部课程来源；' + hint)
    outputs = {'handbook-v2/index.html', f'handbook-v2/从空白开始_手把手教程_V{VERSION}.html', 'course-index-v2.json'}
    if set(manifest.get('outputs', {})) != outputs:
        raise RuntimeError('阅读版输出清单不完整；' + hint)
    for group in ['sources', 'outputs']:
        for name, digest in manifest[group].items():
            relative = Path(name)
            if relative.is_absolute() or '..' in relative.parts or not re.fullmatch('[a-f0-9]{64}', digest):
                raise RuntimeError('阅读版构建清单包含无效路径或哈希')
            source = ROOT / relative
            assert_regular_source(source)
            if hashlib.sha256(source.read_bytes()).hexdigest() != digest:
                raise RuntimeError('阅读版已过期或文件被修改：' + name + '；' + hint)
    return len(manifest['sources'])


def files(base):
    return sorted(p for p in base.rglob('*') if p.is_file()
                  and not any(c in IGNORE for c in p.relative_to(base).parts)
                  and not p.name.endswith('.log')
                  and not (p.name.startswith('.env') and p.name != '.env.example')
                  and not (p.name.startswith('从空白开始_手把手教程_V')
                           and p.name != f'从空白开始_手把手教程_V{VERSION}.html'))


def write_zip(dest, mapping):
    if dest.exists():
        raise RuntimeError('Refusing to replace existing archive: ' + str(dest))
    manifest = []
    with zipfile.ZipFile(dest, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as archive:
        for name, src in mapping:
            assert_regular_source(src)
            data = src.read_bytes()
            mode = 0o755 if src.stat().st_mode & 0o111 else 0o644
            info = zipfile.ZipInfo(name, (1980, 1, 1, 0, 0, 0))
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | mode) << 16
            archive.writestr(info, data, compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
            manifest.append({'path': name, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                             'mode': format(mode, '04o')})
        info = zipfile.ZipInfo('PACKAGE-MANIFEST.json', (1980, 1, 1, 0, 0, 0))
        info.create_system = 3
        info.external_attr = (stat.S_IFREG | 0o644) << 16
        archive.writestr(info, json.dumps({'version': VERSION, 'files': manifest}, ensure_ascii=False, indent=2),
                         compress_type=zipfile.ZIP_DEFLATED, compresslevel=9)
    with zipfile.ZipFile(dest) as archive:
        assert archive.testzip() is None
        for item in manifest:
            assert hashlib.sha256(archive.read(item['path'])).hexdigest() == item['sha256']
            assert stat.S_IMODE(archive.getinfo(item['path']).external_attr >> 16) == int(item['mode'], 8)
    return {'file': dest.name, 'bytes': dest.stat().st_size, 'files': len(manifest),
            'sha256': hashlib.sha256(dest.read_bytes()).hexdigest()}


reader_sources = current_reader()
base = ROOT / 'resources/from-zero-v2/student-start'
student_mapping = [('campus-lab/' + p.relative_to(base).as_posix(), p) for p in files(base)]
mapping = []
prefix = f'AI编程_手把手课程_V{VERSION}/'
for folder in ['handbook-v2', 'resources/from-zero-v2', 'tools/v2']:
    mapping.extend((prefix + p.relative_to(ROOT).as_posix(), p) for p in files(ROOT / folder))
for name in ['index.html', '先打开这里.html', 'course-index-v2.json', '01-课程大纲.md',
             '02-项目范围与教学架构.md', '03-AI协作与接力规范.md', '04-考核与验收.md']:
    mapping.append((prefix + name, ROOT / name))
mapping.append((prefix + 'README.md', ROOT / 'handbook-v2/交付包说明.md'))
for entries in [student_mapping, mapping]:
    seen = set()
    for name, source in entries:
        if name in seen:
            raise RuntimeError('Duplicate archive path ' + name)
        seen.add(name)
        assert_regular_source(source)
if args.check_only:
    print(json.dumps({'version': VERSION, 'student_files': len(student_mapping), 'full_files': len(mapping),
                      'reader_sources_verified': reader_sources, 'checked': 'reader hashes and paths; no files written'}, ensure_ascii=False))
    raise SystemExit(0)
names = [f'AI编程_学生空白起点_V{VERSION}.zip', f'AI编程_智慧校园_V{VERSION}_手把手教学包.zip',
         f'AI编程_智慧校园_V{VERSION}_交付校验.json']
for name in names:
    if (OUT / name).exists():
        raise RuntimeError('Refusing to replace existing release file: ' + str(OUT / name))
OUT.mkdir(parents=True, exist_ok=True)
student = write_zip(OUT / names[0], student_mapping)
full = write_zip(OUT / names[1], mapping)
result = {'version': VERSION, 'created': datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat(),
          'archives': [student, full]}
(OUT / names[2]).write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps(result, ensure_ascii=False, indent=2))
