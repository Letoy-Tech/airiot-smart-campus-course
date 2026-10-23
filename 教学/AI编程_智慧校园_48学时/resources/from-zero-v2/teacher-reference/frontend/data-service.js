import {mockCampus} from './mock-data.js';
const copy=x=>structuredClone(x);
let mode=localStorage.getItem('campus-v2-mode')==='api'?'api':'mock',token=null,user=mode==='mock'?{username:'admin',role:'ADMIN'}:null;
let saved={};try{saved=JSON.parse(localStorage.getItem('campus-v2-demo')||'{}')}catch{}
let state={spaces:copy(mockCampus.spaces),owners:[],cases:[],audit:[],...saved};
const persist=()=>localStorage.setItem('campus-v2-demo',JSON.stringify(state));
const failure=(status,message)=>{const e=new Error(message);e.status=status;throw e};
function allow(roles){if(!user||!roles.includes(user.role))failure(403,'当前角色不能进行这个操作。')}
async function request(url,method='GET',body){
 const controller=new AbortController();let timeout,timedOut=false;
 // One deadline covers both response headers and body; receiving headers is not completion.
 const deadline=new Promise((_,reject)=>{timeout=setTimeout(()=>{timedOut=true;controller.abort();reject(new Error('request timeout'))},5000)});
 const interrupted=e=>timedOut||e.name==='AbortError';
 const interruptedMessage=()=>timedOut?'等待超过5秒，请检查后端后重试。':'请求读取已中断，请检查后端后重试。';
 try{
  let r;
  try{r=await Promise.race([fetch('/api'+url,{signal:controller.signal,method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})}),deadline])}
  catch(e){failure(503,interrupted(e)?interruptedMessage():'后端连接中断，请检查 B-后端。')}
  let j;
  try{j=await Promise.race([r.json(),deadline])}
  catch(e){if(interrupted(e))failure(503,interruptedMessage());failure(r.ok?502:r.status,'服务没有返回正确的数据，请查看 B-后端终端。')}
  if(!r.ok||j?.code!==0){if(r.status===401){token=null;user=null}failure(r.ok?502:r.status,j?.message||'请求失败')}
  return j.data;
 }finally{clearTimeout(timeout)}
}
function audit(action,note){state.audit.unshift({action,note,username:user.username,time:Date.now()});persist()}
export const dataService={
 get mode(){return mode}, get user(){return user},
 setMode(m){mode=m;localStorage.setItem('campus-v2-mode',m);token=null;user=m==='mock'?{username:'admin',role:'ADMIN'}:null},
 setDemoRole(role){if(mode==='mock')user={role,username:role.toLowerCase()}},
 async login(username,password){const x=await request('/login','POST',{username,password});token=x.token;user=await request('/me');return user},
 async logout(){try{if(mode==='api'&&token)await request('/logout','POST')}finally{token=null;user=null}},
 async checkHealth(){const c=new AbortController();const t=setTimeout(()=>c.abort(),5000);try{const r=await fetch('/api/health',{signal:c.signal});const j=await r.json();return r.ok&&j.code===0&&j.data?.status==='UP'}finally{clearTimeout(t)}},
 async getOverview(){return mode==='api'?request('/overview'):copy({...mockCampus,spaces:state.spaces})},
 async getDevices(){return mode==='api'?request('/devices'):copy(mockCampus.devices)},
 async getSpaces(){return mode==='api'?request('/spaces'):copy(state.spaces)},
 async getOwners(){return mode==='api'?request('/owners'):copy(state.owners)},
 async getCases(){return mode==='api'?request('/cases'):copy(state.cases)},
 async getAudit(){if(mode==='api')return request('/audit');allow(['ADMIN']);return copy(state.audit)},
 async getIntegration(){return mode==='api'?request('/integration'):{source:'TEACHING_MOCK',simulated:true,controlEnabled:false,notificationsEnabled:false}},
 async saveSpace(id,body){if(mode==='api')return request('/spaces/'+id,'PUT',body);allow(['ADMIN']);let s=state.spaces.find(x=>x.id===id);if(!s)failure(404,'空间不存在');if(!body.building?.trim()||!body.floor?.trim())failure(400,'楼栋和楼层不能为空');Object.assign(s,body);audit('SPACE',id);return copy(s)},
 async saveOwner(id,body){if(mode==='api')return request('/owners/'+id,'PUT',body);allow(['ADMIN']);let o=state.owners.find(x=>x.deviceId===id);if((o?.version||0)!==body.expectedVersion)failure(409,'记录已更新，请刷新后重新决定。');if(body.username!=='manager'||!body.note?.trim())failure(400,'请选择管理人员并填写登记说明');if(!o){o={deviceId:id,version:0};state.owners.push(o)}Object.assign(o,{username:body.username,note:body.note,version:o.version+1});audit('OWNER',id);return copy(o)},
 async createCase(body){if(mode==='api')return request('/cases','POST',body);allow(['ADMIN']);if(!body.message?.trim())failure(400,'请填写演练说明');const assignee=state.owners.find(x=>x.deviceId===body.deviceId)?.username||null;const c={id:crypto.randomUUID(),deviceId:body.deviceId,message:body.message,state:assignee?'ASSIGNED':'NEW',assignee,sourceState:'ACTIVE',verified:false,note:'',conclusion:'',version:1,timeline:[{action:'create',note:body.message,time:Date.now(),username:user.username}]};state.cases.unshift(c);audit('CREATE',c.id);return copy(c)},
 async caseAction(id,body){
  if(mode==='api')return request('/cases/'+id+'/actions','POST',body);
  let c=state.cases.find(x=>String(x.id)===String(id));if(!c)failure(404,'事件不存在');allow(['ADMIN','MANAGER']);
  if(user.role==='MANAGER'&&c.assignee!==user.username)failure(403,'只能处理分派给自己的事件');
  if(c.version!==body.expectedVersion)failure(409,'记录已更新，请刷新后重新决定。');if(c.state==='CLOSED')failure(409,'已关闭事件不能再修改');
  switch(body.action){
   case 'assign':allow(['ADMIN']);if(!['NEW','ASSIGNED'].includes(c.state)||!body.note?.trim())failure(400,'请在待分派或待处理时填写分派说明');if(body.username!=='manager')failure(400,'请选择管理人员');c.assignee='manager';c.state='ASSIGNED';c.verified=false;break;
   case 'start':if(c.state!=='ASSIGNED')failure(409,'请先分派');c.state='IN_PROGRESS';break;
   case 'note':if(c.state!=='IN_PROGRESS'||!body.note?.trim())failure(400,'开始处理后填写处置记录');c.note=body.note;c.verified=false;break;
   case 'recover':allow(['ADMIN']);if(c.state!=='IN_PROGRESS')failure(409,'请先开始处理');c.sourceState='RECOVERED';c.verified=false;break;
   case 'verify':if(c.state!=='IN_PROGRESS'||!c.note||c.sourceState!=='RECOVERED')failure(409,'请先处理并模拟来源恢复');c.verified=true;break;
   case 'close':if(c.state!=='IN_PROGRESS'||!c.note||!c.verified||c.sourceState!=='RECOVERED'||!body.note?.trim())failure(409,'关闭前需要处置记录、来源恢复、核实和关闭结论');c.conclusion=body.note;c.state='CLOSED';break;
   default:failure(400,'未知操作');
  }
  c.version++;c.timeline.push({action:body.action,note:body.note||'',time:Date.now(),username:user.username});audit(body.action,c.id);return copy(c);
 }
};
