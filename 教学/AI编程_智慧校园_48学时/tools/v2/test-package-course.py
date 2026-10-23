"""Black-box release guards using a disposable, synthetic course (no services).

Run: python3 tools/v2/test-package-course.py
The Python-only cases need no reader dependencies. If Node and the existing local
marked dependency are available, additional cases run the real reader builder
inside the fixture. COURSE_NODE may select an already installed Node executable.
"""
from pathlib import Path
import hashlib
import json
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import unittest
import zipfile


TOOLS = Path(__file__).resolve().parent
VERSION = '9.8.7'
PREFIX = f'AI编程_手把手课程_V{VERSION}'
STUDENT_ZIP = f'AI编程_学生空白起点_V{VERSION}.zip'
FULL_ZIP = f'AI编程_智慧校园_V{VERSION}_手把手教学包.zip'
REPORT = f'AI编程_智慧校园_V{VERSION}_交付校验.json'
MANIFEST = 'tools/v2/reader-build-manifest.json'
LESSONS = [f'handbook-v2/lessons/{i:02}-lesson.md' for i in range(1, 13)]
ENGINEERING = [f'{i:02}-engineering.md' for i in range(1, 9)]
CORE_SOURCES = [
    'tools/v2/build-reader.mjs', 'tools/v2/course-config.json',
    'handbook-v2/00-先准备再开始.md', 'handbook-v2/教师安排.md',
    'handbook-v2/教师验证记录.md', *LESSONS,
    *['handbook-v2/engineering/' + name for name in ENGINEERING],
]
ASSETS = ['handbook-v2/engineering/figure.svg', 'handbook-v2/engineering/exercise.mjs']
OUTPUTS = ['handbook-v2/index.html',
           f'handbook-v2/从空白开始_手把手教程_V{VERSION}.html', 'course-index-v2.json']


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


class PackageCourseTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='campus-package-test-')
        self.addCleanup(self.temp.cleanup)
        # Resolve the OS temporary-directory alias before testing the no-symlink rule.
        self.sandbox = Path(self.temp.name).resolve()
        self.root = self.sandbox / 'source' / 'course'
        self.root.mkdir(parents=True)
        self.write('tools/v2/package-course.py', (TOOLS / 'package-course.py').read_text())
        self.write('tools/v2/build-reader.mjs', (TOOLS / 'build-reader.mjs').read_text())
        self.write('tools/v2/course-config.json', json.dumps({
            'version': VERSION, 'lessons': 12, 'steps': 64,
            'total_class_hours': 48, 'minutes_per_class_hour': 45,
            'engineering_documents': ENGINEERING,
        }))
        for name in CORE_SOURCES[2:]:
            title = 'Synthetic ' + Path(name).stem
            self.write(name, '# ' + title + '\n\n## 第1步：fixture\n\nFixture text.\n')
        self.write(LESSONS[0], '# Synthetic lesson\n\n## 第1步：fixture\n\n'
                   '![Figure](../engineering/figure.svg)\n\n'
                   '[Exercise](../engineering/exercise.mjs)\n')
        self.write(ASSETS[0], '<svg xmlns="http://www.w3.org/2000/svg"><text>fixture</text></svg>\n')
        self.write(ASSETS[1], 'export const fixture = 1;\n')
        self.write(OUTPUTS[0], '<!doctype html><title>Synthetic reader</title>\n')
        self.write(OUTPUTS[1], '<!doctype html><title>Synthetic standalone reader</title>\n')
        self.write(OUTPUTS[2], json.dumps({'version': VERSION}))
        for name in ['index.html', '先打开这里.html', '01-课程大纲.md',
                     '02-项目范围与教学架构.md', '03-AI协作与接力规范.md',
                     '04-考核与验收.md', 'handbook-v2/交付包说明.md']:
            self.write(name, 'Public synthetic fixture.\n')
        self.write('resources/from-zero-v2/student-start/frontend/index.html', '')
        self.write('resources/from-zero-v2/student-start/.env.example', 'PASSWORD=GENERATED_LOCALLY\n')
        self.write('resources/from-zero-v2/student-start/materials/maven-wrapper/mvnw',
                   '#!/bin/sh\nexit 0\n', mode=0o755)
        self.write('resources/from-zero-v2/teacher-reference/backend/mvnw',
                   '#!/bin/sh\nexit 0\n', mode=0o755)
        self.write(MANIFEST, json.dumps({
            'schema_version': 1, 'version': VERSION,
            'sources': {name: sha(self.root / name) for name in CORE_SOURCES + ASSETS},
            'outputs': {name: sha(self.root / name) for name in OUTPUTS},
        }))

    def write(self, relative, text, mode=0o644):
        target = self.root / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(text, encoding='utf-8')
        target.chmod(mode)

    def run_package(self, *arguments, root=None):
        root = root or self.root
        # A different cwd demonstrates that defaults are anchored to the packaged course.
        return subprocess.run([sys.executable, str(root / 'tools/v2/package-course.py'), *arguments],
                              cwd=self.sandbox, text=True, capture_output=True, timeout=30)

    def assert_rejected_without_release(self, result, detail):
        self.assertNotEqual(result.returncode, 0, result.stdout)
        self.assertIn(detail, result.stderr)
        self.assertFalse((self.root / '.runtime/releases').exists())
        self.assertFalse(list(self.sandbox.rglob('*.zip')))

    def test_missing_manifest_requires_rebuild(self):
        (self.root / MANIFEST).unlink()
        self.assert_rejected_without_release(self.run_package(), '缺少构建清单')

    def test_changed_inputs_require_rebuild(self):
        for name in [LESSONS[0], 'handbook-v2/engineering/' + ENGINEERING[0],
                     *ASSETS, 'tools/v2/build-reader.mjs']:
            with self.subTest(source=name):
                path = self.root / name
                original = path.read_bytes()
                path.write_bytes(original + b'\nchanged after reader build\n')
                self.assert_rejected_without_release(self.run_package(), name)
                path.write_bytes(original)

    def test_modified_html_or_index_is_rejected(self):
        for name in OUTPUTS:
            with self.subTest(output=name):
                path = self.root / name
                original = path.read_bytes()
                path.write_bytes(original + b'\nmanual change\n')
                self.assert_rejected_without_release(self.run_package(), name)
                path.write_bytes(original)

    def test_changed_config_version_is_rejected(self):
        path = self.root / 'tools/v2/course-config.json'
        config = json.loads(path.read_text())
        config['version'] = '9.8.8'
        path.write_text(json.dumps(config))
        self.assert_rejected_without_release(self.run_package(), '版本不匹配')

    def test_check_only_does_not_write(self):
        before = sorted(p.relative_to(self.sandbox) for p in self.sandbox.rglob('*'))
        result = self.run_package('--check-only')
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertGreater(json.loads(result.stdout)['reader_sources_verified'], 20)
        self.assertEqual(before, sorted(p.relative_to(self.sandbox) for p in self.sandbox.rglob('*')))

    def test_valid_package_permissions_no_overwrite_and_extracted_default(self):
        result = self.run_package()
        self.assertEqual(result.returncode, 0, result.stderr)
        release = self.root / '.runtime/releases' / ('v' + VERSION)
        self.assertEqual({p.name for p in release.iterdir()}, {STUDENT_ZIP, FULL_ZIP, REPORT})
        original = {p.name: p.read_bytes() for p in release.iterdir()}
        second = self.run_package()
        self.assertNotEqual(second.returncode, 0)
        self.assertIn('Refusing to replace existing release file', second.stderr)
        self.assertEqual(original, {p.name: p.read_bytes() for p in release.iterdir()})
        for archive_name, member in [
            (STUDENT_ZIP, 'campus-lab/materials/maven-wrapper/mvnw'),
            (FULL_ZIP, PREFIX + '/resources/from-zero-v2/teacher-reference/backend/mvnw'),
        ]:
            with self.subTest(archive=archive_name), zipfile.ZipFile(release / archive_name) as archive:
                info = archive.getinfo(member)
                self.assertEqual(info.create_system, 3)
                self.assertEqual(stat.S_IMODE(info.external_attr >> 16), 0o755)
                manifest = json.loads(archive.read('PACKAGE-MANIFEST.json'))
                row = next(item for item in manifest['files'] if item['path'] == member)
                self.assertEqual(row['mode'], '0755')
                self.assertEqual(row['sha256'], hashlib.sha256(archive.read(member)).hexdigest())
                self.assertEqual(stat.S_IMODE(archive.getinfo('PACKAGE-MANIFEST.json').external_attr >> 16), 0o644)
        extracted = self.sandbox / 'recipient' / 'deep' / 'unpacked'
        extracted.mkdir(parents=True)
        unzip = shutil.which('unzip')
        if unzip:
            subprocess.run([unzip, '-q', str(release / FULL_ZIP), '-d', str(extracted)],
                           check=True, capture_output=True, timeout=30)
            wrapper = extracted / PREFIX / 'resources/from-zero-v2/teacher-reference/backend/mvnw'
            self.assertTrue(wrapper.stat().st_mode & stat.S_IXUSR)
        else:
            with zipfile.ZipFile(release / FULL_ZIP) as archive:
                archive.extractall(extracted)
        copied = extracted / PREFIX
        before_files = {p.relative_to(self.sandbox) for p in self.sandbox.rglob('*') if p.is_file()}
        repacked = self.run_package(root=copied)
        self.assertEqual(repacked.returncode, 0, repacked.stderr)
        added = {p.relative_to(self.sandbox) for p in self.sandbox.rglob('*') if p.is_file()} - before_files
        wanted = copied.relative_to(self.sandbox) / '.runtime/releases' / ('v' + VERSION)
        self.assertEqual(added, {wanted / name for name in [STUDENT_ZIP, FULL_ZIP, REPORT]})

    def test_existing_report_prevents_partial_release(self):
        output = self.sandbox / 'selected-output'
        output.mkdir()
        existing = output / REPORT
        existing.write_text('Recipient-owned existing report.\n')
        result = self.run_package('--output-dir', str(output))
        self.assertNotEqual(result.returncode, 0)
        self.assertEqual(existing.read_text(), 'Recipient-owned existing report.\n')
        self.assertEqual([p.name for p in output.iterdir()], [REPORT])

    def test_builder_refuses_output_symlinks_without_writing(self):
        node = os.environ.get('COURSE_NODE') or shutil.which('node')
        dependencies = TOOLS / 'node_modules'
        if not node or not (dependencies / 'marked/package.json').is_file():
            self.skipTest('Requires local Node and already-installed marked')
        (self.root / 'tools/v2/node_modules').symlink_to(dependencies, target_is_directory=True)
        sentinel = self.sandbox / 'recipient-owned.txt'
        sentinel.write_text('Do not change')
        for relative in OUTPUTS + [MANIFEST]:
            with self.subTest(output=relative):
                target = self.root / relative
                original = target.read_bytes()
                target.unlink()
                target.symlink_to(sentinel)
                others = {name: (self.root / name).read_bytes() for name in OUTPUTS + [MANIFEST] if name != relative}
                built = subprocess.run([node, str(self.root / 'tools/v2/build-reader.mjs')],
                                       cwd=self.root, text=True, capture_output=True, timeout=30)
                self.assertNotEqual(built.returncode, 0)
                self.assertIn('输出拒绝符号链接', built.stderr)
                self.assertEqual(sentinel.read_text(), 'Do not change')
                for name, content in others.items():
                    self.assertEqual((self.root / name).read_bytes(), content)
                target.unlink()
                target.write_bytes(original)

    def test_real_builder_manifest_captures_assets(self):
        node = os.environ.get('COURSE_NODE') or shutil.which('node')
        dependencies = TOOLS / 'node_modules'
        if not node or not (dependencies / 'marked/package.json').is_file():
            self.skipTest('Optional real builder check requires local Node and already-installed marked')
        (self.root / 'tools/v2/node_modules').symlink_to(dependencies, target_is_directory=True)
        built = subprocess.run([node, str(self.root / 'tools/v2/build-reader.mjs')],
                               cwd=self.root, text=True, capture_output=True, timeout=30)
        self.assertEqual(built.returncode, 0, built.stderr)
        manifest = json.loads((self.root / MANIFEST).read_text())
        self.assertEqual(set(manifest['sources']), set(CORE_SOURCES + ASSETS))
        self.assertEqual(set(manifest['outputs']), set(OUTPUTS))
        for group in ['sources', 'outputs']:
            for name, digest in manifest[group].items():
                self.assertEqual(digest, sha(self.root / name))
        self.assertEqual(self.run_package('--check-only').returncode, 0)
        self.write(ASSETS[1], 'export const fixture = 2;\n')
        self.assert_rejected_without_release(self.run_package(), ASSETS[1])


if __name__ == '__main__':
    unittest.main(verbosity=2)
