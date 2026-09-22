import http from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {Store} from '../server/store.mjs';
import {createApi} from '../server/api.mjs';
import {runtimeConfig,allowedHost} from '../server/runtime.mjs';
const runtime=runtimeConfig();
const root=path.resolve(fileURLToPath(new URL('../dist/',import.meta.url)));
const store=new Store(process.env.ROMPA_DB_PATH||fileURLToPath(new URL('../.data/rompa.sqlite',import.meta.url)));
const api=createApi(store,runtime);
const mime={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.svg':'image/svg+xml','.webp':'image/webp'};
const server=http.createServer(async(req,res)=>{
  if(!allowedHost(req.headers.host)){res.writeHead(403);res.end();return;}
  let url;try{url=new URL(req.url,'http://localhost');}catch{res.writeHead(400);res.end();return;}
  if(await api(req,res,url))return;
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405);res.end();return;}
  try{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    let file=path.resolve(root,`.${pathname}`);
    const relative=path.relative(root,file);
    if(relative==='..'||relative.startsWith(`..${path.sep}`)||path.isAbsolute(relative)){res.writeHead(403);res.end();return;}
    if((await stat(file)).isDirectory()){
      if(!pathname.endsWith('/')){res.writeHead(302,{Location:`${pathname}/${new URL(req.url,'http://localhost').search}`});res.end();return;}
      file=path.join(file,'index.html');
    }
    const data=await readFile(file);
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'none'"});
    res.end(req.method==='HEAD'?undefined:data);
  }catch{res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Página não encontrada.');}
});
server.listen(runtime.port,runtime.bind,()=>console.log(`ROMPA: ${runtime.bind}:${server.address().port} | Teste: /teste/ | Administração: /admin/`));
function close(){server.close(()=>{store.close();process.exit(0);});}
process.on('SIGINT',close);process.on('SIGTERM',close);
