// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Malha do relevo LOLA, gerada por data-pipeline/fetch_lola.py (400 m centrados no morro).
import meshJson from './terrain-mesh.json';

export interface TerrainMesh {
  readonly source: string;
  readonly center_m: readonly number[];
  readonly size_m: number;
  readonly n: number;
  /** Alturas em metros, relativas ao centro; linha j (norte cresce), coluna i (leste cresce). */
  readonly heights_m: readonly number[];
}

export const TERRAIN_MESH = meshJson as TerrainMesh;
