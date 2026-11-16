// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import * as THREE from 'three';
import { antenna, greenhouse, habitat, panelUnits, powerUnit, processor, storage } from './base-layout';
import { camera, crewObject, renderer, robot, scene } from './scene';
import { surfaceHeight } from './terrain-height';

export type SelectableId = 'habitat' | 'greenhouse' | 'rover' | 'crew0' | 'crew1' | 'panels' | 'antenna' | 'processor' | 'storage';

function roots(): Array<[SelectableId, THREE.Object3D | null]> {
  return [
    ['habitat', habitat],
    ['greenhouse', greenhouse],
    ['rover', robot],
    ['crew0', crewObject(0)],
    ['crew1', crewObject(1)],
    ['antenna', antenna],
    ['processor', processor],
    ['storage', storage],
    ['panels', powerUnit],
    ...panelUnits.map((u): [SelectableId, THREE.Object3D] => ['panels', u]),
  ];
}

const raycaster = new THREE.Raycaster();
const ndc = new THREE.Vector2();
const probe = new THREE.Vector3();

function visibleChain(object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) if (!o.visible) return false;
  return true;
}

export function pickAt(clientX: number, clientY: number): SelectableId | null {
  const rect = renderer.domElement.getBoundingClientRect();
  ndc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const list = roots().filter((r): r is [SelectableId, THREE.Object3D] => r[1] !== null && visibleChain(r[1]));
  const map = new Map<THREE.Object3D, SelectableId>(list.map(([id, obj]) => [obj, id]));
  const hits = raycaster.intersectObjects(
    list.map(([, obj]) => obj),
    true,
  );
  for (const hit of hits) {
    if (!visibleChain(hit.object)) continue;
    for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) {
      const id = map.get(o);
      if (id) return id;
    }
  }
  // Astronautas são pequenos: aceita toque perto deles na tela (36 px).
  let best: { id: SelectableId; d: number } | null = null;
  for (const id of ['crew0', 'crew1'] as const) {
    const node = list.find(([rid]) => rid === id)?.[1];
    if (!node) continue;
    node.getWorldPosition(probe).y += 1;
    probe.project(camera);
    const dx = ((probe.x + 1) / 2) * rect.width + rect.left - clientX;
    const dy = ((1 - probe.y) / 2) * rect.height + rect.top - clientY;
    const d = Math.hypot(dx, dy);
    if (probe.z < 1 && d < 36 && (!best || d < best.d)) best = { id, d };
  }
  return best ? best.id : null;
}

const ringMat = new THREE.MeshBasicMaterial({ color: 0x7fe0c8, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
const ring = new THREE.Mesh(new THREE.RingGeometry(0.88, 1, 48), ringMat);
ring.rotation.x = -Math.PI / 2;
ring.visible = false;
ring.renderOrder = 5;
scene.add(ring);

let selectedRoots: THREE.Object3D[] = [];
let ringRadius = 1;
const box = new THREE.Box3();
const size = new THREE.Vector3();
const center = new THREE.Vector3();

export function setHighlight(id: SelectableId | null): void {
  selectedRoots = [];
  ring.visible = false;
  if (!id) return;
  selectedRoots = roots()
    .filter((r): r is [SelectableId, THREE.Object3D] => r[0] === id && r[1] !== null && visibleChain(r[1]))
    .map((r) => r[1]);
  if (selectedRoots.length === 0) return;
  box.makeEmpty();
  for (const obj of selectedRoots) box.expandByObject(obj);
  box.getSize(size);
  ringRadius = Math.min(14, Math.max(0.9, Math.hypot(size.x, size.z) / 2 + 0.35));
  ring.scale.setScalar(ringRadius);
  ring.visible = true;
}

export function updateHighlight(t: number): void {
  if (!ring.visible || selectedRoots.length === 0) return;
  const obj = selectedRoots[0];
  if (selectedRoots.length === 1 || obj === robot) {
    obj.getWorldPosition(center);
  } else {
    box.makeEmpty();
    for (const o of selectedRoots) box.expandByObject(o);
    box.getCenter(center);
  }
  ring.position.set(center.x, surfaceHeight(center.x, center.z) + 0.1, center.z);
  ringMat.opacity = 0.32 + 0.18 * Math.sin(t * 3);
}
