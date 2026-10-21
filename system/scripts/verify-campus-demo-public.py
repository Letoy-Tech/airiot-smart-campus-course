#!/usr/bin/env python3
"""Read public school-demo delivery with protected synthetic accounts; never seed cases."""
import hashlib
import argparse
import json
from pathlib import Path
import re
import time
import urllib.error
import urllib.request
import urllib.parse

ROOT = Path(__file__).resolve().parents[1]
BASE = None
checks = []
sessions = []


def check(name, condition, **evidence):
    checks.append({'name': name, 'pass': bool(condition), **evidence})
    if not condition:
        raise RuntimeError('Public verification failed: ' + name)


def request(path, token=None, body=None):
    headers = {'Content-Type': 'application/json'}
    if token:
        headers['Authorization'] = 'Bearer ' + token
    req = urllib.request.Request(BASE + path, headers=headers,
        data=None if body is None else json.dumps(body).encode(),
        method='GET' if body is None else 'POST')
    try:
        with urllib.request.urlopen(req, timeout=30) as reply:
            return reply.status, reply.headers.get_content_type(), reply.read()
    except urllib.error.HTTPError as error:
        return error.code, error.headers.get_content_type(), error.read()


def api(path, token=None, body=None):
    status, content_type, raw = request('api/' + path, token, body)
    if status != 200 or content_type != 'application/json':
        raise RuntimeError('Public API failed: ' + path.split('?')[0])
    reply = json.loads(raw)
    if reply.get('code') != 0:
        raise RuntimeError('Public API business result failed: ' + path.split('?')[0])
    return reply['data']


def main():
    accounts_path = ROOT / '.private/campus-demo-accounts.json'
    if accounts_path.stat().st_mode & 0o077:
        raise RuntimeError('Account file must be private')
    accounts = json.loads(accounts_path.read_text())
    dist = ROOT / 'Letoy WAGF MG/dist'
    index = (dist / 'index.html').read_bytes()
    for path in ['', 'login', 'campus/operations', 'campus/overview',
                 'campus/device-owners', 'campus/alarm-cases/showcase-deep-link']:
        status, content_type, raw = request(path)
        check('public SPA ' + (path or 'root'), status == 200
              and content_type == 'text/html' and raw == index,
              httpStatus=status, indexSHA256=hashlib.sha256(raw).hexdigest())
    assets = re.findall(r'(?:src|href)="/campus-demo/([^"]+)"', index.decode())
    for path in assets:
        status, content_type, raw = request(path)
        expected = (dist / path).read_bytes()
        check('public asset ' + path, status == 200 and raw == expected,
              contentType=content_type, bytes=len(raw), sha256=hashlib.sha256(raw).hexdigest())
    status, _, _ = request('api/campus/capabilities')
    check('anonymous cannot read campus', status in (401, 403), httpStatus=status)
    users = {}
    for role in ['admin', 'manager', 'manager_other', 'viewer']:
        credentials = {key: accounts[role][key] for key in ['username', 'password']}
        user = api('auth/login', body=credentials)
        sessions.append({'refreshToken': user['refreshToken'], 'token': user['token']})
        users[role] = user
        cap = api('campus/capabilities', user['token'])
        check('public ' + role + ' capabilities', cap['canRead'] is True
              and cap['canControl'] is False
              and cap['canHandleAlarms'] == (role != 'viewer')
              and cap['canAssignAlarms'] == (role == 'admin')
              and cap['canRunDemoScenarios'] == (role == 'admin'))
    viewer = users['viewer']['token']
    admin = users['admin']['token']
    overview = api('campus/overview', viewer)
    counts = overview['completeness']
    check('public AIRIOT simulation readings', overview['simulated'] is True
          and [counts['actualSpaces'], counts['actualDevices'], counts['actualPoints']] == [4, 16, 28]
          and not overview['issues'], counts=counts,
          qualities=sorted({point['quality'] for point in overview['points']}))
    owners = api('campus/device-owners', viewer)
    check('public responsibility read', len(owners['items']) == 16
          and all(item['ownerUid'] and item['version'] >= 1 for item in owners['items']))
    cases = api('campus/alarm-cases?sourceType=DEMO&limit=50&skip=0', viewer)
    check('public persisted DEMO states', {'IN_PROGRESS', 'ASSIGNED', 'CLOSED'}
          <= {case['state'] for case in cases['items']}
          and all(case['sourceScope'] == 'LOCAL_DEMO' for case in cases['items']),
          total=cases['total'], states=sorted({case['state'] for case in cases['items']}))
    closed = next(case for case in cases['items'] if case['state'] == 'CLOSED')
    detail = api('campus/alarm-cases/' + closed['id'], viewer)
    actions = [entry['action'] for entry in detail['timeline']]
    check('public closed event timeline', detail['sourceState'] == 'RECOVERED'
          and detail['sourceCheckOutcome'] == 'PASS' and detail['disposition']
          and {'NOTE', 'DEMO_RECOVER', 'VERIFY_RECOVERY', 'CLOSE'} <= set(actions),
          actions=actions, version=detail['version'])
    integration = api('campus/integrations/airiot/status', admin)
    check('public machine read only', integration['connected'] is True
          and integration['isSuper'] is False and integration['controlEnabled'] is False)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', required=True, help='Explicit HTTPS deployment URL, ending in /campus-demo/')
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    target = urllib.parse.urlsplit(args.base_url)
    if (target.scheme != 'https' or not target.hostname or target.hostname.endswith('.invalid')
            or target.username or target.password or target.query or target.fragment):
        parser.error('Provide an explicit owned HTTPS base URL without credentials')
    BASE = args.base_url.rstrip('/') + '/'
    success = False
    try:
        main()
        success = True
    finally:
        cleanup = []
        for session in sessions:
            try:
                status, content_type, raw = request('api/auth/revoke', token=session['token'],
                    body={'refreshToken': session['refreshToken']})
                cleanup.append(status == 200 and content_type == 'application/json'
                               and json.loads(raw).get('code') == 0)
            except Exception:
                cleanup.append(False)
        report = {'checkedAt': int(time.time() * 1000), 'base': BASE, 'pass': success,
                  'checks': checks, 'syntheticLoginRevoked': cleanup,
                  'tls': 'Default certificate and hostname verification; no -k or host override',
                  'scope': 'Public HTTPS from this Mac network; no event seeding or device control',
                  'limits': 'Does not prove every school network or authenticated browser behavior.'}
        output = args.output
        output.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps({'pass': success, 'checks': len(checks), 'report': str(output)}, ensure_ascii=False))
