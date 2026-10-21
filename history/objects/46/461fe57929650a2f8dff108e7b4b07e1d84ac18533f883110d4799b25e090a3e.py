"""Operator-only comparison of the live overview with the owned public fixture."""
from pathlib import Path
import datetime
import importlib.util
import json
import math

BASE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('auth_probe', BASE / 'auth-probe.py')
http = importlib.util.module_from_spec(spec)
spec.loader.exec_module(http)


def compare(expected, actual, path):
    if expected is None:
        assert actual is None, path + ': null was not preserved'
    elif isinstance(expected, bool):
        assert isinstance(actual, bool) and expected is actual, path + ': boolean differs'
    elif isinstance(expected, (int, float)):
        assert isinstance(actual, (int, float)) and not isinstance(actual, bool), path + ': not a number'
        assert math.isclose(expected, actual, rel_tol=1e-12, abs_tol=1e-12), path + ': number differs'
    elif isinstance(expected, str):
        assert isinstance(actual, str) and expected == actual, path + ': text differs'
    elif isinstance(expected, list):
        assert isinstance(actual, list) and len(expected) == len(actual), path + ': list size differs'
        for index, (left, right) in enumerate(zip(expected, actual)):
            compare(left, right, path + '[' + str(index) + ']')
    elif isinstance(expected, dict):
        assert isinstance(actual, dict), path + ': not an object'
        for key, value in expected.items():
            assert key in actual, path + ': missing ' + key
            compare(value, actual[key], path + '.' + key)
    else:
        raise AssertionError('Unsupported fixture type at ' + path)


if __name__ == '__main__':
    token = None
    result = {'kind': 'operator-live-HTTP-verification', 'success': False, 'checks': []}
    try:
        status, _ = http.request('GET', '/api/overview')
        assert status == 401, 'Overview must require login'
        result['checks'].append('anonymous overview refused with 401')
        password = next(line.split('=', 1)[1] for line in
            (BASE.parent / 'campus-lab/.env').read_text().splitlines()
            if line.startswith('DEMO_PASSWORD='))
        status, response = http.request('POST', '/api/login',
            {'username': 'admin', 'password': password})
        assert status == 200 and response.get('code') == 0, 'Course login failed'
        token = response['data']['token']
        status, response = http.request('GET', '/api/overview', bearer=token)
        assert status == 200 and response.get('code') == 0, 'Overview read failed'
        actual = response['data']
        keys = {'spaces', 'devices', 'points', 'history', 'alarms'}
        assert set(actual) == keys, 'Unexpected overview data keys'
        fixture = json.loads((BASE.parent / 'campus-lab/materials/mock-campus.json').read_text())
        counts = {}
        for key in sorted(keys):
            identity = (lambda row: (row['deviceId'], row['tagId'])) if key in {'points', 'history'} else (lambda row: row['id'])
            expected_rows = sorted(fixture[key], key=identity)
            actual_rows = sorted(actual[key], key=identity)
            compare(expected_rows, actual_rows, key)
            counts[key] = len(actual_rows)
            result['checks'].append(key + ': all public fixture fields, types and values preserved')
        for group in actual['history']:
            samples = group['samples']
            timestamps = [sample['time'] for sample in samples]
            assert timestamps == sorted(timestamps), 'History samples are not chronological'
        result['checks'].append('all history samples chronological')
        result['counts'] = counts
        result['success'] = True
    finally:
        if token:
            try:
                http.request('POST', '/api/logout', bearer=token)
            except Exception:
                pass
        now = datetime.datetime.now().astimezone()
        result['at'] = now.isoformat()
        destination = BASE / 'environment' / ('10-01-live-overview-checks-' + now.strftime('%Y%m%dT%H%M%S') + '.json')
        destination.write_text(json.dumps(result, ensure_ascii=False, indent=2))
        print(json.dumps({'success': result['success'], 'checks': len(result['checks']),
                          'evidence': str(destination)}, ensure_ascii=False))
