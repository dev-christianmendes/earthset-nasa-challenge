// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
interface ModelResource {
  gltf: Promise<GLTF>;
  scene?: Promise<THREE.Object3D>;
}
const resources = new Map<string, ModelResource>();

function modelResource(name: string): ModelResource {
  let resource = resources.get(name);
  if (!resource) {
    const url = `${import.meta.env.BASE_URL}models/${name}.glb`;
    resource = { gltf: loader.loadAsync(url) };
    resources.set(name, resource);
  }
  return resource;
}

export function loadGltf(name: string): Promise<GLTF> {
  return modelResource(name).gltf;
}

export function loadModel(name: string): Promise<THREE.Object3D> {
  const resource = modelResource(name);
  return resource.scene ??= resource.gltf.then((gltf) => gltf.scene);
}

const TINY_SHADOW_SIZE = 0.3;
const tinyBox = new THREE.Box3();
const tinySize = new THREE.Vector3();

/** Limiar de detalhes para sombras, em metros. */
export function pruneTinyShadows(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || !node.castShadow) return;
    tinyBox.setFromObject(node).getSize(tinySize);
    if (Math.max(tinySize.x, tinySize.y, tinySize.z) < TINY_SHADOW_SIZE) node.castShadow = false;
  });
}

/** Filhos com userData.persistent sobrevivem à substituição do modelo provisório. */
export async function attachModel(group: THREE.Object3D, name: string): Promise<THREE.Object3D> {
  const source = await loadModel(name);
  const model = source.clone(true);
  model.traverse((node) => {
    node.castShadow = true;
    node.receiveShadow = true;
  });
  pruneTinyShadows(model);
  const provisional = [...group.children];
  group.add(model);
  for (const child of provisional) if (!child.userData.persistent) child.visible = false;
  return model;
}
