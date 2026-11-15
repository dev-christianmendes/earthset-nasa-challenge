// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Plantas da estufa (D-18): o estágio de crescimento vem do motor (src/engine/greenhouse.ts), aqui só se desenha.
// Muda pequena, planta desenvolvida e planta pronta (com frutos). Duas malhas instanciadas: custo de 2 draws.
// As posições vêm dos leitos do modelo (nós `bed_*` com `length` nos extras, D-25); sem eles (modelo antigo ou
// falha de carga), usa o layout anterior de três fileiras.
import * as THREE from 'three';
import { STAGE_DEVELOPED } from '../engine/greenhouse';
import { greenhouse, greenhouseModelHooks } from './base-layout';

type Slot = readonly [number, number, number];

/** Layout anterior (cúpula): três fileiras em x, a do meio com duas camadas. Blender (x, y, z) vira three (x, z, −y). */
function legacySlots(): Slot[] {
  const out: Slot[] = [];
  [-1.05, 0, 1.05].forEach((x, row) => {
    const length = row === 1 ? 2.6 : 2.1;
    [0.6, 1.15].forEach((z, tier) => {
      if (row !== 1 && tier === 1) return;
      for (let k = 0; k < Math.floor(length / 0.32); k++) {
        const y = 0.15 - length / 2 + 0.2 + k * 0.32;
        for (const dx of [-0.12, 0.12]) out.push([x + dx, z + 0.1, -y]);
      }
    });
  });
  return out;
}

/** Passo entre plantas ao longo do leito e afastamento lateral das duas linhas (m). */
const SPACING = 0.32;
const SIDE = 0.12;
const MAX_PLANTS = 200;

let slots: Slot[] = legacySlots();

const leafMat = new THREE.MeshStandardMaterial({ color: 0x7fd36b, roughness: 0.7, emissive: 0x0a2a08, emissiveIntensity: 0.4 });
const fruitMat = new THREE.MeshStandardMaterial({ color: 0xf2b134, roughness: 0.5, emissive: 0x6a3c00, emissiveIntensity: 0.6 });
const leaves = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.13, 1), leafMat, MAX_PLANTS);
const fruit = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), fruitMat, MAX_PLANTS);
leaves.name = 'crop-leaves';
fruit.name = 'crop-fruit';
leaves.castShadow = false;
fruit.castShadow = false;
leaves.frustumCulled = false;
fruit.frustumCulled = false;
leaves.userData.persistent = true;
fruit.userData.persistent = true;
greenhouse.add(leaves, fruit);

const m = new THREE.Matrix4();
const q = new THREE.Quaternion();
const pos = new THREE.Vector3();
const scale = new THREE.Vector3();
let lastBucket = -1;
let lastGrowth = 0;

/** Atualiza o desenho só quando o crescimento muda em passos de ~2%. */
export function updateCrop(growth: number): void {
  lastGrowth = growth;
  const bucket = Math.round(growth / 2);
  if (bucket === lastBucket) return;
  lastBucket = bucket;
  const k = Math.min(1, Math.max(0, growth / 100));
  const size = 0.5 + 0.65 * k;
  leafMat.color.setHex(growth >= 100 ? 0x5fbf52 : growth >= STAGE_DEVELOPED ? 0x6cc95c : 0xa6e08a);
  leaves.count = fruit.count = slots.length;
  slots.forEach(([x, y, z], i) => {
    const variation = 0.9 + 0.2 * (((i * 7) % 5) / 4);
    pos.set(x, y - 0.1 + 0.1 * size, z);
    scale.set(size * variation, size * variation * 0.9, size * variation);
    leaves.setMatrixAt(i, m.compose(pos, q, scale));
    pos.set(x + 0.07, y + 0.1 * size + 0.07, z + 0.05);
    scale.setScalar(growth >= 100 ? 1 : 0.0001);
    fruit.setMatrixAt(i, m.compose(pos, q, scale));
  });
  leaves.instanceMatrix.needsUpdate = true;
  fruit.instanceMatrix.needsUpdate = true;
}

/**
 * Liga as plantas aos leitos do modelo: cada nó `bed_*` está no centro da superfície do solo, com o eixo Z local ao
 * longo do leito e `length` nos extras. Duas linhas de plantas por leito, a cada 0,32 m.
 */
export function bindCropBeds(model: THREE.Object3D): void {
  greenhouse.updateMatrixWorld(true);
  model.updateMatrixWorld(true);
  const toGroup = new THREE.Matrix4().copy(greenhouse.matrixWorld).invert();
  const out: Slot[] = [];
  model.traverse((node) => {
    if (!/^bed_\d+$/.test(node.name)) return;
    const length = Number(node.userData.length);
    if (!Number.isFinite(length) || length <= 0) return;
    const local = new THREE.Matrix4().multiplyMatrices(toGroup, node.matrixWorld);
    const origin = new THREE.Vector3().setFromMatrixPosition(local);
    const along = new THREE.Vector3(0, 0, 1).transformDirection(local);
    const side = new THREE.Vector3(1, 0, 0).transformDirection(local);
    const count = Math.max(1, Math.floor(length / SPACING));
    for (let k = 0; k < count; k++) {
      const offset = (k - (count - 1) / 2) * SPACING;
      for (const s of [-SIDE, SIDE]) {
        if (out.length >= MAX_PLANTS) return;
        out.push([origin.x + along.x * offset + side.x * s, origin.y + 0.12, origin.z + along.z * offset + side.z * s]);
      }
    }
  });
  if (out.length === 0) return;
  slots = out;
  lastBucket = -1;
  updateCrop(lastGrowth);
}

greenhouseModelHooks.push(bindCropBeds);
updateCrop(0);
