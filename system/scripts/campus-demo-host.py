#!/usr/bin/env python3
"""Explicitly configured dedicated demo host operations. Input/output never contain plaintext secrets.

Run through campus-demo-deploy.py. This file is also retained on the host for
backup and isolated restore verification. It never changes AIRIOT containers.
"""
import argparse
import datetime as dt
import gzip
import hashlib
import json
import os
from pathlib import Path
import pwd
import re
import shutil
import socket
import subprocess
import sys
import tarfile
import time
import urllib.request
import urllib.parse
import uuid
import zipfile

ROOT = Path('/srv/campus-demo')
CRED = Path('/etc/credstore.encrypted/campus-demo')
VHOST = None
CONFIG = None
PUBLIC_HOST = None
PUBLIC_BASE = None
ROUTES = Path('/etc/nginx/snippets/campus-demo-routes.conf')
UNIT = 'campus-demo.service'
MYSQL = 'campus-demo-mysql.service'
REDIS = 'campus-demo-redis.service'
MYSQL_IMAGE = None
DB = 'smart_campus_demo'
APP_CREDS = ['spring.datasource.password', 'spring.data.redis.password', 'jwt.secret',
             'campus.airiot.app-key', 'campus.airiot.app-secret']


def configure(value):
    global CONFIG, PUBLIC_HOST, PUBLIC_BASE, VHOST, MYSQL_IMAGE
    sys.path.insert(0, str(Path(__file__).resolve().parent))
    from deployment_config import validate_remote_config
    CONFIG = validate_remote_config(value)
    PUBLIC_HOST = CONFIG['public_host']
    PUBLIC_BASE = 'https://' + PUBLIC_HOST
    VHOST = Path('/etc/nginx/vhosts') / (PUBLIC_HOST + '.conf')
    MYSQL_IMAGE = CONFIG['mysql_image']


def command(args, input=None, check=True):
    p = subprocess.run(args, input=input, capture_output=True)
    if check and p.returncode:
        scope = ''
        if args[0] == 'curl':
            url = urllib.parse.urlsplit(args[-1])
            scope = ' [' + (url.hostname or '') + url.path + ']'
        raise RuntimeError('Operation failed: ' + args[0] + scope + ' (exit ' + str(p.returncode) + ')')
    return p


def text(args):
    return command(args).stdout.decode().strip()


def atomic(path, content, mode=0o644):
    path = Path(path)
    temporary = path.with_name(path.name + '.' + uuid.uuid4().hex + '.new')
    temporary.write_bytes(content.encode() if isinstance(content, str) else content)
    temporary.chmod(mode)
    os.replace(temporary, path)


def digest(path):
    h = hashlib.sha256()
    with Path(path).open('rb') as f:
        for block in iter(lambda: f.read(1024 * 1024), b''):
            h.update(block)
    return h.hexdigest()


def clock():
    return dt.datetime.now(dt.timezone(dt.timedelta(hours=8))).isoformat()


def required_names():
    return APP_CREDS + ['mysql.root.password', 'mysql-admin.cnf', 'redis.conf']


def health(timeout=1):
    try:
        with urllib.request.urlopen('http://127.0.0.1:18091/actuator/health', timeout=timeout) as r:
            return r.status == 200 and json.load(r).get('status') == 'UP'
    except Exception:
        return False


def free_ports():
    for port in [18091, 13391, 16391]:
        s = socket.socket()
        try:
            s.bind(('127.0.0.1', port))
        except OSError:
            raise RuntimeError('Dedicated port already occupied: ' + str(port)) from None
        finally:
            s.close()


def shared_state():
    if CONFIG is None:
        raise RuntimeError('Deployment target is not configured')
    if not CONFIG['shared_compose_project']:
        return []
    ids = text(['docker', 'ps', '-q', '--filter', 'label=com.docker.compose.project=' + CONFIG['shared_compose_project']]).split()
    result = []
    if ids:
        for item in json.loads(command(['docker', 'inspect', *ids]).stdout):
            result.append({'name': item['Name'].lstrip('/'), 'id': item['Id'], 'imageId': item['Image'],
                           'startedAt': item['State']['StartedAt'], 'status': item['State']['Status'],
                           'restartCount': item['RestartCount']})
    return sorted(result, key=lambda x: x['name'])


def encrypt(name, value):
    destination = CRED / (name + '.cred')
    temporary = destination.with_suffix('.cred.new')
    command(['systemd-creds', 'encrypt', '--with-key=host', '--name=' + name, '-', str(temporary)], value.encode())
    temporary.chmod(0o600)
    command(['systemd-creds', 'decrypt', '--name=' + name, str(temporary), '/dev/null'])
    os.replace(temporary, destination)


