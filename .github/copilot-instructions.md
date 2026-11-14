# Earthset · instruções para o GitHub Copilot

Leia `AGENTS.md` inteiro antes de sugerir código. Resumo das regras que valem sempre:

- `src/engine/` é TypeScript puro: sem three.js, sem DOM, sem `window`. A regra de jogo fica no motor e é testada com Vitest.
- Textos da interface e da documentação em português do Brasil. Página de envio e materiais linkados em inglês.
- Todo `.ts` criado ou alterado com IA começa com: `// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.`
- Número científico tem fonte em `docs/data-sources.md`. O que for ilustrativo fica marcado no código e na tela.
- Pronto = `npm run typecheck`, `npm run test` e `npm run build` passando, e a tela verificada quando o item mexe em tela.
- Sem `git push`, sem publicação e sem commit sem pedido explícito do autor.
- Sem marca da NASA (logotipo, insígnia, bandeira ou patch) em assets ou na tela.
- Cada etapa técnica entra em `docs/execution-log.md`.
