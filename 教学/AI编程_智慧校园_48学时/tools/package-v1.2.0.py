"""Package V1.2.0 after frozen stage, application and static-document evidence.

Run from any directory: python3 tools/package-v1.2.0.py
This script never opens a browser, rebuilds sources or reruns application tests.
It creates a new archive, checks a fresh extraction, and preserves old archives.
"""
from pathlib import Path, PurePosixPath
from html.parser import HTMLParser
from urllib.parse import unquote, urlsplit
import datetime
import hashlib
import json
import os
import runpy
import stat
import sys
import uuid
import zipfile


ROOT = Path(__file__).resolve().parents[1]
VERSION = '1.2.0'
QA = 'journey/qa/round10'
MANIFEST_NAME = f'delivery-manifest-v{VERSION}.json'
ARCHIVE_NAME = f'AI编程_智慧校园_48学时_V{VERSION}_完整教学包.zip'
HISTORICAL = {
    'AI编程_智慧校园_48学时_V1.1.1_完整教学包.zip':
        'b90d375ad91198fe9b88dde61023d21a0c5991088082627fcd11ef4d3b2b3282',
    'AI编程_智慧校园_48学时_V1.0.2_完整教学包.zip':
        '1083e348cca3085b802f04c76971635883af65c58324e323d82244039206c1d5',
    'AI编程_智慧校园_48学时_V1.1.0_完整教学包.zip':
        '625042673d2f3da39ab2b889e17a22495e25cee870725e37de176dbd5429ee87',
}
REQUIRED = [
    'resources/project-journey/evidence/author-verification.json',
    f'{QA}/application-verification.json',
]
ENTRIES = [
    '先打开这里.html', 'index.html', 'journey/index.html', 'walkthroughs/index.html', 'reading/index.html',
    'lesson-plans/手把手主线授课衔接.html', 'lesson-plans/index.html', 'resources/index.html',
]
LIMITATIONS = {
    'offlineHtml': '新离线HTML仅进行本轮静态检查，未进行本轮离线浏览器复测。',
    'offlineBrowserRetestedThisRound': False,
    'windowsPhysicalMachine': False,
    'classroomTrial': False,
    'schoolDatabase': False,
    'realAiriot': False,
    'realQwenSession': False,
    'realCodeBuddyStudentSession': False,
    'note': '作者工程与HTTP/应用浏览器结果不能代替Windows实机、学校环境或学生课堂验收。',
}


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def digest(path):
    value = hashlib.sha256()
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2) + '\n').encode('utf-8')


def read_json(relative):
    return json.loads((ROOT / relative).read_text(encoding='utf-8-sig'))


def inside_file(base, relative):
    require(isinstance(relative, str) and relative, 'Missing evidence file path')
    target = (base / relative).resolve()
    require(target.is_relative_to(base.resolve()), f'Path escapes its declared root: {relative}')
    require(target.is_file() and not (base / relative).is_symlink(), f'Missing or symlink file: {relative}')
    return target


def verify_records(records, base, label):
    require(isinstance(records, list) and records, f'Empty hash records: {label}')
    seen = set()
    for item in records:
        relative = item.get('file', item.get('path'))
        require(relative not in seen, f'Duplicate hash record: {label}: {relative}')
        seen.add(relative)
        require(digest(inside_file(base, relative)) == item.get('sha256'),
                f'Stale source/build hash: {label}: {relative}')


def verify_histories():
    for name, expected in HISTORICAL.items():
        require(digest(ROOT.parent / name) == expected, f'Historical archive changed: {name}')
    protected = {}
    for version in ('1.0.2', '1.1.0'):
        for item in read_json(f'delivery-manifest-v{version}.json')['files']:
            name = item['path']
            if (name.startswith(('resources/campus-ai-course/', 'resources/student-chapters/'))
                    or name.lower().endswith(('.docx', '.pdf'))):
                require(name not in protected or protected[name] == item['sha256'],
                        f'Historical baselines disagree: {name}')
                protected[name] = item['sha256']
    for name, expected in protected.items():
        require(digest(inside_file(ROOT, name)) == expected, f'Historical source changed: {name}')
    return protected


