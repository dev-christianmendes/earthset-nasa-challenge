

## Escopo v3 (14/11/2026): fontes e plano de ativos

Direção visual: Cinematic Scientific Sci-Fi (D-11). Política de fontes: D-15.

### Fontes permitidas
| Fonte | Licença | Uso previsto | Cuidado |
|---|---|---|---|
| NASA 3D Resources (https://science.nasa.gov/3d-resources/) | domínio público segundo as diretrizes de mídia da NASA | rover, sondas, referências de escala | sem logotipo ou emblema; conferir a linha de crédito de cada modelo (pode citar terceiros) |
| Kenney (https://kenney.nl/assets) | CC0 | pedras, estruturas, personagens animados (verificar cada pacote) | pacotes específicos, não o site |
| Quaternius (Modular Sci-Fi Megakit, https://opengameart.org/content/modular-sci-fi-megakit) | CC0 | módulos de habitat e estrutura | zip de 46 MB, fora do git |
| Poly Haven (https://polyhaven.com) | CC0 | superfície e texturas | verificar a página do asset |
| Poly Pizza (https://poly.pizza) | CC0 ou CC-BY, por modelo | complementos | CC-BY exige atribuição registrada |
| Three.js examples (https://threejs.org/examples/) | licença por exemplo | referência técnica | não usar modelos de exemplo sem verificar a licença |

### Registro (preencher antes de usar)
| Ativo | Origem | Licença verificada em | Uso no jogo | Estado |
|---|---|---|---|---|
| Superfície lunar "Moon Dusted 01" | Poly Haven | 14/11/2026 | chão | em uso |
| Astronauta OpenGameArt (nó 44447) | OpenGameArt | 14/11/2026 | tripulação | em uso (substituir na P1) |
| Megakit (Quaternius) | OpenGameArt | 14/11/2026 (licença no zip) | habitat (P1) | baixado, não usado |
| Space Station Kit (Kenney) | Kenney | página do itch.io | habitat (alternativa) | pendente de download manual |
| Rover (NASA 3D Resources) | NASA | pendente | rover (P1) | a escolher |
| Astronauta (Kenney Animated Characters) | Kenney | pendente | tripulação (P1) | a verificar |

## Earthset 4.0 (14/11/2026, noite)

| Ativo | Arquivo | Origem | Licença | Em uso |
|---|---|---|---|---|
| Habitat modular, rover 6 rodas, módulo de pouso, plataforma, processador de gelo, tanques, unidade de energia, torre de luz, caixas, antena articulada, painel solar, estufa, pedras | `public/models/v4/*.glb` (14) | Próprio: `assets-src/blender/build_v4.py` | do projeto | sim |
| Estufa (módulo cilíndrico acoplado ao colar sul do habitat, 10 leitos, porta de serviço, ventiladores), medidores de nível dos tanques e peças de dano e ajuste da antena (D-25) | `greenhouse_v4.glb` (440 kB), `tanks_v4.glb`, `antenna_v4.glb` | Próprio, regerados por `build_v4.py` (`blender -b --factory-startup -P assets-src/blender/build_v4.py -- public/models/v4 greenhouse tanks antenna`) | do projeto | sim |
| Sons (Web Audio, sintetizados em `src/ui/audio.ts`) | nenhum arquivo | Próprio, gerado em tempo de execução | sem terceiros, nada a atribuir | sim |
| Astronauta (traje, capacete, mochila sobre manequim; clipes idle, walk, run, work, wave e outros) | `public/models/ext/astronaut.glb` | Quaternius, Universal Animation Library 1 e 2 (`assets-src/external/quaternius-universal-animation-library*/`) + `build_ext_astronaut.py` | CC0 1.0 | sim |
| Módulos, túneis, landers, caixas, pedras, rover e caminhão | `public/models/ext/*.glb` | KayKit Space Base Bits (Kay Lousberg) e Quaternius via poly.pizza (`SOURCE.md` em cada pasta) | CC0 1.0 | não (alternativas) |

Nomes que o código usa: `window_light`, `ext_light`, `grow_light`, `screen`, `status_light`, `lamp`, `pad_light`, `engine_glow`, `panel_cell`, `beacon`, `chassis`; nós `wheel_*`, `drill` (ângulo negativo abaixa), `yoke`, `dish`. Prévias: `assets-src/blender/preview_v4.py`. Pontos fracos conhecidos: habitat com 710 KB e sem texturas UV; pedras sem textura.

