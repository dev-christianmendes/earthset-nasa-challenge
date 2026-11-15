# Earthset · Roadmap de validação: iluminação lunar e céu astronômico

Data: 15/11/2026. Escopo: solicitação do autor «EARTHSET — ILUMINAÇÃO LUNAR E CÉU ASTRONÔMICO».

**Origem deste arquivo:** `docs/EARTHSET_VALIDATION_ROADMAP.md` não existia na árvore no início desta etapa e não foi encontrado na busca local. Este documento registra a etapa descrita na mensagem do autor; não inventa o conteúdo de um roadmap anterior.

## Preservação e contratos

- [x] Terreno, altura de implantação, planta da base, rotas, horizonte LOLA e tabela solar energética preservados por comparação SHA-256 antes/depois.
- [x] Nenhum arquivo de `src/engine/` foi alterado por esta etapa; os testes de partida completa continuam aprovados.
- [x] Interface em inglês e português; cálculos científicos separados de exposição e preenchimento artísticos.
- [x] Execução local, sem commit, push ou deploy por este agente.

O observador continua sendo o cenário já usado pela energia: Lua, longitude leste 0°, latitude −89,5°, altitude 0 km, `MEAN_ME` no Horizons. A aproximação regional em relação ao morro LOLA não foi alterada para evitar mudança científica/econômica silenciosa.

## Etapa implementada

| ID | Item | Estado e evidência |
|---|---|---|
| AST-01 | Auditar luz e céu anteriores | Concluído: sombras globais desligadas, halo esférico, estrelas aleatórias, Terra fixa/emissiva identificados |
| AST-02 | Sol por JPL Horizons, tamanho angular e exposição | Concluído: mesma amostra da energia para luz e disco; diâmetro ~0,5334°–0,5386° tabulado; halo removido; sem bloom global |
| AST-03 | Sombras rasantes e autossombreamento | Concluído: PCF 2048/1024, casters dos modelos e do terreno, volume de sombra estendido, atualização alternada corrigida |
| AST-04 | Terra aparente | Concluído: azimute/elevação, diâmetro, fração iluminada, orientação terrestre e terminador baseados na efeméride; lado noturno sem emissivo |
| AST-05 | Planetas | Concluído no recorte: Mercúrio, Vênus, Marte, Júpiter e Saturno; posições e magnitudes Horizons; pontos não resolvidos com resposta em pixels |
| AST-06 | Estrelas de catálogo | Concluído no recorte: 904 entradas BSC5, magnitude V ≤ 4,5, pela cópia NOIRLab; sem posições aleatórias |
| AST-07 | Horizonte e atualização temporal | Concluído no cenário: horizonte LOLA por fragmento para corpos/estrelas, atualização na mesma grade horária do cenário; céu sem paralaxe artificial da câmera |
| AST-08 | Modo Ciência | Concluído: tabela EN/PT com UTC, observador, direção, diâmetro, iluminação e fontes; inspeção de corpo visível e exposição longa opcional |
| AST-09 | Testes e comparação de fontes | Concluído: 208 testes TS, 43 Python; reprocessamento offline reproduz o JSON; typecheck e build aprovados |
| AST-10 | Verificação visual e desempenho | Concluído na GPU local: 33 verificações E2E, desktop e celular emulado, cinco horas e três amostras finais de FPS |

Implementação: `src/astronomy/sky.ts`, `src/render/sky.ts`, `src/ui/sky-panel.ts`, integração em `scene.ts/main.ts` e pipeline `data-pipeline/fetch_sky.py`. Não há chamada à NASA ou catálogo durante a partida.

## Dados e validação científica

