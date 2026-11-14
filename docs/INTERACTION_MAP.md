# Mapa de interações: cada componente

Status: **14/11/2026**, após o movimento do rover ligado à fila do motor e a tela inicial. Cada linha diz o que o jogador faz, o que o motor muda, o que a cena mostra e o que falta. "Lacuna" é o que ainda não existe; não conta como feito.

Convenção: "motor" = `src/engine/`, "cena" = `src/render/`, "HUD" = `src/ui/`.

## Recursos

| Componente | O jogador faz | Motor muda | Cena / HUD mostra | Lacunas |
|---|---|---|---|---|
| Bateria | nada direto; depende de painéis, estufa, robô | `vitals.battery` (fonte: Sol e painéis; consumo: base, aquecimento, estufa, eletrólise, robô) | barra âmbar no HUD; alerta abaixo de 20% | sem efeito na base quando zera (a base não esfria visualmente) |
| Ar | nada direto | `vitals.air`; eletrólise liga abaixo de 90 | barra azul-teal; alerta abaixo de 30 | nenhum efeito visual na base |
| Água | pede **Gelo** ao robô | `+12` por tarefa de gelo; estufa e eletrólise gastam | barra azul; alerta abaixo de 20 | — |
| Comida | seleciona o modo da **estufa** | `+0,38/h` com estufa ligada e água > 0 | barra verde; alerta abaixo de 20 | estufa não mostra quando produz (sem plantas, sem brilho) |

## Equipamentos

| Componente | O jogador faz | Motor muda | Cena mostra | Lacunas |
|---|---|---|---|---|
| Painéis solares | pede **Painel** ao robô | `installation.panels +1` após 4 h de tarefa; máximo 12 | unidade em suporte aparece na cena; geração depende do Sol real | sem animação de instalação; painel não gira para o Sol |
| Antena | pede **Antena** ao robô | `robot.antennaInstalled` após 8 h | antena aparece no teto do habitat | **sem efeito no jogo** (o motor ainda não usa a antena); sem animação de ativação |
| Estufa | escolhe modo: desligada, sempre ligada, só com sobra | liga conforme a bateria | cúpula translúcida aparece quando ligada no modo ≠ desligada | o modo não muda a aparência |
| Habitat | nada (é a base) | nenhum direto; é o ponto de referência | modelo GLB; escotilha e janelas | janelas não acendem; sem tripulação |
| Sol | nada (escolhe o local, fixo: morro) | sol da tabela JPL, horizonte LOLA | luz direcional, sombras, painel polar | — |

## Robô (rover)

| Componente | O jogador faz | Motor muda | Cena mostra | Lacunas |
|---|---|---|---|---|
| Fila do robô | pede Gelo, Painel ou Antena; cancela com × (até 4 tarefas) | fila; progresso da tarefa da frente (`hoursLeft`) | fila no HUD, com horas restantes | — |
| Deslocamento | nada (é automático) | nenhum direto; o motor não modela viagem | **novo:** sai da base até o local da tarefa (0 a 35% da tarefa), trabalha no local (35 a 65%), volta à base (65 a 100%) | o tempo de viagem é a parte visual do tempo da tarefa, não um cálculo de distância |
| Trabalho no local | nada | consome 1,0 de energia por hora trabalhada; sem bateria, para | farol pisca; rodas param | sem animação de coleta de gelo nem de instalação |
| Radiação | nada | para o robô enquanto durar | farol vermelho; HUD diz "robô parado" | o rover fica parado no local, sem indicação de abrigo |
| Cancelar tarefa | × na fila | remove a tarefa | fila atualiza; o rover **volta à base caminhando** a 4 m/s (corrigido) | — |
| Base sem tarefa | nada | fila vazia | rover parado na base, farol apagado | — |
| Tripulação (2 astronautas) | nada (são automáticos) | a estufa ligada vem de `isGreenhouseOn` (motor); o astronauta da estufa cuida dela quando ligada; o outro vai ao local da tarefa quando o rover trabalha | caminham, balançam braços e pernas ao andar | sem tarefas próprias (coleta, reparo); sem nome nem função na tela |

## Itens de missão

| Componente | O jogador faz | Motor muda | Cena mostra | Lacunas |
|---|---|---|---|---|
| Gelo (local do gelo) | pede Gelo | tarefa de gelo; +12 de água | marcador azul no local, enquanto houver tarefa de gelo na fila | **não verificado visualmente** nesta etapa (não apareceu na captura); local ilustrativo: o gelo não é medido no recorte |
| Painel (local dos painéis) | pede Painel | +1 painel | o rover vai ao local perto dos painéis | sem marcador próprio |
| Antena (local da antena) | pede Antena | antena instalada | o rover vai ao local perto da base | sem marcador próprio |

## Clima espacial

| Componente | O jogador faz | Motor muda | Cena / HUD mostra | Lacunas |
|---|---|---|---|---|
| Tempestade G | nada | fator de geração dos painéis cai 10% por nível G | painéis escurecem; texto do clima vermelho no HUD | sem alerta forte na tela |
| Radiação (partículas solares) | nada | robô não trabalha enquanto durar | farol vermelho; "robô parado" | — |

## Interface e fluxo

| Componente | O jogador faz | Motor muda | Mostra | Lacunas |
|---|---|---|---|---|
| Tela inicial | "Nova missão", idioma, créditos | nada; a simulação começa no botão | título, tagline, créditos | — |
| Visão da base | botão "Visão da base" | nada | volta à câmera padrão | — |
| Câmera | arrasta, roda ou pinça | nada | órbita limitada | **não verificado** com mouse real; sem seguir o rover |
| Corações | nada | perde 1 a cada 6 h com zero | ♥ no HUD | sem efeito visual |
| Fim de partida | nada | vitória às 708 h com ≥1 coração; derrota com 0 | sobreposição com resumo | sem animação; sem causa detalhada |
| Pausa | botão Pausar ou Esc | a simulação para (nada muda no motor) | sobreposição: continuar, controles, menu principal | — |
| Modo escola e idioma | caixa e botão | nada | textos e explicações | captura do modo escola em inglês ainda pendente |

## Bugs e lacunas que a fidelidade exige (prioridade)

1. Antena instalada não tem efeito no jogo.
2. Marcador do gelo não verificado na tela (fica sobreposto ao rover no local).
3. Sem itens coletáveis de verdade; o gelo é só uma tarefa.
4. Astronautas sem tarefas próprias (coleta, reparo) e sem nome.
5. Sem animação de implantação do painel e da antena.
