# Pipeline de ativos 3D

Status: **parcial**. Cinco modelos GLB gerados por script no Blender, carregados pelo Three.js. Nenhum ativo de terceiros.

## Situação atual (14/11/2026)
- **Blender 5.2.2** instalado sem administrador, em `~/tools/blender-5.2.2-linux-x64` (arquivo oficial, soma SHA256 conferida com a publicada em download.blender.org). Roda em modo de fundo com Python.
- **Modelos** (`public/models/`), gerados por `assets-src/blender/build_assets.py`:
  - `habitat.glb`: casco cilíndrico com biséis, tampas e faixa em teal, escotilha e três janelas emissivas.
  - `rover.glb`: chassi âmbar arredondado, seis rodas (nomes `wheel_*`, giram quando trabalha), mastro, câmera e farol (`beacon`, pisca e fica vermelho na radiação).
  - `solar_panel.glb`: suporte e painel inclinado.
  - `greenhouse.glb`: cúpula translúcida com três nervuras.
  - `antenna.glb`: mastro e prato.
- **Autoria:** geometria escrita neste projeto, por script. Sem modelo de terceiros, sem imagem ou modelo gerado por IA.
- **Limite:** a modelagem é procedural e simples. Não atinge o padrão visual de Astroneer. Astronautas não foram modelados.
- Ativos externos: nenhum. Se um for adotado, registrar aqui: origem, autor, licença e alterações.
- Ativos gerados por IA: **proibidos** (`AI_DISCLOSURE.md`, `AGENTS.md`).

## Como regenerar
```
~/tools/blender-5.2.2-linux-x64/blender --background --factory-startup --python assets-src/blender/build_assets.py -- public/models
```

## Escala e origem
Escala no Blender é o tamanho total: cubo de tamanho 1 com escala 2 mede 2 m. Cada modelo tem origem no ponto do grupo do three.js que o recebe (`src/render/scene.ts`, função `loadBaseModels`).

## Fluxo previsto
1. Identificar o objeto e a função no jogo.
2. Modelar ou adaptar em Blender, com escala real em metros (1 unidade = 1 m).
3. Origem no pé do objeto, eixo Y para cima.
4. Exportar GLB (glTF binário), materiais compartilhados, texturas até 1024 px.
5. Carregar com `GLTFLoader` por um gerenciador central de ativos (carrega uma vez, clona).
6. Validar escala, orientação e desempenho.

## Convenções de nome
`objeto_variante.glb`, em minúsculas e com underscore: `habitat_main.glb`, `rover_v1.glb`, `solar_panel.glb`, `greenhouse.glb`, `antenna_dish.glb`.

## Licenças e atribuição
Registre cada ativo externo neste arquivo: origem, autor, licença, data de acesso e alterações feitas. Licença sem clareza = não usar.

## Prioridade de modelagem
1. Habitat principal · 2. Rover · 3. Painéis solares · 4. Estufa · 5. Antena.

## Ativos externos (registro de licenças)

Verificados em 14/11/2026, pela página de cada asset e, quando havia, pela API. Só entram ativos com licença clara e registrada aqui.

| Ativo | Arquivo no projeto | Origem | Licença | Estado |
|---|---|---|---|---|
| Superfície lunar (diffuse, normal, roughness, 1K) | `public/textures/moon/dusted_*.jpg` | Poly Haven, "Moon Dusted 01" (https://polyhaven.com/a/moon_dusted_01) | CC0 1.0 (página) | **em uso** no chão do cenário (`moonGroundMaterial` em `src/render/scene.ts`). Substitui "Moon Footprints 01", que tinha pegadas em toda a superfície e foi removida |
| Astronauta de baixo polígono, rigado, com clipes `default` e `run` | `public/models/astronaut_oga.glb` (fonte: `assets-src/external/astronaut_oga/astronaut.blend`) | OpenGameArt, node 44447 (https://opengameart.org/node/44447) | CC0 (página) | **em uso** na tripulação (`loadCrewModels`, com `AnimationMixer`). Qualidade cartunesca; sem clipe de caminhada (a caminhada usa a corrida mais lenta). Material trocado para não metálico |
| Space Station Kit (módulos de estação, GLB ou glTF) | ainda não baixado | Kenney, https://kenney.nl/assets/space-station-kit (itch.io: https://kenney-assets.itch.io/space-station-kit) | CC0 1.0 (página do itch.io) | **candidato para o habitat**. O download automático é bloqueado (kenney.nl devolve 403; o itch.io exige clique). Aguarda o autor baixar o zip em `assets-src/external/space-station-kit/` |

Ativos gerados pelo projeto (script no Blender): habitat, rover, painel, estufa, antena e astronauta v1 e v2 (`assets-src/blender/`). Não são de terceiros.

Regras: licença CC0 não exige atribuição, mas o projeto registra a origem mesmo assim. Sem marca da NASA. Sem imagem ou modelo gerado por IA. Ativo de licença incerta não entra.
