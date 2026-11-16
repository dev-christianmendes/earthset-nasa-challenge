# Backlog: pendências reais

**Atualizado em 15/11/2026.** Estado verificado em `docs/PROJECT_STATUS.md`. Este arquivo lista só o que está aberto ou parcial. Itens concluídos saíram daqui; o histórico completo está em `docs/execution-log.md` e na versão anterior deste arquivo (commit `c22e875`).

Legenda: `[ ]` aberto · `[~]` parcial · `[?]` depende de decisão ou acesso do autor.
Os IDs novos (E-, U-, M-, D-A…) são de organização desta revisão. Os IDs antigos aparecem entre parênteses.

Correspondência da numeração antiga (blocos do backlog anterior): bloco 6 e 7 viraram as seções 2 e 3 e os itens V3/E4 concluídos; bloco 8 concluído; bloco 9 (auditoria V5) está em `docs/AUDITORIA_V5.md`; bloco 10 = seção 4; bloco 11 e 12 = seção 5.

---

## 1. Entrega (prazo: 15/11/2026, 23h59, horário local)

- [?] **E-01** Enunciado oficial integral (antigo A2, parcial). Só o resumo oficial foi lido; a abertura do enunciado completo retornou 502 em 14/11. **Aceite:** requisitos listados e conferidos um a um contra o jogo. O resumo não fecha o item sozinho.
- [?] **E-02** Guia de Envio, Termos e Política de Privacidade (antigo A5). **Aceite:** campos obrigatórios e formato da demo registrados em `docs/event-rules.md`.
- [?] **E-03** Composição da equipe (antigo A3). O repositório é solo. Confirmar antes do envio se a equipe é a mesma. **Aceite:** `docs/event-rules.md` atualizado e a declaração de IA refletindo a equipe.
- [?] **E-04** Marca d'água em imagens geradas por IA (antigo A4). Confirmar no Guia de Envio. O projeto não usa imagem gerada por IA como ativo.
- [ ] **E-05** Demo: vídeo de até 30 s com legenda em inglês, **ou** até 7 slides em inglês (antigo B4.1). O roteiro `docs/demo-script.md` está planejado em `docs/arquitetura.md`, seção 8, e não existe. **Aceite:** material pronto. Sem foto, vídeo ou voz de menores de 18 anos.
- [ ] **E-06** Lista de **References** com cada fonte de dado, biblioteca, ferramenta de IA e oferta usada (antigo B4.2). Arquivo planejado: `docs/references.md`. **Aceite:** inclui JPL Horizons, LRO LOLA, NASA DONKI, BSC5/NOIRLab e cada ativo de terceiros de `docs/ART_ASSET_PIPELINE.md`.
- [?] **E-07** Declaração de IA em inglês com os modelos confirmados (antigo B4.3). Pendências em `AI_DISCLOSURE.md`, seção 5: modelo do Claude Code e modelo e provedor do Codex. **Aceite:** seção 4 de `AI_DISCLOSURE.md` preenchida com modelos confirmados pelo autor.
- [?] **E-08** Página de envio em inglês, campos obrigatórios e submit (antigo F6). Só com pedido explícito do autor. **Aceite:** as duas caixas de concordância marcadas e a página conferida antes do prazo.
- [ ] **E-09** Matriz de julgamento (`docs/event-rules.md`, seção 4). Lacunas do levantamento antigo: orientação inicial e aprendizado após derrota e vitória (Impact); coerência geográfica e azimute, já validados pelo DT-16, falta apresentar (Validity); matriz de atendimento depende de E-01 (Relevance); arte, mobile, demo, referências e página de envio (Presentation).

## 2. Interface e textos

