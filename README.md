# Earthset · Base no polo sul da Lua

Jogo de gestão em 3D, no navegador, para o **NASA Space Apps Challenge 2026** (desafio *Junior Astronaut Mission Trainer*). O jogador administra uma base no polo sul da Lua durante um **dia lunar de 708 horas de jogo**. Vence chegando à hora 708 com pelo menos 1 coração; perde quando os 3 corações acabam.

**Identidade:** *EARTHSET — One mission. One base. 708 hours to survive.*

- **Autor:** Christian Mendes (`dev-christianmendes`), projeto solo.
- **Início do projeto:** 14/11/2026. **Prazo de envio:** 15/11/2026, 23h59 (horário local).
- **Declaração de uso de IA:** [`AI_DISCLOSURE.md`](AI_DISCLOSURE.md). Ferramentas: Claude Code e Codex.
- **Idiomas da interface:** inglês (padrão) e português do Brasil.
- **Licença:** MIT (ver [`LICENSE`](LICENSE)).

## Escopo atual

O escopo vigente combina três frentes, todas descritas em `docs/`:

1. **Earthset 4.0** (`docs/PLANO_V4.md`, decisão D-16): tela inicial, modos de experiência, história e capítulos, introdução animada, HUD novo, base por áreas e modelos v4.
2. **Jogabilidade e auditoria** (`docs/INTERACOES.md`, `docs/AUDITORIA_V5.md`, blocos 8 a 10 de `docs/backlog.md`): astronautas com tarefas, estufa, rover, instalações, tempestades solares reais e dívida técnica registrada em 15/11/2026.
3. **Iluminação lunar e céu astronômico** (`docs/EARTHSET_VALIDATION_ROADMAP.md`, etapa AST): Sol com disco e exposição calculados, Terra aparente, planetas, estrelas de catálogo e modo Ciência. **Esta etapa ainda não foi commitada.**

