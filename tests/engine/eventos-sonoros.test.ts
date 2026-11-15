// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// UX-01: eventos sonoros derivados da diferença entre dois estados.
import { describe, expect, it } from 'vitest';
import { createGame, type GameState } from '../../src/engine/game';
import { soundCues } from '../../src/engine/sound-events';
import type { Installation } from '../../src/engine/resources';

const INST: Installation = { rank: 'explorador', site: 'peak', panels: 2, batteryCapacity: 1000, greenhouse: 'off' };
const base = (): GameState => createGame({ installation: INST });
const withVitals = (g: GameState, v: Partial<GameState['vitals']>): GameState => ({ ...g, vitals: { ...g.vitals, ...v } });

describe('eventos sonoros (UX-01)', () => {
  it('sem mudança, nada soa', () => {
    expect(soundCues(base(), base())).toEqual([]);
  });

  it('conclusões de missão e de tarefa viram um evento cada', () => {
    const g = base();
    const done = {
      ...g,
      missionsDone: { ...g.missionsDone, panel: 1, ice: 1 },
      robot: { ...g.robot, antennaInstalled: true },
      agentTasksDone: { ...g.agentTasksDone, harvest: 1, maintain: 1, inspect: 1, calibrate: 1, tune: 1 },
    };
    expect(soundCues(g, done)).toEqual(['panel-installed', 'antenna-online', 'ice-delivered', 'harvest', 'maintained', 'inspected', 'calibrated', 'tuned']);
  });

  it('alerta de recurso só na hora em que cruza o limite para baixo', () => {
    const g = withVitals(base(), { battery: 400, water: 25, air: 40, food: 30 });
    expect(soundCues(g, withVitals(g, { water: 19.9 }))).toEqual(['alert-water']);
    expect(soundCues(withVitals(g, { water: 19 }), withVitals(g, { water: 15 }))).toEqual([]);
    expect(soundCues(g, withVitals(g, { battery: 150 }))).toEqual(['alert-power']);
    expect(soundCues(g, withVitals(g, { air: 29 }))).toEqual(['alert-air']);
    expect(soundCues(g, withVitals(g, { food: 10 }))).toEqual(['alert-food']);
    expect(soundCues(withVitals(g, { water: 5 }), withVitals(g, { water: 60 }))).toEqual([]);
  });

  it('coração perdido soa uma vez', () => {
    const g = base();
    expect(soundCues(g, { ...g, hearts: g.hearts - 1 })).toEqual(['heart-lost']);
  });
});