- [~] **U-01** Revisão de copy da interface, em português e inglês (antigo B3.1, F5). **Aceite:** revisão feita nas duas línguas, sem texto cortado em 1366×768 e em celular. **Verificado em 15/11:** paridade do dicionário (521 chaves, todas com EN e PT); 313 chaves usadas existem; menu, modos, história, como jogar, créditos, configurações e pausa em PT (desktop e celular) e em EN (desktop), sem texto cortado; painel de ciência e painel de contexto da estufa em PT (celular, com rolagem interna); fim de partida em PT (derrota); vitória em EN (ver U-07); modo escola (painel de energia mostra o que é, por que muda e fonte). **Falta:** tela de vitória em PT (captura) e as telas de EN no celular.
- [~] **U-02** Acessibilidade mínima e navegação por teclado de ponta a ponta (antigo F5, P2). Já existem teclas 1 a 9, Tab e Esc (G8.8). **Aceite:** o fluxo principal funciona só com teclado. **Verificado em 15/11** (`.scratch-agent/u02/teclado.py`, 14 etapas, todas passando): menu → Nova missão → modo → Começar missão; tecla 4 seleciona a tripulação; foco vai para o painel; Tab alcança uma ação; Enter envia a ordem; Esc fecha o painel e pausa; Enter retoma. **Falta:** cancelar ordem pelo teclado, barra inferior e câmera, botões da tela final, e navegação nas telas secundárias.
- [ ] **U-03** Patentes mudam a linguagem da tela (antigo I2). `src/engine/narrative.ts` não existe. Hoje o modo muda as explicações (`src/engine/modes.ts`). **Decisão:** ainda vale como critério Creativity, ou sai do escopo? Se vale, **aceite:** textos por patente em módulo puro e testado.
- [ ] **U-04** Diário da base na tela (antigo I3). `src/ui/log-panel.ts` não existe. O histórico da LUMA (E4.9) pode cobrir isso. **Decisão:** é o mesmo item?
- [x] **U-05** HUD v3 com cartões e ícones (antigo V3.3). Concluído em 15/11: desktop com ícone, valor e barra em cada cartão; celular com ícone acima do valor (opção escolhida pelo autor) e cartão do capítulo abaixo da barra. Verificado em capturas `.scratch-agent/u05/`.

- [x] **U-07** Tela de vitória: existe e é alcançada jogando. Plano de referência pela interface (fila de gelo, instalação de painéis e antena, em 4×), 708 h em ~180 s reais, resultado "Mission accomplished" com 3 de 3 vidas. Verificado em 15/11 com jogador automático (`.scratch-agent/vitoria/`).

## 3. Arte e modelos

- [?] **M-01** Habitat com módulos de terceiros, astronauta, rover, pedras e crateras (antigos V3.8 a V3.11). A entrega v4 (E4.6 e E4.7) substituiu esses modelos. **Decisão do autor:** fechar estes itens ou abrir uma nova rodada de arte. Qualquer ativo novo precisa de licença verificada (D-15).

## 4. Dívida técnica da auditoria de 15/11/2026

Plano com evidências: `docs/PLANO_AJUSTES_AUDITORIA.md`. Pedido do autor: registrar e verificar depois. **Achados da versão auditada: reproduzir no código atual antes de corrigir ou encerrar.** Ordem: P0 (DT-01 a 04) → P1 (DT-05 e 06) → P2 (DT-07 a 09 e 13) → P3 (DT-10 a 12). DT-14 a 16 são investigações; DT-17 fecha a validação. Severidade não é a prioridade de execução.

