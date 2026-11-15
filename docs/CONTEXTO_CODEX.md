# Contexto para o Codex (ponto de entrada)

> **Atualização de dívida técnica (15/11/2026):** usar [PLANO_AJUSTES_AUDITORIA.md](PLANO_AJUSTES_AUDITORIA.md), o bloco 10 do [backlog.md](backlog.md) e a memória de retomada abaixo para os achados da auditoria. [MAPA_SISTEMA.md](MAPA_SISTEMA.md) e as demais seções abaixo preservam levantamentos anteriores e podem conter números, hashes e estados superados. O plano de produto v4 continua em [PLANO_V4.md](PLANO_V4.md). Regras de trabalho: `AGENTS.md`.

Data de referência: 14/11/2026. Este documento é a **fonte principal** para o agente Codex. Ele diz o que já existe, o que falta, quem decide o quê e como trabalhar sem quebrar o projeto. Os demais documentos são de apoio e estão listados na seção 2, com o nível de confiança de cada um.

Prazo de envio do desafio: **15/11/2026, 23h59** (meta interna 12h).

## Memória persistente · dívida técnica (15/11/2026)

- **Seguimento dos quatro ajustes (15/11):** DT-16 confirmada/corrigida. Observador peak 216,869897645844°E / −89,917555298683° / 1,474125 km, derivado de LOLA, mesma ME DE421 do Horizons. PROJ valida inversa/norte nos três sites. Sol por site e céu regenerados juntos; peak 411 → 433 intervalos e plano de referência 2 → 3 corações sem rebalancear constantes. Terreno/layout/perfis numéricos preservados. Referência histórica nos testes.
- **Dados e datas:** céu por colunas/deltas (gzip 384 → 127 kB), proveniência fora do JS; build com três sites solares 403,54 kB gzip (antes 645). CLI aceita data/horas/3 sites; caches têm manifesto e cenários alternativos exigem saída separada. Slope/2026/48 h conferido. `fetch_sun.py` passa a gravar só legado; cenário ativo é `fetch_sky.py --activate`.
- **Estrelas:** movimento próprio tangencial BSC5 incluído e comparado com ERFA/SOFA para referências de alto movimento e polo. Sem paralaxe/RV/aberração/deflexão/conversão FK5→ICRS completa. Não declarar acurácia astrométrica a partir do erro numérico do algoritmo.
- **Desempenho:** sem Android conectado. Carga fria emulada (CPU¼, 1,6 Mbps, 150 ms) revelou long task até 1870 ms e quadro 2816,6 ms na rodada final; causa detalhada ainda não atribuída. Sessão de 30 min 4 s/73 ciclos concluída: sem erros/perda de contexto, recursos GPU estáveis (16 texturas/4 FBO/638 buffers/25 programas); heap pós-GC ~15,3–16,1MB. Build do ensaio CjRZwghI; final D0O8Hid3 medido separadamente. Reproduzir por `scripts/validate-performance.py`; consultar `PERFORMANCE_VALIDATION.md`. Estabilidade em ciclos não prova descarte de todo recurso provisório. Tarefas AST-PERF-01–03 e AST-SCI-01–02 no bloco 12 do backlog. DT-13–15/17 não foram encerradas.
- **Verificação integrada desta rodada:** 213 TS e 51 Python aprovados, typecheck/build; 36 verificações E2E finais de astronomia e 20 de descoberta aprovadas; resultados e exceções no execution-log. Carga fria final e baixa taxa de quadros permanecem achados abertos, não resolvidos pela redução do pacote. Nunca confundir medições com benchmarks GPU concorrentes, emulação com GPU física ou fonte regional antiga com o observador atual.


- **Histórico da primeira etapa de iluminação/astronomia em 15/11 (superado pelo seguimento acima):** ver `EARTHSET_VALIDATION_ROADMAP.md` e bloco 11 do backlog. Sol/luz usam a tabela energética preservada; sombras ativas; Terra/5 planetas Horizons e 904 estrelas BSC5/NOIRLab; Ciência EN/PT. 208 testes TS, 43 Python, build e 33 E2E aprovados. SHA-256 confirma preservação de terreno/implantação. Esta etapa não encerra DT-16 (observador regional/azimute) nem DT-13–15/17. A precisão da rotação conferida não equivale à astrometria completa das estrelas. Detalhes de FPS, pacote e limites no roadmap.

