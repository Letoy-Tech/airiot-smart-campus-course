"""Operator-only negative HTTP checks; all admin versions are stale to avoid writes."""
from pathlib import Path
import datetime, importlib.util, json

BASE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('auth_probe', BASE / 'auth-probe.py')
http = importlib.util.module_from_spec(spec)
spec.loader.exec_module(http)

if __name__ == '__main__':
    password = next(line.split('=', 1)[1] for line in (BASE.parent / 'campus-lab/.env').read_text().splitlines() if line.startswith('DEMO_PASSWORD='))
    results, token = [], None
    try:
        for user in ['viewer', 'manager', 'admin']:
            status, body = http.request('POST', '/api/login', {'username': user, 'password': password})
            assert status == 200, 'Local login failed'
            token = body['data']['token']
            status, body = http.request('GET', '/api/owners', bearer=token)
            assert status == 200, 'Owner read failed'
            before = body['data']
            row = next(row for row in before if row['deviceId'] == 'd01')
            assert row['version'] >= 2, 'Run browser conflict check first'
            attempts = [('spoofed admin role', row['version'], 403)] if user != 'admin' else [
                ('stale integer', 0, 409), ('fraction', 0.5, 400),
                ('numeric string', '0', 400), ('boolean', False, 400),
                ('negative', -1, 400), ('null', None, 400),
                ('missing', 'OMIT_FIELD', 400), ('overflow', 2**63, 400)]
            for label, version, expected in attempts:
                payload = {'username': 'manager', 'note': '拒绝检查不应覆盖', 'expectedVersion': version, 'role': 'ADMIN'}
                if label == 'missing': del payload['expectedVersion']
                status, response = http.request('PUT', '/api/owners/d01', payload, bearer=token)
                results.append({'check': label, 'username': user, 'status': status, 'expected': expected, 'pass': status == expected, 'message': response.get('message')})
                status, body = http.request('GET', '/api/owners', bearer=token)
                assert status == 200 and body['data'] == before, 'Rejected/stale request changed owner records'
            http.request('POST', '/api/logout', bearer=token)
            token = None
    finally:
        if token:
            try: http.request('POST', '/api/logout', bearer=token)
            except Exception: pass
        now = datetime.datetime.now().astimezone()
        dest = BASE / 'environment' / ('10-05-live-negative-checks-' + now.strftime('%Y%m%dT%H%M%S') + '.json')
        dest.write_text(json.dumps({'at': now.isoformat(), 'success': all(r['pass'] for r in results), 'checks': results}, ensure_ascii=False, indent=2))
        print(json.dumps({'checks': results, 'evidence': str(dest)}, ensure_ascii=False))
