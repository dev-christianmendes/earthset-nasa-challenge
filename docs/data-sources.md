# Fontes de dados

Cada número científico do jogo tem origem aqui. O que for ilustrativo está marcado como tal, no código e na tela.

## 1. Sol (dado real, em uso)

| Campo | Valor |
|---|---|
| Fonte | NASA/JPL **Horizons**, API `https://ssd.jpl.nasa.gov/api/horizons.api` |
| Alvo | Sol (10), efemérides DE441 |
| Observador | Superfície da Lua (centro 301), lon 0°, lat −89,5°, altitude 0 km. Local **ilustrativo** perto do polo sul |
| Grandeza | Azimute e elevação aparentes (`QUANTITIES='4'`) |
| Período da tabela em uso | 09/10/2024 09:00 UTC até 07/11/2024 21:00 UTC, passo de 1 h (709 amostras, 708 intervalos). As 709 amostras estão acima do horizonte plano. |
| Data da consulta | 14/11/2026 |
| Texto cru | `data-pipeline/raw/horizons_sun_south_pole.txt` (para auditoria) |
| Tabela do jogo | `src/data/sun-south-pole.json` |
| Como gerar | `python3 data-pipeline/fetch_sun.py` (ou `--from-raw` para reprocessar o texto cru). Testes: `python3 -m unittest discover -s data-pipeline/tests` |

**Resultado da tabela versionada:** com horizonte plano, a elevação do Sol no ponto fica entre **0,1611°** e **1,0361°** durante toda a janela. O Sol não se põe nesse ponto no período. A noite do jogo vem do relevo que bloqueia o Sol.

**Limitação espacial:** a tabela é de um único ponto de observação, −89,5° e 0°, cerca de 15,2 km do polo. O morro `peak` do LOLA está a 2,5 km do polo, em x = −1500 m, y = −2000 m na projeção. A elevação/azimute do Sol não foram calculados exatamente para esse morro. A base usa uma aproximação regional; a sombra usa o horizonte local medido. Comparação independente da orientação do azimute ainda falta.

## 2. Horizonte local medido (LOLA, C1)

| Item | Valor |
|---|---|
| Fonte | LRO LOLA, modelo de elevação **LDEM_80S_20M** (NASA PDS, distribuído pelo MIT: `https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_20M.IMG`, com rótulo `.LBL`) |
| Resolução | 20 m por pixel, projeção polar estereográfica, centro no polo sul (`CENTER_LATITUDE = -90`) |
| Recorte usado | Faixa de 40 km em volta do polo (2000 linhas, ~122 MB, por HTTP Range). O bruto fica em `data-pipeline/raw/` e **não vai para o git** |
| Script | `data-pipeline/fetch_lola.py` (testes em `data-pipeline/tests/test_fetch_lola.py`) |
| Saída | `src/data/terrain-sites.json`, lida por `src/engine/terrain.ts` |
| Método | Para cada candidato num disco de 3 km em volta do polo, 72 raios (a cada 5°) até 20 km; ângulo máximo do relevo, descontada a curvatura (d²/2R, R = 1737,4 km) |
| Escolha dos sites | Pelo próprio horizonte: **peak** = o mais exposto (horizonte médio mínimo), **slope** = o mediano, **rim** = o mais sombreado |

**Resultado (14/11/2026):** com o Sol da tabela do JPL Horizons, em 709 horas:

| Site | Horizonte máximo | Horas com Sol |
|---|---|---|
| peak (morro) | 4,3° | 412 |
| slope (encosta) | 25,4° | 179 |
| rim (borda) | 55,4° | 0 |

Decisão (14/11/2026, autor): a base começa no **morro (peak)**. A tabela atual dá 412 amostras iluminadas, equivalentes a 411 intervalos de jogo de 1 h; encosta = 179 amostras, borda = 0. O equilíbrio da partida atual foi testado com esses arquivos; qualquer regeneração do Sol ou horizonte pede nova simulação completa.

**Suposição a verificar (convenção de azimute):** o azimute do Horizons (0° = norte local, sentido horário) foi ligado à projeção com norte = +y (meridiano 0°, afastando-se do polo) e leste = +x, a convenção padrão da estereográfica polar sul (EPSG:3031). Se o sinal de leste estiver invertido, o Sol nasce do lado errado. Verificação pendente: comparar uma direção conhecida do relevo com o nascer do Sol na tabela.

