# Plano de trabalho para o agente (passagem de contexto)

Documento para um agente de IA que vai executar partes do Earthset. Leia **inteiro** antes de mexer em qualquer arquivo. Ele diz o que já existe, o que falta, em que ordem, com que critério de aceite, e o que você **não** deve decidir sozinho.

Data de referência: 14/11/2026. Prazo de envio: **15/11/2026, 23h59** (meta interna 12h). Repositório: `main`, commits locais à frente do GitHub; **não faça push** sem pedido explícito do autor.

---

## 0. ESTADO ATUAL (atualizado em 14/11/2026, noite). Leia isto antes de tudo.

### 0.1 Git
- Branch `main`. Último commit: `1af398c`. Há **2 commits locais não enviados** (`a1d82c1`, `1af398c`, da outra IA).
- **Não faça push** sem pedido explícito do autor. **Não faça commit** sem pedido explícito (regra 7 de `AGENTS.md`). Commit e push só quando o autor pedir.
- Já enviado ao GitHub até `a21e95f`, incluindo T14 (`76a8a34`).

### 0.2 Alerta: arquivos não commitados que o jogo já usa
- `public/models/*.glb` (habitat, rover, solar_panel, greenhouse, antenna, astronaut) foram **regenerados** e não estão commitados. O Vite serve essa pasta, então o jogo já mostra essas versões.
- **Bug conhecido:** `habitat.glb` tem as duas cúpulas das extremidades mal posicionadas (uma aparece embaixo do casco). A correção (girar só a malha da cúpula e depois posicionar o objeto) está planejada em `build_habitat` de `assets-src/blender/build_assets.py`, mas **não foi aplicada**.
- `greenhouse.glb` ficou com 787 KB (esferas das plantas com muitas faces). `rover.glb` com 258 KB.
- **Decisão pendente do autor:** restaurar os GLB do HEAD enquanto a arte não é aprovada, ou aceitar as versões regeneradas. Não decida isso sozinho.

### 0.3a Ativos externos (decisão D-10, autor)
- Política: ativo de terceiros entra se a licença for verificada na fonte (de preferência CC0) e registrada em `docs/ART_ASSET_PIPELINE.md`.
- **Em uso:** superfície lunar "Moon Dusted 01" (Poly Haven, CC0) no chão, `public/textures/moon/` (a versão com pegadas foi removida).
- **Em uso:** astronauta de baixo polígono com animação (OpenGameArt, CC0), `public/models/astronaut_oga.glb`, na tripulação. Qualidade cartunesca; primeira versão externa, aceita pelo autor.
- **Candidato para o habitat:** Space Station Kit (Kenney, CC0). Aguarda o autor baixar o zip em `assets-src/external/space-station-kit/` (download automático bloqueado).
- Próximos candidatos: pedras e crateras decorativas (Poly Haven, CC0; verificar cada um).

### 0.3 Astronauta: decisão pendente, NÃO continuar iterando sem ela
- `astronaut.glb`: versão atual no jogo (primitivas, pivôs de braço e perna). Corrigida em T1 (`d1d0595`), validada por números, não por imagem.
- `astronaut_v2.glb`: malha única, esqueleto com 16 ossos, skinning automático, clipes `idle`, `walk`, `run`, `work`. **Não está ligado ao jogo.** Problemas na última revisão: braço direito com fresta no ombro, luva solta na pose de trabalho (não acompanha o punho), torso em caixa, enquadramento da prévia cortando os pés.
- Atualização: o autor pediu para usar modelo externo licenciado. Já há um candidato CC0 (`astronaut_oga.glb`), que não atende ao acabamento pedido. **Falta decidir**: adotar o candidato como base, buscar outro modelo externo, ou modelar à mão.
- **Opções anteriores** (referência):
  1. Modelo externo licenciado, com esqueleto e clipes. Integrar, validar escala, registrar atribuição.
  2. Modelagem manual por um artista no Blender. O script só exporta e valida.
  3. Manter o procedural só como placeholder e focar no restante.
- Até a decisão: não modificar `build_astronaut_v2.py` nem ligar `astronaut_v2.glb` ao jogo.

