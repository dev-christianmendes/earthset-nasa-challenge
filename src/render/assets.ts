// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Gerenciador de ativos: carrega cada GLB uma vez (public/models, gerado por assets-src/blender)
// e anexa uma cópia ao grupo que recebe o modelo. Formas provisórias do código são escondidas.
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();
const cache = new Map<string, Promise<THREE.Object3D>>();

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

/**
 * Adiciona uma cópia do modelo ao grupo e esconde os objetos provisórios que ele substitui.
 * Devolve o nó do modelo, para o chamador ligar animações ou materiais por nome.
 */
export async function attachModel(group: THREE.Object3D, name: string): Promise<THREE.Object3D> {
  const source = await loadModel(name);
  const model = source.clone(true);
  model.traverse((node) => {
    node.castShadow = true;
    node.receiveShadow = true;
  });
  const provisional = [...group.children];
  group.add(model);
  for (const child of provisional) child.visible = false;
  return model;
}
