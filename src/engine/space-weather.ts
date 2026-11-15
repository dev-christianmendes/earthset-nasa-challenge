// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Clima espacial horário (NASA DONKI, data-pipeline/fetch_donki.py). Motor puro.
// Efeito na simulação: só a radiação de partículas solares (abriga a tripulação e para o robô).
// O Kp da Terra não afeta nada. Regras de jogo documentadas em docs/regras-recursos.md.

export interface SpaceWeatherSample {
  /**
   * Índice Kp (0 a 9) da hora: observação da magnetosfera da TERRA (NOAA, via DONKI). Não mede radiação
   * na Lua e não tem efeito na simulação (decisão do autor, 14/11/2026). Guardado só como dado observado.
   */
  readonly kp: number;
  /** Partículas solares energéticas presentes nesta hora. */
  readonly radiation: boolean;
}

export interface SpaceWeatherTable {
  readonly start_utc: string;
  readonly step_hours: number;
  readonly hours: number;
  readonly samples: readonly SpaceWeatherSample[];
}

/** Clima calmo: usado quando não há tabela ou a partida é só de sol. */
export const CALM: SpaceWeatherSample = { kp: 0, radiation: false };

/** Clima da hora `hour` da partida. Para no último ponto da tabela. */
export function weatherAt(table: SpaceWeatherTable, hour: number): SpaceWeatherSample {
  if (!Number.isFinite(hour) || hour < 0) {
    throw new RangeError(`hora inválida para o clima espacial: ${hour}`);
  }
  const index = Math.min(Math.floor(hour / table.step_hours), table.samples.length - 1);
  return table.samples[index];
}
