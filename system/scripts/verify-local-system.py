#!/usr/bin/env python3
"""Local synthetic account and live-chain acceptance; never print credentials or tokens."""
import argparse
import json
from pathlib import Path
import secrets
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:8001'
PRIVATE = ROOT / '.private'
REPORT = ROOT / 'docs/local-api-acceptance.json'
checks = []


def request(method, path, token=None, body=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(BASE + path, headers=headers, method=method,
                                 data=None if body is None else json.dumps(body).encode())
    try:
        with urllib.request.urlopen(req, timeout=60) as response:
            return response.status, json.load(response)
    except urllib.error.HTTPError as error:
        try:
            data = json.load(error)
        except Exception:
            data = {}
        return error.code, data
    except Exception:
        raise RuntimeError('Local request transport or JSON failed') from None


def ok(method, path, token=None, body=None):
    status, data = request(method, path, token, body)
    if status != 200 or data.get('code') != 0:
        raise RuntimeError(f'{method} {path.split("?")[0]} failed, HTTP={status}, code={data.get("code")}')
    return data.get('data')


def check(name, condition, **evidence):
    checks.append({'name': name, 'pass': bool(condition), **evidence})
    if not condition:
        raise RuntimeError('Acceptance failed: ' + name)


def denied(name, method, path, token, body=None, expected=(403,)):
    status, response = request(method, path, token, body)
    check(name, status in expected, httpStatus=status)


def accounts():
    path = PRIVATE / 'local-accounts.json'
    if not path.exists():
        data = {role: {'username': 'TEST_campus_' + role, 'password': secrets.token_urlsafe(24)}
                for role in ['admin', 'manager', 'viewer']}
        path.write_text(json.dumps(data, indent=2) + '\n')
        path.chmod(0o600)
    data = json.loads(path.read_text())
    if not data['admin'].get('uid'):
        user = ok('POST', '/auth/bootstrap', body={**data['admin'], 'nickname': 'TEST 系统管理员'})
        data['admin']['uid'] = user['uid']
        path.write_text(json.dumps(data, indent=2) + '\n')
        path.chmod(0o600)
    users = {}
    for role in ['admin', 'manager', 'viewer']:
        account = data[role]
        if role != 'admin' and not account.get('uid'):
            user = ok('POST', '/users', users['admin']['token'], {
                **account, 'nickname': 'TEST 校园' + ('管理员' if role == 'manager' else '查看者'),
                'roles': 'CAMPUS_MANAGER' if role == 'manager' else 'CAMPUS_VIEWER',
                'groupIds': 'ROOT', 'active': True, 'accountLocked': False})
            data[role]['uid'] = user['uid']
            path.write_text(json.dumps(data, indent=2) + '\n')
            path.chmod(0o600)
        users[role] = ok('POST', '/auth/login', body={'username': account['username'], 'password': account['password']})
    return users, data


def reads(users):
    token = users['admin']['token']
    overview = ok('GET', '/campus/overview', token)
    counts = overview['completeness']
    check('live 4 spaces / 16 devices / 28 points',
          [counts['actualSpaces'], counts['actualDevices'], counts['actualPoints']] == [4, 16, 28], counts=counts)
    check('28 point qualities fresh', all(p['quality'] == 'fresh' for p in overview['points']),
          qualities=sorted(set(p['quality'] for p in overview['points'])))
    check('no overview issues', not overview['issues'], issues=overview['issues'])
    integration = ok('GET', '/campus/integrations/airiot/status', token)
    check('dedicated non-super machine identity', integration['connected'] and integration['isSuper'] is False,
          identityId=integration.get('identityId'), isSuper=integration.get('isSuper'))
    now = int(time.time() * 1000)
    for device, tag in [('env_demo_01','temperature_c'), ('energy_demo_01','power_kw'),
                        ('facility_demo_01','run_state'), ('light_demo_01','illuminance_lux')]:
        path = '/campus/history?' + urllib.parse.urlencode({'deviceId': device, 'tagId': tag, 'from': now-3600000, 'to': now})
        history = ok('GET', path, token)
        check('raw history ' + device + '/' + tag, len(history['samples']) > 0 and not history['issues'],
              sampleCount=len(history['samples']), truncated=history['truncated'])
    alarms = ok('GET', '/campus/alarms?limit=50&skip=0', token)
    check('scoped real alarm read', not alarms['issues'], sampleCount=len(alarms['items']), total=alarms['total'],
          statuses=sorted(set(a['status'] for a in alarms['items'])), levels=sorted(set(a['level'] for a in alarms['items'])))
    return overview


def security(users, data):
    admin = users['admin']['token']
    manager = users['manager']['token']
    viewer = users['viewer']['token']
    for name, token in [('admin', admin), ('manager', manager), ('viewer', viewer)]:
        cap = ok('GET', '/campus/capabilities', token)
        check(name + ' capability matrix', cap['canRead'] and cap['canControl'] == (name != 'viewer')
              and cap['canAdmin'] == (name == 'admin') and cap['canAudit'] == (name == 'admin'), capabilities=cap)
        check(name + ' self identity', ok('GET', '/users/me', token)['uid'] == data[name]['uid'])
    for name, token in [('manager',manager), ('viewer',viewer)]:
        for path in ['/roles', '/groups', '/users/organization/all', '/security/api-rules',
                     '/campus/audit', '/campus/integrations/airiot/status']:
            denied(name + ' blocked ' + path, 'GET', path, token)
        denied(name + ' cannot create user', 'POST', '/users', token, {})
        denied(name + ' cannot map campus', 'POST', '/campus/locations/campuses', token, {'name':'TEST forbidden'})
    denied('viewer cannot switch', 'POST', '/campus/devices/facility_demo_01/simulated-switch', viewer,
           {'on':False,'expectedState':False,'reason':'TEST readonly deny'})
    denied('invalid token rejected', 'GET', '/campus/overview', 'invalid', expected=(401,))
    denied('anonymous rejected', 'GET', '/campus/overview', None, expected=(401,))
    denied('strict Boolean validation', 'POST', '/campus/devices/facility_demo_01/simulated-switch', admin,
           {'on':'false','expectedState':False,'reason':'TEST strict Boolean'}, expected=(400,))
    denied('non-control device blocked', 'POST', '/campus/devices/env_demo_01/simulated-switch', admin,
           {'on':False,'expectedState':False,'reason':'TEST deny environment write'}, expected=(400,403))
    denied('unknown object blocked', 'POST', '/campus/devices/outside_scope/simulated-switch', admin,
           {'on':False,'expectedState':False,'reason':'TEST deny unknown'}, expected=(400,))
    denied('self profile cannot change group permissions', 'PUT', '/users/me/profile', viewer,
           {'nickname':'TEST 校园查看者','groupIds':'ROOT'}, expected=(400,403))
    refreshed = ok('POST', '/auth/refresh', body={'refreshToken':users['manager']['refreshToken']})
    check('normal refresh issues usable access token',
          ok('GET','/campus/capabilities',refreshed['accessToken'])['canControl'])
    account_file = PRIVATE / 'local-accounts.json'
    if not data.get('admin_only'):
        data['admin_only'] = {'username':'TEST_campus_admin_only','password':secrets.token_urlsafe(24)}
        user = ok('POST','/users',admin,{**data['admin_only'],'nickname':'TEST 单管理员角色',
                                      'roles':'ADMIN','groupIds':'ROOT','active':True,'accountLocked':False})
        data['admin_only']['uid'] = user['uid']
        account_file.write_text(json.dumps(data,indent=2)+'\n')
        account_file.chmod(0o600)
    admin_only = ok('POST','/auth/login',body={k:data['admin_only'][k] for k in ['username','password']})['token']
    admin_role = ok('GET','/roles/ADMIN',admin)
    try:
        ok('PUT','/roles/ADMIN',admin,{**admin_role,'status':0})
        denied('pure ADMIN disabled loses management', 'GET','/roles',admin_only)
        denied('pure ADMIN disabled cannot reactivate self role', 'PUT','/roles/ADMIN',admin_only,{**admin_role,'status':1})
    finally:
        ok('PUT','/roles/ADMIN',admin,{**admin_role,'status':1})
    role = ok('GET', '/roles/CAMPUS_VIEWER', admin)
    try:
        ok('PUT', '/roles/CAMPUS_VIEWER', admin, {**role, 'status':0})
        cap = ok('GET', '/campus/capabilities', viewer)
        check('disabled role immediately loses capability', not cap['canRead'])
        denied('disabled role immediately loses data', 'GET', '/campus/overview', viewer)
    finally:
        ok('PUT', '/roles/CAMPUS_VIEWER', admin, {**role, 'status':1})
    try:
        ok('PATCH', '/users/' + data['viewer']['uid'] + '/status', admin, {'active':True,'accountLocked':True})
        denied('locked account rejects existing token', 'GET', '/campus/capabilities', viewer, expected=(401,403))
        status, response = request('POST','/auth/login',body={k:data['viewer'][k] for k in ['username','password']})
        check('locked account rejects login', status != 200 or response.get('code') != 0, httpStatus=status)
    finally:
        ok('PATCH', '/users/' + data['viewer']['uid'] + '/status', admin, {'active':True,'accountLocked':False})


def controls(users, overview):
    token = users['admin']['token']
    states = {d['id']:d['switchOn'] for d in overview['devices'] if d['category'] in ['facility','lighting']}
    check('8 initial strict Boolean states', len(states)==8 and all(type(v) is bool for v in states.values()), states=states)
    for device, initial in states.items():
        try:
            result = ok('POST', '/campus/devices/' + device + '/simulated-switch', token,
                        {'on':not initial,'expectedState':initial,'reason':'TEST local acceptance temporary toggle'})
            check(device + ' write then readback', result['confirmed'] is (not initial), auditId=result['auditId'])
            current = ok('GET', '/campus/devices', token)['items']
            values = {d['id']:d['switchOn'] for d in current if d['id'] in states}
            check(device + ' seven other objects unchanged', all(values[k] is v for k,v in states.items() if k != device))
        finally:
            current = ok('GET', '/campus/devices', token)['items']
            before = next(d['switchOn'] for d in current if d['id']==device)
            if before is not initial:
                result = ok('POST', '/campus/devices/' + device + '/simulated-switch', token,
                            {'on':initial,'expectedState':before,'reason':'TEST restore acceptance initial state'})
                check(device + ' initial state restored', result['confirmed'] is initial, auditId=result['auditId'])
    audit = ok('GET', '/campus/audit?limit=100&skip=0', token)
    check('command audits persisted', len([a for a in audit['items'] if a['outcome']=='CONFIRMED']) >= 16,
          total=audit['total'], outcomes=sorted(set(a['outcome'] for a in audit['items'])))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--controls', action='store_true')
    args = parser.parse_args()
    report = {'checkedAt':int(time.time()*1000),'scope':'local TEST accounts and fixed simulated AIRIOT project','checks':checks}
    try:
        users, data = accounts()
        overview = reads(users)
        security(users, data)
        if args.controls:
            controls(users, overview)
        report['pass'] = True
    except Exception as error:
        report['pass'] = False
        report['error'] = str(error) if isinstance(error,RuntimeError) else 'Unexpected local acceptance error'
    REPORT.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'pass':report['pass'],'checks':len(checks),'failed':[c['name'] for c in checks if not c['pass']],
                      'error':report.get('error'),'report':str(REPORT)},ensure_ascii=False))
    raise SystemExit(0 if report['pass'] else 1)
