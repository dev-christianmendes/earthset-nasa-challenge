// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { SITE_HORIZON_DEG, isSunlit, sampleAt, type SunTable } from '../../src/engine/sun';
import sunJson from '../../src/data/sun-south-pole.json';

const SYNTHETIC: SunTable = {
  start_utc: '2026-11-15 00:00',
  step_hours: 1,
  hours: 3,
  samples: [
    { az: 0, el: 0.5 },
    { az: 10, el: 1.3 },
    { az: 20, el: 1.7 },
    { az: 30, el: -0.2 },
  ],
};

const REAL = sunJson as SunTable;

describe('amostra do Sol', () => {
  it('devolve a amostra da hora inteira', () => {
    expect(sampleAt(SYNTHETIC, 1.9)).toEqual({ az: 10, el: 1.3 });
  });

  it('para no último ponto depois do fim da tabela', () => {
    expect(sampleAt(SYNTHETIC, 99)).toEqual({ az: 30, el: -0.2 });
  });

  it('recusa hora negativa ou não finita', () => {
    expect(() => sampleAt(SYNTHETIC, -1)).toThrow(RangeError);
    expect(() => sampleAt(SYNTHETIC, Number.NaN)).toThrow(RangeError);
  });
});

describe('Sol na base', () => {
  it('o pico vê o Sol quando a elevação passa de zero', () => {
    expect(isSunlit(SYNTHETIC, 0, 'peak')).toBe(true);
    expect(isSunlit(SYNTHETIC, 3, 'peak')).toBe(false);
  });

  it('a borda exige elevação acima do horizonte local', () => {
    expect(isSunlit(SYNTHETIC, 0, 'rim')).toBe(false); // 0,5 < 1,6
    expect(isSunlit(SYNTHETIC, 2, 'rim')).toBe(true); // 1,7 > 1,6
  });
});

describe('tabela real (JPL Horizons)', () => {
  it('cobre um dia lunar de 708 horas, com um ponto por hora', () => {
    expect(REAL.hours).toBe(708);
    expect(REAL.samples).toHaveLength(709);
    expect(REAL.step_hours).toBe(1);
  });

  it('o horizonte local só reduz o Sol: pico ≥ encosta ≥ borda', () => {
    const count = (site: keyof typeof SITE_HORIZON_DEG): number =>
      Array.from({ length: 709 }, (_, h) => isSunlit(REAL, h, site)).filter(Boolean).length;
    expect(count('peak')).toBeGreaterThanOrEqual(count('slope'));
    expect(count('slope')).toBeGreaterThanOrEqual(count('rim'));
    expect(count('rim')).toBeGreaterThan(0);
    expect(count('rim')).toBeLessThan(709); // a borda tem noite de verdade
  });
});