### 0.4 Status das tarefas (atualizado)
| Tarefa | Estado |
|---|---|
| T1 articulação do astronauta | feita (`d1d0595`), validada por números |
| T2 tarefas dos astronautas | revogada (D-02); substituída por D-05 a D-08 |
| T3 marcador do gelo visível | feita (`a21e95f`) |
| T4 antena: aviso de tempestade (D-01) | feita (`576ec04`, `a1d82c1`, `1af398c`) |
| T5 transição de instalação de painel e antena | pendente |
| T6 revisão de texto (B3.1) | pendente |
| T7 pausa com teclado em navegador | parcial: tela de pausa capturada; Esc não verificado |
| T8 câmera seguindo o rover (D-03) | pendente, baixa prioridade |
| T9 desempenho medido e peso dos GLB | pendente |
| T11 reações visuais da tripulação (D-08) | pendente |
| T12 astronauta ajuda o gelo (D-06) | pendente |
| T13 astronauta colhe na estufa (D-07) | pendente |
| T14 abrigo e exposição à radiação (D-05) | feita (`76a8a34`), 76 testes |
| T15 habitat com arte | pendente: falta corrigir a cúpula |
| T16 rover com arte | pendente |
| T17 astronauta, estufa, painéis, antena | pendente: depende da decisão 0.3 |
| T18 revisão visual humana | pendente |

### 0.7 O que a outra IA pode adiantar AGORA (sem depender de decisão de arte)
- **T12 (ajuda ao gelo, D-06), só motor:** duração da tarefa de gelo com astronauta livre (4 h) e sem ajuda (6 h), com testes em `tests/engine/robot.test.ts` ou novo arquivo. Não mexer em arte.
- **T13 (colheita na estufa, D-07), só motor:** +10 de comida a cada 12 h com a estufa ligada (até 100), com testes. Não mexer em arte.
- **T6 (revisão de texto, B3.1):** `src/i18n.ts` e `src/school.ts`, sem mudar regra.
- **T5 (transição de instalação de painel e antena):** só render, sem arte nova.
- **T9 (desempenho):** medir quadros por segundo e peso dos GLB e da textura (a textura de regolito soma cerca de 2,5 MB; a estufa tem 787 KB; o astronauta v2 tem 958 KB).
- **Não fazer agora:** T15 a T18 (arte) e ligar qualquer astronauta novo ao jogo, até o autor decidir.

### 0.8 O que precisa mudar fora do código (aguarda o autor)
1. **Commit e push** de tudo que está pendente. Há 2 commits locais da outra IA e mudanças não commitadas (modelos regenerados, textura, scripts, previews, documentação). Só com pedido explícito.
2. **Decisão sobre `public/models/*.glb` regenerados:** o `habitat.glb` tem a cúpula mal posicionada e é o que o jogo serve agora. Restaurar do HEAD ou aceitar.
3. **`AI_DISCLOSURE.md`:** declarar que parte dos ativos é de terceiros (CC0) e que os scripts do Blender foram feitos com IA.
4. **Entrega (B4, mais tarde):** lista de referências com as licenças de `docs/ART_ASSET_PIPELINE.md`.

Ordem sugerida agora: (a) decisão do autor sobre 0.2, 0.3 e 0.8; (b) T12 e T13 (motor, independentes de arte); (c) T6 e T5; (d) T9; (e) T15 a T18 após a decisão de arte.

### 0.5 Regras aprendidas (erros já cometidos)
- **Nunca** fazer backup de um arquivo já alterado para teste. Use sempre o commit limpo como referência: `git show <commit>:caminho > arquivo` ou `git checkout <commit> -- caminho`. Depois confira com `git diff`.
- Ajustes temporários de tela (começar a partida, esconder a tela inicial, inserir tarefa) devem ser revertidos com `git checkout`, e não com cópia de backup. Esse erro já pôs ajustes de teste em `main.ts` por dois commits (corrigido em `73e72fd`).
- Chave NASA: nunca gravar em arquivo ou commit. Use só `NASA_API_KEY` no ambiente.
- Blender: escala é tamanho total. Use `transform_apply` só na escala quando a origem precisa ficar no pivô; `transform_apply` sem parâmetro também move a localização.

