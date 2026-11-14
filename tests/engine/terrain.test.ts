// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { horizonAt, type TerrainTable } from '../../src/engine/terrain';

const TABLE: TerrainTable = {
  azimuth_step_deg: 90,
  sites: {
    peak: { x_m: 0, y_m: 0, horizon_deg: [0, 10, 20, 30] },
    slope: { x_m: 0, y_m: 0, horizon_deg: [5, 5, 5, 5] },
    rim: { x_m: 0, y_m: 0, horizon_deg: [0, 0, 0, 0] },
  },
};

describe('horizonte medido (B2.3)', () => {
  it('devolve o valor exato em cada direção medida', () => {
    expect(horizonAt(TABLE, 'peak', 90)).toBe(10);
    expect(horizonAt(TABLE, 'peak', 180)).toBe(20);
  });

  it('interpola entre duas direções medidas', () => {
    expect(horizonAt(TABLE, 'peak', 45)).toBeCloseTo(5);
  });

  it('dá a volta: 315° fica entre a última direção e 0°', () => {
    expect(horizonAt(TABLE, 'peak', 315)).toBeCloseTo(15);
    expect(horizonAt(TABLE, 'peak', 360)).toBe(0);
    expect(horizonAt(TABLE, 'peak', -90)).toBe(30);
  });

  it('cada site tem o próprio horizonte', () => {
    expect(horizonAt(TABLE, 'slope', 200)).toBe(5);
    expect(horizonAt(TABLE, 'rim', 200)).toBe(0);
  });

  it('recusa azimute não finito', () => {
    expect(() => horizonAt(TABLE, 'peak', Number.NaN)).toThrow(RangeError);
  });
});
