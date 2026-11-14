

## Bloco 6 · Escopo v3 (14/11/2026, noite)

Plano vigente: `docs/PLANO_CONSOLIDADO.md`. Decisões: D-11 a D-15.

- [x] **V3.0** Decisões D-11 a D-15 registradas (direção visual, LUMA por regras, objetivos e ordem da tripulação, orçamento de desempenho, política de fontes).
- [~] **V3.1** LUMA (`src/engine/guide.ts`) e objetivos (`src/engine/objectives.ts`) implementados na árvore de trabalho, com testes (93 passam). **Falta:** verificação visual e commit (com pedido).
- [~] **V3.2** Briefing, painel de objetivos, controle da tripulação e painel do LUMA em `index.html` e `src/ui/hud.ts`. **Falta:** captura desktop e celular.
- [~] **V3.3** HUD v3: compactado para caber em 800 px (sem rolagem). Falta cartões com ícones.
- [x] **V3.4** Iluminação v3 (sombras nítidas, contraste) e plano de abertura da câmera de 7 s no início da missão.
- [x] **V3.5** Sol visível na posição calculada (disco e halo, só quando a luz chega à base); Terra com textura da NASA (Blue Marble, domínio público, `public/textures/earth/`). Iluminação v3 e plano de abertura: ver execução.
- [ ] **V3.6** Medição de desempenho com `?perf=1`.
- [ ] **V3.7** Entrega (A2 e A5 lidos antes de tudo).
- [ ] **V3.8** Habitat com Megakit (P1).
- [ ] **V3.9** Astronauta v3 (P1).
- [ ] **V3.10** Rover (P1).
- [ ] **V3.11** Pedras e crateras (P1).
- [ ] **V3.12** Animações de colheita e aceno (P1).

## Bloco 7 · Earthset 4.0 (D-16, `docs/PLANO_V4.md`)

- [x] **E4.1** Tela inicial própria com menu completo (Nova missão, Como jogar, Modos, Ciência, Configurações, Créditos, Idioma). Capturas 1366×768 e celular.
- [x] **E4.2** Seleção de modo (Explorador, Cadete Lunar, Comandante), `src/engine/modes.ts`, partidas completas testadas nos três modos.
- [x] **E4.3** História "Operação Último Horizonte" e 5 capítulos derivados do estado (`src/engine/chapters.ts`, testado).
- [x] **E4.4** Introdução animada de 16,5 s na cena (pouso do módulo, base, astronauta, LUMA), pulável, com movimento reduzido. Capturas aos 2, 7 e 12,5 s.
- [x] **E4.5** HUD novo: barra superior, barra de ferramentas, painel lateral recolhível, LUMA no canto, velocidade 1×/2×/4×, HUD técnico no Comandante.
- [x] **E4.6** Base por áreas (`src/render/layout.ts`, `base-layout.ts`), pousada no relevo medido, com cabos, trilhas, pedras instanciadas e luzes operacionais.
- [x] **E4.7** Modelos v4 (Blender, 14 GLB, 2,6 MB) e astronauta novo (base CC0 Quaternius). Rover v4 de seis rodas com broca.
- [x] **E4.8** Missões com fases (`src/engine/mission.ts`): preparação, ida, operação, volta, entrega; gelo com broca, poeira balística, carga e etapas "do gelo à água".
- [x] **E4.9** LUMA com avatar, gravidade, atalho, histórico, minimizar e eventos testados (`lumaEvents`).
- [x] **E4.10** Pausa, vitória/derrota com resumo, créditos. Derrota capturada; vitória não capturada (exige partida inteira).



## Bloco 8 · Jogabilidade: astronautas e estufa (D-18)

- [x] **G8.1 (P0)** Auditoria de desempenho com GPU real: 60 fps, 0 quadros acima de 50 ms, comando até feedback em 6 ms, sem carregamento duplicado (ver diário de 14/11, P0).
- [x] **G8.2 (P1)** Astronautas como máquina de estados no motor, com ordens, cancelamento, abrigo e testes (`astronaut.ts`, `tests/engine/astronauta.test.ts`).
- [x] **G8.3 (P1)** Estufa jogável: cultivo, irrigação, iluminação, desgaste, inspeção, colheita e manutenção (`greenhouse.ts`).
- [x] **G8.4 (P1)** Seleção por toque na cena (raycasting) e painel contextual: estufa, astronautas e rover completos; habitat, painéis, antena, processador e armazenamento com informação e atalho.
- [x] **G8.5 (P1)** Plantas por estágio de crescimento (`crop.ts`, modelo da estufa sem plantas embutidas).
- [ ] **G8.6 (P2)** Rover: seleção, missões a partir do painel contextual, deslocamento e coleta visíveis (hoje o painel mostra estado e cancelamento).
- [ ] **G8.7 (P3)** Painéis solares, antena, habitat, processador e armazenamento com decisões próprias.
- [ ] **G8.8 (P4)** Acessibilidade (teclado), documentação final e polimento.
