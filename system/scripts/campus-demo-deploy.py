#!/usr/bin/env python3
"""Prepare, stage and activate only the explicitly configured isolated school demo.

Activation is deliberately two steps: start-backend, seed through the private
SSH tunnel, then publish. No secret is put in a shell argument or temp file.
"""
import argparse
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shlex
import subprocess
import sys
import tarfile
import uuid
import zipfile

ROOT = Path(__file__).resolve().parents[1]
CONFIG = None
HOST = None
SSH = []
SCP = []
REMOTE = '/srv/campus-demo'


def configure(path):
    global CONFIG, HOST, SSH, SCP
    from deployment_config import load_config
    CONFIG = load_config(path)
    HOST = CONFIG['ssh_host']
    SSH = ['ssh', '-F', CONFIG['ssh_config'], '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10']
    SCP = ['scp', '-q', '-F', CONFIG['ssh_config'], '-o', 'BatchMode=yes', '-o', 'ConnectTimeout=10']


def remote_config():
    if CONFIG is None:
        raise RuntimeError('No deployment target configured; pass --config and --execute explicitly')
    from deployment_config import REMOTE_KEYS
    return {key: CONFIG[key] for key in REMOTE_KEYS}


def prepare_parts(source, directory, part_size=32 * 1024 * 1024):
    directory.mkdir(parents=True, exist_ok=False)
    (directory / 'parts').mkdir()
    rows = []
    with source.open('rb') as handle:
        index = 0
        while block := handle.read(part_size):
            name = f'part-{index:06d}'
            (directory / 'parts' / name).write_bytes(block)
            rows.append(f'{name}\t{len(block)}\t{hashlib.sha256(block).hexdigest()}')
            index += 1
    if not rows:
        raise RuntimeError('Empty backend artifact')
    (directory / 'parts.manifest.tsv').write_text('\n'.join(rows) + '\n')


def run(args, input=None):
    p = subprocess.run(args, input=input, capture_output=True)
    if p.returncode:
        # Inputs can contain credentials. Only remote safe JSON errors are shown.
        try:
            failure = json.loads(p.stderr)
        except Exception:
            failure = {'operation': args[0], 'exit': p.returncode}
        raise RuntimeError(json.dumps(failure, ensure_ascii=False))
    return p.stdout


def ssh(command, input=None):
    remote_config()
    return run([*SSH, HOST, command], input)


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def upload(path, remote):
    remote_config()
    run([*SCP, str(path), HOST + ':' + remote])


def host_program():
    # A unique directory keeps the helper alongside the uploaded host program.
    directory = '/tmp/campus-demo-host-' + uuid.uuid4().hex
    ssh(shlex.join(['mkdir', '-m', '0700', directory]))
    for name in ['campus-demo-host.py', 'deployment_config.py']:
        upload(Path(__file__).with_name(name), directory + '/' + name)
    return directory + '/campus-demo-host.py'


def invoke(operation, release=None, backup=None, payload=None):
    program = host_program()
    args = ['sudo', '-n', 'python3', '-B', program, operation, '--config-json', json.dumps(remote_config())]
    if release:
        args += ['--release', release]
    if backup:
        args += ['--backup', backup]
    try:
        output = ssh(shlex.join(args), None if payload is None else json.dumps(payload).encode())
        return json.loads(output)
    finally:
        ssh(shlex.join(['rm', '-f', program, str(Path(program).with_name('deployment_config.py'))]))
        ssh(shlex.join(['rmdir', str(Path(program).parent)]))


def airiot_secrets():
    path = ROOT / '.private/airiot.properties'
    if path.stat().st_mode & 0o077:
        raise RuntimeError('AIRIOT credential source must be mode0600')
    values = {}
    for raw in path.read_text().splitlines():
        if raw.strip() and not raw.lstrip().startswith('#'):
            name, value = raw.split('=', 1)
            values[name.strip()] = value.strip()
    if set(values) - {'campus.airiot.base-url', 'campus.airiot.project-id', 'campus.airiot.app-key', 'campus.airiot.app-secret', 'campus.airiot.control-enabled'}:
        raise RuntimeError('Unexpected credential-source names')
    result = {name: values[name] for name in ['campus.airiot.app-key', 'campus.airiot.app-secret']}
    if any(not value or '\n' in value or '\r' in value for value in result.values()):
        raise RuntimeError('Missing or malformed AIRIOT enrollment value')
    return result


def prepare():
    values = airiot_secrets()
    values['spring.datasource.password'] = secrets.token_urlsafe(36)
    values['spring.data.redis.password'] = secrets.token_urlsafe(36)
    values['jwt.secret'] = secrets.token_urlsafe(64)
    values['mysql.root.password'] = secrets.token_urlsafe(40)
    values['mysql-admin.cnf'] = ('[client]\nuser=root\npassword=' + values['mysql.root.password'] +
        '\nhost=127.0.0.1\nport=13391\nprotocol=TCP\n')
    values['redis.conf'] = ('bind 127.0.0.1\nport 16391\nprotected-mode yes\ndaemonize no\n'
        'supervised no\nappendonly yes\nappendfsync everysec\ndir /srv/campus-demo/shared/redis\n'
        'logfile ""\nmaxmemory 128mb\nmaxmemory-policy noeviction\nrequirepass ' + values['spring.data.redis.password'] + '\n')
    return invoke('prepare', payload=values)


