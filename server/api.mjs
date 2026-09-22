import {filterRecords,aggregate,summaryRow} from './metrics.mjs';
import {allowedHost,allowedOrigin} from './runtime.mjs';
const cookieName='rompa_admin';
export const send=(res,status,data,headers={})=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff',...headers});res.end(JSON.stringify(data));};
const failure=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
async function body(req){let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>262144)failure('Solicitação muito grande.',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString()||'{}');}catch{failure('JSON inválido.');}}
function filters(value={}){
  const out={};for(const key of ['search','area','status','source']){if(value[key]!==undefined&&(typeof value[key]!=='string'||value[key].length>254))failure('Filtro inválido.');out[key]=value[key]||'';}
  for(const key of ['from','to']){const date=value[key]||'';if(date&&(!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date))))failure('Data inválida.');out[key]=date;}
  if(out.from&&out.to&&out.from>out.to)failure('A data inicial deve ser anterior à final.');return out;
}
export function createApi(store,{production=process.env.NODE_ENV==='production'}={}){
  const secureCookie=production?'; Secure':'';
  const attempts=new Map();
  const throttle=(key,max,window)=>{const now=Date.now();if(attempts.size>1000)for(const [k,v] of attempts)if(v.until<now)attempts.delete(k);let entry=attempts.get(key);if(!entry||entry.until<now){entry={count:0,until:now+window};attempts.set(key,entry);}if(++entry.count>max)failure('Muitas tentativas. Aguarde alguns minutos.',429);};
  return async(req,res,url)=>{
    if(!url.pathname.startsWith('/api/'))return false;
    try{
      const host=req.headers.host||'';if(!allowedHost(host))failure('Host inválido.',403);
      if(!['GET','HEAD'].includes(req.method)){
        if(!allowedOrigin(req.headers.origin,host,production))failure('Origem não autorizada.',403);
        if(!req.headers['content-type']?.startsWith('application/json'))failure('Use JSON.',415);
      }
      const token=(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(`${cookieName}=`))?.slice(cookieName.length+1);
      const authorized=store.authenticated(token),route=url.pathname;
      if(route==='/api/admin/session'&&req.method==='GET'){send(res,200,{authenticated:authorized,needsSetup:!store.hasAdmin()});return true;}
      if(['/api/admin/setup','/api/admin/login'].includes(route)&&req.method==='POST'){
        throttle(`login:${req.socket.remoteAddress}`,10,10*60000);const data=await body(req);
        if(route.endsWith('/setup'))store.setup(data.email,data.password);
        const session=store.login(data.email,data.password);send(res,200,{authenticated:true},{'Set-Cookie':`${cookieName}=${session}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=28800${secureCookie}`});return true;
      }
      if(route.startsWith('/api/admin/')){
        if(!authorized)failure('Entre como administrador para continuar.',401);
        if(route==='/api/admin/logout'&&req.method==='POST'){store.logout(token);send(res,200,{ok:true},{'Set-Cookie':`${cookieName}=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0${secureCookie}`});return true;}
        if(route==='/api/admin/query'&&req.method==='POST'){
          const data=await body(req),f=filters(data.filters),all=store.rows(),rows=filterRecords(all,f);const page=Math.max(1,Math.min(Math.ceil(rows.length/15)||1,Number.isSafeInteger(data.page)?data.page:1));
          send(res,200,{metrics:aggregate(rows),records:rows.slice((page-1)*15,page*15).map(summaryRow),total:rows.length,page,pageSize:15,updatedAt:new Date().toISOString(),sources:[...new Set(all.map(r=>r.data.session.utm_source).filter(Boolean))].sort(),filters:f});return true;
        }
        const match=route.match(/^\/api\/admin\/assessments\/([0-9a-f-]{36})$/);
        if(match&&req.method==='GET'){send(res,200,store.detail(match[1]));return true;}
        if(match&&req.method==='DELETE'){await body(req);store.remove(match[1],true);send(res,200,{ok:true});return true;}
        failure('Rota não encontrada.',404);
      }
      if(route==='/api/assessments'&&req.method==='POST'){throttle(`register:${req.socket.remoteAddress}`,100,60000);send(res,201,store.register(await body(req)));return true;}
      const match=route.match(/^\/api\/assessments\/([0-9a-f-]{36})$/);
      if(match){const ownerToken=(req.headers.authorization||'').replace(/^Bearer /,'');
        if(req.method==='PUT'){const data=await body(req);send(res,200,store.save(match[1],ownerToken,data.revision,data.state));return true;}
        if(req.method==='DELETE'){await body(req);store.owner(match[1],ownerToken);store.remove(match[1]);send(res,200,{ok:true});return true;}
      }
      failure('Rota não encontrada.',404);
    }catch(error){const status=error.status||500;if(status===500)console.error('API error:',error);send(res,status,{error:status===500?'Não foi possível concluir a operação.':error.message});}
    return true;
  };
}
