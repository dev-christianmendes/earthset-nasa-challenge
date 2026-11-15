// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// D-26: plataforma nivelada da base. A altura é uma só para a malha e para os objetos; fora da plataforma o relevo
// medido não muda; dentro dela a inclinação cai a valores confortáveis para rover, tripulação e módulos.
import { describe, expect, it } from 'vitest';
import { TERRAIN_MESH } from '../../src/data/terrain-mesh';
import { LEVELED_HEIGHTS, PADS, VERTICAL_EXAGGERATION, groundFor, padWeight, surfaceHeight } from '../../src/render/terrain-height';
import { OBSTACLES } from '../../src/render/crew-nav';

const { n, size_m, heights_m } = TERRAIN_MESH;
const step = size_m / (n - 1);
const half = size_m / 2;
const xOf = (i: number) => -half + i * step;
const zOf = (j: number) => half - j * step;

/** Inclinação (graus) no ponto, por diferença central de 1 m. */
function slopeAt(x: number, z: number): number {
  const gx = surfaceHeight(x + 0.5, z) - surfaceHeight(x - 0.5, z);
  const gz = surfaceHeight(x, z + 0.5) - surfaceHeight(x, z - 0.5);
  return (Math.atan(Math.hypot(gx, gz)) * 180) / Math.PI;
}

