"""Guard tests use fake version executables and never start database services."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch
import importlib.util

SCRIPT = Path(__file__).with_name('native-runtime.py')
SPEC = importlib.util.spec_from_file_location('native_runtime', SCRIPT)
NATIVE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(NATIVE)

@unittest.skipUnless(os.name == 'posix', 'Native runtime supports macOS/Linux')
class NativeGuards(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='nv-', dir='/private/tmp' if Path('/private/tmp').exists() else '/tmp')
        self.root = Path(self.temp.name).resolve()
        for name in ['frontend', 'materials']:
            (self.root/name).mkdir()
        self.mysql = self.root/'fake-mysqld'
        self.redis = self.root/'fake-redis'
        self.client = self.root/'mysql'
        self.mysql.write_text('#!/bin/sh\nprintf "mysqld Ver 8.4.10\\n"\n')
        self.redis.write_text('#!/bin/sh\nprintf "Redis server v=7.4.0\\n"\n')
        self.client.write_text('#!/bin/sh\nprintf "mysql Ver 8.4.10\\n"\n')
        for p in [self.mysql, self.redis, self.client]:p.chmod(0o700)
        self.ports=[]
        while len(self.ports)<2:
            with socket.socket() as s:
                s.bind(('127.0.0.1',0));port=s.getsockname()[1]
                if port not in self.ports:self.ports.append(port)

    def tearDown(self):self.temp.cleanup()

    def invoke(self, action, root=None):
        return subprocess.run([sys.executable,str(SCRIPT),action,'--root',str(root or self.root),
            '--mysqld',str(self.mysql),'--redis-server',str(self.redis),
            '--mysql-port',str(self.ports[0]),'--redis-port',str(self.ports[1])],capture_output=True,text=True)

    def test_existing_environment_is_preserved(self):
        path=self.root/'.env';path.write_text('sentinel-do-not-read-or-replace\n')
        self.assertNotEqual(self.invoke('init').returncode,0)
        self.assertEqual(path.read_text(),'sentinel-do-not-read-or-replace\n')
        self.assertFalse((self.root/'.runtime').exists())

    def test_busy_port_refuses_without_configuration(self):
        with socket.socket() as s:
            s.bind(('127.0.0.1',self.ports[0]));s.listen()
            self.assertNotEqual(self.invoke('init').returncode,0)
        self.assertFalse((self.root/'.env').exists())

    def test_symlink_refuses(self):
        link=self.root/'link';link.symlink_to(self.root,target_is_directory=True)
        self.assertNotEqual(self.invoke('init',link).returncode,0)
        self.assertFalse((self.root/'.env').exists())

    def test_long_path_refuses_before_writing(self):
        longroot=self.root/('x'*90)
        for p in ['frontend','materials']:(longroot/p).mkdir(parents=True)
        self.assertNotEqual(self.invoke('init',longroot).returncode,0)
        self.assertFalse((longroot/'.env').exists())

    def test_fresh_init_permissions_and_second_init_preservation(self):
        # Default temp paths on macOS may be long: use a short private system temp root.
        with tempfile.TemporaryDirectory(prefix='nv-',dir='/private/tmp' if Path('/private/tmp').exists() else '/tmp') as d:
            root=Path(d).resolve()
            for p in ['frontend','materials']:(root/p).mkdir()
            self.assertEqual(self.invoke('init',root).returncode,0)
            before=(root/'.env').read_bytes()
            self.assertEqual((root/'.env').stat().st_mode & 0o777,0o600)
            self.assertNotEqual(self.invoke('init',root).returncode,0)
            self.assertEqual((root/'.env').read_bytes(),before)
            # A stale PID identity must never authorize signalling another process.
            runtime=root/'.runtime/native'
            (runtime/'processes.json').write_text(json.dumps({'mysql':{'pid':os.getpid(),'identity':'not-this-process'}}))
            self.assertEqual(self.invoke('stop',root).returncode,0)
            self.assertEqual(json.loads((runtime/'processes.json').read_text()),{})
            self.assertEqual((root/'.env').read_bytes(),before)

    def test_nested_runtime_symlinks_refuse_before_file_access(self):
        outside = self.root/'unrelated.txt'
        outside.write_text('UNRELATED_SENTINEL\n')
        outside.chmod(0o644)
        for index, name in enumerate(['mysql-process.log', 'mysql.cnf', 'redis.conf',
                                      'mysql-client.cnf', 'bootstrap.sql', 'processes.new',
                                      'initialize.log', 'initialized', 'mysql-data/nested/link']):
            with self.subTest(path=name):
                root = self.root/f'case-{index}'
                for directory in ['frontend', 'materials']:(root/directory).mkdir(parents=True)
                self.assertEqual(self.invoke('init',root).returncode,0)
                target=root/'.runtime/native'/name
                target.parent.mkdir(parents=True,exist_ok=True)
                if target.exists():target.rename(target.with_name(target.name+'.original'))
                target.symlink_to(outside)
                for action in ['status','start','stop','restart-redis']:
                    result=self.invoke(action,root)
                    self.assertNotEqual(result.returncode,0)
                    self.assertIn('符号链接',result.stderr)
                self.assertEqual(outside.read_text(),'UNRELATED_SENTINEL\n')
                self.assertEqual(outside.stat().st_mode & 0o777,0o644)

    def test_split_install_uses_client_on_path_and_records_it(self):
        server_dir=self.root/'sbin';server_dir.mkdir()
        server=server_dir/'mysqld';server.write_bytes(self.mysql.read_bytes());server.chmod(0o700)
        client_dir=self.root/'bin';client_dir.mkdir()
        client=client_dir/'mysql';client.write_bytes(self.client.read_bytes());client.chmod(0o700)
        args=[sys.executable,str(SCRIPT),'init','--root',str(self.root),'--mysqld',str(server),
              '--redis-server',str(self.redis),'--mysql-port',str(self.ports[0]),'--redis-port',str(self.ports[1])]
        result=subprocess.run(args,env={**os.environ,'PATH':str(client_dir)},capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        cfg=json.loads((self.root/'.runtime/native/configuration.json').read_text())
        self.assertEqual(cfg['mysql'],str(client))
        # Old configurations omit mysql; the same resolver safely falls back to PATH.
        with patch.object(NATIVE.shutil,'which',return_value=str(client)):
            self.assertEqual(NATIVE.mysql_client(None,str(server)),str(client))

    def test_explicit_client_and_missing_client(self):
        with patch.object(NATIVE.shutil,'which',return_value=None):
            self.assertEqual(NATIVE.mysql_client(str(self.client),str(self.mysql)),str(self.client))
            with self.assertRaises(ValueError):
                NATIVE.mysql_client(str(self.root/'missing-client'),str(self.mysql))
        self.client.unlink()
        result=subprocess.run([sys.executable,str(SCRIPT),'init','--root',str(self.root),
            '--mysqld',str(self.mysql),'--redis-server',str(self.redis),
            '--mysql-port',str(self.ports[0]),'--redis-port',str(self.ports[1])],
            env={**os.environ,'PATH':str(self.root/'missing-bin')},capture_output=True,text=True)
        self.assertNotEqual(result.returncode,0)
        self.assertFalse((self.root/'.env').exists())
        self.assertFalse((self.root/'.runtime').exists())

    def test_version_probe_has_timeout(self):
        with patch.object(NATIVE.subprocess,'check_output',return_value='fake version') as probe:
            NATIVE.version_output('fake-executable')
        self.assertEqual(probe.call_args.kwargs['timeout'],12)

    def test_explicit_client_version_and_configuration(self):
        client=self.root/'custom-client'
        client.write_bytes(self.client.read_bytes());client.chmod(0o700)
        for version_ok in [True,False]:
            root=self.root/('good' if version_ok else 'wrong')
            for directory in ['frontend','materials']:(root/directory).mkdir(parents=True)
            if not version_ok:client.write_text('#!/bin/sh\nprintf "mysql Ver 9.0.0\\n"\n')
            result=subprocess.run([sys.executable,str(SCRIPT),'init','--root',str(root),
                '--mysqld',str(self.mysql),'--mysql',str(client),'--redis-server',str(self.redis),
                '--mysql-port',str(self.ports[0]),'--redis-port',str(self.ports[1])],capture_output=True,text=True)
            if version_ok:
                self.assertEqual(result.returncode,0,result.stderr)
                cfg=json.loads((root/'.runtime/native/configuration.json').read_text())
                self.assertEqual(cfg['mysql'],str(client))
            else:
                self.assertNotEqual(result.returncode,0)
                self.assertFalse((root/'.env').exists())
                self.assertFalse((root/'.runtime').exists())

if __name__=='__main__':unittest.main()
