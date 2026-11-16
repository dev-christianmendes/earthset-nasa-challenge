# Teste exploratório de uso e UX — 15/11/2026

**Atualização posterior:** UXR-01 a UXR-07 corrigidos e revalidados localmente em 15/11. A evidência original abaixo foi preservada; resultados da correção na seção final.

## Escopo e versão

Entrei pelo menu, li a ajuda, escolhi Cadete, acompanhei/pulei a introdução e joguei usando os controles da interface. Na primeira sessão cheguei à hora 78, concluí extrações de gelo, instalei dois painéis adicionais (total 4), reparei a antena e alcancei o capítulo 5. Abri tripulação, estufa e ciência, alternei 1×/2×/4×, pausei e troquei EN→PT. Não foi uma partida completa de 708 h.

Como havia desenvolvimento paralelo, usei cópias estáveis da aplicação. A primeira está identificada por SHA-256 em `.scratch-agent/ux-playtest/source-manifest.json`. Depois repeti os casos na cópia do commit **6c1755c** (D-21–23), identificada por `current-manifest.json`. O commit posterior b9e7ca9 adicionou previsão de água; não foi jogado integralmente nesta revisão. Os sete achados abaixo foram reproduzidos em 6c1755c. Os arquivos/linhas indicam essa versão; conferir antes de corrigir.

Chromium/Playwright com ANGLE Vulkan na GPU local. Desktop 1280×800, janela compacta 780×493 e móvel emulado 390×844/DPR2. Sem `autostart`, `clockAt`, import do motor ou alteração de recursos por código. A automação leu DOM/acessibilidade, usou cliques, toque e teclado e registrou capturas. Pausas entre blocos evitaram que o tempo de investigação fosse contado como tempo de reação de um jogador.

É um teste exploratório por agente, não pesquisa com jogadores reais ou medição em telefone físico. Não inferir satisfação de estudantes ou desempenho móvel físico desses resultados.

## Priorização dos problemas confirmados

| ID | Severidade | Problema |
|---|---|---|
| UXR-01 | Medium | Parte do menu fica inacessível em janela baixa |
| UXR-02 | Medium | Sete botões da barra móvel não têm nome acessível |
| UXR-03 | Medium | O foco de Configurações escapa para controles do jogo |
| UXR-04 | Medium | Tutorial e toast se sobrepõem no móvel |
| UXR-05 | Low | Valores de recursos ficam colados no HUD móvel |
| UXR-06 | Low | Mensagem de fila cheia mostra `{max}` literal |
| UXR-07 | Low | Cabeçalho de painel aberto não acompanha troca de idioma |

### UXR-01 — menu recortado sem rolagem utilizável

- **Arquivo/linha:** `src/ui/styles.css:26` (`overflow: hidden` global), `:59–70` (menu e rodapé), `:323` (breakpoint por largura).
- **Evidência:** em 780×493, o botão Português começa em y≈546,4 e tem 44 px de altura. Continua fora da tela após rolar 1000 px; o clique normal não consegue alcançá-lo. Créditos também ficam abaixo da área visível. Captura `compact-menu.png`.
- **Causa provável/impacto:** conteúdo do menu excede a altura disponível sem um contêiner rolável próprio. Usuários em janela baixa perdem acesso a idioma e opções inferiores; não é ausência do botão no DOM.
- **Reproduzir:** abrir o menu em 780×493, tentar rolar até Português/Créditos e clicar.
- **Correção recomendada:** permitir rolagem vertical no menu e adaptar espaçamento/rodapé à altura, preservando a cena do jogo sem rolagem.
- **Teste de aceite:** todos os itens alcançáveis por mouse, toque e teclado em 780×493, 844×390 e 320×568; conferir também desktop normal. Elemento existente fora da tela não basta.

### UXR-02 — barra de sistemas móvel sem nomes

