// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Trajetória do rover (só matemática 2D, sem three.js, testada no Vitest). Três camadas (D-22):
//  1. Rota: o planejador de navegação (crew-nav.ts) com a folga do veículo, contornando estruturas;
//     no campo solar, um corredor entre as colunas até a vaga.
//  2. Geometria: cantos trocados por arcos de raio mínimo (curvatura contínua por trecho, como um veículo).
//  3. Tempo: perfil de velocidade que freia antes das curvas (aceleração lateral limitada, pouca tração no regolito)
//     e acelera nas retas. O perfil é esticado para caber exatamente nas horas do motor (`TASK_PHASE_HOURS`).
// Números de veículo ilustrativos, guiados pelo rover das Apollo (13 km/h de projeto); não são medição.
import type { TaskKind } from '../engine/robot';
import { OBSTACLES, planRoute, type Obstacle, type Point, type PolyPath } from './crew-nav';
import { ANTENNA_WORK, DOCK, ICE_PROCESSOR, ICE_SITE, PANEL_SLOTS, type Spot } from './layout';

/** Onde o rover descarrega o regolito com gelo, na frente do processador. */
export const PROCESSOR_FRONT: Spot = { x: ICE_PROCESSOR.x, z: ICE_PROCESSOR.z - 2.6 };
/** Meia largura do rover (~0,95 m) mais margem: folga do centro do rover às estruturas. */
export const ROVER_CLEARANCE = 1.3;
/** Raio mínimo de curva (m). Um rover de seis rodas faz curvas fechadas, mas não gira no lugar em movimento. */
export const MIN_TURN_RADIUS = 2.6;
/** Limites do perfil (forma da curva de velocidade; o tempo total é o do motor). */
export const PROFILE = { vMax: 3, aLat: 0.8, accel: 1.2, decel: 1.4 } as const;

/** Obstáculos para o rover: os da base sem a própria garagem (ele sai e chega a ela). */
const ROVER_OBSTACLES: readonly Obstacle[] = OBSTACLES.filter((o) => o.name !== 'dock');
/** Linha ao norte do campo solar por onde o rover entra nos corredores. */
const FIELD_ENTRY_Z = -10.2;

/**
 * Corredor de cada coluna do campo solar: só os vãos entre colunas. A leste da primeira coluna fica a unidade de energia
 * (vão de ~1 m, menor que o rover) e a oeste da última, a torre de luz: as duas primeiras colunas usam o vão entre elas,
 * a terceira usa o vão entre a segunda e a terceira.
 */
function corridorX(slotX: number): number {
  const cols = [...new Set(PANEL_SLOTS.map((s) => s.x))].sort((a, b) => b - a);
  const gap = (i: number) => (cols[i] + cols[i + 1]) / 2;
  const c = cols.indexOf(slotX);
  return c <= 1 ? gap(0) : gap(1);
}

/** Rota de ida (garagem → local) por tipo de missão; o painel depende da vaga. */
export function roverRoute(kind: TaskKind, panelSlot: number): readonly Point[] {
  if (kind === 'ice') return planRoute(DOCK, ICE_SITE, ROVER_OBSTACLES, ROVER_CLEARANCE);
  if (kind === 'antenna') return planRoute(DOCK, ANTENNA_WORK, ROVER_OBSTACLES, ROVER_CLEARANCE);
  const slot = PANEL_SLOTS[Math.min(panelSlot, PANEL_SLOTS.length - 1)];
  const x = corridorX(slot.x);
  const entry = { x, z: FIELD_ENTRY_Z };
  return [...planRoute(DOCK, entry, ROVER_OBSTACLES, ROVER_CLEARANCE), { x, z: slot.z }];
}

