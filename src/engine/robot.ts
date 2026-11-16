// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.

import type { SafeMode } from './safe-mode';

export type TaskKind = 'ice' | 'panel' | 'antenna';

export interface RobotTask {
  readonly kind: TaskKind;
  readonly hoursLeft: number;
}

export interface RobotState {
  readonly queue: readonly RobotTask[];
  readonly antennaInstalled: boolean;
  readonly safe: SafeMode | null;
}

export const MAX_QUEUE = 4;
export const MAX_PANELS = 12;
export const ROBOT_LOAD_PER_HOUR = 1.0;
/** Horas ilustrativas por fase: preparo, ida, operação, volta e entrega; ajustadas às rotas (D-22). */
export const TASK_PHASE_HOURS: Record<TaskKind, readonly [number, number, number, number, number]> = {
  ice: [0.36, 6.5, 1.8, 6.5, 0.36],
  panel: [0.24, 13, 1.2, 13, 0.24],
  antenna: [0.48, 4, 2.4, 4, 0.48],
};
export const TASK_HOURS: Record<TaskKind, number> = {
  ice: TASK_PHASE_HOURS.ice.reduce((a, b) => a + b, 0),
  panel: TASK_PHASE_HOURS.panel.reduce((a, b) => a + b, 0),
  antenna: TASK_PHASE_HOURS.antenna.reduce((a, b) => a + b, 0),
};
/** Água em pontos de 0 a 100; rendimento proporcional à duração da viagem para preservar água/hora (D-22). */
export const ICE_WATER_PER_TRIP = 31;
export const ICE_HELP_HOURS = TASK_HOURS.ice / 1.5;
export const ICE_HELP_SPEED = TASK_HOURS.ice / ICE_HELP_HOURS;

export function createRobot(): RobotState {
  return { queue: [], antennaInstalled: false, safe: null };
}

export type RejectReason = 'queue-full' | 'panel-limit' | 'antenna-exists';

export function rejectTask(
  robot: RobotState,
  kind: TaskKind,
  panelsInstalled: number,
): RejectReason | null {
  if (robot.queue.length >= MAX_QUEUE) return 'queue-full';
  const queuedPanels = robot.queue.filter((t) => t.kind === 'panel').length;
  if (kind === 'panel' && panelsInstalled + queuedPanels >= MAX_PANELS) return 'panel-limit';
  if (kind === 'antenna') {
    const queuedAntenna = robot.queue.some((t) => t.kind === 'antenna');
    if (robot.antennaInstalled || queuedAntenna) return 'antenna-exists';
  }
  return null;
}

export function enqueueTask(robot: RobotState, kind: TaskKind): RobotState {
  return { ...robot, queue: [...robot.queue, { kind, hoursLeft: TASK_HOURS[kind] }] };
}

export function cancelTask(robot: RobotState, index: number): RobotState {
  if (!Number.isInteger(index) || index < 0 || index >= robot.queue.length) return robot;
  return { ...robot, queue: robot.queue.filter((_, i) => i !== index) };
}

export function isWorking(robot: RobotState, batteryLevel: number): boolean {
  return robot.queue.length > 0 && batteryLevel > 0;
}

export interface RobotProgress {
  readonly robot: RobotState;
  /** Tarefas concluídas neste passo, na ordem em que terminaram. */
  readonly completed: readonly TaskKind[];
}

/**
 * Avança a fila por `hours`. Se uma tarefa termina no meio do passo, o tempo que
 * sobra vai para a próxima. A tarefa concluída só vale a partir do fim do passo.
 * `iceSpeed` acelera só a tarefa de gelo (ajuda do astronauta, D-06); 1 = sem ajuda.
 */
export function progressRobot(robot: RobotState, hours: number, iceSpeed = 1): RobotProgress {
  if (!Number.isFinite(hours) || hours < 0) {
    throw new RangeError(`horas inválidas: ${hours}`);
  }
  if (!Number.isFinite(iceSpeed) || iceSpeed <= 0) {
    throw new RangeError(`velocidade inválida: ${iceSpeed}`);
  }
  const queue = [...robot.queue];
  const completed: TaskKind[] = [];
  let left = hours;
  while (queue.length > 0 && left > 0) {
    const head = queue[0];
    const rate = head.kind === 'ice' ? iceSpeed : 1;
    const needed = head.hoursLeft / rate;
    const used = Math.min(needed, left);
    left -= used;
    // Resto abaixo de 1e-9 h é erro de ponto flutuante: a tarefa conclui (passos de 0,05 h).
    const rest = Math.round((head.hoursLeft - used * rate) * 1e9) / 1e9;
    if (rest > 0) {
      queue[0] = { ...head, hoursLeft: rest };
      break;
    }
    queue.shift();
    completed.push(head.kind);
  }
  return {
    robot: {
      ...robot,
      queue,
      antennaInstalled: robot.antennaInstalled || completed.includes('antenna'),
    },
    completed,
  };
}
