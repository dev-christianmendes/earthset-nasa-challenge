// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Gerenciador de ativos: carrega cada GLB uma vez (public/models, gerado por assets-src/blender)
// e anexa uma cópia ao grupo que recebe o modelo. Formas provisórias do código são escondidas.
import * as THREE from 'three';
import { GLTFLoader, type GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Object3D>>();
const gltfCache = new Map<string, Promise<GLTF>>();

/** Carrega o GLTF completo (cena e animações), uma vez por nome. */
export function loadGltf(name: string): Promise<GLTF> {
  let pending = gltfCache.get(name);
  if (!pending) {
    const url = `${import.meta.env.BASE_URL}models/${name}.glb`;
    pending = loader.loadAsync(url);
    gltfCache.set(name, pending);
  }
  return pending;
}

/** Carrega um modelo pelo nome (sem extensão). Uma única requisição por nome. */
export function loadModel(name: string): Promise<THREE.Object3D> {
  let pending = cache.get(name);
  if (!pending) {
    const url = `${import.meta.env.BASE_URL}models/${name}.glb`;
    pending = loader.loadAsync(url).then((gltf) => gltf.scene);
    cache.set(name, pending);
  }
  return pending;
}

const TINY_SHADOW_SIZE = 0.3;
const tinyBox = new THREE.Box3();
const tinySize = new THREE.Vector3();

/** Peças menores que ~30 cm param de projetar sombra: o ganho é desenho, a perda visual é imperceptível. */
export function pruneTinyShadows(root: THREE.Object3D): void {
  root.updateMatrixWorld(true);
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh) || !node.castShadow) return;
    tinyBox.setFromObject(node).getSize(tinySize);
    if (Math.max(tinySize.x, tinySize.y, tinySize.z) < TINY_SHADOW_SIZE) node.castShadow = false;
  });
}

/**
 * Adiciona uma cópia do modelo ao grupo e esconde os objetos provisórios que ele substitui.
 * Filhos com `userData.persistent` (peças desenhadas por código, como as plantas) não são escondidos.
 * Devolve o nó do modelo, para o chamador ligar animações ou materiais por nome.
 */
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
