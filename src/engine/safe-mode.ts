// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Retorno de segurança é regra de jogo; a DONKI não fornece esta política.
import { PHASE_BOUNDS_BY_KIND, missionPhase, taskProgress } from './mission';
import { TASK_HOURS, type RobotState, type RobotTask, type TaskKind } from './robot';

const legOf = (kind: TaskKind): number => PHASE_BOUNDS_BY_KIND[kind].travel[1] - PHASE_BOUNDS_BY_KIND[kind].travel[0];

export interface SafeMode {
  /** Distância da base quando o modo seguro começou (0 = na base, 1 = no local da tarefa). */
  readonly from: number;
  readonly total: number;
  /** Horas que faltam para chegar à base (0 = já está no abrigo da garagem). */
  readonly returnLeft: number;
}

export function distanceFromBase(task: RobotTask): number {
  const p = taskProgress(task);
  switch (missionPhase(task)) {
    case 'travel':
      return Math.min(1, Math.max(0, (p - PHASE_BOUNDS_BY_KIND[task.kind].travel[0]) / legOf(task.kind)));
    case 'operate':
      return 1;
    case 'return':
      return Math.min(1, Math.max(0, 1 - (p - PHASE_BOUNDS_BY_KIND[task.kind].return[0]) / legOf(task.kind)));
    default:
      return 0;
  }
}

export function isAway(task: RobotTask): boolean {
  const phase = missionPhase(task);
  return phase === 'travel' || phase === 'operate';
}

export function isHeadingHome(task: RobotTask): boolean {
  const phase = missionPhase(task);
  return phase === 'return' || phase === 'deliver';
}

export function startSafeMode(robot: RobotState): RobotState {
  const head = robot.queue[0];
  if (!head || robot.safe) return robot;
  const from = distanceFromBase(head);
  const total = from * legOf(head.kind) * TASK_HOURS[head.kind];
  return { ...robot, safe: { from, total, returnLeft: total } };
}

export function safeDistance(safe: SafeMode): number {
  return safe.total > 0 ? safe.from * (safe.returnLeft / safe.total) : 0;
}

export function stepSafeMode(robot: RobotState, hours: number, canDrive: boolean): RobotState {
  const safe = robot.safe;
  if (!safe || !canDrive || hours <= 0) return robot;
  return { ...robot, safe: { ...safe, returnLeft: Math.max(0, safe.returnLeft - hours) } };
}

/**
 * Fim do evento: a missão recomeça da posição em que o rover está, na ida. O que ele já tinha andado
 * além disso se perde (custo da decisão, mostrado ao jogador).
 */
export function endSafeMode(robot: RobotState): RobotState {
  const head = robot.queue[0];
  const safe = robot.safe;
  if (!safe) return robot;
  if (!head) return { ...robot, safe: null };
  const d = safeDistance(safe);
  // Um pouco além do limite da fase de preparação, para a missão voltar a ser vista como "ida".
  const progress = PHASE_BOUNDS_BY_KIND[head.kind].travel[0] + 0.0001 + d * legOf(head.kind);
  const hoursLeft = TASK_HOURS[head.kind] * (1 - progress);
  return { ...robot, queue: [{ ...head, hoursLeft }, ...robot.queue.slice(1)], safe: null };
}

export function safeStatus(robot: RobotState, battery: number): 'returning' | 'docked' | 'stranded' | null {
  const safe = robot.safe;
  if (!safe) return null;
  if (safe.returnLeft <= 0) return 'docked';
  return battery > 0 ? 'returning' : 'stranded';
}
