# Direção visual do Earthset

Status: **decidida** em 14/11/2026 a partir da especificação do autor ("Master Visual Direction"). Implementação em andamento; ver `docs/execution-log.md`.

**Identidade:** Earthset — *A small base. A hostile world. One lunar day.*

**Estilo:** 3D estilizado, ficção científica suave, exploração com base científica. Acessível a crianças, adolescentes e adultos, sem parecer infantil e sem parecer painel militar.

**Referência principal:** Astroneer (leitura visual, formas arredondadas, robótica amigável). Não copiamos identidade, personagens, ativos nem interface dele.
**Outras referências de análise:** Planetbase (gestão de base), The Planet Crafter (exploração e progressão), Kerbal Space Program (conceitos científicos acessíveis).

## Paleta (tokens)

| Token | Cor | Significado |
|---|---|---|
| `--space-navy` | #172536 | fundo, painéis |
| `--lunar-gray` | #78818B | terreno, infraestrutura |
| `--habitat-white` | #E8E5DA | habitat, texto principal |
| `--solar-amber` | #F3A847 | energia e sol |
| `--life-teal` | #56B9A4 | sistemas de vida |
| `--water-blue` | #6D9FE8 | água e informação ambiental |
| `--growth-green` | #83B96C | comida e plantas |
| `--alert-coral` | #E47767 | perigo e alertas |
| `--science-violet` | #B5A0E8 | informação científica |

As cores são tokens CSS (`:root` em `index.html`). Cor nunca é o único indicador de estado: sempre há rótulo ou ícone.

## Ambiente
- O terreno continua sendo a malha medida do LOLA. Variação de cor e textura são decorativas e não alteram a geometria medida nem o horizonte.
- O Sol vem do motor e da tabela do JPL Horizons. A renderização não calcula trajetória solar própria.
- Efeitos de tempestade não sugerem atmosfera: a Lua não tem atmosfera terrestre.

## Modelagem
- Formas arredondadas, proporções consistentes, materiais compartilhados.
- Primitivas só como solução provisória e marcadas como tal em `docs/ART_ASSET_PIPELINE.md`.

## Câmera
- Visão orbital em torno da base: arrastar para girar, roda ou pinça para aproximar, limites de distância e de inclinação, amortecimento.
- Botão "Visão da base" volta ao enquadramento padrão.

## Interface
- Veja `docs/UI_UX_SPECIFICATION.md`.

## Acessibilidade
- Contraste de texto em nível AA sobre os painéis.
- Estados sempre com rótulo ou ícone.
- Navegação por teclado no HUD (botões são foco nativo).