/** Rota de volta: no gelo, do local até a frente do processador (para descarregar); nas outras, a ida ao contrário. */
export function roverReturn(kind: TaskKind, panelSlot: number): readonly Point[] {
  if (kind === 'ice') return planRoute(ICE_SITE, PROCESSOR_FRONT, ROVER_OBSTACLES, ROVER_CLEARANCE);
  return [...roverRoute(kind, panelSlot)].reverse();
}

/**
 * Troca cada canto por um arco de círculo tangente aos dois trechos (raio mínimo, reduzido só se o trecho for curto).
 * Resultado amostrado: arcos a cada ~0,1 rad, retas pelas pontas.
 */
export function filletRoute(route: readonly Point[], radius = MIN_TURN_RADIUS): Point[] {
  const pts = route.filter((p, i) => i === 0 || Math.hypot(p.x - route[i - 1].x, p.z - route[i - 1].z) > 1e-6);
  if (pts.length < 3) return [...pts];
  const out: Point[] = [pts[0]];
  // Quanto cada canto pode "comer" de cada trecho: metade, para dois arcos vizinhos não se cruzarem.
  for (let i = 1; i < pts.length - 1; i++) {
    const a = pts[i - 1];
    const c = pts[i];
    const b = pts[i + 1];
    const inX = c.x - a.x;
    const inZ = c.z - a.z;
    const outX = b.x - c.x;
    const outZ = b.z - c.z;
    const lin = Math.hypot(inX, inZ);
    const lout = Math.hypot(outX, outZ);
    const h0 = Math.atan2(inX, inZ);
    const h1 = Math.atan2(outX, outZ);
    const turn = Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0));
    if (Math.abs(turn) < 1e-3) {
      out.push(c);
      continue;
    }
    const half = Math.abs(turn) / 2;
    const maxTangent = Math.min(i === 1 ? lin : lin / 2, i === pts.length - 2 ? lout : lout / 2);
    const tangent = Math.min(radius * Math.tan(half), maxTangent);
    const r = tangent / Math.tan(half);
    const ux = inX / lin;
    const uz = inZ / lin;
    const start = { x: c.x - ux * tangent, z: c.z - uz * tangent };
    // Centro: perpendicular ao trecho de entrada, para o lado da curva.
    const side = Math.sign(turn);
    const nx = uz * side;
    const nz = -ux * side;
    const cx = start.x + nx * r;
    const cz = start.z + nz * r;
    const a0 = Math.atan2(start.z - cz, start.x - cx);
    const steps = Math.max(2, Math.ceil(Math.abs(turn) / 0.1));
    for (let k = 0; k <= steps; k++) {
      const ang = a0 - (turn * k) / steps;
      out.push({ x: cx + Math.cos(ang) * r, z: cz + Math.sin(ang) * r });
    }
  }
  out.push(pts[pts.length - 1]);
  return out.filter((p, i) => i === 0 || Math.hypot(p.x - out[i - 1].x, p.z - out[i - 1].z) > 1e-6);
}

/** Trajetória pronta: caminho reamostrado, curvatura, e tempo acumulado do perfil de velocidade. */
export interface RoverTrack {
  readonly path: PolyPath;
  /** Tempo do perfil (s) em cada ponto do caminho; o último é a duração total do perfil. */
  readonly time: Float64Array;
  /** Velocidade do perfil (m/s) em cada ponto. */
  readonly speed: Float64Array;
  /** Curvatura (1/m) em cada ponto. */
  readonly curvature: Float64Array;
}

const STEP = 0.25;

