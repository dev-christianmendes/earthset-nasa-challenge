

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
- [x] **G8.6 (P2)** Rover: selecionar na cena, lançar missões pelo painel contextual (custos, duração e motivo da recusa vindos do motor), etapas, tempo restante em horas de jogo e segundos reais, fila com cancelamento, câmera que acompanha, partida e parada suaves.
- [x] **G8.7 (P3)** Painéis (calibrar e instalar), antena (ajustar ou reparar), habitat (ordem de abrigo, consumo e exposição), processador (estado e missão de gelo) e armazenamento (estoques e autonomia), todos pelo painel contextual (D-19).
- [x] **G8.8 (P4)** Teclado (teclas 1 a 9, foco no painel, Tab, Esc), testes de invariantes com ações aleatórias, teste de celular, `docs/INTERACOES.md` e README.

## Bloco 9 · Auditoria funcional e tempestades solares reais (v5, `docs/ORIENTACOES_AUDITORIA_V5.md`)

Texto do autor registrado sem alteração em `docs/ORIENTACOES_AUDITORIA_V5.md`. O autor não achou, na porta 5180, as interações de estufa e astronautas que o Bloco 8 dava como concluídas. A regra vale daqui em diante: item só fica marcado quando funciona no navegador e o jogador o alcança. Nada de commit, push ou deploy sem autorização do autor.

- [~] **V5.P0** Auditoria (parcial, ver `docs/AUDITORIA_V5.md`): matriz de implementação com evidências (arquivo, linha, resultado de teste) e as seis classes do documento. Reproduzir o relato do autor no navegador antes de corrigir.
- [ ] **V5.P1** Estabilidade: latência, travamentos e integração (medir antes e depois).
- [~] **V5.P2** Interatividade (descoberta feita em 14/11: abas Greenhouse, Crew, Energy e Rover abrem o painel contextual; modo da estufa e troca de astronauta no painel; dica de toque na cena; teste `scripts/e2e-descoberta.py`. Pendente: destino do rover escolhido pelo jogador, diagnóstico de falhas da antena, animações de deslocamento): estufa, astronautas, rover, energia, habitat, antena, processamento de gelo e missões.
- [~] **V5.P3** (feito: Kp removido, catálogo de eventos, estados de alerta com HUD, LUMA e antena, painel científico com histórico (aba Ciência e chip do HUD), teste `scripts/e2e-tempestade.py`. decisão de ficar fora com risco explícito (`outside`). rover em modo seguro (volta, espera e recomeça a ida). Pendente: priorizar energia/suporte, adiar gelo como decisão com custo, animações de abrigo, documentação científica final) Tempestades solares com dados reais da NASA (DONKI): auditoria dos dados existentes, mapeamento determinístico às 708 h, alerta NORMAL → MONITORAMENTO → ALERTA → ABRIGO → RECUPERAÇÃO, LUMA, decisões, painel científico.
- [ ] **V5.P4** Validação: Playwright, desempenho, documentação científica e revisão.


## Bloco 10 · Dívida técnica da auditoria de 15/11/2026

Pedido do autor: planejar e registrar para verificação posterior; esta etapa não implementa correções. Plano com evidências, dependências e critérios de aceite: [PLANO_AJUSTES_AUDITORIA.md](PLANO_AJUSTES_AUDITORIA.md). Memória: [CONTEXTO_CODEX.md](CONTEXTO_CODEX.md). Achados são da versão auditada; verificar o código atual antes de agir. DT-01 e DT-12 já receberam alterações externas, com estados distintos abaixo.

Ordem: P0 (DT-01–04) → P1 (DT-05–06) → P2 (DT-07–09 e DT-13) → P3 (DT-10–12). Investigações DT-14–16 exigem confirmação; fechamento em DT-17. Severidade não é a prioridade de execução.

- [~] **DT-01 · P0 · High histórico** Revalidar teste do rover sem propriedade inexistente/falso positivo. Correção externa em `hoursLeft` presente; typecheck e 9 testes direcionados passaram em 15/11. Falta proteção de regressão e fechamento completo.
- [ ] **DT-02 · P0 · High** Estabilizar integração temporal, energia disponível e contagem de corações; comparar recursos e resultado sob partições diferentes.
- [ ] **DT-03 · P0 · High** Preservar horários fracionários de SEP e impedir alertas fundamentados em registros futuros.
- [ ] **DT-04 · P0 · Medium** Filtrar também notificações e eventos ligados futuros no histórico científico; atualizar a renderização quando se tornarem disponíveis.
- [ ] **DT-05 · P1 · Medium** Impedir crescimento sem água e tratar abastecimento parcial no intervalo.
- [ ] **DT-06 · P1 · Medium** Reservar ajuda ao gelo somente com astronauta efetivamente disponível, sem dupla ocupação.
- [ ] **DT-07 · P2 · Medium** Sincronizar chegada visual ao abrigo, proteção e exposição em 1×/2×/4×.
- [ ] **DT-08 · P2 · Medium** Unificar fluxos do motor, HUD e painéis, incluindo cuidados e calibração.
- [ ] **DT-09 · P2 · Medium** Fazer indicação/luzes da estufa refletirem operação automática durante abrigo.
- [ ] **DT-10 · P3 · Low** Remover salto do rover entre entrega e próxima missão, incluindo câmera e cancelamento.
- [ ] **DT-11 · P3 · Low** Preservar painel solar montado durante retorno/entrega, sem antecipar geração.
- [~] **DT-12 · P3 · Low** Cobrir cruzamento de exposição em 12/24 h. Ajuste externo para 1× evita o caso, mas não cobre a passagem de ciclo; E2E atualizado não reexecutado nesta etapa.
- [ ] **DT-13 · P2 · Medium · investigação de latência/UX** Medir confirmação, movimento e trabalho separadamente; explicar preparo/deslocamento/abrigo e reproduzir espera de segundos sem feedback.
- [ ] **DT-14 · investigação P2 · Medium · hipótese** Medir bloqueios de compilação de shaders e modelos tardios; confirmar ou descartar antes de otimizar.
- [ ] **DT-15 · investigação P3 · Low · hipótese** Medir descarte/propriedade de recursos GPU e sessões longas; não presumir vazamento contínuo.
- [ ] **DT-16 · investigação científica · Medium · hipótese** Validar ponto de observação e azimute Sol/LOLA, com comparação independente e impacto na iluminação.
- [ ] **DT-17 · fechamento · Medium** Executar matriz completa na mesma revisão, incorporar regressões à automação e atualizar plano/memória/diário com evidências.

Nenhum item é encerrado por mera edição de código. Validação: typecheck + testes + build; Python quando houver dados; E2E e screenshots desktop/celular revisados quando houver tela. Nada de commit, push ou deploy sem pedido explícito.
