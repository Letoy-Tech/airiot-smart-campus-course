// Offline regression checks for the real reference data layer. No servers or real credentials.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source=fs.readFileSync(new URL('../../resources/from-zero-v2/teacher-reference/frontend/data-service.js',import.meta.url),'utf8');
const fixture=JSON.parse(fs.readFileSync(new URL('../../resources/from-zero-v2/teacher-reference/materials/mock-campus.json',import.meta.url),'utf8'));
const importLine="import {mockCampus} from './mock-data.js';";
assert.ok(source.includes(importLine),'Expected local fixture import');
assert.match(source,/export\s+const\s+dataService\s*=/);
const executable=source.replace(importLine,'const mockCampus=globalThis.fixture;')
 .replace(/export\s+const\s+dataService\s*=/,'globalThis.dataService=');
const flush=async()=>{for(let i=0;i<12;i++)await Promise.resolve()};
const pending=()=>new Promise(()=>{});
const abortError=()=>Object.assign(new Error('body interrupted'),{name:'AbortError'});
const response=(data,status=200)=>({ok:status>=200&&status<300,status,json:async()=>data});

function harness(fetch){
 let now=0,next=1,cleared=0,lastSignal;
 const timers=new Map();
 const context={fixture,structuredClone,AbortController,
  localStorage:{getItem:key=>key==='campus-v2-mode'?'api':null,setItem(){}},
  fetch:(...args)=>{lastSignal=args[1]?.signal;return fetch(...args)},
  setTimeout:(fn,delay)=>{const id=next++;timers.set(id,{at:now+delay,fn});return id},
  clearTimeout:id=>{cleared++;timers.delete(id)}};
 vm.runInNewContext(executable,context,{filename:'reference-data-service.js'});
 return {ds:context.dataService,timers,get cleared(){return cleared},get signal(){return lastSignal},
  advance(ms){now+=ms;for(const[id,t]of [...timers])if(t.at<=now){timers.delete(id);t.fn()}}};
}
function complete(h){assert.equal(h.timers.size,0,'No deadline timer may remain');assert.equal(h.cleared,1,'Deadline must be cleared once')}
const results=[];
async function test(name,fn){await fn();results.push({name,status:'passed'})}

await test('headers succeed but body never settles: deadline still returns 503',async()=>{
 let bodyStarted=false;
 const h=harness(async()=>({ok:true,status:200,json:()=>{bodyStarted=true;return pending()}}));
 const request=h.ds.getDevices();const rejected=assert.rejects(request,e=>e.status===503&&/5秒/.test(e.message));
 await flush();assert.ok(bodyStarted);assert.equal(h.timers.size,1);
 h.advance(4999);await flush();assert.equal(h.signal.aborted,false);
 h.advance(1);await rejected;assert.equal(h.signal.aborted,true);complete(h);
});
await test('one five-second budget covers headers and body together',async()=>{
 let headers;
 const h=harness(()=>new Promise(resolve=>{headers=resolve}));
 const request=h.ds.getDevices();const rejected=assert.rejects(request,e=>e.status===503);
 h.advance(4000);headers({ok:true,status:200,json:pending});await flush();
 h.advance(1000);await rejected;complete(h);
});
await test('body AbortError is a local 503 and clears the deadline',async()=>{
 const h=harness(async()=>({ok:true,status:200,json:async()=>{throw abortError()}}));
 await assert.rejects(h.ds.getDevices(),e=>e.status===503&&/中断/.test(e.message));complete(h);
});
await test('valid JSON returns data and clears the deadline',async()=>{
 const h=harness(async()=>response({code:0,message:'ok',data:[{id:'d01'}]}));
 assert.deepEqual(await h.ds.getDevices(),[{id:'d01'}]);complete(h);
});
await test('non-JSON HTTP 200 is a local malformed-response 502',async()=>{
 const h=harness(async()=>({ok:true,status:200,json:async()=>{throw new SyntaxError('not JSON')}}));
 await assert.rejects(h.ds.getDevices(),e=>e.status===502&&/正确的数据/.test(e.message));complete(h);
});
await test('non-JSON HTTP error retains its response status',async()=>{
 const h=harness(async()=>({ok:false,status:503,json:async()=>{throw new SyntaxError('not JSON')}}));
 await assert.rejects(h.ds.getDevices(),e=>e.status===503&&/正确的数据/.test(e.message));complete(h);
});
await test('network failure is a local 503 and clears the deadline',async()=>{
 const h=harness(async()=>{throw new TypeError('network unavailable')});
 await assert.rejects(h.ds.getDevices(),e=>e.status===503&&/连接中断/.test(e.message));complete(h);
});
await test('valid HTTP error envelope preserves status and message',async()=>{
 const h=harness(async()=>response({code:409,message:'记录已更新',data:null},409));
 await assert.rejects(h.ds.getDevices(),e=>e.status===409&&e.message==='记录已更新');complete(h);
});
await test('headers never arrive: the same deadline returns 503',async()=>{
 const h=harness(pending);const rejected=assert.rejects(h.ds.getDevices(),e=>e.status===503);
 h.advance(5000);await rejected;assert.equal(h.signal.aborted,true);complete(h);
});
await test('HTTP success with a null or failed envelope is a local 502',async()=>{
 for(const data of [null,{code:409,message:'响应不符合成功合同',data:null}]){
  const h=harness(async()=>response(data));await assert.rejects(h.ds.getDevices(),e=>e.status===502);complete(h);
 }
});
console.log(JSON.stringify({scope:'offline VM with mocked fetch and virtual timers; no backend/browser acceptance',checks:results.length,results},null,2));
