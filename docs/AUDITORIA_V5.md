# Auditoria funcional v5 (P0) · 14/11/2026

Responde ao pedido de `docs/ORIENTACOES_AUDITORIA_V5.md`. Este documento só afirma o que foi executado nesta sessão. O que não foi verificado aparece como **não verificado**.

## 1. Como foi verificado

- Caminho real do jogador, sem `?autostart`: menu → New mission → Cadet → Begin mission → Skip intro, com Playwright e GPU (`--use-angle=vulkan`, 61 fps), porta 5180.
- `python3 scripts/e2e-contexto.py 5180`: 38 verificações, 0 falhas (usa `?autostart=cadet` e posições projetadas dos objetos).
- Leitura de `src/main.ts`, `src/render/picking.ts`, `src/engine/space-weather.ts`, `src/data/space-weather.json`, `data-pipeline/raw/donki_*.json` e `docs/data-sources.md`.
- **Ambiente que não serve para medir interação:** com renderização por software (`--use-angle=swiftshader`) o jogo roda a 0,7 fps (quadro de até 4,5 s). Nesse modo o clique do mouse não selecionou objeto, e a causa **não foi explicada**. Não use swiftshader para validar jogabilidade.

## 2. Causa do relato do autor ("estufa e astronautas sem interação")

1. As interações existem, mas **só abrem ao tocar o objeto na cena** (ou teclas 1 a 9). Com GPU, o clique na estufa abre o painel completo: crescimento, tarefas Inspect, Harvest e Maintenance, produção, consumo, desgaste, irrigação e iluminação.
2. O lugar óbvio, a aba **Greenhouse** do menu inferior, abre o painel antigo, que só tem modo (Off, surplus, Always on), estado, próxima colheita e comida. Não tem irrigação, iluminação, colheita, manutenção nem astronauta.
3. Nada na tela diz ao jogador que os objetos são clicáveis (não há dica, e o menu inferior leva ao painel antigo).
4. Antes, a porta 5173 servia o `earthset` v0.1 (pasta na lixeira). Servidor encerrado a pedido do autor.

Classificação: **IMPLEMENTADA, MAS INACESSÍVEL** (descoberta), não ausente. O `Bloco 8` marcou itens como concluídos pelo teste automatizado, que clica em posições calculadas, e não pelo caminho de descoberta de um jogador novo. Isso é a falha de processo a corrigir.

## 3. Matriz (parcial)

| Funcionalidade | Motor | Interface | Estado | Evidência |
|---|---|---|---|---|
| Estufa: tarefas, irrigação, iluminação, colheita, manutenção | sim (`greenhouse.ts`) | só por clique na cena ou tecla 2 | IMPLEMENTADA, MAS INACESSÍVEL | captura de tela com GPU; e2e "tocar na estufa abre o painel", "a colheita conclui em 4x" |
| Aba Greenhouse do menu inferior | n/a | painel antigo, sem as novas ações | PARCIALMENTE IMPLEMENTADA | captura de tela da aba |
| Astronautas: ordens, cancelar, abrigo | sim (`astronaut.ts`) | clique no astronauta ou teclas 4 e 5 | IMPLEMENTADA, MAS INACESSÍVEL (descoberta) | e2e "tocar no astronauta seleciona", "cancelar manda o astronauta voltar" |
| Rover: missões, etapas, cancelamento | sim | clique no rover ou tecla 3 | IMPLEMENTADA, MAS INACESSÍVEL (descoberta) | e2e "as etapas avançam", "a água sobe depois da entrega do gelo" (20 → 28) |
| Painéis, antena, habitat, processador, armazenamento | sim (`facilities.ts`) | clique ou teclas | IMPLEMENTADA, MAS INACESSÍVEL (descoberta) | e2e "tocar em panels/antenna/processor/storage abre o painel" |
| Conteúdo da aba Crew do menu inferior | não verificado | não verificado | NÃO VERIFICADO | — |
| Animação de deslocamento dos astronautas | não verificado em detalhe | — | NÃO VERIFICADO | e2e só confirma o texto de estado ("Walking to the site") |

Itens da seção 2 das orientações ainda sem linha própria nesta matriz: destino do rover escolhido pelo jogador, segurança e proteção contra radiação no habitat, diagnóstico de falhas da antena. Entram na próxima passada da auditoria.

## 4. Dados de clima espacial existentes (seção 3.2 das orientações)

**Fonte:** NASA DONKI, `data-pipeline/fetch_donki.py`, respostas cruas versionadas em `data-pipeline/raw/donki_gst.json` e `donki_sep.json`. Janela: 708 h a partir de 09/10/2024 09:00 UTC (709 amostras).

