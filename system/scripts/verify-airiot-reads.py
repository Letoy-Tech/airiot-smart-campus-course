#!/usr/bin/env python3
"""Run the actual Java AiriotClient and only fixed read-only negative HTTP probes.

No credentials, tokens, raw user responses, exception texts or credential URLs
are printed or saved. Uses the two user-authorized private properties files.
"""
import argparse
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
import zipfile

ROOT = Path(__file__).resolve().parents[1]
PROJECT = '000000000000000000000001'
BASE = None
OUTPUT = None

class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        return None

def secret_properties(path):
    if path.stat().st_mode & 0o077:
        raise ValueError('PRIVATE_PERMISSIONS')
    properties = {}
    for line in path.read_text().splitlines():
        line = line.strip()
        if line and not line.startswith(('#', '!')) and '=' in line:
            key, value = line.split('=', 1)
            properties[key.strip()] = value.strip()
    key = properties.get('campus.airiot.app-key', properties.get('app-key'))
    secret = properties.get('campus.airiot.app-secret', properties.get('app-secret'))
    if not key or not secret:
        raise ValueError('PRIVATE_CONFIG_INCOMPLETE')
    return key, secret

def negative_reads(path, schema_read_allowed=False):
    key, secret = secret_properties(path)
    opener = urllib.request.build_opener(NoRedirect())
    headers = {'Accept': 'application/json', 'x-request-project': PROJECT}
    try:
        request = urllib.request.Request(BASE + '/core/auth/token?' + urllib.parse.urlencode({'appkey': key, 'appsecret': secret}), headers=headers)
        with opener.open(request, timeout=12) as response:
            raw = json.loads(response.read(4 * 1024 * 1024))
        token = raw.get('token')
        if not isinstance(token, str) or not token or '\n' in token or '\r' in token:
            return {'status': 'FAIL', 'code': 'TOKEN_PROTOCOL'}
    except urllib.error.HTTPError as error:
        return {'status': 'FAIL', 'httpStatus': error.code}
    except Exception:
        return {'status': 'FAIL', 'code': 'SAFE_TOKEN_ERROR'}
    headers['Authorization'] = token
    output = {}
    for name, endpoint in [('schemaRead', '/core/t/schema'), ('roleRead', '/core/role')]:
        expected_allowed = name == 'schemaRead' and schema_read_allowed
        try:
            with opener.open(urllib.request.Request(BASE + endpoint, headers=headers), timeout=12) as response:
                output[name] = {'status': 'PASS' if expected_allowed and response.status == 200 else 'FAIL', 'httpStatus': response.status, 'expected': 'read allowed' if expected_allowed else 'read denied', 'denied': False}
        except urllib.error.HTTPError as error:
            output[name] = {'status': 'PASS' if not expected_allowed and error.code in (401, 403) else 'PARTIAL', 'httpStatus': error.code, 'expected': 'read allowed' if expected_allowed else 'read denied', 'denied': error.code in (401, 403)}
        except Exception:
            output[name] = {'status': 'FAIL', 'code': 'SAFE_NETWORK_ERROR'}
    return output

def main():
    backend = ROOT / 'Letoy WAGF BE'
    jar = backend / 'target/letoy-wagf-be-0.0.1.jar'
    client_class = backend / 'target/classes/com/letoy/main/campus/airiot/AiriotClient.class'
    libs = ROOT / '.runtime/airiot-read-verification-libs'
    libs.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(jar) as archive:
        for entry in archive.infolist():
            if entry.filename.startswith('BOOT-INF/lib/') and entry.filename.endswith('.jar'):
                target = libs / Path(entry.filename).name
                if not target.exists() or target.stat().st_size != entry.file_size:
                    target.write_bytes(archive.read(entry))
    classpath = str(backend / 'target/classes') + ':' + ':'.join(str(path) for path in sorted(libs.glob('*.jar')))
    report = {'projectId': PROJECT, 'method': 'actual compiled AiriotClient Java source runner; fixed negative HTTP reads', 'startedAt': int(time.time() * 1000), 'clientClassSha256': hashlib.sha256(client_class.read_bytes()).hexdigest(), 'writesPerformed': False, 'crossProjectRequests': False}
    for name, filename, mode in [('dedicated', 'airiot.properties', 'full'), ('legacyReadOnly', 'airiot-readonly.properties', 'representative')]:
        path = ROOT / '.private' / filename
        secret_properties(path)
        result = subprocess.run(['java', '--class-path', classpath, str(ROOT / 'scripts/VerifyAiriotReads.java'), str(path), mode, BASE], capture_output=True, text=True, timeout=240)
        if result.returncode:
            report[name] = {'status': 'FAIL', 'code': 'JAVA_RUNNER_EXIT', 'exitCode': result.returncode}
        else:
            try:
                report[name] = json.loads(result.stdout)
            except Exception:
                report[name] = {'status': 'FAIL', 'code': 'JAVA_REPORT_PROTOCOL'}
        report[name]['negativeReads'] = negative_reads(path, schema_read_allowed=name == 'dedicated')
        print(json.dumps({'identity': name, 'authentication': report[name].get('authentication'), 'completed': True}, ensure_ascii=False), flush=True)
    report['finishedAt'] = int(time.time() * 1000)
    report['permissionBoundaries'] = {'dedicatedSchemaRead': 'Allowed table.view read-only per confirmed role scope; no schema write tested', 'roleRead': 'Expected denied for both identities', 'legacyReadOnly': 'Lighting record denial does not prove lighting historical query denial; independently tested'}
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    OUTPUT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + '\n')
    print(json.dumps({'report': str(OUTPUT), 'writesPerformed': False, 'completed': True}, ensure_ascii=False))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base-url', required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    target = urllib.parse.urlsplit(args.base_url)
    if (not target.hostname or target.hostname.endswith('.invalid') or target.username or target.password
            or target.query or target.fragment or target.scheme not in ('https', 'http')
            or (target.scheme == 'http' and target.hostname not in ('127.0.0.1', 'localhost', '::1'))):
        parser.error('Provide an explicit HTTPS gateway or loopback HTTP endpoint without credentials')
    BASE = args.base_url.rstrip('/')
    OUTPUT = args.output.resolve()
    try:
        main()
    except Exception:
        print(json.dumps({'status': 'FAIL', 'code': 'SAFE_VERIFICATION_ERROR'}))
        sys.exit(1)
