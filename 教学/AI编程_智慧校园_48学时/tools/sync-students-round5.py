"""One-time authored checkpoint refresh. Refuse any changed or added student file."""
from pathlib import Path
import hashlib,json,os,shutil,subprocess,datetime
ROOT=Path(__file__).resolve().parent.parent
STUDENTS=ROOT/'resources/student-chapters'
REFERENCE=ROOT/'resources/campus-ai-course'
WORK=ROOT/'.runtime/round5-student-generation'
BACKUP=ROOT/'.runtime/round5-student-original'
SKIP={'.git','.private','.runtime','node_modules','target','dist','__pycache__'}
sha=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
baseline=json.loads((ROOT/'handoffs/round5-baseline.json').read_text())
expected={i['path']:i['sha256'] for i in baseline['files'] if i['path'].startswith('resources/student-chapters/')}
def paths(base):
 for here,dirs,files in os.walk(base):
  dirs[:]=[d for d in dirs if d not in SKIP]
  for n in files:
   p=Path(here)/n
   if p.is_symlink():raise RuntimeError('Refuse symlink: '+str(p))
   if n!='.DS_Store':yield p
actual={str(p.relative_to(ROOT)):sha(p) for p in paths(STUDENTS)}
assert actual==expected,'Student files changed since round5 baseline; preserve and review manually'
assert not WORK.exists() and not BACKUP.exists(),'Refuse to overwrite an earlier refresh'
WORK.mkdir(parents=True)
staged=WORK/'resources/campus-ai-course'
shutil.copytree(REFERENCE,staged,ignore=shutil.ignore_patterns(*SKIP,'.DS_Store','*.log'))
guide=WORK/'resources/teacher-guide';guide.mkdir()
shutil.copy2(ROOT/'resources/teacher-guide/11-学生断言模板.md',guide/'11-学生断言模板.md')
subprocess.run([os.environ.get('COURSE_NODE','node'),'tools/student-checkpoints.mjs'],cwd=staged,check=True)
fresh=WORK/'resources/student-chapters'
manifest=json.loads((fresh/'manifest.json').read_text());assert len(manifest['chapters'])==9
for chapter in manifest['chapters']:
 cp=fresh/('ch'+chapter['chapter']);record=json.loads((cp/'checkpoint.json').read_text())
 for f in record['files']:assert sha(cp/f['path'])==f['sha256']
STUDENTS.rename(BACKUP)
fresh.rename(STUDENTS)
report={'status':'PASS','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'priorFilesVerifiedUnchanged':len(actual),'priorManifestSha256':sha(BACKUP/'manifest.json'),'newManifestSha256':sha(STUDENTS/'manifest.json'),'chapters':9,'originalPreservedUnderExcludedRuntime':True,'scope':'Regeneration and integrity only; runtime/expected TODO failure tests recorded separately'}
(ROOT/'handoffs/round5-student-sync.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False))