def verify_gates():
    require(read_json('course-index.json')['version'] == VERSION, 'Wrong current version')
    reports = {'course-index.json': digest(ROOT / 'course-index.json')}
    for relative in REQUIRED:
        value = read_json(relative)
        expected_status = 'PASS_SOURCE_BUILD_CHECKS' if relative == REQUIRED[0] else 'PASS'
        require(value.get('status') == expected_status, f'Current gate not {expected_status}: {relative}')
        reports[relative] = digest(ROOT / relative)
    build = read_json('journey/build.json')
    require(digest(ROOT / 'journey/index.html') == build.get('sha256'), 'Journey HTML stale')
    verify_records(build['sources'], ROOT, 'journey/build.json')
    require(build['stations'] == 12, 'Expected 12 stations')
    stages = read_json('resources/project-journey/BUILD-MANIFEST.json')
    require(stages.get('pending') == [], 'Reference modules pending')
    verify_records(stages['files'], ROOT / 'resources/project-journey', 'project journey generated files')
    verify_records(stages['sourceFiles'], ROOT / 'resources/student-project', 'project journey source files')
    author = read_json(REQUIRED[0])
    require((author.get('finalSourceManifestSha256') or author.get('sourceManifestSha256')) == digest(ROOT / 'resources/project-journey/BUILD-MANIFEST.json'), 'Stage proof stale')
    require(len(author['stages']) == 12 and {x['stage'] for x in author['stages']} == set(range(1, 13)) and all(x['exitCode'] == 0 and x['settingsPreserved'] for x in author['stages']), 'Not all stages built or student edits lost')
    require(author['toolTests']['exitCode'] == 0 and author['backend']['exitCode'] == 0, 'Author tool/backend build failed')
    rebind_path = 'resources/project-journey/evidence/doc-only-rebind.json'
    rebind = read_json(rebind_path)
    require(rebind['status'] == 'PASS_DOCUMENTATION_ONLY_REBIND' and rebind['runtimeCodeChanged'] is False, 'Runtime changes require fresh execution')
    require(rebind['executedSourceManifestSha256'] == author['sourceManifestSha256'] and rebind['finalSourceManifestSha256'] == digest(ROOT / 'resources/project-journey/BUILD-MANIFEST.json'), 'Documentation rebind does not match executed and packaged versions')
    reports[rebind_path] = digest(ROOT / rebind_path)
    original_path = 'resources/project-journey/evidence/pre-doc-rebind-manifest.json'
    require(digest(ROOT / original_path) == author['sourceManifestSha256'], 'Executed manifest baseline mismatch')
    before_files = {x['path']: x['sha256'] for x in read_json(original_path)['files']}
    after_files = {x['path']: x['sha256'] for x in stages['files']}
    require(before_files.keys() == after_files.keys(), 'Documentation rebind changed the generated file set')
    allowed_docs = {'app/lesson-bundles/stage-02/files/backend/README.md', 'reference/backend/README.md',
                    'reference/lesson-bundles/stage-02/files/backend/README.md',
                    'app/lesson-bundles/stage-02/manifest.json', 'reference/lesson-bundles/stage-02/manifest.json',
                    'reference/journey-state.json'}
    changed_docs = {f for f in before_files if before_files[f] != after_files[f]}
    require(changed_docs == set(rebind['changedFiles']) and changed_docs <= allowed_docs,
            'Documentation rebind contains unreviewed changes')
    require(len(before_files) - len(changed_docs) == rebind['unchangedGeneratedFileCount'], 'Wrong unchanged file count')
    reports[original_path] = digest(ROOT / original_path)
    debug_path = 'resources/project-journey/evidence/debug-wrong-fixed.json'
    debug = read_json(debug_path)
    cases = {x['label']: x for x in debug['cases']}
    require(debug['status'] == 'PASS_EXPECTED_ASSERTION_FAILURE_THEN_RESTORED'
            and cases['wrong']['exitCode'] != 0 and cases['wrong']['failed'] > 0
            and cases['restored']['exitCode'] == 0 and cases['restored']['failed'] == 0
            and debug['restoredExactly'] is True and debug['beforeSha256'] == debug['restoredSha256'],
            'Deliberate debugging exercise did not fail and restore as expected')
    require(debug['restoredSha256'] == digest(ROOT / 'resources/project-journey/reference/frontend/src/api/campus.ts'),
            'Restored debug source differs from packaged implementation')
    reports[debug_path] = digest(ROOT / debug_path)
    sql = read_json(f'{QA}/mysql-test-summary.json')
    require(sql['tests'] == 50 and all(sql[k] == 0 for k in ('failures', 'errors', 'skipped')), 'Incomplete real database test run')
    tx = {x['scenario']: x for x in read_json(f'{QA}/mysql-transaction-evidence.json')['scenarios']}
    require(set(tx) == {'owner_timeline_rollback','owner_concurrent_update','event_timeline_rollback','event_concurrent_notes'}, 'Missing transaction scenarios')
    for name in ('owner_timeline_rollback', 'event_timeline_rollback'):
        row = tx[name]; control = row['normalControl']; connections = row['connectionIds']
        require(row['httpStatus'] == 500 and row['faultHit'] and row['rowsAffectedBeforeFault'] == 1
                and row['masterSnapshotUnchanged'] and row['timelineSnapshotUnchanged']
                and row['versionBefore'] == row['versionAfterFailure']
                and row['timelineBefore'] == row['timelineAfterFailure']
                and len(set(connections.values())) == 4
                and control['httpStatus'] == 200 and control['version'] == row['versionBefore'] + 1
                and control['timeline'] == row['timelineBefore'] + 1, 'Rollback proof failed: ' + name)
    for name in ('owner_concurrent_update', 'event_concurrent_notes'):
        row = tx[name]
        require(sorted(row['statuses']) == [200,409] and row['timelineAdded'] == 1
                and len(set(row['mysqlConnections'])) == 2, 'Concurrent update proof failed: ' + name)
    snapshots = read_json(f'{QA}/mysql-snapshot-evidence.json')['scenarios']
    require({x['readMethod'] for x in snapshots} == {'campuses','owner','buildings','cases','alarmCase'}
            and all(x['readerIsolation'] == 'REPEATABLE-READ' and x['writerCommittedBetweenSelects']
                    and x['poolDefaultPreserved'] and x['readerConnectionId'] != x['writerConnectionId']
                    for x in snapshots), 'Incomplete read snapshot proof')
    for name in ('mysql-test-summary.json','mysql-transaction-evidence.json','mysql-snapshot-evidence.json'):
        relative = f'{QA}/{name}'
        reports[relative] = digest(ROOT / relative)
    app = read_json(REQUIRED[1])
    require(app.get('sourceFiles'), 'Application report must bind tested sources')
    verify_records(app['sourceFiles'], ROOT / 'resources/project-journey/reference', 'application sources')
    require(app['referenceBuildManifestSHA256'] == digest(ROOT / 'resources/project-journey/BUILD-MANIFEST.json'), 'Application manifest does not match package')
    require(app['passedGroups'] == 11 and app['failedGroups'] == 0 and len(app['results']) == 11
            and all(x['status'] == 'PASS' for x in app['results']) and app['pageErrors'] == [], 'Application UI checks incomplete')
    verify_records(app['evidenceArtifacts'], ROOT / QA, 'application evidence')
    verify_records(app['screenshots'], ROOT / QA, 'application screenshots')
    handoff = read_json(f'{QA}/handoff-verification.json')
    require(handoff['status'] == 'PASS' and handoff['allFileHashesMatch']
            and handoff['forbiddenPathCount'] == 0 and handoff['knownPasswordLeakCount'] == 0
            and all(handoff['preserved'].values()), 'Hand-in export verification failed')
    rebuild = read_json(f'{QA}/handoff-rebuild-summary.json')
    require(rebuild['status'] == 'PASS' and rebuild['newDirectoryBuildActuallyExecuted']
            and rebuild['frontend']['passed'] == 74 and rebuild['frontend']['failed'] == 0
            and rebuild['frontend']['typeCheck'] == 'PASS' and rebuild['frontend']['build'] == 'PASS'
            and rebuild['backend']['build'] == 'PASS' and rebuild['backend']['totals']['failures'] == 0
            and rebuild['backend']['totals']['errors'] == 0, 'Recipient-directory rebuild failed')
    frontend = app['testSummary']['frontend']
    require(frontend['status'] == 'PASS' and frontend['tests'] == 74 and frontend['passed'] == 74
            and frontend['failed'] == 0 and frontend['pending'] == 0 and frontend['typeCheck'] and frontend['build'],
            'Final frontend verification incomplete')
    require(app['cleanup']['status'] == 'PASS' and app['cleanup']['listenersRemaining'] == '', 'Dedicated author services not cleaned up')
    static_path = f'{QA}/static-review.json'
    static = read_json(static_path)
    require(static.get('status') == 'PASS_STATIC', 'Current offline static gate failed')
    verify_records(static['boundFiles'], ROOT, 'static source bindings')
    reports[static_path] = digest(ROOT / static_path)
    book = read_json('reading/index.build.json')
    require(digest(ROOT / 'reading/index.html') == book['sha256'], 'Original reader stale')
    verify_records(book['documents'], ROOT, 'original reader source')
    old = read_json('walkthroughs/build.json')
    require(digest(ROOT / 'walkthroughs/index.html') == old['sha256'], 'Reference walkthrough stale')
    verify_records(old['sources'], ROOT / 'walkthroughs', 'reference walkthrough source')
    for relative in ('journey/build.json','resources/project-journey/BUILD-MANIFEST.json','reading/index.build.json','walkthroughs/build.json'):
        reports[relative] = digest(ROOT / relative)
    return reports, book, 'PASS_STATIC', None


