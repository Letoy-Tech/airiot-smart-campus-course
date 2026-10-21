"""Operator-only local HTTP acceptance probe, not student implementation.

Uses only this exercise's loopback service and private local test accounts.
Never prints cookies, CSRF tokens, account file contents, or passwords.
"""
from pathlib import Path
import argparse
import datetime
import http.cookiejar
import json
import urllib.error
import urllib.parse
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
BASE = 'http://127.0.0.1:8091/api/'


class Client:
    def __init__(self, username):
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(http.cookiejar.CookieJar()))
        self.csrf = None
        self.csrf = self.call('GET', 'auth/csrf')[1]['data']
        accounts = json.loads((ROOT / 'app/.private/accounts.json').read_text())['accounts']
        password = next(x['password'] for x in accounts if x['username'] == username)
        code, _ = self.call('POST', 'auth/login', {'username': username, 'password': password}, form=True)
        if code != 200:
            raise RuntimeError('Local exercise login failed; credentials omitted')
        self.csrf = self.call('GET', 'auth/csrf')[1]['data']
        code, envelope = self.call('GET', 'campus/overview')
        if code != 200 or envelope.get('data', {}).get('source') != 'TEACHING_MOCK':
            raise RuntimeError('Refusing a service without TEACHING_MOCK identity')

    def call(self, method, path, body=None, form=False):
        headers = {}
        data = None
        if body is not None:
            headers['Content-Type'] = 'application/x-www-form-urlencoded' if form else 'application/json'
            data = (urllib.parse.urlencode(body) if form else json.dumps(body)).encode()
        if self.csrf and method != 'GET':
            headers[self.csrf['headerName']] = self.csrf['token']
        request = urllib.request.Request(BASE + path, data=data, headers=headers, method=method)
        try:
            with self.opener.open(request, timeout=12) as response:
                return response.status, json.load(response)
        except urllib.error.HTTPError as error:
            try:
                return error.code, json.load(error)
            except ValueError:
                return error.code, {}


def locations():
    admin = Client('admin')
    before = admin.call('GET', 'campus/locations')[1]['data']
    binding = next(x for x in before['bindings'] if x['spaceId'] == 'teaching_space_01')
    invalid_status, invalid = admin.call('PUT', 'campus/locations/spaces/teaching_space_01',
                                        {'buildingId': 'nonexistent-building-probe', 'floor': '1层'})
    after_invalid = admin.call('GET', 'campus/locations')[1]['data']
    viewer = Client('viewer')
    viewer_status, viewer_response = viewer.call('PUT', 'campus/locations/spaces/teaching_space_01',
                                               {'buildingId': binding['buildingId'], 'floor': '1层'})
    after_viewer = admin.call('GET', 'campus/locations')[1]['data']
    result = {'scenario': 'location-negative-http', 'invalidBuildingStatus': invalid_status,
              'invalidBuildingBusinessCode': invalid.get('code'),
              'invalidBindingUnchanged': before == after_invalid,
              'viewerWriteStatus': viewer_status, 'viewerBusinessCode': viewer_response.get('code'),
              'viewerWriteUnchanged': before == after_viewer, 'savedBinding': binding,
              'locations': after_viewer,
              'passed': invalid_status == 404 and before == after_invalid and viewer_status == 403 and before == after_viewer}
    return result


def access():
    try:
        with urllib.request.urlopen(BASE + 'campus/devices', timeout=12) as response:
            anonymous_status = response.status
    except urllib.error.HTTPError as error:
        anonymous_status = error.code
    viewer_status, _ = Client('viewer').call('GET', 'campus/integrations/airiot/status')
    manager_status, _ = Client('manager-a').call('GET', 'campus/integrations/airiot/status')
    admin_status, integration = Client('admin').call('GET', 'campus/integrations/airiot/status')
    viewer_audit_status, _ = Client('viewer').call('GET', 'campus/command-audit?limit=2&skip=0')
    admin_audit_status, _ = Client('admin').call('GET', 'campus/command-audit?limit=2&skip=0')
    result = {'scenario': 'access-boundaries-http', 'anonymousReadStatus': anonymous_status,
              'viewerIntegrationStatus': viewer_status, 'managerIntegrationStatus': manager_status,
              'adminIntegrationStatus': admin_status,
              'viewerAuditStatus': viewer_audit_status, 'adminAuditStatus': admin_audit_status,
              'controlEnabled': integration.get('data', {}).get('controlEnabled'),
              'passed': anonymous_status == 401 and viewer_status == 403 and manager_status == 403
                        and admin_status == 200 and viewer_audit_status == 403 and admin_audit_status == 200
                        and integration.get('data', {}).get('controlEnabled') is False}
    return result


def case_permissions(case_id):
    if not case_id or len(case_id) > 80 or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_' for c in case_id):
        raise SystemExit('An observed local case ID is required')
    admin = Client('admin')
    path = 'campus/alarm-cases/' + case_id
    code, envelope = admin.call('GET', path)
    before = envelope.get('data', {})
    if code != 200 or before.get('sourceScope') != 'LOCAL_DEMO' or before.get('simulated') is not True:
        raise SystemExit('Refusing a case without explicit LOCAL_DEMO identity')
    if before.get('state') != 'IN_PROGRESS' or before.get('assigneeUid') != 'manager-a':
        raise SystemExit('Case must already be in progress and assigned to manager-a')
    body = {'expectedVersion': before['version'], 'note': '权限拒绝验收探针：此记录不应被保存'}
    manager_status, _ = Client('manager-b').call('POST', path + '/notes', body)
    viewer_status, _ = Client('viewer').call('POST', path + '/notes', body)
    after = admin.call('GET', path)[1]['data']
    fields = ['state', 'version', 'assigneeUid', 'timeline']
    unchanged = all(before.get(k) == after.get(k) for k in fields)
    return {'scenario': 'case-permissions-http', 'caseId': case_id,
            'managerBNoteStatus': manager_status, 'viewerNoteStatus': viewer_status,
            'stateVersionAssigneeTimelineUnchanged': unchanged,
            'version': after.get('version'), 'state': after.get('state'),
            'passed': manager_status in [403, 404] and viewer_status == 403 and unchanged}


