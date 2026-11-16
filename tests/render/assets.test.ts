// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Group } from 'three';

const loadAsync = vi.hoisted(() => vi.fn());
vi.mock('three/examples/jsm/loaders/GLTFLoader.js', () => ({
  GLTFLoader: class {
    loadAsync = loadAsync;
  },
}));

beforeEach(() => {
  vi.resetModules();
  loadAsync.mockReset();
});

describe('recursos GLB compartilhados', () => {
  it('compartilha uma carga entre cena, animações e chamadas simultâneas', async () => {
    const model = { scene: new Group(), animations: [] };
    loadAsync.mockResolvedValue(model);
    const { loadGltf, loadModel } = await import('../../src/render/assets');
    const gltf = loadGltf('astronaut');
    const scene = loadModel('astronaut');
    expect(loadGltf('astronaut')).toBe(gltf);
    expect(loadModel('astronaut')).toBe(scene);
    expect(await gltf).toBe(model);
    expect(await scene).toBe(model.scene);
    expect(loadAsync).toHaveBeenCalledTimes(1);
  });

  it('mantém recursos de modelos diferentes separados', async () => {
    loadAsync.mockImplementation(async (url: string) => {
      const scene = new Group();
      scene.name = url;
      return { scene, animations: [] };
    });
    const { loadModel } = await import('../../src/render/assets');
    const [rover, habitat] = await Promise.all([loadModel('rover'), loadModel('habitat')]);
    expect(rover).not.toBe(habitat);
    expect(rover.name).toContain('rover.glb');
    expect(habitat.name).toContain('habitat.glb');
    expect(loadAsync).toHaveBeenCalledTimes(2);
  });

  it('propaga falhas sem disparar uma segunda carga ou criar promessa de cena sem consumidor', async () => {
    const failure = new Error('GLB indisponível');
    loadAsync.mockRejectedValue(failure);
    const { loadGltf, loadModel } = await import('../../src/render/assets');
    await expect(loadGltf('missing')).rejects.toBe(failure);
    await expect(loadModel('missing')).rejects.toBe(failure);
    expect(loadAsync).toHaveBeenCalledTimes(1);
  });
});
