# Earthset · Base no polo sul da Lua

Jogo 3D no navegador para o **NASA Space Apps Challenge 2026** (desafio *Junior Astronaut Mission Trainer*). Projeto iniciado do zero em 14/11/2026. Declaração de uso de IA em [`AI_DISCLOSURE.md`](AI_DISCLOSURE.md).

## Como rodar

```bash
npm install
npm run dev        # servidor de desenvolvimento
npm run test       # testes do motor
npm run build      # verificação de tipos e build estático em dist/
```

## Estrutura

| Pasta | Conteúdo |
|---|---|
| `src/engine/` | Regras do jogo em TypeScript puro |
| `src/main.ts` | Cena three.js e laço do jogo |
| `tests/` | Testes do motor (Vitest) |
| `docs/` | Backlog, regras do evento, diário de execução |

## Uso de IA

Desenvolvido com auxílio de Claude Code e GitHub Copilot. Ver [`AI_DISCLOSURE.md`](AI_DISCLOSURE.md).

## Licença

MIT (ver `LICENSE`).
