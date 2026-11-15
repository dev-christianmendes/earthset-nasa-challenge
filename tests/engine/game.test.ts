// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { MATCH_HOURS } from '../../src/engine/clock';
import { HOURS_PER_HEART_LOSS, advance, createGame, dispatch, outcomeOf, type GameState } from '../../src/engine/game';
import type { Installation, Vitals } from '../../src/engine/resources';

const inst: Installation = { rank: 'explorador', site: 'peak', panels: 2, batteryCapacity: 100, greenhouse: 'off' };

function withVitals(state: GameState, vitals: Vitals): GameState {
  return { ...state, vitals };
}

describe('partida', () => {
  it('começa com 3 corações e em andamento', () => {
    const g = createGame({ installation: inst });
    expect(g.hearts).toBe(3);
    expect(outcomeOf(g)).toBe('playing');
  });

  it('avança recursos e tempo, sem mudar o estado anterior', () => {
    const g0 = createGame({ installation: inst });
    const g1 = advance(g0, 1, true);
    expect(g1.clock.hour).toBe(1);
    expect(g0.clock.hour).toBe(0);
    expect(g1.vitals.battery).not.toBe(g0.vitals.battery);
  });

  it('uma base passiva, sem robô buscando gelo, perde a água e termina derrotada', () => {
    // Consequência esperada da regra, não um erro: sem gelo, a água acaba e a comida também.
    const g = advance(createGame({ installation: { ...inst, greenhouse: 'always' } }), MATCH_HOURS, true);
    // A partida para no instante da derrota: o relógio não avança depois dela.
    expect(g.clock.hour).toBeLessThan(MATCH_HOURS);
    expect(outcomeOf(g)).toBe('lost');
  });

  it('para no fim da partida e vence com pelo menos um coração, se os recursos são repostos', () => {
    // Simula o que o robô e a estufa farão depois (B1 não tem robô): repõe ar, água e comida a cada hora.
    let g = createGame({ installation: inst });
    while (g.clock.hour < MATCH_HOURS) {
      g = advance(g, 1, true);
      g = { ...g, vitals: { ...g.vitals, air: 100, water: 100, food: 100 } };
    }
    expect(g.clock.hour).toBe(MATCH_HOURS);
    expect(g.hearts).toBe(3);
    expect(outcomeOf(g)).toBe('won');
    expect(advance(g, 10, true)).toBe(g);
  });

  it('perde 1 coração a cada 6 horas seguidas com um recurso vital zerado', () => {
    const start = withVitals(createGame({ installation: inst }), { battery: 50, air: 100, water: 50, food: 0 });
    const g = advance(start, HOURS_PER_HEART_LOSS, true);
    expect(g.hearts).toBe(2);
    expect(outcomeOf(g)).toBe('playing');
  });

  it('sem energia, a base esfria e perde 1 coração a cada 6 horas (B1.5)', () => {
    const start = withVitals(createGame({ installation: inst }), { battery: 0, air: 100, water: 50, food: 40 });
    const g = advance(start, HOURS_PER_HEART_LOSS, false);
    expect(g.hearts).toBe(2);
    expect(g.vitals.battery).toBe(0);
  });

  it('o contador zera quando o recurso volta a ter valor', () => {
    const start = withVitals(createGame({ installation: inst }), { battery: 50, air: 100, water: 50, food: 0 });
    const a = advance(start, 5, true);
    const b = withVitals(a, { ...a.vitals, food: 10 });
    const c = advance(b, 5, true);
    expect(c.hearts).toBe(3);
  });

  it('perde no momento em que os corações zeram', () => {
    const start = { ...withVitals(createGame({ installation: inst }), { battery: 50, air: 100, water: 50, food: 0 }), hearts: 1 };
    const g = advance(start, HOURS_PER_HEART_LOSS, true);
    expect(g.hearts).toBe(0);
    expect(outcomeOf(g)).toBe('lost');
    expect(advance(g, 10, true)).toBe(g);
  });
});

describe('ações do jogador', () => {
  it('muda o modo da estufa', () => {
    const r = dispatch(createGame({ installation: inst }), { type: 'SET_GREENHOUSE', mode: 'always' });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.state.installation.greenhouse).toBe('always');
  });

  it('rejeita modo inválido sem alterar o estado', () => {
    const g = createGame({ installation: inst });
    const r = dispatch(g, { type: 'SET_GREENHOUSE', mode: 'turbo' as never });
    expect(r.ok).toBe(false);
    expect(g.installation.greenhouse).toBe('off');
  });

  it('não aceita ações depois que a partida terminou', () => {
    const g = advance(createGame({ installation: inst }), MATCH_HOURS, true);
    const r = dispatch(g, { type: 'SET_GREENHOUSE', mode: 'always' });
    expect(r.ok).toBe(false);
  });
});
