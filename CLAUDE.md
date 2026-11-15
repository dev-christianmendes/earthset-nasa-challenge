# Earthset · instruções para o Claude Code

@AGENTS.md

## Ao começar uma sessão

1. Ler `docs/PROJECT_STATUS.md` (estado atual e verificações).
2. Ler o próximo item aberto em `docs/backlog.md`.
3. Ler as últimas entradas de `docs/execution-log.md`.

## Ferramentas deste ambiente (Claude Code)

- **rtk** (`~/.claude/RTK.md`, hook em Bash): condensa a saída dos comandos. Se um comando voltar vazio ou inconsistente, rode de novo com `rtk bypass <cmd>`, só nesse caso.
- **context-mode**: para saídas grandes (logs, testes, arquivos longos), use `ctx_execute` ou `ctx_search` em vez de colar a saída inteira. Diagnóstico: `ctx_doctor`. Exige Node 24.15 ou mais novo (o ambiente local tem 24.22.3).
- **Serena** (`.serena/`): navegação por símbolos em TypeScript. Útil em arquivos grandes; em tarefas curtas, Read e Grep bastam.
- Nenhuma dessas ferramentas substitui a verificação da seção 3 do `AGENTS.md`.
