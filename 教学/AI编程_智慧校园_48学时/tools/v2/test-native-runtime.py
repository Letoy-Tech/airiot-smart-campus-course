"""Guard tests use fake version executables and never start database services."""
import json
import os
from pathlib import Path
import socket
import subprocess
import sys
import tempfile
import unittest

SCRIPT = Path(__file__).with_name('native-runtime.py')

@unittest.skipUnless(os.name == 'posix', 'Native runtime supports macOS/Linux')
class NativeGuards(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='nv-')
        self.root = Path(self.temp.name).resolve()
        for name in ['frontend', 'materials']:
            (self.root/name).mkdir()
        self.mysql = self.root/'fake-mysqld'
        self.redis = self.root/'fake-redis'
        self.mysql.write_text('#!/bin/sh\nprintf "mysqld Ver 8.4.10\\n"\n')
        self.redis.write_text('#!/bin/sh\nprintf "Redis server v=7.4.0\\n"\n')
        for p in [self.mysql, self.redis]:p.chmod(0o700)
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

if __name__=='__main__':unittest.main()
