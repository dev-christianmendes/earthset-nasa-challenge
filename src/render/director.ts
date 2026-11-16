// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import * as THREE from 'three';
import { camera, controls, crewObject, robot } from './scene';
import { FOCUS } from './base-layout';
import { OBSTACLES } from './crew-nav';
import { surfaceHeight } from './terrain-height';
import { earthDirection } from './sky';
import { CAMERA_KEYS, FOLLOW_LOST_SECONDS, KEY_SPEED, PLAY_AREA, SHOT_LIMITS, clampToArea, keyIntent, type CamMode } from './camera-rules';

// A câmera que segue não pode entrar nas estruturas nem no relevo. Volumes = pegadas da navegação (crew-nav.ts)
// com a altura de cada estrutura medida nos modelos v4. Peças baixas ou finas (painéis, plataforma, torres, garagem) ficam de fora.
const OCCLUDER_HEIGHT: Record<string, number> = { habitat: 5.4, airlock: 3.6, greenhouse: 2.6, antenna: 3.4, power: 2.1, processor: 2.2, tanks: 2.8, storage: 1.6 };
const occluders: THREE.Box3[] = OBSTACLES.filter((o) => OCCLUDER_HEIGHT[o.name] !== undefined).map((o) => {
  const [minX, maxX, minZ, maxZ] = o.kind === 'rect' ? [o.minX, o.maxX, o.minZ, o.maxZ] : [o.x - o.r, o.x + o.r, o.z - o.r, o.z + o.r];
  const ground = surfaceHeight((minX + maxX) / 2, (minZ + maxZ) / 2);
  return new THREE.Box3(new THREE.Vector3(minX, ground - 2, minZ), new THREE.Vector3(maxX, ground + OCCLUDER_HEIGHT[o.name], maxZ));
});
const ray = new THREE.Ray();
const hit = new THREE.Vector3();
const offset = new THREE.Vector3();
/** Distância escolhida pelo jogador (zoom); a obstrução só aproxima a câmera temporariamente. */
let preferredDistance = -1;
/** Distância aplicada (suavizada), para não pular quando um obstáculo entra ou sai da frente. */
let appliedDistance = -1;
const CAMERA_MARGIN = 0.5;
const MIN_FOLLOW_DISTANCE = 2.2;
/** Espaço livre (m) que o desvio de obstrução procura antes de aceitar uma elevação. */
const CLEAR_TARGET = 14;

function freeDistance(target: THREE.Vector3, dir: THREE.Vector3, max: number): number {
  ray.set(target, dir);
  let best = Infinity;
  for (const box of occluders) {
    if (box.containsPoint(target)) continue;
    if (ray.intersectBox(box, hit)) {
      const d = hit.distanceTo(target);
      if (d < max && d < best) best = d;
    }
  }
  return best;
}

const UP = new THREE.Vector3(0, 1, 0);
const axis = new THREE.Vector3();
const tryDir = new THREE.Vector3();
/** Elevação extra (rad) aplicada para olhar por cima de uma estrutura rente ao alvo; suavizada. */
let liftAngle = 0;
const MAX_LIFT = 1.15;

function avoidOcclusion(dt: number): void {
  offset.copy(camera.position).sub(controls.target);
  const current = offset.length();
  if (current < 1e-3) return;
  if (preferredDistance < 0) preferredDistance = current;
  if (appliedDistance < 0) appliedDistance = current;
  offset.divideScalar(current);
  // A direção do jogador é a atual sem a elevação extra que nós mesmos aplicamos no quadro anterior.
  axis.crossVectors(offset, UP);
  if (axis.lengthSq() > 1e-8) offset.applyAxisAngle(axis.normalize(), -liftAngle);
  let wantLift = MAX_LIFT;
  let wantDist = MIN_FOLLOW_DISTANCE;
  // Exigir folga até CLEAR_TARGET evita que o mínimo de 3 m prenda o zoom junto às estruturas.
  const need = Math.min(preferredDistance, CLEAR_TARGET);
  let bestFree = -1;
  let bestLift = 0;
  let found = false;
  for (let a = 0; a <= MAX_LIFT + 1e-6; a += 0.115) {
    tryDir.copy(offset);
    if (a > 0 && axis.lengthSq() > 1e-8) tryDir.applyAxisAngle(axis, a);
    const free = freeDistance(controls.target, tryDir, preferredDistance);
    if (free > bestFree) {
      bestFree = free;
      bestLift = a;
    }
    if (free - CAMERA_MARGIN >= need) {
      wantLift = a;
      wantDist = Math.min(preferredDistance, free - CAMERA_MARGIN);
      found = true;
      break;
    }
  }
  if (!found) {
    wantLift = bestLift;
    wantDist = Math.max(MIN_FOLLOW_DISTANCE, Math.min(preferredDistance, bestFree - CAMERA_MARGIN));
  }
  // Entra rápido (nunca mostra o interior de uma parede) e sai devagar.
  const kIn = Math.min(1, dt / 0.08);
  const kOut = Math.min(1, dt / 0.7);
  liftAngle += (wantLift - liftAngle) * (wantLift > liftAngle ? kIn : kOut);
  appliedDistance += (wantDist - appliedDistance) * (wantDist < appliedDistance ? kIn : kOut);
  if (axis.lengthSq() > 1e-8) offset.applyAxisAngle(axis, liftAngle);
  // Mesmo suavizada, a distância nunca passa do espaço livre na direção aplicada.
  const freeNow = freeDistance(controls.target, offset, appliedDistance + CAMERA_MARGIN);
  const dist = Math.max(0.8, Math.min(appliedDistance, freeNow - CAMERA_MARGIN));
  camera.position.copy(controls.target).addScaledVector(offset, dist);
  const floor = surfaceHeight(camera.position.x, camera.position.z) + 0.6;
  if (camera.position.y < floor) camera.position.y = floor;
}

