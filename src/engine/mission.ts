// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Fases de uma missão do robô, derivadas do progresso real da tarefa no motor (camada de apresentação pura).
// Não concede recurso: o efeito (água, painel, antena) continua só na conclusão da tarefa em game.ts.
import { TASK_HOURS, type RobotTask } from './robot';

export type MissionPhase = 'prep' | 'travel' | 'operate' | 'return' | 'deliver';

/** Limites das fases, em fração do tempo da tarefa. Saída e volta usam a mesma fração (o trajeto é simétrico). */
export const PHASE_BOUNDS: Readonly<Record<MissionPhase, readonly [number, number]>> = {
  prep: [0, 0.06],
  travel: [0.06, 0.35],
  operate: [0.35, 0.65],
  return: [0.65, 0.94],
  deliver: [0.94, 1],
};

export const PHASES: readonly MissionPhase[] = ['prep', 'travel', 'operate', 'return', 'deliver'];

/** Fração concluída da tarefa (0 a 1), a partir das horas restantes no motor. */
export function taskProgress(task: RobotTask): number {
  const total = TASK_HOURS[task.kind];
  return Math.min(1, Math.max(0, 1 - task.hoursLeft / total));
}

/** Fase atual da tarefa. */
export function missionPhase(task: RobotTask): MissionPhase {
  const p = taskProgress(task);
  for (const phase of PHASES) {
    if (p < PHASE_BOUNDS[phase][1]) return phase;
  }
  return 'deliver';
}

/** Progresso dentro da fase atual (0 a 1), para animar cada etapa. */
export function phaseProgress(task: RobotTask): number {
  const p = taskProgress(task);
  const [a, b] = PHASE_BOUNDS[missionPhase(task)];
  return Math.min(1, Math.max(0, (p - a) / (b - a)));
}
