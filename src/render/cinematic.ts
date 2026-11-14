// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Introdução animada (≈16 s) feita na própria cena: aproximação, pouso do módulo de descida, a base, o
// astronauta e a LUMA. O relógio da simulação fica parado; a partida começa no fim (ou ao pular).
// Sem atmosfera: o pouso levanta poeira em arcos balísticos, sem fumaça.
import * as THREE from 'three';
import { camera, crewObject, crewWave, emitDust } from './scene';
import { FOCUS, setEngineGlow, setLanderAltitude, lander } from './base-layout';

export interface CineHooks {
  caption(key: string | null, big?: boolean): void;
  luma(key: string | null): void;
  end(): void;
}

interface Key {
  readonly t: number;
  readonly pos: THREE.Vector3;
  readonly look: THREE.Vector3;
}

const V = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);

export const CINE_SECONDS = 16.5;
const TOUCHDOWN = 8.4;
const DESCENT_FROM = 4.2;
const DESCENT_HEIGHT = 34;

/** Trilha de câmera: posição e ponto de mira por tempo (s). Entre chaves, interpolação suave. */
function keys(): Key[] {
  const pad = FOCUS.pad;
  const hab = FOCUS.habitat;
  const crew = crewObject(0)?.position ?? V(5.6, 0, 1.4);
  return [
    { t: 0, pos: V(46, 34, 70), look: V(-10, 14, -120) },
    { t: 4.2, pos: V(26, 16, 26), look: V(pad.x, pad.y + 22, pad.z) },
    { t: 5.0, pos: V(pad.x + 20, pad.y + 6, pad.z + 15), look: V(pad.x, pad.y + 18, pad.z) },
    { t: 8.4, pos: V(pad.x + 15, pad.y + 4, pad.z + 14), look: V(pad.x, pad.y + 2.5, pad.z) },
    { t: 9.6, pos: V(hab.x + 18, hab.y + 6, hab.z - 14), look: V(hab.x, hab.y, hab.z) },
    { t: 10.2, pos: V(crew.x + 9, crew.y + 2.4, crew.z + 7), look: V(crew.x - 2.5, crew.y + 1.3, crew.z - 1.5) },
    { t: 14.0, pos: V(crew.x + 7.5, crew.y + 2.2, crew.z + 5.5), look: V(hab.x, hab.y + 0.5, hab.z) },
    { t: CINE_SECONDS, pos: V(12, 27, 37), look: V(3, 0, -5) },
  ];
}

/** Cortes secos para movimento reduzido: mesmos lugares, sem voo. */
function staticShots(): Key[] {
  const all = keys();
  return [all[0], all[3], all[6], all[7]].map((k, i) => ({ ...k, t: [0, 4.2, 9.6, 13.5][i] }));
}

let start = -1;
let path: Key[] = [];
let hooks: CineHooks | null = null;
let reducedMotion = false;
let lastCaption = '';
let lastLuma = '';
let dusted = false;
let waved = false;
/** Só para capturas de tela (servidor de desenvolvimento): congela a introdução neste segundo. */
let frozenAt: number | null = null;
export function freezeCinematic(seconds: number | null): void {
  frozenAt = seconds;
}

const ease = (k: number) => (k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2);

export function startCinematic(nowMs: number, h: CineHooks, reduced: boolean): void {
  start = nowMs;
  hooks = h;
  reducedMotion = reduced;
  path = reduced ? staticShots() : keys();
  lastCaption = '';
  lastLuma = '';
  dusted = false;
  waved = false;
  setLanderAltitude(reduced ? 0 : DESCENT_HEIGHT);
  setEngineGlow(reduced ? 0 : 1);
}

export function cinematicRunning(): boolean {
  return start >= 0;
}

function finish(): void {
  start = -1;
  setLanderAltitude(0);
  setEngineGlow(0);
  crewWave(0, false);
  hooks?.caption(null);
  hooks?.luma(null);
  const h = hooks;
  hooks = null;
  h?.end();
}

export function skipCinematic(): void {
  if (start >= 0) finish();
}

function captionAt(s: number): [string | null, boolean] {
  if (s > 0.6 && s < 4.2) return ['cine.1', false];
  if (s > 5.0 && s < 9.4) return ['cine.2', false];
  if (s > 11.8 && s < 15.2) return ['cine.3', true];
  return [null, false];
}

export function updateCinematic(nowMs: number): void {
  if (start < 0) return;
  const s = frozenAt ?? (nowMs - start) / 1000;
  const total = reducedMotion ? 15.5 : CINE_SECONDS;
  if (s >= total) {
    finish();
    return;
  }
  // Câmera.
  let i = 0;
  while (i < path.length - 2 && s >= path[i + 1].t) i++;
  const a = path[i];
  const b = path[Math.min(i + 1, path.length - 1)];
  const k = reducedMotion ? 0 : ease(Math.min(1, Math.max(0, (s - a.t) / Math.max(0.001, b.t - a.t))));
  camera.position.lerpVectors(a.pos, b.pos, k);
  const look = new THREE.Vector3().lerpVectors(a.look, b.look, k);
  // Durante a descida, a mira acompanha o módulo (sem perder o chão do quadro).
  if (!reducedMotion && s > DESCENT_FROM - 0.6 && s < TOUCHDOWN + 1.2) {
    const w = Math.min(1, (s - (DESCENT_FROM - 0.6)) / 0.8) * Math.min(1, (TOUCHDOWN + 1.2 - s) / 0.8);
    look.lerp(lander.position.clone().add(new THREE.Vector3(0, 1.5, 0)), w);
  }
  camera.lookAt(look);

  // Pouso: descida com desaceleração, motor aceso até tocar o solo; poeira balística no toque.
  if (!reducedMotion) {
    const d = Math.min(1, Math.max(0, (s - DESCENT_FROM) / (TOUCHDOWN - DESCENT_FROM)));
    const before = s < DESCENT_FROM ? 1 : 1 - (1 - Math.pow(1 - d, 2.2));
    setLanderAltitude(DESCENT_HEIGHT * before);
    setEngineGlow(s < TOUCHDOWN ? 0.7 + 0.3 * Math.sin(s * 40) : 0);
    if (s > TOUCHDOWN - 1.6 && s < TOUCHDOWN && Math.random() < 0.6) {
      emitDust(lander.position.x, lander.position.y - 0.2, lander.position.z, 8, 5, 1.6);
    }
    if (!dusted && s >= TOUCHDOWN) {
      dusted = true;
      emitDust(lander.position.x, lander.position.y, lander.position.z, 220, 7, 2.4);
    }
  }
  if (!waved && s >= 10.3) {
    waved = true;
    crewWave(0, true);
  }
  if (waved && s >= 13) crewWave(0, false);

  // Textos.
  const [cap, big] = captionAt(s);
  if ((cap ?? '') !== lastCaption) {
    lastCaption = cap ?? '';
    hooks?.caption(cap, big);
  }
  const luma = s > 10.4 && s < 14.6 ? 'cine.luma' : null;
  if ((luma ?? '') !== lastLuma) {
    lastLuma = luma ?? '';
    hooks?.luma(luma);
  }
}
