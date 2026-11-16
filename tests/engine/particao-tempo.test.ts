// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { advance, createGame, dispatch, outcomeOf, type GameState } from '../../src/engine/game';
import { MATCH_HOURS } from '../../src/engine/clock';
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

function plan(g: GameState): GameState {
  const queued = (k: TaskKind): number => g.robot.queue.filter((t) => t.kind === k).length;
  let s = g;
  if (s.vitals.water < 45 && queued('ice') < 2) s = enqueue(s, 'ice');
  if (s.installation.panels + queued('panel') < MAX_PANELS) s = enqueue(s, 'panel');
  if (!s.robot.antennaInstalled && queued('antenna') === 0) s = enqueue(s, 'antenna');
  if (queued('ice') < 2) s = enqueue(s, 'ice');
  return s;
}

function fullMatch(dt: number, every: number): GameState {
  let g = createGame({ installation: INST });
  let guard = 0;
  while (outcomeOf(g) === 'playing' && guard++ < 200000) {
    const onGrid = Math.abs(g.clock.hour / every - Math.round(g.clock.hour / every)) < 1e-6;
    if (onGrid) g = plan(g);
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

  it('partida completa com o Sol real: decisões na mesma hora dão o mesmo resultado em passos de 0,05, 0,25, 0,5 e 1 h', () => {
    const results = [0.05, 0.25, 0.5, 1].map((dt) => fullMatch(dt, 0.25));
    for (const g of results) {
      expect(outcomeOf(g)).toBe('won');
      expect(g.hearts).toBe(results[0].hearts);
      expect(g.installation.panels).toBe(results[0].installation.panels);
      expect(g.vitals.water).toBeCloseTo(results[0].vitals.water, 6);
    }
  }, 120000);

  it('partida completa com o plano: 6 h de cadência de decisões dá o mesmo resultado que decidir a cada 6 h em passos de 0,25 h', () => {
    const a = fullMatch(0.25, 6);
    const b = fullMatch(6, 6);
    expect(a.hearts).toBe(b.hearts);
    expect(a.vitals.water).toBeCloseTo(b.vitals.water, 6);
  }, 120000);

  it('fim da partida com passos de 0,4 h (máximo do navegador) chega à vitória em 708 h, sem travar', () => {
    const g = fullMatch(0.4, 0.4);
    expect(outcomeOf(g)).toBe('won');
    expect(g.clock.hour).toBe(MATCH_HOURS);
  }, 120000);
});
