// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Formato tabular gerado pelo pipeline; restaura objetos na fronteira dos dados.
import { BODY_IDS, type BodyId, type BodySample, type CatalogStar, type SkyTable } from './sky';

interface PackedSky extends Omit<SkyTable, 'bodies' | 'stars'> {
  readonly format: number;
  readonly scale: number;
  readonly columns: Record<BodyId, readonly (keyof BodySample)[]>;
  readonly bodies: Record<BodyId, readonly (readonly (number | null)[])[]>;
  readonly stars: Omit<SkyTable['stars'], 'samples'> & {
    readonly columns: readonly (keyof CatalogStar)[];
    readonly samples: readonly (readonly number[])[];
  };
}

export function decodeSky(input: unknown): SkyTable {
  const data = input as PackedSky;
  if (data.format !== 3 || data.scale !== 1000000 || data.step_hours !== 1 || !Number.isInteger(data.hours) || data.hours < 1 || data.hours > 8784 || !Number.isFinite(Date.parse(data.start_utc.replace(' ', 'T') + 'Z'))) throw new Error('Formato de céu inválido');
  const count = data.hours + 1;
  const bodies = {} as Record<BodyId, BodySample[]>;
  for (const id of BODY_IDS) {
    const columns = data.columns[id];
    if (new Set(columns).size !== columns.length || !['az', 'el', 'diameter_arcsec', 'ra', 'dec'].every((c) => columns.includes(c as keyof BodySample))) throw new Error(`Colunas inválidas: ${id}`);
    if (data.bodies[id].length !== columns.length) throw new Error(`Número de colunas inválido: ${id}`);
    const rows: Record<string, number | null>[] = Array.from({ length: count }, () => ({}));
    columns.forEach((key, c) => {
      const values = data.bodies[id][c];
      if (values.length !== count) throw new Error(`Grade temporal inválida: ${id}`);
      let previous = 0;
      values.forEach((value, i) => {
        if (value !== null && !Number.isSafeInteger(value)) throw new Error(`Amostra inválida: ${id}`);
        if (value === null) rows[i][key] = null;
        else {
          previous += value;
          if (!Number.isSafeInteger(previous)) throw new Error(`Delta fora de faixa: ${id}`);
          rows[i][key] = previous / data.scale;
        }
      });
    });
    bodies[id] = rows.map((row) => {
      for (const key of ['illumination_pct', 'magnitude', 'phase_deg', 'observer_lon', 'observer_lat', 'solar_lon', 'solar_lat', 'pole_ra', 'pole_dec']) row[key] ??= null;
      if (['az', 'el', 'diameter_arcsec', 'ra', 'dec'].some((key) => row[key] === null)) throw new Error(`Coordenada ausente: ${id}`);
      return row as unknown as BodySample;
    });
  }
  if (data.icrf_to_local.length !== count || data.icrf_to_local.some((m) => m.length !== 9 || m.some((v) => !Number.isFinite(v)))) throw new Error('Referencial inválido');
  if (new Set(data.stars.columns).size !== data.stars.columns.length || !['hr', 'ra', 'dec', 'magnitude', 'pm_ra_cosdec', 'pm_dec'].every((k) => data.stars.columns.includes(k as keyof CatalogStar))) throw new Error('Colunas estelares inválidas');
  const stars = data.stars.samples.map((values) => {
    if (values.length !== data.stars.columns.length || values.some((v) => !Number.isFinite(v))) throw new Error('Estrela inválida');
    return Object.fromEntries(data.stars.columns.map((key, i) => [key, values[i]])) as unknown as CatalogStar;
  });
  return { ...data, bodies, stars: { ...data.stars, samples: stars } };
}
