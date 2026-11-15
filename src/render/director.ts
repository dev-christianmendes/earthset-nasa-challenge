// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Direção de câmera: planos (visão da base, astronauta, rover, gelo, vitrine do menu), transições suaves,
// seguir um objeto em movimento e órbita livre com limites. Só apresentação.
import * as THREE from 'three';
import { camera, controls, crewObject, robot } from './scene';
import { FOCUS } from './base-layout';
import { OBSTACLES } from './crew-nav';
import { surfaceHeight } from './terrain-height';

// ---------- Obstrução e chão ----------
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

/** Menor distância livre entre o alvo e a câmera ao longo da direção atual (Infinity se nada tapa). */
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

/** Afasta a câmera de obstruções e do chão. Só quando segue um alvo (astronauta ou rover). */
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
  // Procura a menor elevação extra em que a câmera cabe inteira; se a direção do jogador cabe, nenhuma.
  let wantLift = MAX_LIFT;
  let wantDist = MIN_FOLLOW_DISTANCE;
  for (let a = 0; a <= MAX_LIFT + 1e-6; a += 0.115) {
    tryDir.copy(offset);
    if (a > 0 && axis.lengthSq() > 1e-8) tryDir.applyAxisAngle(axis, a);
    const free = freeDistance(controls.target, tryDir, preferredDistance);
    if (free - CAMERA_MARGIN >= Math.min(preferredDistance, MIN_FOLLOW_DISTANCE + 1)) {
      wantLift = a;
      wantDist = Math.min(preferredDistance, free - CAMERA_MARGIN);
      break;
    }
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

export type Shot = 'overview' | 'crew' | 'crew1' | 'rover' | 'ice' | 'energy' | 'antenna' | 'greenhouse' | 'habitat' | 'logistics' | 'showcase';

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

/** Movimento reduzido: troca de plano sem voo. */
export function setReducedMotion(on: boolean): void {
  reduced = on;
}

/** Liga ou desliga a direção (a introdução assume a câmera). */
export function setDirectorEnabled(on: boolean): void {
  enabled = on;
  controls.enabled = on;
  if (!on) tween = null;
}

/** Visão geral: do sul, um pouco a leste, alta o bastante para ver todas as áreas e o local do gelo. */
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
    default:
      return { pos: OVERVIEW_TARGET.clone().add(OVERVIEW_OFFSET), target: OVERVIEW_TARGET.clone(), follow: null };
  }
}

/** Vai para o plano: voo suave (ou corte, com movimento reduzido). */
export function goTo(name: Shot, nowMs: number, seconds = 1.4): void {
  controls.maxPolarAngle = THREE.MathUtils.degToRad(84);
  const s = shotFor(name);
  follow = s.follow;
  preferredDistance = s.pos.distanceTo(s.target);
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

let lastDirectorMs = 0;

export function updateDirector(nowMs: number): void {
  if (!enabled) return;
  const dt = lastDirectorMs ? Math.min(0.1, Math.max(0, (nowMs - lastDirectorMs) / 1000)) : 0;
  lastDirectorMs = nowMs;
  if (tween) {
    const k = Math.min(1, (nowMs - tween.start) / tween.dur);
    const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    camera.position.lerpVectors(tween.fromPos, tween.toPos, e);
    controls.target.lerpVectors(tween.fromTarget, tween.toTarget, e);
    if (k >= 1) tween = null;
  }
  if (follow) {
    // Segue o objeto: câmera e alvo andam junto com ele; o jogador ainda pode orbitar.
    const delta = follow.position.clone().sub(lastFollow);
    lastFollow.copy(follow.position);
    if (tween) {
      tween.toPos.add(delta);
      tween.toTarget.add(delta);
    } else {
      camera.position.add(delta);
      controls.target.add(delta);
    }
  }
  controls.update();
  if (follow && !tween) avoidOcclusion(dt);
}

/** Está acompanhando o astronauta ou o rover (o jogador escolheu seguir: ordens não trocam a câmera). */
export function isFollowing(): boolean {
  return follow !== null;
}

/** Para de seguir (por exemplo, ao abrir a visão geral). */
export function stopFollow(): void {
  follow = null;
}

/** Inspeção astronômica opcional pela Ciência. Não desloca a base nem os equipamentos. */
export function lookAtSky(az: number, el: number): void {
  tween = null;
  follow = null;
  controls.autoRotate = false;
  controls.maxPolarAngle = Math.PI - 0.01;
  const a = THREE.MathUtils.degToRad(az);
  const e = THREE.MathUtils.degToRad(el);
  controls.target.copy(camera.position).add(new THREE.Vector3(Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)).multiplyScalar(30));
  controls.update();
}
