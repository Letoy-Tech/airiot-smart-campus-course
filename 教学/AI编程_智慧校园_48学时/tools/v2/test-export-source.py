"""Source-export guards; use synthetic files in temporary copies, never real .env."""
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
import zipfile

COURSE = Path(__file__).resolve().parents[2]
SOURCE = COURSE/'resources/from-zero-v2/teacher-reference'
NODE = shutil.which('node')


@unittest.skipUnless(NODE, 'Node is required')
class ExportGuards(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix='export-guard-')
        self.root=Path(self.temp.name)/'source'
        shutil.copytree(SOURCE,self.root,ignore=shutil.ignore_patterns(
            '.env','.env.*','.runtime','.private','target','node_modules','.git','__pycache__'))
        # This public sample is required; the broad copy ignore above intentionally
        # excludes every other environment variant, including local test leftovers.
        shutil.copy2(SOURCE/'.env.example',self.root/'.env.example')
        self.out=self.root/'.runtime/hand-in/campus-lab'

    def tearDown(self):
        self.temp.cleanup()

    def export(self):
        return subprocess.run([NODE,'tools/export-source.mjs','--out','.runtime/hand-in/campus-lab'],
            cwd=self.root,capture_output=True,text=True,timeout=20)

    def test_normal_sources_manifest_and_environment_exclusion(self):
        (self.root/'.env').write_text('DEMO_PASSWORD=synthetic-export-secret-1234567890\n')
        (self.root/'docs/.env.local').write_text('synthetic-local-only\n')
        result=self.export()
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertFalse((self.out/'.env').exists())
        self.assertFalse((self.out/'docs/.env.local').exists())
        self.assertTrue((self.out/'.env.example').is_file())
        manifest=json.loads((self.out/'SOURCE-MANIFEST.json').read_text())
        self.assertEqual(manifest['version'],'2.1.1')
        for item in manifest['files']:
            data=(self.out/item['path']).read_bytes()
            self.assertEqual(hashlib.sha256(data).hexdigest(),item['sha256'])
            self.assertEqual(len(data),item['bytes'])
        self.assertNotEqual(self.export().returncode,0)

    def test_nested_archive_cannot_hide_environment(self):
        secret='synthetic-audit-only-'+'k'*64
        (self.root/'.env').write_text('DEMO_PASSWORD='+secret+'\n')
        parent=self.root/'docs/nested';parent.mkdir()
        with zipfile.ZipFile(parent/'backup.zip','w',compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('.env','DEMO_PASSWORD='+secret+'\n')
        result=self.export()
        self.assertNotEqual(result.returncode,0)
        self.assertIn('归档、密钥或备份',result.stderr)
        self.assertFalse((self.out/'SOURCE-MANIFEST.json').exists())
        self.assertFalse((self.out/'docs/nested/backup.zip').exists())

    def test_nested_keys_and_backups_refuse(self):
        parent=self.root/'materials/nested';parent.mkdir()
        for name in ['private.pem','PRIVATE.KEY','db.dump','database.sqlite3','backup.sql',
                     'course-dump-2026.sql','settings.bak','.npmrc','id_ed25519','draft.md~']:
            with self.subTest(name=name):
                candidate=parent/name;candidate.write_text('synthetic test only\n')
                result=self.export()
                self.assertNotEqual(result.returncode,0)
                self.assertIn('归档、密钥或备份',result.stderr)
                self.assertFalse((self.out/'SOURCE-MANIFEST.json').exists())
                candidate.unlink()
                # Only this test's generated output is removed between cases.
                if self.out.exists():shutil.rmtree(self.out)

    def test_archive_content_with_another_extension_refuses(self):
        with zipfile.ZipFile(self.root/'docs/backup.bin','w',compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('.env','DEMO_PASSWORD=synthetic-archive-only\n')
        result=self.export()
        self.assertNotEqual(result.returncode,0)
        self.assertIn('归档或数据库内容',result.stderr)
        self.assertFalse((self.out/'SOURCE-MANIFEST.json').exists())

    def test_modified_wrapper_cannot_bypass_archive_guard(self):
        wrapper=self.root/'backend/.mvn/wrapper/maven-wrapper.jar'
        with zipfile.ZipFile(wrapper,'w',compression=zipfile.ZIP_DEFLATED) as archive:
            archive.writestr('.env','DEMO_PASSWORD=synthetic-wrapper-only\n')
        result=self.export()
        self.assertNotEqual(result.returncode,0)
        self.assertIn('Maven wrapper 与本课已核对版本不一致',result.stderr)
        self.assertFalse((self.out/'SOURCE-MANIFEST.json').exists())

    @unittest.skipUnless(os.name=='posix','Symlink test requires POSIX')
    def test_nested_symlink_refuses(self):
        sentinel=Path(self.temp.name)/'outside.txt';sentinel.write_text('unchanged')
        (self.root/'docs/link.md').symlink_to(sentinel)
        self.assertNotEqual(self.export().returncode,0)
        self.assertEqual(sentinel.read_text(),'unchanged')
        self.assertFalse((self.out/'SOURCE-MANIFEST.json').exists())


if __name__=='__main__':unittest.main()
