#!/usr/bin/env python3
"""Seed isolated DEMO accounts and verify local cases. Never change AIRIOT or print secrets."""
import argparse
from concurrent.futures import ThreadPoolExecutor
import json
from pathlib import Path
import secrets
import time
import urllib.error
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
checks = []


def check(name, condition, **evidence):
    checks.append({'name': name, 'pass': bool(condition), **evidence})
    if not condition:
        raise RuntimeError('Demo verification failed: ' + name)


def save_private(path, value):
    path.parent.mkdir(parents=True, exist_ok=True)
    path.parent.chmod(0o700)
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + '\n')
    path.chmod(0o600)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', required=True, help='Loopback API root or dedicated campus-demo/api root')
    parser.add_argument('--accounts', type=Path, default=ROOT / '.private/campus-demo-accounts.json')
    parser.add_argument('--report', type=Path, default=ROOT / 'docs/campus-demo-api-acceptance.json')
    parser.add_argument('--bootstrap', action='store_true', help='Initialize only an empty isolated demo database')
    parser.add_argument('--allow-local-simulated-controls', action='store_true', help='Retain the previously authorized local simulation control setting')
    args = parser.parse_args()
    base = args.base.rstrip('/')
    if args.allow_local_simulated_controls and base != 'http://127.0.0.1:8001':
        raise RuntimeError('Local simulation exception only applies to the existing local runtime')

    def request(method, path, token=None, body=None):
        headers = {'Content-Type': 'application/json'}
        if token:
            headers['Authorization'] = 'Bearer ' + token
        req = urllib.request.Request(base + path, headers=headers, method=method,
                                     data=None if body is None else json.dumps(body).encode())
        try:
            with urllib.request.urlopen(req, timeout=35) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            try:
                result = json.load(error)
            except Exception:
                result = {}
            return error.code, result
        except Exception:
            raise RuntimeError('Demo request transport or JSON failed') from None

    def ok(method, path, token=None, body=None):
        status, reply = request(method, path, token, body)
        if status != 200 or reply.get('code') != 0:
            raise RuntimeError(f'{method} {path.split("?")[0]} failed HTTP={status}, code={reply.get("code")}')
        return reply['data']

    def denied(name, method, path, token, body=None, expected=(403,)):
        status, _ = request(method, path, token, body)
        check(name, status in expected, httpStatus=status)

    if not args.accounts.exists():
        if not args.bootstrap:
            raise RuntimeError('Missing restricted account file; bootstrap must be explicitly selected')
        credentials = {role: {'username': 'DEMO_campus_' + role, 'password': secrets.token_urlsafe(24)}
                       for role in ['admin', 'manager', 'manager_other', 'viewer']}
        save_private(args.accounts, credentials)
    if args.accounts.stat().st_mode & 0o077:
        raise RuntimeError('Account file must have 0600 permissions')
    credentials = json.loads(args.accounts.read_text())
    if not credentials['admin'].get('uid'):
        if not args.bootstrap:
            raise RuntimeError('Restricted account file has not been bootstrapped')
        account = credentials['admin']
        user = ok('POST', '/auth/bootstrap', body={'username': account['username'], 'password': account['password'], 'nickname': 'DEMO 演示管理员'})
        account['uid'] = user['uid']
        save_private(args.accounts, credentials)

    users = {}
    for role in ['admin', 'manager', 'manager_other', 'viewer']:
        if role not in credentials:
            credentials[role] = {'username': 'DEMO_campus_' + role, 'password': secrets.token_urlsafe(24)}
            save_private(args.accounts, credentials)
        account = credentials[role]
        if role != 'admin' and not account.get('uid'):
            user = ok('POST', '/users', users['admin']['token'], {
                'username': account['username'], 'password': account['password'],
                'nickname': {'manager': 'DEMO 环境负责人', 'manager_other': 'DEMO 设施负责人', 'viewer': 'DEMO 学校查看者'}[role],
                'roles': 'CAMPUS_VIEWER' if role == 'viewer' else 'CAMPUS_MANAGER',
                'groupIds': 'ROOT', 'active': True, 'accountLocked': False})
            account['uid'] = user['uid']
            save_private(args.accounts, credentials)
        users[role] = ok('POST', '/auth/login', body={k: account[k] for k in ['username', 'password']})
    admin, manager, other, viewer = [users[r]['token'] for r in ['admin', 'manager', 'manager_other', 'viewer']]
    for role in ['admin', 'manager', 'manager_other', 'viewer']:
        cap = ok('GET', '/campus/capabilities', users[role]['token'])
        check(role + ' independent operations permissions', cap['canRead']
              and cap['canControl'] == (args.allow_local_simulated_controls and role != 'viewer')
              and cap['canHandleAlarms'] == (role != 'viewer')
              and cap['canAssignAlarms'] == (role == 'admin')
              and cap['canRunDemoScenarios'] == (role == 'admin'))
    demo = ok('GET', '/campus/demo/status', viewer)
    check('explicit enabled DEMO source', demo['enabled'] and len(demo['scenarios']) == 3, label=demo['label'])
    overview = ok('GET', '/campus/overview', viewer)
    counts = overview['completeness']
    check('actual isolated simulation inventory', overview['simulated'] is True
          and [counts['actualSpaces'], counts['actualDevices'], counts['actualPoints']] == [4, 16, 28], counts=counts)
    check('real AIRIOT readings available', len(overview['points']) == 28 and not overview['issues'],
          qualities=sorted({p['quality'] for p in overview['points']}))
    integration = ok('GET', '/campus/integrations/airiot/status', admin)
    check('dedicated machine read and control boundary', integration['connected'] and integration['isSuper'] is False
          and (integration['controlEnabled'] is False or args.allow_local_simulated_controls),
          controlEnabled=integration['controlEnabled'], localPreviouslyAuthorizedException=args.allow_local_simulated_controls)
    raw_before = ok('GET', '/campus/alarms?limit=50&skip=0', viewer)
    check('raw AIRIOT alarm read available', not raw_before['issues'], count=len(raw_before['items']))

    locations = ok('GET', '/campus/locations', admin)
    campus = next((x for x in locations['campuses'] if x['name'] == 'DEMO 联盟示范校园'), None)
    if campus is None:
        campus = ok('POST', '/campus/locations/campuses', admin, {'name': 'DEMO 联盟示范校园'})
    building = next((x for x in locations['buildings'] if x['campusId'] == campus['id'] and x['name'] == 'DEMO 教学楼'), None)
    if building is None:
        building = ok('POST', '/campus/locations/buildings', admin, {'campusId': campus['id'], 'name': 'DEMO 教学楼'})
    for space in overview['spaces']:
        ok('PUT', '/campus/locations/spaces/' + space['id'], admin, {'buildingId': building['id'], 'floor': 'DEMO 一层'})
    mapped = ok('GET', '/campus/locations', viewer)
    check('four persisted demo space mappings', sum(b['buildingId'] == building['id'] for b in mapped['bindings']) == 4)

    owners = {x['deviceId']: x for x in ok('GET', '/campus/device-owners', viewer)['items']}
    for device in overview['devices']:
        target = credentials['manager' if device['category'] in ['environment', 'energy'] else 'manager_other']['uid']
        prior = owners[device['id']]
        result = ok('PUT', '/campus/device-owners/' + device['id'], admin,
                    {'ownerUid': target, 'note': 'DEMO 学校展示责任分配，仅限模拟设备。', 'expectedVersion': prior['version']})
        check('owner persisted ' + device['id'], result['ownerUid'] == target and result['version'] > prior['version'])
    one_owner = ok('GET', '/campus/device-owners', viewer)['items'][0]
    stale_body = {'ownerUid': credentials['manager']['uid'], 'note': 'TEST old version', 'expectedVersion': one_owner['version'] - 1}
    denied('owner stale version rejected', 'PUT', '/campus/device-owners/' + one_owner['deviceId'], admin, stale_body, (409,))
    denied('viewer cannot edit owner', 'PUT', '/campus/device-owners/' + one_owner['deviceId'], viewer, stale_body)
    denied('manager cannot edit owner', 'PUT', '/campus/device-owners/' + one_owner['deviceId'], manager, stale_body)

    for token, name in [(viewer, 'viewer'), (manager, 'manager')]:
        denied(name + ' cannot trigger DEMO', 'POST', '/campus/demo-alarm-scenarios/temperature-patrol/trigger', token, {})
    cases = [ok('POST', '/campus/demo-alarm-scenarios/' + scenario['id'] + '/trigger', admin, {}) for scenario in demo['scenarios']]
    by_scenario = {case['scenario']: case for case in cases}
    temperature = by_scenario['temperature-patrol']
    communication = by_scenario['communication-patrol']
    check('three independent explicit DEMO cases', len({x['id'] for x in cases}) == 3
          and all(x['sourceType'] == 'DEMO' and x['sourceScope'] == 'LOCAL_DEMO' and x['simulated'] for x in cases))
    check('case inherits persisted device responsibility', temperature['assigneeUid'] == credentials['manager']['uid']
          and communication['assigneeUid'] == credentials['manager_other']['uid'])
    case_path = '/campus/alarm-cases/' + temperature['id']
    body = {'note': 'TEST unauthorized write', 'expectedVersion': temperature['version']}
    denied('viewer cannot start processing', 'POST', case_path + '/start', viewer, body)
    denied('other manager cannot process assigned case', 'POST', case_path + '/start', other, body)
    denied('manager cannot reassign', 'POST', case_path + '/assign', manager,
           {'assigneeUid': credentials['manager_other']['uid'], **body})
    denied('client source injection rejected', 'POST', case_path + '/start', manager,
           {**body, 'sourceState': 'RECOVERED'}, (400,))
    started = ok('POST', case_path + '/start', manager,
                 {'note': 'DEMO 开始温度巡查演练；不代表实际现场巡查。', 'expectedVersion': temperature['version']})
    check('assigned handler starts with persisted timeline', started['state'] == 'IN_PROGRESS'
          and started['version'] > temperature['version'] and len(started['timeline']) > len(temperature['timeline']))
    denied('stale action version rejected', 'POST', case_path + '/notes', manager,
           {'note': 'TEST stale note', 'expectedVersion': temperature['version']}, (409,))
    noted = ok('POST', case_path + '/notes', manager,
               {'note': 'DEMO 已记录模拟巡查步骤，等待演示来源恢复核实。', 'expectedVersion': started['version']})
    denied('active source cannot be closed', 'POST', case_path + '/close', manager,
           {'disposition': 'TEST unsafe close', 'expectedVersion': noted['version']}, (400, 409))
    denied('manager cannot recover DEMO source', 'POST', '/campus/demo-alarm-events/' + temperature['id'] + '/recover', manager,
           {'expectedVersion': noted['version']})

    # Genuine database row-lock race: same version can commit only one note and timeline entry.
    before = ok('GET', case_path, admin)
    def concurrent_note(index):
        return request('POST', case_path + '/notes', manager,
                       {'note': 'DEMO 并发记录核验 ' + str(index), 'expectedVersion': before['version']})[0]
    with ThreadPoolExecutor(max_workers=2) as pool:
        statuses = list(pool.map(concurrent_note, [1, 2]))
    after = ok('GET', case_path, viewer)
    check('MySQL concurrent same-version one success one conflict', sorted(statuses) == [200, 409]
          and after['version'] == before['version'] + 1 and len(after['timeline']) == len(before['timeline']) + 1,
          httpStatuses=sorted(statuses))

    close_path = '/campus/alarm-cases/' + communication['id']
    current = ok('POST', close_path + '/start', other,
                 {'note': 'DEMO 开始设备通信巡查演练。', 'expectedVersion': communication['version']})
    current = ok('POST', close_path + '/notes', other,
                 {'note': 'DEMO 记录模拟检查与处理步骤；未操作真实设备。', 'expectedVersion': current['version']})
    current = ok('POST', '/campus/demo-alarm-events/' + communication['id'] + '/recover', admin,
                 {'expectedVersion': current['version']})
    check('DEMO source recovery does not auto-close workflow', current['sourceState'] == 'RECOVERED'
          and current['state'] == 'IN_PROGRESS' and current['sourceVerifiedAt'] is None)
    denied('unverified recovery cannot close', 'POST', close_path + '/close', other,
           {'disposition': 'TEST unverified', 'expectedVersion': current['version']}, (400, 409))
    current = ok('POST', close_path + '/verify-recovery', other, {'expectedVersion': current['version']})
    check('DEMO source explicitly verified', current['sourceCheckOutcome'] == 'PASS' and current['sourceVerifiedAt'] is not None)
    closed = ok('POST', close_path + '/close', other,
                {'disposition': 'DEMO 模拟通信巡查处置完成，演示来源已核实恢复；不代表真实硬件恢复。', 'expectedVersion': current['version']})
    check('verified workflow closes with disposition and timeline', closed['state'] == 'CLOSED'
          and closed['closedAt'] is not None and closed['disposition'] and closed['timeline'][-1]['action'] == 'CLOSE')
    denied('closed case rejects further writes', 'POST', close_path + '/notes', other,
           {'note': 'TEST post-close write', 'expectedVersion': closed['version']}, (400, 409))
    raw_after = ok('GET', '/campus/alarms?limit=50&skip=0', viewer)
    check('local DEMO events remain separate from AIRIOT alarms',
          not any(a['id'] in {c['id'] for c in cases} for a in raw_after['items']), rawAlarmCount=len(raw_after['items']))
    final_cases = [ok('GET', '/campus/alarm-cases/' + c['id'], viewer) for c in cases]
    check('all DEMO records and source states preserved', all(c['sourceType'] == 'DEMO' and c['simulated'] for c in final_cases))
    report = {'checkedAt': int(time.time() * 1000), 'scope': 'isolated DEMO accounts, metadata and locally persisted scenarios only',
              'base': base, 'pass': all(c['pass'] for c in checks), 'checks': checks,
              'seedCases': [{'id': c['id'], 'scenario': c['scenario'], 'state': c['state'], 'version': c['version']} for c in final_cases],
              'remoteControlWrites': 0, 'externalNotifications': 0,
              'limitations': ['DEMO事件不是AIRIOT实时报警', '没有真实设备或实际校园运营验收', '浏览器验收单独记录']}
    args.report.parent.mkdir(parents=True, exist_ok=True)
    args.report.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'pass': report['pass'], 'checks': len(checks), 'report': str(args.report),
                      'seedStates': [c['state'] for c in final_cases], 'accountFile': str(args.accounts)}, ensure_ascii=False))


if __name__ == '__main__':
    try:
        main()
    except RuntimeError as error:
        print(str(error))
        raise SystemExit(1) from None
