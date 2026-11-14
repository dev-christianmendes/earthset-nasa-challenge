// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Plantas da estufa (D-18): o estágio de crescimento vem do motor (src/engine/greenhouse.ts), aqui só se desenha.
// Muda pequena, planta desenvolvida e planta pronta (com frutos). Duas malhas instanciadas: custo de 2 draws.
import * as THREE from 'three';
import { STAGE_DEVELOPED } from '../engine/greenhouse';
import { greenhouse } from './base-layout';

/**
 * Posições locais das plantas: as bancadas do modelo (assets-src/blender/build_v4.py, build_greenhouse).
 * Três fileiras em x; a do meio tem duas camadas. Blender (x, y, z) vira three (x, z, −y).
 */
const SLOTS: ReadonlyArray<readonly [number, number, number]> = (() => {
  const out: Array<[number, number, number]> = [];
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
})();

const leafMat = new THREE.MeshStandardMaterial({ color: 0x7fd36b, roughness: 0.7, emissive: 0x0a2a08, emissiveIntensity: 0.4 });
const fruitMat = new THREE.MeshStandardMaterial({ color: 0xf2b134, roughness: 0.5, emissive: 0x6a3c00, emissiveIntensity: 0.6 });
const leaves = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.13, 1), leafMat, SLOTS.length);
const fruit = new THREE.InstancedMesh(new THREE.SphereGeometry(0.045, 8, 6), fruitMat, SLOTS.length);
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

/** Atualiza o desenho só quando o crescimento muda em passos de ~2%. */
export function updateCrop(growth: number): void {
  const bucket = Math.round(growth / 2);
  if (bucket === lastBucket) return;
  lastBucket = bucket;
  const k = Math.min(1, Math.max(0, growth / 100));
  const size = 0.5 + 0.65 * k;
  leafMat.color.setHex(growth >= 100 ? 0x5fbf52 : growth >= STAGE_DEVELOPED ? 0x6cc95c : 0xa6e08a);
  SLOTS.forEach(([x, y, z], i) => {
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

updateCrop(0);
