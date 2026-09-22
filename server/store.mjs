import {DatabaseSync} from 'node:sqlite';
import {mkdirSync} from 'node:fs';
import path from 'node:path';
import {randomBytes,createHash,scryptSync,timingSafeEqual} from 'node:crypto';
import {questions,asksSignals} from '../dist/teste/questions.js';
import {validate,validateAssessment,validateLead,buildProfile,flow} from '../dist/teste/engine.js';
import {config} from '../dist/teste/config.js';
const hash=s=>createHash('sha256').update(s).digest('hex');
const idOK=v=>typeof v==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const clean=(v,n=200)=>typeof v==='string'?v.slice(0,n):'';
const knownEvents=new Set(['landing_view','test_start','area_selected','mirror_selected','pattern_written','localizar_completed','descrever_completed','investigar_completed','priorizar_completed','perception_moment_selected','test_completed','lead_view','lead_started','lead_submitted','profile_generated','profile_viewed','loop_viewed','interruption_window_viewed','ebook_cta_clicked','checkout_started','profile_feedback','answer_saved']);
export function sanitize(input){
  if(!input||typeof input!=='object'||Array.isArray(input)||input.version!==config.questionnaireVersion)fail('Versão do questionário incompatível.');
  if(input.storage_consent?.accepted!==true||input.storage_consent.version!==config.privacyVersion)fail('Autorize o armazenamento antes de continuar.');
  const a=input.answers;if(!a||typeof a!=='object'||Array.isArray(a))fail('Respostas inválidas.');
  const answers={};
  for(const q of questions){
    if(q.id==='Q08'&&!asksSignals(a))continue;
    if(a[q.key]===undefined)continue;
    const other=clean(a[`${q.key}_outro`],201),detail=clean(a[`${q.key}_detalhe`],401);
    const error=validate(q,a[q.key],a,other,detail);if(error)fail(`${q.id}: ${error}`);
    answers[q.key]=a[q.key];
    if(q.other&&(Array.isArray(a[q.key])?a[q.key]:[a[q.key]]).includes('OUTRO'))answers[`${q.key}_outro`]=other.trim();
    if(q.optionalDetail&&detail)answers[`${q.key}_detalhe`]=detail.trim();
  }
  if(!flow(answers).includes(input.screen))fail('Etapa inválida.');
  const complete=!validateAssessment(answers);let user=null;
  if(input.user){
    const u=input.user;
    if(typeof u.first_name!=='string'||typeof u.whatsapp!=='string'||(u.email!==undefined&&typeof u.email!=='string'))fail('Contato inválido.');
    if(u.privacy_version!==config.privacyVersion||u.first_name.length>60||u.whatsapp.length>25||(u.email||'').length>254||validateLead(u)||!complete)fail('Revise o contato e o consentimento.');
    user={first_name:u.first_name.trim(),whatsapp:u.whatsapp.replace(/\D/g,''),email:(u.email||'').trim(),privacy_acceptance:true,marketing_consent:u.marketing_consent===true,privacy_version:config.privacyVersion};
  }
  const events=[];
  for(const e of Array.isArray(input.events)?input.events.slice(-1000):[]){
    if(!idOK(e.id)||!knownEvents.has(e.event_name))continue;
    const metadata={};if(/^Q\d{2}$/.test(e.metadata?.question_id))metadata.question_id=e.metadata.question_id;
    events.push({id:e.id,event_name:e.event_name,created_at:clean(e.created_at,30),metadata});
  }
  const session={};for(const key of ['utm_source','utm_medium','utm_campaign','utm_content','device'])session[key]=clean(input.session?.[key]);
  try{session.referrer=input.session?.referrer?new URL(input.session.referrer).origin:'';}catch{session.referrer='';}
  return {version:config.questionnaireVersion,answers,screen:input.screen,session,user,events,storage_consent:{accepted:true,version:config.privacyVersion},...(Number.isInteger(input.feedback)&&input.feedback>=0&&input.feedback<=2&&user?{feedback:input.feedback}:{}),profile:complete&&user?buildProfile(answers):null};
}
export class Store{
  constructor(filename){
    if(filename!==':memory:')mkdirSync(path.dirname(filename),{recursive:true});
    this.db=new DatabaseSync(filename);this.db.exec(`PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
      CREATE TABLE IF NOT EXISTS admin(id INTEGER PRIMARY KEY CHECK(id=1),email TEXT NOT NULL,salt TEXT NOT NULL,password_hash TEXT NOT NULL,created_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS auth_sessions(token_hash TEXT PRIMARY KEY,expires INTEGER NOT NULL);
      CREATE TABLE IF NOT EXISTS assessments(id TEXT PRIMARY KEY,session_id TEXT UNIQUE NOT NULL,token_hash TEXT,revision INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,completed_at TEXT,status TEXT NOT NULL DEFAULT 'in_progress',profile_seen INTEGER NOT NULL DEFAULT 0,checkout_clicked INTEGER NOT NULL DEFAULT 0,payload TEXT NOT NULL,deleted INTEGER NOT NULL DEFAULT 0);
      CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,created_at TEXT NOT NULL,action TEXT NOT NULL,subject TEXT);
      CREATE INDEX IF NOT EXISTS assessments_created ON assessments(created_at);
    `);
  }
  audit(action,subject=''){this.db.prepare('INSERT INTO audit(created_at,action,subject) VALUES(?,?,?)').run(new Date().toISOString(),action,subject);}
  hasAdmin(){return !!this.db.prepare('SELECT id FROM admin').get();}
  setup(email,password){
    if(this.hasAdmin())fail('Administrador já configurado.',409);
    if(typeof email!=='string'||email.length>254||!/^\S+@\S+\.\S+$/.test(email)||typeof password!=='string'||password.length<12||password.length>128)fail('Informe email válido e senha de 12 a 128 caracteres.');
    const salt=randomBytes(24).toString('hex');const passwordHash=scryptSync(password,salt,64).toString('hex');
    this.db.prepare('INSERT INTO admin VALUES(1,?,?,?,?)').run(email.toLowerCase().trim(),salt,passwordHash,new Date().toISOString());this.audit('admin_created');
  }
  login(email,password){
    const admin=this.db.prepare('SELECT * FROM admin').get();
    if(!admin||typeof password!=='string'||password.length>128||typeof email!=='string')fail('Email ou senha incorretos.',401);
    const actual=scryptSync(password,admin.salt,64);const matches=timingSafeEqual(actual,Buffer.from(admin.password_hash,'hex'));
    if(!matches||email.toLowerCase().trim()!==admin.email)fail('Email ou senha incorretos.',401);
    const token=randomBytes(32).toString('hex');this.db.prepare('DELETE FROM auth_sessions WHERE expires < ?').run(Date.now());this.db.prepare('INSERT INTO auth_sessions VALUES(?,?)').run(hash(token),Date.now()+8*60*60*1000);this.audit('login');return token;
  }
  authenticated(token){return typeof token==='string'&&token.length===64&&!!this.db.prepare('SELECT 1 FROM auth_sessions WHERE token_hash=? AND expires>?').get(hash(token),Date.now());}
  logout(token){if(token)this.db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(hash(token));}
  register(input){
    if(!idOK(input.id)||!idOK(input.session_id))fail('Identificador inválido.');
    if(typeof input.token!=='string'||! /^[a-f0-9]{64}$/.test(input.token))fail('Credencial inválida.');
    const data=sanitize(input.state),now=new Date().toISOString();
    const previous=this.db.prepare('SELECT * FROM assessments WHERE id=? OR session_id=?').get(input.id,input.session_id);
    if(previous){if(previous.id!==input.id||previous.session_id!==input.session_id||previous.token_hash!==hash(input.token))fail('Esta sessão já está registrada.',409);if(previous.deleted)fail('Este registro foi excluído pelo administrador.',410);return {id:input.id,token:input.token,revision:previous.revision};}
    const token=input.token;data.storage_consent.accepted_at=now;
    this.db.prepare('INSERT INTO assessments(id,session_id,token_hash,created_at,updated_at,payload) VALUES(?,?,?,?,?,?)').run(input.id,input.session_id,hash(token),now,now,JSON.stringify(data));
    this.save(input.id,token,1,input.state);return {id:input.id,token,revision:1};
  }
  owner(id,token){
    const r=this.db.prepare('SELECT * FROM assessments WHERE id=?').get(id);
    if(!r||typeof token!=='string'||token.length!==64||r.token_hash!==hash(token))fail('Sessão não autorizada.',401);
    if(r.deleted)fail('Este registro foi excluído pelo administrador.',410);
    return r;
  }
  save(id,token,revision,input){
    const row=this.owner(id,token);if(!Number.isSafeInteger(revision)||revision<1)fail('Revisão inválida.');
    if(revision<=row.revision)return {revision:row.revision,unchanged:true};
    const data=sanitize(input),old=JSON.parse(row.payload),now=new Date().toISOString();data.storage_consent.accepted_at=old.storage_consent.accepted_at;
    if(data.user)data.user.consented_at=old.user&&old.user.marketing_consent===data.user.marketing_consent?(old.user.consented_at||now):now;
    const complete=!validateAssessment(data.answers),names=new Set(data.events.map(e=>e.event_name));
    const status=complete?(data.user?'profile_generated':'completed'):'in_progress';
    this.db.prepare('UPDATE assessments SET payload=?,revision=?,updated_at=?,completed_at=?,status=?,profile_seen=?,checkout_clicked=? WHERE id=?').run(JSON.stringify(data),revision,now,row.completed_at||(complete?now:null),status,row.profile_seen||(data.user&&names.has('profile_viewed')?1:0),row.checkout_clicked||(data.user&&names.has('ebook_cta_clicked')?1:0),id);
    return {revision};
  }
  rows(){return this.db.prepare('SELECT id,created_at,updated_at,completed_at,status,profile_seen,checkout_clicked,payload FROM assessments WHERE deleted=0 ORDER BY created_at DESC,id').all().map(({payload,...r})=>({...r,data:JSON.parse(payload)}));}
  detail(id){const r=this.rows().find(r=>r.id===id);if(!r)fail('Questionário não encontrado.',404);this.audit('assessment_viewed',id);return r;}
  remove(id,admin=false){const r=this.db.prepare('SELECT id FROM assessments WHERE id=? AND deleted=0').get(id);if(!r)fail('Questionário não encontrado.',404);this.db.prepare("UPDATE assessments SET deleted=1,payload='{}',status='deleted',profile_seen=0,checkout_clicked=0,completed_at=NULL WHERE id=?").run(id);this.audit(admin?'assessment_deleted_by_admin':'assessment_deleted_by_participant',id);}
  close(){this.db.close();}
}