- **Arquivo/linha:** `index.html:233–240`; `src/ui/styles.css:339`.
- **Evidência:** a árvore de acessibilidade móvel contém sete botões com `name: ""`. Seus rótulos estão em `<small>`, ocultado por `display:none`; os botões não têm `aria-label`. A seleção por nome “Rover” falhou, enquanto o toque no ícone funcionou. Os novos cartões da equipe têm nomes e não corrigem os botões da barra.
- **Causa provável/impacto:** o texto foi retirado também da árvore acessível. Leitor de tela/controle por voz perde identificação de Base, Rover, Tripulação, Energia, Estufa, Missões e Ciência; usuários novos também precisam deduzir os ícones.
- **Reproduzir:** iniciar em 390×844 e inspecionar/navegar pelos botões inferiores com tecnologia assistiva.
- **Correção recomendada:** nomes EN/PT explícitos ou texto visualmente oculto que permaneça acessível; preservar identificação dos contadores de fila separadamente.
- **Teste de aceite:** os sete sistemas localizáveis por papel/nome em ambos os idiomas e viewport móvel, incluindo com badge de fila.

### UXR-03 — foco atravessa o painel de Configurações

- **Arquivo/linha:** `src/ui/screens.ts:18–22`; apresentação de Configurações/pausa em `index.html`.
- **Evidência:** com Configurações aberta a partir da pausa, focar Voltar e pressionar Tab leva a `#speed-btn`, no HUD atrás do painel. O registro tem `inSettings:false`; não se manteve o foco nos controles apresentados.
- **Causa provável/impacto:** a pilha troca `hidden`, mas não administra foco ou inércia do conteúdo ao fundo. Navegação por teclado sai da tarefa atual e pode alcançar controles encobertos. Não foi necessário afirmar uma mutação de recursos para demonstrar o problema.
- **Reproduzir:** Pausa → Configurações → navegar até Voltar → Tab/Shift+Tab.
- **Correção recomendada:** definir o comportamento modal, mover foco ao abrir, restringir a navegação ao painel ativo e restaurar o foco ao fechar.
- **Teste de aceite:** Tab/Shift+Tab permanecem no painel; Escape/Voltar restauram um destino previsível; controles encobertos não são ativados por Enter.

### UXR-04 — duas orientações ocupam a mesma região no móvel

- **Arquivo/linha:** `src/ui/styles.css:295`, `:471–473`; `src/main.ts:497–502`.
- **Evidência:** em 390×844, o coach fica em `[12,160,366,139,6]` e o toast em `[97,5,160,195,183]` (x/y/largura/altura em CSS px). Ambos começam em y160, com textos sobrepostos. A LUMA ocupa mais 225 px de altura embaixo. A confirmação de ordem também disputa espaço com o passo 3. Capturas `mobile-onboarding.png` e `mobile-rover-panel.png`.
- **Causa provável/impacto:** canais independentes de orientação usam a mesma âncora, sem coordenação. O jogador recebe instruções redundantes/encobertas justamente ao tentar descobrir como agir.
- **Reproduzir:** Cadete → pular introdução → aguardar a dica de 5 s; selecionar rover e pedir gelo com o coach ativo.
- **Correção recomendada:** priorizar um canal de orientação por vez; suprimir a dica genérica durante o coach, reservar espaço entre mensagens e manter alertas críticos resumidos com detalhes consultáveis.
- **Teste de aceite:** retângulos de texto não se sobrepõem nas etapas iniciais e na confirmação de ordens em 390×844; a prioridade de alertas não se perde ao minimizar/dismissar orientação.

### UXR-05 — separação insuficiente entre números do HUD

- **Arquivo/linha:** `src/ui/styles.css:324–333`; recursos e controles em `index.html:214–225`.
- **Evidência:** no móvel, a faixa de texto “79%” começa em x22 e mede 33,516 px; “85” do ar começa em x54,859. As caixas de texto se interceptam por aproximadamente **0,66 CSS px**, na mesma linha y74. A captura mostra leitura colada “79%85”. Isso é uma interseção de caixas/legibilidade observada, não uma medição de perda de dados.
- **Causa provável/impacto:** a coluna de recursos encolhe para acomodar vidas e controles, sem espaço mínimo suficiente para os valores. Reduz a clareza de informação crítica, especialmente porcentagens.
- **Reproduzir:** jogo em 390×844 com qualidade e controles padrão.
- **Correção recomendada:** reservar largura para números, reorganizar linhas/controles em tela estreita e manter associação inequívoca entre valor e recurso.
- **Teste de aceite:** separar os valores em larguras estreitas, cobrindo percentuais de 0 a 100 e números de 1–3 dígitos. O agravamento com “100%” é um cenário a testar, não foi observado nesta sessão.

