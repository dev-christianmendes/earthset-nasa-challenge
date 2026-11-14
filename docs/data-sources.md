# Fontes de dados

Cada número científico do jogo tem origem aqui. O que for ilustrativo está marcado como tal, no código e na tela.

## 1. Sol (dado real, em uso)

| Campo | Valor |
|---|---|
| Fonte | NASA/JPL **Horizons**, API `https://ssd.jpl.nasa.gov/api/horizons.api` |
| Alvo | Sol (10), efemérides DE441 |
| Observador | Superfície da Lua (centro 301), lon 0°, lat −89,5°, altitude 0 km. Local **ilustrativo** perto do polo sul |
| Grandeza | Azimute e elevação aparentes (`QUANTITIES='4'`) |
| Período | 09/10/2024 00:00 UT até 06/11/2024 12:00 UT, passo de 1 h (708 h, um dia lunar de jogo). Escolhido porque o polo tem Sol nessa janela (706 de 709 h acima do horizonte plano). Em 10/05/2024 o Sol fica abaixo do horizonte o dia inteiro |
| Data da consulta | 14/11/2026 |
| Texto cru | `data-pipeline/raw/horizons_sun_south_pole.txt` (para auditoria) |
| Tabela do jogo | `src/data/sun-south-pole.json` |
| Como gerar | `python3 data-pipeline/fetch_sun.py` (ou `--from-raw` para reprocessar o texto cru). Testes: `python3 -m unittest discover -s data-pipeline/tests` |

**Resultado:** com horizonte plano, a elevação do Sol no ponto fica entre **0,93°** e **2,02°** durante toda a janela. Ou seja, **o Sol não se põe nesse local** no período. A noite do jogo vem do relevo, que bloqueia o Sol. Por isso o horizonte local entra no modelo (seção 3).

**Limitação:** a tabela é de um único ponto de observação. Não há sombra de relevo nela; o bloqueio é o horizonte local da seção 3.

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
| peak (morro) | 4,3° | 379 |
| slope (encosta) | 25,4° | 179 |
| rim (borda) | 55,4° | 0 |

Decisão (14/11/2026, autor): a base começa no **morro (peak)**, com 379 h de Sol. A encosta (179 h) e a borda (0 h) ficam como locais de comparação. O equilíbrio precisa ser revisto com isso (ver `docs/backlog.md`, C1 e B2.3).

**Suposição a verificar (convenção de azimute):** o azimute do Horizons (0° = norte local, sentido horário) foi ligado à projeção com norte = +y (meridiano 0°, afastando-se do polo) e leste = +x, a convenção padrão da estereográfica polar sul (EPSG:3031). Se o sinal de leste estiver invertido, o Sol nasce do lado errado. Verificação pendente: comparar uma direção conhecida do relevo com o nascer do Sol na tabela.

**Limites:** o pixel de 20 m e a escolha de três sites não são medição de um local de pouso real; é um recorte do polo para o jogo. O horizonte de 20 km ignora crateras maiores que isso.

Antigo horizonte ilustrativo (`SITE_HORIZON_DEG`, 0 / 1,2 / 1,6°) foi removido do código nesta etapa.

## 3. Como o Sol entra no jogo

- O motor recebe `sunlit` por hora, calculado em `isSunlit(table, hour, site)`: a elevação do Sol precisa passar do horizonte local do site.
- A tela posiciona a luz pelo azimute e pela elevação reais (`src/main.ts`). Quando o Sol está acima do horizonte mas tapado, a cena fica só com luz de fundo.

## 4. Fontes avaliadas e adiadas

| Fonte | Decisão | Motivo |
|---|---|---|
| **NASA DONKI** (tempestades solares) | Adiada | A janela do jogo é futura, sem registros. Para usar, seria preciso amostrar um período passado e tratar como cenário, o que pede decisão de design. O endpoint `api.nasa.gov/DONKI/FLR` respondeu 404 na consulta de teste (14/11/2026); a rota e a chave precisam ser revisadas antes. |
| **LOLA / PGDA** (relevo) | Adiada | O modelo de relevo é um raster grande (GeoTIFF). Fica fora do git (`.gitignore`). Entra quando o horizonte local for medido. Enquanto isso, a seção 2 é ilustrativa. |

## 5. O que é ilustrativo (lista de conferência)

- Horizonte local por site (seção 2).
- Local de observação −89,5° lat (escolha de cenário, não de dado).
- Robô, tempos de tarefa, consumo e equilíbrio de bateria (`src/engine/robot.ts`, `src/main.ts`): regras de jogo, documentadas em `docs/regras-recursos.md`.
- Recursos (energia, ar, água, comida): regras de jogo, sem fonte científica própria.

## 3. Clima espacial (C2, NASA DONKI)

| Item | Valor |
|---|---|
| Fonte | NASA DONKI: `GST` (tempestades geomagnéticas, índice Kp de 3 em 3 h, dado da NOAA) e `SEP` (partículas solares energéticas). O endpoint `FLR` respondeu 404 em 14/11/2026, por isso não é usado |
| Janela | Cenário histórico: 708 h a partir de 09/10/2024 00:00 UTC (tempestade G4 de 10 a 11/10/2024, a confirmar na DONKI) (decisão D1 em `docs/arquitetura.md`). Rotulado como cenário na tela. Não é previsão |
| Script | `data-pipeline/fetch_donki.py` (testes em `data-pipeline/tests/test_fetch_donki.py`) |
| Saída | `src/data/space-weather.json`, lida por `src/engine/space-weather.ts` |
| Respostas cruas | `data-pipeline/raw/donki_gst.json`, `donki_sep.json` (pequenas; versionadas para auditoria) |
| Método | Kp marcado em t vale para as 3 horas anteriores, [t-3h, t) (convenção NOAA). Cada SEP marca radiação por 24 h a partir do evento; a duração não vem da DONKI, então 24 h é ilustrativo |
| Chave | `NASA_API_KEY` no ambiente; sem ela usa `DEMO_KEY`, que tem limite baixo (10 chamadas por hora) |

**Por que 09/10/2024:** o Sol no polo sul depende da estação lunar. Em 10/05/2024 ele fica abaixo do horizonte o dia inteiro (elevação de −0,7° a −1,9°); em 09/10/2024 fica acima em 706 de 709 horas. O clima e o Sol usam a mesma janela. Não é previsão.

## 4. Malha do relevo na cena (V1)

- Recorte de 400 m do LDEM_80S_20M, centrado no morro (`peak`), em 160 × 160 pontos (2,5 m). `src/data/terrain-mesh.json`, gerado por `data-pipeline/fetch_lola.py` (função `build_mesh`).
- Altura relativa ao centro do recorte, em metros. Variação de cerca de 30 m no recorte.
- Exagero vertical de 2× na cena (`VERTICAL_EXAGGERATION` em `src/render/scene.ts`). A tela diz isso no rodapé.
- A malha tem a resolução do dado (20 m por pixel, reamostrado): não mostra detalhe menor que isso.

