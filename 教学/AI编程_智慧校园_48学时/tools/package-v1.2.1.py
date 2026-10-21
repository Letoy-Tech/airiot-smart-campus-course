"""Freeze V1.2.1, verify both fresh extractions, then publish new archives only.

The author reference fixture, app UI and same-operator handoff are separate gates.
No browser, shared server or cloud provider is opened by this packager.
"""
from pathlib import Path, PurePosixPath
import datetime
import hashlib
import importlib.util
import json
import os
import runpy
import stat
import subprocess
import sys
import uuid
import zipfile

ROOT = Path(__file__).resolve().parents[1]
VERSION = '1.2.1'
QA = 'journey/qa/student-feedback-v121'
MANIFEST = f'delivery-manifest-v{VERSION}.json'
FULL = f'AI编程_智慧校园_48学时_V{VERSION}_完整教学包.zip'
STARTER = f'AI编程_CodeBuddy学生起点_V{VERSION}.zip'
PRIVATE_DIRS = [f'.runtime/student-feedback-v121/{part}/app/.private'
                for part in ('stage-build', 'handoff')]
spec = importlib.util.spec_from_file_location('previous_packager', ROOT/'tools/package-v1.2.0.py')
old = importlib.util.module_from_spec(spec)
spec.loader.exec_module(old)
require, digest, inside_file = old.require, old.digest, old.inside_file
read_json, verify_records = old.read_json, old.verify_records
json_bytes = old.json_bytes


def gates():
    require(read_json('course-index.json')['version'] == VERSION, 'Wrong course version')
    build = read_json('resources/project-journey/BUILD-MANIFEST.json')
    require(build['version'] == VERSION and build['pending'] == [], 'Generated project incomplete')
    verify_records(build['files'], ROOT/'resources/project-journey', 'generated project')
    verify_records(build['sourceFiles'], ROOT/'resources/student-project', 'canonical student project')
    verify_records(build['authoringSources'], ROOT, 'authoring sources')
    author = read_json(f'{QA}/build/author-verification.json')
    executed_path = f'{QA}/build/executed-source-manifest.json'
    require(digest(ROOT/executed_path) == author['sourceManifestSha256'], 'Executed manifest changed')
    require(author['status'] == 'PASS_SOURCE_BUILD_CHECKS'
            and len(author['stages']) == 12
            and {s['stage'] for s in author['stages']} == set(range(1, 13))
            and all(s['exitCode'] == 0 and s['settingsPreserved']
                    and s['referenceImportedByAuthorFixture'] for s in author['stages'])
            and author['backend']['exitCode'] == 0
            and author['backendWithUnfinishedFrontend']['exitCode'] == 0,
            'Twelve-stage author fixture failed')
    rebind_path = f'{QA}/build/documentation-rebind-final.json'
    rebind = read_json(rebind_path)
    require(rebind['status'] == 'PASS_DOCUMENTATION_ONLY_REBIND'
            and rebind['runtimeCodeChanged'] is False
            and rebind['executedSourceManifestSha256'] == author['sourceManifestSha256']
            and rebind['finalSourceManifestSha256'] == digest(ROOT/'resources/project-journey/BUILD-MANIFEST.json'),
            'Source/evidence rebind mismatch')
    before = read_json(executed_path)
    prior = {x['path']: x['sha256'] for x in before['files']}
    final = {x['path']: x['sha256'] for x in build['files']}
    require(prior.keys() == final.keys(), 'Generated file set changed after execution')
    changed = sorted(p for p in prior if prior[p] != final[p])
    require(changed == rebind['changedGeneratedFiles']
            and all(p.endswith('.md') for p in changed), 'Runtime output changed after execution')
    for key, allowed in [('sourceFiles', {'README.md'}),
                         ('authoringSources', {'tools/build-progress-project.mjs'})]:
        a = {x['path']: x['sha256'] for x in before[key]}
        b = {x['path']: x['sha256'] for x in build[key]}
        require(a.keys() == b.keys() and {p for p in a if a[p] != b[p]} <= allowed,
                'Unreviewed source change after execution: '+key)
    verification = read_json(f'{QA}/verification.json')
    require(verification['status'] == 'PASS'
            and verification['currentBuildManifestSHA256'] == digest(ROOT/'resources/project-journey/BUILD-MANIFEST.json')
            and verification['tools'] == {'passed': 20, 'failed': 0, 'skipped': 0}
            and verification['frontend']['passed'] == 79 and verification['frontend']['failed'] == 0
            and verification['mysql'] == {'tests': 50, 'failures': 0, 'errors': 0, 'skipped': 0}
            and all(x['status'] == 'PASS' for x in verification['browserChecks'])
            and verification['handoff']['status'] == 'PASS'
            and verification['handoff']['newDirectoryBuildActuallyExecuted']
            and verification['handoff']['freshAccounts'] and verification['handoff']['freshPhysicalDatabase']
            and verification['handoff']['frontendPassed'] == 79
            and verification['handoff']['closedVersion'] == 7
            and verification['cleanup']['listenersRemaining'] == [], 'Current execution gates incomplete')
    verify_records(verification['testedRuntimeFiles'], ROOT/'resources/project-journey/reference', 'tested app sources')
    verify_records(verification['artifacts'], ROOT/QA, 'execution evidence')
    mysql = read_json(f'{QA}/runtime/mysql-test-summary.json')
    require(mysql['totals'] == verification['mysql'], 'MySQL summary mismatch')
    tx = read_json(f'{QA}/runtime/mysql-transaction-evidence.json')['scenarios']
    require(len(tx) == 4 and all(x.get('masterSnapshotUnchanged', True)
            and x.get('timelineSnapshotUnchanged', True) for x in tx), 'Transaction evidence incomplete')
    snapshots = read_json(f'{QA}/runtime/mysql-snapshot-evidence.json')['scenarios']
    require(len(snapshots) == 5 and all(x['readerIsolation'] == 'REPEATABLE-READ'
            and x['writerCommittedBetweenSelects'] and x['poolDefaultPreserved'] for x in snapshots),
            'Snapshot evidence incomplete')
    static_path = f'{QA}/static-final/static-review.json'
    static = read_json(static_path)
    require(static['status'] == 'PASS_STATIC' and static['findings'] == [], 'Static document gate failed')
    verify_records(static['boundFiles'], ROOT, 'static source bindings')
    journey = read_json('journey/build.json')
    require(journey['stations'] == 12 and digest(ROOT/'journey/index.html') == journey['sha256'], 'Journey stale')
    verify_records(journey['sources'], ROOT, 'journey sources')
    book = read_json('reading/index.build.json')
    require(digest(ROOT/'reading/index.html') == book['sha256'], 'Original reader stale')
    verify_records(book['documents'], ROOT, 'reader sources')
    walkthrough = read_json('walkthroughs/build.json')
    require(digest(ROOT/'walkthroughs/index.html') == walkthrough['sha256'], 'Walkthrough stale')
    verify_records(walkthrough['sources'], ROOT/'walkthroughs', 'walkthrough sources')
    paths = ['course-index.json','resources/project-journey/BUILD-MANIFEST.json',
             'journey/build.json','reading/index.build.json','walkthroughs/build.json',
             f'{QA}/verification.json',f'{QA}/build/author-verification.json',
             executed_path,rebind_path,static_path]
    return {p:digest(ROOT/p) for p in paths}, book, verification['limitations']