def units():
    mysql = f'''[Unit]
Description=Smart Campus demo dedicated MySQL 8.4
Requires=docker.service
After=docker.service network.target

[Service]
Type=simple
LoadCredentialEncrypted=mysql.root.password:{CRED}/mysql.root.password.cred
LoadCredentialEncrypted=spring.datasource.password:{CRED}/spring.datasource.password.cred
ExecStart=/usr/bin/docker run --rm --name campus-demo-mysql --label managed-by=campus-demo --network host --volume {ROOT}/shared/mysql:/var/lib/mysql --volume /run/credentials/campus-demo-mysql.service:/run/campus-demo-credentials:ro --env MYSQL_DATABASE={DB} --env MYSQL_USER=campus_demo --env MYSQL_ROOT_PASSWORD_FILE=/run/campus-demo-credentials/mysql.root.password --env MYSQL_PASSWORD_FILE=/run/campus-demo-credentials/spring.datasource.password {MYSQL_IMAGE} --bind-address=127.0.0.1 --port=13391 --mysqlx=OFF
ExecStop=/usr/bin/docker stop --time 30 campus-demo-mysql
Restart=on-failure
RestartSec=5
TimeoutStopSec=60

[Install]
WantedBy=multi-user.target
'''
    redis = f'''[Unit]
Description=Smart Campus demo dedicated Redis
After=network.target

[Service]
Type=simple
User=campus-demo
Group=campus-demo
LoadCredentialEncrypted=redis.conf:{CRED}/redis.conf.cred
ExecStart=/usr/bin/redis-server /run/credentials/campus-demo-redis.service/redis.conf
Restart=on-failure
RestartSec=5
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths={ROOT}/shared/redis
MemoryMax=256M

[Install]
WantedBy=multi-user.target
'''
    app = f'''[Unit]
Description=Smart Campus school showcase demo backend
Requires={MYSQL} {REDIS}
After={MYSQL} {REDIS} network-online.target

[Service]
Type=simple
User=campus-demo
Group=campus-demo
WorkingDirectory={ROOT}/shared
Environment=SPRING_CONFIG_IMPORT=configtree:/run/credentials/{UNIT}/
Environment=SPRING_CONFIG_ADDITIONAL_LOCATION=file:{ROOT}/shared/application.properties
'''
    app += ''.join(f'LoadCredentialEncrypted={name}:{CRED}/{name}.cred\n' for name in APP_CREDS)
    app += f'''ExecStart=/usr/bin/java -Xms128m -Xmx768m -jar {ROOT}/current/backend.jar
Restart=on-failure
RestartSec=5
TimeoutStartSec=120
TimeoutStopSec=45
SuccessExitStatus=143
UMask=0027
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths={ROOT}/shared/log
MemoryMax=1200M

[Install]
WantedBy=multi-user.target
'''
    return {MYSQL: mysql, REDIS: redis, UNIT: app}