def stage(release, jar, dist):
    jar, dist = Path(jar).resolve(), Path(dist).resolve()
    if not jar.is_file() or not (dist / 'index.html').is_file():
        raise RuntimeError('Missing built backend/frontend candidate')
    secret_values = list(airiot_secrets().values())
    with zipfile.ZipFile(jar) as archive:
        if archive.testzip():
            raise RuntimeError('Backend archive validation failed')
        for info in archive.infolist():
            if not info.filename.startswith('BOOT-INF/classes/') or info.is_dir():
                continue
            body = archive.read(info)
            if any(value.encode() in body for value in secret_values):
                raise RuntimeError('Backend artifact contains credential literal')
    files = []
    for p in sorted(dist.rglob('*')):
        if p.is_symlink():
            raise RuntimeError('Frontend candidate must not contain symlinks')
        if p.is_file():
            if any(value.encode() in p.read_bytes() for value in secret_values):
                raise RuntimeError('Frontend candidate contains credential literal')
            files.append({'path': str(p.relative_to(dist)), 'bytes': p.stat().st_size, 'sha256': digest(p)})
    work = ROOT / '.runtime/campus-demo' / (release + '-' + uuid.uuid4().hex[:8])
    work.mkdir(parents=True, mode=0o700)
    frontend = work / 'frontend.tar.gz'
    with tarfile.open(frontend, 'w:gz') as tar:
        for item in files:
            tar.add(dist / item['path'], arcname='mg/' + item['path'], recursive=False)
    parts_dir = work / 'backend-parts'
    prepare_parts(jar, parts_dir)
    parts = []
    for row in (parts_dir / 'parts.manifest.tsv').read_text().splitlines():
        name, size, checksum = row.split('\t')
        parts.append({'file': name, 'bytes': int(size), 'sha256': checksum})
    manifest = {'release': release, 'backend': {'file': 'backend.jar', 'bytes': jar.stat().st_size,
        'sha256': digest(jar), 'archiveValidation': 'passed', 'localCandidate': str(jar), 'parts': parts},
        'frontend': {'file': 'frontend.tar.gz', 'bytes': frontend.stat().st_size, 'sha256': digest(frontend),
                     'files': files, 'localCandidate': str(dist)},
        'credentialLiteralScan': 'passed', 'transfer': {'mode': 'multipart', 'partSize': '32MiB',
                                                      'concurrency': min(4, len(parts)), 'partCount': len(parts)}}
    manifest_path = work / 'manifest.json'
    manifest_path.write_text(json.dumps(manifest, indent=2) + '\n')
    stage_path = REMOTE + '/staging/' + release
    ssh(shlex.join(['sudo', '-n', 'install', '-d', '-m', '0750', '-o', CONFIG['upload_user'], '-g', CONFIG['upload_user'], stage_path, stage_path + '/parts']))
    upload(manifest_path, stage_path + '/manifest.json')
    upload(frontend, stage_path + '/frontend.tar.gz')
    with concurrent.futures.ThreadPoolExecutor(max_workers=min(4, len(parts))) as executor:
        list(executor.map(lambda item: upload(parts_dir / 'parts' / item['file'], stage_path + '/parts/' + item['file']), parts))
    assemble = '''import pathlib,json,hashlib,os
p=pathlib.Path(%r)
m=json.loads((p/'manifest.json').read_text())
names=[x['file'] for x in m['backend']['parts']]
assert names==sorted(names) and len(names)==len(set(names))
for x in m['backend']['parts']:
 q=p/'parts'/x['file'];assert q.stat().st_size==x['bytes'] and hashlib.sha256(q.read_bytes()).hexdigest()==x['sha256']
with (p/'backend.jar.new').open('wb') as f:
 for name in names:
  with (p/'parts'/name).open('rb') as source:
   for chunk in iter(lambda:source.read(1048576),b''):f.write(chunk)
os.replace(p/'backend.jar.new',p/'backend.jar')
''' % stage_path
    ssh('sudo -n python3 -', assemble.encode())
    ssh(shlex.join(['sudo', '-n', 'chown', '-R', 'root:root', stage_path]))
    result = invoke('verify-stage', release)
    result['localTransferEvidence'] = str(manifest_path)
    return result


def main():
    p = argparse.ArgumentParser()
    p.add_argument('operation', choices=['prepare', 'stage', 'start-backend', 'publish', 'backup', 'restore-check', 'rollback', 'verify'])
    p.add_argument('--config', required=True, help='Private local path to deployment JSON; no built-in target')
    p.add_argument('--execute', action='store_true', help='Explicitly enable remote operations for the configured target')
    p.add_argument('--release')
    p.add_argument('--jar')
    p.add_argument('--dist')
    p.add_argument('--backup')
    p.add_argument('--report')
    args = p.parse_args()
    if not args.execute:
        raise RuntimeError('Remote operations require --execute and an explicit --config')
    configure(args.config)
    if args.release and not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,79}', args.release):
        raise RuntimeError('Invalid release identifier')
    if args.operation in ['stage', 'start-backend', 'publish', 'rollback'] and not args.release:
        raise RuntimeError('Release identifier is required')
    if args.operation == 'prepare':
        result = prepare()
    elif args.operation == 'stage':
        if not args.jar or not args.dist:
            raise RuntimeError('Stage requires final built jar/dist paths')
        result = stage(args.release, args.jar, args.dist)
    else:
        result = invoke(args.operation, args.release, args.backup)
    if args.report:
        destination = Path(args.report)
        destination.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    # The full immutable-artifact manifest can be large. Saved report is authoritative.
    print(json.dumps({k: v for k, v in result.items() if k not in ['manifest', 'sharedBefore', 'sharedAfter']}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'state': 'failed', 'error': str(error) if isinstance(error, RuntimeError) else type(error).__name__}), file=sys.stderr)
        sys.exit(1)
