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

## 2026-11-14 · B3.1 alertas de recursos baixos

- **Arquivos alterados:** `src/main.ts` (`LOW_ALERT_PERCENT`, `setBar` marca `.meter.low`), `index.html` (CSS `.meter.low` em vermelho), `docs/backlog.md` (B3.1 com o que falta), esta entrada.
- **Decisão:** limites de alerta: bateria abaixo de 20%, ar abaixo de 30, água e comida abaixo de 20. São escolhas de tela, não regra do motor.
- **Textos em inglês:** não entram na interface. A regra 6 de `AGENTS.md` manda a interface em português e o inglês só na página de envio e nos materiais linkados. O item B3.1 ficou com a revisão de copy como falta.
- **Comandos e resultados:**
  - `npm run typecheck`: passou.
  - `npm run test`: 52 testes, todos passaram.
  - `npm run build`: passou.
  - Captura com os limites temporariamente altos (bateria 90, ar 85) para ver o alerta: `desktop-alerta.png`, com bateria e ar em vermelho. Limites originais restaurados e conferidos com grep.
- **Commit:** feito localmente, sem push.
- **Pendências:** B3.1 (revisão de copy); B2.3 (LOLA, DONKI, revisão do equilíbrio com o Sol real); B4 só depois de B2.3 e B3.1.

## 2026-11-14 · Desenho v2 (F0) e C1: horizonte real do LOLA

- **Desenho:** `docs/arquitetura.md` (requisitos E1–E12 do evento e R-… do produto, camadas, fases F0–F6, decisões D1–D3).
- **F0 (refatoração, sem mudança de comportamento):** `src/main.ts` separado em `src/render/scene.ts`, `src/ui/hud.ts`, `src/data/sun.ts` e `src/main.ts`. Typecheck, 52 testes e build iguais; captura conferida.
- **C1 (LOLA):**
  - Fonte: `LDEM_80S_20M.IMG` (MIT/PDS), 20 m por pixel, polar estereográfica, centro no polo. Confirmada em `https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_20M.LBL`.
  - `data-pipeline/fetch_lola.py`: baixa a faixa de 40 km por HTTP Range (121.660.800 bytes; 7 min 33 s no total, quase tudo na transferência). Calcula 72 raios por posição, com curvatura lunar.
  - `src/data/terrain-sites.json` gerado. `src/engine/terrain.ts` (`horizonAt`, interpolação e volta de 360°) e `src/engine/sun.ts` (`isSunlit` agora recebe o relevo; `SITE_HORIZON_DEG` removido).
  - Medido (Sol de 15/11/2026): 448 h (peak), 182 h (slope), 0 h (rim). Depois, com a janela de 09/10/2024: 379, 179 e 0 h. O início (slope) começa na sombra, como a captura mostra.
- **Comandos e resultados:**
  - `python3 -m unittest discover -s data-pipeline/tests`: 16 testes, OK.
  - `npx vitest run`: 57 testes, OK (`tests/engine/terrain.test.ts` novo, `sun.test.ts` com contagens fixas, `partida.test.ts` ainda passa).
  - `npm run typecheck` e `npm run build`: passam. Fronteira do motor (sem three, DOM ou window em `src/engine`): ok.
  - Captura `desktop-c1.png` com o relevo real: base na sombra na hora 0.
- **Falhas e decisões:**
  - Primeira versão do teste de faixa usava meio pixel de tolerância; o arredondamento tirou o muro da malha. Trocado por um pixel inteiro, no teste.
  - `rim` tem zero horas de Sol. A asserção antiga (`count('rim') > 0`) era premissa do horizonte ilustrativo; trocada pelas contagens medidas.
  - Convenção de azimute não verificada com dado externo (ver `docs/data-sources.md`).
