// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// DT-02: o mesmo cenário, avançado em passos de tamanhos diferentes, deve dar o mesmo resultado.
import { describe, expect, it } from 'vitest';
import { advance, createGame, dispatch, outcomeOf, type GameState } from '../../src/engine/game';
import type { Installation } from '../../src/engine/resources';
import { MAX_PANELS, type TaskKind } from '../../src/engine/robot';
import { isSunlit, type SunTable } from '../../src/engine/sun';
import type { TerrainTable } from '../../src/engine/terrain';
import sunJson from '../../src/data/sun-south-pole.json';
import terrainJson from '../../src/data/terrain-sites.json';

const SUN = sunJson as SunTable;
const TERRAIN = terrainJson as TerrainTable;
const INST: Installation = { rank: 'explorador', site: 'peak', panels: 2, batteryCapacity: 1000, greenhouse: 'surplus' };
const LIT = (h: number): boolean => h % 24 < 12;
const SUNLIT = (h: number): boolean => isSunlit(SUN, h, 'peak', TERRAIN);

function run(start: GameState, dt: number, hours: number, sunlit: (h: number) => boolean): GameState {
  let g = start;
  for (let t = 0; t < hours - 1e-9; t += dt) g = advance(g, Math.min(dt, hours - t), sunlit);
  return g;
}

function scenario(extra: Partial<GameState['vitals']>): GameState {
  let g = createGame({ installation: INST });
  g = { ...g, vitals: { ...g.vitals, ...extra } };
  const q = dispatch(g, { type: 'ENQUEUE_TASK', kind: 'ice' });
  if (q.ok) g = q.state;
  return g;
}

function enqueue(g: GameState, kind: TaskKind): GameState {
  const r = dispatch(g, { type: 'ENQUEUE_TASK', kind });
  return r.ok ? r.state : g;
}

/** Plano de referência (mesma lógica de tests/engine/partida.test.ts), avaliado a cada passo. */
function plan(g: GameState): GameState {
  const queued = (k: TaskKind): number => g.robot.queue.filter((t) => t.kind === k).length;
  let s = g;
  if (s.vitals.water < 45 && queued('ice') < 2) s = enqueue(s, 'ice');
  if (s.installation.panels + queued('panel') < MAX_PANELS) s = enqueue(s, 'panel');
  if (!s.robot.antennaInstalled && queued('antenna') === 0) s = enqueue(s, 'antenna');
  if (queued('ice') < 2) s = enqueue(s, 'ice');
  return s;
}

function fullMatch(dt: number): GameState {
  let g = createGame({ installation: INST });
  let guard = 0;
  while (outcomeOf(g) === 'playing' && guard++ < 200000) {
    g = plan(g);
    g = advance(g, dt, SUNLIT);
  }
  return g;
}

describe('DT-02 · partição do tempo', () => {
  const cases: [string, Partial<GameState['vitals']>][] = [
    ['bateria cheia e água média', { battery: 900, water: 40, air: 80, food: 60 }],
    ['bateria baixa', { battery: 120, water: 30, air: 70, food: 60 }],
    ['sem energia', { battery: 0.01, water: 10, air: 80, food: 80 }],
  ];
  for (const [name, vitals] of cases) {
    it(`${name}: 48 h em passos de 1 h, 0,25 h e 6 h dão a mesma água, bateria e corações`, () => {
      const start = scenario(vitals);
      const coarse = run(start, 1, 48, LIT);
      for (const dt of [0.25, 6]) {
        const other = run(start, dt, 48, LIT);
        expect(other.vitals.water).toBeCloseTo(coarse.vitals.water, 6);
        expect(other.vitals.battery).toBeCloseTo(coarse.vitals.battery, 6);
        expect(other.hearts).toBe(coarse.hearts);
        expect(other.robot.queue.length).toBe(coarse.robot.queue.length);
      }
    });
  }

  it('partida completa com o Sol real: 1 h e 0,25 h dão o mesmo resultado (vitória, corações, painéis)', () => {
    const hourly = fullMatch(1);
    const quarter = fullMatch(0.25);
    expect(outcomeOf(hourly)).toBe('won');
    expect(outcomeOf(quarter)).toBe(outcomeOf(hourly));
    expect(quarter.hearts).toBe(hourly.hearts);
    expect(quarter.installation.panels).toBe(hourly.installation.panels);
    expect(quarter.vitals.water).toBeCloseTo(hourly.vitals.water, 3);
  }, 60000);
});
