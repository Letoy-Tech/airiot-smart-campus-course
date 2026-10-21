"""Package only V2 public teaching files. Never packages runtime data or local credentials."""
from pathlib import Path
import hashlib,json,zipfile,datetime,sys
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT.parent
VERSION='2.0.2'
IGNORE={'.env','.private','.runtime','.git','node_modules','target','dist','__pycache__','.DS_Store','.codebuddy'}
def assert_regular_source(p):
 if p.is_symlink() or any(parent.is_symlink() for parent in p.parents):
  raise RuntimeError('Refusing symlink path '+str(p))
 if not p.is_file():raise RuntimeError('Not a regular source file '+str(p))
def files(base):
 return sorted(p for p in base.rglob('*') if p.is_file() and not any(c in IGNORE for c in p.relative_to(base).parts) and not p.name.endswith('.log') and not (p.name.startswith('.env') and p.name!='.env.example') and not (p.name.startswith('从空白开始_手把手教程_V') and p.name!=f'从空白开始_手把手教程_V{VERSION}.html'))
def write_zip(dest,mapping):
 if dest.exists():raise RuntimeError('Refusing to replace existing archive: '+str(dest))
 manifest=[]
 with zipfile.ZipFile(dest,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  seen=set()
  for name,src in mapping:
   if name in seen:raise RuntimeError('Duplicate archive path '+name)
   seen.add(name)
   assert_regular_source(src)
   data=src.read_bytes()
   z.writestr(name,data)
   manifest.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
  z.writestr('PACKAGE-MANIFEST.json',json.dumps({'version':VERSION,'files':manifest},ensure_ascii=False,indent=2))
 with zipfile.ZipFile(dest) as z:
  assert z.testzip() is None
  for x in manifest:assert hashlib.sha256(z.read(x['path'])).hexdigest()==x['sha256']
 return {'file':str(dest.resolve()),'bytes':dest.stat().st_size,'files':len(manifest),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
base=ROOT/'resources/from-zero-v2/student-start'
student_mapping=[('campus-lab/'+str(p.relative_to(base)),p) for p in files(base)]
mapping=[];prefix=f'AI编程_手把手课程_V{VERSION}/'
for folder in ['handbook-v2','resources/from-zero-v2','tools/v2']:
 for p in files(ROOT/folder):mapping.append((prefix+str(p.relative_to(ROOT)),p))
for name in ['index.html','先打开这里.html','course-index-v2.json','01-课程大纲.md','02-项目范围与教学架构.md','03-AI协作与接力规范.md','04-考核与验收.md']:mapping.append((prefix+name,ROOT/name))
mapping.append((prefix+'README.md',ROOT/'handbook-v2/交付包说明.md'))
for archive_mapping in [student_mapping,mapping]:
 seen=set()
 for name,src in archive_mapping:
  if name in seen:raise RuntimeError('Duplicate archive path '+name)
  seen.add(name)
  assert_regular_source(src)
if '--check-only' in sys.argv:
 print(json.dumps({'version':VERSION,'student_files':len(student_mapping),'full_files':len(mapping),'checked':'paths only; no archives written'},ensure_ascii=False))
 raise SystemExit(0)
for name in [f'AI编程_学生空白起点_V{VERSION}.zip',f'AI编程_智慧校园_V{VERSION}_手把手教学包.zip']:
 if (OUT/name).exists():raise RuntimeError('Refusing to replace existing archive: '+str(OUT/name))
student=write_zip(OUT/f'AI编程_学生空白起点_V{VERSION}.zip',student_mapping)
full=write_zip(OUT/f'AI编程_智慧校园_V{VERSION}_手把手教学包.zip',mapping)
result={'version':VERSION,'created':datetime.datetime.now().isoformat(),'archives':[student,full]}
(OUT/f'AI编程_智慧校园_V{VERSION}_交付校验.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False,indent=2))
