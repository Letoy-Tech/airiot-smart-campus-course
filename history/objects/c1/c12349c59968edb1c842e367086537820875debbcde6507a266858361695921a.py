"""Package the completed V1 course without credentials, dependencies or runtime state."""
from pathlib import Path
import json,hashlib,datetime,zipfile,runpy
ROOT=Path(__file__).resolve().parent.parent
sha=lambda b:hashlib.sha256(b).hexdigest()
read=lambda p:json.loads((ROOT/p).read_text())
now=datetime.datetime.now(datetime.timezone.utc).isoformat()
for path in ['resources/student-chapters/verification.json','resources/campus-ai-course/evidence/verification-v1.json','lesson-plans/qa/final-artifacts.json','lesson-plans/qa/html-verification.json','illustrations/qa/round4-book/verification.json','illustrations/qa/round4-standalone/verification.json','illustrations/qa/round4-resources/verification.json']:
 assert read(path)['status'].startswith('PASS'),path
for name in ['index','AI编程图文教程_V1.0_单文件']:
 p=ROOT/'reading'/f'{name}.html';build=json.loads(p.with_suffix('.build.json').read_text());assert build['sha256']==sha(p.read_bytes())
 for doc in build['documents']:assert sha((ROOT/doc['file']).read_bytes())==doc['sha256'],doc['file']
for f in read('lesson-plans/qa/final-artifacts.json')['files']:assert sha((ROOT/'lesson-plans'/f['path']).read_bytes())==f['sha256']
historical={'AI编程_智慧校园_48学时_V0.4_图文与起步资源.zip':'5fed671bc57f43b798ee51492183b107444d9bdede976489d9e951710ef59589','AI编程_第04章学生起点_V0.4.zip':'243d58992e1b3b6c1d8a43eea141f4de6ae21c810a63530403c428ce4bc68092','AI编程_智慧校园_48学时_V0.3_第二轮图文稿.zip':'a99c196b9f16d36510358a3fced8d2487efe8e804e74deff5f9e0131db3fb184'}
for name,digest in historical.items():assert sha((ROOT.parent/name).read_bytes())==digest,name
baseline=read('handoffs/round4-baseline.json')
for f in baseline['files']:
 if f['path'].startswith('reading/AI编程图文稿_V0.'):
  assert sha((ROOT/f['path']).read_bytes())==f['sha256'],f['path']
ns=runpy.run_path(str(ROOT/'tools/check-delivery.py'));assert ns['report']['status']=='PASS'
manifest=ROOT/'delivery-manifest-v1.0.json'
files=sorted(f for f in ns['candidates']() if f!=manifest)
manifest.write_text(json.dumps({'version':'1.0','createdAt':now,'scope':'Complete authored 48-hour course, 37-page lesson plan, full reference and 9 student checkpoints; author-local evidence distinct from school/student validation','excluded':sorted(ns['EXCLUDE'])+['*.log','lesson PDF render PNG intermediates','author fontconfig'],'historicalArchivesUnchanged':historical,'files':[{'path':str(f.relative_to(ROOT)),'bytes':f.stat().st_size,'sha256':sha(f.read_bytes())}for f in files]},ensure_ascii=False,indent=2)+'\n')
files.append(manifest);archives=[]
for name,selected,parent in [('AI编程_智慧校园_48学时_V1.0_完整教学包.zip',files,ROOT.parent),('AI编程_第04至12章学生起点_V1.0.zip',[f for f in files if f.is_relative_to(ROOT/'resources/student-chapters')],ROOT/'resources')]:
 p=ROOT.parent/name
 if p.exists():raise RuntimeError('Refuse to overwrite existing archive: '+name)
 with zipfile.ZipFile(p,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=6)as z:
  for f in selected:z.write(f,str(f.relative_to(parent)))
 with zipfile.ZipFile(p)as z:
  assert z.testzip() is None
  for f in selected:assert sha(z.read(str(f.relative_to(parent))))==sha(f.read_bytes()),str(f)
 digest=sha(p.read_bytes());p.with_suffix('.zip.sha256').write_text(digest+'  '+p.name+'\n')
 archives.append({'file':name,'bytes':p.stat().st_size,'files':len(selected),'sha256':digest,'crcAndContentHashes':'PASS'})
report={'status':'PASS','version':'1.0','at':now,'chapters':12,'hours':48,'figures':40,'lessonPlanPages':37,'studentCheckpoints':9,'linksChecked':ns['report']['links'],'secretsScan':'current generated course passwords absent; private paths excluded','historicalArchivesUnchanged':True,'archives':archives}
(ROOT.parent/'AI编程_智慧校园_48学时_V1.0_交付校验.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
