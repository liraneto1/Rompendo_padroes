# Teste dos Padrões ROMPA

Implementação local baseada no PRD v1.0. O teste está em `/teste/` e a administração em `/admin/`, com login, questionários e dashboard. Respostas autorizadas são persistidas em SQLite no servidor local. Consulte `docs/administracao.md` para detalhes e limites desta etapa.

## Executar

Requisito: Node.js 24 ou superior. A aplicação e os testes de regras não têm dependências npm.

```sh
npm start
```

Abra http://127.0.0.1:4173/teste/ ou http://127.0.0.1:4173/admin/. No primeiro acesso administrativo, crie seu email e senha. Em desenvolvimento, o servidor escuta apenas a interface local. Defina `PORT` para mudar a porta. Com `NODE_ENV=production`, escuta em `0.0.0.0`; consulte `docs/hostinger.md` para HTTPS, domínio e persistência. No Windows, execute `Iniciar-ROMPA.ps1` para iniciar em segundo plano; os endereços só funcionam com o servidor ativo.

```sh
npm test
```

O teste de navegador requer Playwright e um navegador disponível. Com o servidor rodando:

```sh
node tests/browser.mjs
```

É possível apontar `PLAYWRIGHT_MODULE` para o pacote Playwright do ambiente e `BROWSER_CHANNEL=chrome` para usar o Chrome instalado. As capturas de QA são gravadas em `test-artifacts/`, ignorado pelo Git.

## Implementado

- Landing, preparação, quatro blocos, microvitória e microinsight.
- 15 perguntas; Q08 condicional; 35 frases-espelho do PRD em sete áreas e alternativa aberta para outra área.
- Validação obrigatória, limites de seleção, campos Outro e navegação de retorno.
- Sessão e origem UTM; recuperação por aba após atualizar a página.
- Captura local de nome, WhatsApp e email opcional após concluir as perguntas; consentimentos separados e datados.
- Perfil com declarações do usuário, Loop, seis momentos de percepção, Janela de Interrupção, consequências, desejo, foco e Primeiro Momento ROMPA.
- Aderência percebida e eventos locais, sem respostas abertas nos metadados de eventos.
- Oferta de R$ 37 apresentada como hipótese; checkout configurável, desativado até receber URL real.
- Impressão do perfil pelo navegador, inclusive opção de salvar como PDF do próprio navegador.
- Layout responsivo, foco visível e formulários com controles nativos.

## Limites desta versão

Use dados fictícios. Após autorização, as respostas são salvas no servidor local e ficam disponíveis ao administrador autenticado. Uma cópia na aba permite recuperar o progresso. O botão de apagar exclui o conteúdo do registro ativo e limpa a sessão; requer conexão com o servidor. Consulte a página de privacidade e docs/administracao.md para o comportamento completo.

Não há hospedagem pública, disparo de WhatsApp/email, IA, analytics externo ou webhook de compra. A política definitiva, retenção, recuperação de senha e implantação HTTPS permanecem pendentes.

O site institucional existente não foi alterado para encaminhar tráfego ao protótipo. Seu CTA atual continua intacto. A prévia não foi publicada.

## Organização

| Arquivo | Responsabilidade |
| --- | --- |
| `dist/teste/questions.js` | Perguntas, alternativas, taxonomia e textos condicionais |
| `dist/teste/engine.js` | Validação, ramificação, perfil, sessão e associação do lead |
| `dist/teste/app.js` | Telas, navegação, persistência e eventos |
| `dist/teste/config.js` | Versões, preço e configuração de checkout |
| `dist/teste/style.css` | Identidade visual, responsividade e impressão |
| `scripts/serve.mjs` | Servidor HTTP do frontend e da API, local ou produção |
| `tests/engine.test.mjs` | Testes das regras de negócio |
| `tests/browser.mjs` | Jornada real no navegador e verificações responsivas |
| `docs/analise-prd.md` | Escopo, decisões e pendências de produção |
| `docs/teste-de-mesa.md` | Roteiro de validação com 5–10 pessoas |

Os arquivos em `dist/teste/` são o código-fonte desta implementação estática: não há etapa de compilação ou código minificado. Nenhum segredo deve ser incluído nesses arquivos públicos.

Para ativar o checkout, preencha `checkoutUrl` ou uma entrada em `campaignCheckouts` em `config.js`. Apenas HTTPS é aceito. Isso permite testar o redirecionamento, mas não comprova compra; `purchase_completed` dependerá de confirmação no backend. Configure e valide as demais condições de lançamento antes de distribuir o teste.

## Preparação para Hostinger

Consulte [Deploy na Hostinger](docs/hostinger.md) para configurações exatas, riscos e backup do SQLite. Use Node.js 24, configure NODE_ENV=production e um ROMPA_DB_PATH persistente fora de dist. Execute npm run build e npm test antes do deploy. A preparação não publica a aplicação nem modifica questionário, frontend ou regras de negócio.
