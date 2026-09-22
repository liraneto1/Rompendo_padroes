const options = rows => rows.map(([value, label]) => ({ value, label }));
export const areas = options([
  ['RELACIONAMENTOS', 'Relacionamentos amorosos'], ['FAMILIA', 'Família'],
  ['TRABALHO_CARREIRA', 'Trabalho / Carreira'], ['PROJETOS_OBJETIVOS', 'Projetos / Objetivos'],
  ['DINHEIRO', 'Dinheiro'], ['HABITOS_ROTINA', 'Hábitos / Rotina'],
  ['REACOES_EMOCOES', 'Reações / Emoções'], ['OUTRO', 'Outra área'],
]);
const mirrors = (prefix, labels) => labels.map((label, index) => ({value: `${prefix}0${index + 1}`, label}));
export const mirrorBank = {
  PROJETOS_OBJETIVOS: mirrors('P', ['Começo animado, mas não termino.', 'Tenho muitas ideias e dificuldade para continuar.', 'Adio até aquilo que sei que é importante.', 'Abandono quando os resultados demoram.', 'Paro e depois preciso começar novamente.']),
  RELACIONAMENTOS: mirrors('R', ['As pessoas mudam, mas algumas situações terminam de formas parecidas.', 'Percebo sinais que me incomodam, mas continuo mesmo assim.', 'Evito conversas importantes até a situação piorar.', 'Reajo de uma forma e depois me arrependo.', 'Acabo me envolvendo novamente em uma dinâmica que eu dizia que não queria repetir.']),
  FAMILIA: mirrors('F', ['Reajo de maneiras que prometi que não repetiria.', 'Algumas discussões parecem seguir sempre o mesmo roteiro.', 'Evito certos assuntos até eles virarem um problema maior.', 'Repito comportamentos familiares que gostaria de fazer diferente.', 'Depois de uma situação, penso: “eu disse que nunca faria isso.”']),
  DINHEIRO: mirrors('D', ['Organizo minhas finanças e depois volto aos mesmos hábitos.', 'Gasto por impulso e me arrependo depois.', 'Prometo guardar dinheiro, mas não consigo manter.', 'Adio decisões financeiras importantes.', 'Parece que todo mês a mesma história se repete.']),
  HABITOS_ROTINA: mirrors('H', ['Começo com força e depois paro.', 'Consigo manter por alguns dias, mas não sustento.', 'Quando saio da rotina, tenho dificuldade para voltar.', 'Preciso constantemente começar de novo.', 'Sei o que deveria fazer, mas não consigo transformar isso em constância.']),
  REACOES_EMOCOES: mirrors('E', ['Reajo no impulso e depois me arrependo.', 'Quando percebo, já falei ou fiz.', 'Sei que determinada situação me afeta, mas continuo reagindo da mesma maneira.', 'Quando estou sob pressão, respondo de formas que depois gostaria de mudar.', 'Tenho dificuldade para criar espaço entre o que sinto e o que faço.']),
  TRABALHO_CARREIRA: mirrors('T', ['Adio decisões profissionais importantes.', 'Começo mudanças e depois volto ao mesmo lugar.', 'Aceito situações que já sei que não quero manter.', 'Tenho planos profissionais, mas dificuldade para transformá-los em continuidade.', 'Quando surge uma dificuldade, abandono ou mudo de direção.']),
};
export const moments = options([
  ['BEFORE', 'Antes de agir'], ['DURING', 'Enquanto está acontecendo'], ['AFTER', 'Logo depois'],
  ['LONG_AFTER', 'Muito depois'], ['EXTERNAL', 'Outra pessoa costuma perceber primeiro'], ['UNKNOWN', 'Ainda não sei identificar'],
]);
export const perceptionCopy = {
  BEFORE: 'Você relatou perceber antes de agir. Esse momento pode ser uma oportunidade de transformar percepção em escolha.',
  DURING: 'Você relatou perceber enquanto a resposta acontece. Observar os sinais pode ajudar a reconhecer esse momento um pouco antes.',
  AFTER: 'Você relatou perceber logo depois. Reconstruir o que aconteceu antes pode tornar o caminho da repetição mais visível.',
  LONG_AFTER: 'Você relatou perceber muito depois. Voltar aos passos de uma situação específica pode ajudar a observar o ciclo.',
  EXTERNAL: 'Você relatou que outra pessoa costuma perceber primeiro. Uma observação externa pode ser um ponto de partida para observar a própria resposta.',
  UNKNOWN: 'Você ainda não identificou quando percebe a repetição. Comece observando uma situação específica, sem precisar explicá-la inteira.',
};
const other = ['OUTRO', 'Outro'];
const unknown = ['NAO_SEI', 'Ainda não sei identificar'];
export const questions = [
  {id:'Q01', key:'area_principal', block:0, type:'single', title:'Onde isso mais incomoda você hoje?', intro:'Quando você pensa em situações que parecem se repetir na sua vida…', options:areas, other:true},
  {id:'Q02', key:'frase_espelho', block:0, type:'single', title:'Qual dessas situações mais parece com o que acontece com você?'},
  {id:'Q03', key:'padrao_declarado', block:1, type:'text', max:400, title:'Com suas próprias palavras: o que você percebe que continua se repetindo?', help:'Conte como se estivesse explicando isso para alguém próximo. Evite nomes e informações íntimas desnecessárias.'},
  {id:'Q04', key:'frequencia_percebida', block:1, type:'single', title:'Com que frequência você percebe que essa situação se repete?', options:options([['POUCAS','Poucas vezes'],['AS_VEZES','De vez em quando'],['FREQUENTE','Com frequência'],['QUASE_SEMPRE','Quase sempre'],['NAO_SEI','Não sei dizer']])},
  {id:'Q05', key:'tempo_percebido', block:1, type:'single', title:'Há quanto tempo você percebe esse tipo de repetição?', options:options([['RECENTE','Recentemente'],['MESES','Há alguns meses'],['ANOS','Há alguns anos'],['MUITO_TEMPO','Há muito tempo'],['NAO_PENSEI','Nunca havia pensado nisso']])},
  {id:'Q06', key:'gatilhos', block:2, type:'multi', limit:3, other:true, exclusive:['NAO_SEI'], title:'O que geralmente estava acontecendo pouco antes?', options:options([['CRITICA','Crítica / rejeição'],['PRESSAO','Pressão / cobrança'],['CANSACO','Cansaço'],['ANSIEDADE','Ansiedade / preocupação'],['FRUSTRACAO','Frustração'],['MEDO_ERRAR','Medo de errar'],['DESANIMO','Desânimo'],['CONFLITO','Conflito'],other,unknown])},
  {id:'Q07', key:'percepcao_sinais', block:2, type:'single', title:'Antes de repetir essa situação, você costuma perceber algum sinal em você?', options:options([['SIM','Sim'],['AS_VEZES','Às vezes'],['RARAMENTE','Raramente'],['NAO','Não'],['NAO_SEI','Não sei dizer']])},
  {id:'Q08', key:'sinais_percebidos', block:2, type:'multi', other:true, exclusive:['NAO_SEI'], title:'O que você costuma perceber?', options:options([['TENSAO','Tensão no corpo'],['AGITACAO','Agitação'],['PENSAMENTOS_REPETITIVOS','Pensamentos repetitivos'],['VONTADE_EVITAR','Vontade de evitar a situação'],['IMPULSO','Vontade de agir imediatamente'],['DESANIMO','Desânimo'],other,unknown])},
  {id:'Q09', key:'momento_percepcao', block:2, type:'single', title:'Em que momento você geralmente percebe que está repetindo?', options:moments},
  {id:'Q10', key:'capacidade_pausa', block:2, type:'single', title:'Quando percebe, consegue parar por alguns instantes antes de responder ou agir?', options:options([['SIM','Geralmente consigo'],['AS_VEZES','Às vezes'],['RARAMENTE','Raramente'],['NAO','Ainda não consigo'],['NAO_SEI','Não sei dizer']])},
  {id:'Q11', key:'resposta_recorrente', block:2, type:'text', max:400, title:'Quando essa situação acontece, o que você normalmente faz?', help:'Descreva uma reação, comportamento ou decisão que você reconhece.'},
  {id:'Q12', key:'consequencias', block:2, type:'multi', limit:3, other:true, optionalDetail:true, exclusive:['NAO_SEI'], title:'O que geralmente acontece depois?', options:options([['ARREPENDIMENTO','Arrependimento'],['FRUSTRACAO','Frustração'],['CONFLITOS','Conflitos nas relações'],['ABANDONO','Abandono do que comecei'],['RECOMECO','Preciso recomeçar'],['DESGASTE','Desgaste / cansaço'],['ADIAMENTO','Decisões ficam para depois'],other,unknown])},
  {id:'Q13', key:'prioridade_mudanca', block:3, type:'text', max:400, title:'Se pudesse mudar apenas UMA dessas situações hoje, qual escolheria?'},
  {id:'Q14', key:'resultado_desejado', block:3, type:'text', max:400, title:'O que mudaria na sua vida se conseguisse agir diferente?'},
  {id:'Q15', key:'solucoes_anteriores', block:3, type:'multi', other:true, exclusive:['NADA'], title:'O que você já tentou fazer para mudar isso?', options:options([['LIVROS','Ler livros'],['VIDEOS','Assistir a vídeos'],['CURSOS','Fazer cursos'],['APPS','Usar aplicativos'],['PLANEJAMENTO','Criar metas / planejamento'],['HABITOS','Mudar hábitos'],['CONVERSAS','Conversar com alguém'],other,['NADA','Ainda não tentei']])},
];
export const blocks = ['Localizar', 'Descrever', 'Investigar', 'Priorizar'];
export function optionsFor(q, answers = {}) {
  if(q.id !== 'Q02') return q.options || [];
  return [...(mirrorBank[answers.area_principal] || []), {value:'OUTRA_SITUACAO',label:'Outra situação. Vou contar com minhas palavras.'}];
}
export function asksSignals(answers) { return ['SIM','AS_VEZES','RARAMENTE'].includes(answers.percepcao_sinais); }
