# Arquitetura do Earthset (versão 2, 14/11/2026)

Este documento é a referência de desenho. Todo item do `docs/backlog.md` aponta para um requisito (`R…`) daqui. Se um requisito mudar, muda aqui primeiro.

Prazo de envio: **15/11/2026, 23h59** (meta interna 12h). Evento não lido em todos os guias: ver requisitos **A2** e **A5** em `docs/event-rules.md`.

---

## 1. Requisitos

### 1.1 Requisitos do evento (fonte: `docs/event-rules.md`)

| ID | Requisito | Como o projeto atende |
|---|---|---|
| E1 | Responder a **um** desafio oficial (Junior Astronaut Mission Trainer) | Jogo de treino de missão lunar (A2: conferir o enunciado completo) |
| E2 | Demo em **até 7 slides** ou **vídeo de até 30 s**, em inglês | Vídeo de 30 s com legenda em inglês (B4.1) |
| E3 | Página de envio e materiais linkados em **inglês** | Fora da interface (ver R-LANG) |
| E4 | Lista de **References** com todo recurso externo | `docs/references.md` (B4.2) |
| E5 | Declaração de uso de **Super Intelligence** | `AI_DISCLOSURE.md` (B4.3) |
| E6 | Critério **Relevance**: NASA data no centro das regras | LOLA, JPL Horizons e DONKI nas regras (R-DATA) |
| E7 | Critério **Impact**: educação, 8 anos a adultos | Modo escola (R-ESC) |
| E8 | Critério **Creativity**: ideia original ou melhoria | Eventos reais viram decisões de jogo (R-EVT); patentes mudam a linguagem sem mudar a regra (R-PAT) |
| E9 | Critério **Validity**: base científica, viabilidade técnica, usabilidade | Dados com fonte, motor testado, CI (R-DATA, R-TEST) |
| E10 | Critério **Presentation**: demo e storytelling claros | Roteiro de 30 s e sete slides (R-DEMO) |
| E11 | Sem marca da NASA em assets ou tela | R-LEGAL |
| E12 | Sem foto, vídeo, voz ou imagem de menor de 18 anos | R-LEGAL |

Prêmios em foco (de `event-rules.md`, seção 4): **Best Use of Data**, **Best Storytelling**, **Most Inspirational**.

### 1.2 Requisitos do produto

| ID | Requisito | Estado |
|---|---|---|
| R-CORE | Partida de um dia lunar de 708 h; vence com 1 coração ou mais, perde com 3 zerados | Feito (`src/engine/game.ts`) |
| R-SUN | Sol com azimute e elevação reais (JPL Horizons) | Feito (B2.2) |
| R-DATA | Relevo real (LOLA) define horizonte e sombra de cada site | **Feito**: horizonte no motor (C1), relevo na cena (V1) e painel polar (V2) |
| R-EVT | Eventos solares reais (DONKI) mudam a partida: tempestade reduz energia dos painéis e a radiação para o robô | **Feito no motor e nos dados (C2, C3)**. Na tela, só o HUD; o efeito visual da tempestade ainda não existe |
| R-ROBO | Robô com fila de tarefas (gelo, painel, antena) | Feito (B1.4) |
| R-PAT | Patentes (cadete, explorador, comandante) mudam o consumo e a linguagem da tela | Consumo feito; linguagem **falta (I2)** |
| R-ESC | Modo escola: rótulos curtos e explicação por recurso com fonte | Feito (B3.4) |
| R-ALERT | Alerta de recurso baixo | Feito (B3.1); revisão de copy falta |
| R-VIS | Cena bonita: relevo real, base com modelos, Terra, estrelas, luz do Sol real, robô animado | Parcial (B3.3); **refazer com o relevo LOLA (V1–V4)** |
| R-LOG | Diário da base: registro de cada evento e decisão, em texto curto | **Falta (I3)** |
| R-LANG | Interface abre em inglês, com botão para português do Brasil; página de envio e materiais em inglês | **Feito** (`src/i18n.ts`, chaves iguais nos dois idiomas, testadas) |
| R-TEST | Motor testado; partidas completas; pipeline de dados testado | Em vigor (52 testes motor/UI, 5 pipeline) |
| R-LEGAL | Sem marca NASA; sem menor identificável; dado com fonte | Em vigor (`AGENTS.md`, regras 3, 8, 10) |
| R-DEMO | Demo de 30 s e 7 slides, em inglês | **Falta (B4)** |