- **Decisão posterior (autor, 14/11):** a base começa no morro (`site: 'peak'` em `src/main.ts` e em `tests/engine/partida.test.ts`). Vitest: 57 testes passam com o morro.
- **Pendências:** equilíbrio com o Sol real (B2.3); verificar azimute; C2 (DONKI, cenário D1); C3; V1–V4; I2–I3; F5; F6 (envio, só com pedido).
- **Commit:** feito localmente, sem push.

## 2026-11-14 · C2 e C3: clima espacial (DONKI), em andamento

- **Arquivos:** `data-pipeline/fetch_donki.py` (novo), `data-pipeline/tests/test_fetch_donki.py` (novo), `src/engine/space-weather.ts` (novo), `src/data/space-weather.ts` (novo), `tests/engine/space-weather.test.ts` (novo), `src/engine/game.ts` (`advance` com clima), `src/engine/resources.ts` (`deriveFlow` com fator solar), `src/ui/hud.ts` (linha do clima), `src/main.ts`, `index.html` (linha `#space`, rodapé), `src/school.ts` (explicação do clima), `docs/data-sources.md` (seção 3), `docs/backlog.md`.
- **Comandos e resultados:**
  - `python3 -m unittest discover -s data-pipeline/tests`: 22 testes, OK.
  - `npx vitest run tests/engine tests/school.test.ts`: 63 testes, OK (inclui 6 de clima).
  - `npm run typecheck`: **falha** até existir `src/data/space-weather.json`, que depende do download.
- **Falha de rede:** `fetch_donki.py` com `DEMO_KEY` deu HTTP 429. O limite do DEMO_KEY (10 por hora) foi gasto pelas consultas de teste de hoje. `FLR` deu 404. `GST` e `SEP` respondem.
- **Pendência para destravar:** gerar `src/data/space-weather.json` com `NASA_API_KEY` (ou depois do reset do limite) e então commitar. Sem o JSON, o build quebra; por isso nada foi commitado nesta etapa.

## 2026-11-14 · Revisão da data do cenário (validação de R-DATA e R-EVT)

- **Motivo:** a janela de 10/05/2024 tem o Sol abaixo do horizonte no polo sul o dia inteiro (elevação de −0,7° a −1,9°). Com ela, a base não teria luz nenhuma, e a tela diria "10 May 2024" sobre uma base sem Sol.
- **Verificação:** o Horizons foi consultado para cinco datas. Horas com Sol acima do horizonte plano: 12/03/2012, 0; 15/03/2015, 382; 05/09/2017, 4; 09/10/2024, 706; 15/11/2026, 709.
- **Decisão:** cenário de 09/10/2024 (tempestade G4 de 10 a 11/10/2024, a confirmar na DONKI). Mudou `fetch_sun.py` (START_UTC), `fetch_donki.py` (START_UTC), a tabela `src/data/sun-south-pole.json`, os textos da tela e `docs/data-sources.md`.
- **Comandos e resultados:**
  - `python3 data-pipeline/fetch_sun.py`: 709 amostras, de 09/10/2024.
  - `python3 -m unittest discover -s data-pipeline/tests`: 22 testes, OK. Os testes do Sol que usam a amostra fixa de 2026 foram mantidos, porque a fixture é de 2026.
  - `npx vitest run`: 63 testes, OK, com as contagens atualizadas (pico 379 h, encosta 179 h, borda 0 h).
- **Pendente:** `src/data/space-weather.json` (DONKI, bloqueado pelo limite do DEMO_KEY). Sem ele, o typecheck segue falhando.

## 2026-11-14 · Dados na tela: relevo LOLA, painel polar e clima (C2 concluído)

