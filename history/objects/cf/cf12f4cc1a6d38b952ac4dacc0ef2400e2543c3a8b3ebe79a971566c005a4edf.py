"""Package the round5 fixes, preserving all previously delivered archives."""
from pathlib import Path
import json,hashlib,datetime,zipfile,runpy
ROOT=Path(__file__).resolve().parent.parent
VERSION='1.0.1'
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda p:json.loads((ROOT/p).read_text())
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
for p in ['resources/student-chapters/verification.json','resources/campus-ai-course/evidence/verification-v1.0.1.json','lesson-plans/qa/round5-final-artifacts.json','lesson-plans/qa/round5-html/html-verification.json','illustrations/qa/round5-book/verification.json','illustrations/qa/round5-standalone/verification.json','illustrations/qa/round5-resources/verification.json']:
 assert read(p)['status'].startswith('PASS'),p
assert read('course-index.json')['version']==VERSION
for name in ['index',f'AI编程图文教程_V{VERSION}_单文件']:
 p=ROOT/'reading'/f'{name}.html';build=json.loads(p.with_suffix('.build.json').read_text());assert build['sha256']==sha(p.read_bytes())
 for doc in build['documents']:assert sha((ROOT/doc['file']).read_bytes())==doc['sha256'],doc['file']
for f in read('lesson-plans/qa/round5-final-artifacts.json')['files']:assert sha((ROOT/'lesson-plans'/f['path']).read_bytes())==f['sha256']
historical={'AI编程_智慧校园_48学时_V1.0_完整教学包.zip':'eff074912bf6be4b732495594864bd8af69f03d72fd2b48a9c9960c1ffdc813d','AI编程_第04至12章学生起点_V1.0.zip':'04199e880e368822991e039409409605759afa682c9cdeece095102e554cf695','AI编程_智慧校园_48学时_V0.4_图文与起步资源.zip':'5fed671bc57f43b798ee51492183b107444d9bdede976489d9e951710ef59589','AI编程_第04章学生起点_V0.4.zip':'243d58992e1b3b6c1d8a43eea141f4de6ae21c810a63530403c428ce4bc68092','AI编程_智慧校园_48学时_V0.3_第二轮图文稿.zip':'a99c196b9f16d36510358a3fced8d2487efe8e804e74deff5f9e0131db3fb184'}
for name,digest in historical.items():assert sha((ROOT.parent/name).read_bytes())==digest,name
baseline=read('handoffs/round5-baseline.json')
for f in baseline['files']:
 if f['path'].startswith('reading/AI编程图文稿_V0.') or f['path'].startswith('reading/AI编程图文教程_V1.0_'):
  assert sha((ROOT/f['path']).read_bytes())==f['sha256'],f['path']
ns=runpy.run_path(str(ROOT/'tools/check-delivery.py'));assert ns['report']['status']=='PASS'
manifest=ROOT/f'delivery-manifest-v{VERSION}.json'
files=sorted(f for f in ns['candidates']() if f!=manifest)
manifest.write_text(json.dumps({'version':VERSION,'createdAt':now,'scope':'Round5 verified fixes; 48-hour illustrated course, lesson plans, full reference and 9 student checkpoints. Classroom and real school/AIRIOT acceptance remain pending.','excluded':sorted(ns['EXCLUDE'])+['*.log','lesson PDF render PNG intermediates','author fontconfig'],'historicalArchivesUnchanged':historical,'files':[{'path':str(f.relative_to(ROOT)),'bytes':f.stat().st_size,'sha256':sha(f.read_bytes())}for f in files]},ensure_ascii=False,indent=2)+'\n')
files.append(manifest);archives=[]
for name,selected,parent in [(f'AI编程_智慧校园_48学时_V{VERSION}_完整教学包.zip',files,ROOT.parent),(f'AI编程_第04至12章学生起点_V{VERSION}.zip',[f for f in files if f.is_relative_to(ROOT/'resources/student-chapters')],ROOT/'resources')]:
 p=ROOT.parent/name
 if p.exists():raise RuntimeError('Refuse to overwrite existing archive: '+name)
 with zipfile.ZipFile(p,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6)as z:
  for f in selected:z.write(f,str(f.relative_to(parent)))
 with zipfile.ZipFile(p)as z:
  assert z.testzip() is None
  for f in selected:assert sha(z.read(str(f.relative_to(parent))))==sha(f.read_bytes()),str(f)
 digest=sha(p.read_bytes());p.with_suffix('.zip.sha256').write_text(digest+'  '+p.name+'\n')
 archives.append({'file':name,'bytes':p.stat().st_size,'files':len(selected),'sha256':digest,'crcAndContentHashes':'PASS'})
report={'status':'PASS','version':VERSION,'at':now,'chapters':12,'hours':48,'figures':40,'lessonPlanPages':read('lesson-plans/qa/round5-final-artifacts.json')['pdfPages'],'studentCheckpoints':9,'linksChecked':ns['report']['links'],'secretsScan':'current generated course passwords absent; private paths excluded','historicalArchivesUnchanged':True,'archives':archives}
(ROOT.parent/f'AI编程_智慧校园_48学时_V{VERSION}_交付校验.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
