# Plano de ajustes e dívida técnica · auditoria de 15/11/2026

Pedido do autor: mapear os ajustes, acrescentar tarefas ao repositório e preservar a dívida técnica para verificação posterior. Esta etapa só registra o plano; não implementa correções de gameplay, renderização, dados ou testes.

Índice de execução: [backlog, seção 4](backlog.md). Memória de retomada: [CONTEXTO_CODEX.md (arquivado)](archive/CONTEXTO_CODEX.md). Regras do projeto: [AGENTS.md](../AGENTS.md).

## Proveniência e estado de referência

- Origem: relatório técnico entregue nesta conversa em 15/11/2026: 12 achados confirmados naquele momento (3 High, 6 Medium, 3 Low), 3 hipóteses e relato adicional de demora nas ordens. Nenhum Critical demonstrado.
- Base Git observada na auditoria: `781f552`, incluindo alterações locais não commitadas. Houve edições externas durante os testes. A reprodução de navegador foi estabilizada numa cópia em memória de 15/11/2026 às 09:08:14, SHA-256 `4f7dc28189bdaf88017f1dfcfdd74b1ecc264ac720ed85090f49f2694b1b5212`. Esse identificador é da cópia em memória, não um commit; a cópia não foi salva como artefato.
- Evidências abaixo são históricas: revalidar a versão atual antes de corrigir. Referências por função são preferíveis a números de linha que podem mudar.
- Ao preparar este plano, DT-01 já tinha correção externa em `hoursLeft`: `npm run typecheck` passou e os 9 testes de `decisoes.test.ts` passaram. Não registrar o erro TS2339 como ainda presente.
- DT-12 recebeu ajuste externo para executar a comparação em 1×; a cobertura dos limites 12/24 h continua pendente. O E2E atualizado não foi reexecutado nesta etapa documental.
- Não há vazamento contínuo de GPU comprovado: dez reinícios mantiveram 202 geometrias, 10 texturas e 17 programas. Ausência de crescimento nessa amostra não prova descarte correto ou estabilidade de sessões longas.

## Ordem e critérios gerais

Prioridade de execução e severidade são campos diferentes. Os números de tarefa mantêm a correspondência com o relatório original.

| Etapa | Tarefas | Resultado esperado |
|---|---|---|
| P0 · contratos, tempo e cronologia | DT-01, DT-02, DT-03, DT-04 | Verificação de tipos confiável, simulação consistente e nenhuma evidência científica futura apresentada como passada |
| P1 · integridade das regras | DT-05, DT-06 | Cultivo e ajuda do rover respeitam recursos e disponibilidade |
| P2 · estado e apresentação | DT-07, DT-08, DT-09, DT-13 | Abrigo, fluxos, produção e feedback correspondem ao motor |
| P3 · transições e testes | DT-10, DT-11, DT-12 | Continuidade visual e regressões de exposição cobertas |
| Investigação | DT-14, DT-15, DT-16 | Confirmar ou descartar hipóteses com medições e fontes, sem presumir defeito |
| Fechamento | DT-17 | Evidências consolidadas sobre a mesma versão |

- Manter todas as correções no motor puro quando forem regras; a cena e a UI só apresentam o estado.
- Começar cada tarefa por uma reprodução pequena e um teste que falhe pelo motivo correto. Para investigações, registrar primeiro se a hipótese foi confirmada ou descartada.
- Não ajustar bateria, penalidades ou dados para esconder falhas. Mudança de regra ou equilíbrio deve ser explícita, documentada e respeitar as decisões do autor.
- Uma tarefa não fica concluída só porque o código mudou. Registrar revisão auditada, comandos, resultados, evidência visual quando couber e risco residual.
- Ao concluir uma correção: typecheck, testes e build completos aprovados; Python quando afetar dados; screenshots desktop e celular revisados quando afetar tela. Medições de interação exigem identificar GPU/renderizador, resolução, modo e velocidade.
- Sem commit, push, publicação ou envio de mensagens externas sem autorização específica.