- O autor pediu registrar o plano e as tarefas para verificação posterior, sem implementar correções nesta etapa. A fonte da dívida é [PLANO_AJUSTES_AUDITORIA.md](PLANO_AJUSTES_AUDITORIA.md), com 17 IDs; a fila rastreável está no bloco 10 de [backlog.md](backlog.md).
- Prioridades: DT-01–04 (contratos, integração temporal e cronologia científica), DT-05–06 (água e ocupação), DT-07–09/13 (abrigo, fluxos, produção e resposta), DT-10–12 (transições/regressões); DT-14–16 são hipóteses, DT-17 fecha a validação.
- Estado importante: DT-01 já foi corrigida externamente para `hoursLeft`; typecheck e 9 testes direcionados passaram nesta etapa. DT-12 teve comparação reduzida para 1×, mas continua sem cobertura de cruzamento 12/24 h. Reproduzir antes de tratar achado histórico como defeito atual.
- Não há vazamento contínuo de GPU comprovado: dez reinícios mantiveram 202 geometrias/10 texturas/17 programas. Descarte de provisórios e atribuição a shaders continuam em investigação. A associação Sol–LOLA foi posteriormente confirmada/corrigida em DT-16; ver atualização acima.
- Relato de demora: separar confirmação da ordem de duração simulada. Linha de base Intel Xe/Vulkan: 4,9 ms até feedback DOM, 263 ms até movimento e 5,315 s até inspeção em 1×. Investigar casos de segundos sem confirmação; não prometer resposta de movimento em 150 ms quando há preparo previsto.
- A auditoria sofreu edições externas/HMR; o plano identifica a versão fixada em memória e limita o alcance das medições. Não inferir aprovação do build completo a partir do bundle em memória, nem desempenho móvel real a partir de emulação.
- Ao retomar, ler o plano e as últimas entradas do diário. Encerrar uma dívida somente com reprodução/validação da versão atual e evidência registrada; manter motor puro e proveniência científica. Sem commit/push/deploy sem pedido explícito.



---

> **Atualização de escopo (14/11/2026, noite).** Este documento é o ponto de entrada, mas as seções 4 (pendências) e 3.2 (direção visual) estão **superadas**. Use, nesta ordem:
> 1. `docs/PLANO_CONSOLIDADO.md`: plano vigente, com cortes P0, P1 e P2.
> 2. `docs/DECISOES.md`: decisões D-11 a D-15 (direção Cinematic Scientific Sci-Fi, LUMA por regras, objetivos, ordem da tripulação, desempenho, fontes).
> 3. `docs/VISUAL_DIRECTION.md`: direção visual vigente.
> 4. O estado do código abaixo (seção 3.1) continua válido, com estes acréscimos: LUMA (`src/engine/guide.ts`), objetivos (`src/engine/objectives.ts`), ordem da tripulação (`crewOrder`) e briefing estão na árvore de trabalho, sem commit, com 93 testes passando.


## 0. Leia nesta ordem

1. Este arquivo (seções 1 a 5).
2. `AGENTS.md`: regras do projeto (são obrigatórias).
3. `docs/DECISOES.md`: decisões de escopo tomadas (D-01 a D-10).
4. `docs/execution-log.md`: diário. Leia as últimas entradas antes de agir.
5. A tarefa específica no `docs/backlog.md`, e a arquitetura em `docs/arquitetura.md`.

## 1. O projeto em uma página