**Limites:** o pixel de 20 m e a escolha de três sites não são medição de um local de pouso real; é um recorte do polo para o jogo. O horizonte de 20 km ignora crateras maiores que isso.

Antigo horizonte ilustrativo (`SITE_HORIZON_DEG`, 0 / 1,2 / 1,6°) foi removido do código nesta etapa.

## 3a. Como o Sol entra no jogo

- O motor recebe `sunlit` por hora, calculado em `isSunlit(table, hour, site, terrain)`: a elevação do Sol precisa passar do horizonte local do site.
- A tela posiciona a luz pelo azimute e pela elevação reais (`src/main.ts`). Quando o Sol está acima do horizonte mas tapado, a cena fica só com luz de fundo.

## 4a. Fontes avaliadas e adiadas

| Fonte | Decisão | Motivo |
|---|---|---|
| **NASA DONKI** (tempestades solares) | Em uso (seção 3; GST e SEP) | Eventos históricos de outubro/novembro de 2024 formam um cenário, não previsão para a missão. O endpoint `api.nasa.gov/DONKI/FLR` respondeu 404 na consulta de teste e não entra na tabela. |
| **LOLA / PGDA** (relevo) | Em uso (seções 2 e 4) | O raster bruto grande fica fora do git (`.gitignore`); só as tabelas derivadas entram na aplicação. |

## 5. O que é ilustrativo (lista de conferência)

- Associação da efeméride regional ao morro `peak` (seções 1 e 2); o horizonte em si foi medido no LOLA.
- Local de observação −89,5° lat (escolha de cenário, não de dado).
- Robô, tempos de tarefa, consumo e equilíbrio de bateria (`src/engine/robot.ts`, `src/main.ts`): regras de jogo, documentadas em `docs/regras-recursos.md`.
- Recursos (energia, ar, água, comida): regras de jogo, sem fonte científica própria.

## 3. Clima espacial (C2, NASA DONKI)

| Item | Valor |
|---|---|
| Fonte | NASA DONKI: `GST` (tempestades geomagnéticas, índice Kp de 3 em 3 h, dado da NOAA) e `SEP` (partículas solares energéticas). O endpoint `FLR` respondeu 404 em 14/11/2026, por isso não é usado |
| Janela | Cenário histórico: 708 h a partir de 09/10/2024 09:00 UTC (709 amostras). O Sol e o clima começam no mesmo instante. Tempestade G4 de 10 a 11/10/2024, a confirmar na DONKI. Rotulado como cenário na tela; não é previsão. |
| Script | `data-pipeline/fetch_donki.py` (testes em `data-pipeline/tests/test_fetch_donki.py`) |
| Saída | `src/data/space-weather.json`, lida por `src/engine/space-weather.ts` |
| Respostas cruas | `data-pipeline/raw/donki_gst.json`, `donki_sep.json` (pequenas; versionadas para auditoria) |
| Método | Kp marcado em t vale para as 3 horas anteriores, [t-3h, t) (convenção NOAA). Cada SEP marca radiação por 24 h a partir do evento; a duração não vem da DONKI, então 24 h é ilustrativo |
| Chave | `NASA_API_KEY` no ambiente; sem ela usa `DEMO_KEY`, que tem limite baixo (10 chamadas por hora) |

**Por que 09/10/2024:** o Sol no polo sul depende da estação lunar. A tabela versionada tem elevação positiva nas 709 amostras; o clima e o Sol usam a mesma janela. Não é previsão. Kp ≥ 5 começa na amostra 30, chega a 8,67; 76 amostras têm radiação. A duração de 24 h por evento SEP é uma regra ilustrativa de interpretação.

## 4. Malha do relevo na cena (V1)

- Recorte de 400 m do LDEM_80S_20M, centrado no morro (`peak`), em 160 × 160 pontos (2,5 m). `src/data/terrain-mesh.json`, gerado por `data-pipeline/fetch_lola.py` (função `build_mesh`).
- Altura relativa ao centro do recorte, em metros. Variação de cerca de 30 m no recorte.
- Exagero vertical de 2× na cena (`VERTICAL_EXAGGERATION` em `src/render/scene.ts`). A tela diz isso no rodapé.
- A malha tem a resolução do dado (20 m por pixel, reamostrado): não mostra detalhe menor que isso.

