"""Explicit, non-secret configuration for optional remote deployment tools."""
import json
from pathlib import Path
import re
import urllib.parse

PROJECT_ID = '000000000000000000000001'
REMOTE_KEYS = ('expected_hostname', 'public_host', 'upload_user', 'mysql_image',
               'airiot_base_url', 'shared_compose_project', 'shared_entries')


def validate_remote_config(value):
    if not isinstance(value, dict):
        raise RuntimeError('Deployment configuration must be a JSON object')
    config = {key: value.get(key) for key in REMOTE_KEYS}
    for key in ('expected_hostname', 'upload_user'):
        candidate = config[key]
        if not isinstance(candidate, str) or not re.fullmatch(r'[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}', candidate):
            raise RuntimeError('Invalid deployment configuration field: ' + key)
        if candidate.startswith('REPLACE_') or candidate == 'demo-host':
            raise RuntimeError('Replace the example deployment configuration field: ' + key)
    host = config['public_host']
    if (not isinstance(host, str) or not re.fullmatch(r'[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?', host)
            or '.' not in host or host.endswith('.invalid') or '..' in host):
        raise RuntimeError('Set an explicitly owned HTTPS public_host; example hosts cannot be executed')
    if not isinstance(config['mysql_image'], str) or not re.fullmatch(r'(?:[A-Za-z0-9./_-]+@)?sha256:[0-9a-f]{64}', config['mysql_image']):
        raise RuntimeError('mysql_image must be an explicitly selected immutable image digest')
    if set(config['mysql_image'].rsplit(':', 1)[-1]) == {'0'}:
        raise RuntimeError('Replace the example mysql_image digest')
    url = urllib.parse.urlsplit(config['airiot_base_url'] or '')
    if (url.username or url.password or url.query or url.fragment or not url.hostname
            or url.hostname.endswith('.invalid') or url.scheme not in ('http', 'https')
            or (url.scheme == 'http' and url.hostname not in ('127.0.0.1', 'localhost', '::1'))):
        raise RuntimeError('airiot_base_url must be an explicit HTTPS gateway or loopback HTTP endpoint without credentials')
    config['airiot_base_url'] = config['airiot_base_url'].rstrip('/')
    shared = config['shared_compose_project'] or ''
    if not isinstance(shared, str) or (shared and not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9_.-]{0,63}', shared)):
        raise RuntimeError('Invalid shared_compose_project')
    config['shared_compose_project'] = shared
    entries = config['shared_entries'] or []
    if not isinstance(entries, list):
        raise RuntimeError('shared_entries must be an explicit list')
    for entry in entries:
        if not isinstance(entry, dict) or set(entry) != {'host', 'path', 'status'}:
            raise RuntimeError('Each shared entry requires host, path and status')
        if (not isinstance(entry['host'], str) or not re.fullmatch(r'[A-Za-z0-9.-]+', entry['host'])
                or entry['host'].endswith('.invalid') or not isinstance(entry['path'], str)
                or not entry['path'].startswith('/') or any(c in entry['path'] for c in '\r\n')
                or not re.fullmatch(r'[1-5][0-9]{2}', str(entry['status']))):
            raise RuntimeError('Invalid shared entry')
        entry['status'] = str(entry['status'])
    config['shared_entries'] = entries
    return config


def load_config(path):
    candidate = Path(path).expanduser().resolve()
    data = json.loads(candidate.read_text())
    remote = validate_remote_config(data)
    host = data.get('ssh_host')
    if not isinstance(host, str) or not re.fullmatch(r'[A-Za-z0-9_][A-Za-z0-9_.-]{0,127}', host) or host.startswith('REPLACE_'):
        raise RuntimeError('Set an explicit SSH host alias in ssh_host')
    ssh_config = Path(data.get('ssh_config', '')).expanduser()
    if not ssh_config.is_file():
        raise RuntimeError('ssh_config must reference an existing user-managed SSH configuration')
    return {**remote, 'ssh_host': host, 'ssh_config': str(ssh_config.resolve())}