- [~] **DT-02 · P0 · High** Estabilizar a integração temporal, a energia disponível e a contagem de corações. Comparar recursos e resultado sob partições diferentes de tempo. **Corrigido no motor em 15/11:** (1) a integração usa passos fixos de 0,25 h da grade global do relógio, e o tempo que sobra fica em `pendingHours` (`src/engine/game.ts`); antes, o passo era o da chamada, e o resultado dependia do tamanho do passo; (2) a partida não travava mais em 707,9999999999 com passos de 0,4 h (bug: a partida nunca terminava). **Verificado:** `tests/engine/particao-tempo.test.ts` (6 testes): decisões nas mesmas horas dão o mesmo resultado em passos de 0,05, 0,25, 0,5 e 1 h; cadência de 6 h igual à de passos de 0,25 h; fim em 708 h com passos de 0,4 h. **Implementado em 15/11:** as ações do jogador são validadas na hora e aplicadas na próxima fronteira de 0,25 h de jogo (`scheduled` em `src/main.ts`), para o resultado não depender do quadro. Atraso de resposta: até 0,25 h de jogo (0,25 s em 1×, 0,06 s em 4×). Também faltam o abastecimento parcial no intervalo (DT-05) e a variação de condições além desses cenários.
- [~] **DT-03 · P0 · High** Preservar horários fracionários de SEP e impedir alertas baseados em registros futuros. **Parcial:** evidência futura de SEP (E02) protegida em `tests/engine/parecer-regressao.test.ts`, em hora fixa e em toda a missão. Falta o horário fracionário de SEP ser preservado no pipeline (`data-pipeline/fetch_donki.py`).
- [~] **DT-04 · P0 · Medium** Filtrar também notificações e eventos futuros no histórico científico, e atualizar a renderização quando ficarem disponíveis. **Parcial:** painel científico (E03) protegido por teste na hora 417,2. Falta atualizar a renderização quando o registro passa a existir.
- [~] **DT-05 · P1 · Medium** Impedir crescimento sem água e tratar abastecimento parcial no intervalo. **Coberto no cenário do parecer:** crescimento com água zero (E04) em `tests/engine/parecer-regressao.test.ts`. Falta o abastecimento parcial no intervalo.
- [~] **DT-06 · P1 · Medium** Reservar ajuda ao gelo só com astronauta disponível, sem dupla ocupação. **Coberto no cenário do parecer:** ajuda do gelo com dois astronautas ocupados (E05) em `tests/engine/parecer-regressao.test.ts`. Falta o caso de astronauta único que sai de tarefa no meio do gelo.
- [ ] **DT-07 · P2 · Medium** Sincronizar a chegada visual ao abrigo, a proteção e a exposição em 1×, 2× e 4×.
- [ ] **DT-08 · P2 · Medium** Unificar os fluxos do motor, do HUD e dos painéis, incluindo cuidados e calibração.
- [ ] **DT-09 · P2 · Medium** Fazer a indicação e as luzes da estufa refletirem a operação automática durante o abrigo.
- [ ] **DT-10 · P3 · Low** Remover o salto do rover entre a entrega e a próxima missão, incluindo câmera e cancelamento.
- [~] **DT-12 · P3 · Low** Cobrir o cruzamento de exposição em 12/24 h. O ajuste para 1× evita o caso, mas não cobre a passagem de ciclo; o E2E atualizado não foi reexecutado.
- [ ] **DT-14 · investigação P2 · hipótese** Medir bloqueios de compilação de shaders e de modelos tardios. Confirmar ou descartar antes de otimizar.
- [ ] **DT-15 · investigação P3 · hipótese** Medir descarte e propriedade de recursos GPU em sessões longas. Não presumir vazamento contínuo: dez reinícios mantiveram 202 geometrias, 10 texturas e 17 programas (`docs/PERFORMANCE_VALIDATION.md`).
- [ ] **DT-17 · fechamento · Medium** Executar a matriz completa na mesma revisão, incorporar regressões à automação e atualizar o plano com evidências.

Concluídos e fora desta lista: DT-01 (teste do rover verificado: `npm run typecheck` cobre `tests/` e não há casts que escondam propriedades; mutação temporária no progresso do robô quebrou 22 testes em 8 arquivos, e o código foi restaurado), DT-16 (observador LOLA e azimute validados; 433 intervalos de Sol no peak; 3 corações no plano de referência). Ver `docs/PROJECT_STATUS.md`.

**Regra:** nenhum item encerra por edição de código. Validação: typecheck, testes e build; Python quando houver dados; E2E e capturas desktop e celular quando houver tela. Sem commit, push ou deploy sem pedido.

## 5. Desempenho, céu e ciência