### 0.6 Arquivos de apoio
- `docs/DECISOES.md`: decisões D-01 a D-09 (incluindo a penalidade da D-05 e o trabalho de arte da D-09).
- `docs/INTERACTION_MAP.md`: comportamento de cada componente.
- `docs/execution-log.md`: diário de todas as etapas.
- `assets-src/blender/`: `build_assets.py` (habitat, rover, painel, estufa, antena, astronauta v1), `build_astronaut_v2.py`, `preview_assets.py`, `preview_astronaut_v2.py`, e a pasta `previews/` com as prévias.

## 1. O projeto em uma página

- **O quê:** jogo 3D no navegador. O jogador administra uma base no polo sul da Lua durante um dia lunar de 708 horas de jogo. Vence chegando às 708 h com pelo menos 1 coração; perde quando os 3 corações acabam.
- **Para quem:** banca de jurados internacional (NASA Space Apps Challenge 2026, desafio "Junior Astronaut Mission Trainer") e estudantes (modo escola).
- **Identidade:** "A small base. A hostile world. One lunar day." Direção visual em `docs/VISUAL_DIRECTION.md`.
- **Dados reais:** Sol (JPL Horizons), relevo (LRO LOLA, 20 m), clima espacial (NASA DONKI, cenário de 09/10/2024 a partir das 09:00 UTC, rotulado como cenário, não previsão).

## 2. Regras que não podem ser quebradas

Estas regras vêm de `AGENTS.md`, `CLAUDE.md` e do pedido do autor. Violar uma delas invalida o trabalho.

1. **Motor separado.** `src/engine/` é TypeScript puro: sem three.js, sem `document`, sem `window`. Regra de jogo fica só no motor. O CI verifica isso.
2. **Renderização só lê o estado.** `src/render/` não calcula regra de jogo nem trajetória do Sol; recebe do motor (ex.: `isGreenhouseOn`, `placeRover` usa `queue[0]` e `hoursLeft`).
3. **UI só envia ações validadas.** `src/ui/` não altera o estado diretamente.
4. **Dado com fonte.** Número científico tem origem em `docs/data-sources.md`. Ilustrativo fica marcado no código e na tela.
5. **Sem marca da NASA** (logotipo, insígnia, bandeira, patch) em assets nem na tela. A tela já diz que não há afiliação.
6. **Sem imagem ou modelo gerado por IA** no jogo. Modelos 3D são gerados por script do Blender neste projeto (`assets-src/blender/build_assets.py`) ou vêm de fonte com licença verificada e registrada.
7. **Sem menores identificáveis.** Astronautas são genéricos (capacete, viseira, sem rosto).
8. **Idioma.** Interface abre em **inglês**, com botão para português. Documentação do repositório fica em **português**. Página de envio e materiais linkados: **inglês**. Chaves de texto ficam em `src/i18n.ts` nos dois idiomas (há teste que verifica).
9. **Commits.** Conventional Commits, com a linha `Co-Authored-By: Claude Haiku 5.5 <noreply@anthropic.com>` no fim. Commit local é permitido; **push só com pedido**.
10. **Chave NASA.** Nunca gravar em arquivo, commit ou documento. Usar `NASA_API_KEY` como variável de ambiente.
11. **Registro.** Cada etapa entra em `docs/execution-log.md` com arquivos, comandos, resultados e falhas (inclusive as que você não conseguiu resolver).
12. **Verificação antes de "pronto".** `npm run typecheck`, `npx vitest run`, `npm run build` passando. Se mexeu em tela: captura desktop 1280×800 e celular 390×844, revisada de fato.

## 3. Como rodar e verificar

```bash
cd /home/chris/projects-chris/earthset-nasa-challenge
npm install            # se faltar dependência
npm run typecheck      # tsc --noEmit
npx vitest run         # testes do motor e da interface (68 atualmente)
python3 -m unittest discover -s data-pipeline/tests   # pipelines de dados (22)
npm run build          # gera dist/ (inclui public/models/*.glb)
npx vite --port 5180 --strictPort   # servidor de desenvolvimento (porta 5180, não 5173)
```

