# Diário de execução

Registro de cada etapa técnica: arquivos, comandos, resultados (sucessos e falhas), decisões e bloqueios. Mais recente no fim.

---

## 2026-11-14 · projeto novo · B0.1 a B0.4

- **Decisão:** o projeto novo fica em `~/projects-chris/earthset-nasa-challenge`. O projeto anterior não foi alterado.
- **Regra:** nenhum código de trabalho anterior foi copiado.
- **Arquivos criados:** `package.json`, `tsconfig.json`, `index.html`, `src/engine/clock.ts`, `src/main.ts`, `tests/engine/clock.test.ts`, `AGENTS.md`, `AI_DISCLOSURE.md`, `README.md`, `.gitignore`, `LICENSE`, `docs/backlog.md`, `docs/event-rules.md`, `docs/execution-log.md`.
- **Comandos e resultados:**
  - `npm install`: concluiu. Aviso do npm: `npm audit` reportou vulnerabilidades. **Não tratado ainda**; revisar com `npm audit` antes do envio.
  - `npm run typecheck`: passou.
  - `npx vitest run`: 4 de 4 passaram.
  - `npm run build`: passou (aviso de chunk acima de 500 kB, esperado com three.js).
- **Pendências:** B0.5 (print da cena), o `npm audit`, e A1 (trabalho anterior ao evento) com o Local Lead.

## 2026-11-14 · projeto novo · B0.5 (verificação visual e correção)

- **Print desktop e celular:** primeiro print saiu preto. Diagnóstico pelo console do Chrome (`--enable-logging=stderr`): `Uncaught RangeError: horas inválidas: -1.42`. Causa: no primeiro quadro o timestamp do `requestAnimationFrame` era menor que `performance.now()`, então `dt` ficou negativo e o motor, que rejeita horas negativas, lançou erro e o laço parou. WebGL2 confirmado disponível no Chrome sem janela (teste à parte).
- **Correção:** `src/main.ts` passa a guardar a referência no primeiro quadro e a limitar `dt` a zero ou mais. Refeitos `npm run typecheck`, `npm run build` e os prints.
- **Resultado:** desktop e celular renderizam; o HUD mostra "Hora de jogo: N de 708" e avança.
- **Pendência de visual:** luz inicial escura, porque o Sol começa perto do horizonte. Ajustar em B3.1.
- **Limpeza:** o motor não importa three.js, DOM nem `window` (grep da fronteira limpo).

## 2026-11-14 · projeto novo · bloco B1 (regras de recursos)

- **Arquivos criados:** `src/engine/resources.ts`, `src/engine/game.ts`, `tests/engine/resources.test.ts`, `tests/engine/game.test.ts`, `docs/regras-recursos.md`.
- **Origem das regras:** especificação de regras de trabalho anterior, reescrita aqui. Nenhum código copiado. Números marcados como ajustáveis.
- **Comandos e resultados:**
  - `npm run typecheck`: passou.
  - `npm run test`: 27 de 27 em 3 arquivos (4 do relógio, 13 de recursos, 10 de partida e ações).
  - `npm run build`: passou.
  - Fronteira do motor: limpa.
- **Falha no primeiro teste de vitória:** a base passiva, sem robô, perdeu a água e terminou derrotada. Causa: a regra de água e comida está correta; o teste é que supunha vitória sem gelo. Corrigido: o teste agora cobre os dois casos (passiva perde; com recursos repostos vence). Robô e gelo entram em B1.4.
- **Pendência:** `docs/domain.md` citado nos cabeçalhos não existia neste projeto. Corrigido: a referência passou a `docs/regras-recursos.md`.

## 2026-11-14 · B1.4 robô e gelo, ligação à tela, CI e AGENTS

- **Arquivos criados:** `src/engine/robot.ts`, `tests/engine/robot.test.ts`, `tests/engine/partida.test.ts`, `.github/workflows/ci.yml`, `.github/dependabot.yml`, `.github/copilot-instructions.md`, `CLAUDE.md`.
- **Arquivos alterados:** `src/engine/game.ts` (estado `robot`, ações `ENQUEUE_TASK` e `CANCEL_TASK`, avanço do robô), `src/engine/resources.ts` (consumo do robô, parâmetro opcional `robotWorking`), `src/main.ts` (HUD ligado ao motor, sol, painéis visíveis, fim de partida), `index.html` (painel em português), `AGENTS.md` (reescrito como guia completo), `docs/backlog.md`, `docs/regras-recursos.md`.
- **Falha e correção, equilíbrio:** o primeiro plano com robô perdeu. Sonda temporária (removida) mostrou que a noite de 354 h zerava a bateria de 150 e depois o ar. Testes com capacidade 800, 900, 1000, 1200 e 12 painéis: 1200 com 12 painéis vence com 3 corações. Escolha de jogo, não dado científico; registrada em `docs/regras-recursos.md`.
- **Falha de ferramenta:** o Bash foi bloqueado uma vez pelo classificador de modo automático, porque um hook (`rtk`) reescreveu o comando depois da revisão. A mensagem pedia repetir o comando reescrito; não repeti. Leituras foram feitas pela ferramenta Read. Repetir o Bash depois funcionou normalmente.
- **Comandos e resultados (finais):**
  - `npm run typecheck`: passou.
  - `npx vitest run`: 5 arquivos, 41 testes, todos passaram.
  - `npm run build`: passou (aviso de chunk acima de 500 kB, esperado com three.js).
  - Fronteira do motor (grep de `three`, `document.`, `window.`, `HTMLElement` em `src/engine`): limpa.
  - `npm audit --omit=dev`: 0 vulnerabilidades (dependência de produção).
  - `npm audit` completo: 3 problemas em `vitest` 3.2.7 e `tinypool` (1 moderado, 2 críticos), só de desenvolvimento. A correção indicada é vitest 5 (mudança maior). Não há correção em 3.x (verificado com `npm view vitest@3`). **Risco aceito**, a revisar depois do evento.