## DT-01

**Revalidar o teste de progresso do rover · High histórico · P0 · correção externa presente, validação parcial.**

- **Onde:** `tests/engine/decisoes.test.ts`, teste «o robô continua trabalhando se o jogador decide ficar fora»; contrato `RobotTask` em `src/engine/robot.ts`.
- **Evidência original:** acesso a `progress`, campo inexistente; TS2339 em duas referências; `?? 99` e `?? 0` faziam a asserção passar sem observar progresso.
- **Estado revalidado:** código atual compara `hoursLeft`; typecheck e 9 testes direcionados passaram nesta etapa. Não foi feita correção por esta auditoria.
- **Ajuste restante:** manter asserções sobre estado real e garantir que ausência de tarefa ou regressão de progresso não seja mascarada por valores alternativos.
- **Aceite/teste:** comparar tarefa pausada (6 h restantes) com tarefa que avançou; ausência inesperada de tarefa deve falhar; demonstrar que impedir o progresso torna o teste vermelho. Executar a verificação completa de DT-17 antes de encerrar.
- **Dependências:** nenhuma.

## DT-02

**Estabilizar integração temporal e contabilidade de energia/corações · High · P0 · pendente.**

- **Onde:** `src/engine/game.ts: advance`, `resources.ts: deriveFlow/applyFlow`, chamada de `advance` no loop de `src/main.ts`; `tests/engine/invariantes.test.ts` e `partida.test.ts`.
- **Evidência:** equipamentos são decididos no início do passo e privação é contabilizada pelo estado final. Com capacidade 980 e a mesma política de ordens em horas inteiras, passos de 1 h perderam na hora 672; passos de 1/60 h venceram na hora 708 com 1 coração. A capacidade de referência atual é 1000; 980 foi um caso de fronteira. Com bateria 0,01 e gelo enfileirado, um avanço de 4 h sem Sol concedeu a entrega apesar do esgotamento durante o intervalo.
- **Ajuste:** definir passo interno fixo e tratar fronteiras relevantes (recursos zerando, tarefas concluindo, mudanças de Sol/clima no chamador). Não cobrar todo o intervalo como privação nem permitir trabalho além da energia disponível.
- **Aceite/teste:** reproduções mínimas de esgotamento no meio do passo, recurso recuperado perto de perder coração, missão concluída antes do fim do passo e entrada/saída de radiação. Comparar recursos, contadores, corações e resultado sob diferentes partições temporais e tolerâncias numéricas documentadas.
- **Controle experimental:** distinguir «mesma política» de «mesma sequência de comandos». Adicionar também comandos fixos nos mesmos instantes de jogo, sem variar a frequência de decisão com FPS.
- **Equilíbrio:** repetir as partidas completas nos três modos com dados reais; não exigir que o caso sintético 980 vença, e sim consistência entre partições.
- **Dependências:** DT-01 revalidada; coordenação com DT-03 para fronteiras do clima.

## DT-03

**Preservar instante real de início dos SEP e impedir evidência futura · High · P0 · pendente.**

- **Onde:** `data-pipeline/fetch_donki.py: hour_index/build_samples/radiation_episodes`, `src/engine/alert.ts: alertAt`, catálogo e tabela horária.
- **Evidência:** na hora 415, radiação e alerta já citam SEP da hora 415,75; na 455, citam SEP da 455,95. O arredondamento para baixo antecipa os efeitos em 45/57 minutos; o fallback `seps[0]` pode citar evidência ainda futura.
- **Ajuste:** manter instantes fracionários e alinhar o consumo da tabela ao catálogo. Evidência observada deve satisfazer `evidence.hour <= horaAtual`; identificar qualquer discretização adotada como regra do jogo.
- **Aceite/teste:** antes/no instante/depois de cada SEP, inclusive 415,75 e 455,95; episódios sobrepostos, eventos anteriores à janela, catálogo vazio e entrada/saída em passos grandes. Antes do registro não pode haver alerta fundamentado nele.
- **Dados:** regenerar apenas pelo pipeline, preservando brutos e proveniência; documentar diferenças de duração/amostragem e repetir partidas. As 24 h de duração continuam explicitamente uma regra ilustrativa.
- **Dependências:** contrato temporal de DT-02 para integração final.

