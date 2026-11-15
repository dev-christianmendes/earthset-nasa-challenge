// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Tripulação: exposição à radiação de partículas solares (D-05, docs/DECISOES.md). Motor puro.
// Quem está fora do habitat por atividade: o astronauta da estufa, quando ela liga; o outro, quando o robô trabalha.
import type { Installation, Vitals } from './resources';
import { isGreenhouseOn } from './resources';
import { isWorking, type RobotState } from './robot';

/** Dois astronautas: um cuida da estufa, o outro ajuda o robô. */
export const CREW_SIZE = 2;
/** Horas de exposição acumulada (somando os astronautas) para perder 1 coração. */
export const EXPOSURE_HOURS_PER_HEART = 12;
/** Tempo de caminho até o abrigo, por astronauta que estava fora quando a radiação começou. */
const TRANSIT_HOURS = 1;

export interface CrewState {
  /** Horas de caminho que cada astronauta ainda precisa para chegar ao abrigo. */
  readonly transitLeft: readonly number[];
  /** Exposição total acumulada, somando os astronautas, em horas. */
  readonly exposureHours: number;
  /** Corações já perdidos por exposição (para não cobrar duas vezes). */
  readonly heartsLostToExposure: number;
  /** A radiação estava ativa no passo anterior? */
  readonly prevRadiation: boolean;
}

export function createCrew(): CrewState {
  return { transitLeft: Array.from({ length: CREW_SIZE }, () => 0), exposureHours: 0, heartsLostToExposure: 0, prevRadiation: false };
}

/** Quem está fora do habitat agora, por atividade (antes da radiação). */
export function crewOutside(
  inst: Installation,
  vitals: Vitals,
  robot: RobotState,
  order: 'auto' | 'shelter' | 'outside' = 'auto',
): readonly boolean[] {
  if (order === 'shelter') return [false, false];
  const keeperOutside = isGreenhouseOn(vitals, inst);
  const helperOutside = isWorking(robot, vitals.battery);
  return [keeperOutside, helperOutside];
}

/** Toda a tripulação está dentro do habitat: em ordem de abrigo, ou com a radiação ativa e o caminho já feito. */
export function crewSheltered(crew: CrewState, order: 'auto' | 'shelter' | 'outside'): boolean {
  if (order === 'outside') return false;
  return order === 'shelter' || (crew.prevRadiation && crew.transitLeft.every((left) => left === 0));
}

/**
 * A tripulação pode ajudar o robô agora? Não pode durante a radiação, nem enquanto
 * alguém ainda está na trilha até o abrigo (D-06).
 */
export function crewAvailableForHelp(crew: CrewState, radiation: boolean): boolean {
  return !radiation && crew.transitLeft.every((left) => left === 0);
}

/**
 * Avança a exposição por `dt` horas. Quando a radiação começa, quem estava fora precisa de
 * TRANSIT_HOURS para chegar ao abrigo, e cada hora desse caminho é exposição. Depois, a tripulação
 * fica no abrigo até a radiação acabar. Devolve o novo estado e quantos corações a exposição tira agora.
 */
export function advanceCrew(
  crew: CrewState,
  outside: readonly boolean[],
  radiation: boolean,
  dt: number,
): { crew: CrewState; heartsLost: number } {
  if (!radiation) {
    return {
      crew: { ...crew, transitLeft: crew.transitLeft.map(() => 0), prevRadiation: false },
      heartsLost: 0,
    };
  }
  const transitLeft = crew.transitLeft.map((left, i) => {
    if (!crew.prevRadiation) return outside[i] ? TRANSIT_HOURS : 0;
    return left;
  });
  let added = 0;
  const remaining = transitLeft.map((left) => {
    const walked = Math.min(dt, left);
    added += walked;
    return left - walked;
  });
  const exposureHours = crew.exposureHours + added;
  const totalHeartsLost = Math.floor(exposureHours / EXPOSURE_HOURS_PER_HEART);
  const heartsLost = totalHeartsLost - crew.heartsLostToExposure;
  return {
    crew: { transitLeft: remaining, exposureHours, heartsLostToExposure: totalHeartsLost, prevRadiation: true },
    heartsLost,
  };
}

/**
 * Decisão do jogador de continuar fora durante a radiação: ninguém caminha até o abrigo e cada
 * astronauta que está fora acumula 1 hora de exposição por hora (regra de jogo, D-05).
 * `prevRadiation` volta a falso: se o jogador mudar de ideia, quem está fora leva 1 h de caminho.
 */
export function exposeCrew(crew: CrewState, outside: readonly boolean[], dt: number): { crew: CrewState; heartsLost: number } {
  const exposureHours = crew.exposureHours + outside.filter(Boolean).length * dt;
  const totalHeartsLost = Math.floor(exposureHours / EXPOSURE_HOURS_PER_HEART);
  return {
    crew: { transitLeft: crew.transitLeft.map(() => 0), exposureHours, heartsLostToExposure: totalHeartsLost, prevRadiation: false },
    heartsLost: totalHeartsLost - crew.heartsLostToExposure,
  };
}
