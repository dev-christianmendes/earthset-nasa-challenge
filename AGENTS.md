# Earthset · Base no polo sul da Lua (projeto do evento)

Este é o ponto de entrada para **qualquer agente de IA** neste repositório (Claude Code via `CLAUDE.md`, GitHub Copilot via `.github/copilot-instructions.md`, ou outro). Leia-o inteiro no início de cada sessão. Tudo que um agente novo precisa para trabalhar aqui está neste arquivo ou nos documentos que ele aponta.

---

## 1. Contexto do projeto

- **O quê:** jogo 3D no navegador para o **NASA Space Apps Challenge 2026**, desafio *Junior Astronaut Mission Trainer*. O jogador administra uma base no polo sul da Lua durante um **dia lunar de 708 horas de jogo**. Vence chegando ao fim com pelo menos 1 coração. Perde quando os 3 corações acabam.
- **Para quem:** banca de julgamento (critérios Impact, Creativity, Validity, Relevance, Presentation; ver `docs/event-rules.md`, seção 4) e estudantes, com modo leve previsto para escola.
- **Prazo:** envio até **15/11/2026, 23h59** no horário local. Meta interna: 12h de 15/11.
- **Origem:** projeto escrito do zero a partir de 14/11/2026.
- **Ferramentas de IA declaradas:** Claude Code e GitHub Copilot (`AI_DISCLOSURE.md`). Outra ferramenta só entra depois de declarada lá.
- **Autor:** Christian Mendes (`dev-christianmendes`). Equipe solo até a confirmação do item A3 em `docs/event-rules.md`.

---

## 2. Regras que valem sempre

1. **Motor separado.** `src/engine/` é TypeScript puro: não importa three.js, DOM nem `window`. Regra de jogo fica no motor e é testada com Vitest. O CI verifica isso (job `boundary`).
2. **Demo sempre jogável.** Trabalhe na ordem de `docs/backlog.md`. Ao fim de cada item, `npm run build` passa e o jogo abre.
3. **Dado com fonte.** Número científico tem origem em `docs/data-sources.md`. O que for ilustrativo fica marcado no código e na tela.
4. **Verificação antes de "pronto".** Pronto = `npm run typecheck`, `npm run test`, `npm run build` passando, e a tela vista se o item mexeu em tela (screenshot desktop e celular).
5. **Cabeçalho de IA** em todo `.ts` criado ou alterado com IA. Primeira linha:
   `// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.`
6. **Textos em português do Brasil** na interface e na documentação. A página de envio e os materiais linkados ficam em **inglês** (`docs/event-rules.md`).
7. **Nada sai da máquina.** Sem `git push`, sem publicação, sem commit sem pedido explícito do autor. Criar arquivos (inclusive workflows de CI) é permitido; enviar, não.
8. **Sem marca da NASA** (logotipo, insígnia, bandeira ou patch) em assets ou na tela.
9. **Registro.** Cada etapa técnica entra em `docs/execution-log.md`, com comandos e resultados, inclusive falhas.
10. **Crianças.** Nenhuma foto, vídeo, voz ou imagem de menor de 18 anos entra na demo ou no envio (`docs/event-rules.md`, seção 5).

---

## 3. Como rodar e verificar

Pré-requisito: **Node 24** (o CI usa 24; local hoje 24.22.3). Gerenciador: npm com `package-lock.json`.

| Comando | Para quê |
|---|---|
| `npm install` | Instala dependências (usar `npm ci` no CI) |
| `npm run dev` | Servidor de desenvolvimento (Vite). Porta padrão 5173; se ocupada, use `npx vite --port 5180 --strictPort` |
| `npm run typecheck` | `tsc --noEmit` (strict, `noUnusedLocals`, `noUnusedParameters`) |
| `npm run test` | Vitest, testes do motor e partidas completas |
| `npm run build` | Typecheck + build estático em `dist/` |
| `npm audit --omit=dev` | Auditoria das dependências de produção (deve dar 0) |