export type Shot = 'overview' | 'crew' | 'crew1' | 'rover' | 'ice' | 'energy' | 'antenna' | 'greenhouse' | 'habitat' | 'logistics' | 'showcase' | 'earth';

interface Tween {
  fromPos: THREE.Vector3;
  fromTarget: THREE.Vector3;
  toPos: THREE.Vector3;
  toTarget: THREE.Vector3;
  start: number;
  dur: number;
}

let tween: Tween | null = null;
let follow: THREE.Object3D | null = null;
const lastFollow = new THREE.Vector3();
let reduced = false;
let enabled = true;
let currentShot: Shot | 'free' = 'overview';

export function setReducedMotion(on: boolean): void {
  reduced = on;
}

export function setDirectorEnabled(on: boolean): void {
  enabled = on;
  controls.enabled = on;
  if (!on) {
    tween = null;
    inset.x = inset.y = insetGoal.x = insetGoal.y = 0;
    if (camera.view?.enabled) camera.clearViewOffset();
    lastInsetKey = '';
  }
}

const OVERVIEW_TARGET = new THREE.Vector3(3, 0, -5);
const OVERVIEW_OFFSET = new THREE.Vector3(9, 27, 42);

function shotFor(name: Shot): { pos: THREE.Vector3; target: THREE.Vector3; follow: THREE.Object3D | null } {
  switch (name) {
    case 'crew': {
      const obj = crewObject(0);
      const target = obj ? obj.position.clone().add(new THREE.Vector3(0, 1.1, 0)) : FOCUS.habitat.clone();
      return { pos: target.clone().add(new THREE.Vector3(3.6, 1.6, 4.4)), target, follow: obj };
    }
    case 'crew1': {
      const obj = crewObject(1);
      const target = obj ? obj.position.clone().add(new THREE.Vector3(0, 1.1, 0)) : FOCUS.habitat.clone();
      return { pos: target.clone().add(new THREE.Vector3(3.6, 1.6, 4.4)), target, follow: obj };
    }
    case 'greenhouse':
      return { pos: FOCUS.greenhouse.clone().add(new THREE.Vector3(9, 6, 10)), target: FOCUS.greenhouse.clone(), follow: null };
    case 'habitat':
      return { pos: FOCUS.habitat.clone().add(new THREE.Vector3(13, 7, 15)), target: FOCUS.habitat.clone(), follow: null };
    case 'logistics':
      return { pos: FOCUS.logistics.clone().add(new THREE.Vector3(9, 6, 11)), target: FOCUS.logistics.clone(), follow: null };
    case 'rover': {
      const target = robot.position.clone().add(new THREE.Vector3(0, 1, 0));
      return { pos: target.clone().add(new THREE.Vector3(7, 4.5, 8)), target, follow: robot };
    }
    case 'ice':
      return { pos: FOCUS.ice.clone().add(new THREE.Vector3(11, 8, 12)), target: FOCUS.ice.clone(), follow: null };
    case 'energy':
      return { pos: FOCUS.energy.clone().add(new THREE.Vector3(10, 9, 16)), target: FOCUS.energy.clone(), follow: null };
    case 'antenna':
      return { pos: FOCUS.antenna.clone().add(new THREE.Vector3(8, 5, 9)), target: FOCUS.antenna.clone(), follow: null };
    case 'showcase':
      return { pos: new THREE.Vector3(24, 5.5, 22), target: new THREE.Vector3(-2, 3.2, -6), follow: null };
    case 'earth': {
      // Olha do alto da base para a Terra, que no polo fica rente ao horizonte (ver earth-status.ts).
      const pos = FOCUS.habitat.clone().add(new THREE.Vector3(0, 14, 0));
      const dir = new THREE.Vector3().fromArray(earthDirection());
      return { pos, target: pos.clone().add(dir.multiplyScalar(20)), follow: null };
    }
    default:
      return { pos: OVERVIEW_TARGET.clone().add(OVERVIEW_OFFSET), target: OVERVIEW_TARGET.clone(), follow: null };
  }
}

