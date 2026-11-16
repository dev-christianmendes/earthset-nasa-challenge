// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import {
  GROW_HOURS,
  HARVEST_FOOD,
  WEAR_MAX_PENALTY,
  createCrop,
  cropStage,
  efficiency,
  growthPerHour,
  harvestCrop,
  hoursToReady,
  stepCrop,
} from '../../src/engine/greenhouse';
import { advance, createGame, dispatch, type GameAction, type GameState } from '../../src/engine/game';
import { deriveFlow, type Installation } from '../../src/engine/resources';

const CALM = { kp: 0, radiation: false };
const INST: Installation = { rank: 'explorador', site: 'peak', panels: 12, batteryCapacity: 1200, greenhouse: 'always' };

function run(state: GameState, ...actions: GameAction[]): GameState {
  let s = state;
  for (const a of actions) {
    const r = dispatch(s, a);
    if (!r.ok) throw new Error(`ação recusada: ${r.reason}`);
    s = r.state;
  }
  return s;
}

describe('cultivo da estufa (D-18)', () => {
  it('amadurece em GROW_HOURS com cuidado normal e estufa ligada', () => {
    const c = stepCrop(createCrop(), GROW_HOURS, true);
    expect(c.growth).toBeCloseTo(100, 5);
    expect(cropStage(c)).toBe('ready');
  });

  it('com a estufa desligada não cresce nem desgasta', () => {
    const c = stepCrop(createCrop(), 50, false);
    expect(c).toEqual(createCrop());
  });

  it('estágios: muda, desenvolvida e pronta', () => {
    expect(cropStage({ ...createCrop(), growth: 10 })).toBe('seedling');
    expect(cropStage({ ...createCrop(), growth: 60 })).toBe('developed');
    expect(cropStage({ ...createCrop(), growth: 100 })).toBe('ready');
  });

  it('cuidado alto cresce mais rápido; baixo, mais devagar', () => {
    const base = growthPerHour(createCrop());
    expect(growthPerHour({ ...createCrop(), irrigation: 'high' })).toBeGreaterThan(base);
    expect(growthPerHour({ ...createCrop(), lighting: 'low' })).toBeLessThan(base);
  });

  it('o desgaste reduz a eficiência até o limite', () => {
    expect(efficiency({ ...createCrop(), wear: 100 })).toBeCloseTo(1 - WEAR_MAX_PENALTY, 5);
    expect(hoursToReady({ ...createCrop(), wear: 100 })).toBeGreaterThan(hoursToReady(createCrop()));
  });

  it('irrigação e iluminação altas consomem mais água e energia', () => {
    const vitals = { battery: 600, air: 80, water: 50, food: 40 };
    const normal = deriveFlow(vitals, INST, false, false, 1, createCrop());
    const high = deriveFlow(vitals, INST, false, false, 1, { ...createCrop(), irrigation: 'high', lighting: 'high' });
    expect(high.water).toBeLessThan(normal.water);
    expect(high.energy).toBeLessThan(normal.energy);
  });

  it('colher recomeça o cultivo e conta a colheita', () => {
    const c = harvestCrop({ ...createCrop(), growth: 100 });
    expect(c.growth).toBe(0);
    expect(c.harvests).toBe(1);
  });

  it('na partida, a comida só sobe com a colheita do astronauta', () => {
    let g = createGame({ installation: INST });
    for (let h = 0; h < GROW_HOURS + 1; h++) g = advance(g, 1, true, CALM);
    expect(g.crop.growth).toBe(100);
    const before = g.vitals.food;
    g = run(g, { type: 'ASSIGN_AGENT_TASK', kind: 'harvest' });
    for (let h = 0; h < 14; h++) g = advance(g, 1, true, CALM);
    expect(g.crop.harvests).toBe(1);
    expect(g.vitals.food).toBeGreaterThan(before + HARVEST_FOOD - 3);
  });
});