**Verificação visual (obrigatória se mexeu em tela):** o Chrome do sistema roda headless:

```bash
google-chrome --headless=new --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader \
  --window-size=1280,800 --virtual-time-budget=5000 --screenshot=<pasta-de-rascunho>/desktop.png http://localhost:5180/
```

Use a pasta de rascunho da sessão, nunca `/tmp` sem pedido. Confira que a porta é do **Earthset** (o título da página é "Earthset · Base no polo sul da Lua"). Já houve caso de outro servidor, de outro projeto, na porta 5173.

---

## 4. Mapa do código

```
index.html                  Página: HUD (painel lateral), overlay de fim, CSS em português
src/main.ts                 Cena three.js + laço do jogo + ligação HUD ↔ motor (DOM permitido)
src/engine/clock.ts         Relógio: MATCH_HOURS = 708, advanceClock, createClock
src/engine/resources.ts     Recursos por hora: energia, ar, água, comida; equipamentos automáticos
src/engine/robot.ts         Robô: fila (máx. 4), tarefas gelo/painel/antena, progresso
src/engine/game.ts          Partida: estado, dispatch (ações do jogador), advance (tempo), outcomeOf
tests/engine/*.test.ts      Testes do motor (Vitest). partida.test.ts roda partidas completas
docs/backlog.md             Plano em blocos e estado de cada item (ler antes de escolher trabalho)
docs/regras-recursos.md     Regras e números de recursos, equipamentos, corações e robô
docs/event-rules.md         Regras do evento (datas, elegibilidade, IA, critérios, pontos em aberto)
docs/execution-log.md       Diário de cada etapa: arquivos, comandos, resultados, falhas
docs/data-sources.md        Fontes de cada número científico, método e o que é ilustrativo
data-pipeline/fetch_sun.py  Pipeline do Sol (JPL Horizons) → src/data/sun-south-pole.json; testes em data-pipeline/tests
src/engine/sun.ts           Sol: tabela, amostra por hora, horizonte local por site
AI_DISCLOSURE.md            Declaração de uso de IA (ferramentas, modelos, texto em inglês)
.github/workflows/ci.yml    CI: typecheck, testes, build, auditoria, fronteira do motor
.github/dependabot.yml      Atualizações semanais (npm e ações)
CLAUDE.md                   Importa este arquivo para o Claude Code
```

### 4.1 Modelo do motor (estado e fluxo)

- **`GameState`** (`game.ts`): `clock`, `installation` (rank, site, panels, batteryCapacity, greenhouse), `vitals` (battery em unidades de 0 a capacidade; air, water, food de 0 a 100), `robot` (fila e `antennaInstalled`), `hearts` (0 a 3) e `vitalZeroHours`.
- **Ações** (`dispatch`): objetos com `type`. Hoje: `SET_GREENHOUSE`, `ENQUEUE_TASK` (kind: `ice` | `panel` | `antenna`), `CANCEL_TASK` (index). Toda ação é validada e devolve `{ ok, state }` ou `{ ok: false, reason }`. **Nunca altera o estado de entrada.** A `reason` é texto em português, mostrado ao jogador.
- **Tempo** (`advance(state, dtHours, sunlit)`): aplica o fluxo por hora em um passo, avança o robô, aplica o efeito das tarefas concluídas (gelo +12 de água, painel +1 em `installation.panels`) e atualiza corações. Para em 708 h. Lança `RangeError` com hora negativa ou não finita.
- **Sol:** entra de fora, pelo parâmetro `sunlit`. Hoje é ilustrativo (dia de 354 h, noite de 354 h). A fonte real é o bloco B2.
- **Robô:** só trabalha com tarefa na fila **e** bateria acima de zero. Consome `ROBOT_LOAD_PER_HOUR` (1.0) enquanto trabalha.

### 4.2 Constantes e onde mudar

