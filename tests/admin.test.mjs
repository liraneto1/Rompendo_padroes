import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {randomBytes} from 'node:crypto';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {Store,sanitize} from '../server/store.mjs';
import {createApi} from '../server/api.mjs';
import {aggregate,filterRecords,day} from '../server/metrics.mjs';
import {newState,attachLead,recordEvent} from '../dist/teste/engine.js';
import {config} from '../dist/teste/config.js';
function fixture(complete=false){const state=newState({utm_source:'instagram'});state.storage_consent={accepted:true,version:config.privacyVersion};state.screen='Q01';recordEvent(state,'test_start');if(complete){state.answers={area_principal:'PROJETOS_OBJETIVOS',frase_espelho:'P01',padrao_declarado:'Começo projetos e abandono.',frequencia_percebida:'FREQUENTE',tempo_percebido:'ANOS',gatilhos:['FRUSTRACAO'],percepcao_sinais:'NAO',momento_percepcao:'AFTER',capacidade_pausa:'RARAMENTE',resposta_recorrente:'Deixo de lado.',consequencias:['ABANDONO'],prioridade_mudanca:'Concluir um projeto.',resultado_desejado:'Terminar o que começo.',solucoes_anteriores:['LIVROS']};state.screen='complete';}return state;}
const register=(store,state)=>store.register({id:state.assessment.id,session_id:state.session.id,token:randomBytes(32).toString('hex'),state});
test('configuração única, senha com hash e sessão expirada',()=>{
  const s=new Store(':memory:');try{assert.throws(()=>s.setup('admin@example.test','curta'));s.setup('admin@example.test','Password-for-tests-123');assert.throws(()=>s.setup('b@example.test','Password-for-tests-123'));assert.throws(()=>s.login('admin@example.test','errada'));const token=s.login('admin@example.test','Password-for-tests-123');assert.ok(s.authenticated(token));assert.ok(!s.db.prepare('SELECT password_hash FROM admin').get().password_hash.includes('Password'));s.db.prepare('UPDATE auth_sessions SET expires=0').run();assert.equal(s.authenticated(token),false);}finally{s.close();}
});
test('consentimento e validação de servidor não podem ser ignorados',()=>{
  const a=fixture();delete a.storage_consent;assert.throws(()=>sanitize(a));a.storage_consent={accepted:true,version:config.privacyVersion};a.answers.area_principal='INVALID';assert.throws(()=>sanitize(a));a.answers={gatilhos:['CRITICA','PRESSAO','CANSACO','FRUSTRACAO']};assert.throws(()=>sanitize(a));a.answers={padrao_declarado:'a'.repeat(401)};assert.throws(()=>sanitize(a));
});
test('cadastro idempotente, escrita isolada e rejeição de snapshots antigos',()=>{
  const s=new Store(':memory:');try{const a=fixture(),token=randomBytes(32).toString('hex'),input={id:a.assessment.id,session_id:a.session.id,token,state:a};const first=s.register(input);assert.deepEqual(s.register(input),first);assert.equal(s.rows().length,1);assert.throws(()=>s.save(first.id,randomBytes(32).toString('hex'),2,a));a.answers.area_principal='FAMILIA';s.save(first.id,token,2,a);assert.equal(s.rows()[0].data.answers.area_principal,'FAMILIA');s.save(first.id,token,1,fixture());assert.equal(s.rows()[0].data.answers.area_principal,'FAMILIA');assert.throws(()=>s.register({...input,token:randomBytes(32).toString('hex')}));}finally{s.close();}
});
test('resultado, contato e consentimento são armazenados sem confiar no perfil do cliente',()=>{
  const s=new Store(':memory:');try{const a=fixture(true);attachLead(a,{first_name:'Teste',whatsapp:'5511999999999',privacy_acceptance:true,marketing_consent:false});a.profile={pattern:'CONTEÚDO FALSO'};a.screen='profile';recordEvent(a,'profile_viewed');a.feedback=0;register(s,a);const row=s.rows()[0];assert.equal(row.status,'profile_generated');assert.equal(row.data.profile.pattern,a.answers.padrao_declarado);assert.equal(row.data.user.marketing_consent,false);assert.ok(row.data.user.consented_at);assert.equal(row.profile_seen,1);assert.equal(row.data.feedback,0);}finally{s.close();}
});
test('metadados de eventos não armazenam contato ou texto arbitrário',()=>{const a=fixture();a.events[0].metadata={email:'privado@example.test',text:'privado',question_id:'Q01'};assert.deepEqual(sanitize(a).events[0].metadata,{question_id:'Q01'});});
test('exclusão remove respostas e impede ressuscitar um registro',()=>{
  const s=new Store(':memory:');try{const a=fixture(true),c=register(s,a);s.remove(c.id,true);assert.equal(s.rows().length,0);const raw=s.db.prepare('SELECT payload FROM assessments WHERE id=?').get(c.id);assert.equal(raw.payload,'{}');assert.throws(()=>s.save(c.id,c.token,2,a),e=>e.status===410);assert.throws(()=>s.register({id:c.id,session_id:a.session.id,token:c.token,state:a}),e=>e.status===410);}finally{s.close();}
});
test('banco persiste entre reinícios',()=>{
  const dir=mkdtempSync(path.join(tmpdir(),'rompa-admin-test-')),file=path.join(dir,'test.sqlite');try{let s=new Store(file);register(s,fixture());s.close();s=new Store(file);assert.equal(s.rows().length,1);s.close();}finally{rmSync(dir,{recursive:true});}
});
test('métricas usam questionários distintos, denominadores e filtros coerentes',()=>{
  const s=new Store(':memory:');try{register(s,fixture());register(s,fixture(true));const a=fixture(true);attachLead(a,{first_name:'Ana',whatsapp:'5511999999999',privacy_acceptance:true});a.screen='profile';a.feedback=0;recordEvent(a,'profile_viewed');recordEvent(a,'profile_viewed');register(s,a);const rows=s.rows(),m=aggregate(rows);assert.equal(m.total,3);assert.equal(m.completed,2);assert.equal(m.leads,1);assert.equal(m.profiles,1);assert.equal(m.completionRate,2/3);assert.equal(m.captureRate,1/2);assert.equal(m.adherence,1);assert.equal(m.feedbackCount,1);assert.equal(filterRecords(rows,{search:'Ana'}).length,1);assert.equal(filterRecords(rows,{status:'in_progress'}).length,1);assert.equal(filterRecords(rows,{area:'FAMILIA'}).length,0);assert.equal(aggregate([]).completionRate,null);}finally{s.close();}
});
test('calendário respeita Brasília e preenche lacunas no histórico observado',()=>{
  assert.equal(day('2026-09-22T01:00:00Z'),'2026-09-21');const s=new Store(':memory:');try{register(s,fixture());register(s,fixture());const rows=s.rows();rows[0].created_at='2026-09-19T12:00:00Z';rows[1].created_at='2026-09-21T12:00:00Z';assert.equal(aggregate(rows).daily.length,3);assert.equal(aggregate(rows).daily[1].started,0);assert.equal(filterRecords(rows,{from:'2026-09-20',to:'2026-09-21'}).length,1);}finally{s.close();}
});
test('API protege leituras, origem, sessão e logout',async()=>{
  const store=new Store(':memory:'),api=createApi(store),server=http.createServer(async(req,res)=>{if(!await api(req,res,new URL(req.url,'http://localhost'))){res.writeHead(404);res.end();}});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;
  const call=(path,method='GET',value,headers={})=>fetch(base+path,{method,headers:{'Content-Type':'application/json',Origin:base,...headers},...(value?{body:JSON.stringify(value)}:{})});
  try{
    assert.equal((await call('/api/admin/query','POST',{})).status,401);
    assert.equal((await call('/api/admin/setup','POST',{email:'a@example.test',password:'Password-for-tests-123'},{Origin:'https://attacker.test'})).status,403);
    const setup=await call('/api/admin/setup','POST',{email:'a@example.test',password:'Password-for-tests-123'});assert.equal(setup.status,200);const setCookie=setup.headers.get('set-cookie');assert.match(setCookie,/HttpOnly/);assert.match(setCookie,/SameSite=Strict/);const cookie=setCookie.split(';')[0];
    assert.equal((await call('/api/admin/query','POST',{}, {Cookie:cookie})).status,200);
    const a=fixture(true),registration=await call('/api/assessments','POST',{id:a.assessment.id,session_id:a.session.id,token:randomBytes(32).toString('hex'),state:a});assert.equal(registration.status,201);const cred=await registration.json();
    assert.equal((await call(`/api/admin/assessments/${cred.id}`)).status,401);
    assert.equal((await call(`/api/assessments/${cred.id}`,'PUT',{revision:2,state:a})).status,401);
    assert.equal((await call(`/api/assessments/${cred.id}`,'PUT',{revision:2,state:a},{Authorization:`Bearer ${cred.token}`})).status,200);
    const detail=await call(`/api/admin/assessments/${cred.id}`,'GET',undefined,{Cookie:cookie});assert.equal(detail.status,200);
    assert.equal((await call('/api/admin/query','POST',{filters:{from:'2026-09-22',to:'2026-09-20'}},{Cookie:cookie})).status,400);
    assert.equal((await call('/api/admin/logout','POST',{}, {Cookie:cookie})).status,200);assert.equal((await call('/api/admin/query','POST',{}, {Cookie:cookie})).status,401);
  }finally{await new Promise(resolve=>server.close(resolve));store.close();}
});
