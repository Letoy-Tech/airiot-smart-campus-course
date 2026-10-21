"""Operator-only export checks in disposable public copies; never edits student source."""
from pathlib import Path
import datetime, hashlib, json, shutil, subprocess, sys

BASE = Path(__file__).resolve().parent
BATCH = sys.argv[1] if len(sys.argv) > 1 else 'hand-in-v1'
if BATCH not in {'hand-in-v1', 'hand-in-v2', 'hand-in-v3'}:
    raise SystemExit('Only this trial’s named public exports may be tested')
SOURCE = BASE.parent / 'campus-lab/.runtime' / BATCH / 'campus-lab'
STAMP = datetime.datetime.now().strftime('%Y%m%dT%H%M%S')
WORK = BASE / '.runtime/export-boundaries' / STAMP
WORK.mkdir(parents=True, exist_ok=False)
checks = []

def clone(name):
    target = WORK / name
    shutil.copytree(SOURCE, target)
    return target

def run(root, out='.runtime/check/campus-lab', *, alias=None):
    script = (alias or root) / 'tools/export-source.mjs'
    command = ['node'] + (['--preserve-symlinks-main'] if alias else [])
    r = subprocess.run(command + [str(script), '--out', str(out)], cwd=root,
                       text=True, capture_output=True)
    return r.returncode, r.stdout + r.stderr

def add(name, okay, **details):
    checks.append({'name': name, 'pass': bool(okay), **details})

def digest_tree(root):
    return {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in root.rglob('*') if p.is_file() and not p.is_symlink()}

root = clone('existing-output')
code, output = run(root)
first = digest_tree(root / '.runtime/check/campus-lab')
code2, output2 = run(root)
add('existing-output-refused-without-change', code == 0 and code2 != 0 and
    first == digest_tree(root / '.runtime/check/campus-lab'))

root = clone('outside-output')
outside = WORK / 'must-not-be-created'
code, output = run(root, outside)
add('outside-runtime-refused', code != 0 and not outside.exists())

root = clone('nested-exclusions')
for rel in ['frontend/.env', 'docs/nested/.env.local', 'docs/nested/.env.example',
            'docs/.private/notes.txt', 'frontend/node_modules/private.txt']:
    file = root / rel
    file.parent.mkdir(parents=True, exist_ok=True)
    file.write_text('operator synthetic excluded file')
code, output = run(root)
export = root / '.runtime/check/campus-lab'
bad = [str(p.relative_to(export)) for p in export.rglob('*')
       if p.is_file() and (p.name.startswith('.env') and p.relative_to(export).as_posix() != '.env.example'
                          or '.private' in p.parts or 'node_modules' in p.parts)]
add('nested-env-private-dependency-exclusions', code == 0 and not bad and
    (export / '.env.example').is_file() and (export / 'backend/.mvn').is_dir(), unexpected=bad)

root = clone('source-parent-symlink')
shutil.move(root / 'backend', root / 'held-backend')
(root / 'backend').symlink_to(root / 'held-backend', target_is_directory=True)
code, output = run(root)
add('source-parent-symlink-refused', code != 0 and not (root / '.runtime/check/campus-lab').exists())

root = clone('output-parent-symlink')
(root / '.runtime').mkdir()
held = WORK / 'held-output'
held.mkdir()
(root / '.runtime/alias').symlink_to(held, target_is_directory=True)
code, output = run(root, root / '.runtime/alias/campus-lab')
add('output-parent-symlink-refused', code != 0 and not (held / 'campus-lab').exists())

for label, padding in [('small-text-secret', 0), ('large-text-secret', 5 * 1024 * 1024 + 256)]:
    root = clone(label)
    secret = 'operator_synthetic_export_probe_' + STAMP + '_only'
    (root / '.env').write_text('DEMO_PASSWORD=' + secret + '\n')
    (root / 'docs/leak-check.txt').write_text('a' * padding + secret)
    code, output = run(root)
    add(label + '-refused-before-copy', code != 0 and not (root / '.runtime/check/campus-lab').exists(),
        outputContainedSyntheticSecret=secret in output)

real_parent = WORK / 'real-parent'
real_parent.mkdir()
root = real_parent / 'project'
shutil.copytree(SOURCE, root)
alias_parent = WORK / 'aliased-parent'
alias_parent.symlink_to(real_parent, target_is_directory=True)
alias = alias_parent / 'project'
code, output = run(root, alias / '.runtime/check/campus-lab', alias=alias)
add('project-ancestor-symlink-refused', code != 0 and not (root / '.runtime/check/campus-lab').exists())

result = {'at': datetime.datetime.now().isoformat(), 'success': all(x['pass'] for x in checks),
          'checks': checks, 'sourceExport': BATCH, 'scope': 'operator public-copy fixtures, not a business or classroom acceptance'}
evidence = BASE / 'environment' / ('12-02-export-boundaries-' + STAMP + '.json')
evidence.write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps({'success': result['success'], 'checks': len(checks),
                  'failed': [x['name'] for x in checks if not x['pass']], 'evidence': str(evidence)}))
sys.exit(0 if result['success'] else 1)