Para o mapa completo do sistema, ver [`docs/MAPA_SISTEMA.md`](docs/MAPA_SISTEMA.md). Para pendências, ver a seção [Pendências](#pendências).

## Como rodar

Pré-requisito: **Node 24** (o CI usa Node 24) e npm com `package-lock.json`.

```bash
npm install
npm run dev         # servidor de desenvolvimento (Vite, porta 5173 por padrão)
npm run typecheck   # tsc --noEmit (strict)
npm run test        # Vitest: motor, partidas completas, astronomia, i18n, escola
npm run build       # typecheck + build estático em dist/
npm audit --omit=dev
```

Dados científicos são processados offline. Os testes do pipeline ficam em Python:

```bash
PYTHONDONTWRITEBYTECODE=1 python3 -B -m unittest discover -s data-pipeline/tests
```

Testes de interface (Playwright em Python, contra o servidor de desenvolvimento):

```bash
npx vite --port 5182 --strictPort &
python3 scripts/e2e-contexto.py 5182       # fluxo de painel contextual
python3 scripts/e2e-descoberta.py 5182     # descoberta pelo menu (exige GPU)
python3 scripts/e2e-tempestade.py 5182     # cenário de radiação e alertas
python3 scripts/e2e-astronomy.py 5182      # Sol, Terra, céu e modo Ciência
```

Atalhos de captura (só com `npm run dev`): `?autostart=cadet&hour=24&task=ice&tool=rover&shot=rover`, `?autostart=cadet&cineAt=7`, `?screen=modes&lang=pt`, `?perf=1` (medição de quadros).

## Como jogar

- **Selecionar:** toque ou clique num objeto da base (habitat, estufa, rover, astronautas, painéis, antena, processador, armazenamento). O painel contextual mostra estado, custos e ações.
- **Teclado:** teclas **1 a 9** abrem os objetos; **Tab** percorre o painel; **Esc** fecha o painel e depois pausa.
- **Câmera:** arrastar gira a câmera.
- **Velocidade:** 1×, 2× e 4×.
- **Modos:** *Explorador* (mais dicas e explicações), *Cadete Lunar* (equilíbrio de referência) e *Comandante* (HUD técnico, só alertas críticos).

Regras completas: [`docs/regras-recursos.md`](docs/regras-recursos.md) e [`docs/INTERACOES.md`](docs/INTERACOES.md).

## Funcionalidades

Status em 15/11/2026, conforme a documentação e a verificação da árvore de trabalho (typecheck e 208 testes passaram).

### Motor de regras (`src/engine/`, TypeScript puro)

| Área | Funcionalidade | Módulo | Status |
|---|---|---|---|
| Tempo | Relógio de 708 h, avanço por hora, fim de partida | `clock.ts`, `game.ts` | Pronto |
| Recursos | Energia, ar, água e comida por hora; equipamentos automáticos | `resources.ts` | Pronto |
| Corações | 3 corações, perda após 6 h em zero, derrota e vitória | `game.ts` | Pronto |
| Robô | Fila de até 4 tarefas (gelo, painel, antena), progresso, bateria | `robot.ts` | Pronto |
| Missões do rover | Fases (preparação, ida, operação, volta, entrega), modo seguro na radiação | `mission.ts`, `safe-mode.ts` | Pronto |
| Astronautas | Máquina de estados: inspecionar, colher, manutenção, calibrar, ajustar; abrigo | `astronaut.ts`, `crew.ts` | Pronto |
| Estufa | Cultivo por estágio, irrigação, iluminação, desgaste, colheita | `greenhouse.ts` | Pronto |
| Instalações | Calibração de painéis, ajuste e reparo da antena, efeitos que decaem | `facilities.ts` | Pronto |
| Terreno | Sítios de implantação e altura a partir do relevo medido | `terrain.ts` | Pronto |
| Sol | Tabela solar do polo sul por hora, horizonte local por sítio | `sun.ts` | Pronto |
| Clima espacial | Catálogo DONKI (SEP, GST), episódios de radiação, proveniência | `space-events.ts`, `space-weather.ts` | Pronto |
| Alertas | NORMAL → MONITORAMENTO → ALERTA → ABRIGO → RECUPERAÇÃO | `alert.ts` | Pronto |
| Modos | Explorador, Cadete Lunar, Comandante (mapeados às patentes do motor) | `modes.ts` | Pronto |
| Capítulos | 5 capítulos derivados do estado | `chapters.ts` | Pronto |
| Objetivos e ordem da tripulação | Objetivos visíveis, ordem automática ou de abrigo | `objectives.ts`, `crew.ts` | Pronto |
| LUMA | Guia por regras: dicas, alertas, histórico, eventos; sem IA em tempo de jogo | `guide.ts` | Pronto |
| Decisões | Decisões de escopo D-01 a D-19 aplicadas e testadas | `game.ts` | Pronto |

### Cena 3D e apresentação (`src/render/`)

| Funcionalidade | Módulo | Status |
|---|---|---|
| Cena Three.js com luz solar, sombras nítidas (PCF) e exposição fixa | `scene.ts` | Pronto |
| Base por áreas (habitação, energia, ciência, logística, comunicação, pouso) | `layout.ts`, `base-layout.ts` | Pronto |
| Relevo medido e pouso no terreno | `terrain-height.ts`, `terrain.ts` | Pronto |
| Modelos GLB v4 (habitat, rover de seis rodas, astronauta, estufa, painéis, antena) | `assets.ts`, `public/models/` | Pronto |
| Plantas da estufa por estágio de crescimento | `crop.ts` | Pronto |
| Seleção por raycasting e anel de destaque | `picking.ts` | Pronto |
| Planos de câmera e seguimento do rover | `director.ts` | Pronto |
| Introdução animada (16,5 s, pulável, movimento reduzido) | `cinematic.ts` | Pronto |
| Céu: Sol, Terra aparente, planetas e estrelas BSC5 (magnitude ≤ 4,5) | `src/astronomy/sky.ts`, `src/render/sky.ts` | Pronto no recorte; **não commitado** |
| Desempenho medido em GPU local (60 fps, P95 16,8 ms) | — | Medido; falta medição na máquina do autor |

### Interface (`src/ui/`, `index.html`)

| Funcionalidade | Módulo | Status |
|---|---|---|
| HUD: barra superior, ferramentas inferiores, painel lateral recolhível | `hud.ts`, `index.html` | Pronto |
| Menus, telas e configurações (idioma, modos) | `screens.ts` | Pronto |
| Painel contextual por objeto | `context-panel.ts` | Pronto |
| Painel de horizonte | `horizon-panel.ts` | Pronto |
| Painel científico: histórico DONKI e proveniência | `space-panel.ts` | Pronto |
| Painel de céu (modo Ciência, EN e PT, UTC, fontes) | `sky-panel.ts` | Pronto; **não commitado** |
| LUMA no canto com avatar | `luma.ts` | Pronto |
| Ícones | `icons.ts`, `styles.css` | Pronto |
| Modo escola: rótulos curtos e explicações por recurso | `src/school.ts` | Pronto |
| Idiomas EN e PT-BR | `src/i18n.ts` | Pronto |
| Teclado (1 a 9, Tab, Esc) | `main.ts` | Pronto |

### Dados e pipeline (`data-pipeline/`, `src/data/`)

| Dado | Fonte | Gerador | Saída |
|---|---|---|---|
| Sol no polo sul (janela da partida) | JPL Horizons | `fetch_sun.py` | `src/data/sun-south-pole.json` |
| Relevo e sítios | NASA LRO LOLA | `fetch_lola.py` | `src/data/terrain-*.json` |
| Eventos de clima espacial | NASA DONKI | `fetch_donki.py` | `src/data/space-weather*.json` |
| Céu: 7 corpos e 904 estrelas | JPL Horizons; BSC5 (NOIRLab) | `fetch_sky.py` | `src/data/sky.json` |

Dados brutos ficam em `data-pipeline/raw/` (versionados quando pequenos). Cada número científico tem origem, método e limites em [`docs/data-sources.md`](docs/data-sources.md). Valores ilustrativos ficam marcados no código e na tela.

## Estrutura do repositório

| Pasta | Conteúdo |
|---|---|
| `src/engine/` | Regras do jogo em TypeScript puro (sem three.js, DOM ou `window`) |
| `src/render/` | Cena Three.js, base, câmera, cinemática e estufa |
| `src/ui/` | HUD, painéis, menus e LUMA |
| `src/astronomy/` | Modelo do céu (corpos, estrelas, horizonte) |
| `src/data/` | Dados gerados pelo pipeline, lidos pelo motor |
| `tests/` | Testes Vitest do motor, astronomia, i18n e escola |
| `data-pipeline/` | Pipelines Python offline e seus testes |
| `scripts/` | Testes de interface com Playwright (Python) |
| `assets-src/` | Fontes Blender e pacotes de terceiros, com licença |
| `public/` | Modelos GLB e texturas servidos ao navegador |
| `docs/` | Documentação (ver índice abaixo) |
| `.github/` | CI (`verify`, `boundary`) e Dependabot |

**Regra de fronteira:** `src/engine/` não importa three.js, não usa DOM nem `window`. O CI verifica isso no job `boundary`.

## Documentação

| Documento | Para quê |
|---|---|
| [`AGENTS.md`](AGENTS.md) | Guia de entrada para agentes de IA e para o desenvolvedor |
| [`docs/MAPA_SISTEMA.md`](docs/MAPA_SISTEMA.md) | Mapa do sistema |
| [`docs/PLANO_V4.md`](docs/PLANO_V4.md) | Plano vigente (Earthset 4.0) |
| [`docs/backlog.md`](docs/backlog.md) | Estado de cada item, por bloco |
| [`docs/EARTHSET_VALIDATION_ROADMAP.md`](docs/EARTHSET_VALIDATION_ROADMAP.md) | Iluminação e céu astronômico (AST) |
| [`docs/INTERACOES.md`](docs/INTERACOES.md) | Interações, controles e testes |
| [`docs/regras-recursos.md`](docs/regras-recursos.md) | Regras e números de recursos, equipamentos, corações e robô |
| [`docs/DECISOES.md`](docs/DECISOES.md) | Decisões de escopo |
| [`docs/data-sources.md`](docs/data-sources.md) | Fontes dos dados e limites |
| [`docs/event-rules.md`](docs/event-rules.md) | Regras do evento e pontos em aberto |
| [`docs/PLANO_AJUSTES_AUDITORIA.md`](docs/PLANO_AJUSTES_AUDITORIA.md) | Dívida técnica (DT-01 a DT-17) |
| [`docs/execution-log.md`](docs/execution-log.md) | Diário de cada etapa, com comandos e resultados |
| [`docs/arquitetura.md`](docs/arquitetura.md) | Arquitetura e decisões de base |

## Pendências

Resumo. A lista completa está em `docs/backlog.md` e `docs/PLANO_AJUSTES_AUDITORIA.md`.

- **Entrega:** ler o enunciado oficial e o Guia de Envio (pendências A2 e A5 em `docs/event-rules.md`); confirmar equipe solo (A3); medir desempenho na máquina do autor com `?perf=1`; preparar vídeo ou slides, lista de referências e declaração de IA em inglês.
- **Dívida técnica:** DT-01 em fechamento; DT-02 a DT-04 são prioridade P0 (integração temporal, SEP com horários fracionários e eventos futuros); DT-05 a DT-17 em ordem de `PLANO_AJUSTES_AUDITORIA.md`.
- **Auditoria v5:** estabilidade (V5.P1), validação completa (V5.P4), destino do rover escolhido pelo jogador, diagnóstico de falhas da antena e animações de deslocamento.
- **Céu astronômico:** validar o ponto de observação e o azimute contra o morro LOLA (DT-16); astrometria completa das estrelas; outros observadores e janelas de data; desempenho em GPU móvel; carregamento a frio.
- **Ativos:** verificar licença de cada modelo de terceiros antes da entrega (`assets-src/SOURCE.md`).
- **Limites conhecidos:** `npm audit` aponta 3 problemas dev-only em `vitest` 3.2.7 (aceitos até a troca para vitest 5, depois do evento); aviso de chunk acima de 500 kB no build.

## Uso de IA

Desenvolvido com auxílio de Claude Code e Codex. Modelos e ferramentas declarados em [`AI_DISCLOSURE.md`](AI_DISCLOSURE.md). Nenhum conteúdo gerado por IA é usado como ativo do jogo. A LUMA usa regras, não IA generativa.

## Marcas e direitos

Este projeto não usa logotipo, insígnia, bandeira ou patch da NASA. Dados da NASA e do JPL são usados com as fontes indicadas em `docs/data-sources.md`. Ativos de terceiros são registrados em `assets-src/` com a licença de cada um.

## Licença

MIT (ver [`LICENSE`](LICENSE)).
