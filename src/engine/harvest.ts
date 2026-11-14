// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Colheita da estufa pela tripulação (D-07, docs/DECISOES.md). Motor puro.
// Com a estufa ligada, a cada 12 h de funcionamento a tripulação colhe +10 de comida.
// Se a estufa desligar, o ciclo recomeça do zero.

export const HARVEST_EVERY_HOURS = 12;
export const HARVEST_FOOD = 10;

/**
 * Avança o ciclo de colheita por `hours`. Devolve o novo acumulado (horas desde a última colheita)
 * e quanta comida foi colhida neste passo (múltiplos de HARVEST_FOOD).
 */
export function harvestStep(accumulated: number, hours: number, running: boolean): { accumulated: number; food: number } {
  if (!running) return { accumulated: 0, food: 0 };
  let acc = accumulated + hours;
  let food = 0;
  while (acc >= HARVEST_EVERY_HOURS) {
    acc -= HARVEST_EVERY_HOURS;
    food += HARVEST_FOOD;
  }
  return { accumulated: acc, food };
}
