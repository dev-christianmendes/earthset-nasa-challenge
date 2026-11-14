// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Altura do relevo medido (LRO LOLA, malha de 400 m) em qualquer ponto da cena, com o exagero vertical da tela.
import { TERRAIN_MESH } from '../data/terrain-mesh';

/** Exagero vertical do relevo na tela (a interface informa). */
export const VERTICAL_EXAGGERATION = 2;

/** Altura do relevo (metros, já com exagero) no ponto (x, z) da cena, por interpolação bilinear na malha. */
export function surfaceHeight(x: number, z: number): number {
  const { n, size_m, heights_m } = TERRAIN_MESH;
  const step = size_m / (n - 1);
  const half = size_m / 2;
  const fi = Math.min(n - 1.001, Math.max(0, (x + half) / step));
  const fj = Math.min(n - 1.001, Math.max(0, (half - z) / step));
  const i = Math.floor(fi);
  const j = Math.floor(fj);
  const di = fi - i;
  const dj = fj - j;
  const h = (a: number, b: number) => heights_m[b * n + a];
  const top = h(i, j) * (1 - di) + h(i + 1, j) * di;
  const bottom = h(i, j + 1) * (1 - di) + h(i + 1, j + 1) * di;
  return (top * (1 - dj) + bottom * dj) * VERTICAL_EXAGGERATION;
}

/** Altura para pousar uma peça de `radius` metros: a menor altura entre o centro e quatro pontos da borda,
 * para nenhum pé ficar no ar (a peça afunda um pouco no lado alto, como em regolito solto). */
export function groundFor(x: number, z: number, radius: number): number {
  const pts = [
    surfaceHeight(x, z),
    surfaceHeight(x + radius, z),
    surfaceHeight(x - radius, z),
    surfaceHeight(x, z + radius),
    surfaceHeight(x, z - radius),
  ];
  return Math.min(...pts);
}
