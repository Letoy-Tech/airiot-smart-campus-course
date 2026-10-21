"""Operator-only live authentication checks; never prints credentials or tokens."""
from pathlib import Path
import datetime
import json
import urllib.request
import urllib.error

BASE = Path(__file__).resolve().parent
ORIGIN = 'http://127.0.0.1:5188'
checks = []
token = None


def request(method, path, body=None, bearer=None):
    headers = {'Accept': 'application/json'}
    if bearer:
        headers['Authorization'] = 'Bearer ' + bearer
    if body is not None:
        headers['Content-Type'] = 'application/json'
    req = urllib.request.Request(
        ORIGIN + path, data=None if body is None else json.dumps(body).encode(),
        headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=12) as response:
            return response.status, json.loads(response.read())
    except urllib.error.HTTPError as error:
        return error.code, json.loads(error.read())


def check(name, passed, observation):
    checks.append({'name': name, 'pass': bool(passed), 'observation': observation})
    if not passed:
        raise AssertionError('Live check failed: ' + name)


def main():
    global token
    # This one owned, generated local credential remains only in process memory.
    lines = (BASE.parent / 'campus-lab/.env').read_text().splitlines()
    password = next(line.split('=', 1)[1] for line in lines
                    if line.startswith('DEMO_PASSWORD='))
    status, data = request('GET', '/api/health')
    check('public health', status == 200 and data['data']['status'] == 'UP', status)
    for name, path, bearer in [
        ('devices need login', '/api/devices', None),
        ('me needs login', '/api/me', None),
        ('invalid token refused', '/api/me', 'invalid-course-test-token'),
    ]:
        status, _ = request('GET', path, bearer=bearer)
        check(name, status == 401, status)
    status, _ = request('POST', '/api/login',
                        {'username': 'manager', 'password': 'invalid-course-test-password'})
    check('wrong password refused', status == 401, status)
    status, _ = request('POST', '/api/login',
                        {'username': 'not-a-course-account', 'password': password})
    check('unknown user refused', status == 401, status)
    status, data = request('POST', '/api/login',
                           {'username': 'MANAGER', 'password': password})
    check('uppercase login accepted', status == 200 and data.get('code') == 0, status)
    result = data.get('data', {})
    token = result.get('token')
    check('token issued without logging', isinstance(token, str) and len(token) >= 32,
          'present' if isinstance(token, str) else 'absent')
    user = result.get('user', {})
    check('login identity is database canonical',
          user == {'username': 'manager', 'role': 'MANAGER'},
          {'username': user.get('username'), 'role': user.get('role')})
    check('login response has no password fields',
          not any('password' in key.lower() for key in result) and
          not any('password' in key.lower() for key in user), 'field names checked')
    status, data = request('GET', '/api/me', bearer=token)
    check('session identity is database canonical',
          status == 200 and data.get('data') == {'username': 'manager', 'role': 'MANAGER'},
          {'status': status, 'username': data.get('data', {}).get('username'),
           'role': data.get('data', {}).get('role')})
    status, data = request('GET', '/api/devices', bearer=token)
    rows = data.get('data')
    check('authenticated devices', status == 200 and isinstance(rows, list) and len(rows) == 16,
          {'status': status, 'count': len(rows) if isinstance(rows, list) else None})
    by_id = {row['id']: row for row in rows}
    check('unknown and offline preserved',
          by_id['d03']['online'] is None and by_id['d04']['online'] is False,
          {'d03': by_id['d03']['online'], 'd04': by_id['d04']['online']})
    status, data = request('POST', '/api/logout', bearer=token)
    check('logout succeeds', status == 200 and data.get('code') == 0, status)
    for path in ['/api/me', '/api/devices']:
        status, _ = request('GET', path, bearer=token)
        check('logged out token refused at ' + path, status == 401, status)
    token = None


if __name__ == '__main__':
    success = False
    try:
        main()
        success = True
    finally:
        if token:
            try:
                request('POST', '/api/logout', bearer=token)
            except Exception:
                pass
        now = datetime.datetime.now().astimezone()
        destination = BASE / 'environment' / ('09-03-live-api-checks-' + now.strftime('%Y%m%dT%H%M%S') + '.json')
        destination.write_text(json.dumps({'at': now.isoformat(), 'origin': ORIGIN,
            'kind': 'operator-live-HTTP-verification', 'success': success, 'checks': checks},
            ensure_ascii=False, indent=2))
        print(json.dumps({'success': success, 'checks': len(checks),
                          'evidence': str(destination)}, ensure_ascii=False))