def extract_and_verify(archive_path, root_name, records, manifest_name, manifest_data, destination, exclusions, passwords):
    expected = {root_name+'/'+x['path'] for x in records} | {root_name+'/'+manifest_name}
    with zipfile.ZipFile(archive_path) as z:
        require(len(z.namelist()) == len(expected) and set(z.namelist()) == expected, 'ZIP members differ')
        require(z.testzip() is None, 'ZIP CRC failed')
        for item in z.infolist():
            p = PurePosixPath(item.filename)
            require(not p.is_absolute() and '..' not in p.parts and p.parts[0] == root_name,
                    'ZIP path traversal rejected')
            require(not stat.S_ISLNK(item.external_attr >> 16), 'ZIP symlink rejected')
            require(not old.excluded_path(p.relative_to(root_name).as_posix(), exclusions), 'Excluded ZIP member')
        z.extractall(destination)
    base = destination/root_name
    require((base/manifest_name).read_bytes() == manifest_data, 'Extracted manifest differs')
    for item in records:
        p = inside_file(base,item['path'])
        require(p.stat().st_size == item['bytes'] and digest(p) == item['sha256'], 'Extracted content mismatch')
        old.no_known_password(p,passwords,item['path'])
    return base


def main():
    report_name = f'AI编程_智慧校园_48学时_V{VERSION}_交付校验.json'
    outputs = [ROOT/MANIFEST,ROOT.parent/FULL,ROOT.parent/STARTER,ROOT.parent/report_name,
               ROOT.parent/(FULL+'.sha256'),ROOT.parent/(STARTER+'.sha256')]
    require(not any(p.exists() for p in outputs), 'Refuse to overwrite existing release outputs')
    gate_hashes,book,limitations = gates()
    protected = old.verify_histories()
    old120 = 'AI编程_智慧校园_48学时_V1.2.0_完整教学包.zip'
    require(digest(ROOT.parent/old120) == '1b1b9d5c77a501521cbf4b495369dc00f7fe6c72a28a5e03b44f889ace7ed720',
            'Historical V1.2.0 archive changed')
    run = ROOT/'.runtime'/('package-v1.2.1-'+uuid.uuid4().hex)
    run.mkdir(parents=True)
    saved = sys.argv[:]
    try:
        sys.argv = ['check-delivery.py','--output',str((run/'document-checks.json').relative_to(ROOT))]
        for p in PRIVATE_DIRS:sys.argv += ['--additional-private',p]
        checks = runpy.run_path(str(ROOT/'tools/check-delivery.py'))
    finally:sys.argv = saved
    require(checks['report']['status'] == 'PASS', 'Document/known credential checks failed')
    exclusions = set(checks['EXCLUDE'])
    passwords = set(checks['secrets']) | old.known_passwords()
    records,files = [],[]
    for p in sorted(checks['candidates']()):
        rel = p.relative_to(ROOT).as_posix()
        if rel == MANIFEST or old.excluded_path(rel,exclusions):continue
        require(not p.is_symlink() and p.resolve().is_relative_to(ROOT), 'Linked course source rejected')
        old.no_known_password(p,passwords,rel)
        records.append({'path':rel,'bytes':p.stat().st_size,'sha256':digest(p)})
        files.append(p)
    current = {x['path']:x['sha256'] for x in records}
    previous = {x['path']:x['sha256'] for x in read_json('delivery-manifest-v1.2.0.json')['files']}
    removed = sorted(set(previous)-set(current))
    relocated = []
    for name in removed:
        # V1.2.1 introduces existing tests at the relevant feature station.
        # A removed stage-11 copy must have one byte-identical earlier copy.
        require('/lesson-bundles/stage-11/files/frontend/src/tests/' in name,
                'Previously delivered file missing: '+name)
        prefix,tail = name.split('/stage-11/',1)
        matches = [p for p in current if p.startswith(prefix+'/stage-')
                   and p.endswith('/'+tail) and '/stage-11/' not in p
                   and current[p] == previous[name]]
        require(len(matches) == 1, 'Earlier test relocation not proven: '+name)
        relocated.append({'from':name,'to':matches[0],'sha256':previous[name]})
    manifest = {'version':VERSION,'createdAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),
                'entry':'先打开这里.html','scope':'学生实做反馈修订；环境、逐站组装、源码交付',
                'changesSince':{'version':'1.2.0','changed':sorted(p for p in current if p in previous and current[p]!=previous[p]),
                                'added':sorted(set(current)-set(previous)),'removed':removed,
                                'byteIdenticalTestsIntroducedEarlier':relocated},
                'excluded':sorted(exclusions)+['*.log','*.har','.env except .env.example'],
                'gateReports':gate_hashes,'historicalProtectedFileCount':len(protected),
                'limitations':limitations,'manifestExcludesItself':True,'files':records}
    data = json_bytes(manifest)
    full = run/FULL
    with zipfile.ZipFile(full,'x',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for p in files:z.write(p,ROOT.name+'/'+p.relative_to(ROOT).as_posix())
        z.writestr(ROOT.name+'/'+MANIFEST,data)
    full_base = extract_and_verify(full,ROOT.name,records,MANIFEST,data,run/'full-unzip',exclusions,passwords)
    entry_check = old.static_entries(full_base,book)
    generated = read_json('resources/project-journey/BUILD-MANIFEST.json')
    starter_records = [{'path':x['path'],'bytes':x['bytes'],'sha256':x['sha256']}
                       for x in generated['files'] if x['path'].startswith('app/')]
    readme = ('# CodeBuddy学生起点 V1.2.1\n\n整份复制app到自己的目录，从app/README.md开始。'
              '仅第01站已准备，后续依教程begin；不能直接把起点当最终作业。'
              'Node 22.21.1；第02站起用JDK17，并同时设置JAVA_HOME和PATH。'
              '先doctor-env，init，再build-backend；待业务完成再完整build。'
              '第03站起由教师提供独立数据库及迁移步骤；不含任何账号、API Key或数据库密码。'
              '不依赖Git。实际使用模型与未验证项自己记录。\n\n'
              'lesson-bundles是逐站教学材料；最终作业请用hand-in，自动排除答案和.codebuddy。'
              '完整教程、作者修订报告及验收边界在另发的V1.2.1完整教学包。\n').encode()
    starter_records.append({'path':'README.md','bytes':len(readme),'sha256':hashlib.sha256(readme).hexdigest()})
    starter_manifest = json_bytes({'version':VERSION,'scope':'第01站起点与12站教学素材；非学生完成品',
                                   'sourceManifestSHA256':digest(ROOT/'resources/project-journey/BUILD-MANIFEST.json'),
                                   'excluded':sorted(exclusions),'files':starter_records})
    starter = run/STARTER
    with zipfile.ZipFile(starter,'x',zipfile.ZIP_DEFLATED,compresslevel=6) as z:
        for x in starter_records:
            if x['path'] == 'README.md':z.writestr('campus-ai-lab/README.md',readme)
            else:z.write(ROOT/'resources/project-journey'/x['path'],'campus-ai-lab/'+x['path'])
        z.writestr('campus-ai-lab/STARTER-MANIFEST.json',starter_manifest)
    starter_base = extract_and_verify(starter,'campus-ai-lab',starter_records,'STARTER-MANIFEST.json',starter_manifest,
                                      run/'starter-unzip',exclusions,passwords)
    app = starter_base/'app'
    require(sys.platform == 'darwin', 'This bootstrap runner is macOS; do not claim Windows')
    env = os.environ.copy()
    logs = run/'starter-bootstrap';logs.mkdir()
    bootstrap = []
    commands = [('npm-ci',['npm','ci','--no-audit','--no-fund'],app/'frontend'),
                ('stage-01-verify',['node','tools/progress.mjs','verify'],app),
                ('begin-02',['node','tools/progress.mjs','begin','02'],app),
                ('doctor-env',['node','tools/course.mjs','doctor-env'],app),
                ('init',['node','tools/course.mjs','init'],app),
                ('build-backend-unfinished-front',['node','tools/course.mjs','build-backend'],app)]
    for label,cmd,cwd in commands:
        with (logs/(label+'.txt')).open('w') as f:
            code = subprocess.run(cmd,cwd=cwd,env=env,stdout=f,stderr=subprocess.STDOUT).returncode
        bootstrap.append({'label':label,'exitCode':code,'log':str((logs/(label+'.txt')).relative_to(ROOT)),
                          'logSHA256':digest(logs/(label+'.txt'))})
        print(label,code,flush=True)
        require(code == 0, 'Fresh starter bootstrap failed: '+label)
    require(all(digest(ROOT/x['path']) == x['sha256'] for x in records), 'Source changed during packaging')
    require(gates()[0] == gate_hashes, 'Verification bindings changed during packaging')
    old.verify_histories()
    report = {'status':'PASS','version':VERSION,'full':{'archive':FULL,'bytes':full.stat().st_size,'sha256':digest(full),
              'files':len(records)+1,'allExtractedHashesMatch':True,'staticEntryChecks':entry_check},
              'starter':{'archive':STARTER,'bytes':starter.stat().st_size,'sha256':digest(starter),
              'files':len(starter_records)+1,'allExtractedHashesMatch':True,'freshExtractionBootstrap':bootstrap},
              'documentChecks':checks['report'],'currentGateReports':gate_hashes,'privatePathsExcluded':True,
              'knownCredentialScan':'PASS','credentialScanScope':'本课程历史及本轮两个隔离目录的已知密码；不是通用秘密识别器',
              'historicalArchivesUnchanged':{**old.HISTORICAL,old120:digest(ROOT.parent/old120)},
              'originalWordPdfAndLegacySourcesPreserved':True,'browserUsedByPackager':False,'limitations':limitations}
    report_data = json_bytes(report)
    require(not any(s and (s in data or s in starter_manifest or s in report_data) for s in passwords), 'Credential in metadata')
    # Exclusive publication: previous versions and same-named outputs are never overwritten.
    with (ROOT/MANIFEST).open('xb') as f:f.write(data)
    for path in (full,starter):
        os.link(path,ROOT.parent/path.name)
        with (ROOT.parent/(path.name+'.sha256')).open('x') as f:f.write(digest(path)+'  '+path.name+'\n')
    with (ROOT.parent/report_name).open('xb') as f:f.write(report_data)
    print(json.dumps({'status':'PASS','full':report['full'],'starter':{k:v for k,v in report['starter'].items()
          if k!='freshExtractionBootstrap'},'starterBootstrap':'PASS'},ensure_ascii=False,indent=2))


if __name__ == '__main__':
    try:main()
    except (RuntimeError,OSError,ValueError,KeyError) as e:
        print('PACKAGING STOPPED: '+str(e),file=sys.stderr)
        sys.exit(1)
