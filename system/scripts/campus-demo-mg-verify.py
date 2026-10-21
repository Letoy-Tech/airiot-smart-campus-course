#!/usr/bin/env python3
"""Read-only verification of MG releases, preserved assets and service identities."""
import argparse
import importlib.util
import json
from pathlib import Path


REMOTE_CHECK = r'''
import concurrent.futures, hashlib, importlib.util, json, os, socket
from pathlib import Path
ROOT = Path('/srv/campus-demo')
spec = importlib.util.spec_from_file_location('host', ROOT / 'bin/campus-demo-host.py')
h = importlib.util.module_from_spec(spec); spec.loader.exec_module(h)
h.configure(json.loads((ROOT / 'shared/deployment.json').read_text()))
if socket.gethostname() != h.CONFIG['expected_hostname']:
    raise RuntimeError('Host contract mismatch during read-only verification')
current = (ROOT / 'current').resolve()
manifest = json.loads((current / 'manifest.json').read_text())
original = Path(manifest['originalRelease'])
rollback = Path(manifest['rollbackRelease'])

def files(directory):
    m = json.loads((directory / 'manifest.json').read_text())
    checks = []
    for item in m['frontend']['files']:
        p = directory / 'mg' / item['path']
        readable = h.command(['runuser', '-u', 'www-data', '--', 'test', '-r', str(p)], check=False).returncode == 0
        checks.append({'path': item['path'], 'bytes': p.stat().st_size,
                       'sha256': h.digest(p), 'checksumMatches': h.digest(p) == item['sha256'] and p.stat().st_size == item['bytes'],
                       'wwwDataReadable': readable})
    return checks

def public(item):
    result = h.command(['curl', '--fail', '--silent', '--show-error', '--max-time', '15', '--resolve',
                        h.PUBLIC_HOST + ':443:127.0.0.1',
                        h.PUBLIC_BASE + '/campus-demo/' + item['path']], check=False)
    return {'path': item['path'], 'exit': result.returncode,
            'sha256': hashlib.sha256(result.stdout).hexdigest(),
            'checksumMatches': result.returncode == 0 and hashlib.sha256(result.stdout).hexdigest() == item['sha256']}

frontend = files(current)
recovery = files(rollback)
with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
    served = list(executor.map(public, manifest['frontend']['files']))
old_assets = []
for p in sorted((original / 'mg/assets').rglob('*')):
    if p.is_file():
        q = current / 'mg' / p.relative_to(original / 'mg')
        r = rollback / 'mg' / p.relative_to(original / 'mg')
        old_assets.append({'path': str(p.relative_to(original / 'mg')), 'originalSha256': h.digest(p),
                           'activeMatches': q.is_file() and h.digest(q) == h.digest(p),
                           'rollbackMatches': r.is_file() and h.digest(r) == h.digest(p)})
pid = h.text(['systemctl', 'show', h.UNIT, '-p', 'MainPID', '--value'])
fds = []
for p in sorted(Path('/proc', pid, 'fd').glob('*')):
    try:
        target = os.readlink(p)
        if target.endswith('/backend.jar'):
            fds.append({'fd': p.name, 'target': target, 'inode': p.stat().st_ino, 'sha256': h.digest(p)})
    except OSError:
        pass
units = {}
for unit in [h.UNIT, h.MYSQL, h.REDIS, 'nginx.service']:
    lines = h.text(['systemctl', 'show', unit, '-p', 'ActiveState', '-p', 'SubState', '-p', 'MainPID', '-p', 'UnitFileState'])
    units[unit] = dict(line.split('=', 1) for line in lines.splitlines())
shared_entries = []
for entry in h.CONFIG['shared_entries']:
    domain, expected, path = entry['host'], entry['status'], entry['path']
    result = h.command(['curl', '--silent', '--show-error', '--max-time', '10', '--resolve', domain + ':443:127.0.0.1',
                         '--output', '/dev/null', '--write-out', '%{http_code} %{ssl_verify_result}',
                         'https://' + domain + path], check=False)
    observed = result.stdout.decode().strip()
    shared_entries.append({'domain': domain, 'path': path, 'exit': result.returncode,
                            'httpTLS': observed, 'matches': result.returncode == 0 and observed == expected + ' 0'})
cache = h.command(['curl', '--silent', '--show-error', '--head', '--max-time', '10', '--resolve',
                    h.PUBLIC_HOST + ':443:127.0.0.1', h.PUBLIC_BASE + '/campus-demo/index.html']).stdout.decode()
print(json.dumps({'checkedAt': h.clock(), 'current': str(current), 'rollback': str(rollback), 'serverModified': False,
                  'frontend': frontend, 'rollbackFrontend': recovery, 'publicFiles': served, 'oldAssets': old_assets,
                  'backend': {'pid': int(pid), 'sha256': h.digest(current / 'backend.jar'),
                               'inode': (current / 'backend.jar').stat().st_ino, 'runningJarFDs': fds},
                  'units': units, 'proxyHashes': {str(p): h.digest(p) for p in [h.VHOST, h.ROUTES]},
                  'directHealthUP': h.health(5), 'sharedContainers': h.shared_state(), 'sharedEntries': shared_entries,
                  'indexNoCache': 'cache-control: no-cache' in cache.lower(),
                  'rollbackIndexMatchesOriginal': h.digest(rollback / 'mg/index.html') == h.digest(original / 'mg/index.html')}))
'''


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--config', required=True)
    p.add_argument('--execute', action='store_true')
    p.add_argument('--release', required=True)
    p.add_argument('--preflight', required=True)
    p.add_argument('--report', required=True)
    args = p.parse_args()
    if not args.execute:
        raise RuntimeError('Remote verification requires --config and --execute')
    spec = importlib.util.spec_from_file_location('deploy', Path(__file__).with_name('campus-demo-deploy.py'))
    deploy = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(deploy)
    deploy.configure(args.config)
    result = json.loads(deploy.ssh('sudo -n python3 -B -', REMOTE_CHECK.encode()))
    before = json.loads(Path(args.preflight).read_text())
    checks = {
        'expectedRelease': Path(result['current']).name == args.release,
        'allActiveFrontendChecksumsAndPermissions': all(x['checksumMatches'] and x['wwwDataReadable'] for x in result['frontend']),
        'allRollbackFrontendChecksumsAndPermissions': all(x['checksumMatches'] and x['wwwDataReadable'] for x in result['rollbackFrontend']),
        'allActiveFrontendServedExactHTTPSBytes': all(x['checksumMatches'] for x in result['publicFiles']),
        'allOriginalAssetsPreservedInActiveAndRollback': all(x['activeMatches'] and x['rollbackMatches'] for x in result['oldAssets']),
        'backendPIDInodeSHAUnchanged': all(before['backend'][x] == result['backend'][x] for x in ['pid', 'sha256', 'inode']),
        'runningJarFDsUnchanged': before['backend']['runningJarFDs'] == result['backend']['runningJarFDs'],
        'allUnitPIDsUnchanged': all(before['units'][unit]['MainPID'] == values['MainPID'] for unit, values in result['units'].items()),
        'allUnitsActiveRunningEnabled': all(x['ActiveState'] == 'active' and x['SubState'] == 'running' and x['UnitFileState'] == 'enabled' for x in result['units'].values()),
        'proxyConfigHashesUnchanged': all(before['proxy'][p]['sha256'] == digest for p, digest in result['proxyHashes'].items()),
        'sharedContainerIdentitiesUnchanged': sorted((x['name'], x['id'], x['imageId']) for x in before['sharedContainers']) == sorted((x['name'], x['id'], x['imageId']) for x in result['sharedContainers']),
        'allSharedDomainHTTPAndTLSChecks': all(x['matches'] for x in result['sharedEntries']),
        'backendHealthUP': result['directHealthUP'],
        'indexNoCache': result['indexNoCache'],
        'rollbackIndexMatchesOriginal': result['rollbackIndexMatchesOriginal'],
    }
    result['checks'] = checks
    result['status'] = 'PASS' if all(checks.values()) else 'FAIL'
    Path(args.report).write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'status': result['status'], 'checks': checks, 'files': len(result['frontend']),
                      'rollbackFiles': len(result['rollbackFrontend']), 'oldAssets': len(result['oldAssets']),
                      'sharedContainers': len(result['sharedContainers']), 'report': args.report}, ensure_ascii=False, indent=2))
    raise SystemExit(0 if all(checks.values()) else 1)


if __name__ == '__main__':
    main()
