# Análise e implementação inicial do PRD

Fonte: `PRD_TESTE_DOS_PADROES_ROMPA_v1.0.docx`, lido integralmente em 21 de setembro de 2026. A imagem “Documento Mestre - PRD TESTE DOS PADRÕES v1.0.png” foi usada como referência visual. As instruções dirigidas a um “próximo chat” no documento foram tratadas como contexto do PRD, sem substituir o pedido do usuário.

## Resultado desta etapa

Protótipo funcional para validar a jornada de descoberta. O núcleo implementa perguntas, ramificação, captura local e devolutiva determinística. A arquitetura acompanha o site estático existente: HTML, CSS e módulos JavaScript nativos. Essa é uma decisão reversível para a prévia, não a definição silenciosa da stack final do produto.

Não foram criados score, diagnóstico, tipologia ou causas inferidas. Campos declarados são exibidos literalmente, com escape de HTML. A Janela de Interrupção é apresentada como oportunidade de observação, separada do momento efetivamente informado pelo usuário.

## Correspondência com o PRD

| Telas / requisito | Implementação | Estado |
| --- | --- | --- |
| T00–T03 | Landing, preparação, transição e área | Local |
| T04–T08 | Frase por área, texto de 400 caracteres, microvitória, frequência e tempo | Local |
| T09–T17 | Gatilhos, sinais condicionais, percepção, pausa, resposta e consequência | Local |
| T18–T22 | Prioridade, desejo, tentativas, conclusão e processamento de 2,2 segundos | Local |
| T23 | Contato, consentimentos independentes e referência à privacidade da prévia | Local, sem cadastro remoto |
| T24–T30 | Dez componentes do perfil em uma página contínua; leitura mobile e impressão | Local |
| T31–T32 | Ponte para ebook, preço proposto e ponto configurável de checkout | Checkout pendente |
| RF-001–008 | Identificadores, origem, início livre, respostas ao avançar, retorno, recuperação e validação | Local |
| RF-009 | Perfil determinístico | Implementado |
| RF-010–011 | IA opcional e fallback do fornecedor | Não integrados; motor sem IA disponível |
| RF-012–015 | Associação do lead, percepção, Loop e microação | Local |
| RF-016 | Redirecionamento configurável | Aguarda URL real e teste |
| RF-017–018 | Eventos de fluxo e aderência | Registro local; analytics e compra pendentes |
| RF-019 | Armazenamento por aba e novos identificadores ao recomeçar | Validado entre abas independentes; sem sincronização entre dispositivos |
| RF-020 | Responsividade | Jornada verificada em 390 e 1440 px; landing também em 320 px |

T02 e T09 foram preservadas como transições e adicionadas transições explícitas para Descrever e Priorizar. As telas do resultado são seções de uma mesma página, mantendo o conteúdo e a ordem. O botão Voltar da captura retorna à conclusão, evitando um ciclo involuntário com a tela de processamento.

## Hipóteses de conteúdo explicitadas

O PRD especifica os enunciados das 15 perguntas, mas não fecha o banco completo de alternativas de frequência, tempo, gatilhos, sinais, pausa, consequências e tentativas. As alternativas desses campos são um rascunho editável. A frequência e o tempo aproveitam os termos fornecidos no PRD; gatilhos também aproveitam a referência visual. As demais opções precisam de teste de mesa.

- “Outra situação” está disponível em todas as áreas. Para “Outra área”, exige-se descrição da área; Q02 oferece somente a alternativa aberta. Q03 continua obrigatória.
- “Outro” abre descrição obrigatória de até 200 caracteres. O complemento é eliminado se a alternativa for desmarcada.
- Campos abertos Q11, Q13 e Q14 receberam limite provisório de 400 caracteres. O PRD fixa esse limite apenas para Q03.
- “Ainda não sei identificar” e “Ainda não tentei” são exclusivos, para não coexistirem com respostas contraditórias.
- Q08 omitida não vira ausência presumida de sinais. O perfil informa a resposta declarada em Q07 e que sinais específicos não foram descritos.
- Gatilhos e consequências exigem ao menos uma opção e aceitam até três, incluindo “Outro”.

## Dados e eventos

O estado possui sessão, assessment, respostas, usuário, perfil e eventos. Identificadores são UUIDs do navegador. A associação `assessment.session_id` e `assessment.user_id` é conferida na restauração; estados inválidos ou de versões antigas são descartados.

UTMs são preservadas por chave e limitadas a 200 caracteres; do referrer é guardada somente a origem, evitando persistir parâmetros de outras páginas. Dispositivo é classificado pela largura no início. Não há fingerprinting. Os metadados de analytics guardam IDs de pergunta e opções fechadas, sem copiar os textos abertos ou contatos. Eventos são limitados aos últimos 1.000 registros da sessão para impedir crescimento ilimitado.

Eventos de visualização podem ocorrer novamente ao recarregar. Taxas futuras devem contar sessões/assessments distintos, não somar cliques ou visualizações como pessoas. `checkout_started` significará redirecionamento solicitado; confirmação de carregamento/conversão exige integração com o provedor. `purchase_completed` não é emitido pelo frontend.

Esta persistência não é um banco de leads nem coleta Product Intelligence centralizada. Uma aba duplicada pelo navegador pode herdar uma cópia da sessão; o backend futuro deverá tratar idempotência e concorrência. Abas independentes e novas sessões não compartilham respostas.

## Decisões para produção

1. Confirmar stack final e hosting. A prévia reutiliza a estrutura estática local, sem mudar o site institucional.
2. Escolher backend/banco e implementar validação de servidor, idempotência, armazenamento, exclusão e controles de acesso. Supabase/PostgreSQL continua apenas como recomendação do PRD.
3. Definir política definitiva, responsável, canal de atendimento, retenção, exclusão e o texto dos consentimentos antes de coletar dados reais.
4. Definir Hotmart ou Kiwify, URL por campanha e webhook autenticado de confirmação de compra.
5. Definir se haverá envio de cópia por WhatsApp/email e qual fornecedor fará o envio. A prévia não promete entrega.
6. Decidir se a síntese por IA agrega valor. O resultado atual funciona integralmente sem IA. Se adotada, implementar no backend com validação do contrato, timeout e fallback determinístico, sem segredos no navegador.
7. Concluir teste de mesa com aproximadamente 5–10 pessoas e revisar o banco provisório antes de congelar copies.
8. Fazer QA da implantação real, incluindo HTTPS, eventos persistidos, checkout, dispositivos físicos e mecanismos de privacidade.

## Validação executada

Quinze testes automatizados de motor cobrem ramificação de todas as áreas, limite de caracteres, limpeza de respostas obsoletas, seleção máxima, exclusividade, “Outro”, os seis momentos de percepção, resultado sem IA, captura e consentimento, restauração e identificação de sessões.

Um teste de navegação no Chrome cobre o fluxo completo, erros de validação, limite de seleção, mudança de Q07 com exclusão de Q08, retorno da captura, recuperação após atualização, conteúdo HTML tratado como texto, feedback e exclusão. A jornada foi verificada em 390 e 1440 px e a landing em 320 px. Houve inspeção visual das capturas.

Não foram validados: checkout real, webhook de compra, envio de mensagens, política jurídica final, síntese de IA, persistência remota, eficácia do produto ou aderência com pessoas reais. Portanto, a Definition of Done pública do PRD ainda não está cumprida.
