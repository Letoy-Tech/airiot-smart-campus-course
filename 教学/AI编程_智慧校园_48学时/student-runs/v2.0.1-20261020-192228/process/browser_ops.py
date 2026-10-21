"""Operator UI evidence helper. It does not author student application source."""
from pathlib import Path
import subprocess,re,json,datetime
BASE=Path(__file__).resolve().parent
OWNED_ENVS=[BASE.parent/'campus-lab/.env',BASE.parent/'campus-lab-handoff/.env']
def safe_text(text):
 # Only this trial's two generated loopback configs, for evidence masking.
 for env in OWNED_ENVS:
  if not env.is_file():continue
  for line in env.read_text().splitlines():
   if '=' not in line or line.startswith('#'):continue
   key,value=line.split('=',1)
   if key in {'MYSQL_ROOT_PASSWORD','DB_PASSWORD','REDIS_PASSWORD','DEMO_PASSWORD'} and len(value)>=8:text=text.replace(value,'[REDACTED_LOCAL_CREDENTIAL]')
 return text
class Browser:
 def __init__(self,step,session='qvuv',handoff=False):
  self.step,self.session,self.text=step,session,''
  self.env_path=OWNED_ENVS[1 if handoff else 0]
  self.n=max([int(x.stem.rsplit('-',1)[1]) for x in (BASE/'steps').glob(f'{step}-browser-*.txt')]+[0])
 def cmd(self,*args,observe=False):
  r=subprocess.run(['bsk',*args,'--session',self.session],text=True,capture_output=True)
  r.stdout=safe_text(r.stdout);r.stderr=safe_text(r.stderr)
  safe_argv=[safe_text(x) for x in ['bsk',*args,'--session',self.session]]
  with (BASE/'commands'/f'{self.step}-ui.jsonl').open('a') as f:f.write(json.dumps({'at':datetime.datetime.now().isoformat(),'argv':safe_argv,'exit':r.returncode,'stdout':r.stdout,'stderr':r.stderr},ensure_ascii=False)+'\n')
  if r.returncode:raise RuntimeError(r.stderr or r.stdout)
  if observe:self.observe()
  return r.stdout
 def observe(self):
  self.n+=1;self.text=self.cmd('observe');(BASE/'steps'/f'{self.step}-browser-{self.n:02d}.txt').write_text(self.text);return self.text
 def ref(self,label,roles=('button',)):
  found=[]
  for line in self.text.splitlines():
   m=re.search(r'(@e\d+) (button|textbox|searchbox|combobox|link) "([^"]+)"',line)
   if m and m[2] in roles and m[3].replace(' [has-submenu]','')==label:found.append(m[1])
  if len(found)!=1:raise ValueError((label,found))
  return found[0]
 def click(self,label):return self.cmd('click',self.ref(label),observe=True)
 def fill(self,label,value):return self.cmd('fill',self.ref(label,('textbox','searchbox')),'--value',value,observe=True)
 def select(self,label,value):return self.cmd('select',self.ref(label,('combobox',)),'--value',value,observe=True)
 def reload(self):return self.cmd('reload',observe=True)
 def private_login(self,username):
  # For this owned loopback course only. No password args/output enter evidence.
  self.observe();self.check('登录本机课程后端');self.fill('用户名',username)
  password_ref=self.ref('密码',('textbox',));submit_ref=self.ref('登录')
  password=next(line.split('=',1)[1] for line in self.env_path.read_text().splitlines() if line.startswith('DEMO_PASSWORD='))
  for action,args in [('private-password-fill',['fill',password_ref,'--value',password]),('login-submit',['click',submit_ref])]:
   result=subprocess.run(['/Users/learner/.local/bin/bsk',*args,'--session',self.session],text=True,capture_output=True)
   with (BASE/'commands'/f'{self.step}-private-actions.jsonl').open('a') as f:f.write(json.dumps({'at':datetime.datetime.now().isoformat(),'action':action,'username':username,'exit':result.returncode,'valuesLogged':False},ensure_ascii=False)+'\n')
   if result.returncode:raise RuntimeError(action+' failed; private output suppressed')
  password=None
  return self.observe()
 def check(self,*texts):
  for text in texts:assert text in self.text,('Missing expected visible text',text)
 def screenshot(self,name):return self.cmd('screenshot','--out',str(BASE/'screenshots'/name))
 def pass_step(self,result):
  u={'status':'PASS','checks':[{'kind':'actual-browser','commandsEvidence':f'commands/{self.step}-ui.jsonl','observations':self.n,'result':result}],'result':result}
  r=subprocess.run(['python3',str(BASE/'record.py'),self.step],input=json.dumps(u,ensure_ascii=False),text=True,capture_output=True);assert r.returncode==0,r.stderr;print(r.stdout.strip())
 def click_row(self,identity,label='查看'):
  m=re.search(r'row "'+re.escape(identity)+r' [^\n]*\n(.*?)(?=\n\s*row |\Z)',self.text,re.S)
  if not m:raise ValueError(('Row not visible in observation',identity))
  refs=re.findall(r'(@e\d+) button "'+re.escape(label)+r'"',m[1])
  if len(refs)!=1:raise ValueError((identity,label,refs))
  return self.cmd('click',refs[0],observe=True)
