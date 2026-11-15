# Earthset · Instruções permanentes para agentes de IA

Ponto de entrada para **qualquer agente** neste repositório (Claude Code via `CLAUDE.md`, Codex ou outro). Este arquivo tem só regras permanentes. O estado atual do projeto está em `docs/PROJECT_STATUS.md`; as pendências, em `docs/backlog.md`.

---

## 0. Hierarquia dos documentos

Em caso de conflito, vale a ordem abaixo. O código é a verdade sobre o comportamento do jogo.

| Documento | Papel |
|---|---|
| `AGENTS.md` | Regras permanentes de desenvolvimento (este arquivo) |
| `CLAUDE.md` | Instruções específicas do Claude Code (importa este arquivo) |
| `docs/PLANO_V4.md` | Direção e escopo vigentes (Earthset 4.0, D-16) |
| `docs/PROJECT_STATUS.md` | Estado atual, verificado contra o código |
| `docs/backlog.md` | Pendências reais e critérios de aceite |
| `docs/arquitetura.md` | Arquitetura implementada e requisitos |
| `docs/regras-recursos.md` | Regras e números de recursos, equipamentos, corações e robô |
| `docs/data-sources.md` | Fontes e proveniência científica |
| `docs/DECISOES.md` | Histórico de decisões (D-01 em diante) |
| `docs/execution-log.md` | Histórico cronológico de execução |
| `docs/archive/` | Documentos substituídos. Não são instrução atual |

Os demais documentos de `docs/` são especializados (eventos, interações, visual, desempenho, auditoria) e estão listados em `docs/PROJECT_STATUS.md`.

---

## 1. Projeto

- **O quê:** jogo 3D no navegador para o NASA Space Apps Challenge 2026 (*Junior Astronaut Mission Trainer*). O jogador administra uma base no polo sul da Lua durante um dia lunar de 708 horas de jogo. Vence chegando à hora 708 com pelo menos 1 coração. Perde quando os 3 corações acabam.
- **Para quem:** banca de julgamento (critérios em `docs/event-rules.md`, seção 4) e estudantes (modo escola).
- **Autor:** Christian Mendes (`dev-christianmendes`).
- **Ferramentas de IA declaradas:** Claude Code e Codex, em `AI_DISCLOSURE.md`. Outra ferramenta só é usada depois de declarada lá.

---

## 2. Regras que valem sempre

1. **Motor separado.** `src/engine/` é TypeScript puro: não importa three.js, DOM nem `window`. Regra de jogo fica no motor e é testada com Vitest. O CI verifica isso (job `boundary`).
2. **Demo sempre jogável.** Ao fim de cada item, typecheck, testes e build passam, e o jogo abre.
3. **Dado com fonte.** Número científico tem origem em `docs/data-sources.md`. O que for ilustrativo ou regra de jogo fica marcado no código e na tela.
4. **Verificação antes de "pronto".** Pronto = `npm run typecheck`, `npm run test` e `npm run build` passando. Se o item mexeu em tela, a tela foi vista em desktop e celular.
5. **Cabeçalho de IA** em todo `.ts` criado ou alterado com IA. Primeira linha:
   `// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.`
6. **Idioma.** A interface abre em **inglês** e tem botão para **português do Brasil**. A documentação do repositório fica em português. A página de envio e os materiais linkados ficam em **inglês** (`docs/event-rules.md`; `docs/arquitetura.md`, R-LANG).
7. **Nada sai da máquina sem pedido.** Sem `git push`, publicação, deploy ou commit sem pedido explícito do autor. Criar arquivos é permitido; enviar, não.
8. **Sem marca da NASA** (logotipo, insígnia, bandeira ou patch) em assets ou na tela. Ativos de terceiros só entram com licença verificada na fonte e registrada (`docs/ART_ASSET_PIPELINE.md`).
9. **Registro.** Cada etapa técnica entra em `docs/execution-log.md`, com comandos e resultados, inclusive falhas.
10. **Crianças.** Nenhuma foto, vídeo, voz ou imagem de menor de 18 anos entra na demo ou no envio (`docs/event-rules.md`, seção 5).
11. **Sem IA generativa como ativo nem em tempo de jogo.** A LUMA usa regras fixas (D-12). Imagem ou modelo gerado por IA não é usado como ativo final.
12. **Fatos ficcionais nunca são apresentados como medição da NASA.**