| Constante | Arquivo | Valor atual | Observação |
|---|---|---|---|
| `MATCH_HOURS` | `clock.ts` | 708 | Duração do dia lunar |
| `HOURS_PER_HEART_LOSS` / `MAX_HEARTS` | `game.ts` | 6 / 3 | Corações |
| `PANEL_OUTPUT_PER_HOUR` | `resources.ts` | 0,9 | Por painel, com Sol |
| `BASE_LOAD_PER_HOUR` | `resources.ts` | 0,8 | Consumo fixo |
| `HEATING_PER_HOUR` | `resources.ts` | por local | Sol e sombra |
| `RANK_FACTOR` | `resources.ts` | 0,75 / 1 / 1,15 | Patentes |
| `RULES` | `resources.ts` | limites de equipamentos | Estufa, eletrólise, economia |
| `MAX_QUEUE` / `MAX_PANELS` | `robot.ts` | 4 / 12 | Limites da fila e de painéis |
| `TASK_HOURS` | `robot.ts` | gelo 6, painel 4, antena 8 | Duração das tarefas |
| `ICE_WATER_PER_TRIP` | `robot.ts` | 12 | Água por viagem |
| `INSTALLATION` (partida inicial) | `src/main.ts` | 2 painéis, capacidade 1200 | **Equilíbrio de jogo**, não dado científico |

**Equilíbrio:** a capacidade de 1200 e o máximo de 12 painéis foram escolhidos por simulação. Com capacidade de 150 a noite zera a base. Com 1000, a partida termina com 1 coração. Com 1200 e 12 painéis, vence com 3 corações (ver `tests/engine/partida.test.ts`). Qualquer mudança em número de fluxo precisa rodar `npm run test`; o teste de partida é o termômetro do equilíbrio.

---

## 5. Como acrescentar uma regra ou uma ação (checklist)

1. Leia o item correspondente em `docs/backlog.md` e a regra em `docs/regras-recursos.md`.
2. Escreva a regra no **motor** (`src/engine/`), sem three.js nem DOM. Se for dado científico, anote a fonte em `docs/data-sources.md`; senão, marque como ilustrativo.
3. Ação do jogador: adicione o tipo em `GameAction`, valide em `dispatch` (com motivo em português) e teste em `tests/engine/`.
4. Testes: unitários do módulo novo e pelo menos um caso de **partida completa** em `partida.test.ts` se a regra afeta o equilíbrio.
5. Tela: ligue em `src/main.ts` (controle, texto do HUD) e em `index.html` (rótulo, `title` do botão). Textos em português.
6. Rode `npm run typecheck`, `npm run test`, `npm run build`. Tire screenshot desktop e celular.
7. Atualize `docs/backlog.md` (marcar o item), `docs/regras-recursos.md` (se mudou regra) e `docs/execution-log.md` (comandos e resultados).
8. Cabeçalho de IA nos `.ts` criados ou alterados.

---

## 6. Verificação e CI/CD

- **Local:** a seção 3. Pronto = typecheck, testes e build passando, com tela vista quando couber.
- **CI (`.github/workflows/ci.yml`)**, em push para `main` e em pull request:
  - job `verify`: `npm ci`, typecheck, testes, build, `npm audit --omit=dev --audit-level=high`, e envio do `dist` como artefato (14 dias).
  - job `boundary`: falha se `src/engine` importar three.js, usar `document.`, `window.` ou `HTMLElement`.
- **Dependabot** abre PRs semanais para npm e ações do GitHub. Revisar antes de aceitar.
- **Estado atual:** o CI rodou no GitHub a partir do envio de 14/11/2026 (`main`, 4 execuções seguidas com sucesso, até `17abde8`). Mudanças futuras: enviar só quando o autor pedir (regra 7).
- **Vulnerabilidades conhecidas (aceitas):** `npm audit` aponta 3 problemas em `vitest` 3.2.7 e `tinypool` (dev-only, não entram no build). A correção indicada é trocar para vitest 5, que é uma mudança maior. Não há correção em 3.x até a data desta versão. Revisar depois do evento. A dependência de produção (three.js) tem 0 vulnerabilidades.
- **Ambiente:** `context-mode` exige Node 24.15 ou mais novo. Resolvido: Node 24.22.3 é o padrão local e `ctx_doctor` passa em todos os checks (ver `docs/execution-log.md`, entrada de 14/11, Node).

