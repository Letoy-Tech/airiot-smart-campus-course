"""Operator-only live proof that read-only roles cannot write course spaces."""
from pathlib import Path
import datetime
import importlib.util
import json

BASE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('auth_probe', BASE / 'auth-probe.py')
http = importlib.util.module_from_spec(spec)
spec.loader.exec_module(http)


if __name__ == '__main__':
    token = None
    results = []
    success = False
    try:
        status, _ = http.request('GET', '/api/spaces')
        assert status == 401, 'Anonymous spaces must be refused'
        results.append({'check': 'anonymous read', 'status': status})
        password = next(line.split('=', 1)[1] for line in
            (BASE.parent / 'campus-lab/.env').read_text().splitlines()
            if line.startswith('DEMO_PASSWORD='))
        for username, role in [('viewer', 'VIEWER'), ('manager', 'MANAGER')]:
            status, body = http.request('POST', '/api/login',
                {'username': username, 'password': password})
            assert status == 200, 'Course login failed'
            token = body['data']['token']
            status, body = http.request('GET', '/api/spaces', bearer=token)
            assert status == 200 and len(body['data']) == 4, 'Authenticated spaces read failed'
            before = next(row for row in body['data'] if row['id'] == 's1')
            assert before['building'] == '教学楼 A' and before['floor'] == '1层', 'Admin browser write was not persisted'
            status, _ = http.request('PUT', '/api/spaces/s1', {
                'building': '权限拒绝检查不应落库', 'floor': '9层', 'role': 'ADMIN'}, bearer=token)
            assert status == 403, 'Non-admin role was not refused with 403'
            results.append({'check': 'spoofed body role cannot grant write',
                            'username': username, 'sessionRole': role, 'status': status})
            status, body = http.request('GET', '/api/spaces', bearer=token)
            after = next(row for row in body['data'] if row['id'] == 's1')
            assert status == 200 and after == before, 'Rejected write changed the space'
            results.append({'check': 'space unchanged after rejection', 'username': username,
                            'building': after['building'], 'floor': after['floor']})
            status, _ = http.request('POST', '/api/logout', bearer=token)
            assert status == 200, 'Probe logout failed'
            token = None
        success = True
    finally:
        if token:
            try:
                http.request('POST', '/api/logout', bearer=token)
            except Exception:
                pass
        now = datetime.datetime.now().astimezone()
        destination = BASE / 'environment' / ('10-04-live-permission-checks-' + now.strftime('%Y%m%dT%H%M%S') + '.json')
        destination.write_text(json.dumps({'at': now.isoformat(), 'success': success,
            'kind': 'operator-live-HTTP-verification', 'checks': results}, ensure_ascii=False, indent=2))
        print(json.dumps({'success': success, 'checks': len(results),
                          'evidence': str(destination)}, ensure_ascii=False))
