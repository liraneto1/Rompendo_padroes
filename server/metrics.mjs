import {areas,moments,questions,optionsFor,asksSignals} from '../dist/teste/questions.js';
export const statusLabels={in_progress:'Em andamento',completed:'Concluído, sem contato',profile_generated:'Perfil liberado'};
export const day=value=>new Intl.DateTimeFormat('sv-SE',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(value));
export function filterRecords(rows,f={}){
  const term=String(f.search||'').trim().toLocaleLowerCase('pt-BR');
  return rows.filter(r=>{
    const d=day(r.created_at),a=r.data.answers,u=r.data.user;
    return (!f.from||d>=f.from)&&(!f.to||d<=f.to)&&(!f.area||a.area_principal===f.area)&&(!f.status||r.status===f.status)&&(!f.source||r.data.session.utm_source===f.source)&&(!term||[r.id,u?.first_name,u?.email,u?.whatsapp].some(v=>String(v||'').toLocaleLowerCase('pt-BR').includes(term)));
  });
}
export function summaryRow(r){
  const a=r.data.answers,qs=questions.filter(q=>q.id!=='Q08'||asksSignals(a));
  return {id:r.id,created_at:r.created_at,updated_at:r.updated_at,status:r.status,name:r.data.user?.first_name||'Sem contato',area:areas.find(x=>x.value===a.area_principal)?.label||'Não informada',source:r.data.session.utm_source||'Direto / não informado',answered:qs.filter(q=>a[q.key]!==undefined).length,total:qs.length,screen:r.data.screen};
}
export function aggregate(rows){
  const count=fn=>rows.filter(fn).length;
  const started=rows.length,completed=count(r=>!!r.completed_at),leads=count(r=>!!r.data.user),profiles=count(r=>r.profile_seen),clicks=count(r=>r.checkout_clicked);
  const feedback=rows.filter(r=>Number.isInteger(r.data.feedback));
  const distribution=(key,opts)=>({answered:count(r=>r.data.answers[key]!==undefined),items:opts.map(o=>({label:o.label,value:count(r=>{const v=r.data.answers[key];return Array.isArray(v)?v.includes(o.value):v===o.value;})}))});
  const sourceCounts=new Map(),days=new Map();
  for(const r of rows){const source=r.data.session.utm_source||'Direto / não informado';sourceCounts.set(source,(sourceCounts.get(source)||0)+1);const key=day(r.created_at);const item=days.get(key)||{date:key,started:0,completed:0,leads:0};item.started++;if(r.completed_at)item.completed++;if(r.data.user)item.leads++;days.set(key,item);}
  const trend=[...days.values()].sort((a,b)=>a.date.localeCompare(b.date));
  // Preencher dias entre a primeira e última coorte observada; fora desse intervalo não há histórico verificado.
  const daily=[];
  if(trend.length){const last=trend.at(-1).date;let cursor=trend[0].date;while(cursor<=last&&daily.length<3660){daily.push(days.get(cursor)||{date:cursor,started:0,completed:0,leads:0});cursor=new Date(Date.parse(`${cursor}T12:00:00Z`)+86400000).toISOString().slice(0,10);}}
  const questionDist=key=>{const q=questions.find(q=>q.key===key);return distribution(key,optionsFor(q,{}));};
  return {total:started,completed,leads,profiles,clicks,inProgress:count(r=>r.status==='in_progress'),completionRate:started?completed/started:null,captureRate:completed?leads/completed:null,adherence:feedback.length?feedback.filter(r=>r.data.feedback===0).length/feedback.length:null,feedbackCount:feedback.length,
    funnel:[{label:'Iniciados com autorização',value:started},{label:'Concluídos ao menos uma vez',value:completed},{label:'Contatos capturados',value:leads},{label:'Perfis visualizados',value:profiles},{label:'Clique no ebook',value:clicks}],
    areas:distribution('area_principal',areas),moments:distribution('momento_percepcao',moments),triggers:questionDist('gatilhos'),consequences:questionDist('consequencias'),frequency:questionDist('frequencia_percebida'),pause:questionDist('capacidade_pausa'),solutions:questionDist('solucoes_anteriores'),
    feedback:{answered:feedback.length,items:['Sim, muito bem','Em parte','Não muito'].map((label,i)=>({label,value:feedback.filter(r=>r.data.feedback===i).length}))},
    sources:[...sourceCounts].map(([label,value])=>({label,value})).sort((a,b)=>b.value-a.value),daily,
    lastActivity:rows.reduce((latest,r)=>!latest||r.updated_at>latest?r.updated_at:latest,null),
  };
}
