// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Clima espacial horário (NASA DONKI, data-pipeline/fetch_donki.py). Motor puro.
// Efeitos: tempestade geomagnética reduz a geração dos painéis; radiação de partículas solares
// para o robô. Números ilustrativos, documentados em docs/regras-recursos.md.

export interface SpaceWeatherSample {
  /** Índice Kp (0 a 9) da hora. Kp 5 ou mais é tempestade geomagnética. */
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

/** Nível da tempestade na escala G da NOAA: 0 (calmo) a 5 (extrema). */
export type StormLevel = 0 | 1 | 2 | 3 | 4 | 5;

/** Clima calmo: usado quando não há tabela ou a partida é só de sol. */
export const CALM: SpaceWeatherSample = { kp: 0, radiation: false };

/** Nível G de um Kp: Kp 5 é G1, Kp 9 é G5. Abaixo de 5, é calmo. */
export function stormLevel(kp: number): StormLevel {
  if (!Number.isFinite(kp)) {
    throw new RangeError(`Kp inválido: ${kp}`);
  }
  if (kp < 5) return 0;
  return Math.min(5, Math.floor(kp) - 4) as StormLevel;
}

/** Fração da geração solar que sobra com a tempestade: 10% a menos por nível G (ilustrativo). */
export function solarFactor(level: StormLevel): number {
  return 1 - 0.1 * level;
}

/** Clima da hora `hour` da partida. Para no último ponto da tabela. */
export function weatherAt(table: SpaceWeatherTable, hour: number): SpaceWeatherSample {
  if (!Number.isFinite(hour) || hour < 0) {
    throw new RangeError(`hora inválida para o clima espacial: ${hour}`);
  }
  const index = Math.min(Math.floor(hour / table.step_hours), table.samples.length - 1);
  return table.samples[index];
}

/**
 * Horas até a próxima tempestade (nível G 1 ou mais), se ela começar em até `ahead` horas
 * depois de `hour`. Null se não houver. Base do aviso da antena (D-01, docs/DECISOES.md).
 */
export function hoursUntilStorm(table: SpaceWeatherTable, hour: number, ahead = 6): number | null {
  for (let k = 1; k <= ahead; k++) {
    if (stormLevel(weatherAt(table, hour + k).kp) >= 1) return k;
  }
  return null;
}
