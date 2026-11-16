# Earthset · Instruções permanentes para agentes de IA

Ponto de entrada para **qualquer agente** neste repositório (Claude Code via `CLAUDE.md`, Codex ou outro). Este arquivo tem só regras permanentes. O código é a verdade sobre o comportamento do jogo.

---

## 0. Documentos do repositório

| Documento | Papel |
|---|---|
| `README.md` | Apresentação do jogo, execução, deploy e limitações (inglês, material de envio) |
| `AGENTS.md` | Regras permanentes de desenvolvimento (este arquivo) |
| `CLAUDE.md` | Instruções específicas do Claude Code (importa este arquivo) |
| `AI_DISCLOSURE.md` | Declaração de uso de IA |
| `docs/regras-recursos.md` | Regras e números de recursos, equipamentos, corações e robô |
| `docs/data-sources.md` | Fontes e proveniência científica |
| `docs/ART_ASSET_PIPELINE.md` | Ativos de terceiros, licenças e geração dos modelos |
| `docs/PERFORMANCE_VALIDATION.md` | Medições de desempenho e carga |
| `docs/references.md` | Lista de referências (material de envio, em inglês) |

---

## 1. Projeto

- **O quê:** jogo 3D no navegador para o NASA Space Apps Challenge 2026 (*Junior Astronaut Mission Trainer*). O jogador administra uma base no polo sul da Lua durante um dia lunar de 708 horas de jogo. Vence chegando à hora 708 com pelo menos 1 coração. Perde quando os 3 corações acabam.
- **Para quem:** banca de julgamento e estudantes (modo escola).
- **Autor:** Christian Mendes (`dev-christianmendes`), projeto solo.
- **Ferramentas de IA declaradas:** Claude Code (modelos Haiku, Sonnet e Opus) e Codex (gpt6-luna), em `AI_DISCLOSURE.md`. Outra ferramenta só é usada depois de declarada lá.

---

## 2. Regras que valem sempre

1. **Motor separado.** `src/engine/` é TypeScript puro: não importa three.js, DOM nem `window`. Regra de jogo fica no motor e é testada com Vitest. O CI verifica isso (job `boundary`).
2. **Demo sempre jogável.** Ao fim de cada mudança, typecheck, testes e build passam, e o jogo abre.
3. **Dado com fonte.** Número científico tem origem em `docs/data-sources.md`. O que for ilustrativo ou regra de jogo fica marcado no código e na tela.
4. **Verificação antes de "pronto".** Pronto = `npm run typecheck`, `npm run test` e `npm run build` passando. Se a mudança mexeu em tela, a tela foi vista em desktop e celular.
5. **Cabeçalho de IA** em todo `.ts` criado ou alterado com IA. Primeira linha:
   `// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.`
6. **Idioma.** A interface abre em **inglês** e tem botão para **português do Brasil**. A documentação interna fica em português. README, página de envio e materiais linkados ficam em **inglês**.
7. **Nada sai da máquina sem pedido.** Sem `git push`, publicação, deploy ou commit sem pedido explícito do autor. Criar arquivos é permitido; enviar, não.
8. **Sem marca da NASA** (logotipo, insígnia, bandeira ou patch) em assets ou na tela. Ativos de terceiros só entram com licença verificada na fonte e registrada em `docs/ART_ASSET_PIPELINE.md`.
9. **Registro.** Mudanças relevantes são descritas na mensagem de commit ou no PR, com comandos e resultados de verificação, inclusive falhas.
10. **Crianças.** Nenhuma foto, vídeo, voz ou imagem de menor de 18 anos entra na demo ou no envio.
11. **Sem IA generativa como ativo nem em tempo de jogo.** A LUMA usa regras fixas. Imagem ou modelo gerado por IA não é usado como ativo final.
12. **Fatos ficcionais nunca são apresentados como medição da NASA.**
13. **Código legível sem narração.** Comentários ficam restritos a contratos não evidentes, unidades, invariantes, justificativas científicas, fontes/licenças e diretivas de ferramentas. Não repetir nomes, tipos ou instruções; não acrescentar banners de seção nem histórico de etapas ao código. O cabeçalho de IA da regra 5 permanece obrigatório.

---

## 3. Como rodar e verificar

Pré-requisito: **Node 24** (o CI usa 24). Gerenciador: npm com `package-lock.json`.

| Comando | Para quê |
|---|---|
| `npm ci` | Instala dependências exatamente como no lockfile |
| `npm run dev` | Servidor de desenvolvimento (Vite), porta padrão 5173 |
| `npm run typecheck` | `tsc --noEmit` (strict, `noUnusedLocals`, `noUnusedParameters`) |
| `npm run test` | Vitest: testes do motor, astronomia, interface e partidas completas |
| `npm run build` | Typecheck + build estático em `dist/` |
| `npm audit --omit=dev` | Auditoria das dependências de produção |
| `python3 -B -m unittest discover -s data-pipeline/tests` | Testes dos pipelines Python |

**Verificação visual** (obrigatória se a mudança mexeu em tela). Em um servidor de desenvolvimento, use uma porta livre, por exemplo `npx vite --port 5180 --strictPort`, e confira que o título da página começa com "Earthset ·". Scripts de navegador em `scripts/` (Playwright) cobrem o menu, o HUD, os painéis e o celular.

Atalhos de captura (só `npm run dev`): `?autostart=cadet&hour=24&task=ice&after=2&tool=rover&shot=rover`, `?autostart=cadet&clockAt=300`, `?screen=modes&lang=pt`.

---

## 4. Mapa do código (camadas)

