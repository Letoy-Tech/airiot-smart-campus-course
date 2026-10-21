#!/usr/bin/env python3
"""MG-only releases: immutable frontend + remote hard-linked unchanged backend.

No backend upload, restart, database write, credential enrollment or Nginx reload.
Stage prepares a rollback-compatible old UI with the new/old hash asset union.
"""
import argparse
import datetime
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import re
import shlex
import shutil
import socket
import subprocess
import sys
import tarfile
import uuid

LOCAL = Path(__file__).resolve().parents[1]
REMOTE = Path('/srv/campus-demo')


def module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    value = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(value)
    return value


def sha(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda: f.read(1048576), b''):
            h.update(block)
    return h.hexdigest()


def snapshot(h):
    current = (REMOTE / 'current').resolve()
    pid = int(h.text(['systemctl', 'show', h.UNIT, '-p', 'MainPID', '--value']))
    fds = []
    for p in Path('/proc', str(pid), 'fd').glob('*'):
        try:
            if os.readlink(p).endswith('/backend.jar'):
                fds.append({'inode': p.stat().st_ino, 'sha256': sha(p)})
        except OSError:
            pass
    return {'current': str(current), 'pid': pid, 'backendSha256': sha(current / 'backend.jar'),
            'backendInode': (current / 'backend.jar').stat().st_ino, 'runningJarFDs': fds,
            'units': {name: h.text(['systemctl', 'show', name, '-p', 'MainPID', '--value'])
                      for name in [h.UNIT, h.MYSQL, h.REDIS, 'nginx.service']},
            'proxyHashes': {str(p): sha(p) for p in [h.VHOST, h.ROUTES]},
            'sharedContainers': h.shared_state()}


def invariant(h, before):
    after = snapshot(h)
    fields = ['pid', 'backendSha256', 'backendInode', 'runningJarFDs', 'units', 'proxyHashes']
    if any(before[field] != after[field] for field in fields):
        raise RuntimeError('MG-only invariant failed: backend process/artifact/unit/proxy changed')
    fixed = lambda items: [(x['name'], x['id'], x['imageId']) for x in items]
    if fixed(before['sharedContainers']) != fixed(after['sharedContainers']):
        raise RuntimeError('Shared AIRIOT identity/image changed during MG operation')
    if not h.health(5):
        raise RuntimeError('Backend health failed during MG operation')
    return after


def frontend_hashes(directory):
    return [{'path': str(p.relative_to(directory)), 'bytes': p.stat().st_size, 'sha256': sha(p)}
            for p in sorted(directory.rglob('*')) if p.is_file()]


def verify_files(directory, files):
    for item in files:
        path = Path(item['path'])
        if path.is_absolute() or '..' in path.parts:
            raise RuntimeError('Invalid frontend manifest path')
        p = directory / path
        if not p.is_file() or p.is_symlink() or p.stat().st_size != item['bytes'] or sha(p) != item['sha256']:
            raise RuntimeError('Frontend checksum mismatch: ' + item['path'])