def prepare():
    payload = json.load(sys.stdin)
    prepared = (ROOT / 'shared/prepared.json').exists()
    if not prepared:
        free_ports()
        if command(['docker', 'inspect', 'campus-demo-mysql'], check=False).returncode == 0:
            raise RuntimeError('Container namespace already exists')
        command(['docker', 'image', 'inspect', MYSQL_IMAGE])
        if CRED.exists() and any(CRED.iterdir()):
            raise RuntimeError('Credential store exists without completed preparation; inspect before retry')
        try:
            pwd.getpwnam('campus-demo')
            raise RuntimeError('Service user exists without completed preparation')
        except KeyError:
            command(['useradd', '--system', '--home-dir', str(ROOT), '--shell', '/usr/sbin/nologin', 'campus-demo'])
        for name, mode in [('', 0o755), ('releases', 0o755), ('staging', 0o750), ('shared', 0o750),
                           ('shared/mysql', 0o700), ('shared/redis', 0o700), ('shared/log', 0o750), ('backups', 0o700), ('bin', 0o755)]:
            p = ROOT / name
            p.mkdir(parents=True, exist_ok=True)
            p.chmod(mode)
        command(['chown', 'root:campus-demo', str(ROOT / 'shared')])
        command(['chown', 'campus-demo:campus-demo', str(ROOT / 'shared/redis'), str(ROOT / 'shared/log')])
        CRED.mkdir(parents=True, exist_ok=True)
        CRED.chmod(0o700)
        if set(payload) != set(required_names()):
            raise RuntimeError('Invalid enrollment names')
        for name in required_names():
            encrypt(name, payload[name])
        atomic(ROOT / 'shared/prepared.json', json.dumps({'preparedAt': clock(), 'binding': 'host',
               'tpm2': 'partial; firmware/driver/libraries absent', 'sharedBaseline': shared_state()}, indent=2), 0o600)
    for name in required_names():
        if not (CRED / (name + '.cred')).exists():
            raise RuntimeError('Required credential missing: ' + name)
    command(['chown', 'root:' + CONFIG['upload_user'], str(ROOT / 'staging')])
    ordinary = f'''# Ordinary settings only. Secrets come from systemd configtree.
spring.profiles.active=local
spring.config.import=configtree:/run/credentials/campus-demo.service/
server.address=127.0.0.1
server.port=18091
spring.datasource.url=jdbc:mysql://127.0.0.1:13391/{DB}?useUnicode=true&characterEncoding=UTF-8&useSSL=false&allowPublicKeyRetrieval=true&serverTimezone=UTC&socketTimeout=30000
spring.datasource.username=campus_demo
spring.datasource.hikari.pool-name=campus-demo
spring.datasource.hikari.minimum-idle=1
spring.datasource.hikari.maximum-pool-size=6
spring.data.redis.host=127.0.0.1
spring.data.redis.port=16391
spring.data.redis.database=0
template.app-name=campus-demo
jwt.issuer=campus-demo
campus.demo.enabled=true
campus.airiot.base-url={CONFIG['airiot_base_url']}
campus.airiot.project-id=000000000000000000000001
campus.airiot.control-enabled=false
spring.ai.model.chat=none
spring.ai.openai.api-key=
aliyun.access-key-id=
aliyun.access-key-secret=
aliyun.sms-template-code=
aliyun.captcha-scene-id=
behavior.log.producer-enabled=false
behavior.log.consumer-enabled=false
behavior.log.direct-fallback-enabled=true
spring.kafka.bootstrap-servers=127.0.0.1:19092
whitelist.strict-mode=true
whitelist.allow-business-apis=false
logging.level.org.springframework.web.client=OFF
logging.level.org.apache.http=OFF
logging.level.jdk.internal.net.http=OFF
'''
    atomic(ROOT / 'shared/application.properties', ordinary, 0o640)
    command(['chown', 'root:campus-demo', str(ROOT / 'shared/application.properties')])
    for name, body in units().items():
        atomic(Path('/etc/systemd/system') / name, body)
    command(['systemd-analyze', 'verify', *[str(Path('/etc/systemd/system') / name) for name in units()]])
    command(['systemctl', 'daemon-reload'])
    shutil.copyfile(__file__, ROOT / 'bin/campus-demo-host.py')
    shutil.copyfile(Path(__file__).with_name('deployment_config.py'), ROOT / 'bin/deployment_config.py')
    atomic(ROOT / 'shared/deployment.json', json.dumps(CONFIG, indent=2), 0o640)
    (ROOT / 'bin/campus-demo-host.py').chmod(0o755)
    return {'state': 'prepared', 'activated': False, 'binding': 'host', 'credentialNames': required_names(),
            'ciphertext': {name: digest(CRED / (name + '.cred')) for name in required_names()},
            'units': list(units()), 'databaseStrategy': 'new dedicated schema; Flyway then authorized bootstrap/API seed'}


def verify_stage(release):
    stage = ROOT / 'staging' / release
    m = json.loads((stage / 'manifest.json').read_text())
    if m['release'] != release:
        raise RuntimeError('Release manifest mismatch')
    if m['backend']['file'] != 'backend.jar' or m['frontend']['file'] != 'frontend.tar.gz':
        raise RuntimeError('Artifact filename mismatch')
    for artifact in ['backend', 'frontend']:
        data = m[artifact]
        path = stage / data['file']
        if path.stat().st_size != data['bytes'] or digest(path) != data['sha256']:
            raise RuntimeError('Artifact checksum mismatch: ' + artifact)
    with zipfile.ZipFile(stage / m['backend']['file']) as z:
        if z.testzip():
            raise RuntimeError('Backend archive integrity failure')
    destination = ROOT / 'releases' / release
    if destination.exists():
        if (destination / 'manifest.json').read_bytes() != (stage / 'manifest.json').read_bytes():
            raise RuntimeError('Release directory already exists with different manifest')
        return {'state': 'uploaded to staging', 'release': release, 'verifiedRelease': str(destination), 'manifest': m}
    candidate = destination.with_name(release + '.new')
    candidate.mkdir(mode=0o755)
    shutil.copyfile(stage / m['backend']['file'], candidate / 'backend.jar')
    with tarfile.open(stage / m['frontend']['file']) as tar:
        if any(not member.name.startswith('mg/') or member.issym() or member.islnk() for member in tar.getmembers()):
            raise RuntimeError('Invalid frontend archive entries')
        tar.extractall(candidate, filter='data')
    for item in candidate.rglob('*'):
        item.chmod(0o755 if item.is_dir() else 0o644)
    for item in m['frontend']['files']:
        if Path(item['path']).is_absolute() or '..' in Path(item['path']).parts:
            raise RuntimeError('Invalid frontend manifest path')
        path = candidate / 'mg' / item['path']
        if path.stat().st_size != item['bytes'] or digest(path) != item['sha256']:
            raise RuntimeError('Frontend extracted checksum mismatch')
    shutil.copyfile(stage / 'manifest.json', candidate / 'manifest.json')
    os.replace(candidate, destination)
    return {'state': 'uploaded to staging', 'release': release, 'verifiedRelease': str(destination), 'manifest': m}


