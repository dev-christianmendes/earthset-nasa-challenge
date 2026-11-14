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

## 2026-11-14 · Node 24.22.3 e ferramentas de economia de token

- **Arquivos alterados:** `AGENTS.md` (versão local do Node na seção 3; pendência de ambiente na seção 6 marcada como resolvida), `docs/execution-log.md` (esta entrada).
- **Node:** versão local 24.22.3, padrão do nvm. Verificado com `node --version` (v24.22.3). Atende ao mínimo de 24.15 do context-mode.
- **Comandos e resultados:**
  - `ctx_doctor` (context-mode 2.1.10): 11 de 11 checks PASS, com Node v24.22.3. D2 node: ok. D9 index: 4 fontes, 69 chunks.
  - `rtk --version`: rtk 1.2.0. Hook `rtk hook claude` presente em `~/.claude/settings.json`.
  - Leitura de `docs/backlog.md` com `rtk cat`: 45 linhas, igual a `wc -l`. Uma leitura anterior, feita com `cat` direto no Bash, saiu com 2 linhas em vez de 45. Não reproduzido em três tentativas seguintes; causa não identificada.
  - `rtk gain`: 956 tokens economizados em 37 comandos (12,3%).
- **Pendências:** testar `rtk bulk-read` e `rtk code-write` (`RTK.md`, não testados); rastrear a leitura incompleta da primeira tentativa se voltar.

## 2026-11-14 · B1.5 (frio sem energia) e estado do CI

- **Arquivos alterados:** `tests/engine/game.test.ts` (teste novo, "sem energia, a base esfria e perde 1 coração a cada 6 horas (B1.5)"), `docs/regras-recursos.md` (regra de frio na seção de corações; item removido de "O que ainda não existe"), `docs/backlog.md` (B1.5 e B0.7 marcados), `AGENTS.md` (seção 6 e bloco 1 atualizados).
- **Decisão:** o frio como causa de perda de coração já é a regra de bateria zerada. Não há temperatura separada, porque não há número aprovado para ela. Se o autor quiser temperatura própria, vira item novo no backlog.
- **CI:** as execuções em `main` (`43606329560`, `43606673030`, `43606952442`, `43607076254`) terminaram com `success`, sem falha. Esta é a primeira execução real do `ci.yml` (B0.7).
- **Comandos e resultados:**
  - `npm run typecheck`: passou.
  - `npm run test`: 6 arquivos, 49 testes, todos passaram (o teste novo incluído).
  - `npm run build`: passou (`dist/index.html` 5.41 kB).
  - `python3 -m unittest discover -s tests` em `data-pipeline`: 5 testes, OK.
- **Tela:** nenhuma mudança visual; screenshot não refeito.
- **Ferramentas:** `ctx_doctor` 11 de 11 PASS. `ctx_stats`: 14,3% da sessão e 15,2% do projeto mantidos fora do chat. `rtk gain`: 987 tokens economizados em 55 comandos (9,0%). Serena respondeu ao `initial_instructions`; a chamada de símbolos foi testada antes.
- **Pendências:** B0.6 (`[?]`, autor), B1.2 parcial, B3.2 a B3.4, B2.x, B4.x. Commit e push não feitos nesta etapa, porque não foram pedidos.

## 2026-11-14 · B0.6 marcado como feito

- **Arquivos alterados:** `docs/backlog.md` (B0.6 de `[?]` para `[x]`, com a razão no item).
- **Motivo:** o envio foi autorizado pelo autor e feito em 14/11/2026; o histórico foi revisado e reescrito para retirar menções ao protótipo.
- **Comandos:** commit `docs(backlog): marca B0.6 como feito` e `git push origin main` (sem erros).
- **Pendências:** nenhuma em B0.6.

## 2026-11-14 · B3.2 enquadramento no celular

- **Arquivos alterados:** `src/main.ts` (função `frameForViewport`: em tela até 700 px, `setViewOffset` sobe a cena 22% da altura; chamada no início e no redimensionamento), `index.html` (HUD no celular com `max-height: 46vh`, antes 58vh), `docs/backlog.md` (B3.2 marcado).
- **Problema:** no celular de 390×844, o HUD cobria a base, que ficava no centro da tela.
- **Comandos e resultados:**
  - `npm run typecheck`: passou.
  - `npm run test`: 6 arquivos, 49 testes, todos passaram.
  - `npm run build`: passou.
  - Chrome headless em `http://localhost:5180/` (servidor Vite iniciado nesta etapa): celular antes e depois; depois, a base aparece acima do HUD.
  - Desktop: o código não aplica deslocamento acima de 700 px (`clearViewOffset`). A captura de desktop não ficou idêntica byte a byte à anterior, mas a cena tem animação de Sol e hora, então a diferença de pixel não prova mudança. Não verifiquei por pixel.
- **Pendências:** B3.3 (visual), B3.4 (modo escola).

## 2026-11-14 · B3.3 (parcial): textura do chão e modelo do robô