Captura (Chrome headless, pasta de rascunho da sessão, nunca `/tmp` sem pedido):
```bash
google-chrome --headless=new --no-sandbox --use-angle=swiftshader --enable-unsafe-swiftshader \
  --window-size=1280,800 --virtual-time-budget=8000 --screenshot=<pasta>/desktop.png http://localhost:5180/
```
Para ver a tela de jogo sem a tela inicial, há um truque temporário (começar com `started = true`, esconder `#title`). **Se usar, desfaça com `cp` do backup e confira com `diff`.** Já houve erro de sintaxe por substituição mal feita.

Para encerrar o servidor de teste, **não** use `pkill -f "vite --port 5180"` (mata o próprio shell). Use o PID do `ss -ltnp | grep :5180`.

Blender (instalado sem administrador): `~/tools/blender-5.2.2-linux-x64/blender --background --factory-startup --python assets-src/blender/build_assets.py -- public/models`. Regera os cinco GLB antigos e o do astronauta. Escala no Blender é **tamanho total** (cubo tamanho 1 com escala 2 mede 2 m).

## 4. Mapa do código

| Caminho | O que é | Dono de quê |
|---|---|---|
| `src/engine/clock.ts` | relógio da partida, 708 h | tempo |
| `src/engine/sun.ts` | tabela do Sol; `isSunlit` (usa o relevo) | iluminação |
| `src/engine/terrain.ts` | horizonte medido por site (72 direções) | relevo |
| `src/engine/space-weather.ts` | Kp → nível G; radiação; `solarFactor` | clima |
| `src/engine/resources.ts` | fluxo por hora (energia, ar, água, comida); `isGreenhouseOn` | recursos |
| `src/engine/robot.ts` | fila do robô (até 4), tempos (`TASK_HOURS`), recusas (códigos) | robô |
| `src/engine/game.ts` | estado, `dispatch` (ações), `advance` (tempo), `outcomeOf` | partida |
| `src/render/scene.ts` | cena three.js: relevo, céu, base, rover, astronautas, luz; `updateScene` | visual |
| `src/render/assets.ts` | carrega GLB uma vez e anexa cópias | ativos |
| `src/ui/hud.ts` | HUD: recursos, fila, clima, idioma, modo escola, overlay de fim | interface |
| `src/ui/horizon-panel.ts` | painel polar do horizonte e trajetória do Sol | interface |
| `src/school.ts` | textos do modo escola (pt/en) | texto |
| `src/i18n.ts` | dicionário pt/en, `t()`, `applyStatic()` | texto |
| `src/main.ts` | laço de quadros, ações, pausa, tela inicial, carregamento | ligação |
| `src/data/*.json` | tabelas geradas pelos scripts (não editar à mão) | dados |
| `data-pipeline/*.py` | `fetch_sun.py`, `fetch_lola.py`, `fetch_donki.py` (+ testes) | dados |
| `assets-src/blender/build_assets.py` | gera os GLB de `public/models/` | ativos |
| `public/models/*.glb` | habitat, rover, painel, estufa, antena, astronauta | ativos |
| `index.html` | HUD, painel polar, tela inicial, pausa, rodapé, CSS (tokens de cor) | interface |
| `tests/engine/*.test.ts`, `tests/i18n.test.ts`, `tests/school.test.ts` | testes | qualidade |

Documentação central: `docs/arquitetura.md` (requisitos), `docs/VISUAL_DIRECTION.md`, `docs/ART_ASSET_PIPELINE.md`, `docs/RENDERING_ARCHITECTURE.md`, `docs/UI_UX_SPECIFICATION.md`, `docs/INTERACTION_MAP.md` (cada componente), `docs/regras-recursos.md` (números do jogo), `docs/data-sources.md` (fontes), `docs/execution-log.md` (diário).

## 5. O que já está feito (não refazer)

- Motor completo: recursos, painéis, estufa (3 modos), robô com fila (gelo, painel, antena), corações, vitória e derrota, clima (tempestade reduz geração; radiação para o robô).
- Dados reais integrados e testados: Sol, horizonte LOLA, clima DONKI, cenário de 09/10/2024.
- Equilíbrio com o Sol real: bateria 1000; plano de referência vence com 2 corações (há teste).
- Cena: relevo LOLA (400 m), céu com estrelas e Terra, luz do Sol, sombras, base com modelos GLB (habitat, estufa, painéis, antena, rover), astronautas (2) que se movem conforme o estado do motor.
- Rover: vai ao local da tarefa (0–35% do tempo), trabalha (35–65%), volta (65–100%). Cancelar faz o rover voltar caminhando.
- Câmera orbital com amortecimento e botão "Visão da base".
- HUD: recursos com cores semânticas (tokens), alertas abaixo de limite, fila, clima, modo escola, idioma, painel polar.
- Telas: inicial ("Nova missão", idioma, créditos), pausa (botão e Esc, continuar, controles, menu principal), fim de partida (sobreposição simples).
- Pipeline Python com 22 testes; motor e interface com 68 testes.

