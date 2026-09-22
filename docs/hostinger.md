# Deploy ROMPA na Hostinger

Preparação de 22/09/2026. Nenhum deploy, envio ao GitHub ou migração de banco foi realizado nesta tarefa. O frontend em `dist/`, questionário, métricas, esquema SQLite e testes anteriores foram preservados.

## Configuração da aplicação

Use hospedagem **Node.js Web App**, não hospedagem somente de arquivos estáticos. O servidor precisa executar para `/api/`, `/teste/` e `/admin/` funcionarem juntos. O guia oficial da Hostinger documenta Node.js 24 e o tipo de aplicação **Other**: https://www.hostinger.com/support/how-to-deploy-a-nodejs-website-in-hostinger/

| Campo | Valor |
| --- | --- |
| Diretório raiz | Pasta que contém este `package.json` (`site-rompa`, se o repositório contiver a pasta pai; `.` se publicar apenas o projeto) |
| Framework | Other / Node.js |
| Node.js | 24.x (necessário para `node:sqlite`) |
| Instalação, caso solicitada | `npm install --omit=dev` (não há dependências externas de runtime) |
| Build, caso solicitado | `npm run build` (verificação de sintaxe; não transforma nem remove `dist`) |
| Arquivo de entrada | `scripts/serve.mjs` |
| Comando de início | `npm start` |
| Alternativa de início | `npm run start:production` (define `NODE_ENV=production` no próprio processo, inclusive no Windows) |
| Diretório público/output, se solicitado | `dist`, mantendo a execução do backend e o projeto completo |
| Instâncias | Uma instância Node com um único disco persistente |

Configure no painel:

```text
NODE_ENV=production
ROMPA_BIND_ADDRESS=0.0.0.0
ROMPA_DB_PATH=<caminho absoluto real do volume persistente>/rompa.sqlite
```

Não copie o marcador `<...>` literalmente. A hospedagem fornece `PORT`; preserve seu valor. Sem `PORT`, o fallback é 4173. O projeto não carrega `.env` automaticamente; `.env.example` é apenas referência. Não configure segredos no frontend.

Conecte `arquiteturadavida.com.br` e `www.arquiteturadavida.com.br`, configure DNS e HTTPS e encaminhe todo o tráfego ao processo Node. O proxy deve preservar o `Host` público (com porta opcional). Não usamos `X-Forwarded-Host` ou `X-Forwarded-Proto` para autorizar solicitações. Origens HTTPS precisam corresponder ao Host; a proteção de origem e a ausência de CORS aberto foram mantidas. Domínios temporários da Hostinger não fazem parte da lista permitida.

O cookie administrativo recebe `Secure` em produção; acesse `/admin/` por HTTPS. HTTP continua funcionando localmente quando `NODE_ENV` não é `production`. `npm start` sem variáveis mantém porta 4173, bind 127.0.0.1 e o banco `.data/rompa.sqlite`. `Iniciar-ROMPA.ps1` continua sendo o inicializador local.

## SQLite: condição para produção

`ROMPA_DB_PATH` controla apenas o nome/caminho do arquivo: **não torna o filesystem persistente**. Sem configuração, o banco fica em `.data/rompa.sqlite` dentro do checkout. Se a hospedagem substituir a pasta ou o container em deploy, rollback, reinício ou mudança de instância, dados, administrador, sessões e auditoria podem desaparecer. O servidor cria um banco vazio quando o arquivo não existe, portanto o processo iniciar não prova que os dados foram preservados.

Antes de coletar dados reais, confirme com a Hostinger que o diretório escolhido é gravável, persistente através de novos deploys/reinícios e montado na mesma instância. Não há garantia de volume persistente para este plano documentada nas fontes consultadas, nem acesso ao seu painel para verificar. A documentação geral da Hostinger indica VPS para bancos como SQLite: https://www.hostinger.com/support/1583226-which-database-management-system-is-used-at-hostinger/

Se a modalidade gerenciada não oferecer esse volume, use uma VPS com disco persistente para manter SQLite; não troque de banco silenciosamente. Em uma VPS, um caminho possível é `/var/lib/rompa/rompa.sqlite`, criado e pertencente ao usuário do serviço. O caminho é exemplo, não um volume provisionado pela aplicação.

