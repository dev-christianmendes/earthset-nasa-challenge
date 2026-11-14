# Especificação de interface

Status: parcial. Descreve o que existe e o que está previsto.

## Estrutura de tela (atual)
- **Painel esquerdo (HUD):** título, hora de jogo, corações, modo escola, bateria, ar, água, comida, painéis, clima, fila do robô, pedidos ao robô, estufa.
- **Painel direito superior:** horizonte real (painel polar).
- **Rodapé:** nota sobre fontes e exagero vertical.
- **Sobreposição de fim de partida.**

## Previsto
- Tela inicial (título, nova missão, idioma, modo escola, créditos).
- Preparação da missão.
- Pausa (continuar, controles, voltar ao menu com confirmação).
- Vitória e derrota com resumo e causas.
- Ajuda: controles, sistemas, fontes e atribuição.
- **Ainda não existe nenhuma dessas telas.** Não contar como feito.

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