- **Verificação visual:** Chrome headless (`google-chrome --headless=new`, SwiftShader) em `http://localhost:5180/` (porta 5173 estava ocupada por outro projeto; a primeira captura saiu dele e foi descartada). Desktop 1280×800 e celular 390×844 conferidos. Desktop: HUD legível, sol baixo, painéis visíveis. Celular: HUD ocupa a parte de baixo e esconde a base (pendente, B3.2). **Não feito:** clique em botões no navegador; a ação foi coberta pelos testes de `dispatch`.
- **Estado do visual:** básico. Não declarado pronto (B3.3).
- **CI/CD:** `ci.yml` com job `verify` (npm ci, typecheck, testes, build, auditoria de produção, artefato `dist`) e job `boundary`. **Não rodou**: nada foi enviado ao GitHub. A checagem local da fronteira passou com o mesmo grep.
- **Inventário das ferramentas de economia de token (14/11):**
  - **context-mode 2.1.10:** ativo (plugin habilitado em `~/.claude/settings.json`, MCP conectado). **Não cumpre o papel por inteiro:** `ctx_doctor` falha em D2 (Node 24.14.0; exige 24.15 ou mais novo), e o hook grava erro `NODE_TOO_OLD`. O índice tem 0 fontes. Correção: atualizar o Node (`nvm install 24` ou nodejs.org). **Ação do autor**, porque mexe no sistema.
  - **rtk 1.2.0:** ativo (hook `PreToolUse` em Bash com `rtk hook claude`). `rtk gain` mostra 427 tokens economizados em 4 comandos (50,5%). Limitação: o `rtk` avisa que `Read` não é coberto pelo hook (`rtk init -g` cobriria). Efeito colateral: o caso de bloqueio acima.
  - **Serena:** carregado e projeto ativado (`earthset-nasa-challenge`, TypeScript). Não usei as ferramentas simbólicas nesta etapa; o projeto é pequeno e Read/Grep bastaram.
  - **commitment-issues:** ferramentas somente de leitura sobre a org; não é ferramenta de economia de token.
- **Pendências desta etapa:** B1.5 (frio), B2.1 (decisão do autor), B3.2 (enquadramento no celular), B3.3 (visual), B3.4 (modo escola), B4 (envio). Ação do autor: atualizar Node para 24.15+ e decidir A1.

## 2026-11-14 · Sol real, CI, ferramentas e primeiro envio

- **Node:** o nvm já tinha 24.22.3 instalado, mas o padrão era 24.14.0. `nvm alias default 24.22.3` aplicado. O servidor MCP do context-mode só usa a versão nova depois de reiniciar a sessão do Claude Code. `ctx_doctor` depois da troca ainda mostrava D2 FAIL (Node 24.14.0) e índice com 0 fontes.
- **rtk:** `rtk init -g` rodou. O hook `rtk hook claude` já estava em `~/.claude/settings.json` (confirmado com grep). A pergunta de patch do settings veio com padrão "não" e não foi alterada. `RTK.md` global foi atualizado pelo rtk, com dois comandos de delegação. O hook cobre só Bash; Read continua sem cobertura.
- **Sol real:** `data-pipeline/fetch_sun.py` gerou `src/data/sun-south-pole.json` (709 amostras horárias do JPL Horizons). Horizonte plano: elevação entre 0,93° e 2,02° o tempo todo, então a noite vem do relevo. Horizontes por local (pico 0°, encosta 1,2°, borda 1,6°) são ilustrativos. A base começa na encosta, porque na borda começaria na sombra.
- **Testes:** 48 testes do motor (Vitest) e 5 do pipeline (`unittest`) passam. Typecheck, build, auditoria de produção (0) e fronteira do motor passam.
- **Item A1:** resolvido pelo autor (projeto novo). Bloqueio removido de backlog, event-rules, AI_DISCLOSURE e AGENTS.
- **Envio:** autorizado pelo autor. Repositório `dev-christianmendes/earthset-nasa-challenge` (público, vazio) recebeu os commits em Conventional Commits, com push para `main`.
- **Pendências:** reiniciar a sessão para o context-mode; B1.5 (frio); B3.2 (enquadramento no celular); B3.3 (visual); B2.3 (LOLA e DONKI); B3.4 (modo escola); B4 (envio).
