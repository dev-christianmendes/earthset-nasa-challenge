# Estado do projeto Earthset

**Data da verificação:** 15/11/2026 (tarde). **Commit:** `5c761ed` (HEAD de `main`, igual a `origin/main`).
Este documento é o estado atual. Cada afirmação traz a forma de conferi-la. Quando o estado mudar, atualize aqui e registre no `docs/execution-log.md`.

---

## 1. Prazo

- Envio: **15/11/2026, 23h59**, horário local. A meta interna de 12h já passou no horário desta verificação (15h42, UTC-3).
- Antes do envio, o autor precisa decidir os itens da seção 6 de `docs/backlog.md`: enunciado completo, equipe, demo e página de envio.

---

## 2. Verificação desta data

| Verificação | Resultado | Como reproduzir |
|---|---|---|
| Typecheck | passou (exit 0) | `npm run typecheck` |
| Testes do motor e de interface | 24 arquivos, **220 testes**, todos passando | `npx vitest run` |
| Testes Python (pipelines) | **54 testes**, OK | `PYTHONDONTWRITEBYTECODE=1 python3 -B -m unittest discover -s data-pipeline/tests` |
| Build | passou na revisão posterior do céu (CZ2wl0Ib, JS403,82kB gzip) | `npm run build` |
| Verificação visual (desktop e celular) | refeita na revisão do céu; 36 verificações astronômicas e E2E de pixels aprovados | `scripts/e2e-sky-visibility.py` e `scripts/e2e-astronomy.py` |
| Node | 24.22.3 | `node -v` |

A tabela de desempenho e as capturas de 15/11 estão em `docs/PERFORMANCE_VALIDATION.md` e `docs/EARTHSET_VALIDATION_ROADMAP.md`. Elas valem para as datas de medição indicadas nesses documentos, não para o HEAD de hoje.

---

## 3. Git e CI

- `main` está sincronizado com `origin/main`: não há commit local pendente de envio.
- **Há alterações não commitadas** em `src/`, `tests/`, `scripts/` e `data-pipeline/` (ver `git status`), que fazem parte de trabalho em andamento. Não são da higienização documental de 15/11.
- **CI:** as execuções verdes citadas nos registros de 14/11 referem-se ao commit `17abde8`. Esse commit existe, mas **não é ancestral de `main`**: o histórico foi reescrito no envio do bloco B0.6. O CI do HEAD atual não foi verificado.
- Branch remota `dependabot/npm_and_yarn/vitest-5.1.0` existe e não foi revisada (ver seção 6 de `docs/backlog.md`).
- **Edições paralelas:** durante esta verificação, outra sessão editava documentos de astronomia (`docs/data-sources.md`, `docs/EARTHSET_VALIDATION_ROADMAP.md`, `docs/SCENE_SKY_REVIEW.md`, `docs/execution-log.md`) e o `docs/backlog.md`. Conferir `git status` antes de editar esses arquivos.

---

## 4. Estado funcional (verificado no código)

### 4.1 Jogo

- Partida de 708 horas de jogo (`src/engine/clock.ts`, `MATCH_HOURS`). Vitória com pelo menos 1 coração na hora 708; derrota com 3 corações perdidos.
- Três modos sobre o mesmo núcleo científico: Explorador, Cadete Lunar e Comandante, mapeados às patentes do motor em `src/engine/modes.ts`.
- Cinco capítulos derivados do estado (`src/engine/chapters.ts`).
- Recursos: bateria, ar, água e comida (`src/engine/resources.ts`).
- Robô com fila de até 4 tarefas: gelo, painel e antena (`src/engine/robot.ts`); missões com fases (`src/engine/mission.ts`); modo seguro na radiação (`src/engine/safe-mode.ts`).
- Astronautas como máquina de estados, com ordens de colheita, manutenção, inspeção e abrigo (`src/engine/astronaut.ts`, `src/engine/crew.ts`).
- Estufa com cultivo, irrigação e iluminação (`src/engine/greenhouse.ts`); calibração de painéis e ajuste da antena (`src/engine/facilities.ts`).
- Clima espacial e alertas: estados NORMAL → MONITORAMENTO → ALERTA → ABRIGO → RECUPERAÇÃO (`src/engine/alert.ts`, `src/engine/space-weather.ts`, `src/engine/space-events.ts`).
- LUMA: guia por regras, sem IA generativa (`src/engine/guide.ts`); objetivos (`src/engine/objectives.ts`).
- Interação: seleção por toque e teclado, painel contextual com ações validadas pelo motor (`src/render/picking.ts`, `src/ui/context-panel.ts`).
- Idiomas: inglês por padrão e português do Brasil (`src/i18n.ts`). Modo escola (`src/school.ts`).
- **Vitória:** alcançável jogando. Com o plano de referência (gelo, painéis e antena) pela interface, a partida chega a 708 h com 3 de 3 vidas e mostra a tela "Mission accomplished". Derrota: "A base foi perdida" (`src/main.ts`, `outcomeOf` em `src/engine/game.ts`).