def stage_remote(args, h):
    before = snapshot(h)
    if Path(before['current']).name != args.expect_current or before['backendSha256'] != args.backend_sha:
        raise RuntimeError('Current release/backend does not match approved preflight')
    stage = REMOTE / 'staging' / args.release
    incoming = json.loads((stage / 'mg-manifest.json').read_text())
    archive = stage / 'mg.tar.gz'
    if archive.stat().st_size != incoming['bytes'] or sha(archive) != incoming['sha256']:
        raise RuntimeError('Uploaded MG archive checksum mismatch')
    release = REMOTE / 'releases' / args.release
    rollback = release.with_name(args.release + '-rollback')
    if release.exists() or rollback.exists():
        raise RuntimeError('MG release/rollback directory already exists')
    candidate = release.with_name(args.release + '.new')
    recovery = rollback.with_name(rollback.name + '.new')
    candidate.mkdir(mode=0o755)
    with tarfile.open(archive) as tar:
        if any(not x.name.startswith('mg/') or x.issym() or x.islnk() for x in tar.getmembers()):
            raise RuntimeError('Invalid MG archive members')
        tar.extractall(candidate, filter='data')
    verify_files(candidate / 'mg', incoming['files'])
    for p in (candidate / 'mg').rglob('*'):
        p.chmod(0o755 if p.is_dir() else 0o644)
    (candidate / 'mg').chmod(0o755)
    recovery.mkdir(mode=0o755)
    shutil.copytree(Path(before['current']) / 'mg', recovery / 'mg', copy_function=os.link)
    # Retain all Vite content-hashed assets from retained releases, without editing them.
    retained = []
    for source in sorted((REMOTE / 'releases').glob('*/mg/assets/**/*')):
        if not source.is_file() or not re.search(r'-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$', source.name):
            continue
        relative = source.relative_to(source.parents[next(i for i, p in enumerate(source.parents) if p.name == 'mg')])
        for directory in [candidate / 'mg', recovery / 'mg']:
            destination = directory / relative
            if destination.exists():
                if sha(destination) != sha(source):
                    raise RuntimeError('Content-hash asset filename collision: ' + str(relative))
                continue
            destination.parent.mkdir(parents=True, exist_ok=True)
            os.link(source, destination)
        retained.append(str(relative))
    # New hashed chunks must also remain available after UI rollback.
    for source in (candidate / 'mg/assets').rglob('*'):
        if source.is_file() and re.search(r'-[A-Za-z0-9_-]{8,}\.[A-Za-z0-9]+$', source.name):
            destination = recovery / 'mg' / source.relative_to(candidate / 'mg')
            if not destination.exists():
                destination.parent.mkdir(parents=True, exist_ok=True)
                os.link(source, destination)
            elif sha(destination) != sha(source):
                raise RuntimeError('Rollback asset collision')
    for directory in [candidate, recovery]:
        os.link(Path(before['current']) / 'backend.jar', directory / 'backend.jar')
        for p in directory.rglob('*'):
            if p.is_file():
                h.command(['runuser', '-u', 'www-data', '--', 'test', '-r', str(p)])
        manifest = {'release': args.release if directory == candidate else rollback.name,
                    'kind': 'mg-only' if directory == candidate else 'mg-rollback-compatible',
                    'backend': {'file': 'backend.jar', 'sha256': before['backendSha256'], 'inode': before['backendInode'],
                                'bytes': (directory / 'backend.jar').stat().st_size, 'source': before['current']},
                    'frontend': {'files': frontend_hashes(directory / 'mg')},
                    'approvedBefore': before, 'originalRelease': before['current'], 'rollbackRelease': str(rollback)}
        h.atomic(directory / 'manifest.json', json.dumps(manifest, indent=2))
    invariant(h, before)
    os.replace(recovery, rollback)
    os.replace(candidate, release)
    return {'state': 'MG staged and verified', 'release': args.release, 'rollbackRelease': str(rollback),
            'originalCurrent': before['current'], 'backendUploaded': False, 'backendHardlinked': True,
            'backendPid': before['pid'], 'backendSha256': before['backendSha256'],
            'retainedHashAssets': len(set(retained)), 'indexSha256': sha(release / 'mg/index.html')}


def public_document(h):
    return h.command(['curl', '--silent', '--show-error', '--max-time', '15', '--resolve',
                      h.PUBLIC_HOST + ':443:127.0.0.1',
                      h.PUBLIC_BASE + '/campus-demo/campus/overview']).stdout


def activate_remote(args, h, rollback=False):
    release = REMOTE / 'releases' / args.release
    manifest = json.loads((release / 'manifest.json').read_text())
    target = Path(manifest['rollbackRelease']) if rollback else release
    target_manifest = json.loads((target / 'manifest.json').read_text())
    if not rollback and str((REMOTE / 'current').resolve()) != manifest['originalRelease']:
        raise RuntimeError('Current changed since MG stage; restage from current before activation')
    before = snapshot(h)
    if before['pid'] != manifest['approvedBefore']['pid'] or before['backendSha256'] != manifest['backend']['sha256']:
        raise RuntimeError('Backend changed since MG stage')
    verify_files(target / 'mg', target_manifest['frontend']['files'])
    if (target / 'backend.jar').stat().st_ino != before['backendInode']:
        raise RuntimeError('Target backend is not the approved unchanged inode')
    h.atomic_link(target.name)
    try:
        after = invariant(h, before)
        body = public_document(h)
        if hashlib.sha256(body).hexdigest() != sha(target / 'mg/index.html'):
            raise RuntimeError('Public deep route does not serve chosen MG document')
    except Exception:
        recovery = Path(manifest['rollbackRelease'])
        h.atomic_link(recovery.name)
        invariant(h, before)
        raise RuntimeError('MG verification failed; old UI restored through compatibility rollback release') from None
    return {'state': 'MG rolled back' if rollback else 'MG activated', 'release': target.name,
            'originalRelease': manifest['originalRelease'], 'rollbackRelease': manifest['rollbackRelease'],
            'backendPIDUnchanged': before['pid'] == after['pid'], 'backendSha256': after['backendSha256'],
            'backendInodeUnchanged': before['backendInode'] == after['backendInode'],
            'nginxConfigurationAndPIDUnchanged': before['proxyHashes'] == after['proxyHashes'] and before['units']['nginx.service'] == after['units']['nginx.service'],
            'databaseAndRedisPIDsUnchanged': all(before['units'][x] == after['units'][x] for x in [h.MYSQL, h.REDIS]),
            'publicIndexSha256': sha(target / 'mg/index.html'), 'sharedBefore': before['sharedContainers'],
            'sharedAfter': after['sharedContainers'], 'checkedAt': h.clock()}