O Store utiliza WAL e `busy_timeout=5000`. O diretório precisa permitir criar e escrever o arquivo principal e os auxiliares `-wal` e `-shm`. Use disco local, fora de `dist` e da pasta substituída a cada release; não distribua o banco entre réplicas com discos independentes nem use filesystem de rede sem validação de locking compatível com SQLite.

### Preservar e restaurar os dados existentes

1. Pare o servidor de forma limpa antes de copiar o banco. Não copie apenas `rompa.sqlite` enquanto o processo estiver escrevendo: transações podem estar no WAL.
2. Faça backup consistente com a API/ferramenta de backup SQLite ou, com o serviço parado, preserve o conjunto de arquivos do banco. Não apague manualmente os auxiliares de um banco ativo.
3. Transfira o backup por canal privado para o volume persistente; nunca GitHub ou `dist`. Ajuste permissões e configure `ROMPA_DB_PATH` para esse arquivo antes de iniciar.
4. Confirme o administrador e os registros existentes. Reinicie e faça um redeploy controlado; confirme novamente a persistência. Faça a prova inicialmente com dados fictícios.
5. Mantenha backups consistentes fora do servidor e teste restauração. Backups também contêm dados pessoais e precisam de acesso restrito e política de retenção.

## Limites operacionais preservados

- Banco novo permite que o primeiro visitante de `/admin/` crie o administrador. Configure-o em acesso restrito antes de abrir tráfego público, ou transfira um banco já configurado. A regra não foi alterada.
- Rate limiting continua usando `req.socket.remoteAddress`. Atrás de proxy, visitantes podem compartilhar o mesmo limite; não confiamos em cabeçalhos de IP enviados pelo cliente. Confirme o comportamento sob tráfego real antes do lançamento.
- Há links locais `http://127.0.0.1:4173/teste/` na página institucional, conforme o pedido anterior. Foram preservados por este pedido de não modificar frontend/conteúdo. Para visitantes públicos, esses links não conduzirão ao teste hospedado; a troca para `/teste/` precisa ser feita separadamente.
- Checkout, política definitiva, retenção e recuperação de senha continuam com os limites descritos na documentação atual. Esta tarefa prepara execução e persistência, não altera essas regras.

## GitHub e validação

Publique apenas o projeto completo: `package.json`, `scripts/`, `server/`, `dist/`, testes e documentação. `dist` contém fontes necessários e não deve ser ignorado. Não envie `.data`, bancos, backups, `.env`, logs, relatórios de teste, chaves ou `node_modules`. `.gitignore` não remove arquivos que já tenham sido versionados; a inspeção desta tarefa não encontrou banco ou `.env` rastreado.

Execute `npm run build` e `npm test`. Os testes de navegador existentes continuam opcionais ao deploy e requerem Playwright. Use somente banco temporário: `tests/admin-browser.mjs` exige porta 4181; `tests/browser.mjs` aceita `ROMPA_TEST_URL`. Nunca execute fixtures contra os dados de produção.

## Validação executada nesta preparação

- `npm run build`: passou.
- `npm test`: 28 testes passaram (25 existentes e 3 novos de configuração/segurança HTTP).
- `tests/browser.mjs`: passou (jornada completa e larguras 320/390/1440).
- `tests/admin-browser.mjs`: passou (cadastro/login, filtros, métricas, detalhes, exclusão e logout).
- Inicialização real pelo comando de produção: PORT=4182, bind=0.0.0.0 e 12 combinações de rota/Host passaram (`/`, `/teste/`, `/admin/`, `/api/admin/session`; os dois domínios e localhost).
- Os testes de navegador e de inicialização utilizaram SQLite temporário, sem acessar `.data/rompa.sqlite`.
- Corrigida também a comparação de caminhos que rejeitava a rota `/`; a verificação continua impedindo acesso fora de `dist`.
- Scripts auxiliares e capturas de validação foram gerados em `test-artifacts/`, ignorado pelo Git. Os testes existentes não foram modificados.
