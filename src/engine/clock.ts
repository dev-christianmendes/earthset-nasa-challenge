// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Relógio da partida. Motor puro: sem three.js nem acesso ao navegador.

/** Duração de uma partida: um dia lunar, em horas de jogo. */
export const MATCH_HOURS = 708;

export interface Clock {
  readonly hour: number;
  readonly finished: boolean;
}

export function createClock(startHour = 0): Clock {
  const hour = clampHour(startHour);
  return { hour, finished: hour >= MATCH_HOURS };
}

/** Avança o relógio em horas (não negativas). Para em MATCH_HOURS. */
export function advanceClock(clock: Clock, hours: number): Clock {
  if (!Number.isFinite(hours) || hours < 0) {
    throw new RangeError(`horas inválidas: ${hours}`);
  }
  return createClock(clock.hour + hours);
}

function clampHour(hour: number): number {
  if (!Number.isFinite(hour)) throw new RangeError(`hora inválida: ${hour}`);
  return Math.min(Math.max(hour, 0), MATCH_HOURS);
}
