"""Freeze the complete hands-on teaching package without replacing prior archives."""
from pathlib import Path
import datetime, hashlib, json, runpy, sys, zipfile
ROOT=Path(__file__).resolve().parents[1]
VERSION='1.1.0'
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda p:json.loads((ROOT/p).read_text())
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
assert read('course-index.json')['version']==VERSION
required=['walkthroughs/qa/continuous-project.json','walkthroughs/qa/chapter-guard.json',
          'walkthroughs/qa/round8-full-api/verification.json','walkthroughs/qa/round8-lab-browser/verification.json',
          'walkthroughs/qa/entry/verification.json','walkthroughs/qa/author-verification.json',
          'illustrations/qa/round8-book/verification.json']
for p in required:assert read(p)['status']=='PASS',p
assert read('walkthroughs/qa/verification.json')['passed'] is True
build=read('walkthroughs/build.json')
assert build['sha256']==sha((ROOT/'walkthroughs/index.html').read_bytes())
assert read('walkthroughs/qa/verification.json')['inputSha256']==build['sha256']
for item in build['sources']:assert sha((ROOT/'walkthroughs'/item['file']).read_bytes())==item['sha256'],item['file']
book=read('reading/index.build.json')
assert sha((ROOT/'reading/index.html').read_bytes())==book['sha256']
for item in book['documents']:assert sha((ROOT/item['file']).read_bytes())==item['sha256'],item['file']
assert read('illustrations/qa/round8-book/verification.json')['inputSha256']==book['sha256']
for item in read('walkthroughs/qa/entry/verification.json')['checks']:
    assert sha((ROOT/item['file']).read_bytes())==item['sha256'],item['file']
for item in read('walkthroughs/qa/author-verification.json')['studentSourceFiles']:
    assert sha((ROOT/'resources/student-project'/item['path']).read_bytes())==item['sha256'],item['path']
historical={'AI编程_智慧校园_48学时_V1.0.2_完整教学包.zip':'1083e348cca3085b802f04c76971635883af65c58324e323d82244039206c1d5'}
for name,digest in historical.items():assert sha((ROOT.parent/name).read_bytes())==digest,name
previous={f['path']:f['sha256'] for f in read('delivery-manifest-v1.0.2.json')['files']}
for name,digest in previous.items():
    if name.startswith(('resources/student-chapters/','resources/campus-ai-course/')) or name.endswith(('.docx','.pdf')):
        assert sha((ROOT/name).read_bytes())==digest,'Historical source changed: '+name
sys.argv=['check-delivery.py','--output','walkthroughs/qa/round8-document-checks.json']
ns=runpy.run_path(str(ROOT/'tools/check-delivery.py'));assert ns['report']['status']=='PASS'
manifest=ROOT/f'delivery-manifest-v{VERSION}.json'
files=sorted(f for f in ns['candidates']() if f!=manifest)
current={str(f.relative_to(ROOT)):sha(f.read_bytes()) for f in files}
changed=sorted(p for p in current if p in previous and current[p]!=previous[p])
added=sorted(p for p in current if p not in previous)
removed=sorted(p for p in previous if p not in current)
assert not removed,removed
manifest.write_text(json.dumps({'version':VERSION,'createdAt':now,'entry':'先打开这里.html',
    'scope':'13 hands-on walkthroughs, continuous student project, teacher lesson mapping, retained original reference and formal plans.',
    'changesSince':{'version':'1.0.2','changed':changed,'added':added,'removed':removed},
    'excluded':sorted(ns['EXCLUDE'])+['*.log','.env except .env.example'],
    'historicalArchivesUnchanged':historical,
    'externalHistoricalReferences':ns['report']['originalProjectReferenceLinks'],
    'files':[{'path':p,'bytes':(ROOT/p).stat().st_size,'sha256':d} for p,d in current.items()]},ensure_ascii=False,indent=2)+'\n')
files.append(manifest)
archive=ROOT.parent/f'AI编程_智慧校园_48学时_V{VERSION}_完整教学包.zip'
if archive.exists():raise RuntimeError('Refuse to overwrite existing archive')
with zipfile.ZipFile(archive,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6) as z:
    for f in files:z.write(f,str(f.relative_to(ROOT.parent)))
with zipfile.ZipFile(archive) as z:
    assert z.testzip() is None
    for f in files:assert sha(z.read(str(f.relative_to(ROOT.parent))))==sha(f.read_bytes()),str(f)
digest=sha(archive.read_bytes());archive.with_suffix('.zip.sha256').write_text(digest+'  '+archive.name+'\n')
report={'status':'PASS','at':now,'version':VERSION,'archive':archive.name,'bytes':archive.stat().st_size,
    'files':len(files),'sha256':digest,'crcAndContentHashes':'PASS','entry':'AI编程_智慧校园_48学时/先打开这里.html',
    'walkthroughs':13,'codingDebugTestDeliverySteps':59,'links':ns['report']['links'],
    'historicalV102ArchiveUnchanged':True,'historicalReferenceAndChapterStartersUnchanged':True,
    'privateFilesExcluded':True,'classroomTrial':False,'windowsPhysicalMachine':False,
    'originalWordPdfPreserved':True,'freshUnzipBrowserCheck':'pending separate check'}
(ROOT.parent/f'AI编程_智慧校园_48学时_V{VERSION}_交付校验.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
