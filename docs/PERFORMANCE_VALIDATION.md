# Validação de desempenho e carregamento — 15/11/2026

Solicitação: observador/azimute, desempenho móvel, carga fria/sessões longas, pacote e expansão astronômica. Estado científico em [data-sources.md](data-sources.md); tarefas em [backlog.md](backlog.md).

## Método e alcance

- Chromium Playwright, ANGLE Vulkan, Intel Xe/Mesa, build de produção servido somente em `127.0.0.1`. JS/CSS comprimidos por gzip no servidor de teste, cache desabilitado.
- Desktop: 1280×800. Móvel **emulado**: 390×844, DPR 2, toque, CPU limitada a ¼, rede 1,6 Mbps down / 750 kbps up / 150 ms. A GPU continua sendo Intel Xe; não equivale a aparelho real nem ensaio térmico.
- `adb devices -l` retornou lista vazia. O teste físico depende de aparelho disponível; não foi declarado concluído.
- Medições por `PerformanceObserver` (long tasks), rAF, CDP (heap/DOM após GC) e instrumentação de criação/exclusão WebGL. Contadores medem recursos vivos, não bytes VRAM. `renderer.info` é registrado no diagnóstico `?perf=1`.
- Sessão de 30 minutos: reiniciar pelo menu, alternar qualidade 1024/2048, focar estufa/tripulação/rover/energia, abrir Ciência e alternar exposição. Amostras após GC a cada quatro ciclos. A coleta não cria outro renderizador.
- Outros testes GPU ocorreram durante parte do ensaio prolongado. Seus FPS não são tratados como benchmark isolado; contadores de recursos pertencem ao contexto observado. Carga fria e perfil final separados identificam o build usado pelo nome/hash do JS.

## Resultados

Primeira rodada, `index-CjRZwghI.js` (385,17 kB gzip no Vite, antes de acrescentar os outros dois sites solares):

| Perfil | Menu visível | HUD após iniciar missão | Observações |
|---|---:|---:|---|
| Desktop | 1,57 s | 5,19 s | 4 long tasks; maior 276 ms; quadros de até 500 ms no período com carga/entrada |
| Móvel emulado | 13,01 s | 17,16 s | 95 long tasks até a primeira coleta; maior 1018 ms; quadro de até 1449,8 ms; ainda havia assets chegando |

Os tempos de HUD incluem os cliques automatizados de escolha de modo e pular introdução; não representam tempo de CPU puro. O menu pode abrir pelo fallback de 9 s mesmo com assets incompletos. Os FPS dessas janelas incluem carregamento e transições.

**Sessão prolongada concluída:** 1804,38 s (**30 min 4 s**), **73 ciclos**, zero erros JS, zero perdas de contexto e um único canvas. Build medido: `index-CjRZwghI.js`, com o observador peak corrigido e dados compactos, antes de acrescentar as tabelas solares dos outros sites e validações do decoder. Essas tabelas não mudam o caminho peak usado no ensaio; a revisão final também passa por carga/E2E separados. Não apresentar este ensaio como se tivesse carregado outro hash de build.

| Recurso | Patamar após primeiros ciclos | Final |
|---|---:|---:|
| Texturas WebGL vivas | 16 | 16 |
| Framebuffers vivos | 4 | 4 |
| Buffers vivos | 638 | 638 |
| Programas vivos | 25 | 25 |
| Vertex arrays vivos | 455 | 455 |
| Shaders vivos após link | 0 | 0 |
| Three geometrias / texturas | 203 / 12 | 203 / 12 |

Foram criadas/excluídas 162/146 texturas e 77/73 framebuffers; o saldo permaneceu 16/4 durante as trocas de qualidade. Heap JS após GC: **15.255.308–16.147.720 bytes**, final **15.662.252**; listeners DOM estabilizaram em 112. A geometria adicional em relação ao aquecimento inicial (202 → 203) aparece na primeira seleção e não cresce a cada ciclo. Esses resultados não confirmam vazamento contínuo no fluxo ensaiado; não provam descarte de todos os provisórios. Não é sessão única cobrindo todos os estágios de uma missão de 708 h nem teste térmico de telefone.

Artefatos: `.scratch-agent/astronomy-followup/performance.json`; carga final em `final-load/performance.json`. O rascunho é ignorado pelo git e pode ser regenerado pelos comandos abaixo.

### Carga final, build `index-D0O8Hid3.js`

Rodada sequencial, sem outro teste GPU deste trabalho em paralelo, cache desabilitado. A máquina continua sendo ambiente compartilhado; não foi controlada termicamente. Não comparar esses FPS com outra rodada como prova de regressão causada pela compactação.

| Perfil | Menu | HUD | Rede ociosa após cliques | FPS na janela de 5 s após carga | P95 / maior frame dessa janela |
|---|---:|---:|---:|---:|---:|
| Desktop | 2,56 s | 6,00 s | 6,07 s | 23,47 | 133,3 / 433,3 ms |
| Móvel emulado | 14,10 s | 18,87 s | 38,12 s | 13,42 | 116,7 / 300 ms |

No período frio móvel, maior frame **2816,6 ms** e maior long task **1870 ms**; no desktop, 833,3/445 ms. Ambos terminaram com zero erros JS/context loss, 202 geometrias/12 texturas e sem rolagem horizontal. Foram transferidos **6,998 MB** por perfil incluindo assets; JS transferido pelo servidor gzip nível 9: **397.553 bytes** (o Vite reporta 403,54 kB com sua configuração de gzip). Os últimos assets móveis responderam em 37,50 s desde a navegação. A prontidão de rede inclui o tempo gasto nos cliques e não é uma medição de duração pura dos downloads.

