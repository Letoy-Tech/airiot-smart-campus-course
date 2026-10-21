"""Operator-only packaging and integrity audit; no student business implementation."""
from pathlib import Path
import hashlib
import json
import sys
import zipfile

ROOT = Path(__file__).resolve().parents[1]
EXPORT = Path(sys.argv[1]).resolve()
if EXPORT.parent != ROOT or not EXPORT.name.startswith('app-handoff-'):
    raise SystemExit('Only this exercise hand-in export is allowed')
OUT = ROOT / 'output' / 'delivery'
OUT.mkdir(parents=True, exist_ok=True)
REPORT = ROOT / '学生实做报告.md'
DENIED = {'.private', '.runtime', 'node_modules', 'target', 'dist', 'lesson-bundles', 'journey-backups', '.git', '.codebuddy', '__pycache__'}

secrets = set()
for app in [ROOT / 'app', ROOT / 'handoff-run' / 'app']:
    for name in ['accounts.json', 'database.json', 'test-database.json', 'runtime-database.json', 'migration-database.json']:
        p = app / '.private' / name
        if not p.exists():
            continue
        value = json.loads(p.read_text())
        if value.get('password'):
            secrets.add(value['password'].encode())
        for account in value.get('accounts', []):
            if account.get('password'):
                secrets.add(account['password'].encode())
    admin = app / '.private' / 'local-mysql-admin.cnf'
    if admin.exists():
        for line in admin.read_text().splitlines():
            if line.startswith('password='):
                secrets.add(line.split('=', 1)[1].encode())

def safe_file(path, arc):
    if path.is_symlink() or any(part in DENIED for part in Path(arc).parts):
        raise SystemExit('Forbidden delivery path: ' + arc)
    data = path.read_bytes()
    if any(secret in data for secret in secrets if secret):
        raise SystemExit('Known exercise password found in: ' + arc)
    return data

def archive(name, entries):
    dest = OUT / name
    if dest.exists():
        raise SystemExit('Existing delivery preserved: ' + str(dest))
    records = []
    with zipfile.ZipFile(dest, 'x', zipfile.ZIP_DEFLATED) as z:
        for path, arc in entries:
            data = safe_file(path, arc)
            z.writestr(arc, data)
            records.append({'path': arc, 'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()})
        z.writestr('DELIVERY-INTEGRITY.json', json.dumps({'knownExercisePasswordScan': 'no matches', 'files': records}, ensure_ascii=False, indent=2))
    with zipfile.ZipFile(dest) as z:
        bad = z.testzip()
        if bad:
            raise SystemExit('ZIP CRC failed: ' + bad)
    return {'path': str(dest), 'files': len(records), 'bytes': dest.stat().st_size, 'sha256': hashlib.sha256(dest.read_bytes()).hexdigest(), 'zipCrc': 'passed', 'knownExercisePasswordScan': 'no matches'}

source = [(p, 'campus-ai-lab/app/' + p.relative_to(EXPORT).as_posix()) for p in sorted(EXPORT.rglob('*')) if p.is_file()]
source.append((ROOT / 'tools' / 'teacher-local-db.py', 'campus-ai-lab/tools/teacher-local-db.py'))
source.append((REPORT, 'campus-ai-lab/学生实做报告.md'))

evidence = []
for stage in sorted((ROOT / 'evidence').glob('stage-[0-9][0-9]')):
    for p in sorted(stage.rglob('*')):
        if p.is_file() and not any(x in DENIED for x in p.relative_to(stage).parts):
            evidence.append((p, 'evidence/' + p.relative_to(ROOT / 'evidence').as_posix()))
for p in sorted((ROOT / 'evidence' / 'screenshots').glob('stage-*.png')):
    evidence.append((p, 'evidence/screenshots/' + p.name))
for name in ['initial-baseline.json', 'tutorial-execution-plan.json', 'findings.json', 'usage-ledger.json', 'teacher-db-tool-provenance.json', 'teacher-db-tool.diff', 'execution-summary.json']:
    p = ROOT / 'evidence' / name
    if p.exists():
        evidence.append((p, 'evidence/' + name))
model_check = ROOT / 'evidence' / 'model-check'
if model_check.exists():
    for p in sorted(model_check.iterdir()):
        if p.is_file() and p.suffix in {'.txt', '.json'}:
            evidence.append((p, 'evidence/model-check/' + p.name))
for p in sorted((ROOT / 'app' / 'evidence').glob('stage-[0-9][0-9].md')):
    evidence.append((p, 'student-acceptance/' + p.name))
evidence.append((REPORT, REPORT.name))
results = [archive('codebuddy-deepseek-source.zip', source), archive('codebuddy-deepseek-evidence.zip', evidence)]
manifest = {'artifacts': results, 'excluded': sorted(DENIED), 'setupAndCloudLoginScreenshots': 'excluded', 'surefireSystemProperties': 'excluded', 'scope': 'only the two known exercise private directories were read in memory for exact password matching; no secret values printed'}
(OUT / 'delivery-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + '\n')
print(json.dumps(manifest, ensure_ascii=False, indent=2))