### UXR-06 — parâmetro de mensagem não preenchido

- **Arquivo/linha:** `src/ui/context-panel.ts:126–128`; texto `reason.queue-full` em `src/i18n.ts`.
- **Evidência:** ao enfileirar gelo, dois painéis e antena durante a radiação, os botões indisponíveis exibem **“Queue full (max {max} tasks).”**; a sessão PT anterior mostrou **“Fila cheia (máximo de {max} tarefas).”** Captura `rover-eta-after7s.png`.
- **Causa provável/impacto:** `whyNot` traduz o motivo sem os parâmetros que o texto exige. A capacidade da fila não é apresentada corretamente no ponto de recusa.
- **Reproduzir:** preencher quatro posições da fila e ler o motivo das missões indisponíveis.
- **Correção recomendada:** centralizar tradução dos motivos com parâmetros, inclusive MAX_QUEUE/MAX_PANELS, como no feedback da ação.
- **Teste de aceite:** fila cheia informa o número correto em EN/PT, sem placeholders literais; testar também o limite de painéis.

### UXR-07 — tradução incompleta do cabeçalho

- **Arquivo/linha:** `src/ui/hud.ts:70–75`, `:90–96`; callback `onLanguage` em `src/main.ts`.
- **Evidência:** Ciência aberta em inglês → pausa/configurações → Português → continuar: conteúdo e barra passam a português, mas `#side-title` permanece **“Science”**. Captura `science-pt-heading.png`.
- **Causa provável/impacto:** o título é preenchido ao abrir/trocar ferramenta, não durante a atualização do idioma. A interface mistura idiomas até reabrir o painel.
- **Reproduzir:** manter Ciência aberta e trocar idioma pelo menu de pausa.
- **Correção recomendada:** atualizar o cabeçalho do painel já aberto ao relabelar, sem alternar/fechar a ferramenta.
- **Teste de aceite:** títulos, controles e conteúdo atualizam EN↔PT com cada painel aberto, mantendo seleção e estado.

## Achado anterior já corrigido e limites de interpretação

Na primeira cópia, uma ordem de gelo pausada por radiação prometia “cerca de 6 s”, ignorando a espera. Em 6c1755c isso foi revalidado: **“Starts when the radiation passes: about 13 s at 1×. Then 16 h of game time”**. O cartão da equipe também mostra a espera. Não reabrir esse achado como se ainda estivesse presente.

A confirmação da ordem no DOM levou cerca de 6,5–14,8 ms nos ensaios quentes locais. Isso não mede apresentação do frame nem exclui latência em carga fria/aparelho físico. A demora de execução observada no começo tinha motivo explícito: radiação. Convém testar com novatos se iniciar o tutorial nesse cenário prejudica compreensão; isso é hipótese de UX, não defeito científico confirmado.

Falha inicial de captura no navegador integrado, erro de localizador “Retomar” (o rótulo era “Continuar”) e tentativas de clicar sob a pausa não foram classificados como bugs do jogo. O favicon404 também não entrou na priorização.

## Reproduzir e evidências

`python3 -B -u scripts/e2e-ux-review.py 5173 .scratch-agent/ux-review` contra servidor Earthset identificado. O roteiro registra comportamentos/árvore acessível, usa toque no móvel e não altera o motor. Saída zero significa coleta concluída, não ausência de achados.

Artefatos locais em `.scratch-agent/ux-playtest/`: `session.jsonl`, capturas da partida, `probes/results.json`, `probes-current/results.json`, `repo-script/results.json`, cópias e manifestos de fonte. A pasta é ignorada pelo git; repetir o roteiro em outro clone. O script versionável completou a coleta em Chromium 130.0.6723.31; `repo-script/results.json` inclui os nove blocos de resultados e a captura após toque no rover. Nenhum arquivo de produto foi corrigido por esta auditoria, nem houve commit/push/deploy por este agente.

