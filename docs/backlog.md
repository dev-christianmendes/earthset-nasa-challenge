# Backlog do projeto (a partir de 14/11/2026)

Plano do projeto novo, do zero. Prazo de envio: **15/11/2026, 23h59**, horário local (meta interna: 12h de 15/11). Legenda: `[x]` feito e verificado · `[ ]` aberto · `[?]` depende de decisão ou acesso do autor.

## Bloco 0 · Fundação (14/11, manhã) — feito

- [x] **B0.1** Projeto criado em `earthset-nasa-challenge`, do zero. Dependências fixadas: three 0.186.1, Vite 8, TypeScript 5.9, Vitest 3.2.
- [x] **B0.2** Relógio da partida puro em `src/engine/clock.ts`, com 4 testes (`npm run test`).
- [x] **B0.3** Cena three.js mínima com relógio no HUD (`src/main.ts`). Luz e relevo **ilustrativos**.
- [x] **B0.4** `AI_DISCLOSURE.md` com a declaração de uso de IA; `AGENTS.md`, `README.md`, `.gitignore` e `docs/event-rules.md`.
- [x] **B0.5** Cena verificada em navegador (desktop 1280×800 e celular 390×844). A primeira tentativa saiu preta por um bug real: `dt` negativo no primeiro quadro lançava `RangeError` e parava o laço. Corrigido em `src/main.ts`. A luz inicial escura foi corrigida na etapa B1.4 (sol nascendo baixo com intensidade mínima); ainda é um primeiro ajuste, ver B3.3.
- [x] **B0.7** CI/CD: `.github/workflows/ci.yml` (typecheck, testes, build, auditoria, fronteira do motor) e `dependabot.yml` criados. **Rodou no GitHub** após o envio de 14/11/2026: as 4 últimas execuções em `main` terminaram com sucesso.
- [x] **B0.6** Autor: enviar ao GitHub depois de revisar o histórico inicial. Feito: envio autorizado em 14/11/2026; histórico revisado e reescrito para retirar menções ao protótipo; `main` no GitHub (ver seção "Envio" abaixo).

## Bloco 1 · Regras da base (14/11, tarde) — feito, com ressalvas

- [x] **B1.1** Recursos por hora (energia, ar, água, comida) como funções puras em `src/engine/resources.ts`, com 13 testes. Regras em `docs/regras-recursos.md`.
- [x] **B1.2** Ações do jogador validadas pelo motor: `SET_GREENHOUSE`, `ENQUEUE_TASK` e `CANCEL_TASK`, com rejeição de entrada inválida e de ação após o fim.
- [x] **B1.3** Fim de partida em `src/engine/game.ts`: derrota com corações zerados; vitória com pelo menos 1 coração em 708 h. Verificado com partidas completas em `tests/engine/partida.test.ts`: base passiva perde; plano com robô vence com 3 corações.
- [x] **B1.4** Robô e gelo em `src/engine/robot.ts`: fila de até 4 tarefas, gelo (+12 de água por viagem), painéis (até 12) e antena. Consumo do robô na energia. 11 testes de unidade e partidas completas. Regras em `docs/regras-recursos.md`.
- [x] **B1.5** Frio e aquecimento sem energia como causa de perda de coração. Feito pela regra existente de bateria zerada (teste novo em `tests/engine/game.test.ts`); temperatura separada fica fora desta versão, ver `docs/regras-recursos.md`.

## Bloco 2 · Dados reais (14/11, noite)

- [x] **B2.1** Recorte escolhido pelo Claude, a pedido do autor (14/11/2026): **Sol real** (JPL Horizons) entra agora. DONKI e LOLA ficam para depois, com motivos em `docs/data-sources.md`, seção 4.
- [x] **B2.2** Pipeline em Python, só biblioteca padrão: `data-pipeline/fetch_sun.py`, com 5 testes em `data-pipeline/tests/`. Gera `src/data/sun-south-pole.json` (709 amostras horárias).
- [~] **B2.3** Sol lido da tabela gerada (`src/engine/sun.ts`). **Falta:** horizonte local medido (LOLA), DONKI e a revisão do equilíbrio com o Sol real (o teste de partida já passa com ele).

## Bloco 3 · Tela e textos (15/11, manhã)

- [~] **B3.1** HUD com recursos, hora, fila do robô, estufa, painéis e fim de partida, ligado ao motor (`src/main.ts`, `index.html`). **Falta:** alertas (ar, água e bateria baixos), textos em inglês e revisão de copy.
- [ ] **B3.2** Print em desktop e celular revisado; nenhum texto cortado. Feito parcialmente: o celular mostra o HUD na parte de baixo, mas a base fica escondida; ajustar o enquadramento.
- [ ] **B3.3** Visual "lindo" para a banca: céu, relevo com textura, base com modelos próprios, animação do robô e do Sol, e paleta consistente. **Hoje a cena é básica**: chão cinza com ondulação, crateras e volumes simples. Não declarar pronto antes de revisão visual com screenshots.
- [ ] **B3.4** Modo leve para escola (texto curto, sem termos técnicos) e explicações educativas ao lado de cada recurso (o que é, por que cai, de onde vem o dado).

## Bloco 4 · Envio (15/11, até 12h)

- [ ] **B4.1** Demo: vídeo de até 30 s com legenda em inglês, ou até 7 slides em inglês (`docs/event-rules.md`, seção 2).
- [ ] **B4.2** Lista de referências (References) com todo recurso externo.
- [ ] **B4.3** Declaração de IA em inglês com os modelos confirmados (`AI_DISCLOSURE.md`, seção 3).
- [x] **B4.4** Trabalho antes do evento: resolvido pelo autor em 14/11/2026. Projeto novo, iniciado do zero. Nenhum trabalho do projeto de envio foi feito antes do evento.

## Envio ao GitHub

Repositório: `https://github.com/dev-christianmendes/earthset-nasa-challenge` (público). Envio autorizado pelo autor em 14/11/2026, em commits no formato Conventional Commits. O CI (`.github/workflows/ci.yml`) roda a cada push para `main` e a cada pull request. Para enviar mudanças novas, o autor pede; o fluxo é `git add`, `git commit`, `git push`.
