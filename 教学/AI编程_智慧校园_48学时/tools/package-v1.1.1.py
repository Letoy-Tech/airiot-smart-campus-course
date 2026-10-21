"""Package V1.1.1 only after round-9 gates; never run a browser or replace evidence.

Run from any directory: python3 tools/package-v1.1.1.py
This script does not rebuild HTML or rerun application/database tests. A fresh ZIP
is extracted under .runtime and inspected as files, without file:// navigation.
If offline-static.json needs human review, provide offline-manual-review.json
with status=PASS, reviewer, conclusion, sourceReport, sourceReportSha256 and
browserUsed=false. The source report must be the current round-9 static report.
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
VERSION = '1.1.1'
QA = 'walkthroughs/qa/round9'
MANIFEST_NAME = f'delivery-manifest-v{VERSION}.json'
ARCHIVE_NAME = f'AI编程_智慧校园_48学时_V{VERSION}_完整教学包.zip'
HISTORICAL = {
    'AI编程_智慧校园_48学时_V1.0.2_完整教学包.zip':
        '1083e348cca3085b802f04c76971635883af65c58324e323d82244039206c1d5',
    'AI编程_智慧校园_48学时_V1.1.0_完整教学包.zip':
        '625042673d2f3da39ab2b889e17a22495e25cee870725e37de176dbd5429ee87',
}
REQUIRED = [
    f'{QA}/student-files.json',
    *[f'{QA}/http/{phase}.json' for phase in
      ('first', 'restart', 'locations', 'console', 'catalog', 'workflow', 'pagination')],
    f'{QA}/full-api/verification.json',
    f'{QA}/lab-browser/verification.json',
    f'{QA}/handoff.json',
    f'{QA}/author-verification.json',
]
ENTRIES = [
    '先打开这里.html', 'index.html', 'walkthroughs/index.html', 'reading/index.html',
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
    require(read_json('course-index.json')['version'] == VERSION, 'course-index version is not 1.1.1')
    reports = {'course-index.json': digest(ROOT / 'course-index.json')}
    for relative in REQUIRED:
        value = read_json(relative)
        require(value.get('status') == 'PASS', f'Round-9 evidence is not PASS: {relative}')
        reports[relative] = digest(ROOT / relative)
    build = read_json('walkthroughs/build.json')
    require(digest(ROOT / 'walkthroughs/index.html') == build.get('sha256'), 'Walkthrough HTML is stale')
    verify_records(build.get('sources'), ROOT / 'walkthroughs', 'walkthroughs/build.json')
    require(len(build['sources']) == 13, 'Expected 13 walkthrough source documents')
    book = read_json('reading/index.build.json')
    require(digest(ROOT / 'reading/index.html') == book.get('sha256'), 'Reading HTML is stale')
    verify_records(book.get('documents'), ROOT, 'reading/index.build.json')
    for relative in ('walkthroughs/build.json', 'reading/index.build.json'):
        reports[relative] = digest(ROOT / relative)

    offline_path = f'{QA}/offline-static.json'
    offline = read_json(offline_path)
    require(offline.get('status') in ('PASS', 'PASS_STATIC', 'REVIEW_REQUIRED'), 'Offline static gate failed')
    require(offline.get('errors') == [], 'Offline static errors must be empty')
    require(offline.get('browserUsed') is False, 'Round-9 offline check must not use a browser')
    require(offline.get('networkUsed') is False, 'Round-9 offline check must not access the network')
    verify_records(offline.get('sources'), ROOT, offline_path)
    verify_records(offline.get('entries'), ROOT, offline_path)
    reports[offline_path] = digest(ROOT / offline_path)
    manual = None
    if offline['status'] == 'REVIEW_REQUIRED':
        manual_path = f'{QA}/offline-manual-review.json'
        manual = read_json(manual_path)
        require(manual.get('status') == 'PASS', 'Manual offline conclusion is not PASS')
        require(manual.get('sourceReport') == offline_path, 'Manual review cites a different static report')
        require(manual.get('sourceReportSha256') == reports[offline_path], 'Manual review is stale')
        require(all(isinstance(manual.get(key), str) and manual[key].strip()
                    for key in ('reviewer', 'conclusion')), 'Manual review needs reviewer and explicit conclusion')
        require(manual.get('browserUsed') is False, 'Manual conclusion must not claim offline browser testing')
        reports[manual_path] = digest(ROOT / manual_path)
    author = read_json(f'{QA}/author-verification.json')
    if 'studentSourceFiles' in author:
        verify_records(author['studentSourceFiles'], ROOT / 'resources/student-project', 'author student source')
    # Old browser reports remain historical artifacts. Their HTML hashes are NOT
    # compared with the newly generated HTML; this round has a static-only gate.
    return reports, book, offline['status'], manual


def known_passwords():
    """Read only course-local rehearsal passwords into memory; never print them."""
    folders = [ROOT / 'resources/campus-ai-course/.private']
    for runtime in (ROOT / '.runtime/round8-lab', ROOT / '.runtime/round9-lab'):
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
    previous = {record['path']: record['sha256'] for record in read_json('delivery-manifest-v1.1.0.json')['files']}
    removed = sorted(set(previous) - set(current))
    require(not removed, f'Previously delivered files are missing: {removed}')
    manifest = {
        'version': VERSION, 'createdAt': created, 'entry': '先打开这里.html',
        'scope': 'Round-9 beginner walkthrough revisions and continuous student project; retained original reference/plans.',
        'changesSince': {'version': '1.1.0', 'changed': sorted(name for name in current
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
        'documentChecks': f'{QA}/document-checks.json', 'round9GateReports': gate_reports,
        'historicalArchivesUnchanged': HISTORICAL, 'historicalReferenceAndChapterStartersUnchanged': True,
        'originalWordPdfPreserved': True, 'privatePathsExcluded': True, 'knownCredentialScan': 'PASS',
        'credentialScanScope': 'Course-local reference and round8/round9 rehearsal passwords; not a universal secret detector.',
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
