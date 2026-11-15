# Fontes de dados

Cada número científico do jogo tem origem aqui. O que for ilustrativo está marcado como tal, no código e na tela.

## 1. Sol (dado real, observador LOLA validado em 15/11/2026)

| Campo | Valor |
|---|---|
| Fonte | [NASA/JPL Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html), DE441, alvo Sol (10), centro `coord@301`, geodésico, `APPARENT=AIRLESS` |
| Observador ativo (`peak`) | Longitude leste **216,869897645844°**, latitude **−89,917555298683°**, altura **1,474125 km** sobre a esfera de 1737,4 km; ME DE421 |
| Outros sites solares | `slope`: 315° / −89,976681113349° / 1,238125 km; `rim`: 116,565051177078° / −89,926259214844° / 0,201625 km |
| Origem espacial | [Rótulo LOLA LDEM_80S_20M](https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_20M.LBL); parâmetros em `data-pipeline/observers.json`; rótulo preservado em `data-pipeline/lola-projection.LBL` |
| Janela | 09/10/2024 09:00 a 07/11/2024 21:00 UTC: 709 pontos, 708 intervalos de uma hora |
| Brutos e consultas | `data-pipeline/raw/sky/peak-20241009-708/`; consultas e hashes em `data-pipeline/sky-provenance.json` |
| Tabela do motor | `src/data/sun-south-pole.json`; `samples` = peak, `samples_by_site` = efeméride correspondente a cada site |
| Regeneração conjunta | `python3 -B data-pipeline/fetch_sky.py --from-raw data-pipeline/raw/sky/peak-20241009-708 --activate` |

**DT-16:** a efeméride regional anterior era 0° / −89,5° / 0 km. Foi substituída pela localização derivada da implantação LOLA existente, sem mover terreno ou base. O pipeline solar antigo (`fetch_sun.py`) agora grava somente o arquivo histórico `data-pipeline/generated/sun-regional-legacy.json`; ele não pode sobrescrever o cenário ativo isoladamente.

Reproduzir coordenadas/alturas: `python3 -B data-pipeline/observer.py --from-dem data-pipeline/raw/lola_south_pole_band.bin` (não regenera malha ou seleção de sites).