**Conclusão restrita:** há problemas reais de carga/resposta nesse perfil e o cenário final não sustenta uma promessa de 60 FPS. Menor pacote não resolveu o orçamento de renderização/carga. É necessário atribuir CPU/GPU por fase, comparar qualidade e medir aparelhos físicos; os ensaios não identificam isoladamente a causa das oscilações entre rodadas.

E2E visual final no servidor dev: **36 verificações aprovadas**, zero erros JS/GLSL, desktop e celular emulado revisados. Três janelas de 3 s no cenário/câmera de referência deram 31,45 / 28,81 / 26,89 FPS, P95 83,3 / 83,4 / 50,1 ms e maior frame 1033,3 ms. São medições desse cenário e dessa máquina; não equivalem ao perfil de produção frio nem a GPU móvel.

## Pacote e precisão dos dados

- Referência anterior: **2.730,98 kB JS / 645,49 kB gzip**.
- Céu: de **1.741.736 bytes JSON / 384.046 bytes gzip** para **372.003 / 126.728 bytes**. Colunas/deltas, remoção de campos sem uso por corpo e proveniência fora do runtime; nenhuma hora excluída.
- Build com os três sites solares: **1.434,50 kB JS / 403,54 kB gzip**, redução de **37,5%** sobre a referência. Saída final: `index-D0O8Hid3.js`.
- Erro de quantização ≤ 0,00000051 por campo na unidade original. Replay Python confere todos os valores retidos; fixtures TS conferem amostras Horizons independentes e atributos da Terra. Deltas inválidos/grades truncadas são rejeitados.
- Continua existindo aviso de chunk >500 kB não comprimido. O download também contém modelos e texturas; a redução do JS não resolve por si só as travadas de carregamento.

## Achados e tarefas posteriores

### AST-PERF-01 — High — travadas na carga fria confirmadas; causa detalhada em investigação

1. **Onde:** `src/main.ts`, seção Carregamento (`models.then`, `renderer.compile`, fallback de 9000 ms); `scripts/validate-performance.py`, etapas de carga e primeira coleta.
2. **Evidência:** no perfil emulado especificado, long task de até 1870 ms e quadro de 2816,6 ms na rodada final; menu/HUD apareceram com modelos ainda chegando. Não há prova de que todos esses tempos venham de shaders.
3. **Causa provável:** combinação de download/decodificação de assets, compilação e upload GPU síncronos e trabalho do primeiro render. Atribuição por stack/trace ainda é necessária.
4. **Impacto:** jogador vê placeholders e pode experimentar ordens/controles atrasados por segundos durante a entrada.
5. **Reprodução:** build + servidor gzip; executar o perfil móvel frio conforme comandos abaixo, mantendo cache desabilitado e registrando o hardware.
6. **Correção recomendada:** perfilar stacks de CPU/GPU por fase; avaliar `compileAsync`, escalonar uploads, reduzir assets dominantes e explicitar carregamento pendente no menu. O fallback não deve apresentar uma cena incompleta como totalmente pronta.
7. **Teste de aceite:** repetir carga fria isolada em desktop e aparelho alvo; registrar menu, HUD, término dos assets, maior long task e frame-time; comparar com baseline e confirmar que o fallback continua utilizável em falhas de rede. Fixar orçamento com base nos aparelhos escolhidos.

### AST-PERF-02 — Medium — desempenho móvel real e orçamento de sombras pendentes

1. **Onde:** `src/render/scene.ts:setQuality` e `src/main.ts:frame` (sombras por quadro/cadência); ajustes de qualidade em `src/ui/screens.ts`.
2. **Evidência:** no perfil emulado, houve degradação abaixo de 30 FPS. `frame` força atualização de sombras a cada quadro quando o frame anterior excede ~33 ms, aumentando o trabalho justamente sob carga. A causalidade/ganho de mudar a política ainda não foi medido isoladamente.
3. **Causa provável:** custo de draws, sombras e CPU; emulação não limita a GPU como um telefone.
4. **Impacto:** resposta e animações degradadas em dispositivos de menor capacidade.
5. **Reprodução:** executar qualidade alta/baixa em GPU móvel real, com câmera e hora fixadas; repetir após aquecimento térmico.
6. **Correção recomendada:** medir cada passe e a política de sombras; considerar qualidade inicial conservadora ou adaptação com histerese, preservando orientação/ocultação científicas.
7. **Teste de aceite:** matriz de aparelhos, P50/P95/P99 de frame-time, input até feedback e carga fria; testar transições de qualidade e sessão térmica sem perda de contexto. O orçamento deve ser declarado, não inferido de um desktop.

**DT-15:** estabilidade de contadores em reinícios pode descartar acúmulo contínuo nesse caminho, mas não prova descarte de todos os provisórios nem cobre falha de asset/context restore. Não encerrar a dívida inteira com esse ensaio.

## Reproduzir

```bash
npm run build
python3 -B scripts/serve-validation.py 5189
# Em outro terminal:
python3 -B -u scripts/validate-performance.py 5189 1800
# Só carga/rodada curta, com saída separada:
python3 -B -u scripts/validate-performance.py 5189 0 .scratch-agent/astronomy-followup/final-load
```

O build e os assets devem permanecer fixos durante cada medição. Se executar benchmarks GPU simultâneos, identificar contenção e não comparar FPS como se fossem amostras isoladas.
