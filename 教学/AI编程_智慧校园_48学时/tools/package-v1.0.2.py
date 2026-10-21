"""Package the round6 reader changes as V1.0.2, preserving all previously delivered archives."""
from pathlib import Path
import json,hashlib,datetime,zipfile,runpy,sys
ROOT=Path(__file__).resolve().parent.parent
VERSION='1.0.2';PREVIOUS='1.0.1'
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda p:json.loads((ROOT/p).read_text())
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
# 本轮新检查；工程、学生起点与教案未改，沿用第五轮结果（下方另核文件未变）。
for p in ['illustrations/qa/round6-book/verification.json','illustrations/qa/round6-standalone/verification.json','illustrations/qa/round6-resources/verification.json','resources/student-chapters/verification.json','resources/campus-ai-course/evidence/verification-v1.0.1.json','lesson-plans/qa/round5-final-artifacts.json','lesson-plans/qa/round5-html/html-verification.json']:
 assert read(p)['status'].startswith('PASS'),p
assert read('course-index.json')['version']==VERSION
for name in ['index',f'AI编程图文教程_V{VERSION}_单文件']:
 p=ROOT/'reading'/f'{name}.html';build=json.loads(p.with_suffix('.build.json').read_text());assert build['sha256']==sha(p.read_bytes())
 for doc in build['documents']:assert sha((ROOT/doc['file']).read_bytes())==doc['sha256'],doc['file']
for r in ['round6-book','round6-standalone']:
 v=read(f'illustrations/qa/{r}/verification.json');assert sha((ROOT/v['input']).read_bytes())==v['inputSha256'],r
for f in read('lesson-plans/qa/round5-final-artifacts.json')['files']:assert sha((ROOT/'lesson-plans'/f['path']).read_bytes())==f['sha256']
historical={'AI编程_智慧校园_48学时_V1.0.1_完整教学包.zip':'01293e3a0b621b99fbf21fd5a99ff0b13ba70235040400c5e8fbba55be893ec3','AI编程_第04至12章学生起点_V1.0.1.zip':'090be44dd96202f590acf25ef8037ee443ace602c92c75d4fd5b02984ac83117','AI编程_智慧校园_48学时_V1.0_完整教学包.zip':'eff074912bf6be4b732495594864bd8af69f03d72fd2b48a9c9960c1ffdc813d','AI编程_第04至12章学生起点_V1.0.zip':'04199e880e368822991e039409409605759afa682c9cdeece095102e554cf695','AI编程_智慧校园_48学时_V0.4_图文与起步资源.zip':'5fed671bc57f43b798ee51492183b107444d9bdede976489d9e951710ef59589','AI编程_第04章学生起点_V0.4.zip':'243d58992e1b3b6c1d8a43eea141f4de6ae21c810a63530403c428ce4bc68092','AI编程_智慧校园_48学时_V0.3_第二轮图文稿.zip':'a99c196b9f16d36510358a3fced8d2487efe8e804e74deff5f9e0131db3fb184'}
for name,digest in historical.items():assert sha((ROOT.parent/name).read_bytes())==digest,name
previous={f['path']:f['sha256'] for f in read(f'delivery-manifest-v{PREVIOUS}.json')['files']}
for path,digest in previous.items():
 if path.startswith('reading/AI编程图文') or path.startswith('resources/student-chapters/'):
  assert sha((ROOT/path).read_bytes())==digest,path
sys.argv=['check-delivery.py','--output','illustrations/qa/round6-document-checks.json']
ns=runpy.run_path(str(ROOT/'tools/check-delivery.py'));assert ns['report']['status']=='PASS'
manifest=ROOT/f'delivery-manifest-v{VERSION}.json'
files=sorted(f for f in ns['candidates']() if f!=manifest)
current={str(f.relative_to(ROOT)):sha(f.read_bytes()) for f in files}
changed=sorted(p for p in current if p in previous and current[p]!=previous[p])
added=sorted(p for p in current if p not in previous)
removed=sorted(p for p in previous if p not in current)
expectedChanged={'01-课程大纲.md','README.md','course-index.json','manuscript/05-后端空间与设备接口.md','manuscript/06-前端设备台账与自主UI.md','manuscript/07-实时监测历史与数据质量.md','manuscript/08-登录角色与权限验证.md','reading/index.build.json','reading/index.html','resources/index.html','tools/build-reader.mjs','tools/reader.css','tools/verify-reader.mjs','tools/配图与阅读版说明.md'}
expectedAdded={f'delivery-manifest-v{PREVIOUS}.json',f'reading/AI编程图文教程_V{VERSION}_单文件.build.json',f'reading/AI编程图文教程_V{VERSION}_单文件.html','tools/reader.js','tools/package-v1.0.2.py','13-第六轮阅读版优化验收.md','illustrations/qa/round6-document-checks.json'}
unexpected=[p for p in changed if p not in expectedChanged]+[p for p in added if p not in expectedAdded and not p.startswith(('illustrations/qa/round6-book/','illustrations/qa/round6-standalone/','illustrations/qa/round6-resources/'))]
assert not removed and not unexpected,(removed,unexpected)
manifest.write_text(json.dumps({'version':VERSION,'createdAt':now,'scope':'Round6 reader navigation and Markdown emphasis fixes on top of V1.0.1; reference project, student checkpoints and lesson plans unchanged. Classroom and real school/AIRIOT acceptance remain pending.','changesSince':{'version':PREVIOUS,'changed':changed,'added':added,'removed':removed},'studentCheckpointsArchive':{'file':f'AI编程_第04至12章学生起点_V{PREVIOUS}.zip','reason':'student-chapters unchanged since V1.0.1; no new student archive'},'excluded':sorted(ns['EXCLUDE'])+['*.log','lesson PDF render PNG intermediates','author fontconfig'],'historicalArchivesUnchanged':historical,'files':[{'path':p,'bytes':(ROOT/p).stat().st_size,'sha256':d}for p,d in current.items()]},ensure_ascii=False,indent=2)+'\n')
files.append(manifest)
name=f'AI编程_智慧校园_48学时_V{VERSION}_完整教学包.zip';p=ROOT.parent/name
if p.exists():raise RuntimeError('Refuse to overwrite existing archive: '+name)
with zipfile.ZipFile(p,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6)as z:
 for f in files:z.write(f,str(f.relative_to(ROOT.parent)))
with zipfile.ZipFile(p)as z:
 assert z.testzip() is None
 for f in files:assert sha(z.read(str(f.relative_to(ROOT.parent))))==sha(f.read_bytes()),str(f)
digest=sha(p.read_bytes());p.with_suffix('.zip.sha256').write_text(digest+'  '+p.name+'\n')
archives=[{'file':name,'bytes':p.stat().st_size,'files':len(files),'sha256':digest,'crcAndContentHashes':'PASS'}]
report={'status':'PASS','version':VERSION,'at':now,'chapters':12,'hours':48,'figures':40,'lessonPlanPages':read('lesson-plans/qa/round5-final-artifacts.json')['pdfPages'],'studentCheckpoints':9,'studentCheckpointsArchive':f'AI编程_第04至12章学生起点_V{PREVIOUS}.zip (unchanged)','changedSincePrevious':len(changed),'addedSincePrevious':len(added),'linksChecked':ns['report']['links'],'secretsScan':'current generated course passwords absent; private paths excluded','historicalArchivesUnchanged':True,'archives':archives}
(ROOT.parent/f'AI编程_智慧校园_48学时_V{VERSION}_交付校验.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
