"""Operator-only check against the newly generated handoff environment."""
from pathlib import Path
import datetime, json, urllib.request, urllib.error

BASE = Path(__file__).resolve().parent
password = next(line.split('=', 1)[1] for line in
                (BASE.parent / 'campus-lab-handoff/.env').read_text().splitlines()
                if line.startswith('DEMO_PASSWORD='))

def call(method, path, token=None, body=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    request = urllib.request.Request('http://127.0.0.1:8098' + path,
        data=json.dumps(body).encode() if body is not None else None,
        headers=headers, method=method)
    try:
        with urllib.request.urlopen(request, timeout=15) as response:
            return response.status, json.loads(response.read())
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read())

tokens = {}
result = {'at': datetime.datetime.now().isoformat(), 'sourceDirectory': 'campus-lab-handoff'}
try:
    for user in ['admin', 'viewer']:
        status, payload = call('POST', '/api/login', body={'username': user, 'password': password})
        assert status == 200
        tokens[user] = payload['data']['token']
    paths = ['/api/spaces', '/api/owners', '/api/cases', '/api/audit']
    before = {p: call('GET', p, tokens['admin'])[1]['data'] for p in paths}
    space = next(s for s in before['/api/spaces'] if s['id'] == 's1')
    status, payload = call('PUT', '/api/spaces/s1', tokens['viewer'],
                           {'building': space['building'], 'floor': space['floor'], 'role': 'ADMIN'})
    after = {p: call('GET', p, tokens['admin'])[1]['data'] for p in paths}
    result.update(success=status == 403 and before == after, actualStatus=status,
                  action='VIEWER PUT /api/spaces/s1 with spoofed body role',
                  allFourPublicSnapshotsUnchanged=before == after, baseline=before, readback=after)
finally:
    for token in tokens.values():
        call('POST', '/api/logout', token)
    password = None
    tokens.clear()

file = BASE / 'environment' / ('12-04-handoff-viewer-http-' + datetime.datetime.now().strftime('%Y%m%dT%H%M%S') + '.json')
file.write_text(json.dumps(result, ensure_ascii=False, indent=2))
print(json.dumps({'success': result['success'], 'actualStatus': result['actualStatus'],
                  'allFourSnapshotsUnchanged': result['allFourPublicSnapshotsUnchanged'], 'evidence': str(file)}))
raise SystemExit(0 if result['success'] else 1)
