# Declaração de uso de IA

Projeto: **Earthset · Base no polo sul da Lua**, NASA Space Apps Challenge 2026 (desafio *Junior Astronaut Mission Trainer*).

## 1. Ferramentas

| Ferramenta | Uso | Modelo |
|---|---|---|
| **Claude Code** (CLI da Anthropic) | Agente de código e documentação neste repositório. Lê `CLAUDE.md`, que importa `AGENTS.md`. | **Pendente** de confirmação pelo autor. Na sessão de 14/11/2026 apareceu `claude-haiku-5-5`. |
| **GitHub Copilot** (VS Code) | Agente e completação de código. Lê `.github/copilot-instructions.md`. | **Pendente** de confirmação pelo autor. |
| **opencode** (CLI, opencode.ai) | Agente de código neste repositório, executado por `opencode run` a partir de `docs/PLANO_PARA_AGENTE.md`. Lê `AGENTS.md` e os documentos de `docs/`. | Modelo: **Big Pickle** (informado pelo autor em 14/11/2026). Provedor: **pendente** de confirmação. Commits com `Co-Authored-By: opencode`. |

Ferramentas **não declaradas**: nenhuma. Se outra for usada, declare aqui antes.

## 2. Como as ferramentas são usadas aqui

- O código, os testes e a documentação são escritos com agentes guiados por `AGENTS.md` e pelos roteiros de `docs/`.
- Dado científico é conferido na fonte listada em `docs/data-sources.md` antes de entrar no jogo.
- Cada arquivo de código criado ou alterado com IA começa com a linha abaixo (`#` em Python e Bash):

```ts
// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
```

- Registro por ferramenta e por período, não por linha. Dentro do jogo não há IA generativa nesta versão.

## 3. Declaração em inglês (para a página de envio)

> **Use of Super Intelligence (SI) tools.** This project was developed with two AI tools: **Claude Code** (Anthropic), used as a coding agent to read the repository, write and test code and draft documentation, and **GitHub Copilot**, used as a coding assistant and agent. Model versions: [to be confirmed by the author]. Scientific values are checked against the NASA sources listed in the References field.

## 4. Pendências

- [ ] Confirmar modelo de Claude Code e de GitHub Copilot.
- [ ] Preencher a declaração em inglês com os modelos confirmados.
