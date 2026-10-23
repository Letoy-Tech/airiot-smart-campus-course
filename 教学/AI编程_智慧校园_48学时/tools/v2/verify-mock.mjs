// Author-side behavioral check of the browser-only lessons. No services or student files are modified.
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
const memory=new Map();globalThis.localStorage={getItem:k=>memory.get(k)||null,setItem:(k,v)=>memory.set(k,String(v))};
if(!globalThis.crypto)globalThis.crypto=webcrypto;
const {dataService:d}=await import('../../resources/from-zero-v2/teacher-reference/frontend/data-service.js');
let n=0;const pass=()=>n++;
const overview=await d.getOverview();assert.equal(overview.devices.length,16);assert.equal(overview.points.length,28);pass();
assert.equal(overview.devices.find(x=>x.id==='d03').online,null);assert.equal(overview.points.find(x=>x.deviceId==='d05'&&x.tagId==='power').value,0);pass();
await assert.rejects(d.saveSpace('s1',{building:' ',floor:'1'}));pass();
await d.saveSpace('s1',{building:'演示教学楼',floor:'2'});assert.equal((await d.getOverview()).spaces[0].building,'演示教学楼');pass();
await d.saveOwner('d01',{username:'manager',note:'课程演示责任',expectedVersion:0});pass();
await assert.rejects(d.saveOwner('d01',{username:'manager',note:'过期写入',expectedVersion:0}),e=>e.status===409);pass();
assert.equal((await d.createCase({deviceId:'d01',message:'自动分派'})).state,'ASSIGNED');pass();
let c=await d.createCase({deviceId:'d02',message:'手动分派演练'});assert.equal(c.state,'NEW');pass();
await assert.rejects(d.caseAction(c.id,{action:'assign',username:'manager',note:' ',expectedVersion:c.version}));pass();
c=await d.caseAction(c.id,{action:'assign',username:'manager',note:'安排检查',expectedVersion:c.version});d.setDemoRole('MANAGER');
c=await d.caseAction(c.id,{action:'start',expectedVersion:c.version});pass();
await assert.rejects(d.caseAction(c.id,{action:'close',note:'不得跳步',expectedVersion:c.version}));pass();
c=await d.caseAction(c.id,{action:'note',note:'完成现场模拟检查',expectedVersion:c.version});pass();
await assert.rejects(d.caseAction(c.id,{action:'recover',expectedVersion:c.version}),e=>e.status===403);pass();
d.setDemoRole('ADMIN');c=await d.caseAction(c.id,{action:'recover',expectedVersion:c.version});d.setDemoRole('MANAGER');c=await d.caseAction(c.id,{action:'verify',expectedVersion:c.version});pass();
c=await d.caseAction(c.id,{action:'close',note:'确认演练结束',expectedVersion:c.version});assert.equal(c.state,'CLOSED');assert.equal(c.version,7);pass();
await assert.rejects(d.caseAction(c.id,{action:'note',note:'不可改',expectedVersion:c.version}));pass();
d.setDemoRole('VIEWER');await assert.rejects(d.createCase({deviceId:'d03',message:'不可建'}),e=>e.status===403);pass();
assert.ok(memory.has('campus-v2-demo'));assert.equal((await d.getCases()).find(x=>x.id===c.id).state,'CLOSED');pass();
// Independent rejection/reverification cases; do not alter the v7 happy-flow case above.
d.setDemoRole('ADMIN');
const current=async id=>(await d.getCases()).find(item=>item.id===id);
async function rejectedWithoutChanges(item,body){
 const before=await current(item.id),auditBefore=await d.getAudit();
 await assert.rejects(d.caseAction(item.id,{...body,expectedVersion:before.version}));
 assert.deepEqual(await current(item.id),before,'Rejected action must not alter fields, version or timeline');
 assert.deepEqual(await d.getAudit(),auditBefore,'Rejected action must not append a success audit');pass();
}
let boundary=await d.createCase({deviceId:'d03',message:'独立状态边界演练'});
await rejectedWithoutChanges(boundary,{action:'recover'});
await rejectedWithoutChanges(boundary,{action:'verify'});
boundary=await d.caseAction(boundary.id,{action:'assign',username:'manager',note:'独立状态检查',expectedVersion:boundary.version});
boundary=await d.caseAction(boundary.id,{action:'start',expectedVersion:boundary.version});
await rejectedWithoutChanges(boundary,{action:'assign',username:'manager',note:'不得重新分派'});
boundary=await d.caseAction(boundary.id,{action:'recover',expectedVersion:boundary.version});
await rejectedWithoutChanges(boundary,{action:'verify'}); // Recovered alone is not enough without a note.
for(const mutation of ['note','recover']){
 let item=await d.createCase({deviceId:'d04',message:'独立重新核实演练：'+mutation});
 const action=async(action,note)=>{item=await d.caseAction(item.id,{action,note,username:'manager',expectedVersion:item.version});return item};
 await action('assign','安排独立演练');await action('start');await action('note','初次处置记录');await action('recover');await action('verify');
 assert.equal(item.verified,true);
 await action(mutation,mutation==='note'?'补充处置记录':undefined);
 assert.equal(item.verified,false,mutation+' must clear prior verification');pass();
 await rejectedWithoutChanges(item,{action:'close',note:'未重新核实不能关闭'});
 await action('verify');await action('close','重新核实后关闭');assert.equal(item.state,'CLOSED');pass();
}
assert.equal((await current(c.id)).version,7,'Boundary checks must not change the original happy-flow case');
console.log(JSON.stringify({passed:n,scope:'browser mock data and behavior; in-memory localStorage only'}));