---

## 3. Como rodar e verificar

Pré-requisito: **Node 24** (o CI usa 24). Gerenciador: npm com `package-lock.json`.

| Comando | Para quê |
|---|---|
| `npm install` | Instala dependências (`npm ci` no CI) |
| `npm run dev` | Servidor de desenvolvimento (Vite), porta padrão 5173 |
| `npm run typecheck` | `tsc --noEmit` (strict, `noUnusedLocals`, `noUnusedParameters`) |
| `npm run test` | Vitest: testes do motor e partidas completas |
| `npm run build` | Typecheck + build estático em `dist/` |
| `npm audit --omit=dev` | Auditoria das dependências de produção |
| `PYTHONDONTWRITEBYTECODE=1 python3 -B -m unittest discover -s data-pipeline/tests` | Testes dos pipelines Python |

**Verificação visual** (obrigatória se o item mexeu em tela). Em um servidor de desenvolvimento, use uma porta livre, por exemplo `npx vite --port 5180 --strictPort`, e capture com o Chrome do sistema:

```bash
google-chrome --headless=new --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader \
  --window-size=1280,800 --virtual-time-budget=5000 --screenshot=<pasta-de-rascunho>/desktop.png http://localhost:5180/
```

Confira que a porta é do Earthset: o título da página começa com "Earthset ·". Outro projeto pode estar servindo na porta 5173. Use a pasta de rascunho da sessão, não `/tmp`, salvo pedido.

---

## 4. Mapa do código (camadas)

| Camada | Pasta | Regra |
|---|---|---|
| Motor | `src/engine/` | Funções puras. Sem three.js, DOM ou `window`. Dona de recursos, tempo, Sol, horizonte, clima, robô, astronautas e partida |
| Cena | `src/render/` | Three.js. Só **lê** o estado; não recalcula regra |
| Interface | `src/ui/` | DOM. Lê o estado e envia **ações** validadas pelo motor |
| Dados | `src/data/` | Tabelas JSON geradas por `data-pipeline/`. Não editar à mão |
| Entrada | `src/main.ts`, `src/i18n.ts`, `src/school.ts` | Laço do jogo e ligação entre as camadas |
| Testes | `tests/engine/*.test.ts` | Vitest. `partida.test.ts` roda partidas completas |
| Pipelines | `data-pipeline/*.py` | Python, offline, com testes em `data-pipeline/tests/` |
| Assets | `assets-src/` (fontes e scripts Blender), `public/` (arquivos servidos) | Ver `docs/ART_ASSET_PIPELINE.md` |

Inventário completo dos módulos, com o papel de cada um: `docs/PROJECT_STATUS.md`.

Atalhos de captura (só `npm run dev`): `?autostart=cadet&hour=24&task=ice&after=2&tool=rover&shot=rover`, `?autostart=cadet&cineAt=7`, `?screen=modes&lang=pt`.

### 4.1 Modelo do motor

- **`GameState`** (`src/engine/game.ts`): `clock`, `installation` (rank, site, panels, batteryCapacity, greenhouse), `vitals` (bateria de 0 até a capacidade; ar, água e comida de 0 a 100), `robot` (fila e `antennaInstalled`), `hearts` (0 a 3), `vitalZeroHours`, `crop` e `agents` (astronautas).
- **Ações** (`dispatch(state, action)`): objetos com `type` (`GameAction`). Hoje: `SET_GREENHOUSE`, `SET_CREW_ORDER`, `ENQUEUE_TASK`, `CANCEL_TASK`, `ASSIGN_AGENT_TASK`, `CANCEL_AGENT_TASK`, `SET_GREENHOUSE_CARE`. Toda ação é validada e devolve `{ ok: true, state }` ou `{ ok: false, reason }`. Nunca altera o estado de entrada. A `reason` é texto em português, mostrado ao jogador.
- **Tempo** (`advance(state, dtHours, sunlit, weather)`): aplica o fluxo por hora, avança o robô e os astronautas, aplica o efeito das tarefas concluídas e atualiza corações. Para em 708 h. Lança `RangeError` com hora negativa ou não finita. `sunlit` e `weather` são funções de hora, lidas das tabelas de dados.
- **Robô:** só trabalha com tarefa na fila **e** bateria acima de zero.

### 4.2 Constantes e onde mudar

