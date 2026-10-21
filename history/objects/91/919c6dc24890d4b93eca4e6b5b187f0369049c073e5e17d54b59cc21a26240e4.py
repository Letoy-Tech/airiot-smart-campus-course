from pathlib import Path
import os,re,json,urllib.parse,hashlib,datetime
ROOT=Path(__file__).resolve().parent.parent
EXCLUDE={'node_modules','target','dist','.private','.runtime','.cache','__pycache__','.git','.pytest_cache'}
def candidates():
 for here,dirs,files in os.walk(ROOT):
  dirs[:]=[d for d in dirs if d not in EXCLUDE]
  for n in sorted(files):
   p=Path(here)/n;r=p.relative_to(ROOT)
   if n=='.DS_Store' or p.suffix=='.log' or (n.startswith('.env') and n!='.env.example'):continue
   if 'qa' in r.parts and any(d.startswith('render') for d in r.parts):continue
   if r.as_posix()=='lesson-plans/qa/fonts.conf':continue
   yield p
files=list(candidates()); file_set=set(files); broken=[];excluded=[];external=[];links=0
for p in files:
 if p.suffix!='.md':continue
 s=re.sub(r'```[\s\S]*?```','',p.read_text())
 for raw in re.findall(r'\]\(([^\n]*?)\)',s):
  raw=raw.strip().strip('<>')
  if raw.startswith(('http:','https:','mailto:','#','app:')):continue
  t=urllib.parse.unquote(raw.split('#')[0]);dest=(p.parent/t).resolve()
  if not t:continue
  if not dest.exists():broken.append([str(p.relative_to(ROOT)),t]);continue
  if not dest.is_relative_to(ROOT):external.append([str(p.relative_to(ROOT)),t]);continue
  if dest.is_file() and dest not in file_set:excluded.append([str(p.relative_to(ROOT)),t]);continue
  links+=1
secrets=[]
ref=ROOT/'resources/campus-ai-course/.private'
if (ref/'accounts.json').exists():secrets += [a['password'].encode() for a in json.loads((ref/'accounts.json').read_text())['accounts']]
for name in ['database.json','test-database.json']:
 if (ref/name).exists():secrets.append(json.loads((ref/name).read_text())['password'].encode())
cnf=ref/'local-mysql-admin.cnf'
if cnf.exists():
 for line in cnf.read_text().splitlines():
  if line.startswith('password='):secrets.append(line.split('=',1)[1].strip().strip('"').encode())
leaks=[]
for p in files:
 b=p.read_bytes()
 if any(secret and secret in b for secret in secrets):leaks.append(str(p.relative_to(ROOT)))
report={'status':'PASS' if not (broken or excluded or leaks) else 'FAIL','at':datetime.datetime.now(datetime.timezone.utc).isoformat(),'files':len(files),'links':links,'broken':broken,'excludedLinkedFiles':excluded,'originalProjectReferenceLinks':external,'credentialLeakPaths':leaks,'privatePathsExcluded':True}
(ROOT/'illustrations/qa/round4-document-checks.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(report,ensure_ascii=False,indent=2))