def known_passwords():
    """Read only course-local rehearsal passwords into memory; never print them."""
    folders = [ROOT / 'resources/campus-ai-course/.private']
    for runtime in (ROOT / '.runtime/round8-lab', ROOT / '.runtime/round9-lab', ROOT / '.runtime/round10-lab'):
        if not runtime.is_dir():
            continue
        for here, dirs, _ in os.walk(runtime, followlinks=False):
            dirs[:] = [name for name in dirs if name not in
                       {'node_modules', 'target', 'dist', '.git', '__pycache__'}
                       and not (Path(here) / name).is_symlink()]
            if Path(here).name == '.private':
                folders.append(Path(here))
                dirs[:] = []
    values = set()
    for folder in folders:
        for name in ('accounts.json', 'database.json', 'test-database.json'):
            file = folder / name
            if not file.is_file() or file.is_symlink():
                continue
            data = json.loads(file.read_text(encoding='utf-8-sig'))
            candidates = [data.get('password'), *[a.get('password') for a in data.get('accounts', [])]]
            for value in candidates:
                if isinstance(value, str) and value:
                    values.add(value.encode('utf-8'))
        cnf = folder / 'local-mysql-admin.cnf'
        if cnf.is_file() and not cnf.is_symlink():
            for line in cnf.read_text(encoding='utf-8-sig').splitlines():
                if line.strip().startswith('password='):
                    value = line.split('=', 1)[1].strip().strip('\"\'')
                    if value:
                        values.add(value.encode('utf-8'))
    return values