- **O quê:** jogo 3D no navegador (Vite, TypeScript estrito, three.js 0.186.1, Vitest). Base no polo sul da Lua durante um dia lunar de 708 horas de jogo. Vence chegando às 708 h com pelo menos 1 coração; perde com os 3 corações zerados.
- **Para quem:** banca de jurados internacional (NASA Space Apps Challenge 2026, desafio "Junior Astronaut Mission Trainer") e estudantes (modo escola). Interface abre em **inglês**, com botão para português.
- **Identidade:** "A small base. A hostile world. One lunar day."
- **Dados reais:** efemérides do Sol (JPL Horizons), relevo LRO LOLA (20 m), clima espacial NASA DONKI (cenário de 09/10/2024 a partir das 09:00 UTC, rotulado como cenário, não previsão).
- **Camadas (regra de arquitetura, verificada pelo CI):**
  - `src/engine/`: motor puro. Sem three.js, sem DOM, sem `window`.
  - `src/render/`: cena three.js. Só lê o estado.
  - `src/ui/`: HUD em DOM. Só lê o estado e envia ações.
  - `src/data/`: tabelas geradas por `data-pipeline/` (Python). Não editar à mão.
  - `assets-src/`: scripts do Blender e ativos externos (com licença registrada).

## 2. Mapa dos documentos (estado e confiança)

| Documento | Para quê | Confiança / estado |
|---|---|---|
| `AGENTS.md` | Regras do projeto, comandos, mapa do código | Alta para regras. Seções 6 e 10 (estado) estão **desatualizadas**: use este arquivo para o estado. |
| `CLAUDE.md` | Importa o AGENTS.md | Alta. Só aponta para o AGENTS. |
| `README.md` | Apresentação curta | Média. Verifique comandos antes de confiar. |
| `AI_DISCLOSURE.md` | Declaração de uso de IA (ferramentas, modelos, texto em inglês) | Alta, com pendências de modelo (ver seção 5). |
| `docs/arquitetura.md` | Requisitos do evento (E1–E12) e do produto (R-…), camadas, fases | Média. Tabela de status parcialmente atualizada; use a seção 3 deste arquivo para o estado real. |
| `docs/backlog.md` | Plano em blocos e estado de cada item | Média. Blocos 0 a 3 bem atualizados; blocos 4 e 5 com pendências que a seção 4 resume. |
| `docs/PLANO_PARA_AGENTE.md` | Plano de trabalho para agentes (tarefas T1–T18 com critério de aceite) | Média. Seção 0 e tabela 0.4 atualizadas até a T14; **depois disso usar este arquivo**. Menciona um agente externo antigo; ignore essa parte. |
| `docs/DECISOES.md` | Decisões D-01 a D-10 | Alta. Fonte de regra de jogo e de escopo. |
| `docs/INTERACTION_MAP.md` | Cada componente: ação, efeito no motor, reação visual, lacunas | Média. Atualizado até a tripulação e a pausa. |
| `docs/regras-recursos.md` | Números de recursos, equipamentos, corações, robô, equilíbrio | Alta. Números são escolhas de jogo, ajustáveis. |
| `docs/data-sources.md` | Fonte de cada número científico, método e o que é ilustrativo | Alta. Seções 3a e 4a (duplicadas antes) corrigidas. |
| `docs/ART_ASSET_PIPELINE.md` | Blender, convenção de escala, licenças dos ativos externos | Alta para licenças. Estado dos modelos: ver seção 3. |
| `docs/VISUAL_DIRECTION.md` | Identidade visual, paleta (tokens), câmera, UI | Alta para direção. Não é checklist de implementação. |
| `docs/RENDERING_ARCHITECTURE.md` | Como a cena é montada e atualizada | Média. |
| `docs/UI_UX_SPECIFICATION.md` | Telas, níveis de informação, acessibilidade | Média. Telas previstas (preparação, vitória/derrota, ajuda) ainda não existem. |
| `docs/event-rules.md` | Regras do evento (datas, elegibilidade, IA, critérios, ofertas) | Alta. Itens A2 e A5 (enunciado e Guia de Envio) **não lidos**. |
| `docs/execution-log.md` | Diário de cada etapa, com comandos e resultados | Alta como histórico. Longo: leia as últimas entradas. |
| `docs/questionario-escopo.html` | Questionário antigo de escopo | **Obsoleto** (o autor descartou). Não usar como fonte. |
| `docs/arquitetura.md` seção 9 e `docs/backlog.md` bloco 5 | Ordem de fases F0–F6 | Parcialmente seguidas; ver seção 4. |

## 3. Estado real (14/11/2026, fim do dia)

