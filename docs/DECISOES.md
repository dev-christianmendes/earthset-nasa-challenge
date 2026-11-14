# Decisões de escopo

Registro das decisões tomadas pelo agente com delegação do autor (14/11/2026: "pode decidir"). Cada uma tem a razão e o que muda no código. Mudanças de regra de jogo (números) continuam exigindo o autor.

## D-01. Antena: aviso antecipado de tempestade (informação, sem mudar a regra)

- **Decisão:** com a antena instalada, a base recebe aviso de tempestade geomagnética **6 horas antes** de ela começar. Sem antena, a tela só mostra o clima quando ele já está acontecendo.
- **Por quê:** dá ao efeito da antena um papel real no jogo e no discurso educativo (comunicação com a Terra permite prever, não só reagir). Não altera recursos, fluxo, nem vitória/derrota, então não muda o equilíbrio já testado.
- **O que fazer:** motor: função pura que, dado o clima e a hora, diz se há tempestade nas próximas 6 h (`space-weather.ts`), com teste. UI: aviso no HUD ("Storm in 4 h") quando a antena estiver instalada. Sem antena: nenhum aviso antecipado.
- **Texto da explicação (school):** "The antenna lets the base receive space-weather warnings ahead of time."

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

## D-05. Abrigo da tripulação na radiação (regra + visual)

- **Decisão:** quando há radiação (SEP), a tripulação deve estar no habitat. Quem está fora sem abrigo acumula exposição: **1 coração a cada 6 horas de exposição** (mesma escala de perda de coração do motor). O abrigo é automático: ao aviso da antena (D-01) ou ao início da radiação, a tripulação vai para a escotilha.
- **Por quê:** dá sentido ao aviso da antena e à radiação, que hoje só para o robô.
- **Proposta a validar:** a penalidade é ilustrativa. Ajustar só com o teste de partida (`tests/engine/partida.test.ts`) passando.
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
