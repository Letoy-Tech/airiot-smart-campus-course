"""Author-only isolated MySQL 8.4 fixture. Never targets the original platform DB."""
from pathlib import Path
import json, os, secrets, socket, subprocess, sys, time, hashlib
ROOT=Path(__file__).resolve().parent.parent
PRIVATE=ROOT/'.private'; RUN=ROOT/'.runtime/course-mysql'; DATA=RUN/'data'
BIN=Path('/opt/homebrew/opt/mysql@8.4/bin'); PORT=13328
SOCKET_DIR=Path('/tmp')/('campus-course-'+hashlib.sha256(str(ROOT).encode()).hexdigest()[:12])
SOCKET=SOCKET_DIR/'mysql.sock'; PID=RUN/'mysqld.pid'; CFG=PRIVATE/'local-mysql-admin.cnf'

def execute(sql):
    args=[str(BIN/'mysql')]
    if CFG.exists(): args+=['--defaults-extra-file='+str(CFG)]
    args+=['--protocol=socket','--socket='+str(SOCKET),'-uroot','--batch','--skip-column-names']
    result=subprocess.run(args,input=sql,text=True,capture_output=True)
    if result.returncode: raise RuntimeError('Local fixture SQL failed; sensitive SQL deliberately not printed. '+result.stderr[:300])
    return result.stdout.strip()
def alive():
    if not PID.exists(): return False
    result=subprocess.run(['ps','-p',PID.read_text().strip(),'-o','command='],capture_output=True,text=True)
    if not result.stdout.strip(): return False
    if str(DATA) not in result.stdout or 'mysqld' not in result.stdout: raise RuntimeError('PID ownership mismatch; refusing to act')
    return True
def launch(bootstrap=False):
    if alive(): raise RuntimeError('Fixture is already running; do not start twice')
    SOCKET_DIR.mkdir(mode=0o700,exist_ok=True)
    if SOCKET_DIR.stat().st_uid != os.getuid() or SOCKET_DIR.stat().st_mode & 0o077: raise RuntimeError('Socket directory must belong to current user and be 0700')
    s=socket.socket(); s.bind(('127.0.0.1',PORT)); s.close()
    args=[str(BIN/'mysqld'),'--no-defaults','--datadir='+str(DATA),'--socket='+str(SOCKET),'--pid-file='+str(PID),'--log-error='+str(RUN/'mysql.log'),'--bind-address=127.0.0.1','--port='+str(PORT),'--mysqlx=0','--secure-file-priv=NULL','--innodb-buffer-pool-size=128M','--max-connections=30','--skip-log-bin']
    if bootstrap: args+=['--skip-networking']
    with (RUN/'launch.log').open('a') as log:
        subprocess.Popen(args,stdout=log,stderr=log,start_new_session=True)
    for _ in range(100):
        try:
            if execute('SELECT 1')=='1': return
        except RuntimeError: pass
        time.sleep(.2)
    raise RuntimeError('Fixture did not become ready; inspect its restricted log')
def stop():
    if not alive(): print('Isolated course DB is stopped'); return
    execute('SHUTDOWN')
    for _ in range(100):
        if not alive(): print('Isolated course DB stopped'); return
        time.sleep(.1)
    raise RuntimeError('Shutdown timeout; no force kill performed')
def init():
    if DATA.exists() or CFG.exists(): raise RuntimeError('Existing fixture preserved. Use start/status; init never overwrites.')
    PRIVATE.mkdir(mode=0o700,exist_ok=True); RUN.mkdir(parents=True,mode=0o700,exist_ok=True)
    DATA.mkdir(mode=0o700)
    with (RUN/'initialize.log').open('w') as log:
        subprocess.run([str(BIN/'mysqld'),'--no-defaults','--initialize-insecure','--datadir='+str(DATA)],stdout=log,stderr=log,check=True)
    bootstrap()
def bootstrap():
    if CFG.exists() or not DATA.exists(): raise RuntimeError('Bootstrap only resumes an unconfigured fixture')
    launch(True)
    if execute("SELECT COUNT(*) FROM information_schema.schemata WHERE schema_name NOT IN ('mysql','sys','information_schema','performance_schema')") != "0": raise RuntimeError('Unexpected schemas; refusing bootstrap')
    admin=secrets.token_hex(24); password=secrets.token_hex(24)
    execute("CREATE DATABASE campus_course_lab CHARACTER SET utf8mb4; CREATE DATABASE campus_course_test CHARACTER SET utf8mb4; CREATE USER 'course_local'@'127.0.0.1' IDENTIFIED BY '"+password+"'; GRANT ALL PRIVILEGES ON campus_course_lab.* TO 'course_local'@'127.0.0.1'; GRANT ALL PRIVILEGES ON campus_course_test.* TO 'course_local'@'127.0.0.1'; ALTER USER 'root'@'localhost' IDENTIFIED BY '"+admin+"';")
    CFG.write_text('[client]\npassword='+admin+'\n'); CFG.chmod(0o600)
    for name,schema in [('database.json','campus_course_lab'),('test-database.json','campus_course_test')]:
        p=PRIVATE/name
        if p.exists(): raise RuntimeError('Refusing to replace database settings')
        p.write_text(json.dumps({'purpose':'Isolated author validation only; not the teacher classroom database','url':f'jdbc:mysql://127.0.0.1:{PORT}/{schema}?sslMode=DISABLED&allowPublicKeyRetrieval=true&serverTimezone=UTC','username':'course_local','password':password,('allowTestReset' if name=='test-database.json' else 'allowAccountAdministration'):True},indent=2)+'\n'); p.chmod(0o600)
    stop(); launch(); print('Created course-only lab/test schemas on 127.0.0.1:13328; credentials stored privately, not printed')
if __name__=='__main__':
    cmd=sys.argv[1] if len(sys.argv)>1 else 'status'
    if cmd=='init': init()
    elif cmd=='bootstrap': bootstrap()
    elif cmd=='start': launch(); print('Isolated course DB started')
    elif cmd=='stop': stop()
    elif cmd=='status': print({'running':alive(),'port':PORT,'version':execute('SELECT VERSION()') if alive() else None})
    else: raise SystemExit('init|start|stop|status')
