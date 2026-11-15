// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Navegação da tripulação na base: obstáculos (pegadas medidas nos modelos v4), rota por grafo de visibilidade
// e curvas arredondadas. Só matemática 2D (x, z), sem three.js, para ser testada no Vitest.
// Distâncias em metros da cena. Pegadas e folgas são escolha de apresentação (ilustrativas).
import type { AgentTaskKind } from '../engine/astronaut';
import { ANTENNA, ANTENNA_WORK, AIRLOCK, DOCK, GREENHOUSE, ICE_PROCESSOR, LANDING_PAD, LIGHT_TOWERS, PANEL_SLOTS, POWER_UNIT, STORAGE, TANKS, type Spot } from './layout';

export interface Point {
  readonly x: number;
  readonly z: number;
}

export type Obstacle =
  | { readonly kind: 'rect'; readonly name: string; readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number }
  | { readonly kind: 'circle'; readonly name: string; readonly x: number; readonly z: number; readonly r: number };

const rect = (name: string, minX: number, maxX: number, minZ: number, maxZ: number): Obstacle => ({ kind: 'rect', name, minX, maxX, minZ, maxZ });
const around = (name: string, c: Spot, hx: number, hz: number): Obstacle => rect(name, c.x - hx, c.x + hx, c.z - hz, c.z + hz);
const circle = (name: string, c: Spot, r: number): Obstacle => ({ kind: 'circle', name, x: c.x, z: c.z, r });

/**
 * Pegadas no chão (caixas alinhadas aos eixos e círculos), medidas nos modelos v4 carregados na cena
 * (Box3 de cada grupo, 15/11/2026). O habitat é uma cruz: dois módulos ao longo de z e a câmara a leste.
 */
export const OBSTACLES: readonly Obstacle[] = [
  rect('habitat', -1.75, 1.75, -7.2, 7.2),
  rect('airlock', 1.2, AIRLOCK.x + 0.9, -1.0, 1.0),
  circle('greenhouse', GREENHOUSE, 2.6),
  around('antenna', ANTENNA, 1.15, 0.95),
  around('power', POWER_UNIT, 1.1, 1.1),
  rect('processor', 8, 12.05, ICE_PROCESSOR.z - 0.85, ICE_PROCESSOR.z + 0.85),
  around('tanks', TANKS, 0.8, 1.7),
  rect('storage', 8.8, 14.05, STORAGE.z - 3.75, STORAGE.z + 1.15),
  // Campo solar (12 vagas, 3 colunas × 4 linhas): uma pegada única, instaladas ou não.
  rect('panels', -16.7, -7.9, -7.6, 7.1),
  // Rover estacionado na garagem.
  around('dock', DOCK, 1.2, 1.7),
  circle('pad', LANDING_PAD, 7.2),
  ...LIGHT_TOWERS.map((t, i) => circle(`tower_${i}`, t, 0.8)),
];

/** Folga entre o centro do astronauta e qualquer pegada (meia largura do traje e margem). */
export const CLEARANCE = 0.55;
/** Folga reduzida para o obstáculo onde a rota começa ou termina (posto de trabalho encostado no equipamento). */
const NEAR_CLEARANCE = 0.12;
/** Distância extra dos vértices do grafo além da folga: espaço para arredondar as curvas sem invadir. */
const NODE_MARGIN = 0.45;

function distToRect(o: Extract<Obstacle, { kind: 'rect' }>, p: Point): number {
  const dx = Math.max(o.minX - p.x, 0, p.x - o.maxX);
  const dz = Math.max(o.minZ - p.z, 0, p.z - o.maxZ);
  return Math.hypot(dx, dz);
}

/** Distância de um ponto à pegada (0 dentro dela). */
export function distanceTo(o: Obstacle, p: Point): number {
  if (o.kind === 'circle') return Math.max(0, Math.hypot(p.x - o.x, p.z - o.z) - o.r);
  return distToRect(o, p);
}

function insideRect(o: Extract<Obstacle, { kind: 'rect' }>, p: Point): boolean {
  return p.x > o.minX && p.x < o.maxX && p.z > o.minZ && p.z < o.maxZ;
}

/** Ponto dentro da pegada (sem folga). */
export function isInside(o: Obstacle, p: Point): boolean {
  return o.kind === 'circle' ? Math.hypot(p.x - o.x, p.z - o.z) < o.r : insideRect(o, p);
}

