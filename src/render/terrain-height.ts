// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Plataforma/exagero são apenas visuais; Sol e horizonte científico usam tabelas próprias.
import { TERRAIN_MESH } from '../data/terrain-mesh';

/** Exagero vertical do relevo na tela (a interface informa). */
export const VERTICAL_EXAGGERATION = 2;

/** Plataforma visual nivelada com rampa suave; método e limites em docs/data-sources.md, seção 4. */
export interface Pad {
  readonly name: string;
  /** Centro (m, cena). */
  readonly cx: number;
  readonly cz: number;
  readonly flatRadius: number;
  readonly outerRadius: number;
  /** Fração da inclinação do plano de ajuste que a plataforma mantém (0 = horizontal). */
  readonly tiltKeep: number;
  /** Fração da rugosidade (resíduo do plano) que sobra dentro da plataforma. */
  readonly roughKeep: number;
}

export const PADS: readonly Pad[] = [
  // Uma única plataforma evita a interferência entre rampas sobrepostas.
  { name: 'base', cx: 3, cz: -11, flatRadius: 31, outerRadius: 100, tiltKeep: 0, roughKeep: 0.02 },
];

const smooth = (x: number): number => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

export function padWeight(pad: Pad, d: number): number {
  return smooth((pad.outerRadius - d) / (pad.outerRadius - pad.flatRadius));
}

function applyPad(h: Float32Array, pad: Pad, n: number, step: number, half: number): void {
  const xOf = (i: number) => -half + i * step;
  const zOf = (j: number) => half - j * step;
  // Plano de melhor ajuste (mínimos quadrados) às alturas dentro do raio plano: h = c + a·dx + b·dz.
  let s1 = 0, sx = 0, sz = 0, sxx = 0, sxz = 0, szz = 0, sh = 0, shx = 0, shz = 0;
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const dx = xOf(i) - pad.cx;
      const dz = zOf(j) - pad.cz;
      if (Math.hypot(dx, dz) > pad.flatRadius) continue;
      const v = h[j * n + i];
      s1++; sx += dx; sz += dz; sxx += dx * dx; sxz += dx * dz; szz += dz * dz; sh += v; shx += v * dx; shz += v * dz;
    }
  }
  // Sistema normal 3×3 por Cramer.
  const det = (a: number[]) => a[0] * (a[4] * a[8] - a[5] * a[7]) - a[1] * (a[3] * a[8] - a[5] * a[6]) + a[2] * (a[3] * a[7] - a[4] * a[6]);
  const M = [s1, sx, sz, sx, sxx, sxz, sz, sxz, szz];
  const D = det(M);
  const col = (idx: number, v: number[]) => M.map((m, q) => (q % 3 === idx ? v[Math.floor(q / 3)] : m));
  const rhs = [sh, shx, shz];
  const ok = Math.abs(D) > 1e-9;
  const c = ok ? det(col(0, rhs)) / D : sh / Math.max(1, s1);
  const a = ok ? det(col(1, rhs)) / D : 0;
  const b = ok ? det(col(2, rhs)) / D : 0;
  // Calcula tudo a partir das alturas de antes desta plataforma, para a ordem dos vértices não importar.
  const before = Float32Array.from(h);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      const dx = xOf(i) - pad.cx;
      const dz = zOf(j) - pad.cz;
      const w = padWeight(pad, Math.hypot(dx, dz));
      if (w <= 0) continue;
      const plane = c + a * dx + b * dz;
      // A rampa recupera a inclinação regional para não formar uma parede na borda.
      const tilt = pad.tiltKeep + (1 - pad.tiltKeep) * (1 - w);
      const flat = c + tilt * (a * dx + b * dz) + pad.roughKeep * (before[k] - plane);
      h[k] = before[k] * (1 - w) + flat * w;
    }
  }
}

function buildLeveled(): Float32Array {
  const { n, size_m, heights_m } = TERRAIN_MESH;
  const step = size_m / (n - 1);
  const half = size_m / 2;
  const h = Float32Array.from(heights_m, (v) => v * VERTICAL_EXAGGERATION);
  for (const pad of PADS) applyPad(h, pad, n, step, half);
  return h;
}

export const LEVELED_HEIGHTS: Float32Array = buildLeveled();

/**
 * Altura do relevo (metros) no ponto (x, z) da cena. Interpola pelos MESMOS triângulos da malha desenhada
 * (diagonal de cada célula como em `buildTerrain`), para um objeto pousar exatamente sobre o que se vê.
 */
export function surfaceHeight(x: number, z: number): number {
  const { n, size_m } = TERRAIN_MESH;
  const step = size_m / (n - 1);
  const half = size_m / 2;
  const fi = Math.min(n - 1.001, Math.max(0, (x + half) / step));
  const fj = Math.min(n - 1.001, Math.max(0, (half - z) / step));
  const i = Math.floor(fi);
  const j = Math.floor(fj);
  const u = fi - i;
  const v = fj - j;
  const h = (a: number, b: number) => LEVELED_HEIGHTS[b * n + a];
  const ha = h(i, j);
  const hb = h(i + 1, j);
  const hc = h(i, j + 1);
  const hd = h(i + 1, j + 1);
  return u + v <= 1 ? ha + u * (hb - ha) + v * (hc - ha) : hd + (1 - u) * (hc - hd) + (1 - v) * (hb - hd);
}

/** Altura para pousar uma peça de `radius` metros: a menor altura entre o centro e quatro pontos da borda,
 * para nenhum pé ficar no ar (a peça afunda um pouco no lado alto, como em regolito solto). */
export function groundFor(x: number, z: number, radius: number): number {
  const pts = [
    surfaceHeight(x, z),
    surfaceHeight(x + radius, z),
    surfaceHeight(x - radius, z),
    surfaceHeight(x, z + radius),
    surfaceHeight(x, z - radius),
  ];
  return Math.min(...pts);
}