## DT-04

**Filtrar informações futuras dentro do histórico científico · Medium · P0 · pendente.**

- **Onde:** `src/ui/space-panel.ts: linkedLine/alertsLine/eventHtml/mountSpacePanel`.
- **Evidência:** renderização na hora 417,2 inclui notificação de 26/10 às 18:15 UTC e IPS de 28/10 às 04:13 UTC, ambos posteriores ao instante simulado; apenas o evento principal é filtrado.
- **Ajuste:** filtrar também notificações e eventos ligados pelo instante de disponibilidade; invalidar a renderização quando um registro interno se tornar visível. Revisar também resumos como `kp_max`, que podem agregar observações posteriores, sem aplicar Kp à simulação lunar.
- **Aceite/teste:** nenhum horário apresentado como disponível pode exceder a hora atual. Verificar 417,2 e cruzamento de cada notificação/registro ligado sem mudança no número de eventos principais; cobrir ausência de campos e EN/PT.
- **Dependências:** DT-03 para uniformidade dos horários.

## DT-05

**Condicionar crescimento do cultivo à água disponível · Medium · P1 · pendente.**

- **Onde:** `src/engine/game.ts: advance`, `greenhouse.ts: stepCrop`, `resources.ts`.
- **Evidência:** com água 0, energia suficiente e estufa ligada, 13 h levaram o cultivo a 100%; `stepCrop` só recebe o sinal de equipamento ligado.
- **Ajuste:** vincular crescimento ao abastecimento efetivo, inclusive esgotamento parcial durante um passo. Explicitar a regra de falta de água em `docs/regras-recursos.md`.
- **Aceite/teste:** água 0 não aumenta crescimento; água parcial sustenta apenas o intervalo correspondente; reabastecimento retoma cultivo sem ganho retroativo. Testar cuidados baixos/normais/altos e partidas completas.
- **Dependências:** DT-02.

## DT-06

**Vincular ajuda ao gelo à disponibilidade efetiva de astronauta · Medium · P1 · pendente.**

- **Onde:** `game.ts: helpAvailable`, `crew.ts: crewAvailableForHelp`, estado `agents` e regra D-06.
- **Evidência:** dois astronautas atribuídos a calibração e inspeção, ambos em deslocamento, ainda permitiram completar gelo em 4 h com bônus de ajuda.
- **Ajuste:** representar ocupação do ajudante e derivar disponibilidade de tarefa, descanso, abrigo e radiação; conciliar `crew` e `agents` para não atribuir trabalho simultâneo à mesma pessoa. Preservar os valores 4/6 h, salvo revisão explícita da regra.
- **Aceite/teste:** 6 h sem ajudante e 4 h com ajudante elegível; ambos ocupados, um livre, descanso, cancelamento, abrigo, decisão `outside` e disponibilidade alterada durante a missão. A apresentação deve identificar a ajuda efetiva.
- **Dependências:** DT-02; alinhar apresentação com DT-07.

## DT-07

**Sincronizar chegada visual ao abrigo, proteção e exposição · Medium · P2 · pendente.**

- **Onde:** `crew.ts: advanceCrew/crewSheltered`, `game.ts`, `scene.ts: updateCrew/followCrew`.
- **Evidência:** em 4× durante calibração, o motor informou `transitLeft=[0,0]` e proteção, mas o astronauta seguia visível a 11,36 m do abrigo.
- **Ajuste:** usar progresso lógico de deslocamento compartilhado, com definição única de chegada. Distinguir «voltando» de «abrigado»; pausar/retomar sem teletransporte. Manter o cálculo de exposição como regra do jogo, não dose NASA medida.
- **Aceite/teste:** em 1×/2×/4× e diferentes FPS, proteção e exposição coincidem com chegada visível dentro de tolerância explícita. Cobrir astronautas distantes, ordem manual, radiação automática, `outside`, cancelamento, pausa e reinício.
- **Dependências:** DT-02 e contrato de ocupação de DT-06.

