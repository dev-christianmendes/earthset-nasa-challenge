# Earthset · instruções para o Claude Code

@AGENTS.md

## Ao começar uma sessão

1. Ler `AGENTS.md` (regras permanentes) e `README.md` (estado do jogo e como executar).
2. Antes de mudar código, conferir `git status`: o repositório pode ter alterações de outra sessão ou de outra pessoa. Não reverter o que não é seu.

## Ferramentas deste ambiente (Claude Code)

- **rtk** (`~/.claude/RTK.md`, hook em Bash): condensa a saída dos comandos. Se um comando voltar vazio ou inconsistente, rode de novo com `rtk bypass <cmd>`, só nesse caso.
- **context-mode**: para saídas grandes (logs, testes, arquivos longos), use `ctx_execute` ou `ctx_search` em vez de colar a saída inteira. Diagnóstico: `ctx_doctor`.
- **Serena** (`.serena/`): navegação por símbolos em TypeScript. Em tarefas curtas, Read e Grep bastam.
- Nenhuma dessas ferramentas substitui a verificação da seção 3 do `AGENTS.md`.
