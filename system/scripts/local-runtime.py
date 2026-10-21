#!/usr/bin/env python3
"""Own isolated MySQL/Redis/BE/MG processes; never touch other project services."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import signal
import socket
import subprocess
import time
import urllib.request

ROOT = Path(__file__).resolve().parents[1]
PRIVATE = ROOT / '.private'
RUNTIME = ROOT / '.runtime'
BE = ROOT / 'Letoy WAGF BE'
MG = ROOT / 'Letoy WAGF MG'
BIN = Path(os.environ.get('CAMPUS_DB_BIN', '/opt/homebrew/bin'))
SOCKET = Path('/tmp') / ('smart-campus-' + hashlib.sha256(str(ROOT).encode()).hexdigest()[:10] + '.sock')
PORTS = {'mysql': 13316, 'redis': 16379, 'be': 8001, 'mg': 5173}


def write_private(path, data):
    path.write_text(data)
    path.chmod(0o600)


def prepare():
    for p in [PRIVATE, RUNTIME, RUNTIME / 'mysql', RUNTIME / 'redis']:
        p.mkdir(parents=True, exist_ok=True)
        p.chmod(0o700)
    path = PRIVATE / 'runtime-secrets.json'
    if not path.exists():
        write_private(path, json.dumps({k: secrets.token_hex(40 if k == 'jwt' else 24)
                                       for k in ['root', 'db', 'redis', 'jwt']}, indent=2))
    values = json.loads(path.read_text())
    write_private(PRIVATE / 'mysql-client.cnf',
                  f'[client]\nuser=root\npassword={values["root"]}\nprotocol=SOCKET\nsocket={SOCKET}\n')
    write_private(PRIVATE / 'mysql.cnf',
                  f'[mysqld]\ndatadir={RUNTIME / "mysql"}\nsocket={SOCKET}\n'
                  f'pid-file={RUNTIME / "mysql-server.pid"}\nport=13316\nbind-address=127.0.0.1\n'
                  f'log-error={RUNTIME / "mysql-error.log"}\nmysqlx=0\nskip-name-resolve=1\n')
    write_private(PRIVATE / 'redis.conf',
                  f'bind 127.0.0.1\nport 16379\nprotected-mode yes\nrequirepass {values["redis"]}\n'
                  f'dir "{RUNTIME / "redis"}"\nappendonly yes\nappendfsync everysec\n'
                  f'logfile "{RUNTIME / "redis.log"}"\n')
    props = ('spring.datasource.password=' + values['db'] + '\n'
             'spring.data.redis.password=' + values['redis'] + '\n'
             'jwt.secret=' + values['jwt'] + '\n'
             'campus.demo.enabled=true\n')
    app_file = PRIVATE / 'airiot.properties'
    if app_file.exists():
        if app_file.stat().st_mode & 0o077:
            raise RuntimeError('AIRIOT配置权限必须为0600；先收紧权限再启动')
        allowed = {'campus.airiot.base-url', 'campus.airiot.project-id', 'campus.airiot.app-key', 'campus.airiot.app-secret', 'campus.airiot.control-enabled'}
        got = {}
        for line in app_file.read_text().splitlines():
            if line.strip() and not line.lstrip().startswith('#'):
                key, value = line.split('=', 1)
                if key.strip() not in allowed or '${' in value:
                    raise RuntimeError('AIRIOT配置只允许示例项目地址、项目ID、专用应用凭据和control-enabled')
                got[key.strip()] = value.strip()
        if bool(got.get('campus.airiot.app-key')) != bool(got.get('campus.airiot.app-secret')):
            raise RuntimeError('专用应用凭据未填完整')
        if got.get('campus.airiot.app-key') and got.get('campus.airiot.app-secret'):
            props += '\n'.join(k + '=' + v for k, v in got.items()) + '\n'
    write_private(PRIVATE / 'local.properties', props)
    return values


def owned_pid(name):
    p = RUNTIME / (name + '.pid')
    if not p.exists():
        return None
    try:
        pid = int(p.read_text())
        command = subprocess.run(['ps', '-p', str(pid), '-o', 'command='], capture_output=True, text=True).stdout
        marker = {'mysql': str(PRIVATE / 'mysql.cnf'), 'redis': '127.0.0.1:16379',
                  'be': str(BE / 'target'), 'mg': str(MG / 'node_modules')}[name]
        if marker not in command:
            return None
        return pid
    except (ValueError, OSError):
        return None


def free_port(port):
    with socket.socket() as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(('127.0.0.1', port))
        except OSError:
            raise RuntimeError(f'端口{port}已占用，未修改或停止占用者')


def spawn(name, args, cwd=ROOT):
    if owned_pid(name):
        return
    free_port(PORTS[name])
    log = open(RUNTIME / (name + '.stdout.log'), 'ab')
    process = subprocess.Popen(args, cwd=cwd, stdout=log, stderr=subprocess.STDOUT, start_new_session=True)
    log.close()
    write_private(RUNTIME / (name + '.pid'), str(process.pid))


def wait_port(name, seconds=25):
    end = time.monotonic() + seconds
    while time.monotonic() < end:
        try:
            with socket.create_connection(('127.0.0.1', PORTS[name]), timeout=.3):
                return
        except OSError:
            time.sleep(.2)
    raise RuntimeError(f'{name}未在时限内启动；请检查其专属日志')


def dependencies():
    values = prepare()
    provisioned = (RUNTIME / 'mysql.provisioned').exists()
    if not (RUNTIME / 'mysql' / 'auto.cnf').exists():
        result = subprocess.run([str(BIN / 'mysqld'), '--no-defaults', '--initialize-insecure',
                                 '--datadir=' + str(RUNTIME / 'mysql')], capture_output=True)
        if result.returncode:
            write_private(RUNTIME / 'mysql-initialize.log', result.stderr.decode(errors='replace'))
            raise RuntimeError('独立MySQL初始化失败，未启动其他数据库')
    spawn('mysql', [str(BIN / 'mysqld'), '--defaults-file=' + str(PRIVATE / 'mysql.cnf')])
    wait_port('mysql')
    if not provisioned:
        sql = ("CREATE DATABASE IF NOT EXISTS smart_campus CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
               "CREATE USER IF NOT EXISTS 'smart_campus'@'127.0.0.1' IDENTIFIED BY '" + values['db'] + "';"
               "GRANT ALL PRIVILEGES ON smart_campus.* TO 'smart_campus'@'127.0.0.1';"
               "ALTER USER 'root'@'localhost' IDENTIFIED BY '" + values['root'] + "';")
        result = subprocess.run([str(BIN / 'mysql'), '--no-defaults', '--protocol=SOCKET',
                                 '--socket=' + str(SOCKET), '-uroot'], input=sql, capture_output=True, text=True)
        if result.returncode:
            raise RuntimeError('独立MySQL初始化账户失败；原始错误已隐藏以保护秘密')
        write_private(RUNTIME / 'mysql.provisioned', 'schema=smart_campus\n')
    spawn('redis', [str(BIN / 'redis-server'), str(PRIVATE / 'redis.conf')])
    wait_port('redis')
    print('独立MySQL:13316、Redis:16379已就绪')


def start_apps():
    dependencies()
    jar = BE / 'target' / 'letoy-wagf-be-0.0.1.jar'
    if not jar.exists():
        raise RuntimeError('请先在BE运行 ./mvnw package，再启动应用')
    spawn('be', ['java', '-jar', str(jar), '--spring.profiles.active=local',
                 '--spring.config.additional-location=file:' + str(PRIVATE / 'local.properties')], BE)
    wait_port('be', 45)
    node = subprocess.run(['which', 'node'], capture_output=True, text=True).stdout.strip()
    if not node:
        raise RuntimeError('未找到Node运行时')
    spawn('mg', [node, str(MG / 'node_modules/vite/bin/vite.js'), '--host', '127.0.0.1',
                 '--port', '5173', '--strictPort'], MG)
    wait_port('mg')
    print('MG: http://127.0.0.1:5173  BE: http://127.0.0.1:8001')


def stop(names):
    for name in names:
        pid = owned_pid(name)
        if pid:
            os.kill(pid, signal.SIGTERM)
            end = time.monotonic() + 12
            while owned_pid(name) and time.monotonic() < end:
                time.sleep(.2)
            if owned_pid(name):
                raise RuntimeError(f'{name}仍在退出，未强制终止')
        (RUNTIME / (name + '.pid')).unlink(missing_ok=True)
    print('指定的本系统进程已停止，数据保留')


def status():
    print(json.dumps({name: {'running': bool(owned_pid(name)), 'port': port}
                      for name, port in PORTS.items()}, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=['init', 'start', 'stop', 'stop-apps', 'restart-apps', 'status', 'import-airiot'])
    action = parser.parse_args().action
    try:
        if action == 'init': dependencies()
        elif action == 'start': start_apps()
        elif action == 'stop': stop(['mg', 'be', 'redis', 'mysql'])
        elif action == 'stop-apps': stop(['mg', 'be'])
        elif action == 'restart-apps': stop(['mg', 'be']); start_apps()
        elif action == 'import-airiot': prepare(); print('专用应用配置已安全导入；重启BE生效')
        else: status()
    except Exception as error:
        if isinstance(error, RuntimeError):
            print(str(error))
        else:
            print('运行操作失败，未显示可能含秘密的原始异常')
        raise SystemExit(1)
