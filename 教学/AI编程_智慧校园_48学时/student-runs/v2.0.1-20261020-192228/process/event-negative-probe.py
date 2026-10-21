"""Operator live rejection checks; read back all affected business data and audit."""
from pathlib import Path
import datetime, importlib.util, json

BASE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('auth_probe', BASE / 'auth-probe.py')
http = importlib.util.module_from_spec(spec)
spec.loader.exec_module(http)

if __name__ == '__main__':
    tokens, results, success = {}, [], False
    password = next(line.split('=', 1)[1] for line in (BASE.parent / 'campus-lab/.env').read_text().splitlines() if line.startswith('DEMO_PASSWORD='))
    identities = json.loads((BASE / 'environment/11-event-identities.json').read_text())
    auto_id, closed_id = identities['auto']['id'], identities['manual']['id']
    before, latest = None, None
    try:
        for username in ['admin', 'manager', 'viewer']:
            status, body = http.request('POST', '/api/login', {'username': username, 'password': password})
            assert status == 200, 'Local course login failed'
            tokens[username] = body['data']['token']

        def snapshot():
            data = {}
            for path in ['/api/cases', '/api/spaces', '/api/owners', '/api/audit']:
                status, body = http.request('GET', path, bearer=tokens['admin'])
                assert status == 200, 'Readback failed'
                data[path] = body['data']
            return data

        before = snapshot()
        auto = next(row for row in before['/api/cases'] if row['id'] == auto_id)
        closed = next(row for row in before['/api/cases'] if row['id'] == closed_id)
        assert auto['state'] == 'ASSIGNED' and auto['version'] == 1
        assert closed['state'] == 'CLOSED' and closed['version'] == 7
        space = next(row for row in before['/api/spaces'] if row['id'] == 's1')

        def check(label, username, method, path, payload, expected):
            global latest
            status, _ = http.request(method, path, payload, bearer=tokens[username])
            latest = snapshot()
            unchanged = latest == before
            results.append({'check': label, 'username': username, 'status': status,
                            'expected': expected, 'businessAndAuditUnchanged': unchanged,
                            'pass': status == expected and unchanged})
            assert status == expected, 'Unexpected rejection status; see evidence'
            assert unchanged, 'Rejected operation changed business records or audit; see evidence'

        check('viewer cannot write space with spoofed role', 'viewer', 'PUT', '/api/spaces/s1',
              {'building': space['building'], 'floor': space['floor'], 'role': 'ADMIN'}, 403)
        check('viewer cannot write owner', 'viewer', 'PUT', '/api/owners/d01',
              {'username': 'manager', 'note': '拒绝检查不应覆盖', 'expectedVersion': 0, 'role': 'ADMIN'}, 403)
        for username, action in [('viewer', 'start'), ('manager', 'assign'), ('manager', 'recover')]:
            check(username + ' cannot ' + action, username, 'POST', '/api/cases/' + auto_id + '/actions',
                  {'action': action, 'expectedVersion': 0, 'username': 'manager', 'note': '拒绝检查', 'role': 'ADMIN'}, 403)

        for label, value in [('fraction', 0.5), ('numeric string', '0'), ('boolean', False),
                             ('negative', -1), ('null', None), ('missing', None), ('overflow', 2**63)]:
            payload = {'action': 'start', 'expectedVersion': value}
            if label == 'missing': del payload['expectedVersion']
            check('version ' + label, 'admin', 'POST', '/api/cases/' + auto_id + '/actions', payload, 400)
        check('valid stale integer version', 'admin', 'POST', '/api/cases/' + auto_id + '/actions',
              {'action': 'start', 'expectedVersion': 0}, 409)
        check('client cannot invent recovery or verification', 'admin', 'POST', '/api/cases/' + auto_id + '/actions',
              {'action': 'close', 'expectedVersion': 1, 'note': '前端伪造不能关闭',
               'verified': True, 'sourceState': 'RECOVERED'}, 409)
        for action in ['assign', 'start', 'note', 'recover', 'verify', 'close']:
            check('closed event refuses ' + action, 'admin', 'POST', '/api/cases/' + closed_id + '/actions',
                  {'action': action, 'expectedVersion': 7, 'username': 'manager', 'note': '关闭后拒绝检查'}, 409)
        success = True
    finally:
        for token in tokens.values():
            try: http.request('POST', '/api/logout', bearer=token)
            except Exception: pass
        now = datetime.datetime.now().astimezone()
        destination = BASE / 'environment' / ('11-05-live-negative-checks-' + now.strftime('%Y%m%dT%H%M%S') + '.json')
        destination.write_text(json.dumps({'at': now.isoformat(), 'success': success, 'checks': results,
            'baselineAuditCount': len(before['/api/audit']) if before else None,
            'baseline': before, 'latestReadback': latest}, ensure_ascii=False, indent=2))
        print(json.dumps({'success': success, 'checks': len(results), 'evidence': str(destination)}, ensure_ascii=False))
