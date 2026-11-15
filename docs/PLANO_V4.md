# Earthset 4.0 · Plano de reformulação (experiência, arte, narrativa, jogabilidade)

Origem: pedido do autor de 14/11/2026, noite ("EARTHSET 4.0"). **Substitui** a ordem de `docs/archive/PLANO_CONSOLIDADO.md` a partir daqui. A direção visual continua a D-11 (Cinematic Scientific Sci-Fi), agora com estilo 3D estilizado de alta qualidade (D-16).

Identidade: **EARTHSET — One mission. One base. 708 hours to survive.**

## Regras que não mudam

- Motor puro em `src/engine/` (sem three.js/DOM), testado com Vitest; render só lê estado; UI só despacha ações validadas.
- Dados reais (JPL Horizons, LRO LOLA, NASA DONKI) intocados. Dificuldade vem de configuração de jogo explícita e testada, nunca de dado alterado.
- LUMA por regras, sem IA generativa nem API paga em tempo de jogo (D-12).
- Sem marca da NASA. Ativos de terceiros só CC0/domínio público, registrados (D-15). Nada gerado por IA como ativo.
- Fatos ficcionais da história nunca apresentados como medição da NASA.
- Sem commit/push sem pedido explícito.

## P0 — experiência jogável para a demo (ordem)

| # | Item | Onde | Aceite |
|---|---|---|---|
| 1 | Tela inicial própria (logo tipográfico, cena de fundo, menu completo: Nova missão, Como jogar, Modos, Ciência, Configurações, Créditos, Idioma) | `index.html`, `src/ui/menu.ts`, `src/ui/styles.css` | captura 1920×1080, 1366×768 e celular; todas as opções funcionam |
| 2 | Seleção de experiência: Explorador, Cadete Lunar, Comandante | `src/engine/modes.ts`, UI | mesmo núcleo científico; diferenças explícitas e testadas |
| 3 | História "Operação Último Horizonte" e briefing por capítulos | `src/engine/chapters.ts`, `src/i18n.ts` | capítulo deriva do estado do motor (testado) |
| 4 | Introdução animada 12–18 s, pulável, respeita movimento reduzido, relógio parado até o fim | `src/render/cinematic.ts`, `src/ui/intro.ts` | captura de cada cena; pular funciona; "ver de novo" opcional |
| 5 | HUD novo: barra superior, barra de ferramentas inferior, painel lateral recolhível, LUMA no canto | `index.html`, `src/ui/hud.ts` | sem coluna lateral fixa; legível em 1366×768 |
| 6 | Composição da base por áreas (habitação, energia, ciência, logística, comunicação, pouso) | `src/render/scene.ts`, `src/render/layout.ts` | visão inicial mostra instalação reconhecível |
| 7 | Modelos novos: habitat modular, rover 6 rodas, astronauta, módulo de pouso, unidade de gelo | `assets-src/blender/build_v4.py`, `public/models/v4/`, `public/models/ext/` | prévia renderizada inspecionada e captura na cena |
| 8 | Missão de gelo com fases visuais (preparação, deslocamento, operação, retorno, entrega/processamento) | `src/engine/mission.ts`, cena, painel Rover | fases derivadas do progresso real; sem recompensa paralela |
| 9 | LUMA contextual: avatar, histórico, minimizar, eventos, atalho para o sistema | `src/engine/guide.ts`, `src/ui/luma.ts` | eventos testados no motor |
| 10 | Pausa, vitória, derrota, créditos | UI | capturas |
| 11 | typecheck, testes, build | — | passam |

## P1 — polimento

Instalação visual de painel e reparo da antena com animação própria; foguete com animações extras; efeitos de luz; materiais; controle direto do astronauta; sons licenciados.

## P2 — depois do evento

Exploração ampla, novos equipamentos, personalização da base, campanha expandida, novos setores.

## Modos (D-17)

| Modo | Público sugerido | Configuração (motor) | Apresentação |
|---|---|---|---|
| Explorador | iniciante | `rank: 'cadete'` (consumo × 0,75, já existente e testado) | LUMA com todas as dicas, explicações do modo escola ligadas, rótulos simples |
| Cadete Lunar | casual | `rank: 'explorador'` (× 1,0, equilíbrio de referência) | LUMA com dicas de objetivo e alertas |
| Comandante | experiente | `rank: 'comandante'` (× 1,15) | LUMA só com alertas críticos; HUD técnico com números de fluxo |

Os nomes de patente do motor (`cadete`, `explorador`, `comandante`) são anteriores aos nomes dos modos; o mapeamento está em `src/engine/modes.ts`.

## Capítulos (derivados do estado)

1. Primeiro Contato — concluído na primeira missão do rover concluída.
2. Energia para Sobreviver — 4 painéis instalados.
3. Reservas Críticas — 2 viagens de gelo concluídas.
4. Comunicação e Proteção — antena instalada.
5. O Último Horizonte — chegar à hora 708 (vitória).

## Riscos

- Modelos externos dependem de fonte acessível por linha de comando; o que não for baixável vira pedido manual com link exato.
- Navegador de teste usa renderização por software: capturas lentas; o desempenho real é medido com `?perf=1` na máquina do autor.
