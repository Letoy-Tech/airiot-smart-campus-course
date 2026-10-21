"""Package only V2 public teaching files. Never packages runtime data or local credentials."""
from pathlib import Path
import hashlib,json,zipfile,datetime
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT.parent
IGNORE={'.env','.private','.runtime','.git','node_modules','target','dist','__pycache__','.DS_Store','.codebuddy'}
secret_values=[]
p=ROOT/'resources/from-zero-v2/teacher-reference/.env'
if p.exists():
 for line in p.read_text().splitlines():
  if line and not line.startswith('#') and '=' in line:
   value=line.split('=',1)[1]
   if len(value)>=12:secret_values.append(value.encode())
def files(base):
 return sorted(p for p in base.rglob('*') if p.is_file() and not any(c in IGNORE for c in p.relative_to(base).parts) and not p.name.endswith('.log'))
def write_zip(dest,mapping):
 if dest.exists():raise RuntimeError('Refusing to replace existing archive: '+str(dest))
 manifest=[]
 with zipfile.ZipFile(dest,'x',compression=zipfile.ZIP_DEFLATED,compresslevel=9) as z:
  seen=set()
  for name,src in mapping:
   if name in seen:raise RuntimeError('Duplicate archive path '+name)
   seen.add(name)
   if src.is_symlink():raise RuntimeError('Refusing symlink '+str(src))
   data=src.read_bytes()
   if any(v in data for v in secret_values):raise RuntimeError('Local configuration value found in '+str(src))
   z.writestr(name,data)
   manifest.append({'path':name,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()})
  z.writestr('PACKAGE-MANIFEST.json',json.dumps({'version':'2.0.0','files':manifest},ensure_ascii=False,indent=2))
 with zipfile.ZipFile(dest) as z:
  assert z.testzip() is None
  for x in manifest:assert hashlib.sha256(z.read(x['path'])).hexdigest()==x['sha256']
 return {'file':str(dest.resolve()),'bytes':dest.stat().st_size,'files':len(manifest),'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()}
base=ROOT/'resources/from-zero-v2/student-start'
student=write_zip(OUT/'AI编程_学生空白起点_V2.0.0.zip',[('campus-lab/'+str(p.relative_to(base)),p) for p in files(base)])
mapping=[];prefix='AI编程_手把手课程_V2.0.0/'
for folder in ['handbook-v2','resources/from-zero-v2','tools/v2']:
 for p in files(ROOT/folder):mapping.append((prefix+str(p.relative_to(ROOT)),p))
for name in ['index.html','先打开这里.html','course-index-v2.json','01-课程大纲.md','02-项目范围与教学架构.md','03-AI协作与接力规范.md','04-考核与验收.md']:mapping.append((prefix+name,ROOT/name))
mapping.append((prefix+'README.md',ROOT/'handbook-v2/交付包说明.md'))
full=write_zip(OUT/'AI编程_智慧校园_V2.0.0_手把手教学包.zip',mapping)
result={'version':'2.0.0','created':datetime.datetime.now().isoformat(),'archives':[student,full]}
(OUT/'AI编程_智慧校园_V2.0.0_交付校验.json').write_text(json.dumps(result,ensure_ascii=False,indent=2))
print(json.dumps(result,ensure_ascii=False,indent=2))