### 3.1 O que o jogo já faz

- **Motor (testado):** recursos (bateria, ar, água, comida), painéis (até 12), estufa (3 modos), robô com fila de até 4 tarefas (gelo, painel, antena), corações, vitória e derrota.
- **Dados reais no motor:** Sol (`src/data/sun-south-pole.json`), horizonte medido no LOLA para 3 posições (`src/data/terrain-sites.json`), clima DONKI (`src/data/space-weather.json`).
- **Equilíbrio:** capacidade da bateria 1000. O plano de referência vence com 2 corações; a base sem plano perde por volta da hora 117 (teste em `tests/engine/partida.test.ts`).
- **Clima:** tempestade reduz a geração dos painéis (10% por nível G); radiação para o robô; tripulação corre para o abrigo e perde 1 coração a cada 12 h de exposição (`src/engine/crew.ts`, D-05).
- **Aviso da antena:** com antena instalada, o HUD avisa tempestade em até 6 h (`hoursUntilStorm`, D-01).
- **Ajuda ao gelo:** com tripulação livre, a tarefa de gelo dura 4 h (`src/engine/robot.ts`, D-06). **Limite:** o caso "sem ajuda" não acontece na prática (ver seção 4).
- **Colheita:** com a estufa ligada, +10 de comida a cada 12 h, até 100 (`src/engine/harvest.ts`, D-07).
- **Cena:** relevo LOLA (malha 160×160, 400 m, exagero 2×); céu com estrelas e Terra; Sol com sombras longas; superfície lunar CC0 "Moon Dusted 01" no chão; habitat, estufa, painéis (crescem ao serem instalados, T5), antena (aparece ao instalar), rover (vai ao local da tarefa, trabalha, volta; volta caminhando se a tarefa for cancelada).
- **Tripulação:** dois astronautas CC0 (`astronaut_oga.glb`, animação `default` e `run`) com `AnimationMixer`; fallback para `astronaut.glb` se falhar.
- **Interface:** tela inicial ("Nova missão"), pausa (botão e Esc), HUD em inglês/português, modo escola, alertas de recurso baixo, painel polar do horizonte, aviso da antena, clima.

### 3.2 Estado dos modelos 3D (importante: leia antes de mexer em arte)

- `public/models/` é servida diretamente pelo Vite. **Os GLB regenerados não commitados são os que o jogo mostra agora.**
- `habitat.glb` regenerado tem as **cúpulas das extremidades mal posicionadas** (uma aparece embaixo do casco). Correção planejada em `build_habitat` de `assets-src/blender/build_assets.py` (girar a malha e só depois posicionar), **não aplicada**.
- `greenhouse.glb` regenerado tem 787 KB (esferas das plantas com muitas faces).
- O habitat novo está implementado e carregado (`attachModel(habitat, 'habitat')`), mas a diferença visual para o modelo primitivo é pequena a distância de jogo. **Decisão do autor pendente**: restaurar os GLB do commit (`git checkout -- public/models/...`) ou aceitar os regenerados.
- Ativos externos em uso (CC0, registrados em `docs/ART_ASSET_PIPELINE.md`): superfície lunar Poly Haven, astronauta OpenGameArt.
- Candidatos (não baixados ou não ligados): Modular Sci-Fi Megakit (Quaternius, CC0, zip em `assets-src/external/modular-scifi-megakit/megakit.zip`, fora do git); Space Station Kit (Kenney, CC0, download manual pelo autor); Ultimate Space Kit (Quaternius, CC0, sem link direto).

### 3.3 Git (confira sempre com os comandos da seção 6)

- Branch `main`. Último commit: `a4dcd28` (T5). **7 commits locais não enviados** ao GitHub.
- Commits com trailer de outro agente (opencode, descontinuado): `a1d82c1`, `1af398c` (não enviados) e `d1d0595`, `9785489`, `54c0b06` (já enviados). Decisão do autor sobre reescrita: seção 5.
- Modificados, não commitados: remoção de menções ao Copilot e ao opencode em arquivos de projeto (ver seção 5), GLB regenerados, `assets-src/blender/build_assets.py`, `.gitignore`, documentação. Pendências de commit: seção 5.