---

## 7. Dados (bloco B2)

- **Recorte escolhido:** Sol real (JPL Horizons), já no jogo. DONKI e LOLA adiados, com motivos em `docs/data-sources.md`, seção 4.
- **Horizonte local por site** (`SITE_HORIZON_DEG`) é ilustrativo até o relevo LOLA ser medido.
- **Pipeline:** Python, reprodutível, com testes; saída em arquivo gerado que o motor lê. Dado bruto grande **nunca** no git (`.gitignore` já cobre `*.tif`, `*.img`).
- Até B2: Sol, relevo e robô são **ilustrativos** e a tela diz isso (rodapé do HUD).

---

## 8. Convenções

- **Commits** (quando o autor pedir): Conventional Commits em português, por exemplo `feat(motor): robô com fila de tarefas`, `fix(cena): ...`, `chore(ci): ...`, `test(motor): ...`. Atribuição do Claude Code no fim da mensagem, quando o autor pedir o commit.
- **Pull requests:** descrição com o que mudou, como foi verificado (comandos e screenshot) e referência ao item do backlog.
- **Nomes:** código e identificadores em inglês ou português técnico já usado no projeto (`advance`, `dispatch`, `installation`, `vitals`). Strings da interface e comentários de regra em português.
- **Motor:** funções puras, sem efeitos, sem exceções para entrada normal. Entradas inválidas viram `{ ok: false, reason }` em ações ou `RangeError` em funções de tempo.
- **Testes:** `describe` por unidade, nomes em português descrevendo o comportamento.

---

## 9. Ferramentas de economia de token (para agentes)

- **rtk** (`~/.claude/RTK.md`, hook `PreToolUse` em Bash): reescreve comandos para saída condensada. Pode interferir na classificação de segurança do modo automático. Se um comando voltar vazio ou inconsistente, rode de novo com `rtk bypass <cmd>` só nesse caso.
- **context-mode**: para saídas grandes (logs, testes, arquivos longos), use `ctx_execute` ou `ctx_search` em vez de colar a saída inteira. Diagnóstico: `ctx_doctor`.
- **Serena** (`.serena/`): navegação por símbolos em código TypeScript. Vale para arquivos grandes; o projeto ainda é pequeno, então Read e Grep bastam em tarefas curtas.
- Nenhuma dessas ferramentas substitui a verificação da seção 3.

---

## 10. Estado atual (atualizar a cada etapa)

Data: 14/11/2026.

- **Bloco 0 (fundação):** feito, exceto B0.6 (envio ao GitHub, autor).
- **Bloco 1 (regras da base):** B1.1 e B1.3 feitos. B1.2 parcial: estufa feita; tarefas do robô entraram com o robô. **B1.4 (robô e gelo) feito** nesta etapa, com 41 testes passando. **B1.5 (frio e aquecimento sem energia) feito**, pela regra de bateria zerada; temperatura separada fica fora desta versão.
- **Bloco 2 (dados):** aberto. Depende de decisão do autor (B2.1).
- **Bloco 3 (tela):** HUD ligado ao motor; painel de robô, estufa, fim de partida e cena com luz de sol. Visual refinado em B3.3 (textura, modelos da base, paleta única, estrelas). Modo escola (B3.4) feito: rótulos curtos e explicações por recurso. Próximo: B4 (envio). Ver backlog.
- **Bloco 4 (envio):** aberto. O projeto de envio é novo, iniciado do zero em 14/11/2026. Não há bloqueio de elegibilidade pendente.

**Riscos abertos:** A2 (enunciado oficial não lido), A3 (composição da equipe), A5 (Termos e Guia de Envio não lidos).
