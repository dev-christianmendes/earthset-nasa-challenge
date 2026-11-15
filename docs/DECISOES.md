# Decisões de escopo

Registro das decisões tomadas pelo agente com delegação do autor (14/11/2026: "pode decidir"). Cada uma tem a razão e o que muda no código. Mudanças de regra de jogo (números) continuam exigindo o autor.

## D-01. Antena: aviso antecipado de tempestade (informação, sem mudar a regra)

- **Decisão:** com a antena instalada, a base recebe aviso de tempestade geomagnética **6 horas antes** de ela começar. Sem antena, a tela só mostra o clima quando ele já está acontecendo.
- **Por quê:** dá ao efeito da antena um papel real no jogo e no discurso educativo (comunicação com a Terra permite prever, não só reagir). Não altera recursos, fluxo, nem vitória/derrota, então não muda o equilíbrio já testado.
- **O que fazer:** motor: função pura que, dado o clima e a hora, diz se há tempestade nas próximas 6 h (`space-weather.ts`), com teste. UI: aviso no HUD ("Storm in 4 h") quando a antena estiver instalada. Sem antena: nenhum aviso antecipado.
- **Texto da explicação (school):** "The antenna lets the base receive space-weather warnings ahead of time."

> **Emenda 2 (14/11/2026):** o aviso fixo de 6 h foi substituído pelos estados de alerta de `src/engine/alert.ts`. O alcance da antena (6 h, 12 h com ajuste) virou o quanto antes do SEP uma erupção ou CME registrada ainda conta como MONITORAMENTO. Os dados mostram erupção→SEP de 1,6 h a 50 h, então não há "tempo restante".
>
> **Emenda (14/11/2026, autor):** o aviso da antena passou a ser de **início de radiação de partículas solares** (SEP), e não de tempestade geomagnética. O Kp é da Terra e deixou de afetar o jogo (os painéis não perdem mais 10% por nível G). O aviso de 6 h (12 h com o ajuste) continua sendo uma **regra simplificada de jogo**, não uma previsão real; a P3 do plano v5 (`docs/ORIENTACOES_AUDITORIA_V5.md`) vai redesenhar os alertas com base nos dados da DONKI.

## D-02. Astronautas: sem tarefas de jogo

- **Decisão:** os astronautas são tripulação visual. Não coletam, não consertam, não têm recurso próprio. Continuam andando conforme o estado (estufa, ajuda ao robô).
- **Por quê:** tarefas novas mexem na regra do motor e no equilíbrio, que já está testado. Escopo deste prazo é visual e fidelidade, não mecânica nova.

## D-03. Câmera: botão "Seguir robô" (opcional, baixa prioridade)

- **Decisão:** aceito como item opcional e visual. Um botão alterna entre "Visão da base" e "Seguir robô": o alvo da órbita acompanha o rover, com transição suave. Sem seguir, a câmera continua na base.
- **Por quê:** ajuda a ver a viagem do rover (que é o principal erro de fidelidade já corrigido). Não afeta o motor.

## D-04. Mantidos sem mudança

- Capacidade da bateria: 1000. Tempos de tarefa, limiares de alerta, regras de estufa: como estão.
- Idioma padrão: inglês, com botão para português.
- Push e envio: **não** são decididos pelo agente. Só com pedido explícito do autor.
- Site inicial: morro.

## Ordem sugerida para a próxima IA

1. T1 (articulação dos braços).
2. D-01 (antena: motor + teste + aviso).
3. T3 (marcador do gelo), T5 (transição de instalação).
4. D-03 (seguir robô).
5. T6, T7, T9 (texto, pausa, desempenho).

## D-05. Abrigo da tripulação na radiação (regra + visual) — **implementada (T14)**

Implementação: `src/engine/crew.ts`, ligada em `advance` (`src/engine/game.ts`). Quem está fora por atividade (estufa ligada; robô trabalhando) leva 1 hora para entrar quando a radiação começa; essa hora conta como exposição. A soma das exposições dos dois astronautas, a cada 12 h, tira 1 coração. Testes em `tests/engine/crew.test.ts`. Na cena, a tripulação corre para a escotilha durante a radiação.