A projeção é estereográfica **esférica**, polo sul, longitude central 0°, raio 1.737.400 m. Para x/y da grade: `lon=atan2(x,y)` e `lat=−90°+2 atan(hypot(x,y)/(2R))`. O norte geográfico na grade tem ângulo `lon`; portanto `az_grade=(az_Horizons+lon) mod 360`. A renderização e o horizonte usam a grade; os painéis mostram o norte geográfico, subtraindo essa rotação. A conferência independente com [PROJ](https://proj.org/en/stable/operations/projections/stere.html) deu diferença máxima de 4,45×10⁻¹²° na inversa para os três sites. Isso mede consistência matemática, não acurácia física do DEM.

O [manual Horizons](https://ssd.jpl.nasa.gov/horizons/manual.html#lunar-mean-earth-frame-of-de421) confirma ME de DE421 para coordenadas lunares; o rótulo LOLA declara o mesmo referencial. Não foi usado `IAU_MOON` em seu lugar.

**Limites espaciais:** resolução original 20 m; altura do observador interpolada bilinearmente. O perfil de horizonte anterior, preservado, usa pixels arredondados e raios a cada 5° até 20 km. A altura arredondada no centro difere da bilinear em 1,375 m (peak), 3,625 m (slope) e 14,625 m (rim). Não é localização certificada de pouso ou previsão de iluminação subminuto. Permanecem a discretização horária, o limiar binário do centro solar e a aproximação de curvatura do horizonte.

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

**Resultado atual (DT-16, 15/11/2026):** Sol do observador de cada site, 709 pontos e 708 intervalos:

| Site | Horizonte máximo | Amostras iluminadas / intervalos de 1 h |
|---|---|---|
| peak (morro) | 4,3° | 434 / 433 |
| slope (encosta) | 25,4° | 179 / 179 |
| rim (borda) | 55,4° | 0 / 0 |

A base continua no **peak**. A referência regional tinha 411 intervalos iluminados; a correção acrescenta h645–648 e h652–669, sem retirar nenhum (22 h). No slope a soma fica igual, mas h196 deixa de ser iluminada e h375 passa a ser. O rim permanece sem Sol. O teste de partida compara os dados históricos e os novos: 2 → 3 corações no plano de referência com capacidade 1000, **sem alterar capacidade, custos, durações ou geração por painel**. O painel polar agora conta 708 intervalos, sem contar o ponto final como hora adicional.

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

## 4b. Extração de água lunar (base da missão de gelo, D-21)

| Fonte | Status | Como entrou no jogo |
|---|---|---|
| Colaprete et al. (2010), *Science* 330, 463–468, "Detection of Water in the LCROSS Ejecta Plume" ([PDF](https://www.chem.uci.edu/~unicorn/old/H2A/handouts/PDFs/LCROSSPaper.pdf); [AAAS](https://www.aaas.org/news/science-lcross-impact-ejects-minerals-and-frozen-water-crater-moon)) | **Medido** (impacto em Cabeus, 2009): 5,6 ± 2,9% de gelo em massa no regolito do local | A carga é regolito escuro com gelo, não bloco de gelo; o texto diz "poucos % de água" |
| Li et al. (2018), *PNAS* 115(36), 8907–8912, "Direct evidence of surface exposed water ice in the lunar polar regions" ([PMC](https://pmc.ncbi.nlm.nih.gov/articles/6130389)) | **Medido** (M3/Chandrayaan-1): gelo exposto em manchas, em regiões sombreadas, mais no polo sul | Local de gelo em terreno baixo e sombreado, marcado como ilustrativo (o gelo não está medido neste recorte) |
| NASA PRIME-1 / TRIDENT no IM-2 Athena, 2025 ([NASA](https://www.nasa.gov/missions/artemis/clps/nasas-lunar-drill-technology-passes-tests-on-the-moon/); [resultados, NTRS](https://ntrs.nasa.gov/api/citations/20260003150/downloads/MSolo%20PRIME-1%20overview%20and%20results%20-%20LSSW.pdf)) | **Demonstração parcial**: o módulo tombou; a broca ligou, estendeu e girou, mas não perfurou o solo | Broca rotativa que desce e gira na escavação; poeira balística sem nuvem |
| VIPER ([Planetary Society](https://www.planetary.org/space-missions/viper)) | **Missão planejada**: cancelada em 2024, retomada com entrega prevista para o fim de 2027 | Só referência: nada no jogo é apresentado como resultado do VIPER |
| RESOLVE e mineração térmica: aquecimento a ~150 °C e armadilha fria ([NTRS 20110012191](https://ntrs.nasa.gov/api/citations/20110012191/downloads/20110012191.pdf); [NASA STRG, UTEP](https://www.nasa.gov/directorates/stmd/space-tech-research-grants/advanced-thermal-mining-approach-for-extraction-transportation-and-condensation-of-lunar-ice/)) | **Laboratório e protótipo**: nenhum sistema operado na Lua | Processador brilha (aquecimento) na descarga; a tela diz "ideia testada em laboratório, ainda não usada na Lua" |

Os +12 de água por viagem e as 6 h da missão continuam regra de jogo (`src/engine/robot.ts`), não derivados dessas fontes.

## 5. O que é ilustrativo (lista de conferência)

- Relevo da cena: a malha LOLA com exagero vertical de 2× tem, na área da base, uma **plataforma aplainada** (D-26, `src/render/terrain-height.ts`: horizontal em 31 m de raio em volta de (3, −11), em rampa até 100 m). É só desenho: Sol, horizonte e clima vêm de tabelas próprias e não usam a malha. Fora de 100 m o relevo medido não muda (teste).
- A implantação da base é uma escolha do jogo sobre o DEM LOLA; o observador é derivado desse ponto. A antiga aproximação regional −89,5°/0° foi substituída em DT-16.
- Robô, tempos de tarefa, consumo e equilíbrio de bateria (`src/engine/robot.ts`, `src/main.ts`): regras de jogo, documentadas em `docs/regras-recursos.md`.
- Recursos (energia, ar, água, comida): regras de jogo, sem fonte científica própria.
- Sons (`src/ui/audio.ts`): estilizados e sintetizados no navegador (Web Audio), sem arquivos de áudio e sem terceiros, logo nada a licenciar. No vácuo o som não se propaga pelo ambiente; os sinais representam rádio, interior do traje (bipes, alarmes, passos) e vibração da estrutura e das máquinas (motor, broca, ventiladores, bomba, aquecedor). Eventos: `src/engine/sound-events.ts`.
- Locomoção da tripulação (`src/render/crew-gait.ts`): a gravidade lunar de **1,62 m/s²** vem da [NASA Moon Fact Sheet](https://nssdc.gsfc.nasa.gov/planetary/factsheet/moonfact.html) (gravidade de superfície 1,62 m/s²). O resto é ilustrativo: passo saltado de ~2 m/s, troca andar→saltar pelo número de Froude (~0,5, pernas de 0,9 m, ≈ 0,85 m/s na Lua), voo de 0,26 a 0,51 s com subida de alguns centímetros (g·t²/8), aceleração de 1,5 m/s². Pegadas das estruturas (`src/render/crew-nav.ts`) medidas nos modelos da cena, não em planta real.

## 3. Clima espacial (C2, NASA DONKI)

| Item | Valor |
|---|---|
| Fonte | NASA DONKI: `GST` (tempestades geomagnéticas, índice Kp de 3 em 3 h, dado da NOAA) e `SEP` (partículas solares energéticas). O endpoint `FLR` respondeu 404 em 14/11/2026, por isso não é usado |
| Janela | Cenário histórico: 708 h a partir de 09/10/2024 09:00 UTC (709 amostras). O Sol e o clima começam no mesmo instante. Tempestade G4 de 10 a 11/10/2024, a confirmar na DONKI. Rotulado como cenário na tela; não é previsão. |
| Script | `data-pipeline/fetch_donki.py` (testes em `data-pipeline/tests/test_fetch_donki.py`) |
| Saída | `src/data/space-weather.json`, lida por `src/engine/space-weather.ts` |
| Respostas cruas | `data-pipeline/raw/donki_gst.json`, `donki_sep.json` (pequenas; versionadas para auditoria) |
| Uso no jogo | **Só a radiação (SEP) tem efeito**: abriga a tripulação, para o robô e dispara o aviso da antena. O **Kp é medida da magnetosfera da Terra**: fica na tabela como dado observado, **sem efeito** na simulação (decisão do autor, 14/11/2026; antes reduzia a geração dos painéis em 10% por nível G, regra removida por não ter base técnica para a Lua). |
| Método | Kp marcado em t vale para as 3 horas anteriores, [t-3h, t) (convenção NOAA). Cada SEP marca radiação por 24 h a partir do evento; a duração não vem da DONKI, então 24 h é ilustrativo |
| Catálogo de eventos (v5) | `src/data/space-weather-events.json`, gerado pelo mesmo script: 17 registros SEP e 1 GST **como a DONKI os registrou** (ID original, horário UTC, instrumento, link `ccmc.gsfc.nasa.gov/DONKI/view/...`), os alertas que a NASA enviou (ID, horário, link), os eventos ligados citados (FLR, CME, IPS) e 3 episódios de radiação. Cada campo tem proveniência: `observed`, `from-id`, `computed` ou `game-rule` (legenda no cabeçalho de `fetch_donki.py`). |
| Não baixado | Registros completos de **FLR** (404 em 14/11/2026), **CME** e **IPS** (429 com a `DEMO_KEY`; o servidor do CCMC não respondeu). Do que foi citado pelos SEP e GST só existem o ID e o horário lido do ID (`from-id`). Nada foi inventado para preencher. Com uma `NASA_API_KEY` própria, esses endpoints podem ser tentados de novo. |
| Chave | `NASA_API_KEY` no ambiente; sem ela usa `DEMO_KEY`, que tem limite baixo (10 chamadas por hora) |

**Por que 09/10/2024:** o Sol no polo sul depende da estação lunar. A tabela versionada tem elevação positiva nas 709 amostras; o clima e o Sol usam a mesma janela. Não é previsão. Kp ≥ 5 começa na amostra 30, chega a 8,67; 76 amostras têm radiação. A duração de 24 h por evento SEP é uma regra ilustrativa de interpretação.

### 3.1 Leitura científica dos registros (v5)

- **Episódios de radiação (regra de jogo, a partir de dado observado):** EP-01, 9 SEP de 09/10/2024 03:50 a 08:55 UTC (hora de jogo −6 a 23); EP-02, 7 SEP de 26/10/2024 16:45 a 21:43 UTC (415 a 443); EP-03, 1 SEP de 28/10/2024 08:57 UTC (455 a 478). Entre as horas 24 e 414 não há SEP registrado na janela.
- **O jogo abre com radiação em curso:** EP-01 começou 5 h antes das 09:00 UTC (início da janela), então a hora 0 já tem radiação. É dado observado, mas a abertura da partida decorre da escolha da janela e precisa ser decidida (ver `docs/AUDITORIA_V5.md`).
- **Tempo entre a erupção e o SEP (computado a partir dos IDs):** EP-01, a erupção ligada ocorreu 2,4 h antes do primeiro SEP (e a CME, 1,6 h); EP-02, 10,2 a 10,8 h antes; EP-03, 50 a 51 h antes. A janela é **muito variável**: não sustenta um aviso fixo.
- **Alertas oficiais da NASA (computado):** dos 10 alertas citados, 9 saíram de 0,1 a 8,1 h **depois** do registro do SEP e 1 saiu 0,4 h antes. A DONKI avisa sobretudo **depois** do início, o que limita qualquer aviso antecipado do jogo.
- **Aplicabilidade à Lua:** SEP são partículas do Sol e o catálogo é medido em órbita da Terra (GOES, SEISS >100 MeV). A Lua está à mesma distância do Sol, mas sem magnetosfera nem atmosfera, e a dose na superfície depende de energia, fluxo, duração e proteção, que o jogo **não** calcula. O Kp, ao contrário, mede a magnetosfera da Terra e **não** se aplica à Lua.

## 4. Malha do relevo na cena (V1)

- Recorte de 400 m do LDEM_80S_20M, centrado no morro (`peak`), em 160 × 160 pontos (2,5 m). `src/data/terrain-mesh.json`, gerado por `data-pipeline/fetch_lola.py` (função `build_mesh`).
- Altura relativa ao centro do recorte, em metros. Variação de cerca de 30 m no recorte.
- Exagero vertical de 2× na cena (`VERTICAL_EXAGGERATION` em `src/render/scene.ts`). A tela diz isso no rodapé.
- A malha tem a resolução do dado (20 m por pixel, reamostrado): não mostra detalhe menor que isso.


## 6. Céu astronômico e iluminação lunar (15/11/2026)

**Fontes e reprodução:** [API JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html), [manual de grandezas](https://ssd.jpl.nasa.gov/horizons/manual.html), [BSC5 mantido pelo NOIRLab](https://www-kpno.kpno.noirlab.edu/Info/Caches/Catalogs/BSC5/bsc5.html) e sua [listagem completa](https://www-kpno.kpno.noirlab.edu/Info/Caches/Catalogs/BSC5/catalog5.html). Pipeline `python3 -B data-pipeline/fetch_sky.py`; offline: `python3 -B data-pipeline/fetch_sky.py --from-raw data-pipeline/raw/sky/peak-20241009-708 --activate`. Saída compacta: `src/data/sky.json`; consultas e SHA-256 ficam em `data-pipeline/sky-provenance.json`, fora do JavaScript.

| Conteúdo | Proveniência / transformação |
|---|---|
| Sol, Terra, Mercúrio, Vênus, Marte, Júpiter e Saturno | Horizons DE441; mesmo observador e janela da seção 1; 709 amostras por corpo |
| Direção, diâmetro, iluminação, geometria terrestre e magnitude | Grandezas 4, 9, 10, 13, 14, 15, 20, 24, 32 e 45; refração desligada |
| Rotação do céu | Inferida de Sol/Júpiter em ICRF aparente e horizonte local, conferida nos sete corpos; resíduo máximo 2,79×10⁻⁹° nos sete corpos antes da quantização (atan2 do produto vetorial) |
| Estrelas | 904 entradas BSC5, V ≤ 4,5, HR, RA/Dec J2000 e movimento próprio tangencial µα cosδ / µδ em arcsec/ano; CDS V/50 não respondeu, utilizada a cópia NOIRLab |
| Diâmetro desenhado | Raio de esfera = distância visual × seno do semidiâmetro angular; não usar raio arbitrário |
| Fase da Terra | Ponto subsolar e subobservador tabulados; esfera orientada pelo eixo terrestre; conferência com fração iluminada do Horizons |
| Ocultação | Perfil LOLA existente, interpolado por azimute no fragmento; sem refração atmosférica |
| Exposição, preenchimento e pontos não resolvidos | Escolhas de câmera/apresentação; não são fluxo radiométrico medido nem regra energética |

**Sol único:** luz e disco usam a mesma amostra por site consumida pela energia, derivada da mesma consulta que o céu. DT-16 regenerou as efemérides e documentou o impacto (seção 1). A regra energética continua binária pelo centro solar. Terreno, perfis numéricos do horizonte e implantação não mudaram.

**Formato compacto:** colunas numéricas com deltas inteiros e escala 10⁶; nenhuma hora removida. Erro por valor retido ≤ 0,00000051 na unidade original. Diâmetro solar, geometria terrestre e coordenadas são conferidos contra brutos. Matrizes guardam 9 casas. Metadados/consultas completos ficam no sidecar de proveniência. `src/astronomy/format.ts` valida e decodifica o formato 3.

**Estrelas:** movimento próprio propagado como vetor tangencial normalizado, sem singularidade nos polos. A convenção de µα cosδ foi conferida no [código de catálogo da ESA tetra3](https://github.com/esa/tetra3/blob/master/tetra3/tetra3.py), além da [descrição HEASARC](https://heasarc.gsfc.nasa.gov/W3Browse/star-catalog/bsc5p.html). Conferência independente com ERFA/SOFA `pmsafe`, paralaxe e velocidade radial zeradas, para Sirius, Alpha Centauri A/B, Procyon e Polaris em 2024, 2026 e 2100: diferença numérica máxima 2,74×10⁻⁹ arcsec para **esse modelo simplificado**, não para a posição aparente real. O aviso ERFA de distância substituída é esperado com paralaxe zero. Fixtures mantêm referências independentes nos testes TS.

**Outras janelas/observadores:** CLI aceita `--start`, `--hours` (1–8784), `--site peak|slope|rim`, `--raw-dir`, `--output` e replay `--from-raw`. Datas de início 1900–2100, em hora cheia. Manifesto vincula cache a consulta e impede reutilizar brutos de outra data/site. Exemplo conferido: `python3 -B data-pipeline/fetch_sky.py --start '2026-11-15 00:00' --hours 48 --site slope --output .scratch-agent/astronomy-followup/sky-slope-2026.json`. Sete corpos × 49 amostras, observador slope; não substitui a partida/DONKI histórica de 2024. `--activate` só aceita a janela padrão e o destino canônico. Uma nova data jogável exigirá clima e testes de partida próprios; não se transpõem tempestades históricas para outra data.

**SPICE:** investigados [NAIF Frames](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/frames.html) e o [frame lunar DE421](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_080317.tf). Optou-se pelo referencial recuperado das saídas do próprio Horizons; não se substituiu MEAN_ME por IAU_MOON. Nenhuma dependência SPICE é necessária no navegador.

**Limites:** a partida continua na janela histórica de 2024 e no peak, em grade horária; cenários alternativos são gerados pelo pipeline. Movimento próprio estelar incluído, mas não paralaxe, velocidade radial, aberração anual/diurna individual, deflexão gravitacional ou conversão completa FK5→ICRS; o erro de conferência do referencial não é precisão estelar global. A textura terrestre Blue Marble já existente é estática; não representa nuvens ou clima da data. Preenchimento neutro é artístico, sem energia; não há halo atmosférico ou bloom global. Sombras do relevo preservam o exagero visual 2×. Não se prometem detecção a olho nu ou fotometria instrumental apenas por um corpo estar geometricamente acima do horizonte.

Resultados, limites e hashes de preservação: [EARTHSET_VALIDATION_ROADMAP.md](EARTHSET_VALIDATION_ROADMAP.md).



## Apresentação estelar revisada (15/11/2026)

Exposição longa agora ativa por padrão, com ganho artístico36 e resposta dos pontos de1,8–3,6px CSS adaptada ao pixel ratio do renderer. Alpha cobre o disco do ponto; não reaplica a atenuação do fluxo. Não são diâmetros físicos ou um modelo de sensor. Fonte, posições, magnitudes relativas, movimento próprio e horizonte do catálogo permanecem os mesmos. O botão de enquadramento olha a45° acima do horizonte, sem inventar um corpo celeste. Comparação e limites em `SCENE_SKY_REVIEW.md`.
