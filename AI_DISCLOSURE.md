# Declaração de uso de IA

Projeto: **Earthset · Base no polo sul da Lua**, NASA Space Apps Challenge 2026 (desafio *Junior Astronaut Mission Trainer*).

## 1. Ferramentas

| Ferramenta | Uso | Modelo |
|---|---|---|
| **Claude Code** (CLI da Anthropic) | Agente de código e documentação neste repositório. Lê `CLAUDE.md`, que importa `AGENTS.md`. | Claude **Haiku**, **Sonnet** e **Opus**, conforme a tarefa (modelos `claude-haiku-5-5`, `claude-sonnet-5-5` e `claude-opus-5-5`). |
| **Codex** (OpenAI) | Agente de código a partir de 14/11/2026, para o restante do desenvolvimento. Lê `AGENTS.md` e os documentos de `docs/`. | **gpt6-luna** (OpenAI). |

Ferramentas **não declaradas**: nenhuma. Se outra for usada, declare aqui antes.

## 2. Ativos de terceiros e geração de código de arte

- **Ativos de terceiros** (todos sob CC0 1.0, verificados na fonte, registrados em `docs/ART_ASSET_PIPELINE.md`): textura de superfície lunar (Poly Haven, Moon Dusted 01); manequim e animações Quaternius (Universal Animation Library) como base do astronauta; modelos alternativos KayKit e Quaternius em `public/models/ext/`; astronauta OpenGameArt (nó 44447, recuo).
- **Modelos gerados por script** (Blender 5.2, scripts em `assets-src/blender/`, escritos com auxílio de IA e revisados pelo projeto): habitat, rover, painel solar, estufa, antena e astronauta, e a série v4 (`build_v4.py`: 14 modelos) e o traje do astronauta (`build_ext_astronaut.py`).
- **Nenhuma imagem ou modelo gerado por IA** foi usado como ativo final.

## 3. Como as ferramentas são usadas aqui

- O código, os testes e a documentação são escritos com agentes guiados por `AGENTS.md` e pelos roteiros de `docs/`.
- Dado científico é conferido na fonte listada em `docs/data-sources.md` antes de entrar no jogo.
- Cada arquivo de código criado ou alterado com IA começa com a linha abaixo (`#` em Python e Bash):

```ts
// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
```

- Registro por ferramenta e por período, não por linha. Dentro do jogo não há IA generativa nesta versão.

## 4. Declaração em inglês (para a página de envio)

> **Use of Super Intelligence (SI) tools.** This project was developed with AI coding agents. **Claude Code** (Anthropic), using the Claude Haiku, Sonnet and Opus models, and **Codex** (OpenAI, model gpt6-luna) were used to read the repository, write and test code, generate Blender scripts for the 3D models and draft documentation. No generative AI runs inside the game, and no AI-generated image or model is used as a final asset. Third-party assets (CC0) and data sources are listed in the References field. Scientific values are checked against the NASA sources listed in the References field.

## 5. Pendências

- [x] Modelo de Claude Code: Haiku, Sonnet e Opus (informado pelo autor em 15/11/2026).
- [x] Modelo e provedor do Codex: gpt6-luna, OpenAI (informado pelo autor em 15/11/2026).
- [x] Declaração em inglês preenchida com os modelos confirmados.


## 6. LUMA (assistente do jogo)

- A LUMA, guia do jogador, usa **regras fixas** para escolher a dica (`src/engine/guide.ts`). **Não há modelo de linguagem nem IA generativa em tempo de jogo nesta versão.** Os textos são escritos pelo projeto (`src/i18n.ts`).
- Se uma versão futura usar um modelo de linguagem, ele será declarado aqui antes de ser incluído.