---

## 2. Camadas

```
data-pipeline/ (Python, offline)           src/data/ (gerado, no git)
  fetch_sun.py      ─ JPL Horizons ───────►  sun-south-pole.json        (feito)
  fetch_lola.py     ─ LOLA DEM (PDS) ─────►  terrain-sites.json         (C1)
  fetch_donki.py    ─ NASA DONKI ─────────►  space-weather.json         (C2)
                                                  │
src/engine/  (TypeScript puro, sem three.js/DOM)  ▼
  clock.ts  sun.ts  terrain.ts  space-weather.ts  resources.ts  robot.ts  game.ts  narrative.ts
                                                  │  estado + eventos
src/render/  (three.js, só leitura do estado) ◄───┤
  scene.ts  terrain-mesh.ts  base-models.ts  robot-model.ts  sky.ts  lighting.ts
                                                  │
src/ui/      (DOM, só leitura + ações) ◄──────────┤
  hud.ts  school.ts (textos)  log-panel.ts  overlay.ts
                                                  │
src/main.ts  (liga motor, render e UI; laço do jogo)
```

Regras de fronteira (já verificadas pelo CI, job `boundary`):
- `src/engine` não importa three.js, não usa `document`, `window` nem `HTMLElement`.
- `src/render` lê o estado; não altera regra.
- `src/ui` lê o estado e envia ações; não calcula recurso.
- `src/data` é gerado por `data-pipeline`; nunca editado à mão.

**Refatoração necessária (fase 0):** `src/main.ts` tem ~480 linhas com cena, HUD e laço. Separar em `src/render/`, `src/ui/` e `src/main.ts` antes de C1. Sem mudar comportamento: os 52 testes e o build precisam continuar passando.

---

## 3. Motor: novos módulos

### 3.1 `terrain.ts` (C1)
- Entrada: `terrain-sites.json` (horizonte mínimo por direção de azimute, por site, medido no LOLA).
- Saída: `isSunlit(site, sunAz, sunEl)`; sombra permanente do site (em crateras) para gelo.
- Substitui `SITE_HORIZON_DEG` (hoje ilustrativo). A tabela `SUN` continua a mesma.

### 3.2 `space-weather.ts` (C2, C3)
- Entrada: `space-weather.json` (eventos DONKI de um **cenário histórico**: ver decisão D1).
- Saída por hora: `stormLevel` (0 a 3, escala NOAA G, com os limites da fonte).
- Efeitos (ajustáveis, documentados em `docs/regras-recursos.md`):
  - Tempestade (G2 ou mais): painéis produzem menos; a base pede abrigo (tarefa de abrigo na fila, ou a base perde ar/energia).
  - Radiação (dado de SEP quando houver): reduz comida ou eleva perda de coração.
- Sem evento: a partida é a mesma de hoje.

### 3.3 `narrative.ts` (I2, I3)
- Textos do diário por patente e por evento. Função pura: `logLine(event, rank, lang)`.
- Não muda regra: só escolhe texto. Patente muda o tom, não o número (R-PAT).

### 3.4 Já existentes
`clock.ts`, `sun.ts`, `resources.ts`, `robot.ts`, `game.ts`: mantidos. `game.ts` ganha o efeito dos eventos (C3) sem mudar a assinatura de `advance`.

---

## 4. Dados (data-pipeline)

| Script | Fonte | Saída | Estado |
|---|---|---|---|
| `fetch_sun.py` | JPL Horizons | `sun-south-pole.json` (709 h) | Feito |
| `fetch_lola.py` | LOLA DEM, PDS (`pds.nasa.gov`), recorte no polo sul | `terrain-sites.json` (horizonte por site e azimute) | C1 |
| `fetch_donki.py` | NASA DONKI (FLR, CME, SEP) com chave da NASA | `space-weather.json` | C2 |

Regras de dado (de `AGENTS.md`):
- Raster grande **nunca** no git (`.gitignore` cobre `*.tif`, `*.img`). Só o resultado reduzido vai para `src/data`.
- Cada script tem teste em `data-pipeline/tests/`.
- Cada número entra em `docs/data-sources.md` com a fonte e o método.
- Se uma fonte falhar (rede, 404), o script para com erro claro; o jogo segue com a tabela ilustrativa, e a tela diz isso.

**Decisões pendentes (D):**

