# Pipeline de ativos 3D

Status: **parcial**. Nenhum ativo externo foi adotado ainda; os objetos atuais são geometria procedural do Three.js.

## Situação atual (14/11/2026)
- Blender: **não instalado** neste ambiente. Modelagem em Blender depende de instalação ou de uma máquina com Blender.
- Ativos externos: nenhum. Só se adota um modelo com licença verificada, atribuição registrada aqui e sem marca da NASA.
- Ativos gerados por IA: **proibidos** (`AI_DISCLOSURE.md`, `AGENTS.md`).

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
