// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.

export interface SpaceWeatherSample {
  /**
   * Índice Kp (0 a 9) da hora: observação da magnetosfera da TERRA (NOAA, via DONKI). Não mede radiação
   * na Lua e não tem efeito na simulação (decisão do autor, 14/11/2026). Guardado só como dado observado.
   */
  readonly kp: number;
  readonly radiation: boolean;
}

export interface SpaceWeatherTable {
  readonly start_utc: string;
  readonly step_hours: number;
  readonly hours: number;
  readonly samples: readonly SpaceWeatherSample[];
}

export const CALM: SpaceWeatherSample = { kp: 0, radiation: false };

export function weatherAt(table: SpaceWeatherTable, hour: number): SpaceWeatherSample {
  if (!Number.isFinite(hour) || hour < 0) {
    throw new RangeError(`hora inválida para o clima espacial: ${hour}`);
  }
  const index = Math.min(Math.floor(hour / table.step_hours), table.samples.length - 1);
  return table.samples[index];
}

/**
 * Horas que faltam para a radiação passar, segundo a tabela (0 se não há radiação agora).
 * A DONKI não informa a duração do evento: a tabela usa a duração suposta pelo pipeline (24 h). Para no fim da tabela.
 */
export function radiationHoursLeft(table: SpaceWeatherTable, hour: number): number {
  if (!weatherAt(table, hour).radiation) return 0;
  const step = table.step_hours;
  let i = Math.min(Math.floor(hour / step), table.samples.length - 1);
  while (i < table.samples.length && table.samples[i].radiation) i++;
  return Math.max(0, i * step - hour);
}

