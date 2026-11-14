// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Sol vindo da tabela gerada por data-pipeline/fetch_sun.py (JPL Horizons). Motor puro.
// Fonte e método: docs/data-sources.md.
import type { Site } from './resources';

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
}

/**
 * Altura, em graus, que o relevo tapa acima do horizonte plano em cada local.
 * ILUSTRATIVO: valores escolhidos para dar um dia lunar com diferença entre os locais.
 * Serão substituídos por horizontes medidos no relevo LOLA (bloco B2).
 */
export const SITE_HORIZON_DEG: Record<Site, number> = { peak: 0, slope: 1.2, rim: 1.6 };

/** Amostra da tabela para a hora de jogo `hour`. Para no último ponto. */
export function sampleAt(table: SunTable, hour: number): SunSample {
  if (!Number.isFinite(hour) || hour < 0) {
    throw new RangeError(`hora inválida para o Sol: ${hour}`);
  }
  const index = Math.min(Math.floor(hour / table.step_hours), table.samples.length - 1);
  return table.samples[index];
}

/** O Sol chega à base nessa hora? Elevação acima do horizonte local. */
export function isSunlit(table: SunTable, hour: number, site: Site): boolean {
  return sampleAt(table, hour).el > SITE_HORIZON_DEG[site];
}