| Camada | Pasta | Regra |
|---|---|---|
| Motor | `src/engine/` | Funções puras. Sem three.js, DOM ou `window`. Dona de recursos, tempo, Sol, horizonte, clima, robô, astronautas e partida |
| Astronomia | `src/astronomy/` | Cálculos de céu sobre as tabelas de efemérides (posição, visibilidade, situação da Terra). Sem three.js |
| Cena | `src/render/` | Three.js. Só **lê** o estado; não recalcula regra |
| Interface | `src/ui/` | DOM. Lê o estado e envia **ações** validadas pelo motor |
| Dados | `src/data/` | Tabelas JSON geradas por `data-pipeline/`. Não editar à mão |
| Entrada | `src/main.ts`, `src/i18n.ts`, `src/school.ts` | Laço do jogo e ligação entre as camadas |
| Testes | `tests/` | Vitest. `tests/engine/partida.test.ts` roda partidas completas |
| Pipelines | `data-pipeline/*.py` | Python, offline, com testes em `data-pipeline/tests/` |
| Assets | `assets-src/` (fontes e scripts Blender), `public/` (arquivos servidos) | Ver `docs/ART_ASSET_PIPELINE.md` |


### 4.1 Modelo do motor

- **`GameState`** (`src/engine/game.ts`): `clock`, `installation` (rank, site, panels, batteryCapacity, greenhouse), `vitals` (bateria de 0 até a capacidade; ar, água e comida de 0 a 100), `robot` (fila e `antennaInstalled`), `hearts` (0 a 3), `vitalZeroHours`, `crop` e `agents` (astronautas).
- **Ações** (`dispatch(state, action)`): objetos com `type` (`GameAction`). Toda ação é validada e devolve `{ ok: true, state }` ou `{ ok: false, reason }`. Nunca altera o estado de entrada. A `reason` é texto em português, mostrado ao jogador.
- **Tempo** (`advance(state, dtHours, sunlit, weather)`): aplica o fluxo por hora, avança o robô e os astronautas, aplica o efeito das tarefas concluídas e atualiza corações. Para em 708 h. Lança `RangeError` com hora negativa ou não finita.
- **Robô:** só trabalha com tarefa na fila **e** bateria acima de zero.

### 4.2 Constantes e onde mudar

| Constante | Arquivo | Valor | Observação |
|---|---|---|---|
| `MATCH_HOURS` | `src/engine/clock.ts` | 708 | Duração do dia lunar |
| `HOURS_PER_HEART_LOSS` / `MAX_HEARTS` | `src/engine/game.ts` | 6 / 3 | Corações |
| `PANEL_OUTPUT_PER_HOUR` | `src/engine/resources.ts` | 0,9 | Por painel, com Sol |
| `BASE_LOAD_PER_HOUR` | `src/engine/resources.ts` | 0,8 | Consumo fixo |
| `RANK_FACTOR` | `src/engine/resources.ts` | 0,75 / 1 / 1,15 | Patentes do motor |
| `MAX_QUEUE` / `MAX_PANELS` / `ROBOT_LOAD_PER_HOUR` | `src/engine/robot.ts` | 4 / 12 / 1,0 | Fila, painéis e consumo do robô |
| `TASK_HOURS` | `src/engine/robot.ts` | gelo, painel e antena | Trechos pela rota real do rover |
| `INSTALLATION` (partida inicial) | `src/main.ts` | site `peak`, 2 painéis, capacidade 1000, estufa `surplus` | **Equilíbrio de jogo**, não dado científico |

**Equilíbrio.** A referência é a partida de `tests/engine/partida.test.ts`, com Sol e horizonte medidos (observador LOLA): vence com 3 corações; a base passiva, sem robô, perde. Qualquer mudança em número de fluxo precisa de `npm run test`. Justificativa de cada número: `docs/regras-recursos.md`.

---

## 5. Como acrescentar uma regra ou uma ação

1. Leia a regra em `docs/regras-recursos.md`.
2. Escreva a regra no **motor** (`src/engine/`), sem three.js nem DOM. Se for dado científico, registre a fonte em `docs/data-sources.md`; senão, marque como ilustrativo.
3. Ação do jogador: adicione o tipo em `GameAction`, valide em `dispatch` com motivo em português e teste em `tests/engine/`.
4. Testes: unitários do módulo novo e, se a regra afeta o equilíbrio, um caso de partida completa em `partida.test.ts`.
5. Tela: ligue em `src/main.ts` e `index.html`. Textos em português e inglês (`src/i18n.ts`).
6. Rode typecheck, testes e build. Tire screenshot desktop e celular se mexeu em tela.
7. Atualize `docs/regras-recursos.md` se a regra mudou.
8. Cabeçalho de IA nos `.ts` criados ou alterados.

---

## 6. Convenções

- **Commits** (só com pedido): Conventional Commits em português, por exemplo `feat(motor): robô com fila de tarefas`, `fix(cena): ...`, `test(motor): ...`.
- **Pull requests:** descrição do que mudou, como foi verificado (comandos e screenshot).
- **Nomes:** identificadores em inglês ou português técnico já usado (`advance`, `dispatch`, `installation`, `vitals`). Textos da interface e comentários de regra em português.
- **Motor:** funções puras, sem efeitos colaterais. Entradas inválidas viram `{ ok: false, reason }` em ações ou `RangeError` em funções de tempo.
- **Testes:** `describe` por unidade; nomes em português descrevendo o comportamento.
- **CI** (`.github/workflows/ci.yml`): job `verify` (typecheck, testes, build, auditoria, artefato do `dist`) e job `boundary` (falha se `src/engine` importar three.js ou usar `document`, `window` ou `HTMLElement`). Dependabot abre PRs semanais: revisar antes de aceitar.
- **Deploy:** configurado para a Vercel em `vercel.json`. Não publicar sem pedido.