| Dado | Natureza | Observação |
|---|---|---|
| 17 registros SEP (ex.: `2024-10-09T03:50:00-SEP-001`, instrumento GOES-P SEISS >100 MeV, link DONKI) | **Observado** (registro DONKI) | Os IDs e links existem só no JSON cru. |
| 1 registro GST (`2024-10-10T15:00:00-GST-001`, Kp de 6,67 a 8,67, dado NOAA) | **Observado** | Medida da **magnetosfera da Terra**. |
| `radiation` = verdadeiro por 24 h depois de cada SEP (76 h no total) | **Regra de gameplay** | A duração de 24 h não vem da DONKI (já declarado em `data-sources.md`). |
| Kp ≥ 5 reduz a geração solar em 10% por nível G | **Regra de gameplay** | Kp é terrestre. A orientação do autor proíbe usar Kp como medida de radiação na Lua. A regra é uma simplificação declarada, e a justificativa técnica para painéis na Lua não existe: precisa ser removida ou rotulada. |
| FLR, CME, IPS | **Ausentes** | O endpoint FLR respondeu 404 em 14/11/2026 (`data-sources.md`). CME e IPS nunca foram buscados. |

**O que já influencia a simulação:** `radiation` abriga os astronautas (`src/engine/game.ts:235`, `crew.ts:59`), pausa o robô e dispara o aviso da LUMA (`guide.ts:95`); `kp` reduz a geração dos painéis (`space-weather.ts`).

**O que o jogo não tem hoje:**
- estados de alerta NORMAL → MONITORAMENTO → ALERTA → ABRIGO → RECUPERAÇÃO (só existe "tem radiação / não tem");
- metadados do evento na partida (ID, horário UTC, link): o JSON do jogo guarda só `kp` e `radiation` por hora, então a tela não consegue citar a fonte;
- painel científico e histórico de eventos;
- decisão do jogador (continuar fora ou abrigar) com risco explícito: hoje o abrigo é automático;
- distinção na tela entre dado observado e efeito calculado.

## 5. Próximos passos propostos (aguardam o autor)

1. **P1/P2, descoberta:** fazer a aba Greenhouse e a aba Crew mostrarem as ações novas (ou levarem ao painel contextual), e acrescentar uma dica de que a cena é clicável. Medir antes e depois com GPU.
2. **P3, dados:** ampliar o pipeline para guardar IDs, horários UTC e links por evento; decidir o destino do efeito de Kp nos painéis; só depois desenhar os estados de alerta.
3. **Teste:** acrescentar ao Playwright o caminho de descoberta (sem `?autostart` e sem posições calculadas).

## 6. Correção da descoberta (14/11/2026)

- Abas **Greenhouse, Crew, Energy e Rover** do menu inferior abrem o painel contextual do objeto (`src/main.ts`, `TOOL_OBJECT`). Base, Missions e Science seguem como painéis laterais.
- O **modo da estufa** (Off, surplus, Always on) passou para o painel da estufa (`context-panel.ts`, `modeControl`); a aba Crew tem botão para trocar de astronauta.
- Dica `toast.hint` 5 s depois do início ("Toque na estufa, no rover ou em um astronauta para dar ordens").
- **Testes (GPU, porta 5180):** `scripts/e2e-descoberta.py` (caminho real, sem `?autostart`): todas as verificações ok. `scripts/e2e-contexto.py`: 38 ok. A verificação "abrir um painel de ferramenta fecha o contextual" passou a usar a aba Base, porque a aba Energy agora abre o contextual (mudança intencional). `npm run typecheck`, `npm run test` (163) e `npm run build` ok.
- **Não medido:** latência antes e depois desta mudança (a mudança só liga botões a um painel existente; a medição de 6 ms de comando até feedback do Bloco 8 não foi repetida).

## 7. Efeito do Kp removido (14/11/2026, decisão do autor)

- **Removido:** `stormLevel`, `solarFactor` e o corte de 10% por nível G na geração dos painéis (motor, HUD, cena, painel contextual). O Kp continua em `src/data/space-weather.json` como dado observado da Terra, sem efeito.
- **Aviso da antena:** `hoursUntilStorm` (Kp) virou `hoursUntilRadiation`: avisa o início da radiação (SEP) em até 6 h e não avisa com a radiação em curso. É regra simplificada de jogo, a redesenhar na P3.
- **Textos ajustados:** aviso da LUMA (`luma.storm`), chip da HUD (`radiation: robot paused`), explicação de Ciência (`science.space.p`), modo escola, `data-sources.md` e `DECISOES.md` (emenda a D-01). Linha "Kp" saiu do HUD técnico e a linha "Panel output" saiu do painel de energia.
- **Ainda dizem "storm warnings" (a trocar na P3):** `chapter.4.goal`, `mission.antenna.p`, `luma.next.antenna`, `howto.2`, `brief.controls`, `ant.next`.
- **Testes:** `tests/engine/space-weather.test.ts` reescrito (Kp alto sem radiação não muda recursos nem corações; aviso só para radiação). typecheck ok, 172 testes ok, build ok, e2e-descoberta 20 ok, e2e-contexto 38 ok.

## 8. Catálogo de eventos (P3, passo 1, 14/11/2026)

