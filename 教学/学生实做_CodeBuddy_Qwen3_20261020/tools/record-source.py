"""Operator evidence only; never implements or imports student business answers."""
from pathlib import Path
import sys, hashlib, json, shutil, difflib

ROOT = Path(__file__).resolve().parents[1]
APP = ROOT / 'app'
EXCLUDED = {'.private', '.git', '.codebuddy', 'node_modules', 'target', 'dist', '.runtime', 'journey-backups', 'lesson-bundles', 'evidence', '.DS_Store'}

def allowed(path):
    rel = path.relative_to(APP)
    return not path.is_symlink() and not any(p in EXCLUDED for p in rel.parts)

def snapshot(label):
    dest = ROOT / 'evidence' / label
    if dest.exists():
        raise SystemExit('Snapshot already exists: ' + label)
    dest.mkdir(parents=True)
    records = []
    for path in sorted(APP.rglob('*')):
        if not path.is_file() or not allowed(path):
            continue
        rel = path.relative_to(APP)
        target = dest / 'source' / rel
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(path, target)
        records.append({'path': str(rel), 'sha256': hashlib.sha256(path.read_bytes()).hexdigest()})
    (dest / 'manifest.json').write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'snapshot': label, 'files': len(records)}, ensure_ascii=False))

def diff(before, after, output):
    b = ROOT / 'evidence' / before / 'source'
    a = ROOT / 'evidence' / after / 'source'
    paths = sorted(set(p.relative_to(b) for p in b.rglob('*') if p.is_file()) | set(p.relative_to(a) for p in a.rglob('*') if p.is_file()))
    lines = []
    changed = []
    for rel in paths:
        old = (b / rel).read_bytes() if (b / rel).exists() else b''
        new = (a / rel).read_bytes() if (a / rel).exists() else b''
        if old == new:
            continue
        changed.append(str(rel))
        lines.extend(difflib.unified_diff(old.decode('utf8', 'replace').splitlines(True), new.decode('utf8', 'replace').splitlines(True), fromfile='before/' + str(rel), tofile='after/' + str(rel)))
    target = ROOT / 'evidence' / output
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(''.join(lines))
    target.with_suffix('.files.json').write_text(json.dumps(changed, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'diff': output, 'changedFiles': changed}, ensure_ascii=False))

if sys.argv[1] == 'snapshot':
    snapshot(sys.argv[2])
elif sys.argv[1] == 'diff':
    diff(*sys.argv[2:5])
else:
    raise SystemExit('snapshot LABEL | diff BEFORE AFTER OUTPUT')