def credential_command(args, input=None):
    unit = 'campus-demo-maintenance-' + uuid.uuid4().hex[:12]
    credential = '/run/credentials/' + unit + '.service/mysql-admin.cnf'
    command_line = ['systemd-run', '--unit=' + unit, '--wait', '--pipe', '--collect', '--quiet',
        '-p', 'LoadCredentialEncrypted=mysql-admin.cnf:' + str(CRED / 'mysql-admin.cnf.cred'),
        args[0], '--defaults-extra-file=' + credential, *args[1:]]
    return command(command_line, input)


def db_scalar(query, database=DB):
    return credential_command(['/usr/bin/mysql', '--batch', '--skip-column-names', database, '--execute', query]).stdout.decode().strip()


def atomic_link(release):
    temporary = ROOT / ('.current-' + uuid.uuid4().hex)
    temporary.symlink_to(ROOT / 'releases' / release)
    os.replace(temporary, ROOT / 'current')


def start_backend(release):
    verify_stage(release)
    previous = str((ROOT / 'current').resolve()) if (ROOT / 'current').exists() else None
    existing_proxy = ROUTES.exists()
    public_before = None
    if existing_proxy:
        reply = command(['curl', '--silent', '--show-error', '--max-time', '15', '--resolve',
                         PUBLIC_HOST + ':443:127.0.0.1',
                         PUBLIC_BASE + '/campus-demo/api/actuator/health']).stdout
        public_before = json.loads(reply).get('status') == 'UP'
        if not public_before:
            raise RuntimeError('Existing demo proxy is not healthy before release switch')
    old = {'previous': previous, 'nginxSha256': digest(VHOST), 'sharedBaseline': shared_state(), 'startedAt': clock(),
           'previousBackendSha256': digest(ROOT / 'current/backend.jar') if previous else None,
           'previousBackendPID': text(['systemctl', 'show', UNIT, '--property=MainPID', '--value']),
           'publicProxyExisted': existing_proxy, 'publicHealthBefore': public_before}
    backup_dir = ROOT / 'backups' / release
    backup_dir.mkdir(mode=0o700, exist_ok=True)
    atomic(backup_dir / 'activation-before.json', json.dumps(old, indent=2), 0o600)
    command(['systemctl', 'start', MYSQL, REDIS])
    for _ in range(60):
        try:
            if db_scalar('SELECT 1') == '1':
                break
        except RuntimeError:
            time.sleep(2)
    else:
        raise RuntimeError('Dedicated database readiness timed out; proxy unchanged')
    atomic_link(release)
    public_after = None
    try:
        command(['systemctl', 'restart', UNIT])
        for _ in range(90):
            if health(2):
                break
            time.sleep(2)
        else:
            raise RuntimeError('Backend health timed out')
        if existing_proxy:
            reply = command(['curl', '--silent', '--show-error', '--max-time', '15', '--resolve',
                             PUBLIC_HOST + ':443:127.0.0.1',
                             PUBLIC_BASE + '/campus-demo/api/actuator/health']).stdout
            public_after = json.loads(reply).get('status') == 'UP'
            if not public_after:
                raise RuntimeError('Existing proxy health did not recover after backend switch')
        command(['systemctl', 'enable', UNIT, MYSQL, REDIS])
    except Exception:
        command(['systemctl', 'stop', UNIT], check=False)
        if previous:
            atomic_link(Path(previous).name)
            command(['systemctl', 'start', UNIT])
            if not health(10):
                raise RuntimeError('Previous backend rollback did not recover health') from None
        elif (ROOT / 'current').is_symlink():
            (ROOT / 'current').unlink()
        raise RuntimeError('Backend activation failed; proxy unchanged and backend release rolled back') from None
    return {'state': 'activated behind existing proxy' if existing_proxy else 'activated privately',
            'release': release, 'publicProxyActivated': existing_proxy, 'publicHealthBefore': public_before,
            'publicHealthAfter': public_after, 'previousBackendPID': old['previousBackendPID'],
            'health': True, 'service': UNIT, 'pid': text(['systemctl', 'show', UNIT, '--property=MainPID', '--value']),
            'bootstrapRequiredBeforePublish': not existing_proxy, 'backup': str(backup_dir)}


