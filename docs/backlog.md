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

- [~] **B3.1** HUD com recursos, hora, fila do robô, estufa, painéis e fim de partida, ligado ao motor (`src/main.ts`, `index.html`). **Feito nesta etapa:** alertas: ar abaixo de 30, água e comida abaixo de 20, bateria abaixo de 20% ficam em vermelho (`LOW_ALERT_PERCENT` em `src/main.ts`). **Falta:** revisão de copy da interface. Os textos em inglês ficam fora deste item: a interface é em português (regra 6 de `AGENTS.md`); o inglês só vale para a página de envio e materiais linkados (B4).
- [x] **B3.2** Print em desktop e celular revisado; nenhum texto cortado. Feito: em tela até 700 px, a câmera sobe 22% da altura e o HUD ocupa até 46% da altura, então a base aparece acima do painel (`src/main.ts`, `index.html`). Print de celular conferido; print de desktop comparado com o anterior (ver registro).
- [x] **B3.3** Visual "lindo" para a banca: céu, relevo com textura, base com modelos próprios, animação do robô e do Sol, e paleta consistente. Feito: chão com textura de regolito ilustrativa; robô com modelo próprio em escala maior, com antena que pisca ao trabalhar; habitat com tampas, faixa azul-claro (a mesma cor de destaque do HUD) e escotilha; estufa com nervuras; painéis em suportes; antena da base quando instalada; paleta única em `PALETTE` (`src/main.ts`); estrelas e Terra fora da névoa; HUD do celular compacto. **Limite assumido:** a Lua não tem atmosfera, então o céu é preto com estrelas, sem gradiente. O relevo continua ilustrativo (B2). Se a banca achar a cena pouco bonita, a correção é de arte, não de motor. Revisão visual: capturas de desktop 1280×800 e celular 390×844 em 14/11 (`docs/execution-log.md`).
- [x] **B3.4** Modo leve para escola (texto curto, sem termos técnicos) e explicações educativas ao lado de cada recurso (o que é, por que cai, de onde vem o dado). Feito: caixa "Modo escola" no HUD; rótulos curtos (`SCHOOL_LABELS`) e, abaixo de cada recurso, três linhas: o que é, por que muda e fonte (`EXPLANATIONS`, em `src/school.ts`). A fonte diz se o dado é real (só o Sol) ou regra do jogo. Testes em `tests/school.test.ts`. Revisão visual em desktop e celular, ver registro. **Limite:** o modo escola não muda a regra nem o equilíbrio; é só texto e rótulo.

## Bloco 4 · Envio (15/11, até 12h)

- [ ] **B4.1** Demo: vídeo de até 30 s com legenda em inglês, ou até 7 slides em inglês (`docs/event-rules.md`, seção 2).
- [ ] **B4.2** Lista de referências (References) com todo recurso externo.
- [ ] **B4.3** Declaração de IA em inglês com os modelos confirmados (`AI_DISCLOSURE.md`, seção 3).
- [x] **B4.4** Trabalho antes do evento: resolvido pelo autor em 14/11/2026. Projeto novo, iniciado do zero. Nenhum trabalho do projeto de envio foi feito antes do evento.

## Bloco 5 · Desenho v2 (14/11, noite) — em curso

Plano completo em `docs/arquitetura.md` (requisitos E1–E12 e R-…, camadas, fases F0–F6). Itens abaixo seguem essas fases.

- [x] **F0** Refatoração de `src/main.ts` em `src/render/scene.ts`, `src/ui/hud.ts`, `src/data/sun.ts` e `src/main.ts` (laço e ligação). Sem mudança de comportamento: 52 testes e build iguais; captura desktop conferida.
- [x] **C1** LOLA → `src/engine/terrain.ts` → horizonte real por site (`data-pipeline/fetch_lola.py`, 16 testes; `src/data/terrain-sites.json`). Feito: faixa de 40 km do LDEM 20 m baixada por HTTP Range; horizonte em 72 direções; sites peak/slope/rim escolhidos pelo próprio horizonte. Resultado: Sol em 448 h (peak), 182 h (slope, início do jogo), 0 h (rim). **Pendente:** verificar a convenção de azimute (suposição em `docs/data-sources.md`, seção 2) e revisar o equilíbrio: a base começa no morro (decisão do autor, 14/11), com 448 h de Sol; o teste de partida passa, mas o equilíbrio ainda não foi revisto. Rodapé atualizado.
- [ ] **C2** DONKI → `data-pipeline/fetch_donki.py` (CME e FLR; chave `DEMO_KEY` para teste). Ver D1 (cenário histórico).
- [ ] **C3** `src/engine/space-weather.ts` e efeito da tempestade na partida (abrigo, energia dos painéis).
- [ ] **V1–V4** Relevo LOLA na cena, base, céu e luz (`src/render/`).
- [ ] **I2** Patentes mudam a linguagem da tela (`src/engine/narrative.ts`).
- [ ] **I3** Diário da base na tela (`src/ui/log-panel.ts`).
- [ ] **F5** Revisão de copy (B3.1) e acessibilidade mínima.
- [ ] **F6** Demo, References, declaração de IA e envio (B4): só com pedido do autor.

## Envio ao GitHub

Repositório: `https://github.com/dev-christianmendes/earthset-nasa-challenge` (público). Envio autorizado pelo autor em 14/11/2026, em commits no formato Conventional Commits. O CI (`.github/workflows/ci.yml`) roda a cada push para `main` e a cada pull request. Para enviar mudanças novas, o autor pede; o fluxo é `git add`, `git commit`, `git push`.
