# Arquitetura de renderização

Status: descreve o que existe hoje e o que está sendo implementado.

## Camadas (regra do projeto)
- `src/engine/`: simulação pura, sem Three.js e sem DOM. Dona de recursos, Sol, horizonte, clima, robô, partida.
- `src/render/`: cena Three.js. **Lê** o estado; não recalcula regra científica nem de jogo.
- `src/ui/`: HUD em DOM. Lê o estado e envia ações validadas pelo motor.
- `src/data/`: tabelas geradas por `data-pipeline/` (Python).

## Laço de quadros
- `frame()` em `src/main.ts`: avança o motor pelo tempo real, atualiza a cena e renderiza.
- O HUD **não** deve ser redesenhado a cada quadro. Atualização limitada a intervalo fixo, e a fila do robô só é reconstruída quando muda. (Implementado nesta etapa.)

## Câmera
- Controle orbital do Three.js (`OrbitControls`), com amortecimento, limites de distância e de inclinação.
- Enquadramento inicial e tamanho de tela (`frameForViewport`) continuam em `src/render/scene.ts`.
- Botão "Visão da base" restaura a câmera padrão.

## Luz e Sol
- Luz direcional na posição do Sol (`sampleAt` da tabela). Luz ambiente mais forte com Sol, mais fraca sem.
- Sombras longas são resultado da geometria real do relevo e da elevação do Sol.

## Animação
- Animações são consequência do estado do motor: o rover vai ao local da tarefa da frente da fila (0 a 35% do tempo da tarefa), trabalha no local (35 a 65%) e volta (65 a 100%); rodas giram só ao deslocar; farol pisca ao trabalhar e fica vermelho na radiação. O motor não modela viagem; o trajeto é a parte visual do tempo da tarefa (`placeRover` em `src/render/scene.ts`).
- Nenhuma animação decide resultado de jogo.

## Desempenho
- Sombras com mapa de 2048 px.
- Geometrias e materiais compartilhados.
- Medição de quadros: **não medido ainda** neste ambiente (headless com SwiftShader não representa uma máquina real).

## Limites conhecidos
- Sem gerenciador de ativos externos: nenhum GLB carregado ainda.
- Sem sistema de partículas.