- **Arquivos alterados:** `src/main.ts` (função `regolithTexture`, canvas com grão aleatório sobre o chão; robô agora é um grupo com corpo, esteiras, antena e luz que pisca enquanto trabalha; balanço do robô ao andar), `docs/backlog.md` (B3.3 como parcial, ainda `[ ]`).
- **Comandos e resultados:**
  - `npm run typecheck`: passou.
  - `npm run test`: 6 arquivos, 49 testes, todos passaram.
  - `npm run build`: passou.
  - Capturas com Chrome headless em desktop e celular geradas, mas **não revisadas**: a leitura de imagem foi bloqueada pelo hook nesta sessão, e `rtk bulk-read` só aceita texto. Por isso B3.3 não está marcado como feito.
- **Pendências:** céu, modelos da base, paleta e revisão visual das capturas de B3.3; B3.4.

## 2026-11-14 · B3.3 (ajustes após revisão das capturas)

- **Arquivos alterados:** `src/main.ts` (estrelas e Terra com `fog: false`, porque a névoa de 60 a 220 unidades escondia as estrelas; antena da base que aparece com `antennaInstalled`; robô em escala 1.7), `index.html` (barras de recursos agrupadas em `.meters`, duas colunas no celular; espaçamentos menores só em até 700 px), `docs/backlog.md` (B3.3 atualizado), esta entrada.
- **Problema visto nas capturas:** no celular, os botões de ação ficavam abaixo da dobra; o robô era pequeno demais; não havia estrelas no céu.
- **Comandos e resultados:**
  - `npm run typecheck`: passou.
  - `npm run test`: 6 arquivos, 49 testes, todos passaram.
  - `npm run build`: passou (aviso de chunk acima de 500 kB, já existia).
  - Vite em `http://localhost:5180/` (título "Earthset · Base no polo sul da Lua"), Chrome headless: `desktop.png` 1280×800 e `mobile.png` 390×844, revisados. Botões Gelo, Painel e Antena visíveis no celular; estrelas visíveis no desktop; robô legível.
- **Pendências:** B3.3 segue parcial (paleta, modelos extras da base, céu); B3.4.

## 2026-11-14 · B3.3 concluído: paleta, modelos da base e refinamentos

- **Arquivos alterados:** `src/main.ts` (objeto `PALETTE` com as cores da cena, usado nos materiais; habitat com tampas, faixa e escotilha; estufa com nervuras; painéis em suportes; luz ambiente um pouco mais forte), `docs/backlog.md` (B3.3 marcado `[x]`, com o limite assumido), `AGENTS.md` (linha do bloco 3 atualizada), esta entrada.
- **Decisão:** o céu fica preto com estrelas. A Lua não tem atmosfera, e um gradiente seria invenção. O relevo segue ilustrativo, como o B2 registra.
- **Comandos e resultados:**
  - `npm run typecheck`: passou.
  - `npm run test`: 6 arquivos, 49 testes, todos passaram.
  - `npm run build`: passou.
  - Vite em `http://localhost:5180/` (título confirmado), Chrome headless: `desktop-b33c.png` 1280×800 e `mobile-b33c.png` 390×844, revisados. Habitat, estufa e painéis lidos com clareza; botões do celular visíveis.
- **Limite:** as capturas mostram o estado inicial (2 painéis, sem antena). Os estados com 12 painéis e com antena instalada não foram capturados; o código que os mostra está no `updateScene`.
- **Commit:** feito localmente, sem push (não foi pedido nesta etapa).
- **Pendências:** B3.4 (modo escola e explicações); B4 (envio).

## 2026-11-14 · B3.4 modo escola e explicações por recurso

- **Arquivos alterados:** `src/school.ts` (novo: `SCHOOL_LABELS` e `EXPLANATIONS`, textos sem DOM), `src/main.ts` (caixa "Modo escola", troca de rótulos, preenchimento das explicações), `index.html` (caixa, `data-label` e `data-hint` nos elementos, CSS `.hint` que só aparece com `body.school`), `tests/school.test.ts` (novo: texto não vazio e curto, fonte classificada como real ou regra do jogo, rótulo curto), `docs/backlog.md` (B3.4 marcado), `AGENTS.md` (bloco 3 e próximo passo), esta entrada.
- **Decisão:** as explicações dizem a fonte de cada número. Só o Sol é dado real (JPL Horizons); o resto é regra do jogo ou ilustrativo, como no rodapé do HUD.
- **Comandos e resultados:**
  - `npm run typecheck`: passou.
  - `npm run test`: 6 arquivos, 52 testes (49 antigos e 3 novos), todos passaram.
  - `npm run build`: passou.
  - Vite em `http://localhost:5180/`, Chrome headless: captura desktop com o modo escola ligado e celular 390×844 com o modo ligado. Rótulos trocam e as explicações aparecem sob cada recurso.
- **Verificação de captura:** para tirar a captura com o modo ligado, marquei a caixa no HTML por um instante e desfiz a mudança logo depois (confirmado com grep; `index.html` tem a caixa sem `checked`).
- **Limite:** com o modo ligado, o HUD fica longo e rola no desktop e no celular. Aceito, porque o modo é opcional. A caixa não lembra a escolha ao recarregar a página.
- **Commit:** feito localmente, sem push (não foi pedido nesta etapa).
- **Pendências:** B4 (envio: vídeo ou slides em inglês, referências, declaração de IA em inglês).
