// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { isSunlit, sampleAt, type SunTable } from '../../src/engine/sun';
import type { TerrainTable } from '../../src/engine/terrain';
import sunJson from '../../src/data/sun-south-pole.json';
import terrainJson from '../../src/data/terrain-sites.json';

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
const TERRAIN = terrainJson as TerrainTable;

/** Relevo plano: cada site tem horizonte constante (para testar a regra isolada). */
function flatTerrain(peak: number, slope: number, rim: number): TerrainTable {
  const site = (h: number) => ({ x_m: 0, y_m: 0, horizon_deg: Array.from({ length: 72 }, () => h) });
  return { azimuth_step_deg: 5, sites: { peak: site(peak), slope: site(slope), rim: site(rim) } };
}
const FLAT = flatTerrain(0, 1.2, 1.6);

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
    expect(isSunlit(SYNTHETIC, 0, 'peak', FLAT)).toBe(true);
    expect(isSunlit(SYNTHETIC, 3, 'peak', FLAT)).toBe(false);
  });

  it('a borda exige elevação acima do horizonte local', () => {
    expect(isSunlit(SYNTHETIC, 0, 'rim', FLAT)).toBe(false); // 0,5 < 1,6
    expect(isSunlit(SYNTHETIC, 2, 'rim', FLAT)).toBe(true); // 1,7 > 1,6
  });
});

describe('tabela real (JPL Horizons)', () => {
  it('cobre um dia lunar de 708 horas, com um ponto por hora', () => {
    expect(REAL.hours).toBe(708);
    expect(REAL.samples).toHaveLength(709);
    expect(REAL.step_hours).toBe(1);
  });

  it('o horizonte medido só reduz o Sol: pico ≥ encosta ≥ borda, com contagens fixas', () => {
    const count = (site: 'peak' | 'slope' | 'rim'): number =>
      Array.from({ length: 709 }, (_, h) => isSunlit(REAL, h, site, TERRAIN)).filter(Boolean).length;
    expect(count('peak')).toBeGreaterThanOrEqual(count('slope'));
    expect(count('slope')).toBeGreaterThanOrEqual(count('rim'));
    // Medido no LOLA, com o Sol de 09/10/2024 09:00 (início do cenário): pico 412 h, encosta 179 h, borda 0 h de Sol.
    // A borda é o local mais sombreado do polo, com horizonte de até 55°; sem Sol nesse relevo.
    expect(count('peak')).toBe(412);
    expect(count('slope')).toBe(179);
    expect(count('rim')).toBe(0);
  });
});