function buildTrack(route: readonly Point[]): RoverTrack {
  const dense = filletRoute(route);
  // Reamostra a cada STEP metros para o perfil ter resolução uniforme.
  const acc: number[] = [0];
  for (let i = 1; i < dense.length; i++) acc.push(acc[i - 1] + Math.hypot(dense[i].x - dense[i - 1].x, dense[i].z - dense[i - 1].z));
  const length = acc[acc.length - 1];
  const n = Math.max(2, Math.ceil(length / STEP) + 1);
  const xs = new Float64Array(n);
  const zs = new Float64Array(n);
  const ss = new Float64Array(n);
  let seg = 0;
  for (let i = 0; i < n; i++) {
    const s = (length * i) / (n - 1);
    while (seg < dense.length - 2 && acc[seg + 1] < s) seg++;
    const l = acc[seg + 1] - acc[seg];
    const f = l > 0 ? (s - acc[seg]) / l : 0;
    xs[i] = dense[seg].x + (dense[seg + 1].x - dense[seg].x) * f;
    zs[i] = dense[seg].z + (dense[seg + 1].z - dense[seg].z) * f;
    ss[i] = s;
  }
  // Curvatura pela variação de rumo entre pontos vizinhos.
  const curvature = new Float64Array(n);
  for (let i = 1; i < n - 1; i++) {
    const h0 = Math.atan2(xs[i] - xs[i - 1], zs[i] - zs[i - 1]);
    const h1 = Math.atan2(xs[i + 1] - xs[i], zs[i + 1] - zs[i]);
    const ds = (ss[i + 1] - ss[i - 1]) / 2;
    curvature[i] = ds > 0 ? Math.abs(Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0))) / ds : 0;
  }
  // Perfil: limite de curva, depois aceleração (ida) e frenagem (volta), parado nas pontas.
  const v = new Float64Array(n);
  for (let i = 0; i < n; i++) v[i] = curvature[i] > 1e-6 ? Math.min(PROFILE.vMax, Math.sqrt(PROFILE.aLat / curvature[i])) : PROFILE.vMax;
  v[0] = 0;
  v[n - 1] = 0;
  for (let i = 1; i < n; i++) v[i] = Math.min(v[i], Math.sqrt(v[i - 1] * v[i - 1] + 2 * PROFILE.accel * (ss[i] - ss[i - 1])));
  for (let i = n - 2; i >= 0; i--) v[i] = Math.min(v[i], Math.sqrt(v[i + 1] * v[i + 1] + 2 * PROFILE.decel * (ss[i + 1] - ss[i])));
  const time = new Float64Array(n);
  for (let i = 1; i < n; i++) {
    const mean = (v[i] + v[i - 1]) / 2;
    time[i] = time[i - 1] + (ss[i] - ss[i - 1]) / Math.max(mean, 0.05);
  }
  return { path: { xs, zs, acc: ss, length }, time, speed: v, curvature };
}

const cache = new Map<string, RoverTrack>();

/** Trajetória de uma rota (calculada uma vez por rota). */
export function roverTrack(route: readonly Point[]): RoverTrack {
  const key = route.map((p) => `${p.x.toFixed(3)},${p.z.toFixed(3)}`).join(';');
  let track = cache.get(key);
  if (!track) {
    track = buildTrack(route);
    cache.set(key, track);
  }
  return track;
}

/**
 * Distância no caminho para o progresso `k` (0 a 1) do trecho do motor: o tempo do perfil é esticado para a
 * duração do trecho, então o rover freia nas curvas e acelera nas retas sem sair do horário do motor.
 */
export function distanceAt(track: RoverTrack, k: number): number {
  const total = track.time[track.time.length - 1];
  const t = Math.min(1, Math.max(0, k)) * total;
  const time = track.time;
  let lo = 0;
  let hi = time.length - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (time[mid] <= t) lo = mid;
    else hi = mid;
  }
  const span = time[hi] - time[lo];
  const f = span > 0 ? (t - time[lo]) / span : 0;
  return track.path.acc[lo] + (track.path.acc[hi] - track.path.acc[lo]) * f;
}

/** Velocidade real (m/s) no pico do trecho, quando o perfil é esticado para `legSeconds` segundos. */
export function peakSpeed(track: RoverTrack, legSeconds: number): number {
  const total = track.time[track.time.length - 1];
  let peak = 0;
  for (const v of track.speed) peak = Math.max(peak, v);
  return (peak * total) / legSeconds;
}
