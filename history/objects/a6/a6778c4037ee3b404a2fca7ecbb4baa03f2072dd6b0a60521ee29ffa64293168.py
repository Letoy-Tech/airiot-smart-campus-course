"""Operator-only real HTTP role checks, separate from AI-generated tests."""
from pathlib import Path
import datetime, importlib.util, json

BASE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('auth_probe', BASE / 'auth-probe.py')
http = importlib.util.module_from_spec(spec)
spec.loader.exec_module(http)

if __name__ == '__main__':
    results, token, success = [], None, False
    password = next(line.split('=', 1)[1] for line in (BASE.parent / 'campus-lab/.env').read_text().splitlines() if line.startswith('DEMO_PASSWORD='))
    try:
        for path in ['/api/audit', '/api/integration']:
            status, _ = http.request('GET', path)
            assert status == 401, 'Anonymous management API must require login'
            results.append({'username': 'anonymous', 'path': path, 'status': status})
        for username in ['admin', 'manager', 'viewer']:
            status, body = http.request('POST', '/api/login', {'username': username, 'password': password})
            assert status == 200, 'Local login failed'
            token = body['data']['token']
            status, body = http.request('GET', '/api/audit', bearer=token)
            assert status == (200 if username == 'admin' else 403), 'Audit role check failed'
            result = {'username': username, 'path': '/api/audit', 'status': status}
            if username == 'admin':
                assert isinstance(body['data'], list) and len(body['data']) >= 6
                result['actualAuditCount'] = len(body['data'])
                assert not any(key.lower() in {'password', 'token', 'headers', 'authorization'} for row in body['data'] for key in row)
            results.append(result)
            status, body = http.request('GET', '/api/integration', bearer=token)
            data = body.get('data')
            assert status == 200 and data['source'] == 'TEACHING_MOCK'
            assert data['simulated'] is True and data['controlEnabled'] is False and data['notificationsEnabled'] is False
            results.append({'username': username, 'path': '/api/integration', 'status': status, 'data': data})
            http.request('POST', '/api/logout', bearer=token)
            token = None
        success = True
    finally:
        if token:
            try: http.request('POST', '/api/logout', bearer=token)
            except Exception: pass
        now = datetime.datetime.now().astimezone()
        dest = BASE / 'environment' / ('11-04-live-permissions-' + now.strftime('%Y%m%dT%H%M%S') + '.json')
        dest.write_text(json.dumps({'at': now.isoformat(), 'success': success, 'checks': results}, ensure_ascii=False, indent=2))
        print(json.dumps({'success': success, 'checks': len(results), 'evidence': str(dest)}, ensure_ascii=False))
