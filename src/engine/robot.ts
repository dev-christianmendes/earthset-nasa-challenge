// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Robô de apoio: fila de tarefas (gelo, painel, antena). Motor puro.
// Números e regras: docs/regras-recursos.md, seção "Robô". Todos ajustáveis.

import type { SafeMode } from './safe-mode';

export type TaskKind = 'ice' | 'panel' | 'antenna';

export interface RobotTask {
  readonly kind: TaskKind;
  /** Horas de jogo que faltam para a tarefa terminar. */
  readonly hoursLeft: number;
}

export interface RobotState {
  readonly queue: readonly RobotTask[];
  readonly antennaInstalled: boolean;
  /** Modo seguro da radiação (ver safe-mode.ts); null fora do evento. */
  readonly safe: SafeMode | null;
}

export const MAX_QUEUE = 4;
export const MAX_PANELS = 12;
/** Consumo extra da base enquanto o robô trabalha, por hora. */
export const ROBOT_LOAD_PER_HOUR = 1.0;
/**
 * Horas de jogo de cada fase da missão: [preparo, ida, operação, volta, entrega] (1 h = 1 s em 1×).
 * Ida e volta saem da rota real do rover na cena (`src/render/rover-routes.ts`) a ~3,3 m/s de média (~12 km/h),
 * na faixa do rover das Apollo (13 km/h de projeto, 18 km/h de recorde; D-22). Antes eram 13–20 m/s em 1×.
 * Preparo, operação e entrega mantêm as horas anteriores. Ilustrativo: equilíbrio e apresentação.
 */
export const TASK_PHASE_HOURS: Record<TaskKind, readonly [number, number, number, number, number]> = {
  ice: [0.36, 6.5, 1.8, 6.5, 0.36],
  panel: [0.24, 13, 1.2, 13, 0.24],
  antenna: [0.48, 4, 2.4, 4, 0.48],
};
/** Duração de cada tipo de tarefa, em horas de jogo (soma das fases). */
export const TASK_HOURS: Record<TaskKind, number> = {
  ice: TASK_PHASE_HOURS.ice.reduce((a, b) => a + b, 0),
  panel: TASK_PHASE_HOURS.panel.reduce((a, b) => a + b, 0),
  antenna: TASK_PHASE_HOURS.antenna.reduce((a, b) => a + b, 0),
};
/**
 * Água de uma viagem de gelo, em unidades de 0 a 100. Proporcional à duração da missão para manter a água por hora
 * de antes (12 em 6 h → 31 em 15,52 h; D-22). Regra de jogo.
 */
export const ICE_WATER_PER_TRIP = 31;
/** Duração da viagem de gelo com a ajuda do astronauta livre (D-06): mesma proporção de antes (6 h → 4 h, ×1,5). */
export const ICE_HELP_HOURS = TASK_HOURS.ice / 1.5;
/** Velocidade da viagem de gelo com ajuda (×1,5). */
export const ICE_HELP_SPEED = TASK_HOURS.ice / ICE_HELP_HOURS;

export function createRobot(): RobotState {
  return { queue: [], antennaInstalled: false, safe: null };
}

/** Código do motivo para recusar uma tarefa. A tela traduz o código (src/i18n.ts). */
export type RejectReason = 'queue-full' | 'panel-limit' | 'antenna-exists';

/** Motivo para recusar a tarefa, ou null se ela pode entrar na fila. */
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

/** Remove a tarefa da posição `index`. Posição inválida devolve a fila sem mudança. */
export function cancelTask(robot: RobotState, index: number): RobotState {
  if (!Number.isInteger(index) || index < 0 || index >= robot.queue.length) return robot;
  return { ...robot, queue: robot.queue.filter((_, i) => i !== index) };
}

/** O robô só trabalha com energia na base e com tarefa na fila. */
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