- **Chave NASA:** recebida do autor no meio da tarefa. Usada só como variável de ambiente no comando de `fetch_donki.py`; não está em nenhum arquivo do projeto (verificado com grep).
- **Data do cenário:** 09/10/2024 (ver a revisão anterior em `docs/execution-log.md`).
- **Arquivos:** `src/data/terrain-mesh.json` e `src/data/terrain-mesh.ts` (novos), `data-pipeline/fetch_lola.py` (função `build_mesh`, gera a malha), `src/render/scene.ts` (terreno do LOLA no lugar do relevo ilustrativo; crateras inventadas removidas), `src/ui/horizon-panel.ts` (novo, painel polar), `src/main.ts`, `index.html` (painel e rodapé com exagero de 2×), `docs/backlog.md`, `docs/arquitetura.md`, `docs/data-sources.md` (seção 4).
- **Clima:** `python3 data-pipeline/fetch_donki.py` com a chave: `src/data/space-weather.json` gerado. Kp máximo 8,67 (G4), primeira hora com Kp ≥ 5 na hora 63, 82 h de radiação.
- **Comandos e resultados:**
  - `npm run typecheck`: passou (depois de trocar `center_m` para `number[]`, por erro de tipo).
  - `npx vitest run`: 63 testes, OK.
  - `python3 -m unittest discover -s data-pipeline/tests`: 22 testes, OK.
  - `npm run build`: passou.
  - Capturas `desktop-d.png` e `mobile-d.png`: painel polar com 379 h de Sol no morro; relevo visível mas suave; painel escondido no celular.
- **Achados (não resolvidos):**
  - A partida começa na hora 0, com o Sol abaixo do horizonte (elevação de −0,01°). A cena começa escura. Falta decidir o horário inicial (ver resposta ao autor).
  - O relevo de 400 m com 30 m de variação mal aparece de longe; a câmera atual enquadra a base, não o relevo.
  - O efeito visual da tempestade (céu, luz, painéis) não existe; só o texto no HUD.
- **Commit:** feito localmente, sem push.

## 2026-11-14 · Indicações seguidas: início com Sol, tempestade visível e interface em inglês

- **Início com Sol:** o Sol no morro chega primeiro na hora 33 de 08/10/2024. O cenário passou a começar no nascer do Sol: **09/10/2024 às 09:00 UTC**. `fetch_sun.py` e `fetch_donki.py` usam essa data. Resultado: Sol no morro em 412 de 709 h, com o início já iluminado. A tempestade G4 cai na hora 30. Os testes do DONKI deixaram de depender da data fixa.
- **Tempestade na cena:** os painéis perdem brilho pela fração de geração (`solarFactor`); o farol do robô fica vermelho durante a radiação; o texto do clima fica vermelho com tempestade. Verificado com um teste temporário (início na hora 36, Kp 9, radiação), revertido em seguida.
- **Interface em inglês:** `src/i18n.ts` com dicionário em inglês e português, chaves iguais nos dois idiomas (`tests/i18n.test.ts`). Padrão: inglês; botão "Português" no HUD; escolha guardada no navegador (com falha silenciosa). O modo escola tem textos nos dois idiomas (`src/school.ts`). Motivos de recusa do motor viraram códigos (`reason.*`), traduzidos na tela.
- **Chave NASA:** usada só como variável de ambiente no comando de `fetch_donki.py`. Não está em nenhum arquivo (verificado com grep antes do commit).
- **Comandos e resultados:**
  - `npm run typecheck`: passou.
  - `npx vitest run`: 65 testes, OK (inclui os de idioma e de modo escola).
  - `python3 -m unittest discover -s data-pipeline/tests`: 22 testes, OK.
  - `npm run build`: passou.
  - Capturas: `desktop-storm.png` (tempestade), `desktop-en.png` (inglês padrão), `desktop-pt.png` (português, forçado temporariamente e revertido).
- **Achados:**
  - Há radiação já na hora 0 (SEP no início do cenário). O HUD mostra "radiation: robot paused" no início. É dado real do cenário, não bug.
  - O texto em inglês do modo escola e do painel polar foi conferido só por teste, sem captura. Vale uma captura antes do vídeo.
  - O equilíbrio com o novo início não foi revisto (B2.3). Os testes de partida passam.
