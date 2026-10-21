"""Read only the actual browser capture's public course case responses."""
import datetime
import json
from browser_ops import BASE

def latest_cases(browser, label):
    listing = json.loads(browser.cmd('debug', 'requests', '--url', '/api/cases', '--method', 'GET'))
    requests = [row for row in listing['requests']
                if row.get('method') == 'GET' and row.get('status') == 200
                and row.get('url') == 'http://127.0.0.1:5188/api/cases']
    if not requests:
        raise AssertionError('No captured successful independent GET /api/cases')
    request = requests[-1]
    response = json.loads(browser.cmd('debug', 'request', request['id'], '--part', 'response'))['request']
    body = response['response_body']
    assert body['state'] == 'available' and not response.get('truncated'), 'Case response is incomplete'
    payload = json.loads(body['text'])
    assert payload['code'] == 0 and isinstance(payload['data'], list)
    record = {'at': datetime.datetime.now().astimezone().isoformat(),
              'step': browser.step, 'label': label, 'request': request['id'], 'cases': payload['data']}
    with (BASE / 'environment/11-browser-case-states.jsonl').open('a') as output:
        output.write(json.dumps(record, ensure_ascii=False) + '\n')
    return payload['data']

def manual_case(rows):
    identity = json.loads((BASE / 'environment/11-event-identities.json').read_text())['manual']['id']
    return next(row for row in rows if row['id'] == identity)
