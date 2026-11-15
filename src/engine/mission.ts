// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Fases de uma missão do robô, derivadas do progresso real da tarefa no motor (camada de apresentação pura).
// Não concede recurso: o efeito (água, painel, antena) continua só na conclusão da tarefa em game.ts.
import { TASK_HOURS, TASK_PHASE_HOURS, type RobotTask, type TaskKind } from './robot';

export type MissionPhase = 'prep' | 'travel' | 'operate' | 'return' | 'deliver';

/** Limites das fases em fração do tempo da tarefa, por tipo de missão (das horas de `TASK_PHASE_HOURS`). */
function boundsOf(kind: TaskKind): Readonly<Record<MissionPhase, readonly [number, number]>> {
  const h = TASK_PHASE_HOURS[kind];
  const total = h.reduce((a, b) => a + b, 0);
  const out = {} as Record<MissionPhase, readonly [number, number]>;
  let acc = 0;
  (['prep', 'travel', 'operate', 'return', 'deliver'] as const).forEach((phase, i) => {
    out[phase] = [acc / total, (acc + h[i]) / total];
    acc += h[i];
  });
  return out;
}
export const PHASE_BOUNDS_BY_KIND: Readonly<Record<TaskKind, Readonly<Record<MissionPhase, readonly [number, number]>>>> = {
  ice: boundsOf('ice'),
  panel: boundsOf('panel'),
  antenna: boundsOf('antenna'),
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
    if (p < PHASE_BOUNDS_BY_KIND[task.kind][phase][1]) return phase;
  }
  return 'deliver';
}

/** Progresso dentro da fase atual (0 a 1), para animar cada etapa. */
export function phaseProgress(task: RobotTask): number {
  const p = taskProgress(task);
  const [a, b] = PHASE_BOUNDS_BY_KIND[task.kind][missionPhase(task)];
  return Math.min(1, Math.max(0, (p - a) / (b - a)));
}
