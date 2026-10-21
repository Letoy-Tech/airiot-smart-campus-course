"""Teacher/operator fixture checks; outputs no passwords or account hashes."""
from pathlib import Path
import json, os, re, subprocess, tempfile

root = Path(__file__).resolve().parents[1]
private = root / 'app' / '.private'
value = json.loads((private / 'database.json').read_text())
assert value['url'].startswith('jdbc:mysql://127.0.0.1:23491/campus_course_lab?')
assert value['username'] == 'course_student'
assert re.fullmatch(r'[0-9a-f]{48}', value['password'])
assert (private / 'database.json').stat().st_mode & 0o777 == 0o600
fd, filename = tempfile.mkstemp(prefix='runtime-check-', suffix='.cnf', dir=private)
try:
    os.fchmod(fd, 0o600)
    with os.fdopen(fd, 'w') as f:
        f.write('[client]\nuser=course_student\npassword=' + value['password'] + '\nhost=127.0.0.1\nport=23491\nprotocol=TCP\nssl-mode=DISABLED\n')
    args = ['/opt/homebrew/opt/mysql@8.4/bin/mysql', '--defaults-extra-file=' + filename, '--batch', '--skip-column-names', '--database=campus_course_lab']
    p = subprocess.run(args, input='SELECT VERSION(); SELECT COUNT(*) FROM flyway_schema_history WHERE success=1; SHOW GRANTS FOR CURRENT_USER();', text=True, capture_output=True)
    if p.returncode:
        raise RuntimeError('Runtime database verification failed; secret-bearing details omitted')
    rows = p.stdout.strip().splitlines()
    denied = subprocess.run(args, input='USE campus_course_other;', text=True, capture_output=True)
    result = {'scope': 'Dedicated local student exercise, not school or platform DB', 'host': '127.0.0.1', 'port': 23491, 'schema': 'campus_course_lab', 'runtimeUser': 'course_student', 'mysqlVersion': rows[0], 'successfulMigrations': int(rows[1]), 'runtimeGrants': rows[2:], 'otherSchemaDenied': denied.returncode != 0 and '1044' in denied.stderr, 'passwordPrinted': False}
    if not result['otherSchemaDenied']:
        raise RuntimeError('Expected other-schema access denial was not observed')
    if result['successfulMigrations'] != 2:
        raise RuntimeError('Expected two applied migrations')
    print(json.dumps(result, ensure_ascii=False, indent=2))
finally:
    Path(filename).unlink(missing_ok=True)
