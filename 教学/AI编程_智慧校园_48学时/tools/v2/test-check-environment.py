"""Environment-check tests run version-only fake executables; no real services."""
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest

SCRIPT=Path(__file__).with_name('check-environment.mjs')
NODE=shutil.which('node')


@unittest.skipUnless(os.name=='posix' and NODE,'POSIX and Node required for fake executable tests')
class EnvironmentGuards(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='env-guard-')
        self.root=Path(self.temp.name)
        self.bin=self.root/'bin';self.bin.mkdir()
        self.server=self.root/'sbin/mysqld';self.server.parent.mkdir()
        self.fake(self.server,'mysqld Ver 8.4.10')
        for name,version in [('java','openjdk 17.0.12'),('git','git version 2.47.0'),
                             ('python3','Python 3.12.0'),('redis-server','Redis server v=7.4.0')]:
            self.fake(self.bin/name,version)

    def tearDown(self):self.temp.cleanup()

    def fake(self,path,version):
        path.write_text('#!/bin/sh\nprintf "%s\\n" "'+version+'"\n');path.chmod(0o700)

    def check(self,*args):
        result=subprocess.run([NODE,str(SCRIPT),'--native','--mysqld',str(self.server),*args],
            env={**os.environ,'PATH':str(self.bin)},capture_output=True,text=True,timeout=20)
        checks={item['name']:item['status'] for item in json.loads(result.stdout)['checks']}
        return result,checks

    def test_split_layout_finds_client_on_path(self):
        self.fake(self.bin/'mysql','mysql Ver 8.4.10')
        _,checks=self.check()
        self.assertEqual(checks['MySQL 8.4 server'],'PASS')
        self.assertEqual(checks['MySQL 8.4 client'],'PASS')

    def test_missing_client_is_not_accepted(self):
        result,checks=self.check()
        self.assertEqual(checks['MySQL 8.4 client'],'UNAVAILABLE')
        self.assertNotEqual(result.returncode,0)

    def test_explicit_client_version_is_checked(self):
        client=self.root/'custom-client';self.fake(client,'mysql Ver 8.4.10')
        _,checks=self.check('--mysql',str(client))
        self.assertEqual(checks['MySQL 8.4 client'],'PASS')
        self.fake(client,'mysql Ver 9.0.0')
        _,checks=self.check('--mysql',str(client))
        self.assertEqual(checks['MySQL 8.4 client'],'CHECK_VERSION')

    def test_server_symlink_uses_actual_install_sibling(self):
        actual=self.root/'installed';actual.mkdir()
        self.fake(actual/'mysqld','mysqld Ver 8.4.10')
        self.fake(actual/'mysql','mysql Ver 8.4.10')
        self.server.unlink();self.server.symlink_to(actual/'mysqld')
        _,checks=self.check()
        self.assertEqual(checks['MySQL 8.4 client'],'PASS')

    def test_unknown_argument_is_rejected(self):
        result=subprocess.run([NODE,str(SCRIPT),'--unknown'],capture_output=True,text=True,timeout=20)
        self.assertNotEqual(result.returncode,0)
        self.assertIn('参数无效',result.stderr)


if __name__=='__main__':unittest.main()