- **Commit:** feito localmente, sem push.

## 2026-11-14 · Revisão do equilíbrio com o Sol real (B2.3)

- **Método:** varredura com a mesma lógica da partida (Sol de 09/10/2024 medido, horizonte do morro, clima do DONKI). Plano de referência: gelo quando a água cai, painéis e antena, estufa "só com sobra". Capacidades de 800 a 1200, morro e encosta. O teste provisório foi apagado depois.
- **Achados:**
  - Com capacidade 1200 (valor anterior), o plano vencia com 3 corações e folga grande: pouca tensão.
  - Entre 950 e 1000 a vitória muda de perder para vencer com 2 corações. Entre 1000 e 1050, de 2 para 3.
  - **Bug de teste encontrado:** os testes de partida não passavam o clima real, enquanto a tela passa. Com clima calmo, o cenário de 1000 perdia; com o clima real, vence. Corrigido em `tests/engine/partida.test.ts`.
- **Decisão:** capacidade 1000 (`src/main.ts` e `tests/engine/partida.test.ts`). Documentada em `docs/regras-recursos.md`.
- **Comandos e resultados:**
  - `npx vitest run`: 66 testes, OK (com o teste novo de 2 corações).
  - `npm run build`: passou.
- **Pendências:** a decisão de 1000 é de jogo: o autor pode trocá-la. A tela não foi capturada de novo, porque só o número da capacidade mudou.
- **Commit:** feito localmente, sem push.


## 2026-11-14 · Direção visual, fase 1 (documentação) e fase 2 (fundação)

- **Inspeção:** Blender **não** instalado neste ambiente (não é possível modelar em Blender agora). OrbitControls disponível em `three/examples/jsm`. Confirmado: `renderHud` era chamado a cada quadro e reconstruía a fila do robô no DOM.
- **Documentação criada:** `docs/VISUAL_DIRECTION.md`, `docs/ART_ASSET_PIPELINE.md`, `docs/RENDERING_ARCHITECTURE.md`, `docs/UI_UX_SPECIFICATION.md`. Descrevem o que existe e marcam o que não existe.
- **Implementado:**
  - Câmera orbital (`OrbitControls`, amortecimento, distância 10 a 70, inclinação 20° a 82°, sem pan) e botão flutuante "Visão da base" (`src/render/scene.ts`, `src/main.ts`, `index.html`).
  - HUD atualizado a cada 100 ms; fila do robô reconstruída só quando muda (`src/main.ts`, `src/ui/hud.ts`).
  - Tokens de cor (CSS) aplicados às barras: âmbar (bateria), azul-água (água), verde (comida), azul-teal (ar).
  - Variação de cor decorativa no terreno, por altura e ruído fixo; geometria medida intocada.
- **Comandos e resultados:**
  - `npm run typecheck`: passou. `npx vitest run`: 66 testes, OK. `python3 -m unittest`: 22 testes, OK. `npm run build`: passou.
  - Capturas: `desktop-f1.png`, `mobile-f1.png` (botão no painel: empurrava os pedidos para baixo no celular, corrigido) e `mobile-f2.png`, `desktop-f2.png` (botão flutuante no topo central). Sem erros de console no Chrome headless.
- **Não verificado:** arrastar, zoom e toque da câmera (headless não simula o mouse). Desempenho não medido em máquina real.
- **Não feito (fases 3 a 5):** modelos GLB (depende de Blender ou de ativos licenciados), astronautas, itens de missão, tela inicial, preparação, pausa, vitória e derrota redesenhadas, animações do rover, efeitos de tempestade além do brilho dos painéis.
- **Commit:** feito localmente, sem push.

## 2026-11-14 · Blender instalado e primeiros modelos GLB