- [ ] **AST-PERF-01 · High** Reduzir as travadas confirmadas na carga fria (até 1870 ms de long task e 2816,6 ms de quadro no perfil emulado). **Antes:** atribuir o custo por fase. A hipótese de shaders depende de trace. Reprodução em `docs/PERFORMANCE_VALIDATION.md`.
- [ ] **AST-PERF-02 · Medium** Medir em GPU móvel física: carga, qualidade e sessão térmica, e a política de sombras quando o FPS cai. Nenhum aparelho foi conectado; emulação não encerra este item. Inclui a medição `?perf=1` no equipamento do autor (antigo V3.6).
- [ ] **AST-PERF-03 · Low** Avaliar divisão em chunks e orçamento dos GLB e texturas. Ainda há chunk acima de 500 kB sem compressão. Comparar bytes totais e carga fria, não só nomes de chunks.
- [~] **AST-VIS-02 · Medium** Eliminar os degraus da amostragem solar e do céu. **Feito em 15/11:** disco e luz do Sol interpolados entre horas (`sunPositionAt`, `src/engine/sun.ts`), usados só na cena e no céu; energia e iluminação continuam pela hora. **Verificado no navegador (15/11):** sequência em 1× com `scripts/e2e-sol-continuo.py`: 58 de 59 leituras mudaram, maior sequência parada de 1 leitura, passo mediano 0,034° (esperado ~0,034°). Antes, com amostragem por hora: 31 de 60 mudaram, sequência parada de 15 leituras (~1 s), salto de 0,507°. **Falta:** horizonte, transição binária de intensidade e política de sombras sob FPS baixo, que são itens separados. **Aceite do restante:** definir como horizonte e energia acompanham o tempo fracionário, com testes de partidas. Diagnóstico em `docs/SCENE_SKY_REVIEW.md`. Não é resolvido por aumentar a exposição.
- [ ] **AST-SCI-01 · Medium** Astrometria completa: paralaxe, velocidade radial, aberração individual, deflexão e conversão do catálogo para ICRS, com referências independentes. O movimento próprio já incluído não encerra este item.
- [ ] **AST-SCI-02 · Medium** Expor outros cenários jogáveis só com horizonte, Sol, céu e clima correspondentes e com testes completos. O pipeline ampliado não muda a partida histórica nem desloca as tempestades DONKI para 2026.
- [~] **AST-P1 (antigo)** Observador, azimute e norte validados (DT-16). O restante foi reagrupado em AST-PERF-01 e 02 e em AST-SCI-01 e 02.

## 6. Decisões do autor (não avançar sem elas)

- [?] **D-A** Histórico do git. O histórico foi reescrito no envio do bloco B0.6, e `AI_DISCLOSURE.md` (seção 5) cita commits de outro agente antes do Codex. Decidir se a declaração cobre esses commits e se há mais alguma reescrita.
- [?] **D-B** Dependabot: há branch remota `dependabot/npm_and_yarn/vitest-5.1.0`. `npm audit` aponta 3 problemas em vitest 3.2.7 e tinypool, só de desenvolvimento. A troca para vitest 5 é maior. **Sugestão:** revisar depois do evento.
- [?] **D-C** O README aponta para `docs/ESTADO_PROJETO_2026-11-15.pdf` como "status atual". Manter, ou apontar para `docs/PROJECT_STATUS.md`? O PDF não foi revisado nesta higienização.
- [?] **D-D** Caminhos da tabela P0 de `docs/PLANO_V4.md` (`src/ui/menu.ts` e `src/ui/intro.ts`) não existem. Corrigir a tabela ou mantê-la como registro da proposta.
- [?] **D-E** `docs/arquitetura.md` ainda traz o desenho planejado (fases F0 a F6, seção 9). Decidir se é reescrito como documento de arquitetura implementada depois do envio.

## 6a. Auditoria integrada de gameplay, câmera, interface e som (pedido do autor, 15/11)

