// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { MATCH_HOURS, advanceClock, createClock } from '../../src/engine/clock';

describe('relógio da partida', () => {
  it('começa em 0 e não termina', () => {
    const c = createClock();
    expect(c.hour).toBe(0);
    expect(c.finished).toBe(false);
  });

  it('avança sem mudar o original (imutável)', () => {
    const c0 = createClock();
    const c1 = advanceClock(c0, 10);
    expect(c1.hour).toBe(10);
    expect(c0.hour).toBe(0);
  });

  it('para na duração da partida e termina', () => {
    const c = advanceClock(createClock(), MATCH_HOURS + 50);
    expect(c.hour).toBe(MATCH_HOURS);
    expect(c.finished).toBe(true);
  });

  it('rejeita horas negativas ou não numéricas', () => {
    expect(() => advanceClock(createClock(), -1)).toThrow(RangeError);
    expect(() => advanceClock(createClock(), Number.NaN)).toThrow(RangeError);
    expect(() => createClock(Number.POSITIVE_INFINITY)).toThrow(RangeError);
  });
});
