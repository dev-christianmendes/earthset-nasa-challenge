// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import type { GameState } from './game';

export type ObjectiveId = 'panels' | 'ice' | 'antenna' | 'survive';

export interface Objective {
  readonly id: ObjectiveId;
  readonly done: boolean;
  /** Progresso de 0 a 1. */
  readonly progress: number;
}

export const OBJECTIVE_PANELS = 4;
/** Água a manter para o objetivo de gelo (0 a 100). */
export const OBJECTIVE_WATER = 70;
/** Hora de jogo em que a missão de sobrevivência fica completa. */
export const OBJECTIVE_SURVIVE_HOUR = 100;

export function objectivesOf(state: GameState): readonly Objective[] {
  const panels = Math.min(1, state.installation.panels / OBJECTIVE_PANELS);
  const water = Math.min(1, state.vitals.water / OBJECTIVE_WATER);
  const hour = Math.min(1, state.clock.hour / OBJECTIVE_SURVIVE_HOUR);
  return [
    { id: 'panels', done: state.installation.panels >= OBJECTIVE_PANELS, progress: panels },
    { id: 'ice', done: state.vitals.water >= OBJECTIVE_WATER, progress: water },
    { id: 'antenna', done: state.robot.antennaInstalled, progress: state.robot.antennaInstalled ? 1 : 0 },
    { id: 'survive', done: state.clock.hour >= OBJECTIVE_SURVIVE_HOUR && state.hearts > 0, progress: hour },
  ];
}

export function nextObjective(objectives: readonly Objective[]): Objective | null {
  return objectives.find((o) => !o.done) ?? null;
}