- **Decisão (penalidade definida pelo autor delegando, 14/11/2026):** durante a radiação, cada hora que um astronauta passa fora do habitat conta como exposição. A cada **12 horas** de exposição acumulada, perde **1 coração**. O abrigo é automático: ao início da radiação (ou ao aviso da antena, D-01), o astronauta corre para a escotilha. Se estava no local de uma tarefa, a exposição começa quando ele sai e termina quando entra.
- **Por que 12 horas e não 6:** a regra de 6 horas do motor é para recursos zerados (falta contínua). A radiação é um evento pontual. Com 6 horas, um evento poderia custar um coração inteiro; o cenário tem 82 horas de radiação.
- **Custo esperado:** com abrigo automático, cada evento custa ~1 h de exposição por astronauta (baixo). Ficar fora o tempo todo durante a radiação custa muito: é a escolha que o jogador deve evitar.
- **Validação:** o plano de referência (`tests/engine/partida.test.ts`) não deixa a tripulação exposta e tem de continuar vencendo com 2 corações. Se a penalidade mudar esse resultado, o valor é revisto antes do commit.
- **Por quê:** dá sentido ao aviso da antena e à radiação, que hoje só para o robô.
- **Motor:** estado de posição da tripulação (dentro/fora) e exposição acumulada; regra de coração nova, com testes.

## D-06. Astronauta ajuda o gelo

- **Decisão:** a tarefa de gelo dura **4 horas** quando um astronauta está livre no local, e **6 horas** sem ajuda (valor atual). A ajuda é automática: se a tripulação estiver livre (não abrigada), ajuda.
- **Motor:** duração da tarefa depende da ajuda disponível. Testes com e sem ajuda.

## D-07. Astronauta colhe na estufa

- **Decisão:** com a estufa ligada, um astronauta colhe **+10 de comida** a cada **12 horas**, até 100. Automático.
- **Motor:** evento de colheita dentro do fluxo por hora, com teste.

## D-08. Reações visuais (sem regra)

- Acenam ao receber o aviso da antena; correm para a escotilha no início da radiação; trabalham na estufa quando ela colhe; param ao lado do rover quando ele trabalha (já existe).
- Nenhuma regra nova. Só cena.

## Ordem de implementação

1. D-08 (visual, sem risco).
2. D-06 (gelo com ajuda).
3. D-07 (colheita).
4. D-05 (abrigo e exposição, o mais complexo, por último).

## D-09. Nível visual: trabalho de arte, no plano

- **Decisão (autor, 14/11/2026):** o nível visual da cena deve chegar ao padrão de arte (referência: Astroneer, sem copiar identidade ou ativos). Isso é trabalho de arte, não só de código: entra como tarefas T15 a T18 em `docs/PLANO_PARA_AGENTE.md`.
- **Modelos atuais:** são geometria procedural de primeira versão, gerada por `assets-src/blender/build_assets.py`. Não são o padrão final.
- **Fonte:** o trabalho de arte é feito no Blender, pelo script do projeto, ou com ativo externo licenciado e registrado em `docs/ART_ASSET_PIPELINE.md`. Nada de imagem ou modelo gerado por IA.

## D-10. Ativos externos licenciados (política)

- **Decisão (autor, 14/11/2026):** o projeto pode usar modelos e texturas de terceiros, desde que a licença seja verificada na fonte, seja compatível com a entrega (de preferência CC0) e esteja registrada em `docs/ART_ASSET_PIPELINE.md`.
- **Aplicado:** superfície lunar "Moon Dusted 01" (Poly Haven, CC0) no chão. A primeira escolha, "Moon Footprints 01", foi removida: tinha pegadas em toda a superfície, o que poluía o visual.
- **Aplicado (autor pediu implementar):** astronauta de baixo polígono (OpenGameArt, CC0), com animação de repouso e de corrida, no lugar do astronauta primitivo. Qualidade cartunesca, aceita como primeira versão externa.
- **Candidato para o habitat:** Space Station Kit da Kenney (CC0). Download manual pelo autor (ver `docs/ART_ASSET_PIPELINE.md`).
- **Não aplicado:** efeitos visuais (tempestade, radiação, painel polar) continuam procedurais, porque a fonte externa não resolve nada aqui. Pedras e crateras decorativas (ex.: Poly Haven "Moon Meteor 01", CC0, a verificar) ficam para uma próxima etapa.

