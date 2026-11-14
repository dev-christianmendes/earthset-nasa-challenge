// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Horizonte LOLA gerado por data-pipeline/fetch_lola.py. Ver docs/data-sources.md, seção 2.
import terrainJson from './terrain-sites.json';
import type { TerrainTable } from '../engine/terrain';

export const TERRAIN = terrainJson as TerrainTable;