## 6. O que falta, em ordem, com critério de aceite

Cada tarefa tem: **objetivo**, **arquivos**, **aceite**. Faça uma por vez, registre no diário, commit local.

### T1. Animação dos astronautas: articulação (correção visual)
- **Problema:** no quadro de caminhada, braços parecem soltos do corpo (giram em torno de um ponto errado).
- **Arquivos:** `assets-src/blender/build_assets.py` (função `limb`, `build_astronaut`), `src/render/scene.ts` (`animateCrew`).
- **Aceite:** em captura sequencial (câmera perto dos astronautas, `seq-sheet.png` como modelo), braços e pernas balançam presos aos ombros e quadris. Sem braço flutuando.

### T2. Tarefas próprias dos astronautas: **revogada (D-02)**
- O autor pediu todas as tarefas. Ver D-05 a D-08 em `docs/DECISOES.md` e as tarefas T11 a T14 abaixo.

### T3. Marcador do gelo visível — **feita**
- **Problema:** o poliedro azul no local do gelo não aparece claramente (fica sobreposto ao rover).
- **Arquivos:** `src/render/scene.ts` (`iceMarker`, `SITE.ice`).
- **Aceite:** captura com tarefa de gelo na fila, em que o marcador esteja visível fora do rover (ajustar posição do marcador ou tamanho).

### T4. Antena: aviso antecipado de tempestade (D-01, decidido) — **feita**
- **Arquivos:** `src/engine/space-weather.ts` (função pura + teste), `src/ui/hud.ts` (aviso), `src/i18n.ts`, `src/school.ts`.
- **Aceite:** com antena instalada, o HUD mostra aviso quando há tempestade nas próximas 6 h; sem antena, não mostra. Teste do motor cobre as duas situações. Nenhum recurso muda.

### T5. Animação de instalação do painel e da antena
- **Arquivos:** `src/render/scene.ts` (unidades de painel e antena).
- **Aceite:** quando a tarefa termina, o item surge com transição curta (escala ou subida), e não de repente. Não muda o motor.

### T6. Revisão de texto da interface (B3.1)
- **Arquivos:** `src/i18n.ts`, `src/school.ts`, `index.html`.
- **Aceite:** textos em inglês claros, sem termo técnico no modo padrão; português revisado; testes de idioma passando.

### T7. Pausa com captura confirmada
- A tela de pausa já foi capturada (`pause-m.png`). Falta confirmar Esc e o botão em execução real (teste com teclado, se possível).
- **Aceite:** Esc pausa e retoma; "Menu principal" volta à tela inicial com partida nova.

### T8. Câmera seguindo o rover (D-03, decidido; baixa prioridade)
- **Arquivos:** `src/render/scene.ts` (`controls.target`).
- **Aceite:** botão "Seguir robô" que move o alvo da órbita para o rover, com transição suave; "Visão da base" volta.

### T9. Desempenho medido
- Medir quadros por segundo e tempo de carregamento dos GLB (`npx vite`, navegador real). Hoje não há medida.
- **Aceite:** número registrado no diário. Se passar de 30 quadros por segundo em notebook comum, ok; senão, reduzir sombras ou o GLB do rover (219 KB).

### T11. Reações visuais da tripulação (D-08)
- **Aceite:** ao aviso da antena, acenam; ao início da radiação, andam até a escotilha; sem regra nova. Captura revisada.

### T12. Astronauta ajuda o gelo (D-06)
- **Aceite:** tarefa de gelo com ajuda termina em 4 h; sem ajuda, 6 h. Testes do motor com e sem ajuda. Captura do rover no local com astronauta ao lado.

