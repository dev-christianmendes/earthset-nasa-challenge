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

/** Azimute em [0, 360); sem alterar valores já dentro do intervalo. */
function wrap360(az: number): number {
  return az >= 0 && az < 360 ? az : ((az % 360) + 360) % 360;
}

/**
 * Posição do Sol para desenho, interpolada entre as amostras horárias (AST-VIS-02).
 * Não é usada por energia, iluminação ou partida: essas continuam pela amostra da hora (`sampleAt`).
 * Azimute pelo arco mais curto (wrap de 360°), resultado em [0, 360).
 */
export function sunPositionAt(table: SunTable, hour: number, site?: Site): SunSample {
  if (!Number.isFinite(hour) || hour < 0) {
    throw new RangeError(`hora inválida para o Sol: ${hour}`);
  }
  const samples = site ? table.samples_by_site?.[site] ?? table.samples : table.samples;
  const x = hour / table.step_hours;
  const i = Math.floor(x);
  if (i >= samples.length - 1) {
    const last = samples[samples.length - 1];
    return { az: wrap360(last.az), el: last.el };
  }
  const a = samples[i];
  const b = samples[i + 1];
  const t = x - i;
  if (t === 0) return { az: wrap360(a.az), el: a.el };
  const delta = ((b.az - a.az + 540) % 360) - 180;
  return {
    az: wrap360(a.az + t * delta),
    el: a.el + t * (b.el - a.el),
  };
}

/**
 * O Sol chega ao site nessa hora? A elevação do Sol tem de passar do horizonte medido
 * no relevo, na direção do azimute do Sol.
 */
export function isSunlit(table: SunTable, hour: number, site: Site, terrain: TerrainTable): boolean {
  const sample = sampleAt(table, hour, site);
  return sample.el > horizonAt(terrain, site, sample.az);
}
