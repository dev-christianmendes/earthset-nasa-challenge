# Plano consolidado (escopo v3, 14/11/2026)

Este é o plano vigente. Substitui os planos anteriores de execução (`docs/PLANO_PARA_AGENTE.md` é histórico). Decisões de base: D-11 a D-15 em `docs/DECISOES.md`. Estado do código: `docs/CONTEXTO_CODEX.md`.

**Prazo: 15/11/2026, 23h59 (meta interna 12h).** Tudo que está em P0 precisa estar pronto antes disso, incluindo a entrega. P1 entra se P0 estiver fechado. P2 não é prometido para esta entrega.

## 0. Princípios
- O motor é a fonte da verdade. Visual, LUMA e objetivos só leem o estado; a única exceção é enviar ações válidas (`dispatch`).
- Cada etapa termina com: typecheck, testes, build, captura revisada (desktop e celular) e entrada no diário.
- Commit e push só com pedido explícito do autor.

## 1. Corte por prioridade

### P0 — obrigatório para a entrega
1. **Ler o enunciado oficial e o Guia de Envio** (pendências A2 e A5 de `docs/event-rules.md`). Confirmar requisitos antes de qualquer outra coisa.
2. **Jogo jogável no início:** briefing, objetivos visíveis, LUMA com dicas, ordem da tripulação (auto/abrigar). Já implementado na árvore de trabalho; falta verificação visual e commit (com pedido).
3. **HUD no estilo v3:** cartões com ícones, hierarquia, LUMA separado, painel polar mantido. Mudança só de `index.html` e `src/ui/`.
4. **Iluminação e câmera v3:** sombras duras, exposição fixa, plano de abertura no briefing.
5. **Sol visível** na posição calculada (disco com brilho); **Terra** com textura simples.
6. **Desempenho:** medir com `?perf=1` na máquina do autor; registrar.
7. **Entrega:** vídeo de 30 s ou 7 slides em inglês; lista de referências com todas as fontes e licenças; declaração de IA em inglês (incluindo a LUMA por regras); preenchimento da página de envio.

### P1 — se P0 estiver fechado
8. **Habitat com módulos do Megakit (CC0)**, substituindo o cilindro atual. Ver `docs/ART_ASSET_PIPELINE.md`, seção de fontes.
9. **Astronauta v3:** decidir entre `astronaut_v2` corrigido, Kenney Animated Characters (CC0, verificar) ou modelo CC-BY com atribuição.
10. **Rover:** avaliar modelo da NASA 3D Resources (sem logotipo, crédito verificado); senão manter o procedural com materiais técnicos.
11. **Terreno:** pedras e crateras decorativas (CC0), com instanciamento.
12. **Animação da estufa** (colheita) e **aceno da tripulação** ao aviso da antena.

### P2 — depois da entrega
13. Seguir o rover pela câmera (D-03).
14. Diário da base (I3) e linguagem das patentes (I2).
15. Estrelas e céu com refinamento; efeitos de partículas em tempestade.
16. Acessibilidade completa (navegação por teclado ponta a ponta).

## 2. Ordem executável (P0 e P1)

| # | Tarefa | Arquivos | Aceite |
|---|---|---|---|
| 1 | Ler A2 e A5; registrar requisitos | `docs/event-rules.md` | requisitos listados e conferidos |
| 2 | Verificar e commitar LUMA, objetivos, briefing, tripulação (com pedido) | `src/engine/{objectives,guide,game,crew}.ts`, `src/ui/hud.ts`, `index.html`, `src/i18n.ts`, testes | captura do briefing e do HUD; 93+ testes |
| 3 | HUD v3 (cartões, ícones, hierarquia) | `index.html`, `src/ui/hud.ts` | captura desktop e celular, sem sobreposição |
| 4 | Iluminação v3 (sombras duras, exposição fixa) e plano de abertura | `src/render/scene.ts` | captura da base em dia e em noite |
| 5 | Sol visível na posição calculada | `src/render/scene.ts` (`sunlit`, `sun`) | disco no céu coincide com a elevação/azimute da tabela |
| 6 | Terra com textura simples | `src/render/scene.ts` | Terra visível e coerente com o cenário |
| 7 | Medir desempenho (`?perf=1`) | — | número registrado no diário |
| 8 | Entrega (vídeo ou slides, referências, declaração) | `docs/`, `AI_DISCLOSURE.md` | conteúdo pronto; envio só com pedido |
| 9 | Habitat com Megakit | `assets-src/blender/`, `public/models/` | habitat legível, GLB < 300 KB |
| 10 | Astronauta v3 | `public/models/`, `src/render/scene.ts` | captura próxima sem braço solto |
| 11 | Rover | idem | captura com leitura de robô |
| 12 | Pedras e crateras | `src/render/scene.ts` | sem custo acima do orçamento |

## 3. Riscos e decisões de corte
- **O prazo não cobre P1 inteiro.** Se até o meio-dia de 15/11 P0 não estiver fechado, P1 é cancelado e a entrega sai com o que estiver pronto.
- **Modelos de terceiros:** cada um exige verificação de licença antes do uso; se a verificação atrasar, mantém-se o procedural.
- **Sem decisão do autor** sobre push, envio e astronauta, esses itens ficam parados.

## 4. O que não muda
- Motor, dados científicos (Sol, LOLA, DONKI), regras de equilíbrio (bateria 1000, 2 corações no plano de referência), D-05 a D-08.
- Interface em inglês por padrão, com português.
- Nenhum logotipo da NASA; nenhum conteúdo gerado por IA como ativo.