def no_known_password(path, passwords, label):
    overlap = max(map(len, passwords), default=1) - 1
    tail = b''
    with path.open('rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            window = tail + chunk
            require(not any(value in window for value in passwords), f'Known credential found in: {label}')
            tail = window[-overlap:] if overlap else b''


def excluded_path(relative, exclusions):
    parts = PurePosixPath(relative).parts
    name = parts[-1] if parts else ''
    return (any(part in exclusions for part in parts)
            or name == '.DS_Store' or name.lower().endswith(('.log', '.har'))
            or (name.startswith('.env') and name != '.env.example'))


class HtmlReferences(HTMLParser):
    def __init__(self):
        super().__init__(convert_charrefs=True)
        self.references = []
        self.ids = {}

    def handle_starttag(self, tag, attributes):
        for key, value in attributes:
            if value is None:
                continue
            if key == 'id':
                self.ids[value] = self.ids.get(value, 0) + 1
            if key in ('href', 'src'):
                self.references.append((tag, key, value))


def static_entries(extracted, book):
    cache, checks, external, historical = {}, [], [], []
    historical_refs = {warning.split('需原项目的参考链接：', 1)[1]
                       for warning in book.get('warnings', [])
                       if warning.startswith('需原项目的参考链接：')}

    def parsed(file):
        if file not in cache:
            parser = HtmlReferences()
            parser.feed(file.read_text(encoding='utf-8-sig'))
            cache[file] = parser
        return cache[file]

    for name in ENTRIES:
        page = inside_file(extracted, name)
        for tag, attribute, raw in parsed(page).references:
            require(raw.strip() or tag == 'a', f'Empty asset reference: {name}')
            uri = urlsplit(raw)
            if uri.scheme or uri.netloc:
                require(uri.scheme not in ('file', 'javascript'), f'Nonportable entry reference: {name}: {raw}')
                external.append({'from': name, 'reference': raw, 'status': 'NOT_REQUESTED'})
                continue
            target = (page.parent / unquote(uri.path)).resolve() if uri.path else page
            if not target.is_relative_to(extracted):
                require(name == 'reading/index.html' and raw in historical_refs,
                        f'Entry link escapes the extracted package: {name}: {raw}')
                historical.append({'from': name, 'reference': raw, 'status': 'HISTORICAL_REFERENCE_NOT_PACKAGED'})
                continue
            require(target.exists(), f'Broken extracted entry link: {name}: {raw}')
            if attribute == 'src':
                require(target.is_file() and target.stat().st_size > 0, f'Empty/missing entry asset: {name}: {raw}')
            anchor = unquote(uri.fragment)
            if anchor and target.suffix.lower() in ('.html', '.htm', '.svg'):
                require(parsed(target).ids.get(anchor) == 1, f'Missing/duplicate entry anchor: {name}: {raw}')
            checks.append({'from': name, 'reference': raw, 'target': target.relative_to(extracted).as_posix()})
    return {'status': 'PASS_STATIC', 'entries': ENTRIES, 'localReferences': len(checks),
            'externalReferencesNotRequested': external, 'historicalReferencesNotPackaged': historical,
            'browserUsed': False, 'networkUsed': False, 'javascriptExecuted': False}


def main():
    created = datetime.datetime.now(datetime.timezone.utc).isoformat()
    manifest_file = ROOT / MANIFEST_NAME
    archive_file = ROOT.parent / ARCHIVE_NAME
    hash_file = archive_file.with_suffix('.zip.sha256')
    report_file = ROOT.parent / f'AI编程_智慧校园_48学时_V{VERSION}_交付校验.json'
    document_report = ROOT / QA / 'document-checks.json'
    for file in (manifest_file, archive_file, hash_file, report_file, document_report):
        require(not file.exists(), f'Refuse to overwrite existing output/evidence: {file.name}')
    gate_reports, book, offline_status, manual = verify_gates()
    protected = verify_histories()

    document_report.parent.mkdir(parents=True, exist_ok=True)
    previous_args = sys.argv[:]
    try:
        sys.argv = ['check-delivery.py', '--output', f'{QA}/document-checks.json']
        namespace = runpy.run_path(str(ROOT / 'tools/check-delivery.py'))
    finally:
        sys.argv = previous_args
    require(namespace['report']['status'] == 'PASS', 'Document/credential checks failed; preserve the report')
    exclusions = set(namespace['EXCLUDE'])
    files = sorted(file for file in namespace['candidates']()
                   if file != manifest_file and not excluded_path(file.relative_to(ROOT).as_posix(), exclusions))
    passwords = known_passwords()
    records = []
    for file in files:
        relative = file.relative_to(ROOT).as_posix()
        require(not file.is_symlink() and file.resolve().is_relative_to(ROOT), f'Refuse linked source: {relative}')
        no_known_password(file, passwords, relative)
        records.append({'path': relative, 'bytes': file.stat().st_size, 'sha256': digest(file)})
    current = {record['path']: record['sha256'] for record in records}
    previous = {record['path']: record['sha256'] for record in read_json('delivery-manifest-v1.1.1.json')['files']}
    removed = sorted(set(previous) - set(current))
    require(not removed, f'Previously delivered files are missing: {removed}')
    manifest = {
        'version': VERSION, 'createdAt': created, 'entry': '先打开这里.html',
        'scope': 'CodeBuddy IDE twelve-stage campus journey; progressive frontend, reusable backend, expanded campus reading/workflow; old references preserved.',
        'changesSince': {'version': '1.1.1', 'changed': sorted(name for name in current
                        if name in previous and current[name] != previous[name]),
                        'added': sorted(set(current) - set(previous)), 'removed': removed},
        'excluded': sorted(exclusions) + ['*.log', '*.har', '.env except .env.example'],
        'historicalArchivesUnchanged': HISTORICAL, 'historicalProtectedFileCount': len(protected),
        'externalHistoricalReferences': namespace['report']['originalProjectReferenceLinks'],
        'gateReports': gate_reports, 'offlineStaticInputStatus': offline_status,
        'offlineManualConclusion': manual, 'limitations': LIMITATIONS, 'manifestExcludesItself': True,
        'files': records,
    }
    manifest_data = json_bytes(manifest)
    require(not any(value in manifest_data for value in passwords), 'Known credential found in generated manifest')
    run_root = ROOT / '.runtime' / f'package-v{VERSION}-{uuid.uuid4().hex}'
    run_root.mkdir(parents=True, exist_ok=False)
    staged_archive = run_root / ARCHIVE_NAME
    with zipfile.ZipFile(staged_archive, 'x', compression=zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for file in files:
            archive.write(file, (PurePosixPath(ROOT.name) / file.relative_to(ROOT).as_posix()).as_posix())
        archive.writestr(f'{ROOT.name}/{MANIFEST_NAME}', manifest_data)

    unzip_root = run_root / 'fresh-unzip'
    unzip_root.mkdir()
    expected_names = {f'{ROOT.name}/{item["path"]}' for item in records} | {f'{ROOT.name}/{MANIFEST_NAME}'}
    with zipfile.ZipFile(staged_archive) as archive:
        require(len(archive.namelist()) == len(expected_names), 'ZIP has duplicate or unexpected members')
        require(set(archive.namelist()) == expected_names, 'ZIP file set differs from the frozen manifest')
        require(archive.testzip() is None, 'ZIP CRC verification failed')
        for item in archive.infolist():
            name = PurePosixPath(item.filename)
            require(not name.is_absolute() and '..' not in name.parts, 'ZIP path traversal rejected')
            require(not stat.S_ISLNK(item.external_attr >> 16), 'ZIP symlink rejected')
            require(not excluded_path(name.relative_to(ROOT.name).as_posix(), exclusions), 'ZIP contains an excluded path')
        archive.extractall(unzip_root)
    extracted = unzip_root / ROOT.name
    require((extracted / MANIFEST_NAME).read_bytes() == manifest_data, 'Extracted manifest differs')
    for item in records:
        file = inside_file(extracted, item['path'])
        require(file.stat().st_size == item['bytes'] and digest(file) == item['sha256'],
                f'Extracted file hash mismatch: {item["path"]}')
        no_known_password(file, passwords, item['path'])
        require(digest(ROOT / item['path']) == item['sha256'], f'Source changed during packaging: {item["path"]}')
    static_result = static_entries(extracted, book)
    verify_histories()
    require(verify_gates()[0] == gate_reports, 'Gate reports or build metadata changed during packaging')
    archive_sha = digest(staged_archive)
    report = {
        'status': 'PASS', 'at': created, 'version': VERSION, 'archive': ARCHIVE_NAME,
        'bytes': staged_archive.stat().st_size, 'files': len(expected_names), 'sha256': archive_sha,
        'crcAndContentHashes': 'PASS', 'freshUnzipAllFileHashes': 'PASS',
        'freshUnzipDirectory': unzip_root.relative_to(ROOT).as_posix(),
        'entry': f'{ROOT.name}/先打开这里.html', 'staticEntryChecks': static_result,
        'documentChecks': f'{QA}/document-checks.json', 'currentGateReports': gate_reports,
        'historicalArchivesUnchanged': HISTORICAL, 'historicalReferenceAndChapterStartersUnchanged': True,
        'originalWordPdfPreserved': True, 'privatePathsExcluded': True, 'knownCredentialScan': 'PASS',
        'credentialScanScope': 'Course-local reference and round8/round9/round10 rehearsal passwords; not a universal secret detector.',
        'freshUnzipBrowserCheck': 'NOT_RUN_THIS_ROUND_STATIC_ONLY', 'limitations': LIMITATIONS,
    }
    report_data = json_bytes(report)
    require(not any(value in report_data for value in passwords), 'Known credential found in generated delivery report')
    # Publish only after all validations. Exclusive creation/hard-link prevents
    # replacing even a same-named output created by another process meanwhile.
    with manifest_file.open('xb') as handle:
        handle.write(manifest_data)
    os.link(staged_archive, archive_file)
    with hash_file.open('x', encoding='utf-8') as handle:
        handle.write(f'{archive_sha}  {ARCHIVE_NAME}\n')
    with report_file.open('xb') as handle:
        handle.write(report_data)
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (RuntimeError, OSError, ValueError, KeyError) as error:
        print(f'PACKAGING STOPPED: {error}', file=sys.stderr)
        sys.exit(1)