def main():
    p = argparse.ArgumentParser()
    p.add_argument('operation', choices=['stage', 'activate', 'rollback'])
    p.add_argument('--remote', action='store_true')
    p.add_argument('--config', help='Explicit non-secret local deployment JSON')
    p.add_argument('--config-json', help='Remote host configuration passed by the deploy client')
    p.add_argument('--execute', action='store_true', help='Enable configured remote operations')
    p.add_argument('--release', required=True)
    p.add_argument('--dist')
    p.add_argument('--expect-current')
    p.add_argument('--backend-sha')
    p.add_argument('--report')
    args = p.parse_args()
    if not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,59}', args.release):
        raise RuntimeError('Invalid MG release ID')
    if args.remote:
        if not args.config_json:
            raise RuntimeError('Remote host configuration is required')
        h = module(REMOTE / 'bin/campus-demo-host.py', 'campus_host')
        h.configure(json.loads(args.config_json))
        if os.geteuid() != 0 or socket.gethostname() != h.CONFIG['expected_hostname']:
            raise RuntimeError('Host/root contract mismatch')
        result = stage_remote(args, h) if args.operation == 'stage' else activate_remote(args, h, args.operation == 'rollback')
    else:
        if not args.config or not args.execute:
            raise RuntimeError('Remote operations require --config and --execute')
        d = module(Path(__file__).with_name('campus-demo-deploy.py'), 'campus_deploy')
        d.configure(args.config)
        remote_program = '/tmp/campus-demo-mg-' + uuid.uuid4().hex + '.py'
        if args.operation == 'stage':
            if not args.dist or not args.expect_current or not args.backend_sha:
                raise RuntimeError('Stage requires final dist and approved current/backend contract')
            dist = Path(args.dist).resolve()
            if not (dist / 'index.html').is_file() or any(x.is_symlink() for x in dist.rglob('*')):
                raise RuntimeError('Invalid frontend candidate')
            secret_values = [x.encode() for x in d.airiot_secrets().values()]
            if any(any(value in x.read_bytes() for value in secret_values) for x in dist.rglob('*') if x.is_file()):
                raise RuntimeError('Credential literal detected in frontend candidate')
            work = LOCAL / '.runtime/campus-demo' / (args.release + '-' + uuid.uuid4().hex[:8])
            work.mkdir(parents=True, mode=0o700)
            archive = work / 'mg.tar.gz'
            files = frontend_hashes(dist)
            with tarfile.open(archive, 'w:gz') as tar:
                for x in files:
                    tar.add(dist / x['path'], arcname='mg/' + x['path'], recursive=False)
            manifest_path = work / 'mg-manifest.json'
            manifest_path.write_text(json.dumps({'release': args.release, 'bytes': archive.stat().st_size,
                                                'sha256': sha(archive), 'files': files}, indent=2))
            stage = str(REMOTE / 'staging' / args.release)
            d.ssh(shlex.join(['sudo', '-n', 'install', '-d', '-m', '0750', '-o', d.CONFIG['upload_user'], '-g', d.CONFIG['upload_user'], stage]))
            d.upload(archive, stage + '/mg.tar.gz')
            d.upload(manifest_path, stage + '/mg-manifest.json')
            d.ssh(shlex.join(['sudo', '-n', 'chown', '-R', 'root:root', stage]))
        d.upload(Path(__file__), remote_program)
        command = ['sudo', '-n', 'python3', '-B', remote_program, args.operation, '--remote', '--release', args.release, '--config-json', json.dumps(d.remote_config())]
        if args.expect_current:
            command += ['--expect-current', args.expect_current]
        if args.backend_sha:
            command += ['--backend-sha', args.backend_sha]
        try:
            result = json.loads(d.ssh(shlex.join(command)))
        finally:
            d.ssh(shlex.join(['rm', '-f', remote_program]))
    if args.report:
        Path(args.report).write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({k: v for k, v in result.items() if k not in ['sharedBefore', 'sharedAfter']}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'state': 'failed', 'error': str(error) if isinstance(error, RuntimeError) else type(error).__name__}), file=sys.stderr)
        sys.exit(1)
