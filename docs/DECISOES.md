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
