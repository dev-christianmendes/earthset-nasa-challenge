// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Modelo ilustrativo: números escolhidos para leitura visual, guiados pelo número de Froude (v² / g·L), não medidos.
import { sampleInto, type PolyPath } from './crew-nav';

/** Gravidade na superfície da Lua (m/s²). Fonte: NASA Moon Fact Sheet (docs/data-sources.md). */
export const MOON_GRAVITY = 1.62;
/** Velocidade de cruzeiro do passo lunar saltado ("lope") em 1×, em m/s (ilustrativa; Apollo: ~1 a 2 m/s). */
export const LOPE_SPEED = 2.0;
/** Aceleração e frenagem do traje em 1× (m/s²): pouco atrito, muita massa; inércia visível sem atrasar a tarefa. */
export const ACCEL = 1.5;
export const DECEL = 1.3;
/**
 * Transição andar → saltar: número de Froude ~0,5 (pernas de ~0,9 m). Na Lua, v = √(0,5 · 1,62 · 0,9) ≈ 0,85 m/s,
 * bem abaixo da Terra (≈ 2 m/s): por isso o astronauta salta já em velocidade de caminhada.
 */
export const GAIT_SWITCH_SPEED = Math.sqrt(0.5 * MOON_GRAVITY * 0.9);

/**
 * Quanto do clipe de corrida entra no passo saltado (o resto é caminhada, na mesma fase). A corrida pura do modelo
 * é um sprint terrestre de joelhos altos; misturada, vira uma passada longa e baixa, coerente com o traje rígido.
 */
export const LOPE_BLEND = 0.55;

export interface GaitProfile {
  /** Duração do clipe (s). */
  readonly duration: number;
  /** Fase (0 a 1) em que o pé esquerdo apoia: o ciclo comum a todos os clipes começa aí. */
  readonly plant: number;
  /** Velocidade do pé apoiado no clipe (m por segundo de clipe): ritmo que casa o passo com o chão. */
  readonly footSpeed: number;
  /** Por amostra: início e comprimento (fase) da janela de voo que contém a amostra; comprimento 0 = algum pé no chão. */
  readonly flightStart: Float32Array;
  readonly flightLen: Float32Array;
}

export function buildGaitProfile(duration: number, ly: ArrayLike<number>, lz: ArrayLike<number>, ry: ArrayLike<number>, rz: ArrayLike<number>): GaitProfile {
  const n = ly.length;
  const minL = Math.min(...Array.from(ly));
  const minR = Math.min(...Array.from(ry));
  const CONTACT = 0.06;
  const onL = (i: number) => ly[(i + n) % n] < minL + CONTACT;
  const onR = (i: number) => ry[(i + n) % n] < minR + CONTACT;
  let plantIdx = 0;
  for (let i = 0; i < n; i++)
    if (onL(i) && !onL(i - 1)) {
      plantIdx = i;
      break;
    }
  const dt = duration / n;
  const speeds: number[] = [];
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    if (onL(i) && onL(j)) speeds.push(Math.abs(lz[j] - lz[i]) / dt);
    if (onR(i) && onR(j)) speeds.push(Math.abs(rz[j] - rz[i]) / dt);
  }
  speeds.sort((a, b) => a - b);
  const footSpeed = speeds.length ? speeds[Math.floor(speeds.length / 2)] : 1;
  const flightStart = new Float32Array(n);
  const flightLen = new Float32Array(n);
  const air = (i: number) => !onL(i) && !onR(i);
  for (let i = 0; i < n; i++) {
    if (!air(i)) continue;
    let a = i;
    let steps = 0;
    while (air(a - 1) && steps < n) {
      a--;
      steps++;
    }
    let b = i;
    steps = 0;
    while (air(b + 1) && steps < n) {
      b++;
      steps++;
    }
    flightStart[i] = (((a / n) % 1) + 1) % 1;
    flightLen[i] = (b - a + 1) / n;
  }
  return { duration, plant: plantIdx / n, footSpeed: Math.max(0.2, footSpeed), flightStart, flightLen };
}

export function nominalProfile(duration: number, nominalSpeed: number): GaitProfile {
  return { duration, plant: 0, footSpeed: nominalSpeed / duration, flightStart: new Float32Array(1), flightLen: new Float32Array(1) };
}

