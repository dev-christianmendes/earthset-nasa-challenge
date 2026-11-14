// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Robô de apoio: fila de tarefas (gelo, painel, antena). Motor puro.
// Números e regras: docs/regras-recursos.md, seção "Robô". Todos ajustáveis.

export type TaskKind = 'ice' | 'panel' | 'antenna';

export interface RobotTask {
  readonly kind: TaskKind;
  /** Horas de jogo que faltam para a tarefa terminar. */
  readonly hoursLeft: number;
}

export interface RobotState {
  readonly queue: readonly RobotTask[];
  readonly antennaInstalled: boolean;
}

export const MAX_QUEUE = 4;
export const MAX_PANELS = 12;
/** Consumo extra da base enquanto o robô trabalha, por hora. */
export const ROBOT_LOAD_PER_HOUR = 1.0;
/** Duração de cada tipo de tarefa, em horas de jogo. */
export const TASK_HOURS: Record<TaskKind, number> = { ice: 6, panel: 4, antenna: 8 };
/** Água de uma viagem de gelo, em unidades de 0 a 100. */
export const ICE_WATER_PER_TRIP = 12;
/** Duração da viagem de gelo com a ajuda do astronauta livre (D-06). */
export const ICE_HELP_HOURS = 4;
/** Velocidade da viagem de gelo com ajuda: 6 h de trabalho em 4 h de jogo. */
export const ICE_HELP_SPEED = TASK_HOURS.ice / ICE_HELP_HOURS;

export function createRobot(): RobotState {
  return { queue: [], antennaInstalled: false };
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
    const rest = head.hoursLeft - used * rate;
    if (rest > 0) {
      queue[0] = { ...head, hoursLeft: rest };
      break;
    }
    queue.shift();
    completed.push(head.kind);
  }
  return {
    robot: {
      queue,
      antennaInstalled: robot.antennaInstalled || completed.includes('antenna'),
    },
    completed,
  };
}
