# Interações: astronautas, estufa, rover e instalações

Documento de arquitetura da jogabilidade interativa (D-18 e D-19). Descreve só o que existe.

## Visão geral

```
toque ou tecla → picking.ts (raycasting) → painel contextual (context-panel.ts)
   → ordem (GameAction) → dispatch (motor, valida) → novo GameState
   → advance (tempo de jogo) → cena deriva posição e animação do estado → HUD e painel redesenham
```

- **Motor** (`src/engine/`): toda regra e todo recurso. Puro, sem three.js nem DOM.
- **Cena** (`src/render/`): só desenha o estado. `picking.ts` (seleção e anel de destaque), `crop.ts` (plantas), `scene.ts` (rover e tripulação derivam posição do progresso do motor).
- **Interface** (`src/ui/context-panel.ts`): nenhuma regra. A disponibilidade de cada ação vem de uma simulação em seco (`dispatch`), então o motivo mostrado é sempre o do motor.

## Fluxo de uma ação (onde pode haver atraso)

| Etapa | Onde | Custo medido |
|---|---|---|
| Toque ou tecla | `main.ts` (`click`, `keydown`) | imediato |
| Validação | `dispatch` | microssegundos |
| Estado da missão | `GameState` novo (imutável) | microssegundos |
| Deslocamento e animação | `scene.ts`, derivados do progresso em horas de jogo | acompanham pausa e velocidade |
| Execução e recompensa | `advance` (fim da fase de trabalho) | no tempo de jogo da tarefa |
| Interface | `renderNow` a cada 100 ms e na hora da ordem | 4 a 22 ms até o estado aparecer |

Três tempos distintos: **resposta do comando** (milissegundos, meta de 150 ms), **animação** (segundos reais, derivada do progresso) e **missão simulada** (horas de jogo; 1 hora por segundo a 1×, 2× e 4× disponíveis).

## Máquina de estados dos astronautas (`src/engine/astronaut.ts`)

```
idle ─ordem→ assigned ─0,25 h→ walking ─ida→ working ─trabalho→ returning ─volta→ resting ─1 h→ idle
                 └ cancelar antes de sair: volta a idle; fora: volta pelo caminho andado (sem efeito)
qualquer estado com tarefa ─radiação ou ordem de abrigo→ sheltering (tarefa suspensa, retoma depois)
```

- Dois astronautas. Uma tarefa de cada tipo por vez. O efeito vale **uma vez**, ao fim do trabalho (antes da volta).
- Quem está fora do habitat (da saída até a volta) conta como exposto à radiação (`crew.ts`).
- Durações em horas de jogo: preparo 0,25; trecho 5 (estufa), 6 (antena) ou 10 (campo solar); descanso 1; trabalho de 2 a 5.

| Tarefa | Onde | Custo | Efeito |
|---|---|---|---|
| Inspecionar | estufa | nenhum | alivia 20 de desgaste |
| Colher | estufa | nenhum, exige cultura pronta | +10 de comida |
| Manutenção | estufa | 15 de energia, exige desgaste de 10 | zera o desgaste |
| Calibrar painéis | campo solar | 10 de energia | +12% de geração, decai em 120 h |
| Ajustar antena | antena | 5 de energia, exige antena | aviso de tempestade 12 h antes por 150 h |

## Estufa (`src/engine/greenhouse.ts`)

Cultura de 0 a 100, amadurece em 12 h com cuidado normal e estufa ligada. Irrigação e iluminação (baixa, normal, alta) trocam consumo por ritmo: crescimento ×0,8, ×1, ×1,25; água ×0,5, ×1, ×2; energia ×0,6, ×1, ×1,5. O desgaste sobe 0,25 por hora e tira até 40% da eficiência. A comida passiva (0,38 por hora) continua; a colheita é ganho extra. Números completos em `docs/regras-recursos.md`.

## Missões do rover

`ENQUEUE_TASK` (gelo, painel, antena), fila de até 4. Fases derivadas do progresso (`mission.ts`): preparo, ida, operação, volta, entrega. Ida e volta aceleram e freiam suavemente. O gelo entregue vira água no fim da tarefa (+12). Radiação ou bateria zerada suspendem a missão e o painel diz o motivo.

## Controles

| Entrada | Efeito |
|---|---|
| Toque ou clique num objeto | seleciona e abre o painel contextual |
| Teclas 1 a 9 | habitat, estufa, rover, astronauta 1 e 2, painéis, antena, processador, armazenamento |
| Arrastar, roda | gira e aproxima a câmera (arrastar não seleciona) |
| Esc | fecha o painel; sem painel, pausa; durante a introdução, pula |
| Tab, Enter | navega e aciona os botões do painel (o foco vai ao painel pelas teclas 1 a 9) |
| Botões 1×, 2×, 4× e pausa | velocidade e pausa |
| Foco, visão geral, Acompanhar | câmera pelo painel (ícone de casa = visão geral) |

Acessibilidade: o painel tem rótulo e foco visível, o aviso de ordem usa `role="status"`, o canvas descreve as teclas e há movimento reduzido nas configurações. O motivo de cada botão desabilitado fica escrito no próprio botão.

## Testes

| Camada | Comando | O que cobre |
|---|---|---|
| Motor (Vitest) | `npm run test` | 163 testes: regras puras, ordens válidas e inválidas, recursos insuficientes, ocupado, cancelamento, conclusão e recompensa, abrigo, pausa, velocidade (passos de 0,25, 1 e 4 h dão o mesmo resultado), limites da fila, partidas completas de 708 h, invariantes com ações aleatórias (semente fixa) e determinismo |
| Interface (Playwright, Python) | `npx vite --port 5182 --strictPort &` e `python3 scripts/e2e-contexto.py` | 38 verificações em Chromium com GPU real: seleção por toque e por teclado, ordens, progresso, cancelamento, missões do rover, os cinco objetos da base, pausa, repetição de ordens (heap e FPS), celular sem clique fantasma e sem rolagem horizontal |

## Desempenho (Chromium com GPU real, Intel Xe)

| Medida | Antes (P0) | Depois (P4) |
|---|---|---|
| FPS na visão geral (dev) | 54 a 56 | 57 a 59 |
| Draw calls na visão geral | 285 | 286 |
| Comando até o estado aparecer | 6 ms | 4 a 22 ms |
| Heap em ordens repetidas a 4× | 54 a 58 MB estável | 54 MB estável |
| Build de produção, menu visível | 0,67 s | sem mudança relevante |
| CPU 4× mais lenta, missão | 47,8 fps | não repetido |

As medições em SwiftShader (software) feitas no início não valem: rodam a 1 a 5 fps.

## Problemas conhecidos e limitações

- A base passiva perde perto da hora 117 em modo de teste; os testes de interface usam poucas ordens por isso.
- O rover segue rota fixa, sem desviar de obstáculos. O painel antigo do rover continua existindo (duas portas para as mesmas missões).
- Em jogo, o astronauta que vai ao campo solar ou à antena anda fora do enquadramento padrão da câmera; "Focar" acompanha.
- A calibração vale para o campo solar inteiro, sem escolher painel.
- O ajudante do rover na missão de gelo é decorativo (a regra de ajuda continua no motor, sem seleção).
- O JS de produção tem cerca de 920 KB (three.js inteiro) e o carregamento inicial tem long tasks de 80 a 150 ms; sem divisão de pacote.
- O gancho `window.__earthset` existe só em `npm run dev`, para os testes de interface.