/** Menor distância entre o segmento AB e a pegada, por amostragem densa (pegadas são convexas e pequenas). */
function segmentDistance(o: Obstacle, a: Point, b: Point): number {
  if (o.kind === 'circle') {
    const vx = b.x - a.x;
    const vz = b.z - a.z;
    const len2 = vx * vx + vz * vz;
    const t = len2 > 0 ? Math.min(1, Math.max(0, ((o.x - a.x) * vx + (o.z - a.z) * vz) / len2)) : 0;
    return Math.max(0, Math.hypot(a.x + vx * t - o.x, a.z + vz * t - o.z) - o.r);
  }
  // Retângulo: se o segmento cruza a caixa, 0; senão o mínimo está numa ponta do segmento ou num canto da caixa.
  if (segmentHitsRect(o, a, b)) return 0;
  let best = Math.min(distToRect(o, a), distToRect(o, b));
  for (const cx of [o.minX, o.maxX]) for (const cz of [o.minZ, o.maxZ]) best = Math.min(best, pointSegment(cx, cz, a, b));
  return best;
}

function pointSegment(px: number, pz: number, a: Point, b: Point): number {
  const vx = b.x - a.x;
  const vz = b.z - a.z;
  const len2 = vx * vx + vz * vz;
  const t = len2 > 0 ? Math.min(1, Math.max(0, ((px - a.x) * vx + (pz - a.z) * vz) / len2)) : 0;
  return Math.hypot(a.x + vx * t - px, a.z + vz * t - pz);
}

/** Recorte de Liang–Barsky: o segmento AB toca a caixa? */
function segmentHitsRect(o: Extract<Obstacle, { kind: 'rect' }>, a: Point, b: Point): boolean {
  let t0 = 0;
  let t1 = 1;
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const edges: Array<[number, number]> = [
    [-dx, a.x - o.minX],
    [dx, o.maxX - a.x],
    [-dz, a.z - o.minZ],
    [dz, o.maxZ - a.z],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) t0 = Math.max(t0, r);
    else t1 = Math.min(t1, r);
    if (t0 > t1) return false;
  }
  return true;
}

/** Folga exigida de cada obstáculo para uma rota entre `from` e `to`. Quem contém a ponta é ignorado. */
function clearances(from: Point, to: Point, obstacles: readonly Obstacle[], clearance: number): number[] {
  return obstacles.map((o) => {
    if (isInside(o, from) || isInside(o, to)) return -1;
    const near = distanceTo(o, from) < clearance + 0.05 || distanceTo(o, to) < clearance + 0.05;
    return near ? NEAR_CLEARANCE : clearance;
  });
}

function segmentClear(a: Point, b: Point, obstacles: readonly Obstacle[], need: readonly number[]): boolean {
  for (let i = 0; i < obstacles.length; i++) {
    if (need[i] < 0) continue;
    if (segmentDistance(obstacles[i], a, b) < need[i] - 1e-9) return false;
  }
  return true;
}

/** Vértices candidatos em volta de cada pegada (cantos afastados e octógono em volta dos círculos). */
function graphNodes(obstacles: readonly Obstacle[], clearance: number): Point[] {
  const out: Point[] = [];
  const d = clearance + NODE_MARGIN;
  for (const o of obstacles) {
    if (o.kind === 'rect') {
      const k = d / Math.SQRT2 + 0.15;
      out.push({ x: o.minX - k, z: o.minZ - k }, { x: o.maxX + k, z: o.minZ - k }, { x: o.maxX + k, z: o.maxZ + k }, { x: o.minX - k, z: o.maxZ + k });
    } else {
      const R = (o.r + d) / Math.cos(Math.PI / 8);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + Math.PI / 8;
        out.push({ x: o.x + Math.cos(a) * R, z: o.z + Math.sin(a) * R });
      }
    }
  }
  return out.filter((p) => obstacles.every((o) => distanceTo(o, p) >= clearance + 0.1));
}

interface NodeGraph {
  readonly obstacles: readonly Obstacle[];
  readonly clearance: number;
  readonly nodes: Point[];
  /** Visibilidade entre vértices fixos (folga cheia), calculada uma vez. */
  readonly vis: Uint8Array;
}
/** Um grafo por conjunto de obstáculos e folga (astronauta e rover usam folgas diferentes). */
const graphs: NodeGraph[] = [];

