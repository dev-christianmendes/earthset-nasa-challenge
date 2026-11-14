// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// D-07: com a estufa ligada, a tripulação colhe +10 de comida a cada 12 h (até 100).
import { describe, expect, it } from 'vitest';
import { HARVEST_EVERY_HOURS, HARVEST_FOOD, harvestStep } from '../../src/engine/harvest';
import { advance, createGame } from '../../src/engine/game';
import type { Installation } from '../../src/engine/resources';

const CALM = { kp: 0, radiation: false };

describe('colheita da estufa (D-07)', () => {
  it('a cada 12 h de estufa ligada, colhe 10 de comida', () => {
    let acc = 0;
    let food = 0;
    for (let h = 0; h < 24; h++) {
      const r = harvestStep(acc, 1, true);
      acc = r.accumulated;
      food += r.food;
    }
    expect(HARVEST_EVERY_HOURS).toBe(12);
    expect(HARVEST_FOOD).toBe(10);
    expect(food).toBe(20);
  });

  it('com a estufa desligada, não colhe e o ciclo recomeça', () => {
    const r = harvestStep(7, 5, false);
    expect(r).toEqual({ accumulated: 0, food: 0 });
  });

  it('na partida, a estufa sempre ligada colhe ao completar 12 h', () => {
    const inst: Installation = { rank: 'explorador', site: 'peak', panels: 12, batteryCapacity: 1000, greenhouse: 'always' };
    let g = createGame({ installation: inst });
    for (let h = 0; h < 12; h++) g = advance(g, 1, true, CALM);
    expect(g.greenhouseHours).toBeLessThan(HARVEST_EVERY_HOURS);
    expect(g.vitals.food).toBeGreaterThan(40 + HARVEST_FOOD - 5);
  });
});