### T13. Astronauta colhe na estufa (D-07)
- **Aceite:** com a estufa ligada, +10 de comida a cada 12 h (até 100). Teste do motor. Animação de colheita na estufa.

### T14. Abrigo e exposição à radiação (D-05) — **feita** (ver `docs/DECISOES.md`)
- **Aceite:** tripulação fora na radiação acumula exposição; 1 coração a cada 6 h. Testes do motor (com e sem abrigo). Penalidade ajustável só com partida passando.

### T10. Demo e envio (só com pedido do autor)
- Vídeo de 30 s ou 7 slides em inglês; referências; declaração de IA em inglês. Ver `docs/event-rules.md`.
- **Não envie nem publique nada sem pedido explícito.**

## 7. Pontos de decisão (decididos em 14/11 com delegação do autor, ver `docs/DECISOES.md`)

Decididos: antena dá aviso antecipado de tempestade (D-01); astronautas sem tarefas de jogo (D-02); "Seguir robô" como botão opcional (D-03). Continuam **só do autor**: qualquer número de regra de jogo, push e envio.

Regra antiga, mantida:

- Mudança de regra de jogo (capacidade da bateria, limiares, tempos de tarefa). Qualquer número de jogo muda o equilíbrio; reteste com `tests/engine/partida.test.ts`.
- Qualquer push, publicação, envio de formulário.
- Trocar o idioma padrão ou a identidade visual.

## 8. Problemas conhecidos (para não confundir com trabalho novo)

- Animação dos braços em um quadro parece solta (T1).
- Cancelar tarefa reinicia o trajeto do rover a partir de onde ele está (andando de volta); não é teletransporte, mas não foi medido em tela.
- Sem pausa com teclado verificada em navegador real.
- O rover aparece rodando as rodas ao voltar; verificar se o movimento fica natural.
- Astronautas, rover e base são geometria simples (padrão ainda longe do Astroneer). Não é bug; é escopo de arte.
- O horizonte é medido só no morro (site inicial). Encosta e borda existem no motor, mas a tela só usa o morro.

## 9. Diário e entrega do trabalho

Ao concluir cada tarefa:
1. Rode typecheck, vitest, build.
2. Tire a captura, revise de fato (não só o arquivo existe).
3. Acrescente uma entrada em `docs/execution-log.md`: data, o que mudou, arquivos, comandos e resultados (com falhas), o que não foi verificado.
4. Atualize `docs/INTERACTION_MAP.md` se mudou comportamento de componente.
5. Commit local com Conventional Commits e `Co-Authored-By`.
6. Não faça push.

Se algo não puder ser verificado, escreva isso no diário. Não declare pronto sem verificação.

## 6b. Trabalho de arte para o nível visual (D-09)

O autor decidiu que a cena deve chegar ao padrão de arte. O código atual é funcional, mas os modelos são geometria simples. Estas tarefas são de arte e devem seguir `docs/VISUAL_DIRECTION.md` (paleta, formas arredondadas, leitura clara).

### T15. Habitat com detalhe de arte
- **Arquivos:** `assets-src/blender/build_assets.py` (`build_habitat`), `public/models/habitat.glb`.
- **Aceite:** módulo com proporções definidas, painéis e vigas visíveis, iluminação de janelas coerente com a paleta; captura desktop revisada por humano.

### T16. Rover com leitura de robô
- **Arquivos:** `build_rover`, `public/models/rover.glb`, e `src/render/scene.ts` se as rodas precisarem de nós novos.
- **Aceite:** chassi, sensores, mastro e rodas bem legíveis a 20 m; rodas giram na viagem; farol visível. Peso do GLB reduzido sem perder detalhe principal.

### T17. Astronauta e base com acabamento
- **Arquivos:** `build_astronaut`, `build_greenhouse`, `build_solar_panel`, `build_antenna`.
- **Aceite:** astronauta legível (capacete, viseira, mochila) em câmera próxima; estufa com plantas visíveis quando ligada; painéis com células visíveis; antena com prato reconhecível.

### T18. Revisão visual humana
- Após T15 a T17, captura desktop e celular revisada por uma pessoa (não só pelo agente). Se a revisão não aprovar, volta para o ajuste.
- **Aceite:** registro no diário com a decisão de quem revisou.
