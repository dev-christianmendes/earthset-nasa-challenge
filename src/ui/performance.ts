// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import type { WebGLRenderer } from 'three';

export function mountPerformanceMonitor(renderer: Pick<WebGLRenderer, 'info'>): (now: number) => void {
  if (!new URLSearchParams(window.location.search).has('perf')) return () => {};
  const overlay = document.createElement('div');
  overlay.id = 'perf';
  document.body.appendChild(overlay);
  let frames = 0;
  let since = 0;
  let minDraws = Infinity;
  let maxDraws = 0;

  return (now: number): void => {
    frames++;
    minDraws = Math.min(minDraws, renderer.info.render.calls);
    maxDraws = Math.max(maxDraws, renderer.info.render.calls);
    if (since === 0) since = now;
    if (now - since < 1000) return;
    const memory = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    overlay.textContent = `${Math.round((frames * 1000) / (now - since))} fps · ${minDraws}-${maxDraws} draws · ${renderer.info.render.triangles} tris · geo ${renderer.info.memory.geometries} tex ${renderer.info.memory.textures} prog ${renderer.info.programs?.length ?? 0}${memory ? ` · ${Math.round(memory.usedJSHeapSize / 1048576)} MB` : ''}`;
    frames = 0;
    minDraws = Infinity;
    maxDraws = 0;
    since = now;
  };
}
