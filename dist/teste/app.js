import {config,checkoutFor} from './config.js';
import {questions,optionsFor,blocks,moments} from './questions.js';
import {newState,flow,saveAnswer,toggleChoice,validateAssessment,buildProfile,attachLead,recordEvent,restore} from './engine.js';
import {createSync} from './remote.js';
const root=document.querySelector('#app');
const STORAGE='rompa.assessment.v1';
const escape=value=>String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let state;
try { state=restore(sessionStorage.getItem(STORAGE)); } catch { document.querySelector('#storage-warning').hidden=false; }
if(!state){
  const params=new URLSearchParams(location.search);
  const source=Object.fromEntries(['utm_source','utm_medium','utm_campaign','utm_content'].map(key=>[key,(params.get(key)||'').slice(0,200)]));
  let referrer=''; try {referrer=document.referrer ? new URL(document.referrer).origin : '';}catch{}
  state=newState({...source,referrer,device:matchMedia('(max-width: 700px)').matches?'mobile':'desktop'});
  recordEvent(state,'landing_view');
}
let processTimer, observer;
function cache(){try{sessionStorage.setItem(STORAGE,JSON.stringify(state));}catch{document.querySelector('#storage-warning').hidden=false;}}
function makeSync(){return createSync(()=>state,credential=>{state.remote=credential;cache();},status=>{
  let el=document.querySelector('#sync-status');if(!el){el=document.createElement('div');el.id='sync-status';el.className='prototype';el.setAttribute('role','status');document.querySelector('#storage-warning').after(el);}
  el.textContent={saving:'Salvando respostas…',saved:'Respostas salvas no servidor local.',error:'Não foi possível salvar no servidor. Mantenha esta aba aberta; tentaremos novamente.',deleted:'Este questionário foi excluído na administração. Recomece para criar um novo registro.'}[status];
});}
let sync=makeSync();
function persist(){cache();sync.schedule();}
function event(name,data){recordEvent(state,name,data);persist();}
function go(screen){state.screen=screen;persist();render();window.scrollTo({top:0,behavior:'instant'});root.focus();}
function next(){const steps=flow(state.answers);go(steps[steps.indexOf(state.screen)+1]);}
function previous(){if(state.screen==='capture'){go('complete');return;}const steps=flow(state.answers);go(steps[Math.max(0,steps.indexOf(state.screen)-1)]);}
function button(text,attr=''){return `<button class="primary" ${attr}>${text}<span aria-hidden="true">→</span></button>`;}
function controls(){return `<div class="utility"><button type="button" class="back" data-back>← Voltar</button><button type="button" class="text-button" data-reset>Apagar respostas e recomeçar</button></div>`;}
function bindCommon(){
  root.querySelector('[data-back]')?.addEventListener('click',previous);
  root.querySelector('[data-reset]')?.addEventListener('click',async()=>{
    if(!confirm('Apagar as respostas e o contato desta sessão e começar um novo teste?'))return;
    try{await sync.remove();}catch{alert('Não foi possível excluir o registro no servidor. Tente novamente com o servidor disponível.');return;}
    try{sessionStorage.removeItem(STORAGE);}catch{}
    state=newState({utm_source:state.session.utm_source,utm_medium:state.session.utm_medium,utm_campaign:state.session.utm_campaign,utm_content:state.session.utm_content,referrer:state.session.referrer,device:state.session.device});
    sync=makeSync();document.querySelector('#sync-status')?.remove();event('landing_view');go('landing');
  });
}
function progress(block){
  const sequence=questions.filter(q=>flow(state.answers).includes(q.id));
  const index=sequence.findIndex(q=>q.id===state.screen);
  const count=Math.max(0,index);
  return `<div class="progress-head"><span>${escape(blocks[block])}</span><span>${count+1} / ${sequence.length}</span></div><progress aria-label="Progresso das perguntas" value="${count}" max="${sequence.length}"></progress><ol class="block-list">${blocks.map((b,i)=>`<li class="${i===block?'current':i<block?'done':''}">${i+1}<span> ${b}</span></li>`).join('')}</ol>`;
}
const cards={
  preparation:{eyebrow:'UM MOMENTO PARA VOCÊ',title:'Antes de começar…',body:'<ul class="preparation-list"><li>Responda pensando no que realmente costuma acontecer.</li><li>Não existem respostas certas ou erradas.</li><li>Você pode voltar e ajustar suas respostas.</li></ul><blockquote>O mais importante aqui é a sua honestidade com você mesmo.</blockquote>',cta:'Entendi. Vamos começar'},
  localizar:{eyebrow:'01 / LOCALIZAR',title:'Onde a repetição aparece?',body:'<p>Escolha uma área da sua vida e uma situação que costuma se repetir. Pense no que mais incomoda você hoje.</p>',cta:'Localizar minha situação'},
  descrever:{eyebrow:'02 / DESCREVER',title:'Sua realidade.<br>Sua linguagem.',body:'<p>Agora, conte essa situação com as suas palavras. Não precisa encontrar a frase perfeita.</p>',cta:'Contar o que acontece'},
  microvictory:{eyebrow:'UM PRIMEIRO PASSO',title:'Você colocou a repetição em palavras.',body:'<p>Dar nome ao que você percebe ajuda a tornar essa situação mais visível.</p>',cta:'Continuar observando'},
  investigar:{eyebrow:'03 / INVESTIGAR',title:'Olhe para o que vem antes e depois.',body:'<p>Vamos observar o contexto, seus sinais e a resposta que costuma acontecer. Descreva apenas o que você reconhece.</p>',cta:'Observar meu ciclo'},
  microinsight:{eyebrow:'UM PONTO DE PERCEPÇÃO',title:'Quando você percebe faz diferença.',body:'<p>Reconhecer esse momento ajuda a observar onde pode existir espaço para uma escolha.</p>',cta:'Continuar'},
  priorizar:{eyebrow:'04 / PRIORIZAR',title:'Uma situação.<br>Um ponto de partida.',body:'<p>Entre o que você contou, escolha o que gostaria de fazer diferente primeiro.</p>',cta:'Escolher meu foco'},
  complete:{eyebrow:'100% / TESTE CONCLUÍDO',title:'Pronto. Você reconstruiu uma situação.',body:'<p>Você observou o que se repete, o que vem antes e o que costuma acontecer depois.</p><ul class="complete-list"><li>✓ Localizar</li><li>✓ Descrever</li><li>✓ Investigar</li><li>✓ Priorizar</li></ul>',cta:'Organizar meu perfil'},
};
function render(){
  clearTimeout(processTimer); observer?.disconnect();
  root.className=state.screen==='profile'?'profile-page':'';
  if(state.screen==='landing'){
    root.innerHTML=`<section class="landing"><div class="landing-copy"><p class="eyebrow">EU FIZ DE NOVO.</p><h1>O que continua<br>se repetindo<br><em>na sua vida?</em></h1><p class="lead">As situações mudam. Mas algumas histórias parecem terminar do mesmo jeito.</p><p>Um ponto de partida para reconhecer uma repetição e quando você costuma percebê-la.</p>${button('Começar meu teste','id="start"')}<div class="benefits"><span>Gratuito</span><span>No seu ritmo</span><span>Perfil personalizado</span></div></div><div class="landing-art"><div class="art-caption"><span class="mini-cycle" aria-hidden="true">◔</span><p>PERCEBA ANTES.<br><strong>AJA DIFERENTE.</strong></p></div></div></section>`;
    root.querySelector('#start').onclick=()=>{state.assessment.started_at=new Date().toISOString();state.assessment.status='in_progress';event('test_start');next();};
  }else if(cards[state.screen]){
    const card=cards[state.screen];
    root.innerHTML=`<section class="step transition">${controls()}<p class="eyebrow">${card.eyebrow}</p><h1>${card.title}</h1>${card.body}${button(card.cta,'id="continue"')}</section>`;
    root.querySelector('#continue').onclick=next;
    if(state.screen==='preparation'){
      const consent=document.createElement('label');consent.className='consent';consent.innerHTML=`<input id="storage-consent" type="checkbox" ${state.storage_consent?.accepted?'checked':''}><span>Li a <a href="./privacidade.html" target="_blank" rel="noopener">privacidade desta prévia</a> e autorizo salvar minhas respostas no servidor local para gerar meu perfil e permitir a consulta administrativa. Usarei dados fictícios nesta validação.</span>`;
      root.querySelector('#continue').before(consent);const button=root.querySelector('#continue'),input=consent.querySelector('input');button.disabled=!input.checked;
      input.onchange=()=>{button.disabled=!input.checked;};button.onclick=()=>{state.storage_consent={accepted:true,version:config.privacyVersion};next();};
    }
  }else if(state.screen==='processing'){
    const invalid=validateAssessment(state.answers);if(invalid){go(invalid.question);return;}
    root.innerHTML='<section class="step processing" role="status"><div class="loader" aria-hidden="true"></div><p class="eyebrow">SUAS RESPOSTAS, ORGANIZADAS</p><h1>Preparando seu<br>Perfil de Padrões.</h1><p>Reunindo o que você contou sobre sua situação.</p></section>';
    processTimer=setTimeout(()=>go('capture'),config.processingMs);
  }else if(state.screen==='capture')renderCapture();
  else if(state.screen==='profile')renderProfile();
  else renderQuestion(questions.find(q=>q.id===state.screen));
  bindCommon();persist();
}
function renderQuestion(q){
  if(!q){go('landing');return;}
  let value=state.answers[q.key] ?? (q.type==='multi'?[]:'');
  const opts=optionsFor(q,state.answers);
  const otherSelected=()=>q.other&&(Array.isArray(value)?value:[value]).includes('OUTRO');
  root.innerHTML=`<section class="step question">${controls()}${progress(q.block)}<p class="question-intro">${escape(q.intro||'')}</p><form novalidate><fieldset><legend><h1>${escape(q.title)}</h1></legend><p id="help" class="help">${escape(q.help || (q.type==='multi' ? (q.limit?`Escolha de 1 a ${q.limit} opções.`:'Escolha uma ou mais opções.'):'Escolha uma opção.'))}</p>${q.type==='text'?`<label class="sr-only" for="answer">Sua resposta</label><textarea id="answer" aria-describedby="help counter" maxlength="${q.max}" placeholder="Escreva aqui…" rows="5">${escape(value)}</textarea><p class="counter" id="counter">${value.length} / ${q.max}</p>`:`<div class="options">${opts.map(o=>`<label class="option"><input type="${q.type==='multi'?'checkbox':'radio'}" name="answer" value="${o.value}" ${(Array.isArray(value)?value.includes(o.value):value===o.value)?'checked':''}><span>${escape(o.label)}</span><span class="check" aria-hidden="true"></span></label>`).join('')}</div>`}<div id="other-wrap" ${otherSelected()?'':'hidden'}><label for="other">Qual? <small>Até 200 caracteres</small></label><input type="text" id="other" maxlength="200" value="${escape(state.answers[`${q.key}_outro`]||'')}"></div>${q.optionalDetail?`<label for="detail">Quer acrescentar algo? <small>Opcional</small></label><textarea id="detail" maxlength="400" rows="3">${escape(state.answers[`${q.key}_detalhe`]||'')}</textarea>`:''}</fieldset><p id="error" class="error" role="alert"></p>${button('Continuar','type="submit"')}</form></section>`;
  const form=root.querySelector('form');
  function sync(){
    root.querySelectorAll('input[name=answer]').forEach(input=>{input.checked=Array.isArray(value)?value.includes(input.value):value===input.value;input.disabled=q.type==='multi'&&q.limit&&value.length>=q.limit&&!value.includes(input.value)&&!q.exclusive?.includes(input.value);});
    root.querySelector('#other-wrap').hidden=!otherSelected();
  }
  root.querySelectorAll('input[name=answer]').forEach(input=>input.addEventListener('change',()=>{value=q.type==='multi'?toggleChoice(q,value,input.value):input.value;sync();root.querySelector('#error').textContent='';}));
  root.querySelector('#answer')?.addEventListener('input',e=>{value=e.target.value;root.querySelector('#counter').textContent=`${value.length} / ${q.max}`;});
  sync();
  form.addEventListener('submit',e=>{
    e.preventDefault();
    try{saveAnswer(state,q,value,root.querySelector('#other').value,root.querySelector('#detail')?.value||'');}
    catch(error){root.querySelector('#error').textContent=error.message;root.querySelector('#answer, input:not(:disabled)')?.focus();return;}
    const named={Q01:'area_selected',Q02:'mirror_selected',Q03:'pattern_written',Q09:'perception_moment_selected'};
    event('answer_saved',{question_id:q.id});
    if(named[q.id])event(named[q.id],q.type==='text'?{}:{value});
    const completed={Q02:'localizar_completed',Q05:'descrever_completed',Q12:'investigar_completed',Q15:'priorizar_completed'};
    if(completed[q.id])event(completed[q.id]);
    if(q.id==='Q15'){
      const invalid=validateAssessment(state.answers);if(invalid){go(invalid.question);return;}
      state.assessment.status='completed';state.assessment.completed_at=new Date().toISOString();event('test_completed');
    }
    next();
  });
}
function renderCapture(){
  event('lead_view');const user=state.user || {};
  root.innerHTML=`<section class="step capture">${controls()}<p class="eyebrow">SEU PERFIL ESTÁ PRONTO</p><h1>Um retrato do que<br>você contou.</h1><p>Preencha para liberar seu perfil nesta prévia. Use dados fictícios: não enviaremos cópias nem mensagens.</p><form novalidate><label for="name">Como podemos chamar você?</label><input id="name" name="first_name" autocomplete="given-name" maxlength="60" placeholder="Seu primeiro nome" value="${escape(user.first_name||'')}"><label for="phone">WhatsApp com código do país e DDD</label><input id="phone" name="whatsapp" type="tel" autocomplete="tel" inputmode="tel" placeholder="+55 11 99999-9999" maxlength="25" value="${escape(user.whatsapp||'')}"><label for="email">Email <small>Opcional</small></label><input id="email" name="email" type="email" autocomplete="email" maxlength="254" value="${escape(user.email||'')}"><label class="consent"><input type="checkbox" name="privacy_acceptance" ${user.privacy_acceptance?'checked':''}><span>Li a <a href="./privacidade.html" target="_blank" rel="noopener">privacidade desta prévia</a> e autorizo o armazenamento do contato e das respostas no servidor local para gerar meu perfil e permitir a consulta administrativa.</span></label><label class="consent"><input type="checkbox" name="marketing_consent" ${user.marketing_consent?'checked':''}><span>Quero receber conteúdos e novidades do ROMPA. <small>Opcional. Nesta prévia, apenas registramos sua escolha.</small></span></label><p class="error" id="error" role="alert"></p>${button('Liberar meu perfil','type="submit"')}</form><p class="micro">Respostas e contato ficam salvos no servidor local e podem ser consultados pelo administrador.</p></section>`;
  const form=root.querySelector('form');let started=false;
  form.addEventListener('input',()=>{if(!started){event('lead_started');started=true;}});
  form.onsubmit=e=>{
    e.preventDefault();const data=new FormData(form);const lead={first_name:data.get('first_name'),whatsapp:data.get('whatsapp'),email:data.get('email'),privacy_acceptance:data.has('privacy_acceptance'),marketing_consent:data.has('marketing_consent')};
    try{attachLead(state,lead);state.profile=buildProfile(state.answers);}
    catch(error){root.querySelector('#error').textContent=error.message;return;}
    event('lead_submitted');event('profile_generated',{ai_status:state.profile.ai_status});state.assessment.status='profile_generated';go('profile');
  };
}
function renderProfile(){
  if(!state.user){go('capture');return;}
  state.profile=buildProfile(state.answers);const p=state.profile;
  const list=values=>values.map(escape).join(' · ');
  const checkout=checkoutFor(state.session.utm_campaign);
  root.innerHTML=`<div class="profile-toolbar"><span>MEU PERFIL DE PADRÕES</span><button class="back" data-print>Salvar / imprimir perfil ↗</button></div><section class="profile-hero"><div><p class="eyebrow">OLÁ, ${escape(state.user.first_name.toLocaleUpperCase('pt-BR'))}.</p><h1>Uma repetição<br>ficou mais <em>visível.</em></h1><p class="lead">Você relatou uma situação que se repete em <strong>${escape(p.area)}</strong>.</p><span class="area-pill">${escape(p.area)}</span></div><div class="voice"><p class="eyebrow">NAS SUAS PALAVRAS</p><blockquote>“${escape(p.pattern)}”</blockquote><p class="micro">Frequência: ${escape(p.frequency)}<br>Tempo percebido: ${escape(p.duration)}</p></div></section><section class="profile-section" data-view="loop_viewed"><p class="eyebrow">01 / O QUE VOCÊ OBSERVOU</p><h2>Seu Loop de Repetição</h2><p>Uma organização das suas respostas, sem atribuir causas ao que você contou.</p><ol class="loop">${[['Gatilho',list(p.triggers)],['Sinais',p.signals.length?list(p.signals):`Sobre perceber sinais: ${escape(p.signalDeclaration)}. Você não descreveu sinais específicos.`],['Resposta',escape(p.response)],['Consequência',list(p.consequences)],['Repetição',escape(p.pattern)]].map(([title,body],i)=>`<li><span class="node">0${i+1}</span><h3>${title}</h3><p>${body}</p></li>`).join('')}</ol></section><section class="profile-section split"><div><p class="eyebrow">02 / QUANDO VOCÊ PERCEBE</p><h2>O seu momento<br>de percepção.</h2><p>${escape(p.momentCopy)}</p><p class="micro">Sobre conseguir pausar: ${escape(p.pause)}.</p></div><ol class="timeline">${moments.map(m=>`<li class="${m.value===p.moment?'selected':''}" ${m.value===p.moment?'aria-current="step"':''}><span class="timeline-dot"></span><span>${escape(m.label)}${m.value===p.moment?'<small>Você marcou este momento</small>':''}</span></li>`).join('')}</ol></section><section class="profile-section interruption" data-view="interruption_window_viewed"><p class="eyebrow">03 / JANELA DE INTERRUPÇÃO</p><h2>Entre perceber e responder,<br><em>uma possibilidade de escolha.</em></h2><ol class="window"><li>Gatilho</li><li>Sinal</li><li class="highlight">Percepção</li><li>Resposta</li><li>Consequência</li></ol><p>Este é um ponto de observação possível, não uma afirmação sobre quando você já consegue agir diferente.</p><p class="motto">PERCEBA ANTES. AJA DIFERENTE.</p></section><section class="profile-section"><p class="eyebrow">04 / O QUE IMPORTA PARA VOCÊ</p><div class="split"><div><h2>O que acontece depois</h2><p>${list(p.consequences)}</p>${p.consequenceDetail?`<blockquote>${escape(p.consequenceDetail)}</blockquote>`:''}</div><div><h2>O que você deseja</h2><blockquote>${escape(p.desire)}</blockquote></div></div><div class="focus"><p class="eyebrow">SEU FOCO AGORA</p><p>${escape(p.priority)}</p></div><details><summary>O que você já tentou</summary><p>${list(p.previous)}</p></details></section><section class="profile-section first-moment"><p class="eyebrow">05 / PRIMEIRO MOMENTO ROMPA</p><h2>Na próxima vez,<br>comece por perceber.</h2><ol><li>O que acabou de acontecer?</li><li>O que estou percebendo em mim agora?</li><li>O que estou prestes a fazer?</li></ol><p>Não precisa mudar tudo agora. Primeiro, perceba.</p></section><section class="profile-section feedback"><h2>Você se reconheceu?</h2><p>Este resultado descreveu bem aquilo que você percebe que acontece?</p><div class="feedback-options">${['Sim, muito bem','Em parte','Não muito'].map((label,i)=>`<button class="secondary" data-feedback="${i}" aria-pressed="${state.feedback===i}">${label}</button>`).join('')}</div><p id="feedback-status" role="status">${state.feedback!==undefined?'Sua resposta foi registrada nesta prévia. Obrigado.':''}</p></section><section class="profile-section offer"><img src="./assets/ebook.webp" alt="Capa do ebook Como Romper Padrões Repetitivos" loading="lazy"><div><p class="eyebrow">SEU PRÓXIMO AVANÇO</p><h2>Agora que você entendeu o padrão que está lhe atrapalhando, chegou o momento de entender e romper de vez como o que está te impendo de avançar.</h2><h3>Como Romper Padrões Repetitivos</h3><p>Conheça o Método ROMPA, o Loop ROMPA e a Janela de Interrupção para continuar sua observação.</p><p class="price">${escape(config.price)} <small>Preço proposto para o lançamento</small></p>${checkout?`<a class="primary" id="checkout" href="${escape(checkout)}">Quero entender como romper meus padrões <span>→</span></a>`:'<button class="primary" disabled>Checkout ainda não disponível</button><p class="micro">A oferta será ativada após a configuração do lançamento.</p>'}</div></section><div class="profile-end"><p>Este perfil organiza suas respostas. Não é diagnóstico nem avaliação de personalidade.</p><button class="text-button" data-reset>Apagar respostas e recomeçar</button></div>`;
  event('profile_viewed');
  root.querySelector('[data-print]').onclick=()=>window.print();
  root.querySelectorAll('[data-feedback]').forEach(b=>b.onclick=()=>{state.feedback=Number(b.dataset.feedback);event('profile_feedback',{value:state.feedback});root.querySelectorAll('[data-feedback]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));root.querySelector('#feedback-status').textContent='Sua resposta foi registrada nesta prévia. Obrigado.';});
  root.querySelector('#checkout')?.addEventListener('click',()=>{event('ebook_cta_clicked');event('checkout_started');});
  if('IntersectionObserver' in window){observer=new IntersectionObserver(entries=>{for(const entry of entries)if(entry.isIntersecting){event(entry.target.dataset.view);observer.unobserve(entry.target);}},{threshold:0.3});root.querySelectorAll('[data-view]').forEach(el=>observer.observe(el));}
}
render();
