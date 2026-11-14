# Regras de recursos (B1)

Origem: regras de trabalho anterior do autor. **Foram reescritas no código deste projeto**; nenhum código foi copiado. Todos os números são **ajustáveis** e estão em `src/engine/resources.ts`.

## Recursos por hora

| Recurso | Regra |
|---|---|
| Energia | `+ 0,9 × painéis (só com Sol) − (0,8 base + aquecimento + estufa 1,0 + eletrólise 0,6)` |
| Ar | `−1 × fator da patente`; `+2` com a eletrólise ligada |
| Água | `−0,2 × fator` − estufa `0,08` − eletrólise `0,4` |
| Comida | `−0,2 × fator` + `0,38` com a estufa ligada e água acima de zero |

Aquecimento por hora (com Sol / sem Sol): morro 0,5 / 1,3; encosta 0,3 / 0,7; borda 0,2 / 0,5.

Fator da patente: cadete 0,75 · explorador 1 · comandante 1,15.

## Equipamentos automáticos

| Equipamento | Liga quando |
|---|---|
| Estufa, modo **sempre** | bateria acima de 10% |
| Estufa, modo **só com sobra** | bateria acima de 50% |
| Eletrólise | ar abaixo de 90, com água acima de zero e bateria acima de 5% |
| Modo economia | bateria abaixo de 40%: estufa desligada; eletrólise só com ar abaixo de 40 |

## Início, limites e corações

- Início: bateria em 80% da capacidade (100), ar 80, água 50, comida 40. Ar, água e comida vão de 0 a 100; bateria de 0 até a capacidade.
- 3 corações. Perde 1 a cada 6 horas seguidas com energia, ar, água ou comida zerados.
- **Frio (B1.5):** sem energia, a base esfria. A perda de coração por bateria zerada é o frio: não há temperatura separada nesta versão. Teste em `tests/engine/game.test.ts`.
- Derrota quando os corações chegam a zero. Vitória: chegar a 708 horas com pelo menos 1 coração.

## Robô (B1.4, feito)

Implementado em `src/engine/robot.ts`. Números ajustáveis.

| Item | Regra |
|---|---|
| Fila | Até 4 tarefas, executadas na ordem. O tempo que sobra num passo vai para a próxima. |
| Gelo | 6 h por viagem; `+12` de água ao concluir (teto 100). |
| Painel | 4 h; `+1` painel ao concluir. Até 12 painéis, contando os da fila. |
| Antena | 8 h; uma só. Marca `antennaInstalled`. Com a antena, o HUD avisa quando há tempestade nas próximas 6 h (D-01); sem antena, só mostra o clima atual. Não muda recursos. |
| Consumo | `+1,0` de energia por hora **enquanto trabalha**. Não trabalha com bateria zerada. |

**Simplificação:** o consumo e o trabalho são calculados por passo de tempo. Se uma tarefa termina no meio do passo, o efeito vale só no fim do passo. Com passos de 1 h (testes) ou de frações de hora (tela), o erro é pequeno.

**Equilíbrio com o Sol real (B2.3, 14/11/2026):** a partida da tela usa o Sol medido (JPL Horizons, a partir de 09/10/2024 às 09:00 UTC), o horizonte do morro (LOLA) e o clima do DONKI. Capacidade da bateria **1000** (antes 1200, valor que dava vitória com folga demais). Resultados do plano de referência (painéis, gelo e antena, estufa "só com sobra"), no morro:

| Capacidade | Resultado do plano | Bateria mínima |
|---|---|---|
| 950 | perde na noite (hora ~665) | 0 |
| 1000 | vence com **2 corações** | 0 (por algumas horas) |
| 1050 | vence com 3 | 6 |
| 1100 | vence com 3 | 45 |

A base passiva perde por volta da hora 117 com qualquer capacidade. O ponto de virada (950 para 1000) é estreito: é uma escolha de jogo, não um dado. Trava em `tests/engine/partida.test.ts` (2 corações com o plano de referência). Os testes de partida passam o clima real (antes passavam clima calmo, o que escondia esse efeito).

## O que ainda não existe (fica para depois)

- **Bateria da carga e painéis iniciais da preparação** (escolhidos hoje na tela, não na preparação).
- **Tempestades, radiação e abrigo** (dose por hora, cobertura de regolito).
- **Patentes** (o fator de consumo já existe; textos e números de tela não).


## Estufa e astronautas (D-18, 14/11/2026)

| Item | Regra |
|---|---|
| Crescimento | `100 / 12 h × irrigação × iluminação × eficiência`, só com a estufa ligada; para em 100 |
| Estágios | muda (abaixo de 34), planta desenvolvida, pronta (100) |
| Irrigação (baixa, normal, alta) | crescimento ×0,8, ×1, ×1,25; água da estufa ×0,5, ×1, ×2 (base 0,08 por hora) |
| Iluminação (baixa, normal, alta) | crescimento ×0,8, ×1, ×1,25; energia da estufa ×0,6, ×1, ×1,5 (base 1,0 por hora) |
| Desgaste | +0,25 por hora ligada; eficiência = 1 − 0,4 × desgaste/100 |
| Colheita | exige 100 de crescimento; +10 de comida ao fim do trabalho; o cultivo recomeça |
| Manutenção | exige desgaste de 10 ou mais; custa 15 de energia na hora da ordem; zera o desgaste |
| Inspeção | sem custo; alivia 20 de desgaste |
| Tarefa | preparo 0,25 h, ida 5 h, trabalho (2, 3 ou 5 h), volta 5 h, descanso 1 h |
| Limites | uma tarefa de cada tipo por vez; um astronauta livre (sem tarefa e descansado) |
| Radiação ou abrigo | a tarefa fica suspensa; quem está fora conta como exposto (`crew.ts`) |

A comida passiva da estufa (0,38 por hora, acima) continua. A colheita é um ganho adicional que depende do jogador.