- **Pipeline:** `data-pipeline/fetch_donki.py` passou a gerar `src/data/space-weather-events.json` (18 eventos: 17 SEP e 1 GST, 3 episódios de radiação). A tabela horária `space-weather.json` **não mudou**.
- **Dados novos por evento:** ID original, horário UTC, hora de jogo, link da DONKI, instrumento, alertas enviados pela NASA (ID, horário, link, atraso) e eventos ligados (FLR, CME, IPS) com atraso até o SEP. Cada campo traz a proveniência (`observed`, `from-id`, `computed`, `game-rule`).
- **Limite honesto:** FLR (404), CME e IPS (429) não puderam ser baixados; de FLR, CME e IPS só existem ID e horário lido do ID. O servidor do CCMC não respondeu. Nada foi inventado.
- **Achados que orientam os alertas:** a radiação começa antes da hora 0 (EP-01); o intervalo entre erupção e SEP vai de 2,4 h a 51 h; 9 dos 10 alertas oficiais saíram depois do início do SEP. O aviso fixo de 6 h da antena **não é sustentado pelos dados**: o próximo passo deve usar as erupções e CMEs ligadas para o estado MONITORAMENTO e tratar o SEP registrado como ALERTA, sem prometer antecedência.
- **Motor:** `src/engine/space-events.ts` (tipos, `episodeAt`, `eventsUntil`, `EMPTY_CATALOG`), ainda não ligado à partida.
- **Testes:** 35 testes Python do pipeline ok (inclui catálogo regravado igual ao versionado, janela sem eventos e campos nulos); `tests/engine/eventos-solares.test.ts` (8 testes): episódios batem hora a hora com a tabela, GST avisa que o Kp é da Terra, catálogo vazio não quebra. `npm run typecheck` e `npm run test` ok.

## 9. Estados de alerta (P3, passo 2, 14/11/2026)

**Decisão do autor:** manter a janela de 09/10/2024 09:00 UTC. O jogo abre com o episódio EP-01 já em curso (ALERTA, depois ABRIGO), o que serve de tutorial do alerta.

**Regras** (`src/engine/alert.ts`; cada uma diz de onde vem):

| Estado | Condição | Origem |
|---|---|---|
| NORMAL | nenhum episódio em curso, em recuperação ou monitorado | — |
| MONITORAMENTO | antena instalada; uma erupção (FLR) ou CME ligada ao próximo SEP já foi registrada e veio até `reach` horas antes dele (6 h, 12 h com o ajuste) | evidência `from-id` + regra de jogo (alcance) |
| ALERTA | radiação em curso e alguém ainda anda até o abrigo (1 h) | SEP `observed` + duração de 24 h `game-rule` |
| ABRIGO | radiação em curso e toda a tripulação dentro | idem |
| RECUPERAÇÃO | 6 h depois do fim do episódio | `game-rule` (a DONKI não informa o fim da radiação) |

- **Incerteza e tempo:** o MONITORAMENTO **não informa tempo restante**. A LUMA mostra o intervalo observado nos dados entre a erupção ou CME mais próxima e o SEP (hoje 2 a 50 h), e diz que a radiação nem sempre vem.
- **Limite honesto (hindsight):** o catálogo só tem erupções que foram seguidas de SEP; o jogo não tem falsos alarmes, que na vida real são a regra. Isso precisa aparecer no painel científico (pendente).
- **Efeito no jogo:** a antena ajustada (12 h) vê a CME do EP-02 (~10 h antes do SEP, hora 405 a 415); sem ajuste (6 h) e sem antena, não. O EP-03 teve a erupção ligada 50 h antes, fora do alcance: o primeiro estado é o ALERTA. A ordem dada a um astronauta durante a radiação é aceita, fica pausada no abrigo e retoma no fim do evento.
- **Interface:** chip da HUD por estado (com o ID da NASA no `title`), LUMA com o tipo de evento, o ID, o horário UTC, a incerteza e a ação (recolher a tripulação), painel da antena com o estado do clima espacial. Textos de capítulo e missão da antena ajustados.
- **Atalhos de captura (só dev):** `&clockAt=<hora>` e `&antenna=base|tuned`.
- **Testes:** `tests/engine/alertas.test.ts` (13: catálogo real, janela sem dados, registro SEP ausente, sem erupção ligada); `objetivos-luma.test.ts` (monitoramento, recuperação, citação do SEP). `scripts/e2e-tempestade.py` (GPU, 17 verificações): abertura em ALERTA/ABRIGO, chip e LUMA citando o registro, ordem pausada no abrigo e retomada depois, pausa, recuperação e volta ao normal, monitoramento só com a antena ajustada (e não com antena sem ajuste nem sem antena), chegada do SEP vira ALERTA, reinício da partida, sem erros de console.
- **Ainda não coberto:** decisões do jogador (continuar fora x abrigar) com risco explícito, rover em modo seguro com retorno, energia insuficiente e colheita durante o evento em teste de navegador, painel científico e histórico.