def route_config():
    return '''# Dedicated school showcase. Shared AIRIOT root route is preserved.
location = /campus-demo { return 301 /campus-demo/; }
location = /campus-demo/api { return 308 /campus-demo/api/; }
location ^~ /campus-demo/api/ {
    include snippets/proxy-headers.conf;
    proxy_pass http://127.0.0.1:18091/;
    proxy_connect_timeout 5s;
    proxy_read_timeout 60s;
    proxy_send_timeout 60s;
    client_max_body_size 10m;
}
location = /campus-demo/index.html {
    alias /srv/campus-demo/current/mg/index.html;
    include snippets/security-headers.conf;
    add_header Cache-Control "no-cache";
}
location ^~ /campus-demo/ {
    alias /srv/campus-demo/current/mg/;
    try_files $uri $uri/ /campus-demo/index.html;
    include snippets/security-headers.conf;
    add_header Cache-Control "no-cache";
}
'''


def publish(release):
    if not health(5) or (ROOT / 'current').resolve().name != release:
        raise RuntimeError('Release is not the healthy active backend')
    user_count = int(db_scalar('SELECT COUNT(*) FROM user_info'))
    if user_count < 3:
        raise RuntimeError('Three demo accounts must be seeded before public activation')
    for path in (ROOT / 'current/mg').rglob('*'):
        if path.is_file():
            command(['runuser', '-u', 'www-data', '--', 'test', '-r', str(path)])
    backup_dir = ROOT / 'backups' / release
    before_vhost = VHOST.read_bytes()
    before_routes = ROUTES.read_bytes() if ROUTES.exists() else None
    atomic(backup_dir / 'nginx-vhost.before', before_vhost, 0o600)
    if before_routes is not None:
        atomic(backup_dir / 'nginx-routes.before', before_routes, 0o600)
    marker = '    include /etc/nginx/snippets/campus-demo-routes.conf;\n'
    body = before_vhost.decode()
    if marker not in body:
        token = '    location / {\n'
        if body.count(token) != 1 or body.count('server_name ' + PUBLIC_HOST + ';') != 2:
            raise RuntimeError('Shared vhost shape changed; manual merge required')
        body = body.replace(token, marker + '\n' + token, 1)
    phase = 'write dedicated proxy routes'
    configuration_changed = before_vhost != body.encode() or before_routes != route_config().encode()
    try:
        if configuration_changed:
            atomic(ROUTES, route_config())
            atomic(VHOST, body)
        phase = 'nginx configuration validation'
        command(['nginx', '-t'])
        phase = 'nginx reload' if configuration_changed else 'reuse byte-identical existing demo proxy'
        if configuration_changed:
            command(['systemctl', 'reload', 'nginx'])
        phase = 'wait for reloaded proxy document and health'
        # reload returns before the replacement workers are necessarily ready.
        # Require the active document AND JSON health instead of accepting old SPA200.
        for _ in range(20):
            document = command(['curl', '--silent', '--show-error', '--max-time', '5', '--resolve',
                                PUBLIC_HOST + ':443:127.0.0.1',
                                PUBLIC_BASE + '/campus-demo/campus/overview'], check=False)
            reply = command(['curl', '--silent', '--show-error', '--max-time', '5', '--resolve',
                             PUBLIC_HOST + ':443:127.0.0.1',
                             PUBLIC_BASE + '/campus-demo/api/actuator/health'], check=False)
            try:
                ready = (document.returncode == 0 and reply.returncode == 0 and
                         hashlib.sha256(document.stdout).hexdigest() == digest(ROOT / 'current/mg/index.html') and
                         json.loads(reply.stdout).get('status') == 'UP')
            except (ValueError, AttributeError):
                ready = False
            if ready:
                break
            time.sleep(0.5)
        else:
            raise RuntimeError('Reloaded demo document and JSON health never became ready')
        phase = 'proxy route HTTP and TLS checks'
        for path in ['/campus-demo/', '/campus-demo/campus/overview', '/campus-demo/api/actuator/health']:
            status = text(['curl', '--silent', '--show-error', '--max-time', '15', '--resolve',
                          PUBLIC_HOST + ':443:127.0.0.1', '--output', '/dev/null', '--write-out',
                          '%{http_code} %{ssl_verify_result}', PUBLIC_BASE + '' + path])
            if status != '200 0':
                raise RuntimeError('Proxy health failed: ' + path)
        public_body = command(['curl', '--silent', '--show-error', '--max-time', '15', '--resolve',
                               PUBLIC_HOST + ':443:127.0.0.1',
                               PUBLIC_BASE + '/campus-demo/campus/overview']).stdout
        if hashlib.sha256(public_body).hexdigest() != digest(ROOT / 'current/mg/index.html'):
            raise RuntimeError('Nested frontend route does not serve active demo document')
        public_health = command(['curl', '--silent', '--show-error', '--max-time', '15', '--resolve',
                                 PUBLIC_HOST + ':443:127.0.0.1',
                                 PUBLIC_BASE + '/campus-demo/api/actuator/health']).stdout
        if json.loads(public_health).get('status') != 'UP':
            raise RuntimeError('Proxy health response is not UP')
        phase = 'shared core domain checks'
        shared_entries = []
        for entry in CONFIG['shared_entries']:
            domain, expected, path = entry['host'], entry['status'], entry['path']
            phase = 'shared core domain check: ' + domain
            observed = text(['curl', '--silent', '--show-error', '--max-time', '10', '--resolve',
                             domain + ':443:127.0.0.1', '--output', '/dev/null', '--write-out',
                             '%{http_code} %{ssl_verify_result}', 'https://' + domain + path])
            shared_entries.append({'domain': domain, 'path': path, 'httpTLS': observed})
            if observed != expected + ' 0':
                raise RuntimeError('Shared entry deviates from preflight: ' + domain)
        baseline = json.loads((backup_dir / 'activation-before.json').read_text())['sharedBaseline']
        phase = 'shared AIRIOT identity comparison'
        after = shared_state()
        # New autonomous restarts are evidence, never attributed to this rollout automatically.
        fixed = lambda xs: [(x['name'], x['id'], x['imageId']) for x in xs]
        if fixed(after) != fixed(baseline):
            raise RuntimeError('Shared AIRIOT container identity/image changed')
        report = {'state': 'activated', 'release': release, 'publicURL': PUBLIC_BASE + '/campus-demo/',
                  'accountCount': user_count, 'health': True, 'staticReadableBy': 'www-data',
                  'sharedIdentitiesAndImagesUnchanged': True, 'sharedBefore': baseline, 'sharedAfter': after,
                  'sharedEntries': shared_entries, 'publicDocumentMatchesActiveRelease': True,
                  'proxyConfigurationChanged': configuration_changed, 'nginxReloadPerformed': configuration_changed,
                  'proxyBackup': str(backup_dir / 'nginx-vhost.before'), 'nginxSha256': digest(VHOST), 'checkedAt': clock()}
        atomic(backup_dir / 'publication.json', json.dumps(report, indent=2), 0o600)
        return report
    except Exception as error:
        if configuration_changed:
            atomic(VHOST, before_vhost)
            if before_routes is None:
                ROUTES.unlink(missing_ok=True)
            else:
                atomic(ROUTES, before_routes)
            command(['nginx', '-t'])
            command(['systemctl', 'reload', 'nginx'])
        failure = {'state': 'publication rolled back', 'phase': phase, 'failedAt': clock(),
                   'reason': str(error) if isinstance(error, RuntimeError) else type(error).__name__,
                   'previousVhostSha256': hashlib.sha256(before_vhost).hexdigest(),
                   'restoredVhostSha256': digest(VHOST), 'nginxActive': text(['systemctl', 'is-active', 'nginx'])}
        failure['proxyConfigurationChanged'] = configuration_changed
        failure['rollbackRequiredAndPerformed'] = configuration_changed
        atomic(backup_dir / ('publication-failure-' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.json'),
               json.dumps(failure, indent=2), 0o600)
        raise RuntimeError('Publication failed at ' + phase + ': ' + failure['reason'] + '; previous shared vhost and routes preserved') from None


def backup():
    name = 'database-' + dt.datetime.now(dt.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '-' + uuid.uuid4().hex[:6]
    directory = ROOT / 'backups' / name
    directory.mkdir(mode=0o700)
    dump = credential_command(['/usr/bin/mysqldump', '--single-transaction', '--routines', '--events',
                               '--triggers', '--set-gtid-purged=OFF', '--no-tablespaces', '--skip-extended-insert', DB]).stdout
    path = directory / 'smart_campus_demo.sql.gz'
    atomic(path, gzip.compress(dump), 0o600)
    table_names = [x.decode() for x in re.findall(rb'(?m)^CREATE TABLE `([A-Za-z0-9_]+)`', dump)]
    snapshot_rows = {name: len(re.findall(rb'(?m)^INSERT INTO `' + name.encode() + rb'` ', dump)) for name in table_names}
    result = {'state': 'backed up', 'createdAt': clock(), 'database': DB, 'backup': str(path),
              'bytes': path.stat().st_size, 'sha256': digest(path), 'liveRelease': str((ROOT / 'current').resolve()),
              'tableCounts': len(table_names), 'snapshotTableNames': sorted(table_names), 'snapshotRows': snapshot_rows}
    atomic(directory / 'manifest.json', json.dumps(result, indent=2), 0o600)
    return result


def restore_check(path):
    path = Path(path).resolve()
    if ROOT / 'backups' not in path.parents or path.name != 'smart_campus_demo.sql.gz':
        raise RuntimeError('Restore source must be a dedicated backup')
    manifest = json.loads((path.parent / 'manifest.json').read_text())
    if digest(path) != manifest['sha256']:
        raise RuntimeError('Backup integrity mismatch')
    database = 'campus_demo_restore_' + uuid.uuid4().hex[:12]
    credential_command(['/usr/bin/mysql', '--execute', 'CREATE DATABASE `' + database + '` CHARACTER SET utf8mb4'])
    try:
        credential_command(['/usr/bin/mysql', database], gzip.decompress(path.read_bytes()))
        count = db_scalar('SELECT COUNT(*) FROM information_schema.tables WHERE table_schema=DATABASE()', database)
        source_names = db_scalar('SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() ORDER BY table_name')
        restored_names = db_scalar('SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() ORDER BY table_name', database)
        expected_names = manifest.get('snapshotTableNames', source_names.splitlines())
        if count != str(manifest['tableCounts']) or expected_names != restored_names.splitlines():
            raise RuntimeError('Restored table/schema count mismatch')
        rows = []
        for table in source_names.splitlines():
            if not re.fullmatch(r'[A-Za-z0-9_]+', table):
                raise RuntimeError('Unexpected table identifier')
            a = db_scalar('SELECT COUNT(*) FROM `' + table + '`')
            b = db_scalar('SELECT COUNT(*) FROM `' + table + '`', database)
            expected = manifest.get('snapshotRows', {}).get(table)
            if expected is not None and expected != int(b):
                raise RuntimeError('Restored snapshot row count mismatch: ' + table)
            rows.append({'table': table, 'liveRows': int(a), 'snapshotRows': expected, 'restoredRows': int(b),
                         'snapshotEqual': expected == int(b) if expected is not None else None, 'liveEqual': a == b})
        # Polling audit/log activity may grow after the snapshot. Report rows instead of false equality claims.
        result = {'state': 'restore verified', 'checkedAt': clock(), 'source': str(path), 'temporaryDatabase': database,
                  'tableCount': int(count), 'tableNamesEqual': True, 'rows': rows, 'liveDatabaseRestored': False,
                  'snapshotRowCountsVerified': all(x['snapshotEqual'] is True for x in rows),
                  'temporaryDatabaseRemoved': True}
        atomic(path.parent / 'restore-verification.json', json.dumps(result, indent=2), 0o600)
        return result
    finally:
        credential_command(['/usr/bin/mysql', '--execute', 'DROP DATABASE `' + database + '`'])


def rollback(release):
    directory = ROOT / 'backups' / release
    info = json.loads((directory / 'activation-before.json').read_text())
    if (directory / 'nginx-vhost.before').exists():
        atomic(VHOST, (directory / 'nginx-vhost.before').read_bytes())
        if (directory / 'nginx-routes.before').exists():
            atomic(ROUTES, (directory / 'nginx-routes.before').read_bytes())
        else:
            ROUTES.unlink(missing_ok=True)
        command(['nginx', '-t'])
        command(['systemctl', 'reload', 'nginx'])
    command(['systemctl', 'stop', UNIT])
    if info['previous']:
        atomic_link(Path(info['previous']).name)
        command(['systemctl', 'start', UNIT])
        for _ in range(45):
            if health(2):
                break
            time.sleep(2)
        else:
            raise RuntimeError('Rollback backend health failed')
    else:
        (ROOT / 'current').unlink(missing_ok=True)
        command(['systemctl', 'disable', UNIT])
    return {'state': 'rolled back', 'release': release, 'previousRelease': info['previous'],
            'databaseRetained': True, 'databaseRestored': False, 'sharedNginxActive': text(['systemctl', 'is-active', 'nginx'])}


def verify():
    services = {}
    for name in [MYSQL, REDIS, UNIT]:
        services[name] = {key: text(['systemctl', 'show', name, '--property=' + key, '--value'])
                          for key in ['ActiveState', 'SubState', 'MainPID', 'UnitFileState', 'ActiveEnterTimestamp']}
    main_pid = int(services[UNIT]['MainPID'])
    if main_pid <= 0:
        raise RuntimeError('Expected demo backend is not running')
    secret_values = []
    for name in APP_CREDS + ['mysql.root.password']:
        secret_values.append(command(['systemd-creds', 'decrypt', '--name=' + name,
                                      str(CRED / (name + '.cred')), '-']).stdout)
    ordinary = (ROOT / 'shared/application.properties').read_bytes()
    unit_bytes = b''.join((Path('/etc/systemd/system') / name).read_bytes() for name in units())
    cmdline = Path('/proc/' + str(main_pid) + '/cmdline').read_bytes()
    environment = Path('/proc/' + str(main_pid) + '/environ').read_bytes()
    journals = command(['journalctl', '--unit=' + UNIT, '--no-pager', '--output=cat', '-n', '500']).stdout
    leaks = {name: any(value and value in content for value in secret_values) for name, content in
             [('ordinaryProperties', ordinary), ('units', unit_bytes), ('commandLine', cmdline),
              ('processEnvironment', environment), ('backendJournal', journals)]}
    if any(leaks.values()):
        raise RuntimeError('Credential literal exposure detected; inspect privately')
    credentials = {}
    for name in APP_CREDS:
        path = Path('/run/credentials/' + UNIT) / name
        credentials[name] = {'exists': path.exists(), 'mode': oct(path.stat().st_mode & 0o777) if path.exists() else None}
    listeners = command(['ss', '-lntpH']).stdout.decode().splitlines()
    listener_rows = []
    for row in listeners:
        fields = row.split()
        if any(fields[3].endswith(':' + str(port)) for port in [18091, 13391, 16391]):
            listener_rows.append({'local': fields[3], 'backendPIDPresent': ('pid=' + str(main_pid) + ',') in row})
    fatal_pattern = re.compile(rb'(?m)^.*(?:\bERROR\b|\bFATAL\b|Communications link failure|Access denied|Could not load credentials).*$')
    error_lines = fatal_pattern.findall(journals)
    result = {'state': 'technical verification completed', 'checkedAt': clock(), 'health': health(5),
              'services': services, 'listeners': listener_rows, 'credentialFiles': credentials,
              'credentialLiteralsDetected': leaks, 'startupErrorLineCount': len(error_lines),
              'startupWarningLineCount': len(re.findall(rb'(?m)^.*\bWARN\b.*$', journals)),
              'liveBackend': str((ROOT / 'current/backend.jar').resolve()),
              'liveBackendSha256': digest(ROOT / 'current/backend.jar'),
              'nginxCheck': command(['nginx', '-t'], check=False).returncode,
              'nginxActive': text(['systemctl', 'is-active', 'nginx'])}
    if not result['health'] or any(x['ActiveState'] != 'active' or x['UnitFileState'] != 'enabled' for x in services.values()):
        raise RuntimeError('Dedicated services health/enablement check failed')
    if not all(item['exists'] for item in credentials.values()) or len(listener_rows) != 3:
        raise RuntimeError('Credential/listener validation failed')
    return result


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('operation', choices=['prepare', 'verify-stage', 'start-backend', 'publish', 'backup', 'restore-check', 'rollback', 'verify'])
    parser.add_argument('--config-json', required=True, help='Non-secret explicit target configuration supplied by the deploy client')
    parser.add_argument('--release')
    parser.add_argument('--backup')
    args = parser.parse_args()
    configure(json.loads(args.config_json))
    if os.geteuid() != 0 or socket.gethostname() != CONFIG['expected_hostname']:
        raise RuntimeError('Host/root contract mismatch')
    if args.release and not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_-]{0,79}', args.release):
        raise RuntimeError('Invalid release identifier')
    retained = ROOT / 'bin/campus-demo-host.py'
    if retained.parent.exists() and Path(__file__).resolve() != retained.resolve():
        shutil.copyfile(__file__, retained)
        retained.chmod(0o755)
        shutil.copyfile(Path(__file__).with_name('deployment_config.py'), retained.with_name('deployment_config.py'))
    functions = {'prepare': lambda: prepare(), 'verify-stage': lambda: verify_stage(args.release),
                 'start-backend': lambda: start_backend(args.release), 'publish': lambda: publish(args.release),
                 'backup': lambda: backup(), 'restore-check': lambda: restore_check(args.backup),
                 'rollback': lambda: rollback(args.release), 'verify': lambda: verify()}
    print(json.dumps(functions[args.operation](), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        print(json.dumps({'state': 'failed', 'error': str(error) if isinstance(error, RuntimeError) else type(error).__name__}), file=sys.stderr)
        sys.exit(1)
