import http from 'node:http';
import {readFile, realpath} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root = await realpath(fileURLToPath(new URL('../frontend',import.meta.url)));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8'};
const server=http.createServer(async(req,res)=>{
  if(req.url.startsWith('/api/')){
    const proxy=http.request({hostname:'127.0.0.1',port:8098,path:req.url,method:req.method,headers:{...req.headers,host:'127.0.0.1:8098'}},r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res)});
    proxy.on('error',()=>{if(!res.headersSent)res.writeHead(502,{'content-type':'application/json'});res.end(JSON.stringify({code:502,message:'后端未连接。检查 B-后端终端是否已启动。',data:null}))});
    req.pipe(proxy);return;
  }
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return}
  try{
    const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(name.split('/').some(p=>p.startsWith('.')||p.includes('\\')))throw Error('Forbidden');
    const resolved=await realpath(path.join(root,name==='/'?'index.html':name));
    if(!resolved.startsWith(root+path.sep))throw Error('Forbidden');
    const data=await readFile(resolved);
    res.writeHead(200,{'content-type':types[path.extname(resolved)]||'application/octet-stream','cache-control':'no-store','x-content-type-options':'nosniff'});
    res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404,{'content-type':'text/plain; charset=utf-8'});res.end('找不到页面文件')}
});
server.on('error',e=>{console.error(e.code==='EADDRINUSE'?'5188端口已被使用；先核对自己的 A-页面终端，不停止别人的进程。':e.message);process.exitCode=1});
server.listen(5188,'127.0.0.1',()=>console.log('页面已启动：http://127.0.0.1:5188 （保持此终端运行；结束时 Ctrl+C）'));