## D-11. Nova direção visual: Cinematic Scientific Sci-Fi (substitui D-09 e a direção "Astroneer" de VISUAL_DIRECTION)

- **Decisão (autor, 14/11/2026):** a direção visual passa a ser **Cinematic Scientific Sci-Fi**: traje realista com visor espelhado, habitat técnico cinza-metálico, regolito com textura real, iluminação de contraste alto com sombras duras, câmera cinematográfica e HUD técnico com dados.
- **Superado:** a direção "Stylized Lunar Exploration"/Astroneer (VISUAL_DIRECTION anterior) e a decisão D-09 (arte com base procedural). Os ativos já integrados (superfície CC0, astronauta CC0 e os GLB procedurais) continuam válidos até serem trocados pelos novos.
- **Por quê:** credibilidade científica para a banca (critério Validity e Relevance) e coerência com os dados reais já integrados.
- **Risco declarado:** é a direção mais exigente em modelos. O prazo (15/11, 23h59) não cobre tudo; o plano define um corte (ver `docs/PLANO_CONSOLIDADO.md`, seção P0/P1/P2).
- **Regra:** o motor não muda. Toda a mudança visual fica em `src/render/` e `src/ui/`.

## D-12. LUMA: guia por regras, sem modelo de IA em tempo de jogo

- **Decisão:** LUMA (assistente que guia o jogador) é implementada por regras (`src/engine/guide.ts`), que escolhe a dica mais urgente a partir do estado. Sem chamada a modelo de linguagem durante o jogo.
- **Por quê:** uma chave de API num jogo estático fica exposta; modelos gratuitos têm limite de uso e podem falhar justamente na apresentação. Um modelo pode ser plugado depois, por cima dessa camada, sem mudar o motor.
- **Consequência:** a declaração de IA (`AI_DISCLOSURE.md`) precisa dizer que a LUMA não usa IA generativa nesta versão, e que a versão futura, se houver, será declarada.

## D-13. Objetivos da missão e ordem da tripulação

- **Objetivos (`src/engine/objectives.ts`):** instalar 4 painéis; manter água em 70 ou mais; instalar a antena; chegar à hora 100 vivo. Derivados do estado, sem histórico.
- **Ordem da tripulação (`crewOrder`, `SET_CREW_ORDER`):** `auto` (trabalha) ou `shelter` (abriga). Abrigada, a tripulação não ajuda o gelo, não colhe e não se expõe à radiação. É a escolha de jogo que dá sentido aos recursos humanos.
- **Briefing:** tela antes da partida com missão, controles e botão "Começar missão".

## D-14. Processamento: orçamento de desempenho

- Limite de densidade de pixels em 1,5.
- Sem `backdrop-filter` sobre o canvas (custo alto a cada quadro).
- Shaders pré-compilados após o carregamento dos modelos.
- Medição com `?perf=1` (FPS, chamadas de desenho, triângulos) em qualquer máquina.
- Orçamento por quadro (desktop médio): até 150 mil triângulos e 200 chamadas de desenho; celular: metade disso (valores a validar com a medição).
- Modelos: GLB até ~300 KB cada, texturas de 1K, sombras só para objetos grandes.

## D-15. Fontes de ativos (política atualizada)

- **Permitidas:** NASA 3D Resources (domínio público segundo as diretrizes de mídia da NASA), Kenney (CC0), Quaternius (CC0), Poly Haven (CC0), e Poly Pizza só com licença verificada por modelo (CC0 preferível; CC-BY com atribuição registrada).
- **Proibido:** qualquer logotipo, emblema ou identificador da NASA; modelo com licença incerta; imagem gerada por IA como ativo.
- **Atribuição:** cada modelo entra no registro de `docs/ART_ASSET_PIPELINE.md` com origem, autor, licença e data de verificação. Créditos que citem terceiros são conferidos antes do uso.

