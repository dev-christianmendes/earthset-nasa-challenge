// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { isSunlit, sampleAt, sunPositionAt, type SunTable } from '../../src/engine/sun';
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
  it('usa a efeméride do site sem alterar o comportamento de tabelas antigas', () => {
    const table: SunTable = { ...SYNTHETIC, samples_by_site: { slope: [{ az: 15, el: -1 }] } };
    expect(sampleAt(table, 0, 'slope')).toEqual({ az: 15, el: -1 });
    expect(sampleAt(table, 0, 'peak')).toEqual(sampleAt(SYNTHETIC, 0));
    expect(isSunlit(table, 0, 'slope', FLAT)).toBe(false);
    expect(isSunlit(table, 0, 'peak', FLAT)).toBe(true);
  });
  it('o pico vê o Sol quando a elevação passa de zero', () => {
    expect(isSunlit(SYNTHETIC, 0, 'peak', FLAT)).toBe(true);
    expect(isSunlit(SYNTHETIC, 3, 'peak', FLAT)).toBe(false);
  });

  it('a borda exige elevação acima do horizonte local', () => {
    expect(isSunlit(SYNTHETIC, 0, 'rim', FLAT)).toBe(false);
    expect(isSunlit(SYNTHETIC, 2, 'rim', FLAT)).toBe(true);
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
    // Medido no LOLA, com o Sol de 09/10/2024 09:00 (início do cenário): observador LOLA corrigido (DT-16): pico 434 amostras, encosta 179 amostras, borda 0 h de Sol.
    expect(count('peak')).toBe(434);
    expect(count('slope')).toBe(179);
    expect(count('rim')).toBe(0);
  });
});

describe('posição do Sol interpolada (AST-VIS-02)', () => {
  it('em horas inteiras coincide com a amostra da hora', () => {
    for (const h of [0, 1, 2, 100, 707, 708]) {
      expect(sunPositionAt(REAL, h)).toEqual(sampleAt(REAL, h));
    }
  });

  it('no meio da hora fica entre as duas amostras', () => {
    const p = sunPositionAt(SYNTHETIC, 1.5);
    expect(p.el).toBeCloseTo((1.3 + 1.7) / 2, 10);
    expect(p.az).toBeCloseTo(15, 10);
  });

  it('cruza 360° pelo arco mais curto', () => {
    const table: SunTable = { ...SYNTHETIC, samples: [{ az: 359, el: 0 }, { az: 1, el: 0 }, { az: 2, el: 0 }, { az: 3, el: 0 }] };
    expect(sunPositionAt(table, 0.5).az).toBeCloseTo(0, 10);
    expect(sunPositionAt(table, 0.25).az).toBeCloseTo(359.5, 10);
  });

  it('para no último ponto e rejeita hora inválida', () => {
    expect(sunPositionAt(SYNTHETIC, 99)).toEqual({ az: 30, el: -0.2 });
    expect(() => sunPositionAt(SYNTHETIC, -1)).toThrow(RangeError);
    expect(() => sunPositionAt(SYNTHETIC, Number.NaN)).toThrow(RangeError);
  });

  it('na tabela real a direção muda de forma contínua, sem salto de meio grau dentro da hora', () => {
    let worst = 0;
    let prev = sunPositionAt(REAL, 0);
    for (let h = 0.05; h <= 707; h += 0.05) {
      const p = sunPositionAt(REAL, h);
      const dAz = Math.abs(((p.az - prev.az + 540) % 360) - 180);
      worst = Math.max(worst, dAz, Math.abs(p.el - prev.el));
      prev = p;
    }
    // Uma hora inteira move o Sol cerca de 0,51°; passos de 0,05 h devem ficar bem abaixo disso.
    expect(worst).toBeLessThan(0.05);
  });
});