Valores verificados no código em 15/11/2026.

| Constante | Arquivo | Valor | Observação |
|---|---|---|---|
| `MATCH_HOURS` | `src/engine/clock.ts` | 708 | Duração do dia lunar |
| `HOURS_PER_HEART_LOSS` / `MAX_HEARTS` | `src/engine/game.ts` | 6 / 3 | Corações |
| `PANEL_OUTPUT_PER_HOUR` | `src/engine/resources.ts` | 0,9 | Por painel, com Sol |
| `BASE_LOAD_PER_HOUR` | `src/engine/resources.ts` | 0,8 | Consumo fixo |
| `HEATING_PER_HOUR` | `src/engine/resources.ts` | por site | Com Sol e na sombra |
| `RANK_FACTOR` | `src/engine/resources.ts` | 0,75 / 1 / 1,15 | Patentes do motor (`cadete`, `explorador`, `comandante`) |
| `RULES` | `src/engine/resources.ts` | limites | Estufa, eletrólise, economia |
| `MAX_QUEUE` / `MAX_PANELS` / `ROBOT_LOAD_PER_HOUR` | `src/engine/robot.ts` | 4 / 12 / 1,0 | Fila, painéis e consumo do robô |
| `TASK_HOURS` | `src/engine/robot.ts` | gelo 6, painel 4, antena 8 | Duração das tarefas |
| `ICE_WATER_PER_TRIP` | `src/engine/robot.ts` | 12 | Água por viagem de gelo |
| `INSTALLATION` (partida inicial) | `src/main.ts` | site `peak`, 2 painéis, capacidade 1000, estufa `surplus` | **Equilíbrio de jogo**, não dado científico |

**Equilíbrio.** A referência é a partida do plano de referência em `tests/engine/partida.test.ts`, com Sol e horizonte medidos (observador LOLA): vence com 3 corações; a base passiva, sem robô, perde. O cenário regional histórico rendia 2 corações e é mantido só como comparação. Qualquer mudança em número de fluxo precisa de `npm run test`; o teste de partida mede o equilíbrio. Justificativa de cada número: `docs/regras-recursos.md`.

---

## 5. Como acrescentar uma regra ou uma ação

1. Leia o item em `docs/backlog.md` e a regra em `docs/regras-recursos.md`.
2. Escreva a regra no **motor** (`src/engine/`), sem three.js nem DOM. Se for dado científico, registre a fonte em `docs/data-sources.md`; senão, marque como ilustrativo.
3. Ação do jogador: adicione o tipo em `GameAction`, valide em `dispatch` com motivo em português e teste em `tests/engine/`.
4. Testes: unitários do módulo novo e, se a regra afeta o equilíbrio, um caso de partida completa em `partida.test.ts`.
5. Tela: ligue em `src/main.ts` e `index.html`. Textos em português e inglês (`src/i18n.ts`).
6. Rode typecheck, testes e build. Tire screenshot desktop e celular se mexeu em tela.
7. Atualize `docs/backlog.md` (marcar ou remover o item), `docs/regras-recursos.md` (se a regra mudou), `docs/PROJECT_STATUS.md` (se o estado mudou) e `docs/execution-log.md` (comandos e resultados).
8. Cabeçalho de IA nos `.ts` criados ou alterados.

---

## 6. Convenções

- **Commits** (só com pedido): Conventional Commits em português, por exemplo `feat(motor): robô com fila de tarefas`, `fix(cena): ...`, `test(motor): ...`.
- **Pull requests:** descrição do que mudou, como foi verificado (comandos e screenshot) e referência ao item do backlog.
- **Nomes:** identificadores em inglês ou português técnico já usado (`advance`, `dispatch`, `installation`, `vitals`). Textos da interface e comentários de regra em português.
- **Motor:** funções puras, sem efeitos colaterais. Entradas inválidas viram `{ ok: false, reason }` em ações ou `RangeError` em funções de tempo.
- **Testes:** `describe` por unidade; nomes em português descrevendo o comportamento.
- **CI** (`.github/workflows/ci.yml`): job `verify` (typecheck, testes, build, auditoria, artefato do `dist`) e job `boundary` (falha se `src/engine` importar three.js ou usar `document`, `window` ou `HTMLElement`). Dependabot abre PRs semanais: revisar antes de aceitar.