## 4. Pendências, por prioridade

### 4.1 Bloqueadas pela decisão do autor (não avançar sem ela)
1. **Astronauta com acabamento:** nenhum modelo CC0 com detalhe foi encontrado. Opções: aceitar CC-BY com atribuição (exige registro), comprar modelo pago (CGTrader), ou artista. Ver `docs/PLANO_PARA_AGENTE.md` seção 0.9.
2. **Habitat:** Megakit (CC0) ou Space Station Kit (CC0, download manual). Antes, decidir sobre os GLB regenerados (seção 3.2).
3. **Histórico do git e trailers** (seção 5).

### 4.2 Podem avançar (não dependem de arte)
- **T6 Revisão de texto da interface (B3.1):** `src/i18n.ts` (chaves nos dois idiomas, teste), `src/school.ts`, `index.html`. Aceite: textos claros; `tests/i18n.test.ts` passa.
- **T7 Pausa com teclado verificada:** Esc pausa e retoma; "Menu principal" volta à tela inicial e reinicia a partida. Hoje só o botão foi capturado. Aceite: captura/teste.
- **T8 Câmera "Seguir robô" (D-03, opcional):** botão que alterna o alvo da órbita entre a base e o rover, com transição. Aceite: volta com "Visão da base".
- **T9 Desempenho:** medir FPS e carregamento com navegador real; registrar. Peso atual: textura da superfície ~2 MB (1K), astronauta OGA 54 KB, astronauta v2 958 KB (não ligado), estufa 787 KB, rover 258 KB. Aceite: número registrado e otimização do que estiver pesado.
- **T11 Reações da tripulação (D-08):** ao aviso da antena, acenar; hoje o astronauta só anda e corre. Falta um clipe de aceno (o modelo OGA não tem). Pode ser feito com o clipe existente em câmera lenta ou com um clipe novo, se o modelo for trocado.
- **T13 (animação):** a colheita existe no motor; falta mostrar a colheita na estufa (animação ou efeito).
- **Rever a regra sem ajuda (D-06):** a ajuda nunca fica indisponível enquanto o robô trabalha (trânsito ao abrigo e radiação não coincidem com trabalho). Decidir: ou a ajuda exige algum requisito real, ou o caso "sem ajuda" sai da regra. **Pedir decisão ao autor antes de mudar.**
- **Testes de T5:** a transição de crescimento não tem captura. Aceite: captura de meio de animação ou teste de `setInstalled`.

### 4.3 Fora de escopo deste prazo (registrar, não fazer)
- Efeitos visuais de tempestade além do brilho dos painéis e da cor do farol.
- Pedras e crateras decorativas (Poly Haven "Moon Meteor 01", CC0, a verificar).
- Diário da base (I3) e linguagem das patentes (I2).
- Revisão de A2 (enunciado oficial) e A5 (Guia de Envio, Termos): **não lidos**. Sem eles, requisitos de elegibilidade ficam em aberto.
- Entrega: vídeo de 30 s ou 7 slides em inglês, referências, declaração de IA em inglês. **Só com pedido explícito do autor.**

### 4.4 Bugs e lacunas conhecidas
- Cúpula do habitat mal posicionada (no GLB regenerado, não commitado).
- Astronauta OGA: caminhada usa o clipe de corrida em câmera lenta; pose de repouso quase em T; direção de frente do modelo não confirmada em todas as situações.
- Regra do gelo sem ajuda inalcançável (seção 4.2).
- Radiação já na hora 0 do cenário (dado real do DONKI; o HUD mostra "robô parado" desde o início).
- Horizonte medido só para o morro na tela (encosta e borda existem no motor).
- Captura do modo escola em inglês ainda não feita.

## 5. Decisões que só o autor toma

