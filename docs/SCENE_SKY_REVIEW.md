# Revisão da visibilidade do céu e diagnóstico da fluidez solar

15/11/2026. Solicitação: tornar o céu perceptível, manter exposição longa se necessário e explicar os saltos de luz/sombra.

## AST-VIS-01 — Medium — céu pouco legível, corrigido localmente

**Evidência:** `src/ui/sky-panel.ts` iniciava `longExposure=false`. Em `src/render/sky.ts`, o fluxo estelar multiplicava tanto a cor quanto o alpha; pontos de 0,8–2,6 pixels de framebuffer ficavam ainda menores visualmente em telas de alta densidade.

Comparação com câmera fixa em azimute de grade 0°/elevação 45°, h180, mesmo catálogo/horizonte, sem DOM/HUD na leitura de pixels. Limiar: qualquer canal RGB ≥40/255. Os números abaixo são **pixels iluminados, não quantidade de estrelas**.

| Perfil | Antes, padrão desligado | Antes, longa ligada | Depois, padrão com longa |
|---|---:|---:|---:|
| Desktop 1280×800, DPR1 | 0 | 30 | 187 |
| Celular emulado 390×844, DPR2, renderer1,5 | 0 | 23 | 306 |

Correção: longa ativa por padrão; ganho artístico 36; fluxo aplicado à cor e alpha reservado à cobertura circular; pontos de 1,8–3,6 pixels CSS multiplicados pelo pixel ratio efetivo do renderer. São parâmetros de apresentação, não diâmetros físicos, tempo de exposição de um sensor ou geração energética. O controle de comparação continua disponível em Ciência.

O botão **“Olhar céu estrelado / Look at the starfield”** enquadra o céu acima do horizonte, evitando exigir que o jogador descubra como sair da visão predominantemente voltada à base. Esse botão move a câmera; não representa uma posição astronômica inventada.

Reprodução: `python3 -B -u scripts/e2e-sky-visibility.py 5192` contra Vite nessa porta. O script verifica padrão ativo, enquadramento pela interface, aumento de pixels visíveis, hash das posições do catálogo, direção/intensidade solar iguais ao alternar exposição e ausência de erros JS/GLSL. As duas exposições usaram 12 draws no enquadramento ensaiado: nenhum passe adicional. Isso não equivale a um benchmark geral de FPS.

Capturas desktop/celular e JSON em `.scratch-agent/sky-visibility/{before,after}/`, ignorados pelo git. O primeiro ajuste de brilho chegou a apenas 73 pixels desktop e falhou no critério de legibilidade (mínimo 100 no campo fixado); foi revisto antes da aprovação final. Não se baixou o critério para aprovar o teste.

## AST-VIS-02 — Medium — direção solar em degraus, confirmado, ajuste pendente

**Causa principal:** `src/engine/sun.ts:sampleAt` usa `Math.floor(hour/step_hours)` e `step_hours=1`. `src/render/scene.ts:updateScene` aplica essa mesma posição diretamente à luz. `src/render/sky.ts:updateSky` também mantém o céu até mudar a amostra inteira. Não há interpolação temporal entre as efemérides.

Na tabela ativa, cada salto solar mede **0,50621°–0,50856°**, mediana 0,50762°; h24→25 = 0,5078646°. `SPEEDS=[1,2,4]` em main significa horas simuladas por segundo real. Com desempenho suficiente, o resultado é posição imóvel por aproximadamente **1 s em 1×**, **0,5 s em 2×**, **0,25 s em 4×**, seguida de um salto de cerca de meio grau. Alterar a velocidade muda a frequência, não elimina os degraus. O limite de 0,1s por frame pode prolongar o intervalo real quando o FPS cai muito.

**Confirmação durante a partida:** em 3,107 s na velocidade1× foram observados187 quadros (~60FPS), com183 pares consecutivos mantendo exatamente a mesma posição. Só ocorreram três mudanças: aos757,1757 e2757ms, cada uma de~0,50785°. Portanto, mesmo com renderização a60FPS, a direção solar se atualiza em passos de1s. O JSON do E2E registra a série, sem alterar o motor para a medição.

**Segunda causa confirmada:** `scene.ts` aplica `sun.intensity = lit ? 3.4 : 0` e preenchimento 0,3/0,18. O bloqueio do centro solar pelo horizonte é binário, sem transição luminosa entre os estados. Isso explica mudanças abruptas de luminosidade nas horas de ocultação, separadamente do salto na direção.

**Agravante em investigação:** `main.ts:frame` alterna o passe de sombras, mas força-o em todos os frames quando o intervalo anterior passa de ~33,3ms. Sob carga, essa política aumenta o trabalho por frame. A presença da política é confirmada; seu custo causal isolado ainda deve ser medido em AST-PERF-02. Não atribuir todos os saltos a GPU ou shader quando a quantização de tempo já os explica diretamente.

**Correção recomendada:** definir amostragem temporal contínua compartilhada entre disco solar, iluminação, céu e teste de horizonte; tratar a passagem 359°→0° por vetores/quaternions, conferir os pontos tabulados e evitar uma posição paralela para energia. Qualquer mudança na visibilidade científica/integração energética exige justificativa e testes de partida. Avaliar transição do limbo/intensidade com modelo e rótulo apropriados. Orçar a frequência de sombras sem acrescentar custo justamente quando o FPS cai.

**Teste de aceite:** tempos fracionários devem produzir direções intermediárias contínuas; horas inteiras devem coincidir com Horizons; cobrir wrap 360°, pausa, reinício e fim 708 h. Medir sequências em 1×/2×/4×, com delta angular proporcional ao tempo simulado e frame-time registrado. Revalidar alinhamento disco/luz/horizonte/energia e partidas completas; não suavizar apenas a câmera ou deslocar o Sol para esconder degraus.

Nesta revisão foi ajustada a leitura do céu. O movimento solar continua em degraus e permanece rastreado como pendência.


Validação integrada: typecheck, 220 testes TS em24 arquivos e build aprovados na árvore compartilhada; 36 verificações do E2E astronômico passaram, sem erros JS/GLSL. A rodada curta fixa desta data atingiu60FPS/P9516,7–16,8ms; isso não substitui as medições adversas de carga e GPU móvel do relatório de desempenho.
