# Declaração de uso de IA

Projeto: **Earthset · Base no polo sul da Lua**, NASA Space Apps Challenge 2026 (desafio *Junior Astronaut Mission Trainer*).

## 1. Ferramentas

| Ferramenta | Uso | Modelo |
|---|---|---|
| **Claude Code** (CLI da Anthropic) | Agente de código e documentação neste repositório. Lê `CLAUDE.md`, que importa `AGENTS.md`. | **Pendente** de confirmação pelo autor. Na sessão de 14/11/2026 apareceu `claude-haiku-5-5`. |
| **GitHub Copilot** (VS Code) | Agente e completação de código. Lê `.github/copilot-instructions.md`. | **Pendente** de confirmação pelo autor. |

Ferramentas **não declaradas**: nenhuma. Se outra for usada, declare aqui antes.

## 2. Trabalho anterior (protótipo)

Antes deste repositório, o autor desenvolveu um **protótipo de validação** da mesma ideia, no repositório `earthset` (pasta `~/projects-chris/earthset`, arquivos de 29/10/2026 em diante, com documentação técnica de 13/11/2026). O protótipo usou Claude Code e GitHub Copilot.

- **Nenhum código do protótipo foi copiado para este repositório.** Este projeto foi escrito do zero a partir de 14/11/2026.
- As ideias de jogo, as regras e os dados vieram do protótipo e são citados quando usados. O protótipo serve de referência de comportamento, não de base de código.
- O projeto de envio é **novo**, iniciado do zero em 14/11/2026. O protótipo serviu só de base conceitual; nenhum trabalho do projeto de envio foi feito antes do evento.

## 3. Como as ferramentas são usadas aqui

- O código, os testes e a documentação são escritos com agentes guiados por `AGENTS.md` e pelos roteiros de `docs/`.
- Dado científico é conferido na fonte listada em `docs/data-sources.md` antes de entrar no jogo.
- Cada arquivo de código criado ou alterado com IA começa com a linha abaixo (`#` em Python e Bash):

```ts
// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
```

- Registro por ferramenta e por período, não por linha. Dentro do jogo não há IA generativa nesta versão.

## 4. Declaração em inglês (para a página de envio)

> **Use of Super Intelligence (SI) tools.** This project was developed with two AI tools: **Claude Code** (Anthropic), used as a coding agent to read the repository, write and test code and draft documentation, and **GitHub Copilot**, used as a coding assistant and agent. Model versions: [to be confirmed by the author]. The project builds on an earlier prototype of the same idea by the same author, started on 29 October 2026; no code from that prototype was reused, and the new code was written from 14 November 2026. Scientific values are checked against the NASA sources listed in the References field.

## 5. Pendências

- [ ] Confirmar modelo de Claude Code e de GitHub Copilot.
- [ ] Preencher a declaração em inglês com os modelos confirmados.