1. **Modelos regenerados** em `public/models`: restaurar do commit, ou aceitar.
2. **Astronauta:** aceitar CC-BY com atribuição, comprar, ou artista.
3. **Habitat:** Megakit (CC0), Space Station Kit (download manual), ou manter o atual.
4. **Histórico do git:** o autor pediu retirar as menções ao Copilot e ao opencode também dos registros no GitHub. Isso exige **reescrever commits já enviados e fazer `git push --force`** (ação destrutiva no repositório público). Confirme explicitamente antes. Para os 7 commits locais não enviados, a reescrita é local e pode ser feita antes.
5. **Trailer dos commits do Codex:** definir se os commits do Codex levam `Co-Authored-By: Codex <...>` (ou outro), e como isso aparece em `AI_DISCLOSURE.md`.
6. **Modelo e provedor do Codex** (para a declaração de IA).
7. **Regra D-06 (ajuda ao gelo sem alcance)**: ver seção 4.2.
8. **Regras de jogo** (capacidade da bateria, limiares, tempos, penalidade da D-05): qualquer mudança exige reteste de `tests/engine/partida.test.ts`.
9. **Push e envio:** só com pedido explícito.

## 6. Regras e comandos

### 6.1 Regras (de `AGENTS.md`, mais as definidas pelo autor)
- Motor sem three.js, DOM ou `window`. Render só lê o estado. UI só envia ações validadas.
- Dado científico com fonte em `docs/data-sources.md`. Ilustrativo marcado.
- **Commit só com pedido explícito** (regra 7 do AGENTS). **Push só com pedido explícito.**
- Sem marca da NASA. Sem imagem ou modelo gerado por IA como ativo final. Ativo de terceiro só com licença verificada na fonte e registro em `docs/ART_ASSET_PIPELINE.md`.
- Sem menor de 18 anos identificável. Astronautas são genéricos.
- Textos: interface em inglês com botão para português (chaves iguais nos dois idiomas, testadas). Documentação em português. Página de envio em inglês.
- Chave NASA: **nunca** em arquivo ou commit. Usar `NASA_API_KEY` no ambiente.
- Cada etapa entra em `docs/execution-log.md` com comandos e resultados (inclusive falhas).
- "Pronto" = typecheck + vitest + build passando + captura revisada se mexeu em tela.

### 6.2 Comandos
```bash
cd /home/chris/projects-chris/earthset-nasa-challenge
npm run typecheck                      # tsc --noEmit
npx vitest run                         # testes (84 hoje)
python3 -m unittest discover -s data-pipeline/tests   # pipelines (22)
npm run build                          # gera dist/
npx vite --port 5180 --strictPort      # servidor de teste (porta 5180)
git log --oneline origin/main..HEAD    # commits não enviados
git status --short                     # o que falta commitar
```
Blender (instalado sem administrador): `~/tools/blender-5.2.2-linux-x64/blender --background --factory-startup --python assets-src/blender/build_assets.py -- public/models`. Escala no Blender é **tamanho total**.

Captura (Chrome headless): `google-chrome --headless=new --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader --window-size=1280,800 --virtual-time-budget=10000 --screenshot=<pasta>/x.png http://localhost:5180/`

## 7. Armadilhas já pagas (não repetir)
- **Ajustes temporários de tela** (começar a partida, esconder a tela inicial, inserir tarefa) em `src/main.ts`: nunca fazer backup de arquivo já alterado. Use `git show <commit>:caminho` ou `git checkout <commit> -- caminho` e confira com `git diff`. Já houve dois commits com essas alterações (corrigido em `73e72fd`).
- **Matar o servidor de teste:** nunca `pkill -f "vite --port 5180"` (mata o próprio shell). Use o PID de `ss -ltnp | grep :5180`.
- **Clone de modelo skinado:** `Object3D.clone()` não copia o esqueleto. Use `SkeletonUtils.clone` (já corrigido no astronauta).
- **Material metálico sem ambiente** fica preto. Modelos externos vêm com `metalness 1`: trocar para material fosco ao carregar.
- **Origem de modelo externo** pode estar no centro do corpo: deslocar para os pés tocarem o chão.
- **Blender:** `transform_apply` aplica também a localização, se a opção for padrão. Aplicar só a escala quando a origem precisa ficar no pivô. Escala é tamanho total.
- **Saída longa de comando** é cortada pela ferramenta. Prefira resumos por script.
- **Commits sem pedido:** a regra 7 do AGENTS exige pedido explícito. Eu fiz commits sem pedido em algumas etapas; não repetir.