Já entregue (D-20 a D-27; não repetir): câmera com teclado, limites, câmera livre e margem diante dos painéis (D-27), módulo da estufa e sons por equipamento (D-25), plataforma aplainada (D-26), locomoção e navegação da tripulação, espera explicada na ordem, câmera de acompanhamento sem obstrução, painel persistente e cabos por painel (DT-11), carga de regolito e aquecimento no processador, celular deitado, som sintetizado com silenciar. Abaixo, só o que falta. Ordem: P0 → P1 → P2.

**Medição e latência**
- [ ] **INS-01 · P1** Instrumentação de latência no repositório (hoje as sondas Playwright ficaram fora dele): marcas de comando, resposta visual, início do movimento e execução no gancho de desenvolvimento, e um script de medição versionado. **Aceite:** relatório reproduzível em 1×, 2× e 4×, para astronauta e rover.

**Interface e controles (passo 2)** · entregue em 15/11 (D-23): UX-04 barra da equipe, UX-05 etiquetas na cena, UX-06 painel enxuto, UX-07 primeiros passos.
- [ ] **UX-08 · P2 · Low** Princípios de UX de jogos de exploração e construção de base, como inspiração e sem copiar interfaces, registrados em `docs/UI_UX_SPECIFICATION.md`.
- [x] **UX-09 · P1 · Medium** Contraste, legibilidade, estados de carregamento e mensagens de erro (verificação WCAG AA dos textos do HUD e dos painéis). **Aceite:** medição registrada; correções nos casos abaixo de 4,5:1. **Feito (15/11):** `scripts/e2e-ux-contrast.py`: 704 textos em menu, HUD e sete painéis, desktop e celular; antes, 17 abaixo do limite (8 distintos); `--dim` de #6b7889 para #7f8ca0 e botão desabilitado do céu de 0,45 para 0,6; depois, **0 abaixo**. Estados de carregamento e mensagens de erro não foram medidos separadamente. Textos sobre a cena 3D não entram na medição.
- [ ] **UX-03 · P1 · Medium** Celular em pé: o painel cobre metade da cena. Painéis recolhíveis por arraste ou aviso claro para girar o aparelho. **Aceite:** teste com toque em 412×915.

**Câmera** · entregue em 15/11 (D-27): CAM-01 teclado e CAM-02 limites por plano, câmera livre e recuperação automática.
- [ ] **CAM-03 · P2 · Low** Medir a transição astronauta ↔ rover (duração, interrupção pelo jogador) e ajustar se passar de ~1 s.

**Interações persistentes**
- [ ] **PER-04 · P2 · Low** Etapas explícitas por missão no painel (transportar, posicionar, instalar, conectar, operando), ligadas às fases de `src/engine/mission.ts`.

**Extração de água**
- [ ] **ICE-01 · P2 · Medium** Indicador de progresso na cena, armadilha fria visível no processador e limites de energia da missão comunicados na tela. Sem números novos sem fonte.

**Som**

**Persistência e extração: pendências depois de D-25**
- [ ] **PER-05 · P2 · Low** Irrigação visível (calhas e bomba) por nível de cuidado e antena com sinal de dados no prato quando online. Hoje a luz de cultivo segue o cuidado, mas a irrigação só tem som.
- [ ] **PER-06 · P2 · Low** Medir o assentamento dos objetos também em partida longa (instalação de painéis, novas vagas) e anotar no relatório de verificação; hoje coberto por teste de pegadas e relatório de dev.

**Rover (trajetória, D-22; feito: rota planejada, arcos de raio mínimo, perfil de velocidade, inclinação no relevo)**
- [ ] **ROV-01 · P2 · Medium** Manobra de chegada: alinhar a caçamba ao processador (ré curta) e parar de lado para o painel; hoje chega de frente pelo fim da rota.
- [ ] **ROV-02 · P2 · Medium** Rover como obstáculo dinâmico para a tripulação (hoje só a garagem é obstáculo) e a tripulação como obstáculo para o rover.
- [ ] **ROV-03 · P2 · Low** Rodas com esterçamento visível nas curvas e giro proporcional à velocidade real (hoje giram a ritmo fixo enquanto o rover anda); volta à garagem fora de missão também pela trajetória planejada.

