// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import * as THREE from 'three';
import type { GameAction, GameState } from '../engine/game';
import { antenna, base, greenhouse, habitat, powerUnit, processor, storage } from '../render/base-layout';
import { cameraMode, followingShot, setDirectorEnabled } from '../render/director';
import type { SelectableId } from '../render/picking';
import { camera, controls, crewAnimationState, crewObject, robot, roverWorldState } from '../render/scene';
import { apparentSunDirection } from '../render/sky';
import { surfaceHeight } from '../render/terrain-height';
import { getVolume, isMuted, play, setLoop, setMuted, setVolume } from '../ui/audio';
import { ui } from '../ui/hud';

export interface DevGameAccess {
  getState(): GameState;
  setState(state: GameState): void;
  act(action: GameAction): string | null;
  radiation(): boolean;
}

/** Cotas em metros no referencial da cena. */
interface GroundPlacement {
  name: string;
  base: number;
  terrainMin: number;
  terrainMax: number;
  buried: number;
  gap: number;
}

function groundReport(): GroundPlacement[] {
  const placements: GroundPlacement[] = [];
  base.updateMatrixWorld(true);
  for (const group of base.children) {
    if (!(group instanceof THREE.Group) || !group.name) continue;
    const box = new THREE.Box3();
    group.traverse((node) => {
      if (node instanceof THREE.Mesh && node.visible && node.geometry && !node.userData.persistent) {
        node.geometry.computeBoundingBox();
        if (node.geometry.boundingBox) box.union(node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));
      }
    });
    if (box.isEmpty()) continue;
    let terrainMin = Infinity;
    let terrainMax = -Infinity;
    for (let i = 0; i <= 4; i++) {
      for (let j = 0; j <= 4; j++) {
        const height = surfaceHeight(box.min.x + ((box.max.x - box.min.x) * i) / 4, box.min.z + ((box.max.z - box.min.z) * j) / 4);
        terrainMin = Math.min(terrainMin, height);
        terrainMax = Math.max(terrainMax, height);
      }
    }
    const round = (value: number) => Math.round(value * 100) / 100;
    placements.push({ name: group.name, base: round(box.min.y), terrainMin: round(terrainMin), terrainMax: round(terrainMax), buried: round(Math.max(0, terrainMax - box.min.y)), gap: round(Math.max(0, box.min.y - terrainMin)) });
  }
  return placements;
}

function cameraState(): Record<string, unknown> {
  const offset = camera.position.clone().sub(controls.target);
  const distance = offset.length();
  return {
    pos: camera.position.toArray().map((value) => Math.round(value * 100) / 100),
    target: controls.target.toArray().map((value) => Math.round(value * 100) / 100),
    dist: Math.round(distance * 100) / 100,
    theta: Math.round(Math.atan2(offset.x, offset.z) * 1000) / 1000,
    polarDeg: Math.round((Math.acos(Math.min(1, Math.max(-1, offset.y / distance))) * 180) / Math.PI * 10) / 10,
    limits: [controls.minDistance, controls.maxDistance, Math.round((controls.minPolarAngle * 180) / Math.PI), Math.round((controls.maxPolarAngle * 180) / Math.PI)],
    mode: cameraMode(),
    following: followingShot(),
    viewOffset: camera.view?.enabled ? [camera.view.offsetX, camera.view.offsetY] : null,
  };
}

function screenOf(id: SelectableId): [number, number] | null {
  const fixed: Partial<Record<SelectableId, THREE.Object3D>> = { rover: robot, greenhouse, habitat, antenna, processor, storage, panels: powerUnit };
  const object = fixed[id] ?? crewObject(id === 'crew0' ? 0 : 1);
  if (!object) return null;
  const point = object.getWorldPosition(new THREE.Vector3());
  point.y += 0.8;
  point.project(camera);
  return [((point.x + 1) / 2) * window.innerWidth, ((1 - point.y) / 2) * window.innerHeight];
}

function createDevTools(access: DevGameAccess) {
  return {
    sunDirection: apparentSunDirection,
    crewState: crewAnimationState,
    roverState: roverWorldState,
    act: (action: GameAction) => access.act(action),
    hour: () => access.getState().clock.hour,
    state: () => access.getState(),
    groundReport,
    patch(partial: Record<string, unknown>): void {
      const state = access.getState();
      const next = { ...state } as Record<string, unknown>;
      for (const [key, value] of Object.entries(partial)) {
        const current = (state as unknown as Record<string, unknown>)[key];
        next[key] = value && typeof value === 'object' && !Array.isArray(value) && current && typeof current === 'object' ? { ...(current as object), ...(value as object) } : value;
      }
      access.setState(next as unknown as GameState);
    },
    cameraState,
    view(cx: number, cy: number, cz: number, tx: number, ty: number, tz: number): void {
      setDirectorEnabled(false);
      camera.position.set(cx, cy, cz);
      controls.target.set(tx, ty, tz);
      controls.update();
      ui.hud.hidden = true;
    },
    audio: { play, setLoop, setVolume, getVolume, setMuted, isMuted },
    radiation: () => access.radiation(),
    screenOf,
  };
}

declare global {
  interface Window {
    __earthset?: ReturnType<typeof createDevTools>;
  }
}

export function installDevTools(access: DevGameAccess): void {
  window.__earthset = createDevTools(access);
}