export interface Walker {
  x: number;
  z: number;
  /** Direção do corpo (atan2(dx, dz)). */
  heading: number;
  yawRate: number;
  /** Velocidade no caminho (m/s, tempo real). */
  speed: number;
  /** Aceleração filtrada (m/s²), para a inclinação do tronco. */
  accel: number;
  path: PolyPath | null;
  s: number;
  prevTarget: number;
  targetSpeed: number;
  /** Fase do ciclo da passada (0 a 1, 0 = pé esquerdo apoia). */
  phase: number;
  /** Apoios de pé contados até agora (dois por ciclo). O som dos passos lê a diferença entre quadros. */
  steps: number;
  /** Pesos suavizados: deslocamento (0 parado a 1 andando) e salto (0 caminhada a 1 passo saltado). */
  moveWeight: number;
  hopWeight: number;
  /** Altura extra do voo lunar (m) e inclinações do corpo (rad). */
  lift: number;
  pitch: number;
  roll: number;
}

export function createWalker(x: number, z: number, heading = 0): Walker {
  return { x, z, heading, yawRate: 0, speed: 0, accel: 0, path: null, s: 0, prevTarget: 0, targetSpeed: 0, phase: 0, steps: 0, moveWeight: 0, hopWeight: 0, lift: 0, pitch: 0, roll: 0 };
}

/**
 * Como o deslocamento é comandado:
 * - `track`: acompanha a fração da fase do motor (ida e volta das tarefas); `fraction` de 0 a 1 do caminho.
 * - `goto`: vai até o fim do caminho em ritmo próprio (`cruise` m/s em 1×) e para suavemente.
 * - `hold`: freia e fica.
 */
export type Drive = { readonly kind: 'track'; readonly fraction: number } | { readonly kind: 'goto'; readonly cruise: number } | { readonly kind: 'hold' };

export function setPath(w: Walker, path: PolyPath, startFraction = 0): void {
  w.path = path;
  w.s = 0;
  w.prevTarget = startFraction * path.length;
}

export function remaining(w: Walker): number {
  return w.path ? Math.max(0, w.path.length - w.s) : 0;
}

const probe = { x: 0, z: 0, heading: 0 };

function wrapAngle(a: number): number {
  return Math.atan2(Math.sin(a), Math.cos(a));
}

