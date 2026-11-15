# Direção visual do Earthset (v3: Cinematic Scientific Sci-Fi)

Status: **decidida** em 14/11/2026 (decisão D-11, em `docs/DECISOES.md`). Substitui a direção "Stylized Lunar Exploration" e a referência Astroneer desta versão.

**Identidade:** Earthset — *A small base. A hostile world. One lunar day.*

**Estilo:** ficção científica cinematográfica com base científica. Realismo de forma e de material, sem parecer documentário. Contraste alto, sombras duras, leitura clara dos sistemas.

**Referências (análise, não cópia):** fotografias de missões lunares e de módulos de estação espacial (domínio público), modelos técnicos da NASA 3D Resources, direção de fotografia de ficção científica sóbria.

## 1. Paleta

Base fria e escura, com âmbar apenas para energia e Sol, e azul-água para dados.

| Token | Cor | Uso |
|---|---|---|
| `--space-navy` | #0B1118 | fundo e painéis |
| `--lunar-gray` | #5C646E | regolito sombreado, estrutura |
| `--habitat-white` | #D9DCD6 | casco do habitat (cinza-branco técnico) |
| `--solar-amber` | #F3A847 | Sol, energia, alertas de atenção |
| `--life-teal` | #56B9A4 | sistemas de vida (ar, luz de cultivo) |
| `--water-blue` | #6D9FE8 | dados e água |
| `--growth-green` | #83B96C | comida e plantas |
| `--alert-coral` | #E47767 | perigo, radiação |
| `--science-violet` | #B5A0E8 | informação científica (LUMA) |

Cor nunca é o único indicador de estado: sempre há rótulo ou ícone.

## 2. Por elemento

### Astronauta
- Traje com segmentação realista (ombros, cotovelos, joelhos), luvas e botas distintas.
- Visor espelhado com reflexo do ambiente (mapa de ambiente simples).
- Mochila de suporte de vida com válvulas e mangueiras.
- Sem rosto identificável; regra de menores preservada (ver `AGENTS.md`).
- Animações: respiração, andar, correr, trabalhar, acenar.

### Rover
- Chassi técnico com sensores, mastro com câmera e antena, LIDAR, painel solar no topo.
- Rodas com cubo metálico, que giram só quando se desloca.
- Farol: azul em operação, vermelho na radiação.

### Habitat
- Casco cinza-metálico com anéis de costura, painéis de radiador e escotilha de travamento.
- Janelas emissivas em azul frio; faixa de identificação em âmbar.
- Montagem a partir de módulos (cilindros, cúpulas, tubos), com leitura de escala.

### Estufa
- Cúpula translúcida com estrutura metálica.
- Plantas visíveis; luz interna de cultivo (teal) quando ligada.

### Painéis solares
- Células visíveis com reflexo especular; estrutura de treliça.
- Inclinação visível; brilho reduzido durante tempestade (já implementado).

### Terreno
- Malha real do LOLA (sem alterar a geometria medida).
- Superfície de regolito de textura real (CC0), pedras e crateras decorativas, com escala coerente.
- Sombras longas e definidas pelo Sol real.

### Céu, Sol e Terra
- **Sol:** disco na posição calculada pela tabela do JPL Horizons (azimute e elevação reais). Visível quando acima do horizonte do morro; atenuado abaixo. Nada de posição inventada.
- **Terra:** esfera com textura (a definir: textura CC0 ou gerada), na posição coerente com a data do cenário.
- Estrelas sem névoa.

### Iluminação
- Luz direcional do Sol real, com sombras duras (mapa de 2048 px nas sombras dos objetos grandes).
- Luz de preenchimento fria; luz de cultivo teal na estufa; farol do robô.
- Exposição e tone mapping fixos (ACES), sem variação por quadro.

### Câmera
- Órbita em torno da base (já implementada), com enquadramento inicial cinematográfico.
- Briefing com plano de abertura lento (cinemático).
- Opcional: seguir o rover (ver `docs/archive/PLANO_CONSOLIDADO.md`, P2; o plano vigente é `docs/PLANO_V4.md`).

### Interface (HUD)
- Painel técnico, com hierarquia: recursos (cartões com ícones), objetivos, tripulação e clima.
- Dados em fonte monoespaçada para valores; títulos em caixa alta espaçada.
- LUMA em cartão separado, com a cor violeta de informação científica.
- Painel polar do horizonte como elemento de dados principal.

## 3. Acessibilidade
- Contraste de texto AA sobre os painéis.
- Estados com rótulo ou ícone, não só cor.
- Navegação por teclado no HUD; Esc pausa.
- Textos em inglês por padrão, com português disponível.