## DT-08

**Unificar fluxos apresentados com os usados na simulação · Medium · P2 · pendente.**

- **Onde:** `src/ui/hud.ts: renderTop/renderEnergy`, `context-panel.ts: flowNow`, chamada de `deriveFlow` em `game.ts`.
- **Evidência:** 12 painéis, calibração completa e cuidados altos: HUD E +7,90/h e água −0,71/h; fluxo efetivo E +8,696/h e água −0,79/h.
- **Ajuste:** derivação compartilhada dos fluxos atuais, incluindo calibração, cuidados, atividade real do rover e decisão de abrigo/exposição; eliminar chamadas com parâmetros padrão incorretos.
- **Aceite/teste:** HUD técnico, painéis contextual/lateral e variação dos recursos devem concordar para a mesma entrada. Matriz: luz/sombra, três cuidados, calibração ativa/expirada, eletrólise, bateria baixa e radiação com/sem `outside`.
- **Dependências:** DT-02; DT-06 para atividade efetiva.

## DT-09

**Apresentar operação automática da estufa corretamente durante abrigo · Medium · P2 · pendente.**

- **Onde:** `scene.ts: updateScene`, `hud.ts: renderGreenhouse`, `resources.ts: isGreenhouseOn`.
- **Evidência:** cena e painel antigo exigem `crewOrder === 'auto'` para indicar produção, enquanto o motor mantém consumo e crescimento com ordem `shelter`.
- **Ajuste:** derivar indicação e luzes do estado operacional real; separar presença de astronauta de funcionamento automático.
- **Aceite/teste:** com estufa efetivamente ligada, ordenar abrigo não exibe produção desligada. Testar também `outside`, modo off, economia e falta de água, sem mostrar crescimento quando DT-05 o impedir.
- **Dependências:** DT-05 e DT-08.

## DT-10

**Eliminar saltos espaciais entre missões do rover · Low · P3 · pendente.**

- **Onde:** `scene.ts: placeRover/routeFor`, fases de `mission.ts`.
- **Evidência:** transição gelo → painel deslocou o modelo aproximadamente 5,02 m em 20 ms, do processador à garagem.
- **Ajuste:** representar o reposicionamento entre entrega e preparação seguinte, mantendo continuidade do rover e da câmera; efeitos econômicos continuam exclusivos do motor.
- **Aceite/teste:** posição contínua e velocidade máxima documentada entre quadros; gelo → painel, gelo → gelo, antena → gelo, cancelamento com fila restante, pausa e retomada em 1×/4×. Sem recompensa duplicada.
- **Dependências:** DT-02.

## DT-11

**Manter painel solar montado visível até a conexão · Low · P3 · pendente.**

- **Onde:** `scene.ts: updateScene`, `base-layout.ts: updateBase`.
- **Evidência:** vaga 2 visível com 1,41 h restantes e invisível com 1,39 h, na transição operação → retorno; reaparece na conclusão.
- **Ajuste:** separar montagem visual de conexão energética e preservar a estrutura durante retorno/entrega; definir o resultado visual de cancelamento.
- **Aceite/teste:** painel não desaparece após montagem; energia só aumenta no instante previsto pelo motor. Cobrir cancelamento, radiação, repetição, limite de 12 painéis e reinício.
- **Dependências:** DT-02.

## DT-12

**Cobrir exposição acumulada nos limites 12/24 h · Low · P3 · ajuste externo parcial, cobertura pendente.**