function smooth01(e0: number, e1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/** Passo máximo de integração: abaixo disso o resultado não depende do FPS. */
const MAX_SUBSTEP = 1 / 60;

/**
 * Avança o deslocamento `dt` segundos reais. `rate` = horas de jogo por segundo real (1 em 1×, 4 em 4×):
 * em avanço rápido tudo acontece `rate` vezes mais depressa (velocidade × rate, aceleração × rate²), como um time-lapse.
 * `face`: para onde olhar quando parado (posto de trabalho, rover); null mantém a direção.
 */
export function stepWalker(w: Walker, dt: number, drive: Drive, rate: number, face: number | null): void {
  if (dt <= 0) return;
  const r = Math.min(4, Math.max(0.25, rate));
  const steps = Math.max(1, Math.ceil(dt / MAX_SUBSTEP));
  const h = dt / steps;
  const length = w.path?.length ?? 0;
  let target = 0;
  if (drive.kind === 'track') {
    target = Math.min(1, Math.max(0, drive.fraction)) * length;
    const raw = (target - w.prevTarget) / dt;
    if (raw >= 0 && raw < 40) w.targetSpeed += (raw - w.targetSpeed) * Math.min(1, dt / 0.35);
    w.prevTarget = target;
  } else {
    w.targetSpeed += (0 - w.targetSpeed) * Math.min(1, dt / 0.35);
  }
  const accel = ACCEL * r * r;
  const decel = DECEL * r * r;
  const vMax = Math.max(LOPE_SPEED * 1.3 * r, w.targetSpeed * 1.4);
  for (let k = 0; k < steps; k++) {
    const left = Math.max(0, length - w.s);
    let want = 0;
    if (drive.kind === 'track') want = w.targetSpeed + 1.6 * r * (target - w.s);
    else if (drive.kind === 'goto') want = drive.cruise * r;
    want = Math.min(Math.max(0, want), vMax, Math.sqrt(2 * decel * left));
    const dv = Math.min(accel * h, Math.max(-decel * h, want - w.speed));
    w.speed = Math.max(0, w.speed + dv);
    w.accel += (dv / h - w.accel) * Math.min(1, h / 0.25);
    w.s = Math.min(length, w.s + w.speed * h);
    if (w.path) {
      sampleInto(w.path, w.s, probe);
      w.x = probe.x;
      w.z = probe.z;
    }
    // Giro: mola criticamente amortecida até a direção do caminho (andando) ou do alvo (parado).
    let want_h = w.heading;
    const moving = w.speed > 0.08 * r && left > 0.05;
    if (moving && w.path) {
      sampleInto(w.path, w.s + 0.35, probe);
      want_h = probe.heading;
    } else if (face !== null) want_h = face;
    const err = wrapAngle(want_h - w.heading);
    const wn = 7 * r;
    w.yawRate += (wn * wn * err - 2 * wn * w.yawRate) * h;
    const maxYaw = 3.2 * r;
    w.yawRate = Math.min(maxYaw, Math.max(-maxYaw, w.yawRate));
    w.heading = wrapAngle(w.heading + w.yawRate * h);
  }
  // Na Lua a inclinação de equilíbrio seria atan(a / g), grande; limitada para não virar caricatura.
  const vn = w.speed / r;
  const pitchWant = Math.min(0.2, Math.max(-0.14, 0.05 * Math.min(vn, 2.2) + 0.1 * (w.accel / (r * r)) / MOON_GRAVITY));
  const rollWant = Math.min(0.12, Math.max(-0.12, (-0.35 * w.speed * w.yawRate) / (r * r) / MOON_GRAVITY));
  const kk = Math.min(1, (dt * r) / 0.18);
  w.pitch += (pitchWant - w.pitch) * kk;
  w.roll += (rollWant - w.roll) * kk;
}

/** Duração (s, sem time-lapse) de cada fase de voo do passo saltado: mais longa quanto mais rápido (ilustrativa). */
export function flightTime(normSpeed: number): number {
  return 0.26 + 0.1 * Math.min(2.5, Math.max(0, normSpeed));
}

function sampleIndex(p: GaitProfile, clipPhase: number): number {
  const n = p.flightLen.length;
  return Math.min(n - 1, Math.floor(clipPhase * n));
}

export function clipPhase(p: GaitProfile, phase: number): number {
  return (((phase + p.plant) % 1) + 1) % 1;
}

/** Ritmo (fase por segundo) de um clipe: pé no chão casa com a velocidade; no voo, a duração balística lunar. */
function phaseRate(p: GaitProfile, phase: number, groundSpeed: number, tFlight: number): number {
  const cp = clipPhase(p, phase);
  const len = p.flightLen[sampleIndex(p, cp)];
  if (len > 0) return len / tFlight;
  return groundSpeed / (p.footSpeed * p.duration);
}

/**
 * Avança a passada e o voo. `walk` e `run` são os perfis dos clipes (o de corrida faz o passo saltado).
 * O pé apoiado acompanha o chão; no voo, o corpo sobe numa parábola de gravidade lunar (alguns centímetros).
 */
export function stepGait(w: Walker, dt: number, rate: number, walk: GaitProfile | null, run: GaitProfile | null): void {
  if (dt <= 0) return;
  const r = Math.min(4, Math.max(0.25, rate));
  const vn = w.speed / r;
  // Girar parado também mexe os pés (passinhos), sem deslizar o corpo.
  const shuffle = Math.min(0.45, (Math.abs(w.yawRate) / r) * 0.22);
  const k = Math.min(1, (dt * r) / 0.2);
  w.moveWeight += (smooth01(0.03, 0.3, vn + shuffle) - w.moveWeight) * k;
  const hopTarget = run ? LOPE_BLEND * smooth01(GAIT_SWITCH_SPEED * 0.85, GAIT_SWITCH_SPEED * 1.6, vn) : 0;
  w.hopWeight += (hopTarget - w.hopWeight) * k;
  const ground = Math.max(w.speed, shuffle * r);
  const tFlight = flightTime(vn) / r;
  const rw = walk ? phaseRate(walk, w.phase, ground, tFlight) : 0;
  const rr = run ? phaseRate(run, w.phase, ground, tFlight) : 0;
  const rateMix = walk && run ? rw * (1 - w.hopWeight) + rr * w.hopWeight : walk ? rw : rr;
  const advanced = w.phase + rateMix * dt;
  // Cada meio ciclo é um apoio (pé esquerdo em 0, direito em 0,5): conta só quando está de fato andando.
  if (w.moveWeight > 0.3) w.steps += Math.floor(advanced * 2) - Math.floor(w.phase * 2);
  w.phase = advanced % 1;
  // Voo: parábola h = g·t²/8 no ápice (t = duração do voo sem time-lapse); some quando a passada some.
  let lift = 0;
  if (run && w.hopWeight > 0) {
    const cp = clipPhase(run, w.phase);
    const i = sampleIndex(run, cp);
    const len = run.flightLen[i];
    if (len > 0) {
      const p = ((((cp - run.flightStart[i]) % 1) + 1) % 1) / len;
      const t = flightTime(vn);
      lift = 0.5 * MOON_GRAVITY * t * t * Math.min(1, Math.max(0, p)) * (1 - Math.min(1, Math.max(0, p)));
    }
  }
  w.lift = lift * w.hopWeight * w.moveWeight;
}
