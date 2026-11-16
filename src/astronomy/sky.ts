// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { sampleAt, isSunlit, type SunTable } from '../engine/sun';
import { horizonAt, type TerrainTable } from '../engine/terrain';
import type { Site } from '../engine/resources';

export const BODY_IDS = ['sun', 'earth', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'] as const;
export type BodyId = typeof BODY_IDS[number];
export type Vector = readonly [number, number, number];
export interface BodySample {
  readonly az: number;
  readonly el: number;
  readonly diameter_arcsec: number;
  readonly illumination_pct: number | null;
  readonly magnitude: number | null;
  readonly phase_deg: number | null;
  readonly observer_lon: number | null;
  readonly observer_lat: number | null;
  readonly solar_lon: number | null;
  readonly solar_lat: number | null;
  readonly pole_ra: number | null;
  readonly pole_dec: number | null;
  readonly ra: number;
  readonly dec: number;
}
export interface CatalogStar {
  readonly hr: number; readonly ra: number; readonly dec: number; readonly magnitude: number;
  /** BSC5: µα cos(δ) e µδ, arcsec por ano juliano, época J2000. */
  readonly pm_ra_cosdec: number; readonly pm_dec: number;
}
export interface SkyTable {
  readonly source: string;
  readonly start_utc: string;
  readonly step_hours: number;
  readonly hours: number;
  readonly observer: { readonly body: number; readonly longitude_deg: number; readonly latitude_deg: number; readonly altitude_km: number; readonly frame: string; readonly grid_north_rotation_deg: number };
  readonly bodies: Readonly<Record<BodyId, readonly BodySample[]>>;
  readonly icrf_to_local: readonly (readonly number[])[];
  readonly stars: { readonly source: string; readonly catalog: string; readonly epoch: string; readonly status: string; readonly samples: readonly CatalogStar[] };
  readonly validation: { readonly max_frame_error_deg: number; readonly max_legacy_sun_error_deg: number };
}

export const RAD = Math.PI / 180;
export function sampleIndex(table: SkyTable, hour: number): number {
  if (!Number.isFinite(hour) || hour < 0 || hour > table.hours) throw new RangeError(`hora fora da janela do céu: ${hour}`);
  return Math.floor(hour / table.step_hours);
}
export const bodyAt = (table: SkyTable, id: BodyId, hour: number): BodySample => table.bodies[id][sampleIndex(table, hour)];

/** Eixos da grade polar da cena: x=+x LOLA, y=zênite, -z=+y LOLA.
 * Os azimutes Horizons são rotacionados no pipeline para estes eixos.
 */
export function direction(az: number, el: number): Vector {
  const a = az * RAD;
  const e = el * RAD;
  return [Math.sin(a) * Math.cos(e), Math.sin(e), -Math.cos(a) * Math.cos(e)];
}
export function equatorial(ra: number, dec: number): Vector {
  return [Math.cos(dec * RAD) * Math.cos(ra * RAD), Math.cos(dec * RAD) * Math.sin(ra * RAD), Math.sin(dec * RAD)];
}
/** Movimento próprio tangencial em vetor, sem singularidade nos polos celestes.
 * Sem paralaxe/velocidade radial/deflexão. Não é uma solução astrométrica completa.
 */
export function stellarDirection(star: CatalogStar, table: SkyTable, hour: number): Vector {
  sampleIndex(table, hour);
  const years = (Date.parse(table.start_utc.replace(' ', 'T') + 'Z') + hour * 3600000 - Date.UTC(2000, 0, 1, 12)) / (365.25 * 86400000);
  const a = star.ra * RAD; const d = star.dec * RAD;
  const p = equatorial(star.ra, star.dec);
  const ra = star.pm_ra_cosdec * RAD / 3600 * years;
  const dec = star.pm_dec * RAD / 3600 * years;
  const v: Vector = [p[0] - ra * Math.sin(a) - dec * Math.cos(a) * Math.sin(d),
    p[1] + ra * Math.cos(a) - dec * Math.sin(a) * Math.sin(d), p[2] + dec * Math.cos(d)];
  const norm = Math.hypot(...v);
  return [v[0] / norm, v[1] / norm, v[2] / norm];
}

/** A malha usa os eixos da projeção; o painel apresenta o azimute geográfico. */
export const trueAzimuth = (table: SkyTable, gridAzimuth: number): number =>
  ((gridAzimuth - table.observer.grid_north_rotation_deg) % 360 + 360) % 360;
export function transform(matrix: readonly number[], vector: Vector): Vector {
  return [matrix[0] * vector[0] + matrix[1] * vector[1] + matrix[2] * vector[2],
    matrix[3] * vector[0] + matrix[4] * vector[1] + matrix[5] * vector[2],
    matrix[6] * vector[0] + matrix[7] * vector[1] + matrix[8] * vector[2]];
}
export function skyAngles(vector: Vector): { az: number; el: number } {
  const norm = Math.hypot(...vector);
  return { az: (Math.atan2(vector[0], -vector[2]) / RAD + 360) % 360, el: Math.asin(Math.max(-1, Math.min(1, vector[1] / norm))) / RAD };
}
/** Raio geométrico: asin(r/distância) reproduz exatamente o semidiâmetro angular tabulado. */
export const angularRadius = (diameterArcsec: number, distance: number): number => distance * Math.sin(diameterArcsec / 7200 * RAD);
export const illuminatedFraction = (phaseDeg: number): number => (1 + Math.cos(phaseDeg * RAD)) / 2;

/** Longitudes geográficas positivas para leste; espaço da textura com norte = +y. */
export function terrestrial(lon: number, lat: number): Vector {
  return [Math.cos(lat * RAD) * Math.cos(lon * RAD), Math.sin(lat * RAD), -Math.cos(lat * RAD) * Math.sin(lon * RAD)];
}

/** O Sol desenhado e a luz usam a amostra energética existente, sem efeméride independente. */
export function solarView(sun: SunTable, hour: number, site: Site, terrain: TerrainTable) {
  const sample = sampleAt(sun, hour, site);
  return { ...sample, direction: direction(sample.az, sample.el), lit: isSunlit(sun, hour, site, terrain), horizon: horizonAt(terrain, site, sample.az) };
}

export function visibility(sample: Pick<BodySample, 'az' | 'el' | 'diameter_arcsec'>, terrain: TerrainTable, site: Site) {
  const horizon = Math.max(0, horizonAt(terrain, site, sample.az));
  const radius = sample.diameter_arcsec / 7200;
  return { horizon, centerVisible: sample.el > horizon, anyVisible: sample.el + radius > horizon, fullVisible: sample.el - radius > horizon };
}

export function utcAt(table: SkyTable, hour: number): string {
  sampleIndex(table, hour);
  const epoch = Date.parse(table.start_utc.replace(' ', 'T') + 'Z');
  return new Date(epoch + hour * 3600000).toISOString().replace('.000Z', ' UTC').replace('T', ' ');
}
