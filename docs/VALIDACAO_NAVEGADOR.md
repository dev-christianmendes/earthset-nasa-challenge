# Validação em navegador — 15/11/2026

Rodadas dos scripts Playwright de `scripts/` contra o servidor de desenvolvimento (`npx vite --port 5180`), na árvore de trabalho do commit `cae624f`. Os scripts não alteram código nem o estado da partida. Logs e capturas ficam fora do repositório.

| Script | Resultado | Escopo |
|---|---|---|
| `e2e-ux-regression.py` | 67 verificações, 0 falhas | Regressões UXR-01 a UXR-07: alertas, confirmações de passo, consulta de alertas |
| `e2e-ux-mobile-panel.py` | 7/7 | Painel contextual recolhível em 412×915 com toque (UX-03) |
| `e2e-ux-contrast.py` | 712 textos, 0 abaixo do limite WCAG AA | HUD, painéis e menu em desktop e celular (UX-09) |
| `e2e-sky-visibility.py` | asserções aprovadas | Exposição longa e enquadramento do céu; mede também a sequência do disco solar em 1× |
| `e2e-ux-review.py` | concluiu | Diagnóstico exploratório sem critério de aprovação; `results.json` não analisado neste registro |

## Pendências

- **Contraste:** uma rodada anterior, interrompida por tempo, mostrou 18 textos abaixo do limite no painel da base. A rodada completa mostrou 0. A causa da diferença não foi investigada.
- **Sequência solar:** em 3,1 s, 85 de 147 pares de quadros consecutivos não mudaram. O script não define critério para isso, então não é possível afirmar se é esperado em 1×. AST-VIS-02 (sem degraus) segue sem prova conclusiva.
- **Não rodados:** `e2e-astronomy.py`, `e2e-descoberta.py`, `e2e-tempestade.py`, `e2e-sol-continuo.py`, `e2e-contexto.py`, `e2e-ux-latency.py`.
- **Não cobertos:** qualidade visual de animações, objetos atravessando o terreno, sobreposição de estruturas e tempo real de resposta em aparelho físico.