### 4.2 Constantes de equilíbrio (valores atuais)

| Constante | Valor | Onde |
|---|---|---|
| `MATCH_HOURS` | 708 | `src/engine/clock.ts` |
| `MAX_HEARTS` / `HOURS_PER_HEART_LOSS` | 3 / 6 | `src/engine/game.ts` |
| `PANEL_OUTPUT_PER_HOUR` / `BASE_LOAD_PER_HOUR` | 0,9 / 0,8 | `src/engine/resources.ts` |
| `MAX_QUEUE` / `MAX_PANELS` | 4 / 12 | `src/engine/robot.ts` |
| `TASK_HOURS` | gelo 6, painel 4, antena 8 | `src/engine/robot.ts` |
| `ICE_WATER_PER_TRIP` | 12 | `src/engine/robot.ts` |
| Partida inicial | site `peak`, 2 painéis, capacidade de bateria **1000**, estufa `surplus` | `src/main.ts` (`BASE`) |

O plano de referência nos testes (`tests/engine/partida.test.ts`), com o Sol e o horizonte medidos, vence com 3 corações. Com o cenário regional histórico, rendia 2. A capacidade de 1000 foi escolhida por simulação e é ajustável (`docs/regras-recursos.md`).

---

## 5. Dados e proveniência

| Dado | Arquivo gerado | Pipeline | Uso no jogo |
|---|---|---|---|
| Sol (JPL Horizons), por site | `src/data/sun-south-pole.json` e `src/data/sky.json` | `data-pipeline/fetch_sky.py` (ativo, com `--activate`) | Luz, energia e painel polar |
| Horizonte medido (LRO LOLA) | `src/data/terrain-sites.json`, `src/data/terrain-mesh.json` | `data-pipeline/fetch_lola.py` | Horizonte por site e relevo na cena |
| Clima espacial (NASA DONKI), cenário de 09/10/2024 | `src/data/space-weather.json`, `src/data/space-weather-events.json` | `data-pipeline/fetch_donki.py` | Tempestades e radiação, rotuladas como cenário |
| Estrelas (BSC5/NOIRLab) | `src/data/sky.json` | `data-pipeline/fetch_sky.py` | Céu |

- `data-pipeline/fetch_sun.py` **grava só legado**. O cenário ativo é o de `fetch_sky.py --activate`.
- Fontes, método e o que é ilustrativo: `docs/data-sources.md`. Proveniência do céu: `data-pipeline/sky-provenance.json`.
- Limites declarados: a astrometria estelar ainda não é completa (sem paralaxe, velocidade radial, aberração individual nem conversão para ICRS). Ver `docs/backlog.md`, seção 4.

---

## 6. Arquivos e documentos

