import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {runtimeConfig,allowedHost,allowedOrigin} from '../server/runtime.mjs';
import {Store} from '../server/store.mjs';
import {createApi} from '../server/api.mjs';

test('runtime preserves local defaults and supports the production port and external bind',()=>{
  assert.deepEqual(runtimeConfig({}),{production:false,port:4173,bind:'127.0.0.1'});
  assert.deepEqual(runtimeConfig({NODE_ENV:'production',PORT:'3000'}),{production:true,port:3000,bind:'0.0.0.0'});
  assert.equal(runtimeConfig({NODE_ENV:'production'}).port,4173);
  assert.equal(runtimeConfig({ROMPA_BIND_ADDRESS:'0.0.0.0'}).bind,'0.0.0.0');
  for(const PORT of ['0','65536','-1','abc','3000oops'])assert.throws(()=>runtimeConfig({PORT}));
});
test('Host and Origin reject spoofed authorities and preserve same-origin HTTPS protection',()=>{
  for(const host of ['localhost:4173','127.0.0.1:4173','arquiteturadavida.com.br','www.arquiteturadavida.com.br:443'])assert.ok(allowedHost(host));
  for(const host of ['attacker.test','arquiteturadavida.com.br.attacker.test','localhost@attacker.test','localhost/path','localhost:99999','localhost,attacker.test',undefined])assert.equal(allowedHost(host),null);
  assert.ok(allowedOrigin('http://localhost:4173','localhost:4173',false));
  assert.ok(allowedOrigin('https://www.arquiteturadavida.com.br','www.arquiteturadavida.com.br:443',true));
  for(const origin of ['http://arquiteturadavida.com.br','https://attacker.test','https://www.arquiteturadavida.com.br','https://arquiteturadavida.com.br/path','null',undefined])assert.equal(allowedOrigin(origin,'arquiteturadavida.com.br',true),false);
});
test('production API supports HTTPS setup, session, logout and Secure cookies behind a proxy',async()=>{
  const store=new Store(':memory:'),api=createApi(store,{production:true});
  const server=http.createServer((req,res)=>api(req,res,new URL(req.url,'http://localhost')));
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const call=(host,route,method='GET',origin,cookie)=>new Promise((resolve,reject)=>{
    const req=http.request({hostname:'127.0.0.1',port:server.address().port,path:route,method,headers:{Host:host,'Content-Type':'application/json',...(origin?{Origin:origin}:{}),...(cookie?{Cookie:cookie}:{})}},res=>{
      let data='';res.on('data',chunk=>data+=chunk);res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,body:JSON.parse(data)}));
    });req.on('error',reject);req.end(method==='POST'?JSON.stringify({email:'production@example.test',password:'Production-test-only-123'}):undefined);
  });
  try{
    for(const host of ['arquiteturadavida.com.br','www.arquiteturadavida.com.br'])assert.equal((await call(host,'/api/admin/session')).status,200);
    assert.equal((await call('evil.test','/api/admin/session')).status,403);
    assert.equal((await call('arquiteturadavida.com.br','/api/admin/setup','POST','http://arquiteturadavida.com.br')).status,403);
    const setup=await call('arquiteturadavida.com.br','/api/admin/setup','POST','https://arquiteturadavida.com.br');
    assert.equal(setup.status,200);assert.match(setup.headers['set-cookie'][0],/; Secure/);
    const cookie=setup.headers['set-cookie'][0].split(';')[0];
    assert.equal((await call('arquiteturadavida.com.br','/api/admin/session','GET',undefined,cookie)).body.authenticated,true);
    const logout=await call('arquiteturadavida.com.br','/api/admin/logout','POST','https://arquiteturadavida.com.br',cookie);
    assert.equal(logout.status,200);assert.match(logout.headers['set-cookie'][0],/Max-Age=0; Secure/);
  }finally{await new Promise(resolve=>server.close(resolve));store.close();}
});
