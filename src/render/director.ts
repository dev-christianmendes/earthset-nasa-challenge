// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Direção de câmera: planos (visão da base, astronauta, rover, gelo, vitrine do menu), transições suaves,
// seguir um objeto em movimento e órbita livre com limites. Só apresentação.
import * as THREE from 'three';
import { camera, controls, crewObject, robot } from './scene';
import { FOCUS } from './base-layout';

export type Shot = 'overview' | 'crew' | 'rover' | 'ice' | 'energy' | 'antenna' | 'showcase';

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
  const s = shotFor(name);
  follow = s.follow;
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

export function updateDirector(nowMs: number): void {
  if (!enabled) return;
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
}

/** Para de seguir (por exemplo, ao abrir a visão geral). */
export function stopFollow(): void {
  follow = null;
}
