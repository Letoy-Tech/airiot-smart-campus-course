from pathlib import Path
import json,sys,hashlib,datetime
base=Path(__file__).resolve().parent
root=base.parent/'campus-lab'
state=json.loads((base/'progress.json').read_text())
now=datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8))).isoformat()
def manifest():
 out=[]
 for p in sorted(root.rglob('*')):
  r=p.relative_to(root)
  if any(x in {'.private','.runtime','node_modules','target','.git','delivery'} for x in r.parts):continue
  if any(x.startswith('.env') for x in r.parts) and r.as_posix()!='.env.example':continue
  if p.is_file() and not p.is_symlink() and p.suffix not in {'.log','.zip'} and p.name!='.DS_Store':out.append({'path':str(r),'bytes':p.stat().st_size,'sha256':hashlib.sha256(p.read_bytes()).hexdigest()})
 return out
stepid=sys.argv[1]
if stepid in {'12-03','12-04','12-05'} and (base.parent/'campus-lab-handoff').is_dir():
 root=base.parent/'campus-lab-handoff'
s=next(x for x in state['steps'] if x['id']==stepid)
update=json.loads(sys.stdin.read()) if not sys.stdin.isatty() else {}
s.update(update);s['updatedAt']=now;s['evidenceSourceDirectory']=root.name
if update.get('status') in {'AI_DONE','PASS','FAIL','BLOCKED'}:
 m=manifest();(base/'snapshots'/f'{stepid}-manifest.json').write_text(json.dumps(m,ensure_ascii=False,indent=2))
 prev=sorted((base/'snapshots').glob('*-manifest.json'))
 prior=[p for p in prev if p.name<f'{stepid}-manifest.json']
 if prior:
  old={x['path']:x['sha256'] for x in json.loads(prior[-1].read_text())};cur={x['path']:x['sha256'] for x in m}
  s['changed_files']=[p for p in sorted(set(old)|set(cur)) if old.get(p)!=cur.get(p)]
state['current_step']=stepid; state['status']='IN_PROGRESS'
(base/'progress.json').write_text(json.dumps(state,ensure_ascii=False,indent=2))
with (base/'events.jsonl').open('a') as f:f.write(json.dumps({'at':now,'id':stepid,'update':update},ensure_ascii=False)+'\n')
(base/'progress.md').write_text('# V2.0.1 学生实做进度\n\n每个 PASS 均需包含独立执行与界面检查；AI完成不等于通过。\n\n| 步骤 | 原文标题 | 状态 | 模型 |\n|---|---|---|---|\n'+''.join(f"| {x['id']} | {x['title'].replace('## ','')} | {x['status']} | {x.get('model') or '—'} |\n" for x in state['steps']))
print(stepid,s['status'],s.get('changed_files',[]))
