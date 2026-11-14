# Fontes de dados

Cada número científico do jogo tem origem aqui. O que for ilustrativo está marcado como tal, no código e na tela.

## 1. Sol (dado real, em uso)

| Campo | Valor |
|---|---|
| Fonte | NASA/JPL **Horizons**, API `https://ssd.jpl.nasa.gov/api/horizons.api` |
| Alvo | Sol (10), efemérides DE441 |
| Observador | Superfície da Lua (centro 301), lon 0°, lat −89,5°, altitude 0 km. Local **ilustrativo** perto do polo sul |
| Grandeza | Azimute e elevação aparentes (`QUANTITIES='4'`) |
| Período | 15/11/2026 00:00 UT até 14/12/2026 12:00 UT, passo de 1 h (708 h, um dia lunar de jogo) |
| Data da consulta | 14/11/2026 |
| Texto cru | `data-pipeline/raw/horizons_sun_south_pole.txt` (para auditoria) |
| Tabela do jogo | `src/data/sun-south-pole.json` |
| Como gerar | `python3 data-pipeline/fetch_sun.py` (ou `--from-raw` para reprocessar o texto cru). Testes: `python3 -m unittest discover -s data-pipeline/tests` |

**Resultado:** com horizonte plano, a elevação do Sol no ponto fica entre **0,93°** e **2,02°** durante toda a janela. Ou seja, **o Sol não se põe nesse local** no período. A noite do jogo vem do relevo, que bloqueia o Sol. Por isso o horizonte local entra no modelo (seção 3).

**Limitação:** a tabela é de um único ponto de observação. Não há sombra de relevo nela; o bloqueio é o horizonte local da seção 3.

## 2. Horizonte local (ilustrativo, a substituir)

| Local | Horizonte (graus) | Horas com Sol na janela (de 709) |
|---|---|---|
| Pico | 0,0 | 709 |
| Encosta | 1,2 | cerca de 464 |
| Borda | 1,6 | cerca de 316 |

Os valores são escolhidos para dar diferença entre os locais. **São ilustrativos**. Serão substituídos por horizontes medidos no modelo de relevo LOLA (ver seção 4). Código: `src/engine/sun.ts`, `SITE_HORIZON_DEG`.

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
