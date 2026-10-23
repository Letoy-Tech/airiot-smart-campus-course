#!/usr/bin/env python3
"""Isolated macOS/Linux classroom MySQL/Redis; never manages system services."""
import argparse
import json
import os
from pathlib import Path
import secrets
import shutil
import signal
import socket
import subprocess
import sys
import time


def private_write(path, text):
    with path.open('x', encoding='utf-8') as f:
        os.chmod(path, 0o600)
        f.write(text)


def free(port):
    with socket.socket() as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind(('127.0.0.1', port))
            return True
        except OSError:
            return False


def identity(pid):
    p = subprocess.run(['ps', '-p', str(pid), '-o', 'lstart='],
                       capture_output=True, text=True)
    return p.stdout.strip() if p.returncode == 0 else ''


def alive(entry):
    return bool(isinstance(entry, dict) and type(entry.get('pid')) is int and entry['pid'] > 0
                and entry.get('identity') and identity(entry['pid']) == entry['identity'])


def executable(value, default):
    found = value or shutil.which(default)
    if not found or not Path(found).is_file():
        raise ValueError(f'未找到 {default}；请教师先安装，再指定可执行文件的完整路径。')
    return str(Path(found).resolve())


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    ap.add_argument('action', choices=['init', 'start', 'status', 'stop', 'restart-redis'])
    ap.add_argument('--root', type=Path, help='课程根目录；默认为 materials 的上级目录')
    ap.add_argument('--mysqld', help='MySQL 8.4 mysqld 完整路径，仅 init 使用')
    ap.add_argument('--redis-server', help='Redis 7.2+ 可执行文件完整路径，仅 init 使用')
    ap.add_argument('--mysql-port', type=int, default=23501)
    ap.add_argument('--redis-port', type=int, default=23502)
    a = ap.parse_args()
    if os.name != 'posix':
        raise ValueError('此工具支持 macOS/Linux；Windows 无 Docker 时请使用教师验收过的实验机。')
    candidate = a.root or Path(__file__).absolute().parent.parent
    if any(p.is_symlink() for p in [candidate, *candidate.parents]):
        raise ValueError('拒绝通过符号链接操作课程目录。')
    root = candidate.resolve()
    if not (root/'frontend').is_dir() or not (root/'materials').is_dir():
        raise ValueError('请在含 frontend 与 materials 的 campus-lab 根目录执行。')
    if any(c in str(root) for c in ['\n', '\r', '"']):
        raise ValueError('工程目录名称不能包含换行或双引号。')
    runtime = root/'.runtime/native'
    state_file = runtime/'processes.json'
    config_file = runtime/'configuration.json'
    if any(p.is_symlink() for p in [root/'.runtime', runtime, state_file, config_file, root/'.env']):
        raise ValueError('拒绝符号链接配置或运行目录。')
    if a.action == 'init':
        if (root/'.env').exists() or runtime.exists():
            raise ValueError('已有 .env 或 native 数据，已保留；不要重新生成口令。已有项目请 start/status。')
        if not (1024 <= a.mysql_port <= 65535 and 1024 <= a.redis_port <= 65535) or a.mysql_port == a.redis_port:
            raise ValueError('两项端口须为不同的 1024–65535 整数。')
        mysqld = executable(a.mysqld, 'mysqld')
        redis = executable(a.redis_server, 'redis-server')
        mysql_version = subprocess.check_output([mysqld, '--version'], text=True)
        redis_version = subprocess.check_output([redis, '--version'], text=True)
        import re
        if not re.search(r'\b8\.4\.', mysql_version):
            raise ValueError('备用路线要求 MySQL 8.4，请用 --mysqld 指定该版本。')
        match = re.search(r'v=(\d+)\.(\d+)', redis_version)
        if not match or tuple(map(int, match.groups())) < (7, 2):
            raise ValueError('备用路线要求 Redis 7.2 或更新版本，推荐 7.4。')
        if not free(a.mysql_port) or not free(a.redis_port):
            raise ValueError('课程端口被占用；不停止占用者。请先停止自己的旧课程，或由教师指定新端口。')
        if len(str(runtime/'mysql.sock').encode()) > 100:
            raise ValueError('工程路径过长；请先使用较短路径的全新课程副本，例如个人目录下 course/campus-lab。')
        runtime.mkdir(parents=True, mode=0o700)
        os.chmod(root/'.runtime', 0o700)
        # All generated values are hex so SQL/config quoting is unambiguous.
        values = {k: secrets.token_hex(24) for k in ['DB_PASSWORD', 'MYSQL_ROOT_PASSWORD', 'REDIS_PASSWORD', 'DEMO_PASSWORD']}
        env = '# 仅本课程本机使用；不提交、不发送，不在终端打印。\n'
        env += '\n'.join(f'{k}={v}' for k, v in values.items())
        env += f'\nDB_URL=jdbc:mysql://127.0.0.1:{a.mysql_port}/campus_course?useUnicode=true&characterEncoding=UTF-8&serverTimezone=UTC&allowPublicKeyRetrieval=true&useSSL=false\nDB_USER=campus\nREDIS_PORT={a.redis_port}\nCOURSE_RUNTIME=native\n'
        private_write(root/'.env', env)
        private_write(runtime/'configuration.json', json.dumps({'root': str(root), 'mysqld': mysqld, 'redis': redis,
                      'mysqlPort': a.mysql_port, 'redisPort': a.redis_port}, indent=2))
        # Put socket in the private runtime, not a global /tmp path. Short socket name avoids OS length limits.
        mysql_cfg = f'[mysqld]\nbind-address=127.0.0.1\nport={a.mysql_port}\ndatadir="{runtime}/mysql-data"\nsocket="{runtime}/mysql.sock"\npid-file="{runtime}/mysql.pid"\nlog-error="{runtime}/mysql-error.log"\nmysqlx=0\n'
        private_write(runtime/'mysql.cnf', mysql_cfg)
        private_write(runtime/'mysql-client.cnf', f'[client]\nuser=root\npassword={values["MYSQL_ROOT_PASSWORD"]}\nprotocol=tcp\nhost=127.0.0.1\nport={a.mysql_port}\n')
        sql = f"ALTER USER 'root'@'localhost' IDENTIFIED BY '{values['MYSQL_ROOT_PASSWORD']}';\nCREATE DATABASE IF NOT EXISTS campus_course CHARACTER SET utf8mb4;\nCREATE USER IF NOT EXISTS 'campus'@'127.0.0.1' IDENTIFIED BY '{values['DB_PASSWORD']}';\nCREATE USER IF NOT EXISTS 'campus'@'localhost' IDENTIFIED BY '{values['DB_PASSWORD']}';\nGRANT ALL PRIVILEGES ON campus_course.* TO 'campus'@'127.0.0.1';\nGRANT ALL PRIVILEGES ON campus_course.* TO 'campus'@'localhost';\n"
        private_write(runtime/'bootstrap.sql', sql)
        private_write(runtime/'redis.conf', f'bind 127.0.0.1\nport {a.redis_port}\nprotected-mode yes\nrequirepass {values["REDIS_PASSWORD"]}\nsave ""\nappendonly no\ndaemonize no\ndir "{runtime}"\n')
        print('已建立独立配置；下一步 start。口令只在本机 .env，已有数据不会被删除。')
        return
    if not config_file.exists():
        if a.action == 'status':
            print('尚未初始化本目录的 native 环境。')
            return
        raise ValueError('本目录尚未 init；不会操作其他服务。')
    cfg = json.loads(config_file.read_text())
    if cfg['root'] != str(root):
        raise ValueError('运行目录被移动或复制；交付应只带源码，在新目录 init，不复制 .runtime/.env。')
    state = json.loads(state_file.read_text()) if state_file.exists() else {}

    def save_state():
        tmp = runtime/'processes.new'
        if tmp.exists():
            raise ValueError('存在未完成状态写入，请教师检查，不覆盖。')
        private_write(tmp, json.dumps(state, indent=2))
        tmp.replace(state_file)

    def stop_one(name):
        entry = state.get(name)
        if alive(entry):
            os.kill(entry['pid'], signal.SIGTERM)
            deadline = time.monotonic() + 30
            while alive(entry) and time.monotonic() < deadline:
                time.sleep(.2)
            if alive(entry):
                raise ValueError(f'{name} 尚未退出；不强杀，请教师检查此课程的日志。')
        state.pop(name, None)
        save_state()

    def check_ready(name):
        if name == 'mysql':
            mysql = str(Path(cfg['mysqld']).with_name('mysql'))
            result = subprocess.run([mysql, f'--defaults-file={runtime}/mysql-client.cnf', '--no-login-paths',
                                    '--protocol=TCP', '--host=127.0.0.1', f"--port={cfg['mysqlPort']}",
                                    '-Nse', 'SELECT @@datadir'], capture_output=True, timeout=15)
            if result.returncode != 0 or Path(result.stdout.decode().strip()).resolve() != (runtime/'mysql-data').resolve():
                raise ValueError('MySQL 已监听但本目录认证/数据目录检查未通过；保留配置，勿重置口令。')
            if not (runtime/'initialized').exists():
                private_write(runtime/'initialized', 'bootstrap complete\n')
                (runtime/'bootstrap.sql').unlink()
        else:
            password = next(line.split(' ', 1)[1] for line in (runtime/'redis.conf').read_text().splitlines()
                            if line.startswith('requirepass '))
            with socket.create_connection(('127.0.0.1', cfg['redisPort']), timeout=5) as connection:
                stream = connection.makefile('rb')
                secret = password.encode()
                connection.sendall(b'*2\r\n$4\r\nAUTH\r\n$'+str(len(secret)).encode()+b'\r\n'+secret+b'\r\n')
                if stream.readline() != b'+OK\r\n':
                    raise ValueError('Redis 本目录认证未通过；保留配置，请教师检查。')
                connection.sendall(b'*1\r\n$4\r\nPING\r\n')
                if stream.readline() != b'+PONG\r\n':
                    raise ValueError('Redis 就绪检查未通过。')

    def start_one(name):
        port = cfg['mysqlPort' if name == 'mysql' else 'redisPort']
        if not alive(state.get(name)):
            if not free(port):
                raise ValueError(f'{name} 端口被其他进程占用；不会停止它。')
            if name == 'mysql':
                datadir = runtime/'mysql-data'
                if not datadir.exists():
                    with (runtime/'initialize.log').open('xb') as log:
                        os.chmod(log.name, 0o600)
                        subprocess.run([cfg['mysqld'], '--no-defaults', '--initialize-insecure', f'--datadir={datadir}'],
                                       stdout=log, stderr=log, check=True, timeout=90)
                cmd = [cfg['mysqld'], f'--defaults-file={runtime}/mysql.cnf']
                if not (runtime/'initialized').exists():
                    cmd.append(f'--init-file={runtime}/bootstrap.sql')
            else:
                cmd = [cfg['redis'], str(runtime/'redis.conf')]
            with (runtime/(name+'-process.log')).open('ab') as log:
                os.chmod(log.name, 0o600)
                proc = subprocess.Popen(cmd, cwd=root, stdout=log, stderr=log, start_new_session=True)
            try:
                state[name] = {'pid': proc.pid, 'identity': identity(proc.pid)}
                if not state[name]['identity']:
                    raise ValueError(f'{name} 启动即退出，请教师检查本机日志。')
                save_state()  # Record ownership before waiting; Ctrl+C can be recovered with status/stop.
            except BaseException:
                if proc.poll() is None:
                    proc.terminate()
                    proc.wait(timeout=15)
                raise
            deadline = time.monotonic() + 60
            while time.monotonic() < deadline:
                if proc.poll() is not None:
                    raise ValueError(f'{name} 启动失败；请教师在本机检查 .runtime/native 日志，勿分享含配置内容。')
                if not free(port):
                    break
                time.sleep(.2)
            if free(port):
                raise ValueError(f'{name} 启动超时；进程已登记，请 status/stop 后检查。')
        # Re-check even when the process was already running after a previous failed attempt.
        check_ready(name)

    if a.action == 'status':
        for name in ['mysql', 'redis']:
            print(name + ': ' + ('本目录进程运行中' if alive(state.get(name)) else '本目录进程未运行'))
        print('进程状态不等于业务验收；请继续课程接口和页面检查。')
    elif a.action == 'stop':
        for name in ['redis', 'mysql']:
            stop_one(name)
        print('已停止本目录登记的进程，配置与 MySQL 数据保留。')
    elif a.action == 'restart-redis':
        stop_one('redis')
        start_one('redis')
        print('本课程 Redis 已重启；短时登录失效，MySQL 数据未删除。')
    else:
        for name in ['mysql', 'redis']:
            start_one(name)
        print('本目录 MySQL/Redis 已启动；请按教材启动后端与页面。')


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        print('操作已中断；已登记的课程进程可用 status 查看、stop 停止，配置与数据保留。', file=sys.stderr)
        sys.exit(130)
    except (ValueError, OSError, subprocess.SubprocessError, json.JSONDecodeError) as exc:
        # Never expose a command exception that could include runtime configuration.
        print(str(exc) if isinstance(exc, ValueError) else '操作未完成；配置和数据保留，请教师检查本课程本机日志。', file=sys.stderr)
        sys.exit(1)