- **Blender:** `apt` e `snap` exigem senha de administrador (indisponível). Baixado o arquivo oficial portátil, Blender 5.2.2 LTS, de `download.blender.org/release/Blender5.2/`. SHA256 conferido com `blender-5.2.2.sha256`. Extraído em `~/tools/blender-5.2.2-linux-x64`. Teste: `bpy.app.version_string` = 5.2.2 LTS. O arquivo compactado foi apagado.
- **Modelos:** `assets-src/blender/build_assets.py` gera `public/models/{habitat,rover,solar_panel,greenhouse,antenna}.glb` (cerca de 420 KB no total).
- **Erro encontrado e corrigido:** escala no Blender é tamanho total, não meia dimensão. Cinco objetos estavam pela metade ou com comprimento errado (habitat com 3 m em vez de 6 m; painel com 0,8 m em vez de 1,6 m). Conferido com `dimensions` antes da exportação.
- **Código:** `src/render/assets.ts` (carrega cada GLB uma vez e anexa uma cópia ao grupo), `src/render/scene.ts` (`loadBaseModels`, peças do rover, rodas giram só com o robô trabalhando), `src/main.ts` (chamada em segundo plano; as formas provisórias ficam até o carregamento).
- **Comandos e resultados:**
  - `npm run typecheck`: passou. `npx vitest run`: 66 testes, OK. `npm run build`: passou.
  - Captura `desktop-h.png`: habitat, estufa, painéis, antena (oculta até instalar) e rover carregados. Sem erros de carregamento no console.
- **Não verificado:** animação das rodas em movimento (captura parada); desempenho dos modelos em máquina real; GLB do rover (219 KB) poderia ser reduzido.
- **Commit:** feito localmente, sem push.


## 2026-11-14 · Tela inicial, movimento do rover ligado à fila, mapa de interações

- **Rover (bug confirmado):** o rover girava em um círculo fixo em torno da base em qualquer tarefa, passando por cima da base. Corrigido: sai da base até o local da tarefa (0 a 35% do tempo da tarefa), trabalha no local (35 a 65%), volta (65 a 100%). Locais: gelo (−18, −16), painel (5, 12), antena (1,2, −3), base (8, −5). Rodas giram só ao deslocar.
- **Marcador do gelo:** poliedro azul no local do gelo, visível enquanto há tarefa de gelo na fila.
- **Tela inicial:** título, tagline da identidade, "Nova missão" (inicia a simulação), idioma e créditos com fontes e aviso de não afiliação à NASA. A cena aparece de fundo.
- **Mapa de interações:** `docs/INTERACTION_MAP.md`, com cada componente, a ação do jogador, a mudança no motor, a reação na cena e as lacunas.
- **Comandos e resultados:**
  - `npm run typecheck`: passou. `npx vitest run`: 66 testes, OK. `npm run build`: passou.
  - Capturas: `title-i.png` (tela inicial), `rover-trip3.png` (rover a caminho do gelo, com ajuste temporário de teste revertido em seguida).
- **Não verificado:** marcador do gelo na tela; câmera com mouse; animação das rodas em movimento.
- **Bugs conhecidos:** cancelar tarefa em andamento faz o rover voltar de forma instantânea; a antena ainda não tem efeito no jogo.
- **Commit:** feito localmente, sem push.

## 2026-11-14 · Pausa, cancelamento corrigido e tripulação

- **Pausa:** botão "Pausar" (topo) e tecla Esc. Sobreposição com continuar, controles e menu principal (volta à tela inicial e reinicia a partida). A simulação para; a cena continua.
- **Cancelar tarefa:** corrigido. Sem tarefa em andamento, o rover volta à base caminhando a 4 m/s, em vez de ir de imediato.
- **Astronautas:** `assets-src/blender/build_assets.py` gera `public/models/astronaut.glb` (corpo, capacete com viseira, mochila, braços e pernas com origem na articulação; 250 KB). Dois astronautas na cena. O da estufa cuida dela quando `isGreenhouseOn` (regra exposta pelo motor, sem duplicar a regra na cena). O outro vai ao local da tarefa quando o rover trabalha.
- **Engine:** `isGreenhouseOn(vitals, inst)` extraída de `deriveFlow`, com dois testes novos. Comportamento inalterado.
- **Comandos e resultados:**
  - `npx tsc --noEmit`: passou. `npx vitest run`: 68 testes, OK. `npm run build`: passou.
  - Captura com ajuste temporário (fila de gelo, tela inicial escondida, desfeito em seguida): `crew-l.png` mostra astronautas, rover no local, botões no topo.
