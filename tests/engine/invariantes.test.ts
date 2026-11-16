// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { AGENT_COUNT, AGENT_TASK_KINDS } from '../../src/engine/astronaut';
import { MATCH_HOURS } from '../../src/engine/clock';
import { CARE_LEVELS } from '../../src/engine/greenhouse';
import { advance, createGame, dispatch, outcomeOf, type GameAction, type GameState } from '../../src/engine/game';
import { MAX_QUEUE } from '../../src/engine/robot';
import type { Installation } from '../../src/engine/resources';

const INST: Installation = { rank: 'explorador', site: 'peak', panels: 4, batteryCapacity: 1000, greenhouse: 'surplus' };

function rng(seed: number): () => number {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randomAction(r: () => number): GameAction {
  const pick = <T,>(list: readonly T[]): T => list[Math.floor(r() * list.length)];
  switch (Math.floor(r() * 7)) {
    case 0: return { type: 'ENQUEUE_TASK', kind: pick(['ice', 'panel', 'antenna'] as const) };
    case 1: return { type: 'CANCEL_TASK', index: Math.floor(r() * 5) - 1 };
    case 2: return { type: 'ASSIGN_AGENT_TASK', kind: pick(AGENT_TASK_KINDS), agent: r() < 0.3 ? Math.floor(r() * 4) - 1 : undefined };
    case 3: return { type: 'CANCEL_AGENT_TASK', agent: Math.floor(r() * 4) - 1 };
    case 4: return { type: 'SET_GREENHOUSE_CARE', irrigation: pick(CARE_LEVELS), lighting: pick(CARE_LEVELS) };
    case 5: return { type: 'SET_CREW_ORDER', order: pick(['auto', 'shelter'] as const) };
    default: return { type: 'SET_GREENHOUSE', mode: pick(['off', 'always', 'surplus'] as const) };
  }
}

function assertInvariants(s: GameState): void {
  const v = s.vitals;
  expect(v.battery).toBeGreaterThanOrEqual(0);
  expect(v.battery).toBeLessThanOrEqual(s.installation.batteryCapacity + 1e-9);
  for (const k of [v.air, v.water, v.food]) {
    expect(k).toBeGreaterThanOrEqual(0);
    expect(k).toBeLessThanOrEqual(100);
  }
  expect(s.hearts).toBeGreaterThanOrEqual(0);
  expect(s.hearts).toBeLessThanOrEqual(3);
  expect(s.crop.growth).toBeGreaterThanOrEqual(0);
  expect(s.crop.growth).toBeLessThanOrEqual(100);
  expect(s.crop.wear).toBeGreaterThanOrEqual(0);
  expect(s.crop.wear).toBeLessThanOrEqual(100);
  expect(s.calibrationLeft).toBeGreaterThanOrEqual(0);
  expect(s.antennaTuneLeft).toBeGreaterThanOrEqual(0);
  expect(s.robot.queue.length).toBeLessThanOrEqual(MAX_QUEUE);
  expect(s.agents).toHaveLength(AGENT_COUNT);
  for (const a of s.agents) {
    expect(a.restLeft).toBeGreaterThanOrEqual(0);
    if (a.task) expect(a.task.hoursLeft).toBeGreaterThanOrEqual(0);
  }
  const kinds = s.agents.flatMap((a) => (a.task ? [a.task.kind] : []));
  expect(new Set(kinds).size).toBe(kinds.length);
}

function playRandom(seed: number, dt: number): GameState {
  const r = rng(seed);
  let s = createGame({ installation: INST });
  let guard = 0;
  while (outcomeOf(s) === 'playing' && guard++ < 20000) {
    if (r() < 0.35) {
      const result = dispatch(s, randomAction(r));
      if (result.ok) s = result.state;
    }
    const hour = s.clock.hour;
    s = advance(s, dt, hour % 708 < 354, { kp: 0, radiation: hour % 97 > 90 });
    assertInvariants(s);
  }
  return s;
}

describe('invariantes com ações aleatórias', () => {
  it.each([1, 2, 3, 4, 5])('semente %i: 708 h sem violar nenhum limite', (seed) => {
    const s = playRandom(seed, 0.5);
    expect(s.clock.hour).toBeGreaterThan(0);
    expect(s.clock.hour).toBeLessThanOrEqual(MATCH_HOURS);
  });

  it('é determinístico: a mesma semente dá o mesmo estado final', () => {
    expect(JSON.stringify(playRandom(7, 0.5))).toBe(JSON.stringify(playRandom(7, 0.5)));
  });

  it('passos maiores (velocidade 4×) também respeitam os limites', () => {
    for (const seed of [11, 12]) playRandom(seed, 2);
  });

  it('o estado de entrada nunca é alterado por uma ordem', () => {
    const r = rng(99);
    let s = createGame({ installation: INST });
    for (let i = 0; i < 400; i++) {
      const before = JSON.stringify(s);
      const result = dispatch(s, randomAction(r));
      expect(JSON.stringify(s)).toBe(before);
      if (result.ok) s = result.state;
      s = advance(s, 0.5, true);
    }
  });

  it('reiniciar a missão devolve o estado inicial limpo', () => {
    const played = playRandom(3, 0.5);
    expect(played.clock.hour).toBeGreaterThan(0);
    const fresh = createGame({ installation: INST });
    expect(fresh.agents.every((a) => a.task === null && a.restLeft === 0)).toBe(true);
    expect(fresh.crop.growth).toBe(0);
    expect(fresh.calibrationLeft + fresh.antennaTuneLeft).toBe(0);
    expect(fresh.robot.queue).toHaveLength(0);
  });
});

describe('velocidade e pausa', () => {
  it('avançar 24 h em passos de 1 h, de 0,25 h ou de 4 h chega ao mesmo estado dos astronautas e da estufa', () => {
    const run = (dt: number): GameState => {
      let s = createGame({ installation: INST });
      const r = dispatch(s, { type: 'ASSIGN_AGENT_TASK', kind: 'inspect' });
      if (r.ok) s = r.state;
      for (let t = 0; t < 24; t += dt) s = advance(s, dt, true);
      return s;
    };
    const a = run(1);
    const b = run(0.25);
    const c = run(4);
    for (const other of [b, c]) {
      expect(other.crop.growth).toBeCloseTo(a.crop.growth, 6);
      expect(other.agents[0].restLeft).toBeCloseTo(a.agents[0].restLeft, 6);
      expect(other.agentTasksDone).toEqual(a.agentTasksDone);
    }
  });

  it('tempo zero (pausa) não altera nada', () => {
    const s = createGame({ installation: INST });
    expect(JSON.stringify(advance(s, 0, true))).toBe(JSON.stringify(s));
  });

  it('tempo negativo ou inválido lança erro', () => {
    const s = createGame({ installation: INST });
    expect(() => advance(s, -1, true)).toThrow(RangeError);
    expect(() => advance(s, Number.NaN, true)).toThrow(RangeError);
  });
});