| # | Decisão | Proposta | Quem decide |
|---|---|---|---|
| D1 | Qual período real o DONKI usa, já que a partida se passa no futuro | Cenário histórico: uma janela de 708 h com um evento forte já registrado (decidido: 9 de outubro de 2024, ver docs/data-sources.md, seção 3). Rotular como cenário na tela | Autor |
| D2 | Chave da API NASA | `DEMO_KEY` para teste; chave própria para o envio | Autor |
| D3 | Tamanho do recorte LOLA | Um recorte de ~20 km no polo sul, reduzido para malha de 256 px | Claude (técnico) |

---

## 5. Render (three.js)

Só desenha o estado. Nada de regra aqui.

| Módulo | Conteúdo | Requisito |
|---|---|---|
| `terrain-mesh.ts` | Malha do relevo LOLA reduzida, textura de regolito, crateras reais | R-VIS |
| `sky.ts` | Campo de estrelas, Terra, Sol como disco com halo | R-VIS |
| `lighting.ts` | Luz direcional com posição real do Sol; luz de sombra com cor fria; sombras | R-SUN, R-VIS |
| `base-models.ts` | Habitat, estufa, painéis, antena, abrigo (tempestade) | R-VIS |
| `robot-model.ts` | Robô animado (já feito; refinar) | R-ROBO |
| `scene.ts` | Monta a cena, câmera e enquadramento móvel (já há `frameForViewport`) | R-VIS |

Paleta única em `PALETTE` (já existe): o azul de destaque é o do HUD.

Requisito de qualidade: 60 fps em notebook comum; se cair, reduzir a malha antes de reduzir o visual.

---

## 6. UI (DOM)

| Módulo | Conteúdo | Requisito |
|---|---|---|
| `hud.ts` | Recursos, alertas, fila, estufa, painéis | R-ALERT |
| `school.ts` | Textos do modo escola (já existe) | R-ESC |
| `log-panel.ts` | Diário da base: últimos eventos, em texto curto | R-LOG |
| `overlay.ts` | Fim de partida com resumo | R-CORE |

Acessibilidade mínima: contraste de texto AA, botões com `aria-label`, navegação por teclado no HUD.

---

## 7. Testes e verificação

- **Motor (Vitest):** unidade por módulo novo; partida completa com e sem tempestade (`partida.test.ts`).
- **Pipeline (unittest):** cada script novo tem teste com dado de amostra pequeno.
- **Fronteira:** job `boundary` do CI.
- **Visual:** capturas desktop 1280×800 e celular 390×844 a cada item que mexe em tela, guardadas na pasta de rascunho da sessão.
- **Pronto** = typecheck, testes e build passando, captura revisada, registro em `docs/execution-log.md`.

---

## 8. Entrega (fase final)

- **Demo:** vídeo de 30 s ou 7 slides em inglês, roteiro em `docs/demo-script.md`.
- **References:** `docs/references.md`, com cada fonte de dado, biblioteca e ferramenta de IA.
- **Declaração de IA:** `AI_DISCLOSURE.md`, seção 5, com os modelos confirmados.
- **Envio:** só com pedido explícito do autor (regra 7).

---

## 9. Fases e ordem

| Fase | Conteúdo | Pronto quando |
|---|---|---|
| **F0** | Refatoração de `main.ts` em `render/`, `ui/` e `main.ts` | Testes e build iguais; tela igual |
| **F1** | C1: LOLA → `terrain.ts` → horizonte real | Horizonte medido em `docs/data-sources.md`; testes |
| **F2** | C2 + C3: DONKI → `space-weather.ts` → efeito na partida | Partida com tempestade vence/perde conforme o teste |
| **F3** | V1–V4: relevo LOLA na cena, base, céu, luz | Capturas revisadas |
| **F4** | I2, I3: diário e patentes na linguagem | Textos em `narrative.ts`, testados |
| **F5** | B3.1 revisão de copy; acessibilidade mínima | Revisão feita |
| **F6** | Demo, References, declaração de IA, envio | Só com pedido do autor |

Se o prazo apertar, a ordem de corte é: F5 e F4 antes de F3; F3 antes de F2; **F2 e F1 não se cortam** (são o critério Relevance).

---

## 10. O que não é escopo

- Temperatura separada (fica como frio = bateria zerada, B1.5).
- Multiplayer, contas, backend próprio.
- Modelos 3D importados de terceiros (a base é geometria própria).
- Imagem gerada por IA na demo (A4).
