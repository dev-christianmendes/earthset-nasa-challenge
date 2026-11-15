// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Sol vindo da tabela gerada por data-pipeline/fetch_sun.py (JPL Horizons). Motor puro.
// Iluminação do site: elevação do Sol contra o horizonte medido no LOLA (src/engine/terrain.ts).
// Fonte e método: docs/data-sources.md.
import type { Site } from './resources';
import { horizonAt, type TerrainTable } from './terrain';

export interface SunSample {
  /** Azimute aparente do Sol, em graus. */
  readonly az: number;
  /** Elevação aparente do Sol acima do horizonte plano, em graus. */
  readonly el: number;
}

export interface SunTable {
  readonly start_utc: string;
  readonly step_hours: number;
  readonly hours: number;
  readonly samples: readonly SunSample[];
  readonly samples_by_site?: Partial<Record<Site, readonly SunSample[]>>;
  /** Metadado opcional: ângulo do norte geográfico na grade polar usada pelas amostras. */
  readonly observer?: { readonly grid_north_rotation_deg: number };
  readonly observers?: Partial<Record<Site, { readonly grid_north_rotation_deg: number }>>;
}

/** Amostra da tabela para a hora de jogo `hour`. Para no último ponto. */
export function sampleAt(table: SunTable, hour: number, site?: Site): SunSample {
  if (!Number.isFinite(hour) || hour < 0) {
    throw new RangeError(`hora inválida para o Sol: ${hour}`);
  }
  const samples = site ? table.samples_by_site?.[site] ?? table.samples : table.samples;
  const index = Math.min(Math.floor(hour / table.step_hours), samples.length - 1);
  return samples[index];
}

/**
 * O Sol chega ao site nessa hora? A elevação do Sol tem de passar do horizonte medido
 * no relevo, na direção do azimute do Sol.
 */
export function isSunlit(table: SunTable, hour: number, site: Site, terrain: TerrainTable): boolean {
  const sample = sampleAt(table, hour, site);
  return sample.el > horizonAt(terrain, site, sample.az);
}
