// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import type { Site } from './resources';

export interface TerrainSite {
  /** Posição na grade polar sul, em metros. Norte geográfico depende da longitude do site. */
  readonly x_m: number;
  readonly y_m: number;
  /** Ângulo, em graus, que o relevo tapa em cada direção (passo de azimute_step_deg). */
  readonly horizon_deg: readonly number[];
}

export interface TerrainTable {
  readonly azimuth_step_deg: number;
  readonly sites: Record<Site, TerrainSite>;
}

/**
 * Horizonte do site no azimute da grade `azDeg` (0° = +y LOLA, sentido horário).
 * Interpola linearmente entre as direções medidas; o azimute dá a volta (360° = 0°).
 */
export function horizonAt(table: TerrainTable, site: Site, azDeg: number): number {
  if (!Number.isFinite(azDeg)) {
    throw new RangeError(`azimute inválido: ${azDeg}`);
  }
  const profile = table.sites[site].horizon_deg;
  const n = profile.length;
  const pos = ((((azDeg % 360) + 360) % 360) / table.azimuth_step_deg) % n;
  const i = Math.floor(pos);
  const j = (i + 1) % n;
  const f = pos - i;
  return profile[i] * (1 - f) + profile[j] * f;
}