- **Onde:** `scripts/e2e-tempestade.py`, exposição apresentada pelo habitat, `crew.ts: exposeCrew`.
- **Evidência histórica:** o teste comparou 1,6 → 1,4 como queda de exposição; o painel mostra `exposureHours % 12`. A edição externa reduziu a execução a 1× para evitar cruzar o limite, mas não valida a passagem de ciclo.
- **Ajuste:** observar exposição acumulada ou combinar o restante do ciclo com os corações perdidos por exposição; manter verificação legível ao jogador.
- **Aceite/teste:** atravessar intencionalmente 12 e 24 h, verificar dano uma única vez por ciclo e retomada do abrigo, em 1× e 4×. Não exigir monotonicidade de um valor modular.
- **Dependências:** DT-02 e DT-07.

## DT-13

**Investigar demora das ordens e tornar as fases claras · Medium · P2 · relato do autor, medição parcial.**

- **Onde:** eventos de ação em `main.ts`, `context-panel.ts`, `astronaut.ts`, cena e carregamento.
- **Linha de base:** GPU Intel Xe/Vulkan: confirmação DOM 4,9 ms; primeiro movimento 263 ms; início da inspeção 5,315 s em 1×. Preparo de 0,25 h e deslocamento de cerca de 5 h para a estufa/10 h para painéis são duração simulada; radiação pode suspender a ordem.
- **Ajuste:** medir separadamente clique → recebimento → feedback → movimento → trabalho → efeito; mostrar preparo, destino, suspensão e motivo. Investigar especificamente casos de segundos sem confirmação; não encurtar tarefas para ocultar travamento.
- **Aceite/teste:** meta de feedback até 150 ms em condições normais, com ambiente e distribuição registrados; comando recusado também responde com motivo. Cobrir clique real/toque/teclado, todos os tipos de tarefa, seleção de objetos, início frio, pausa, radiação e velocidades.
- **Limites:** uma medição não comprova P95 para todos os comandos; celular emulado não substitui dispositivo real. Registrar antes/depois se houver correção.
- **Dependências:** diagnóstico pode começar antes; DT-07/08/09 para coerência final; correlacionar com DT-14.

## DT-14

**Investigar bloqueio por compilação tardia de shaders · Medium · investigação P2 · hipótese.**

- **Onde:** `main.ts: models.then/renderer.compile/showMenu` e timeout de 9 s.
- **Indício:** compilação síncrona pode acontecer depois de o menu ficar interativo se modelos atrasarem. A amostra estável da auditoria teve mediana 16,7 ms/P95 33,3 ms e nenhum quadro >50 ms; isso não mede todo o carregamento.
- **Experimento:** atrasar GLB além de 9 s, limitar CPU, capturar long tasks, frames e latência de cliques, falhas de rede e chegada de fallback.
- **Correção condicionada:** antecipar/distribuir compilação ou ajustar transição de carregamento somente se a medição confirmar bloqueio relevante.
- **Aceite:** relatório antes/depois com ambiente e causa, ou hipótese descartada com evidência; nenhuma promessa de latência baseada só em FPS estável.
- **Dependências:** DT-13 para instrumentação.

## DT-15

**Investigar propriedade e descarte de recursos GPU substituídos · Low · investigação P3 · hipótese.**

- **Onde:** `assets.ts: attachModel`, `scene.ts: moonGroundMaterial`, `base-layout.ts: scatterRocks/buildStoredCrates`.
- **Indício:** objetos provisórios são escondidos e mapas substituídos sem descarte explícito em todos os caminhos. Dez reinícios sem crescimento não demonstram vazamento contínuo nem justificam classificá-lo como confirmado.
- **Experimento:** carregar com rede lenta para renderizar provisórios, medir antes/depois da troca, repetir ciclos longos e coleta de lixo; distinguir heap JS, geometria, textura, programa e recurso compartilhado.
- **Correção condicionada:** definir propriedade e descarte dos recursos exclusivos, preservando geometria/material/textura compartilhados por clones e caches.
- **Aceite/teste:** contadores atingem patamar estável após aquecimento; substituição/fallback não acumula recursos e não quebra outros clones. Registrar o que foi confirmado ou descartado.
- **Dependências:** DT-14 para separar efeitos de carregamento.

