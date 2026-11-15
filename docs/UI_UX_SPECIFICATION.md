# Especificação de interface

> **Atenção (15/11/2026):** a seção de estrutura de tela descreve o HUD de 14/11 (painel esquerdo). Desde a Earthset 4.0 (E4.5), o HUD tem barra superior, barra de ferramentas e painel lateral recolhível. Para a interação atual, use `docs/INTERACOES.md` e `index.html`.

Status: parcial. Descreve o que existe e o que está previsto.

## Estrutura de tela (atual)
- **Painel esquerdo (HUD):** título, hora de jogo, corações, modo escola, bateria, ar, água, comida, painéis, clima, fila do robô, pedidos ao robô, estufa.
- **Painel direito superior:** horizonte real (painel polar).
- **Rodapé:** nota sobre fontes e exagero vertical.
- **Sobreposição de fim de partida.**

## Previsto
- Tela inicial: **feita** (título, tagline, "Nova missão", idioma, créditos). A partida só avança depois de "Nova missão".
- Preparação da missão.
- Pausa (continuar, controles, voltar ao menu com confirmação).
- Vitória e derrota com resumo e causas.
- Ajuda: controles, sistemas, fontes e atribuição.
- Pausa, vitória/derrota redesenhadas e ajuda ainda não existem. Não contar como feito.

## Níveis de informação
1. **Aventura:** texto curto, ícones, linguagem simples.
2. **Missão:** consumo, geração solar, estado do robô, clima.
3. **Escola:** explicação científica e fonte (modo escola, já implementado).

## Idioma
- Inglês por padrão, botão para português. Chaves iguais nos dois idiomas (`src/i18n.ts`, testado).

## Tokens
Ver `docs/VISUAL_DIRECTION.md`. Cores semânticas: âmbar (sol e energia), azul (água), verde (comida), coral (alerta), violeta (ciência).

## Acessibilidade
- Contraste AA em textos sobre painel.
- Estado nunca só por cor.
- Botões nativos (foco por teclado).
- Resposta a telas estreitas: no celular o HUD vira folha inferior; o painel polar some.


## Escopo v3 (14/11/2026): estrutura de tela

Direção: Cinematic Scientific Sci-Fi (D-11).

### Sequência de telas
1. **Título:** nome, frase de identidade, "Nova missão", idioma, créditos.
2. **Briefing:** missão, controles e "Começar missão" (`#brief`). A partida começa só aqui.
3. **Partida:** HUD em cartões; LUMA; painel polar.
4. **Pausa:** continuar, controles, menu principal (Esc alterna).
5. **Fim:** vitória ou derrota, com causa (a implementar em P1).

### HUD (partida)
- **Coluna esquerda:** título e hora; objetivos com progresso; recursos (bateria, ar, água, comida); painéis; clima; tripulação (auto/abrigar); fila do robô; pedidos ao robô; estufa.
- **Canto superior direito:** painel polar do horizonte.
- **Canto inferior direito:** cartão do LUMA (violeta).
- **Topo central:** Visão da base e Pausar.
- **Rodapé:** fontes dos dados e aviso de exagero vertical.

### Regras de leitura
- Número grande, unidade pequena; valor em fonte monoespaçada.
- Alerta em coral com ícone e texto; nunca só cor.
- Mobile: LUMA no topo, painel polar oculto, HUD em folha inferior.

### LUMA
- Uma dica por vez, a mais urgente (radiação, último coração, tempestade, recurso baixo, próximo objetivo).
- Texto em inglês por padrão, com português. Fonte: `src/i18n.ts`, chaves `luma.*`.