**Validação**
- [ ] **VAL-01 · P1** Matriz final integrada (seção 7 do pedido) em desktop e celular depois de UX-04 a UX-07, com evidências. Aparelho físico: ver AST-PERF-02.

## 6b. Teste exploratório de uso e UX (15/11)

Relatório e evidências: `docs/UX_PLAYTEST_2026-11-15.md` e `docs/ux-review-evidence.json`. Os sete casos da auditoria em **6c1755c** foram corrigidos e revalidados localmente em 15/11: **67/67 verificações de navegador**, typecheck, **291 testes/33 arquivos** e build passando. A cópia estável testada coincide com os nove arquivos de produto alterados nesta correção (manifesto em `.scratch-agent/ux-fixes/source-manifest.json`). Roteiros: `scripts/e2e-ux-review.py` (diagnóstico original) e `scripts/e2e-ux-regression.py` (aceite). Não confundir estes IDs com UX-01 a UX-09 da seção 6a. Aparelho físico e outras dívidas continuam em seus itens próprios.

- [x] **UXR-01 · P1 · Medium** Menu com rolagem própria e rodapé no fluxo; alinhamento à esquerda restaurado após a captura do autor. **Validado:** mouse, toque e teclado em 1920×924, 1280×800, 780×493, 844×390 e 320×568; idioma, Créditos e retorno por Escape alcançáveis.
- [x] **UXR-02 · P1 · Medium** Sete botões de sistemas com nomes acessíveis EN/PT independentes dos rótulos visuais. Contador visual preservado. **Validado:** seleção por papel/nome no móvel nas duas línguas, inclusive com fila cheia.
- [x] **UXR-03 · P1 · Medium** Telas com foco inicial, ciclo de Tab/Shift+Tab, fundo inerte e restauração de foco. **Validado:** 48 passos em Configurações; Voltar/Enter/Escape; retomada devolve foco a Pausa; velocidade/hora não mudam na pausa.
- [x] **UXR-04 · P1 · Medium** Comunicação em coluna rolável, com prioridade de alertas; recibo substitui temporariamente o coach; dica genérica suprimida durante a orientação. **Validado:** três passos, confirmação e histórico no móvel, sem interseção das áreas pintadas; alertas consultáveis após concluir/minimizar; mensagens antigas limpas ao reiniciar.
- [x] **UXR-05 · P2 · Low** Recursos com linha própria no móvel, controles separados em 320 px e relógio compacto deitado. Etiquetas 3D ficam atrás do HUD. **Validado:** 20 casos numéricos em cinco tamanhos (0, 9, 99, 100, incluindo %); menor separação entre números de 32 CSS px; relógio, recursos, vidas e botões sem colisão.
- [x] **UXR-06 · P2 · Low** Tradução única dos motivos de recusa, com os limites do motor. **Validado:** fila cheia em EN/PT no navegador e quatro testes de integração das recusas reais do motor (fila e limite de painéis); sem `{max}` literal.
- [x] **UXR-07 · P2 · Low** Cabeçalho do painel aberto atualizado ao trocar idioma. **Validado:** os sete painéis mantidos abertos em EN→PT e PT→EN, com os títulos corretos.

A espera inicial por radiação já é explicada na versão revalidada (D-21–23); não abrir como nova falha de latência. Confirmar compreensão com jogadores novatos continua sendo hipótese de UX, não bug confirmado.

## 7. Achados de código fora do escopo documental

Não corrigidos nesta higienização, que não altera código.

- `data-pipeline/fetch_sun.py`, linha 14: a docstring diz que o arquivo grava `src/data/sun-south-pole.json`, "tabela usada pelo jogo". O código grava só o legado, em `data-pipeline/generated/sun-regional-legacy.json` (linha 40). **Sugestão:** corrigir a docstring.
- Em 15/11, depois dos commits `9c70677`, `1ac68a6`, `f59ebfa`, `b65d9b2` e `81778e9`, não havia alterações pendentes no repositório. Conferir `git status` antes de cada etapa, porque outra sessão pode editar os mesmos arquivos.