## D-16. Earthset 4.0: reformulação da experiência (14/11/2026, noite)

Pedido do autor: tela inicial própria, modos de experiência, história "Operação Último Horizonte" em 5 capítulos, introdução animada pulável, HUD de jogo (barra superior, ferramentas embaixo, painel lateral recolhível), base composta por áreas, modelos novos (externos CC0 + Blender), missão de gelo com fases visuais e LUMA contextual. Plano e aceite em `docs/PLANO_V4.md`, que passa a valer no lugar da ordem de `docs/PLANO_CONSOLIDADO.md`. Mantidas as regras de motor puro, dados reais, LUMA por regras e ativos licenciados.

## D-17. Modos de experiência usam as patentes já testadas do motor

Explorador → `rank: 'cadete'` (× 0,75), Cadete Lunar → `rank: 'explorador'` (× 1,0), Comandante → `rank: 'comandante'` (× 1,15). Nenhum dado científico muda; a diferença é o fator de consumo (já existente) e a apresentação (quantidade de dicas da LUMA, explicações, HUD técnico). Testes de partida completa cobrem os três modos.


## D-18. Astronautas com tarefas reais e estufa jogável (14/11/2026, noite)

- **Decisão:** a colheita deixa de ser automática (D-07). Cada astronauta é uma máquina de estados no motor (`src/engine/astronaut.ts`): `idle → assigned → walking → working → returning → resting → idle`, com `sheltering` na radiação ou na ordem de abrigo (a tarefa fica suspensa e retoma depois). A estufa tem cultivo próprio (`src/engine/greenhouse.ts`): crescimento 0 a 100, desgaste, irrigação e iluminação em três níveis.
- **Tempo:** as durações são horas de **jogo** (preparo 0,25, cada trecho 5, descanso 1; trabalho: inspeção 2, colheita 3, manutenção 5). A cena deriva posição e animação do progresso, então a tripulação acompanha pausa e velocidade (antes andava em tempo real, a 1,4 m/s).
- **Regras (ilustrativas, equilíbrio, não dado científico):** a cultura amadurece em 12 h com cuidado normal; irrigação e iluminação altas crescem ×1,25 e gastam ×2 de água e ×1,5 de energia (baixa: ×0,8, ×0,5 e ×0,6); desgaste sobe 0,25 por hora de estufa ligada e tira até 40% da eficiência; colher dá +10 de comida; manutenção custa 15 de energia e zera o desgaste; inspeção alivia 20 de desgaste.
- **Motivo da mudança de equilíbrio:** a colheita automática (+10 a cada 12 h) tornava a comida irrelevante e tirava a decisão do jogador. A comida passiva (0,38 por hora) continua, então ninguém passa fome por esquecer. O teste de partida de referência continua com 2 corações; com manutenção por bot a partida ainda vence (1 coração), porque os 15 de energia pesam no equilíbrio apertado: a decisão de gastar energia é real.
- **Interação:** tocar num objeto da cena abre o painel contextual (`src/ui/context-panel.ts`, seleção em `src/render/picking.ts`). A disponibilidade de cada ação vem de uma simulação em seco no motor (`dispatch`), então o motivo mostrado é sempre o do motor.

## D-19. Instalações com decisões próprias (14/11/2026, noite)

- **Decisão:** painéis solares, antena, habitat, processador de gelo e armazenamento passam a abrir o painel contextual. Duas tarefas novas de astronauta (`src/engine/facilities.ts`): **calibrar painéis** (+12% de geração que decai linearmente em 120 h; custa 10 de energia; ida de 10 h porque o campo solar é o destino mais longe) e **ajustar a antena** (aviso de tempestade 12 h antes em vez de 6 h, por 150 h; custa 5 de energia; exige antena instalada). Só se repetem quando o efeito caiu abaixo da metade.
- **Decisões reais:** (a) a hora da calibração importa: o equilíbrio de referência é apertado (a bateria quase zera perto da hora 650), então calibrar na noite longa só gasta energia e a base perde (teste de partida); calibrar com Sol vence. (b) o ajuste da antena troca energia e uma saída de astronauta por tempo de reação a tempestades, que justifica abrigar a tripulação mais cedo. (c) o habitat expõe a ordem de abrigo (`SET_CREW_ORDER`) junto de consumo por hora e exposição; (d) o processador e a antena sem instalar oferecem a missão do rover correspondente; (e) o armazenamento mostra estoques, capacidade e quanto cada um dura no ritmo atual.
- **Sem mudança de equilíbrio base:** sem ordens, os novos campos ficam em zero e o plano de referência continua com 2 corações.