## Correções e revalidação posterior

O autor solicitou corrigir todos os sete achados e depois apontou o menu centralizado numa captura. As correções foram aplicadas ao workspace que também recebeu D-25–27 de outra sessão, preservando seus modelos, terreno, som e câmera. Nenhuma regra do motor ou dado científico foi alterado nesta etapa.

| Achado | Ajuste | Evidência de aceite |
|---|---|---|
| UXR-01 | Rolagem na tela de menu, rodapé no fluxo e alinhamento à esquerda | Mouse/toque, 14 Tab por tamanho, idioma e Créditos/Escape em 1920×924, 1280×800, 780×493, 844×390 e 320×568 |
| UXR-02 | `data-i18n-aria` nos sete botões; badge visual preservado | Sete sistemas localizados por papel/nome em EN/PT no móvel, com fila cheia |
| UXR-03 | Pilha guarda destino do foco; ciclo de Tab; telas/HUD/canvas inertes ao fundo | 24 Tab + 24 Shift+Tab em Configurações; Enter/Voltar/Escape restauram destino; hora e velocidade preservadas durante pausa |
| UXR-04 | Coluna de comunicação rolável, alertas antes de orientação; recibo substitui coach; dicas redundantes suprimidas | Três passos, confirmação e histórico por toque, sem colisão das áreas pintadas; alerta continua consultável após concluir/minimizar |
| UXR-05 | Linha própria para recursos; controles em outra linha em 320 px; relógio compacto deitado | 20 fixtures numéricas nos tamanhos 320×568, 390×844, 412×915, 667×375 e 844×390; 0/9/99/100 e %, menor separação entre números de **32 CSS px**; relógio/recursos/vidas/botões separados |
| UXR-06 | `src/ui/action-reason.ts` compartilhado pelo feedback e pelo painel | Limite 4 no navegador em EN/PT; quatro testes usando recusas reais do motor para fila e limite de 12 painéis |
| UXR-07 | Cabeçalho atualizado em `applyLanguage` com o painel aberto | Sete painéis em EN→PT e PT→EN, mantendo o painel selecionado |

Etiquetas de tarefas na cena também passaram a ficar atrás das barras permanentes, para não cobrir números ou botões. Avisos antigos são limpos ao reiniciar. O layout observa mudanças de tamanho, não acrescenta medições ao loop 3D. Em alturas curtas, a coluna de comunicação usa rolagem; não se promete mostrar todo o histórico e tutorial simultaneamente na tela.

**Comandos finais:** `npm run typecheck` passou; `npm run test` passou **291/291 em 33 arquivos**; `npm run build` passou (JS 424,05 kB gzip; aviso de chunk >500 kB sem compressão permanece). `python3 -B -u scripts/e2e-ux-regression.py 5198 .scratch-agent/ux-fixes/regression` passou **67/67 verificações**. Sintaxe Python e `git diff --check` também conferidos.

As fixtures numéricas mudam apenas o texto DOM com a partida pausada; não modificam recursos/estado do motor. As demais interações entram por menu, botões, toque e teclado, sem atalhos de desenvolvimento. Capturas finais vistas em desktop, móvel em pé e deitado. As limitações de aparelho físico e pesquisa com jogadores reais continuam válidas.

**Versão testada:** cópia estável em `.scratch-agent/ux-fixes/app`, porta 5198, com manifesto SHA-256 em `source-manifest.json`. Os nove arquivos de produto envolvidos na correção foram comparados byte a byte com o workspace ao finalizar. Isso evita atribuir recargas por HMR de outras sessões a defeitos do jogo. Dados/capturas finais: `regression/results.json`, `menu-1920x924.png`, `menu-bottom-320x568.png`, `hud-320x568.png`, `hud-844x390.png`, `mobile-first-step.png`, `mobile-order-received.png`, `mobile-alert-history.png` na pasta `.scratch-agent/ux-fixes/regression/` (ignorada pelo git; reproduzir com o roteiro).

Tarefas UXR-01 a UXR-07 encerradas no backlog e memória corrente atualizada em PROJECT_STATUS. Sem commit, push ou deploy nesta atividade.
