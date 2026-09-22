# Administração ROMPA

Implementação local disponível em http://127.0.0.1:4173/admin/.

## Iniciar e acessar

Execute `Iniciar-ROMPA.ps1` no PowerShell dentro da pasta do projeto. O script inicia o servidor em segundo plano, sem abrir uma janela de terminal adicional, e informa os endereços. Se o servidor já estiver ativo, apenas informa o acesso. Como alternativa, execute `npm start` e mantenha o terminal aberto. É necessário Node.js 24 ou superior; o script procura primeiro o runtime do Codex instalado neste computador.

No primeiro acesso, cadastre seu email e uma senha de 12 a 128 caracteres. Não existe senha padrão. O primeiro cadastro é permitido somente enquanto não existe administrador no banco. Não há recuperação por email implementada; guarde a senha.

No ambiente local, o servidor escuta em `127.0.0.1`. Em produção (`NODE_ENV=production`), o padrão é `0.0.0.0`; a preparação para Hostinger está em `docs/hostinger.md`. Reiniciar o computador encerra o processo; execute o inicializador novamente. Não é um serviço instalado no Windows e não há hospedagem pública.

## Funcionalidades

- Visão geral: questionários iniciados com autorização, conclusão, captura, perfis visualizados, funil, áreas, percepção e histórico diário.
- Questionários: listagem paginada, busca por nome/contato/ID e filtros por período, área, status e origem.
- Detalhes: todas as perguntas, ramificação omitida, respostas abertas, complementos, contatos, consentimentos, origem, perfil, aderência e eventos.
- Indicadores: aderência percebida, frequência, gatilhos, consequências, pausa, soluções tentadas, origem e percepção.
- Exclusão: remove respostas e contato do banco ativo, com confirmação. Registros excluídos não podem ser recriados pela sincronização antiga.
- Atualização: botão manual e consulta a cada 30 segundos enquanto a aba estiver visível e nenhum detalhe estiver aberto.

## Persistência e privacidade

Banco SQLite em `.data/rompa.sqlite`, fora da pasta pública `dist` e ignorado pelo Git. O banco pode ter arquivos auxiliares `-wal` e `-shm`. Proteja a pasta como qualquer arquivo que contenha dados pessoais; ela pode estar sujeita à sincronização do OneDrive da pasta do projeto. A aplicação não envia dados a serviços de mensagens, IA ou analytics externos.

O teste pede autorização de armazenamento antes das perguntas. Contatos são autorizados ao final; marketing permanece separado e desmarcado. O servidor registra a versão e o horário do recebimento do consentimento. O consentimento atual está associado ao questionário; não há histórico versionado de todas as mudanças de preferência.

Cada participante possui uma credencial de escrita aleatória armazenada na própria aba. Somente essa credencial pode atualizar ou apagar seu registro. O participante não tem endpoint para ler outros questionários. O cadastro é idempotente para tolerar repetição após falha de rede. As respostas são validadas novamente no servidor e o perfil é recalculado, sem confiar em um perfil enviado pelo navegador.

A senha administrativa é armazenada com scrypt e salt aleatório. A sessão usa cookie HttpOnly e SameSite Strict, com validade de oito horas. Escritas verificam a origem e há limitação de tentativas de login. HTTP e cookie sem Secure continuam disponíveis no desenvolvimento local. Em produção, o cookie recebe Secure e as escritas pelos domínios públicos exigem origem HTTPS correspondente ao Host; configure HTTPS no proxy da hospedagem. Não há multiadministrador, MFA ou recuperação de senha nesta etapa.

Exclusão elimina o conteúdo do registro ativo e mantém um marcador técnico com identificadores, hash de credencial e auditoria. Não representa apagamento forense de páginas antigas do SQLite, logs do sistema, backups ou sincronização do OneDrive. A política de retenção e o processo de exclusão da versão pública ainda precisam ser definidos.

Questionários da versão anterior existiam apenas no navegador e não são importados silenciosamente. A versão do questionário foi atualizada para exigir nova autorização. Não há dados fictícios no banco principal; os testes usam banco separado em `test-artifacts`.

## Definições dos indicadores

| Indicador | Definição |
| --- | --- |
| Iniciados | Questionários registrados após autorização de armazenamento; não mede visitas à landing |
| Concluídos | Questionários que tiveram todas as respostas exigidas válidas ao menos uma vez |
| Taxa de conclusão | Concluídos / iniciados no mesmo recorte |
| Contatos | Questionários com contato validado e consentimento, não pessoas deduplicadas por telefone |
| Taxa de captura | Contatos / concluídos no mesmo recorte |
| Perfis visualizados | Questionários com contato e evento de visualização, contados uma única vez |
| Aderência | Última resposta “Sim, muito bem” / questionários que avaliaram; não é validação psicológica |
| Cliques | Questionários com evento de clique no ebook, não compras confirmadas |
| Distribuições | Quantidade de questionários com cada alternativa; múltipla seleção pode somar mais que o total de participantes |
| Histórico diário | Coorte pela data do primeiro registro no servidor, usando America/Sao_Paulo; conclusão e contato pertencem à coorte de início |

Todos os filtros se aplicam às tabelas e aos indicadores juntos. Denominadores vazios aparecem como “—”. Dias sem início entre a primeira e última coorte observadas aparecem com zero. Não há conversão em venda, receita ou abandono definitivo inferido de um questionário em andamento.

## Testes e continuidade

`npm test` executa o motor e os testes de servidor/métricas. `tests/browser.mjs` verifica a jornada do participante. `tests/admin-browser.mjs` exige servidor isolado na porta 4181 com `ROMPA_DB_PATH` apontando a um arquivo em `test-artifacts`; ele cria dados fictícios e os remove ao terminar. Não execute testes de fixtures contra o banco principal.

Próximas etapas de produção: hospedagem HTTPS, controle de acesso operacional, retenção e backup, política definitiva, recuperação de senha, observabilidade e implantação. O SQLite e o processo Node atendem à validação local; não há promessa de capacidade para tráfego público nesta implementação.