## D-20. Locomoção crível da tripulação e trajetos dimensionados pela rota (15/11/2026, noite)

- **Problema:** com trechos de 1 h de jogo (1 s em 1×), o astronauta cruzava rotas de 8 a 23 m a 8–12 m/s (mais de 40 m/s em 4×). Além disso, durante a ida e a volta a cena não movia o modelo (só a posição interna), que ficava parado e depois saltava ao posto; as rotas atravessavam a torre de luz norte e um posto da estufa ficava dentro do domo.
- **Decisão do autor:** aumentar os trechos para caber um passo lunar de ~2 m/s em 1×. Valores pela rota real (`src/render/crew-nav.ts`) a ~1,8 m/s: estufa 6,5 h, antena 7 h, campo solar 11 h por trecho. 2× e 4× continuam como avanço rápido (time-lapse).
- **Arquitetura:** o motor só diz a fase e a fração da tarefa. A cena separa navegação (grafo de visibilidade em volta das pegadas, curvas arredondadas, porta da câmara), locomoção (aceleração limitada, chegada desacelerada, giro amortecido, inclinação) e animação (um mixer por astronauta; caminhada e corrida com tempo controlado pela fase da passada, pé apoiado sem deslizar; voo balístico na gravidade lunar; poses com transição e pesos que somam 1).
- **Equilíbrio:** as tarefas ficam mais longas e o tempo exposto à radiação cresce. Os 239 testes de motor, inclusive as partidas completas, continuam passando sem outros ajustes.

## D-21. Auditoria integrada: espera explicada, câmera sem obstrução, instalação persistente, extração fundamentada e som (15/11/2026, noite)

- **Gargalo das tarefas:** medido pela interface real. A confirmação aparece em ≤ 5 ms, o astronauta vira em 15–221 ms e sai em 565–771 ms (fronteira de 0,25 h, DT-02, e preparo de 0,25 h), sem quadros acima de 17 ms. O atraso de segundos reproduzido é o **evento de radiação histórico das horas 0 a 24** (DONKI): uma ordem dada no começo fica parada, e a tela dizia "6 s em 1×" sem contar a espera. **Decisão:** não mudar dado nem regra; o aviso e o painel passam a dizer por que a tarefa espera e quanto falta.
- **Câmera:** o acompanhamento só transladava a câmera e atravessava o habitat. Agora aproxima, ou sobe e olha por cima, quando uma estrutura tapa o alvo, usando as pegadas da navegação com altura (sem raycast em malhas) e nunca desce abaixo do relevo. Com acompanhamento ligado, uma ordem não troca a câmera para o local.
- **Painéis:** o painel em montagem sumia na volta do rover (DT-11). Agora fica montado e apagado até o motor contar o painel; os cabos do campo solar existem só para painéis montados (tronco por coluna e um ramal por painel).
- **Extração de água:** a carga deixou de ser um bloco de gelo azul e virou regolito com gelo; pilha de material escavado fica no local; o processador aquece na descarga. A tela diz que o aquecimento com armadilha fria é ideia testada em laboratório, ainda não usada na Lua. Números do motor sem mudança. Fontes em `docs/data-sources.md`.
- **Som:** sintetizado com Web Audio, sem arquivos (nada a licenciar). Estilizado e declarado como rádio, traje e estrutura, não som do ambiente lunar.
- **Celular deitado:** a LUMA cobria Base, Rover e Tripulação; a barra passa a coluna à esquerda.