- **Plano vigente:** `docs/PLANO_V4.md`. Os caminhos de arquivo da tabela P0 são da proposta original: `src/ui/menu.ts` e `src/ui/intro.ts` não existem. O menu e a introdução estão em `index.html`, `src/ui/screens.ts` e `src/render/cinematic.ts`.
- **Arquivado** em `docs/archive/` (substituído, sem valor de instrução): `PLANO_CONSOLIDADO.md`, `PLANO_PARA_AGENTE.md`, `MAPA_SISTEMA.md`, `INTERACTION_MAP.md`, `CONTEXTO_CODEX.md`, `questionario-escopo.html`.
- **Referências a arquivos inexistentes**, que permanecem como planejados: `docs/references.md` e `docs/demo-script.md` (citados em `docs/arquitetura.md`, seções 8 e 9). Ver backlog, seção 6.
- **Snapshot binário** de 15/11: `docs/ESTADO_PROJETO_2026-11-15.pdf` e `docs/ESTADO_PROJETO_mapa_mental.png`. Não foram alterados nem reconferidos. O README aponta para o PDF como "status atual".
- **Documentos especializados ainda válidos:**
  - `docs/INTERACOES.md`: arquitetura das interações (D-18, D-19).
  - `docs/regras-recursos.md`: regras e números de recursos.
  - `docs/event-rules.md`: regras do evento e pontos em aberto.
  - `docs/VISUAL_DIRECTION.md`: direção visual (D-11).
  - `docs/ART_ASSET_PIPELINE.md`: fontes e licenças dos ativos.
  - `docs/PLANO_AJUSTES_AUDITORIA.md`, `docs/AUDITORIA_V5.md`, `docs/ORIENTACOES_AUDITORIA_V5.md`: dívida técnica e auditoria. O texto do autor em `ORIENTACOES_AUDITORIA_V5.md` foi preservado sem alteração.
  - `docs/EARTHSET_VALIDATION_ROADMAP.md`, `docs/PERFORMANCE_VALIDATION.md`: validação de astronomia e desempenho.
  - `docs/SCENE_SKY_REVIEW.md`: revisão de visibilidade do céu e da amostragem solar (AST-VIS-02, aberto).
  - `docs/RENDERING_ARCHITECTURE.md`, `docs/UI_UX_SPECIFICATION.md`: especificações de 14/11, com avisos de partes superadas.

---

## 7. Caveats conhecidos

- **Desempenho móvel:** não medido em aparelho físico. Emulação com CPU limitada mostrou carga fria de até 1870 ms de long task e quadro de 2816,6 ms (`docs/PERFORMANCE_VALIDATION.md`). Ainda aberto (AST-PERF-01 e 02).
- **Auditoria de 15/11:** os achados foram registrados a partir de uma versão auditada. Reproduzir no código atual antes de corrigir ou encerrar (`docs/PLANO_AJUSTES_AUDITORIA.md`). Houve edições externas e HMR durante a auditoria, e nem tudo foi reverificado.
- **Dependências:** `npm audit` aponta 3 problemas em `vitest` 3.2.7 e `tinypool`, só de desenvolvimento, fora do build. A correção indicada é vitest 5, uma mudança maior. Não reverificado nesta data.
- **Ilustrativo marcado:** horizonte, relevo e algumas partes da luz da cena são medidos; o que é regra de jogo ou arte está marcado no código e na tela, conforme `docs/data-sources.md`, seção 5.


## Revisão local posterior — céu visível e diagnóstico solar

- Exposição longa ativa por padrão e atenuação/tamanho estelar corrigidos; controle EN/PT e botão “Olhar céu estrelado” em Ciência. Sem deslocar catálogo, Sol ou terreno. AST-VIS-01 concluída localmente.
- E2E de visibilidade: normal0 pixels acima do limiar no campo fixo; longa187 desktop/306 celular emulado, direção/intensidade solar e hash das posições iguais ao alternar. Capturas conferidas.
- Sol ainda usa amostras horárias em degraus: em3,107s/187frames (~60FPS), apenas3 alterações de~0,508°, separadas por1s em1×. Intensidade binária e custo das sombras sob FPS baixo são fatores distintos. AST-VIS-02 pendente; próxima mudança deve alinhar amostragem contínua disco/luz/horizonte/energia e testar partidas.
- Typecheck,220 testes/24 arquivos, build e36 verificações astronômicas passaram nesta revisão. Detalhes/limites em `SCENE_SKY_REVIEW.md`; histórico em `execution-log.md`. Código local não commitado por esta atividade.