def close_probe(kind, case_id):
    if not case_id or len(case_id) > 80 or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_' for c in case_id):
        raise SystemExit('An observed local case ID is required')
    admin = Client('admin')
    path = 'campus/alarm-cases/' + case_id
    status, envelope = admin.call('GET', path)
    before = envelope.get('data', {})
    if status != 200 or before.get('sourceScope') != 'LOCAL_DEMO' or before.get('simulated') is not True:
        raise SystemExit('Refusing a case without explicit LOCAL_DEMO identity')
    has_note = any(x.get('action') == 'NOTE' for x in before.get('timeline', []))
    in_progress = before.get('state') == 'IN_PROGRESS'
    recovered = before.get('sourceState') == 'RECOVERED'
    verified = before.get('sourceCheckOutcome') == 'PASS'
    conditions = {
        'close-unrecovered': in_progress and has_note and not recovered,
        'close-unverified': in_progress and has_note and recovered and not verified,
        'close-no-note': in_progress and not has_note and recovered and verified,
        'close-empty-conclusion': in_progress and has_note and recovered and verified,
        'closed-note': before.get('state') == 'CLOSED',
    }
    if not conditions.get(kind):
        raise SystemExit('Observed case does not match the intended single rejection precondition')
    action = 'notes' if kind == 'closed-note' else 'close'
    field = 'note' if action == 'notes' else 'disposition'
    value = ' ' if kind == 'close-empty-conclusion' else '拒绝分支验收探针：不应产生状态或时间线变更'
    code, reply = admin.call('POST', path + '/' + action, {'expectedVersion': before['version'], field: value})
    after = admin.call('GET', path)[1]['data']
    unchanged = all(before.get(k) == after.get(k) for k in ['state', 'version', 'timeline', 'closedAt', 'disposition'])
    expected_status = 400 if kind == 'close-empty-conclusion' else 409
    return {'scenario': kind, 'caseId': case_id, 'httpStatus': code, 'businessMessage': reply.get('message'),
            'expectedStatus': expected_status, 'stateVersionTimelineUnchanged': unchanged,
            'state': after.get('state'), 'version': after.get('version'),
            'passed': code == expected_status and unchanged}


def owner_snapshots(case_a, case_b, expected_owner, expected_version):
    for case_id in [case_a, case_b]:
        if not case_id or len(case_id) > 80 or any(c not in 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_' for c in case_id):
            raise SystemExit('Observed local case IDs are required')
    admin = Client('admin')
    owner = admin.call('GET', 'campus/device-owners/teaching_env_01')[1]['data']
    a = admin.call('GET', 'campus/alarm-cases/' + case_a)[1]['data']
    b = admin.call('GET', 'campus/alarm-cases/' + case_b)[1]['data']
    source_ok = all(x.get('deviceId') == 'teaching_env_01' and x.get('sourceScope') == 'LOCAL_DEMO'
                    and x.get('simulated') is True for x in [a, b])
    result = {'scenario': 'owner-event-snapshots', 'oldCaseId': case_a, 'oldAssignee': a.get('assigneeUid'),
              'newCaseId': case_b, 'newAssignee': b.get('assigneeUid'),
              'ownerUid': owner.get('ownerUid'), 'ownerVersion': owner.get('version'),
              'ownerTimelineVersions': [x.get('version') for x in owner.get('timeline', [])],
              'passed': source_ok and a.get('assigneeUid') == 'manager-a' and b.get('assigneeUid') == 'manager-b'
                        and owner.get('ownerUid') == expected_owner and owner.get('version') == expected_version}
    return result


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('scenario', choices=['locations', 'access', 'case-permissions', 'close-unrecovered', 'close-unverified', 'close-no-note', 'close-empty-conclusion', 'closed-note', 'owner-snapshots'])
    parser.add_argument('--output', required=True)
    parser.add_argument('--case-id')
    parser.add_argument('--other-case-id')
    parser.add_argument('--expected-owner', choices=['manager-a', 'manager-b'])
    parser.add_argument('--expected-version', type=int)
    args = parser.parse_args()
    if args.scenario == 'case-permissions':
        result = case_permissions(args.case_id)
    elif args.scenario.startswith('close-') or args.scenario == 'closed-note':
        result = close_probe(args.scenario, args.case_id)
    elif args.scenario == 'owner-snapshots':
        result = owner_snapshots(args.case_id, args.other_case_id, args.expected_owner, args.expected_version)
    else:
        result = {'locations': locations, 'access': access}[args.scenario]()
    result['recordedAt'] = datetime.datetime.now(datetime.timezone.utc).isoformat()
    output = (ROOT / args.output).resolve()
    if not output.is_relative_to(ROOT / 'evidence'):
        raise SystemExit('Output must be inside this exercise evidence directory')
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps(result, ensure_ascii=False))
    raise SystemExit(0 if result['passed'] else 1)
