# Arquitetura de renderização

> **Atenção (15/11/2026):** documento de 14/11. A separação em camadas continua válida. Sombras, céu, Sol e Terra mudaram em 15/11: ver `docs/EARTHSET_VALIDATION_ROADMAP.md` e `docs/PROJECT_STATUS.md`.

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


## Escopo v3 (14/11/2026): renderização cinematográfica

Direção: Cinematic Scientific Sci-Fi (D-11). Orçamento: D-14.

- **Sol:** disco brilhante na direção calculada (azimute e elevação da tabela). Visível quando acima do horizonte do morro; atenuado abaixo. Não há trajetória solar inventada.
- **Luz:** direcional do Sol com sombras duras (mapa de 2048 px, só para objetos grandes); preenchimento frio; luz de cultivo na estufa; farol do robô.
- **Exposição:** tone mapping ACES com exposição fixa (sem variação por quadro).
- **Materiais:** não metálicos para tecido e plástico; metálicos só com mapa de ambiente. Modelos externos chegam com metalness 1 e precisam ser ajustados ao carregar.
- **Instanciamento:** pedras e módulos repetidos.
- **LOD:** objetos pequenos e distantes com menos triângulos (P1).
- **Pré-compilação:** `renderer.compile` após carregar os modelos (já implementado).
- **Medição:** `?perf=1` mostra FPS, chamadas de desenho e triângulos.
- **Apresentação fora do motor:** o relógio visual só avança com a partida ativa e não pausada (já implementado).