- Fontes: [API JPL Horizons](https://ssd-api.jpl.nasa.gov/doc/horizons.html), [manual](https://ssd.jpl.nasa.gov/horizons/manual.html), [BSC5 / NOIRLab](https://www-kpno.kpno.noirlab.edu/Info/Caches/Catalogs/BSC5/bsc5.html) e [listagem utilizada](https://www-kpno.kpno.noirlab.edu/Info/Caches/Catalogs/BSC5/catalog5.html). Método e limites em [data-sources.md](data-sources.md).
- Sete corpos × 709 amostras: 09/10/2024 09:00 UTC a 07/11/2024 21:00 UTC. Brutos em `data-pipeline/raw/sky/`; parâmetros e SHA-256 por bruto em `src/data/sky.json`.
- Maior diferença do novo Sol para a tabela energética preservada: **0,000050303°**. A renderização usa a tabela energética original, não uma nova posição.
- A rotação ICRF → horizonte é inferida de duas direções aparentes do Horizons e conferida em todos os corpos: erro máximo **0,0000012074°**. Isso valida o referencial; não é uma afirmação de precisão astrométrica individual das estrelas.
- Conferências incluem escala angular, fração de fase, ponto subsolar terrestre, ocultação do limbo, identificação de Sirius e orientação norte/leste.
- SPICE foi investigado: [NAIF Frames](https://naif.jpl.nasa.gov/pub/naif/toolkit_docs/C/req/frames.html) e [referencial lunar](https://naif.jpl.nasa.gov/pub/naif/generic_kernels/fk/satellites/moon_080317.tf). Não se misturou `IAU_MOON` com `MEAN_ME`; não há dependência SPICE no navegador.

## Resultados executados

- `npm run typecheck`: aprovado.
- `npm run test -- --no-cache`: **208 testes / 23 arquivos**, aprovados.
- `PYTHONDONTWRITEBYTECODE=1 python3 -B -m unittest discover -s data-pipeline/tests`: **43 testes**, aprovados.
- `npm run build`: aprovado; JS **2.730,98 kB**, gzip **645,49 kB**. O aviso de chunk >500 kB permanece e é um custo de carregamento a acompanhar.
- `python3 -B -u scripts/e2e-astronomy.py 5188`: **33 verificações**, zero falhas e zero erros JS/GLSL.
- `PYTHONDONTWRITEBYTECODE=1 python3 -B scripts/e2e-descoberta.py 5188`: **20 verificações**, zero falhas; interações anteriores continuam acessíveis pelo menu normal.
- GPU: Intel Xe / ANGLE Vulkan / Mesa; viewport 1280×800. Referência anterior: 60,00 FPS, P95 16,8 ms, 286 draws, sombras globais desligadas.
- Três amostras finais, de 3 s cada após aquecimento: **60,00 / 60,00 / 60,00 FPS**, P95 **16,7 / 16,8 / 16,8 ms**; draws variam **288–488** devido ao passe de sombra alternado; 202 geometrias, 12 texturas.
- Uma rodada anterior válida teve **48,14 FPS**, P95 33,4 ms e máximo de 166,6 ms. Não foi descartada como resultado; a repetição final quantifica a variação, sem garantir 60 FPS em toda máquina ou durante carregamento.
- Capturas conferidas: horas **0, 180, 360, 500, 650**, limbo solar na hora 0, Terra na hora 360 (cerca de 50,4% iluminada), Ciência desktop e celular 390×844 em português. Celular emulado, sem rolagem horizontal; não equivale a aparelho móvel real.

Artefatos locais em `.scratch-agent/astronomy-2026-11-15/`: `baseline.json`, `validation.json` e PNGs. É pasta ignorada de rascunho; não é artefato garantido em outro clone. O script permite repetir a validação contra um servidor de desenvolvimento da mesma versão. Atalhos somente dev: `?autostart=cadet&clockAt=360&freeze&sky=earth`; `freeze` para o relógio sem overlay, sem entrar no build de produção.

## Limites e verificações posteriores

- [ ] **Observador exato do terreno (DT-16):** a efeméride é regional; falta recalcular para o ponto geodésico do site e validar projeção/azimute independentemente. Esta etapa não encerra DT-16.
- [ ] **Outras datas e observadores:** requerem novas efemérides e horizonte correspondente pelo pipeline, com validação do Sol energético. Não há previsão ao vivo nem extrapolação de posições fora da janela. A câmera livre é apresentação; não muda o observador científico.
- [ ] **Astrometria estelar de precisão:** posições BSC5 J2000 não incluem movimento próprio, paralaxe ou aberração individual. A rotação lunar acompanha a data; não se promete precisão instrumental.
- [ ] **Fotometria e câmera:** exposição e preenchimento são escolhas visuais; ausência de atmosfera não exige inventar halo. A opção de exposição longa revela estrelas e não altera recursos. Não há modelo completo de sensor, glare ou clima terrestre ao vivo; a textura Blue Marble é estática.
- [ ] **Energia por painel:** mantém-se a regra binária do centro do Sol e horizonte do site. O limbo pode ser parcialmente visível sem mudar esse limiar. Sombras locais e exagero vertical 2× afetam a apresentação, não recalculam geração individual de cada painel.
- [ ] **Desempenho amplo:** validar GPU móvel real, carregamento frio, sessões longas e divisão do pacote de dados. As três amostras finais não substituem DT-13–15/17.

## Preservação comprovada nesta etapa

| Arquivo | SHA-256 antes e depois |
|---|---|
| `src/render/layout.ts` | `7b61869d93bc5388d929d0c0a34831d43f68c451c4c836185ad3131cf3d9d92d` |
| `src/render/terrain-height.ts` | `e4a7aee39f042271ae798cfc553c8776d631fafbf6d6d05342ed0780e72b65f4` |
| `src/render/base-layout.ts` | `0feee249efe7b924c787e7e1d57cef97c3f9aeb75197723af0ccb623c4a71f48` |
| `src/data/terrain-mesh.json` | `301607e44b8185e9ba7b1a953d29627ad65fcb2f2f45df473dbe42babd2b5222` |
| `src/data/terrain-sites.json` | `c21616f7d6d845f2aa4ba9b1765d22aa6cfc2a7e3d7dc6b4da321853c84be1a4` |
| `src/data/sun-south-pole.json` | `892f4f5b1d3d28ece1d70a87b156d394780a10e95510f4cb466c7b4913ba2b10` |
| `data-pipeline/fetch_lola.py` | `e61e73692358e1c808036491be4d20bc1b15684b0c0d90b6900c14cfa4735616` |