function applyLimits(name: Shot | 'free'): void {
  const l = SHOT_LIMITS[name];
  controls.minDistance = l.min;
  controls.maxDistance = l.max;
  controls.minPolarAngle = THREE.MathUtils.degToRad(l.polarMin);
  controls.maxPolarAngle = THREE.MathUtils.degToRad(l.polarMax);
}

export function goTo(name: Shot, nowMs: number, seconds = 1.4): void {
  applyLimits(name);
  currentShot = name;
  lostFor = 0;
  const s = shotFor(name);
  follow = s.follow;
  followShot = s.follow ? name : null;
  preferredDistance = THREE.MathUtils.clamp(s.pos.distanceTo(s.target), SHOT_LIMITS[name].min, SHOT_LIMITS[name].max);
  appliedDistance = -1;
  liftAngle = 0;
  if (follow) lastFollow.copy(follow.position);
  controls.autoRotate = name === 'showcase' && !reduced;
  controls.autoRotateSpeed = 0.35;
  if (reduced || seconds <= 0) {
    camera.position.copy(s.pos);
    controls.target.copy(s.target);
    tween = null;
    controls.update();
    return;
  }
  tween = { fromPos: camera.position.clone(), fromTarget: controls.target.clone(), toPos: s.pos, toTarget: s.target, start: nowMs, dur: seconds * 1000 };
}

export function goFree(): void {
  tween = null;
  follow = null;
  followShot = null;
  lostFor = 0;
  currentShot = 'free';
  controls.autoRotate = false;
  applyLimits('free');
}

export function toggleFree(nowMs: number): void {
  if (currentShot === 'free') goTo('overview', nowMs, 1.0);
  else goFree();
}

export function cameraMode(): CamMode {
  if (currentShot === 'free') return 'free';
  if (follow) return 'follow';
  return currentShot === 'overview' || currentShot === 'showcase' ? 'overview' : 'focus';
}

export function currentCameraShot(): Shot | 'free' {
  return currentShot;
}

/** O jogador arrastou a câmera: o voo em andamento para (seguir continua). */
controls.addEventListener('start', () => {
  tween = null;
  controls.autoRotate = false;
});
/** Fim de um gesto do jogador (arrastar, roda, pinça): a distância escolhida passa a ser a preferida. */
controls.addEventListener('end', () => {
  preferredDistance = Math.max(preferredDistance, camera.position.distanceTo(controls.target));
  if (liftAngle < 0.05) preferredDistance = camera.position.distanceTo(controls.target);
  appliedDistance = camera.position.distanceTo(controls.target);
});

const heldKeys = new Set<string>();
let heldFast = false;

export function setCameraKey(key: string, down: boolean, shift = false): void {
  if (!CAMERA_KEYS.has(key)) return;
  if (down) heldKeys.add(key);
  else heldKeys.delete(key);
  heldFast = shift;
}

export function clearCameraKeys(): void {
  heldKeys.clear();
}

const sph = new THREE.Spherical();

function applyKeys(dt: number): void {
  const intent = keyIntent(heldKeys);
  if (intent.yaw === 0 && intent.pitch === 0 && intent.zoom === 0) return;
  tween = null;
  controls.autoRotate = false;
  const fast = heldFast ? KEY_SPEED.fastFactor : 1;
  offset.copy(camera.position).sub(controls.target);
  sph.setFromVector3(offset);
  sph.theta += intent.yaw * KEY_SPEED.yaw * fast * dt;
  sph.phi = THREE.MathUtils.clamp(sph.phi - intent.pitch * KEY_SPEED.pitch * fast * dt, controls.minPolarAngle, controls.maxPolarAngle);
  sph.radius = THREE.MathUtils.clamp(sph.radius * Math.exp(-intent.zoom * KEY_SPEED.zoom * fast * dt), controls.minDistance, controls.maxDistance);
  offset.setFromSpherical(sph);
  camera.position.copy(controls.target).add(offset);
  if (intent.zoom !== 0) {
    preferredDistance = sph.radius;
    appliedDistance = sph.radius;
  }
}