- **Não verificado:** marcador do gelo (aparece sobreposto ao rover); caminhada dos astronautas em movimento; pausa na tela (não capturada).
- **Commit:** feito localmente, sem push.


## 2026-11-14 · Captura da pausa e dos astronautas andando

- **Pausa:** `pause-m.png` (ajuste temporário: começa já pausado, desfeito). Sobreposição "Paused" com continuar, controles e menu principal; cena escurecida ao fundo. Verificado.
- **Astronautas:** o astronauta da estufa aparece na captura, mas o caminho dele estava **dentro da cúpula** (ponto a 2,4 m do centro, raio da cúpula 2,4 m). Corrigido: casa em (−3,0; 5,2) e caminho entre (−3,0; 5,2) e (−4,0; 6,6), a mais de 3 m do centro.
- **Erro de ferramenta, corrigido:** o primeiro ajuste temporário quebrou a sintaxe de `main.ts` (parêntese perdido na substituição); a captura saiu com o erro do Vite. O arquivo foi restaurado e conferido com `diff` antes de seguir.
- **Não verificado:** o balanço dos braços e das pernas em movimento. Duas capturas com 1,1 s de diferença mostram o astronauta quase na mesma pose; a animação está no código (`animateCrew`), mas não foi confirmada na imagem.
- **Comandos:** `npx tsc --noEmit` passou; `npx vitest run`: 68 testes, OK; `npm run build` passou.
- **Commit:** feito localmente, sem push.

## 2026-11-14 · Sequência de quadros dos astronautas e plano para outra IA

- **Sequência:** `seq-sheet.png`, 4 quadros (1 a 1,5 s de intervalo), câmera aproximada e ajuste temporário desfeito (confirmado com `diff`). No primeiro quadro, braços e pernas do astronauta estão balançando: a animação funciona. Nos outros três, ele está parado. A articulação dos braços parece solta do corpo nesse quadro: problema visual registrado para correção (T1 no plano).
- **Plano para outra IA:** `docs/PLANO_PARA_AGENTE.md`, com regras, comandos, mapa do código, o que já está feito, tarefas em ordem com critério de aceite e os pontos que só o autor decide.
- **Commit:** feito localmente, sem push.

## 2026-11-14 · Decisões de escopo delegadas pelo autor

- Autor: "pode decidir". Registro em `docs/DECISOES.md`: D-01 antena dá aviso antecipado de tempestade (6 h), sem mudar recursos; D-02 astronautas sem tarefas de jogo; D-03 "Seguir robô" como botão opcional; D-04 números de jogo, idioma e push inalterados.
- `docs/PLANO_PARA_AGENTE.md` atualizado (seção 7 e tarefas T2, T4, T8).
- Nenhum código de jogo foi alterado nesta etapa: só decisões e documentação.
- **Commit:** feito localmente, sem push.

## 2026-11-14 · T1: articulação dos braços e pernas do astronauta