## DT-16

**Validar associação espacial e azimute entre Sol e horizonte LOLA · Medium · confirmada e corrigida em 15/11/2026.**

Validação: coordenadas dos três sites derivadas de LOLA e conferidas com PROJ; mesmo frame ME DE421 no rótulo e Horizons; azimute convertido por longitude. Sol ativo por site regenerado junto do céu. Peak: 411 → 433 intervalos; plano de referência: 2 → 3 corações sem mudar regras. Terreno e implantação preservados. Limites DEM/grade/altura explicitados em `data-sources.md`; evidências e testes em `EARTHSET_VALIDATION_ROADMAP.md`. Os indícios e o experimento abaixo registram a origem da investigação.

- **Onde:** `docs/data-sources.md`, pipelines `fetch_sun.py/fetch_lola.py`, tabelas e `sun.ts/terrain.ts`.
- **Indício:** efeméride de −89,5°/0° e horizonte de outro ponto; documentação já declara aproximação regional e validação independente de azimute pendente.
- **Experimento:** obter efeméride no ponto do site, conferir projeção/norte local/eixos com referências primárias e comparação independente; comparar cada intervalo de iluminação.
- **Correção condicionada:** ajustar transformação ou regenerar dados apenas se o erro for demonstrado; preservar brutos, método e proveniência. Não recalibrar ciência para manter vitória artificialmente.
- **Aceite/teste:** erro/limite quantificado, orientação verificada e diferenças das atuais 411 horas em intervalos iluminados explicadas. Se mudar dado, repetir pipelines e partidas completas.
- **Dependências:** DT-02/03 para avaliar efeitos no equilíbrio; independe das correções cosméticas.

## DT-17

**Consolidar regressões e fechar a verificação da dívida · Medium · fechamento · pendente.**

- **Onde:** testes de motor/pipeline, scripts E2E, `.github/workflows/ci.yml`, documentação e backlog.
- **Ajuste:** executar a matriz de validação na mesma revisão; incorporar regressões relevantes à automação. Definir onde E2E com GPU roda, sem presumir que o runner comum reproduz a GPU local.
- **Comandos mínimos:** `npm run typecheck`, `npm run test`, `npm run build`, `PYTHONDONTWRITEBYTECODE=1 python3 -B -m unittest discover -s data-pipeline/tests`; E2E de descoberta, contexto e tempestade contra uma porta identificada como Earthset.
- **Matriz:** três modos, partidas completas com dados reais e casos de fronteira; EN/PT; desktop e celular, além de aparelho real para conclusões sobre desempenho móvel; velocidades 1×/2×/4×, pausa, reinício e carregamento degradado.
- **Aceite:** resultados e screenshots revisados, versão/hardware registrados, sem typecheck falhando com Vitest verde. Bundle isolado não substitui o build completo. Edição externa/HMR invalida a execução afetada e exige repetição identificada.
- **Fechamento:** atualizar cada ID no backlog e memória com evidência; hipóteses podem ser descartadas com justificativa ou permanecer abertas com risco documentado. Não declarar toda a dívida resolvida apenas porque a suíte atual passou.
- **Dependências:** tarefas corrigidas e investigações escolhidas para a rodada; registrar explicitamente o que ficou fora.

## Como registrar uma verificação posterior

Para cada ID, registrar no diário: data, revisão/estado local, reprodução antes da correção, arquivos alterados, resultado esperado/observado, comandos, resultado dos testes, medições e capturas quando houver tela, risco residual e estado final. Atualizar este plano e o bloco 10 juntos. Aceitar somente evidência da versão revalidada; números desta auditoria não são metas automáticas de aprovação.
