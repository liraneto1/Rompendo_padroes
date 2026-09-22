import test from 'node:test';
import assert from 'node:assert/strict';
import {questions,areas,optionsFor,mirrorBank,moments} from '../dist/teste/questions.js';
import {newState,flow,saveAnswer,toggleChoice,validate,validateAssessment,buildProfile,attachLead,recordEvent,restore} from '../dist/teste/engine.js';
import {checkoutFor} from '../dist/teste/config.js';

const question=id=>questions.find(q=>q.id===id);
function answers(){return {area_principal:'PROJETOS_OBJETIVOS',frase_espelho:'P01',padrao_declarado:'Começo projetos e depois abandono.',frequencia_percebida:'FREQUENTE',tempo_percebido:'ANOS',gatilhos:['FRUSTRACAO','DESANIMO'],percepcao_sinais:'SIM',sinais_percebidos:['PENSAMENTOS_REPETITIVOS'],momento_percepcao:'AFTER',capacidade_pausa:'RARAMENTE',resposta_recorrente:'Vou deixando o projeto de lado.',consequencias:['ABANDONO','RECOMECO'],prioridade_mudanca:'Continuar quando a empolgação cair.',resultado_desejado:'Terminar o que começo.',solucoes_anteriores:['LIVROS']};}
test('o banco mantém 35 frases aprovadas e ramifica as oito áreas',()=>{
  assert.equal(Object.values(mirrorBank).flat().length,35);
  for(const area of areas){const opts=optionsFor(question('Q02'),{area_principal:area.value});assert.equal(opts.length,area.value==='OUTRO'?1:6);if(area.value!=='OUTRO')assert.deepEqual(opts.slice(0,5),mirrorBank[area.value]);}
});
test('mudar de área invalida frase anterior e preserva o texto declarado',()=>{
  const state=newState();state.answers=answers();saveAnswer(state,question('Q01'),'FAMILIA');assert.equal(state.answers.frase_espelho,undefined);assert.equal(state.answers.padrao_declarado,answers().padrao_declarado);assert.equal(validateAssessment(state.answers).question,'Q02');
});
test('Q03 é obrigatória e o limite de 400 é aplicado também pelo motor',()=>{
  for(const text of ['', '   ', 'a'.repeat(401)])assert.notEqual(validate(question('Q03'),text,{}),'');
  assert.equal(validate(question('Q03'),'a'.repeat(400),{}),'');
});
test('Q08 aparece nas três respostas previstas e desaparece sem resíduos',()=>{
  for(const value of ['SIM','AS_VEZES','RARAMENTE'])assert.ok(flow({percepcao_sinais:value}).includes('Q08'));
  for(const value of ['NAO','NAO_SEI']){
    const state=newState();state.answers=answers();state.answers.sinais_percebidos_outro='Antigo';saveAnswer(state,question('Q07'),value);
    assert.ok(!flow(state.answers).includes('Q08'));assert.equal(state.answers.sinais_percebidos,undefined);assert.equal(state.answers.sinais_percebidos_outro,undefined);
    const profile=buildProfile(state.answers);assert.deepEqual(profile.signals,[]);assert.notEqual(profile.signalDeclaration,'Não informado');
  }
});
test('seleção máxima bloqueia a quarta opção e permite desmarcar',()=>{
  const q=question('Q06'), selected=['CRITICA','PRESSAO','CANSACO'];assert.deepEqual(toggleChoice(q,selected,'FRUSTRACAO'),selected);assert.equal(toggleChoice(q,selected,'PRESSAO').length,2);assert.ok(validate(q,[...selected,'FRUSTRACAO'],{}));
});
test('alternativas exclusivas não coexistem com respostas específicas',()=>{
  const q=question('Q06');assert.deepEqual(toggleChoice(q,['CRITICA'],'NAO_SEI'),['NAO_SEI']);assert.deepEqual(toggleChoice(q,['NAO_SEI'],'CRITICA'),['CRITICA']);assert.ok(validate(q,['NAO_SEI','CRITICA'],{}));
});
test('Outro exige texto, remove complemento obsoleto e rejeita códigos indevidos',()=>{
  const state=newState(),q=question('Q06');assert.throws(()=>saveAnswer(state,q,['OUTRO']));saveAnswer(state,q,['OUTRO'],'Minha situação');assert.equal(state.answers.gatilhos_outro,'Minha situação');saveAnswer(state,q,['CRITICA']);assert.equal(state.answers.gatilhos_outro,undefined);assert.ok(validate(q,['CODIGO_INVALIDO'],{}));assert.ok(validate(q,['CRITICA','CRITICA'],{}));
});
test('perfil preserva respostas e contempla os seis momentos sem pontuação',()=>{
  for(const moment of moments){const a={...answers(),momento_percepcao:moment.value};const p=buildProfile(a);assert.equal(p.moment,moment.value);assert.ok(p.momentCopy);assert.equal(p.pattern,a.padrao_declarado);assert.equal(p.response,a.resposta_recorrente);assert.equal(p.desire,a.resultado_desejado);assert.ok(!('score' in p));}
});
test('outra área e complementos aparecem no perfil sem inferências',()=>{
  const a={...answers(),area_principal:'OUTRO',area_principal_outro:'Estudos',frase_espelho:'OUTRA_SITUACAO',gatilhos:['OUTRO'],gatilhos_outro:'Véspera de prova'};const p=buildProfile(a);assert.equal(p.area,'Estudos');assert.deepEqual(p.triggers,['Véspera de prova']);
});
test('não gera perfil de assessment incompleto',()=>{assert.throws(()=>buildProfile({}));});
test('perfil determinístico não depende de IA ou de rede',()=>{
  const p=buildProfile(answers());assert.equal(p.ai_status,'disabled');assert.equal(p.pattern,answers().padrao_declarado);assert.deepEqual(buildProfile(answers()),p);
});
test('consentimentos separados e lead associado somente ao assessment da sessão',()=>{
  const a=newState(),b=newState();a.answers=answers();const lead={first_name:'Teste',whatsapp:'+55 11 99999-9999',email:'',privacy_acceptance:true,marketing_consent:false};attachLead(a,lead);assert.equal(a.assessment.user_id,a.user.id);assert.equal(a.user.marketing_consent,false);assert.ok(a.user.consented_at);assert.equal(b.user,null);assert.notEqual(a.session.id,b.session.id);assert.throws(()=>attachLead(a,{...lead,privacy_acceptance:false}));assert.throws(()=>attachLead(a,{...lead,whatsapp:'abc5511999999999'}));
});
test('restaura sessão válida e rejeita corrupção, versão antiga e associação incorreta',()=>{
  const state=newState({utm_source:'instagram'});state.answers=answers();state.screen='Q15';assert.deepEqual(restore(JSON.stringify(state)),state);assert.equal(restore('{'),null);assert.equal(restore(JSON.stringify({...state,version:'old'})),null);assert.equal(restore(JSON.stringify({...state,assessment:{...state.assessment,session_id:'other'}})),null);
});
test('recarregar perfil exige consentimento e todas as respostas',()=>{
  const state=newState();state.answers=answers();state.screen='profile';assert.equal(restore(JSON.stringify(state)),null);attachLead(state,{first_name:'Teste',whatsapp:'5511999999999',privacy_acceptance:true});assert.ok(restore(JSON.stringify(state)).profile);delete state.answers.padrao_declarado;assert.equal(restore(JSON.stringify(state)),null);
});
test('eventos carregam os identificadores corretos e checkout usa o destino configurado',()=>{
  const state=newState();recordEvent(state,'test_start');assert.equal(state.events[0].session_id,state.session.id);assert.equal(state.events[0].assessment_id,state.assessment.id);assert.deepEqual(state.events[0].metadata,{});assert.equal(checkoutFor('qualquer'),'https://pay.hotmart.com/D107689179A');assert.equal(checkoutFor('__proto__'),'https://pay.hotmart.com/D107689179A');
});