const inset = { x: 0, y: 0 };
const insetGoal = { x: 0, y: 0 };
let lastInsetKey = '';

/** Deslocamento desejado da vista, em px (`insetFor` em camera-rules.ts). Suavizado ao longo de ~0,3 s. */
export function setViewInset(x: number, y: number): void {
  insetGoal.x = x;
  insetGoal.y = y;
}

function applyInset(dt: number): void {
  const k = reduced ? 1 : 1 - Math.exp(-dt * 9);
  inset.x += (insetGoal.x - inset.x) * k;
  inset.y += (insetGoal.y - inset.y) * k;
  const w = window.innerWidth;
  const h = window.innerHeight;
  const ix = Math.abs(inset.x) < 0.5 ? 0 : Math.round(inset.x);
  const iy = Math.abs(inset.y) < 0.5 ? 0 : Math.round(inset.y);
  const key = `${w}x${h}/${ix}/${iy}`;
  if (key === lastInsetKey) return;
  lastInsetKey = key;
  if (ix === 0 && iy === 0) {
    if (camera.view?.enabled) camera.clearViewOffset();
  } else camera.setViewOffset(w, h, ix, iy, w, h);
}

let lostFor = 0;
let notice: ((lost: Shot) => void) | null = null;

export function setCameraNotice(fn: ((lost: Shot) => void) | null): void {
  notice = fn;
}

function recoverFraming(nowMs: number): void {
  const p = camera.position;
  const t = controls.target;
  if (![p.x, p.y, p.z, t.x, t.y, t.z].every(Number.isFinite)) {
    goTo('overview', nowMs, 0);
    return;
  }
  const c = clampToArea(t.x, t.z, PLAY_AREA.cx, PLAY_AREA.cz, PLAY_AREA.radius);
  if (c.x !== t.x || c.z !== t.z) {
    // Move o alvo e a câmera juntos para o enquadramento não girar de repente.
    p.x += c.x - t.x;
    p.z += c.z - t.z;
    t.x = c.x;
    t.z = c.z;
  }
  const floor = surfaceHeight(p.x, p.z) + 0.5;
  if (p.y < floor) p.y = floor;
}

export function updateDirector(nowMs: number): void {
  if (!enabled) return;
  const dt = lastDirectorMs ? Math.min(0.1, Math.max(0, (nowMs - lastDirectorMs) / 1000)) : 0;
  lastDirectorMs = nowMs;
  applyKeys(dt);
  if (tween) {
    const k = Math.min(1, (nowMs - tween.start) / tween.dur);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
    controls.target.lerpVectors(tween.fromTarget, tween.toTarget, e);
    if (k >= 1) tween = null;
  }
  if (follow) {
    const delta = follow.position.clone().sub(lastFollow);
    lastFollow.copy(follow.position);
    if (tween) {
      tween.toPos.add(delta);
      tween.toTarget.add(delta);
    } else {
      camera.position.add(delta);
      controls.target.add(delta);
    }
    lostFor = !follow.visible ? lostFor + dt : 0;
    if (lostFor > FOLLOW_LOST_SECONDS) {
      const lost = followShot;
      goTo('overview', nowMs, 1.0);
      if (lost && notice) notice(lost);
    }
  }
  controls.update();
  if (follow && !tween) avoidOcclusion(dt);
  recoverFraming(nowMs);
  applyInset(dt);
}

let lastDirectorMs = 0;

export function isFollowing(): boolean {
  return follow !== null;
}

let followShot: Shot | null = null;
export function followingShot(): Shot | null {
  return follow ? followShot : null;
}

export function stopFollow(): void {
  follow = null;
}

export function lookAtSky(az: number, el: number): void {
  tween = null;
  follow = null;
  followShot = null;
  currentShot = 'free';
  controls.autoRotate = false;
  controls.maxPolarAngle = Math.PI - 0.01;
  const a = THREE.MathUtils.degToRad(az);
  const e = THREE.MathUtils.degToRad(el);
  controls.target.copy(camera.position).add(new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).multiplyScalar(30));
  controls.update();
}
