import {questions, optionsFor, asksSignals, areas, perceptionCopy} from './questions.js';
import {config} from './config.js';
export function newState(source = {}, id = globalThis.crypto.randomUUID()) {
  return {version:config.questionnaireVersion, session:{id, created_at:new Date().toISOString(), ...source}, assessment:{id:globalThis.crypto.randomUUID(), session_id:id, status:'new'}, answers:{}, screen:'landing', events:[], user:null, profile:null};
}
export function flow(answers) {
  return ['landing','preparation','localizar','Q01','Q02','descrever','Q03','microvictory','Q04','Q05','investigar','Q06','Q07',...(asksSignals(answers)?['Q08']:[]),'Q09','microinsight','Q10','Q11','Q12','priorizar','Q13','Q14','Q15','complete','processing','capture','profile'];
}
export function validate(q, value, answers, detail = '', optionalDetail = '') {
  if(q.type === 'text') return typeof value === 'string' && value.trim().length > 0 && value.length <= q.max ? '' : `Escreva sua resposta em até ${q.max} caracteres.`;
  const values = q.type === 'multi' ? value : [value];
  if(!Array.isArray(values) || !values.length) return 'Escolha uma opção para continuar.';
  const allowed = new Set(optionsFor(q, answers).map(o => o.value));
  if(values.some(v => !allowed.has(v)) || new Set(values).size !== values.length) return 'Revise as opções selecionadas.';
  if(q.limit && values.length > q.limit) return `Escolha no máximo ${q.limit} opções.`;
  if(values.length > 1 && values.some(v => q.exclusive?.includes(v))) return 'Esta opção deve ser selecionada sozinha.';
  if(q.other && values.includes('OUTRO') && (!detail.trim() || detail.length > 200)) return 'Descreva a outra opção em até 200 caracteres.';
  if(optionalDetail.length > 400) return 'Use até 400 caracteres na descrição complementar.';
  return '';
}
export function toggleChoice(q, current, value) {
  if(current.includes(value)) return current.filter(v => v !== value);
  if(q.exclusive?.includes(value)) return [value];
  const next = current.filter(v => !q.exclusive?.includes(v));
  if(q.limit && next.length >= q.limit) return current;
  return [...next, value];
}
export function saveAnswer(state, q, value, detail = '', optionalDetail = '') {
  const error = validate(q,value,state.answers,detail,optionalDetail);
  if(error) throw new Error(error);
  if(q.id === 'Q01' && state.answers.area_principal !== value) delete state.answers.frase_espelho;
  state.answers[q.key] = typeof value === 'string' ? value.trim() : [...value];
  delete state.answers[`${q.key}_outro`];
  if(q.other && (Array.isArray(value)?value:[value]).includes('OUTRO')) state.answers[`${q.key}_outro`] = detail.trim();
  if(q.optionalDetail) state.answers[`${q.key}_detalhe`] = optionalDetail.trim();
  if(q.id === 'Q07' && !asksSignals(state.answers)) {
    delete state.answers.sinais_percebidos; delete state.answers.sinais_percebidos_outro;
  }
  state.profile = null;
}
export function validateAssessment(answers) {
  for(const q of questions) {
    if(q.id === 'Q08' && !asksSignals(answers)) continue;
    const error = validate(q,answers[q.key],answers,answers[`${q.key}_outro`] || '',answers[`${q.key}_detalhe`] || '');
    if(error) return {question:q.id,error};
  }
  return null;
}
export function labelFor(key, value, answers) {
  const q = questions.find(q => q.key === key);
  if(value === 'OUTRO' && answers[`${key}_outro`]) return answers[`${key}_outro`];
  return optionsFor(q, answers).find(o => o.value === value)?.label || 'Não informado';
}
export function buildProfile(answers) {
  const invalid = validateAssessment(answers);
  if(invalid) throw new Error(`Resposta incompleta: ${invalid.question}`);
  const labels = key => (answers[key] || []).map(v => labelFor(key,v,answers));
  const area = answers.area_principal === 'OUTRO' ? answers.area_principal_outro : areas.find(a => a.value === answers.area_principal).label;
  return {
    area, pattern:answers.padrao_declarado, frequency:labelFor('frequencia_percebida',answers.frequencia_percebida,answers),
    duration:labelFor('tempo_percebido',answers.tempo_percebido,answers),
    triggers:labels('gatilhos'), signals:asksSignals(answers)?labels('sinais_percebidos'):[],
    signalDeclaration:labelFor('percepcao_sinais',answers.percepcao_sinais,answers),
    response:answers.resposta_recorrente, consequences:labels('consequencias'), consequenceDetail:answers.consequencias_detalhe || '',
    moment:answers.momento_percepcao, momentLabel:labelFor('momento_percepcao',answers.momento_percepcao,answers),
    momentCopy:perceptionCopy[answers.momento_percepcao], pause:labelFor('capacidade_pausa',answers.capacidade_pausa,answers),
    priority:answers.prioridade_mudanca, desire:answers.resultado_desejado,
    previous:labels('solucoes_anteriores'), ai_status:'disabled',
  };
}
export function validateLead(lead) {
  if(!lead.first_name?.trim() || lead.first_name.trim().length > 60) return 'Informe seu primeiro nome (até 60 caracteres).';
  const phone = (lead.whatsapp || '').replace(/[\s()+.-]/g,'');
  if(!/^\d{10,15}$/.test(phone)) return 'Informe o WhatsApp com código do país e DDD.';
  if(lead.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(lead.email)) return 'Revise o endereço de email.';
  if(!lead.privacy_acceptance) return 'É necessário aceitar o uso local das respostas para gerar seu perfil.';
  return '';
}
export function attachLead(state, lead) {
  const error=validateLead(lead); if(error) throw new Error(error);
  const invalid=validateAssessment(state.answers); if(invalid) throw new Error('Conclua as perguntas antes de liberar o perfil.');
  state.user = {id:state.user?.id || globalThis.crypto.randomUUID(), first_name:lead.first_name.trim(), whatsapp:lead.whatsapp.replace(/\D/g,''),email:lead.email?.trim() || '', privacy_acceptance:true, marketing_consent:lead.marketing_consent === true, privacy_version:config.privacyVersion, consented_at:new Date().toISOString()};
  state.assessment.user_id=state.user.id;
}
export function recordEvent(state, event_name, metadata = {}) {
  // Metadata nunca recebe respostas abertas, nome, WhatsApp ou email.
  state.events.push({id:globalThis.crypto.randomUUID(),session_id:state.session.id,assessment_id:state.assessment.id,event_name,metadata,created_at:new Date().toISOString()});
  if(state.events.length > 1000) state.events.splice(0,state.events.length-1000);
}
export function restore(raw) {
  try {
    const state=JSON.parse(raw);
    if(state.version!==config.questionnaireVersion || !state.session?.id || state.assessment?.session_id!==state.session.id || !state.answers || !Array.isArray(state.events) || !flow(state.answers).includes(state.screen)) return null;
    if(state.user && state.assessment.user_id !== state.user.id) return null;
    if(['capture','profile','processing','complete'].includes(state.screen) && validateAssessment(state.answers)) return null;
    if(state.screen==='profile' && (!state.user || validateLead(state.user))) return null;
    if(state.screen==='profile') state.profile=buildProfile(state.answers);
    if(state.screen==='processing') state.screen='capture';
    return state;
  } catch { return null; }
}