describe('plataformas niveladas (D-26)', () => {
  it('fora do raio externo de todas as plataformas, os vértices são o relevo medido com exagero, sem alteração', () => {
    let checked = 0;
    for (let j = 0; j < n; j += 3) {
      for (let i = 0; i < n; i += 3) {
        if (PADS.some((p) => Math.hypot(xOf(i) - p.cx, zOf(j) - p.cz) < p.outerRadius + step)) continue;
        const k = j * n + i;
        expect(LEVELED_HEIGHTS[k]).toBeCloseTo(heights_m[k] * VERTICAL_EXAGGERATION, 4);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });

  it('o peso de cada plataforma vai de 1 dentro do raio plano a 0 no externo, sem degrau', () => {
    for (const pad of PADS) {
      expect(padWeight(pad, 0)).toBe(1);
      expect(padWeight(pad, pad.flatRadius)).toBe(1);
      expect(padWeight(pad, pad.outerRadius)).toBe(0);
      let prev = 1;
      for (let d = pad.flatRadius; d <= pad.outerRadius; d += 0.25) {
        const w = padWeight(pad, d);
        expect(prev - w).toBeGreaterThanOrEqual(-1e-12);
        expect(prev - w).toBeLessThan(0.08);
        prev = w;
      }
    }
  });

  it('na área da base a inclinação média fica abaixo de 1,5° e a máxima abaixo de 3° (antes: 11° e 22°)', () => {
    let sum = 0;
    let max = 0;
    let count = 0;
    for (let x = -18; x <= 16; x += 0.5) {
      for (let z = -12; z <= 15; z += 0.5) {
        const s = slopeAt(x, z);
        sum += s;
        max = Math.max(max, s);
        count++;
      }
    }
    expect(sum / count).toBeLessThan(1.5);
    expect(max).toBeLessThan(3);
  });

  it('a plataforma de pouso e o local do gelo também ficam praticamente planos', () => {
    for (const pad of PADS.slice(1)) {
      let max = 0;
      for (let a = 0; a < 360; a += 15) {
        for (let d = 0; d <= pad.flatRadius - 1; d += 1) {
          max = Math.max(max, slopeAt(pad.cx + Math.cos((a * Math.PI) / 180) * d, pad.cz + Math.sin((a * Math.PI) / 180) * d));
        }
      }
      expect(max, pad.name).toBeLessThan(2);
    }
  });

  it('a rampa não cria paredes: em nenhum ponto passa a inclinação máxima do relevo medido (com exagero) nem a dele no mesmo ponto em mais de 12°', () => {
    /** Relevo medido com exagero, pelos mesmos triângulos da malha. */
    const raw = (x: number, z: number): number => {
      const fi = Math.min(n - 1.001, Math.max(0, (x + half) / step));
      const fj = Math.min(n - 1.001, Math.max(0, (half - z) / step));
      const i = Math.floor(fi);
      const j = Math.floor(fj);
      const u = fi - i;
      const v = fj - j;
      const h = (a: number, b: number) => heights_m[b * n + a] * VERTICAL_EXAGGERATION;
      return u + v <= 1 ? h(i, j) + u * (h(i + 1, j) - h(i, j)) + v * (h(i, j + 1) - h(i, j)) : h(i + 1, j + 1) + (1 - u) * (h(i, j + 1) - h(i + 1, j + 1)) + (1 - v) * (h(i + 1, j) - h(i + 1, j + 1));
    };
    const rawSlope = (x: number, z: number): number => (Math.atan(Math.hypot(raw(x + 0.5, z) - raw(x - 0.5, z), raw(x, z + 0.5) - raw(x, z - 0.5))) * 180) / Math.PI;
    let rawMax = 0;
    let levelMax = 0;
    let worstExcess = -Infinity;
    for (const pad of PADS) {
      for (let a = 0; a < 360; a += 5) {
        for (let d = 0; d <= pad.outerRadius + 20; d += 1) {
          const x = pad.cx + Math.cos((a * Math.PI) / 180) * d;
          const z = pad.cz + Math.sin((a * Math.PI) / 180) * d;
          const lv = slopeAt(x, z);
          const rw = rawSlope(x, z);
          rawMax = Math.max(rawMax, rw);
          levelMax = Math.max(levelMax, lv);
          worstExcess = Math.max(worstExcess, lv - rw);
        }
      }
    }
    expect(levelMax).toBeLessThanOrEqual(rawMax + 0.5);
    expect(worstExcess).toBeLessThan(12);
  });

  it('a altura dos objetos é a da malha desenhada: nos vértices coincide exatamente e entre eles fica dentro do triângulo', () => {
    for (const [i, j] of [[80, 80], [76, 82], [90, 70], [70, 95]]) {
      expect(surfaceHeight(xOf(i), zOf(j))).toBeCloseTo(LEVELED_HEIGHTS[j * n + i], 4);
    }
    // No centro da célula, a diagonal liga b e c: a altura é a média desses dois vértices.
    const i = 80;
    const j = 80;
    const b = LEVELED_HEIGHTS[j * n + i + 1];
    const c = LEVELED_HEIGHTS[(j + 1) * n + i];
    expect(surfaceHeight(xOf(i) + step / 2, zOf(j) - step / 2)).toBeCloseTo((b + c) / 2, 4);
  });

  it('sob a pegada de cada estrutura o relevo varia menos de 0,15 m: nada afunda de um lado nem fica no ar de outro', () => {
    for (const o of OBSTACLES) {
      if (o.name.startsWith('tower') || o.name === 'dock') continue;
      const [x0, x1, z0, z1] = o.kind === 'rect' ? [o.minX, o.maxX, o.minZ, o.maxZ] : [o.x - o.r, o.x + o.r, o.z - o.r, o.z + o.r];
      let lo = Infinity;
      let hi = -Infinity;
      for (let x = x0; x <= x1; x += 0.25) {
        for (let z = z0; z <= z1; z += 0.25) {
          const h = surfaceHeight(x, z);
          lo = Math.min(lo, h);
          hi = Math.max(hi, h);
        }
      }
      expect(hi - lo, o.name).toBeLessThan(0.15);
    }
  });

  it('pousar uma peça de 6 m na base não deixa mais de 0,15 m entre os cantos (antes: ~2,5 m)', () => {
    const base = groundFor(0, 0, 6);
    for (const h of [surfaceHeight(6, 0), surfaceHeight(-6, 0), surfaceHeight(0, 6), surfaceHeight(0, -6)]) expect(h - base).toBeLessThan(0.15);
  });
});