- **Problema:** no quadro de caminhada, braços e pernas pareciam soltos do corpo e giravam em torno de um ponto errado.
- **Causa:** em `limb`, `bpy.ops.object.transform_apply(scale=True)` usa `location=True` e `rotation=True` por padrão no Blender. A localização da articulação era aplicada à malha (coordenadas absolutas) e, em seguida, `o.location = joint` aplicava a mesma translação de novo. No GLB, o nó do braço ficava com `translation` no ombro e a malha já deslocada, resultando em membros flutuando acima do corpo. Braço esquerdo antigo: y de 2,17 a 2,72 m (capacete termina em 1,77 m).
- **Correção:** aplicar só a escala, mantendo a origem no ponto de articulação: `bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)`. A geometria continua descendo `length` a partir do pivô. Nenhuma mudança em `scene.ts` foi necessária: `animateCrew` já girava os nós `arm_L`, `arm_R`, `leg_L` e `leg_R` corretamente.
- **Arquivos:** `assets-src/blender/build_assets.py`; `public/models/astronaut.glb` regerado. Os demais GLB (habitat, rover, painel, estufa, antena) foram gerados de novo pelo script, comparados com `git show HEAD` (JSON idêntico; só ruído binário) e restaurados para não poluir o diff. `src/main.ts` e `src/render/scene.ts` foram alterados só para as capturas e restaurados dos backups; `diff` confirmou que voltaram ao estado do HEAD.
- **Verificação do GLB (Node + three.js):**
  - Braço: pivô em y = 1,36 m; malha local y = −0,55 a 0. Com rotação de 0,55 rad, o topo continua em y ≈ 1,39 (ombro) e a extremidade desce para z ≈ −0,34. Antes: malha em y 2,17 a 2,72 e pivô em 1,36 (topo longe do pivô).
  - Perna: pivô em y = 0,80 m; malha local y = −0,80 a 0. O topo fica no quadril e o pé no chão; antes a malha ia de 0,80 a 1,60.
- **Verificação em jogo (instrumentação temporária, restaurada):** com o jogo rodando, no instante t = 8,08 s, nó do astronauta em y = 0,777. Pivô do braço em y = 2,137 (= 0,777 + 1,36) e topo da caixa em 2,16; pivô da perna em y = 1,577 (= 0,777 + 0,80) e base da caixa em 0,775 (chão). Braços e pernas giram presos aos ombros e quadris.
- **Captura sequencial:** `seq-sheet.png` com 4 quadros (t = 3, 4, 5 e 6 s), câmera perto do astronauta e balanço forçado só para a captura (restaurado em seguida). A diferença entre quadros se concentra nos membros, abaixo da cabeça. O agente desta sessão não tem entrada de imagem e **não revisou visualmente** o `seq-sheet.png`; a confirmação foi numérica (GLB e posições em jogo). O arquivo está em `.scratch-agent/seq-sheet.png` (fora do commit).
- **Comandos e resultados:**
  - `npm run typecheck`: passou.
  - `npx vitest run`: 10 arquivos, 68 testes, todos passando.
  - `npm run build`: passou (aviso já conhecido de chunk acima de 500 kB).
  - Blender: `~/tools/blender-5.2.2-linux-x64/blender --background --factory-startup --python assets-src/blender/build_assets.py -- public/models` (6 GLB exportados).
- **Não verificado:** revisão visual humana do `seq-sheet.png`; caminhada em navegador real com mouse/câmera; captura em celular (mudança só de ativo 3D, sem layout).
- **Commit:** feito localmente, sem push.

## 2026-11-14 · Verificação da T1 (opencode) e declaração de ferramenta

- **T1 verificada:** commit `d1d0595` (correção da articulação do astronauta). Typecheck passou; `npx vitest run`: 68 testes, OK; `npm run build` passou. Árvore de trabalho limpa.
- **Declaração:** `opencode` foi usado como agente de código e não estava em `AI_DISCLOSURE.md`. Pela regra do projeto, ferramenta nova só entra após declaração. Acrescentado à tabela com modelo e provedor **pendentes** de confirmação do autor.
- **Ressalva registrada pelo opencode:** a revisão visual do `seq-sheet.png` não foi feita por ele; a confirmação foi numérica (nós e pivôs). Vale uma captura revisada por um humano ou por este agente antes da demo.
- **Commit:** feito localmente, sem push.