function nodeGraph(obstacles: readonly Obstacle[], clearance: number): NodeGraph {
  const hit = graphs.find((g) => g.obstacles === obstacles && g.clearance === clearance);
  if (hit) return hit;
  const nodes = graphNodes(obstacles, clearance);
  const full = obstacles.map(() => clearance);
  const m = nodes.length;
  const vis = new Uint8Array(m * m);
  for (let i = 0; i < m; i++)
    for (let j = i + 1; j < m; j++) if (segmentClear(nodes[i], nodes[j], obstacles, full)) vis[i * m + j] = vis[j * m + i] = 1;
  const graph = { obstacles, clearance, nodes, vis };
  graphs.push(graph);
  return graph;
}

/**
 * Rota mais curta de `from` a `to` que mantém a folga de todas as pegadas (grafo de visibilidade + Dijkstra).
 * Calculada só quando o destino muda, nunca por quadro. Sem rota possível, devolve a reta.
 */
export function planRoute(from: Point, to: Point, obstacles: readonly Obstacle[] = OBSTACLES, clearance = CLEARANCE): Point[] {
  const need = clearances(from, to, obstacles, clearance);
  if (segmentClear(from, to, obstacles, need)) return [from, to];
  const graph = nodeGraph(obstacles, clearance);
  const m = graph.nodes.length;
  const pts = [from, to, ...graph.nodes];
  const n = pts.length;
  const dist = new Float64Array(n).fill(Infinity);
  const prev = new Int32Array(n).fill(-1);
  const done = new Uint8Array(n);
  dist[0] = 0;
  for (;;) {
    let u = -1;
    for (let i = 0; i < n; i++) if (!done[i] && dist[i] < Infinity && (u < 0 || dist[i] < dist[u])) u = i;
    if (u < 0 || u === 1) break;
    done[u] = 1;
    for (let v = 0; v < n; v++) {
      if (done[v] || v === u) continue;
      const w = Math.hypot(pts[v].x - pts[u].x, pts[v].z - pts[u].z);
      if (dist[u] + w >= dist[v]) continue;
      const fixed = u >= 2 && v >= 2;
      if (fixed ? !graph.vis[(u - 2) * m + (v - 2)] : !segmentClear(pts[u], pts[v], obstacles, need)) continue;
      dist[v] = dist[u] + w;
      prev[v] = u;
    }
  }
  if (prev[1] < 0) return [from, to];
  const route: Point[] = [];
  for (let v = 1; v >= 0; v = prev[v]) route.push(pts[v]);
  return route.reverse();
}

/** Caminho amostrado com comprimento acumulado: posição e direção por distância percorrida. */
export interface PolyPath {
  readonly xs: Float64Array;
  readonly zs: Float64Array;
  /** Distância acumulada até cada ponto. */
  readonly acc: Float64Array;
  readonly length: number;
}

/** Raio máximo do arredondamento de cada canto (metros). */
const CORNER_CUT = 1.1;

/** Arredonda os cantos da rota (curva de Bézier quadrática em cada vértice interno) e amostra. */
export function smoothPath(route: readonly Point[]): PolyPath {
  const out: Point[] = [route[0]];
  for (let i = 1; i < route.length - 1; i++) {
    const a = route[i - 1];
    const c = route[i];
    const b = route[i + 1];
    const la = Math.hypot(c.x - a.x, c.z - a.z);
    const lb = Math.hypot(b.x - c.x, b.z - c.z);
    const cut = Math.min(CORNER_CUT, la * 0.45, lb * 0.45);
    if (cut < 1e-3) {
      out.push(c);
      continue;
    }
    const p0 = { x: c.x + ((a.x - c.x) / la) * cut, z: c.z + ((a.z - c.z) / la) * cut };
    const p2 = { x: c.x + ((b.x - c.x) / lb) * cut, z: c.z + ((b.z - c.z) / lb) * cut };
    const steps = 8;
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const u = 1 - t;
      out.push({ x: u * u * p0.x + 2 * u * t * c.x + t * t * p2.x, z: u * u * p0.z + 2 * u * t * c.z + t * t * p2.z });
    }
  }
  out.push(route[route.length - 1]);
  // Remove pontos repetidos (segmentos de comprimento zero quebram a direção).
  const pts = out.filter((p, i) => i === 0 || Math.hypot(p.x - out[i - 1].x, p.z - out[i - 1].z) > 1e-6);
  const xs = new Float64Array(pts.length);
  const zs = new Float64Array(pts.length);
  const acc = new Float64Array(pts.length);
  pts.forEach((p, i) => {
    xs[i] = p.x;
    zs[i] = p.z;
    if (i > 0) acc[i] = acc[i - 1] + Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z);
  });
  return { xs, zs, acc, length: acc[pts.length - 1] };
}

/** Posição e direção (`heading` = atan2(dx, dz), frente do modelo em +z) a `s` metros do início. Sem alocação. */
export function sampleInto(path: PolyPath, s: number, out: { x: number; z: number; heading: number }): void {
  const n = path.xs.length;
  if (n === 1) {
    out.x = path.xs[0];
    out.z = path.zs[0];
    return;
  }
  const d = Math.min(path.length, Math.max(0, s));
  let lo = 0;
  let hi = n - 1;
  while (hi - lo > 1) {
    const mid = (lo + hi) >> 1;
    if (path.acc[mid] <= d) lo = mid;
    else hi = mid;
  }
  const seg = path.acc[hi] - path.acc[lo];
  const f = seg > 0 ? (d - path.acc[lo]) / seg : 0;
  const dx = path.xs[hi] - path.xs[lo];
  const dz = path.zs[hi] - path.zs[lo];
  out.x = path.xs[lo] + dx * f;
  out.z = path.zs[lo] + dz * f;
  out.heading = Math.atan2(dx, dz);
}

/** Porta da câmara de descompressão, do lado de fora: quem entra ou sai do habitat passa por ela. */
export const AIRLOCK_DOOR: Point = { x: AIRLOCK.x + 1.5, z: 0 };
const AIRLOCK_OBSTACLE = OBSTACLES.find((o) => o.name === 'airlock') as Obstacle;

/** Rota planejada e arredondada, pronta para andar. Dentro da câmara, a rota sai (ou entra) pela porta, nunca pela parede. */
export function pathBetween(from: Point, to: Point, obstacles: readonly Obstacle[] = OBSTACLES): PolyPath {
  const fromInside = isInside(AIRLOCK_OBSTACLE, from);
  const toInside = isInside(AIRLOCK_OBSTACLE, to);
  if (fromInside === toInside) return smoothPath(planRoute(from, to, obstacles));
  if (fromInside) return smoothPath([from, ...planRoute(AIRLOCK_DOOR, to, obstacles)]);
  return smoothPath([...planRoute(from, AIRLOCK_DOOR, obstacles), to]);
}

// ---------- Postos da tripulação ----------

/** Casa de cada astronauta: ao lado da câmara de descompressão. */
export const CREW_HOMES: readonly Spot[] = [
  { x: 5.6, z: 1.4 },
  { x: 6.2, z: -1.2 },
];
/** Postos de trabalho na estufa, um por astronauta: lado nordeste do domo, rotas de comprimento parecido. */
export const GH_WORK_SPOTS: readonly Spot[] = [
  { x: GREENHOUSE.x + 3.25 * Math.cos(-1.13), z: GREENHOUSE.z + 3.25 * Math.sin(-1.13) },
  { x: GREENHOUSE.x + 3.25 * Math.cos(-0.52), z: GREENHOUSE.z + 3.25 * Math.sin(-0.52) },
];
/** Ponto de trabalho no campo solar (primeira coluna, lado norte) e para onde o astronauta olha. */
export const PANEL_FIELD_WORK: Spot = { x: -7.2, z: -8 };
const PANEL_FIELD_FOCUS: Spot = { x: PANEL_SLOTS[0].x, z: PANEL_SLOTS[0].z };
/** Ajudante do gelo: ao lado do processador, fora da pegada dele. */
export const ICE_HELPER: Spot = { x: ICE_PROCESSOR.x - 2.6, z: ICE_PROCESSOR.z - 1.3 };

type Site = 'greenhouse' | 'panels' | 'antenna';
const SITE_OF: Record<AgentTaskKind, Site> = { inspect: 'greenhouse', harvest: 'greenhouse', maintain: 'greenhouse', calibrate: 'panels', tune: 'antenna' };

/** Onde o astronauta `i` faz a tarefa. */
export function workSpot(i: number, kind: AgentTaskKind): Spot {
  const site = SITE_OF[kind];
  if (site === 'panels') return PANEL_FIELD_WORK;
  if (site === 'antenna') return ANTENNA_WORK;
  return GH_WORK_SPOTS[i] ?? GH_WORK_SPOTS[0];
}

/** Para onde o astronauta olha enquanto trabalha. */
export function siteFocus(kind: AgentTaskKind): Spot {
  const site = SITE_OF[kind];
  return site === 'panels' ? PANEL_FIELD_FOCUS : site === 'antenna' ? ANTENNA : GREENHOUSE;
}
