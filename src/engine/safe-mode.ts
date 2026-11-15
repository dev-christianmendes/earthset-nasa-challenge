// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Modo seguro do rover (V5.P3, seção 3.7): com radiação, o rover que está longe da base volta para ela,
// espera o fim do evento e recomeça a ida. Regras de jogo (não vêm da DONKI). Motor puro.
import { PHASE_BOUNDS, missionPhase, taskProgress } from './mission';
import { TASK_HOURS, type RobotState, type RobotTask } from './robot';

/** Fração do tempo da tarefa gasta em cada trecho de ida (e de volta): ver PHASE_BOUNDS. */
const LEG = PHASE_BOUNDS.travel[1] - PHASE_BOUNDS.travel[0];

export interface SafeMode {
  /** Distância da base quando o modo seguro começou (0 = na base, 1 = no local da tarefa). */
  readonly from: number;
  /** Horas totais da volta, na mesma velocidade da ida. */
  readonly total: number;
  /** Horas que faltam para chegar à base (0 = já está no abrigo da garagem). */
  readonly returnLeft: number;
}

/** Distância atual da base (0 a 1) pelo progresso da tarefa. */
export function distanceFromBase(task: RobotTask): number {
  const p = taskProgress(task);
  switch (missionPhase(task)) {
    case 'travel':
      return Math.min(1, Math.max(0, (p - PHASE_BOUNDS.travel[0]) / LEG));
    case 'operate':
      return 1;
    case 'return':
      return Math.min(1, Math.max(0, 1 - (p - PHASE_BOUNDS.return[0]) / LEG));
    default:
      return 0;
  }
}

/** Longe da base e a caminho do local (ida ou operação): é aqui que a radiação exige voltar. */
export function isAway(task: RobotTask): boolean {
  const phase = missionPhase(task);
  return phase === 'travel' || phase === 'operate';
}

/** Na volta para casa (com carga) o rover já está indo à base: termina o trajeto mesmo com radiação. */
export function isHeadingHome(task: RobotTask): boolean {
  const phase = missionPhase(task);
  return phase === 'return' || phase === 'deliver';
}

export function startSafeMode(robot: RobotState): RobotState {
  const head = robot.queue[0];
  if (!head || robot.safe) return robot;
  const from = distanceFromBase(head);
  const total = from * LEG * TASK_HOURS[head.kind];
  return { ...robot, safe: { from, total, returnLeft: total } };
}

/** Distância atual da base durante o modo seguro. */
export function safeDistance(safe: SafeMode): number {
  return safe.total > 0 ? safe.from * (safe.returnLeft / safe.total) : 0;
}

/** Dirige de volta por `hours`. Sem energia (`canDrive` falso) o rover fica parado onde está. */
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
  const progress = PHASE_BOUNDS.travel[0] + 0.0001 + d * LEG;
  const hoursLeft = TASK_HOURS[head.kind] * (1 - progress);
  return { ...robot, queue: [{ ...head, hoursLeft }, ...robot.queue.slice(1)], safe: null };
}

/** Estado do modo seguro para a tela: voltando, na base, ou nenhum. */
export function safeStatus(robot: RobotState, battery: number): 'returning' | 'docked' | 'stranded' | null {
  const safe = robot.safe;
  if (!safe) return null;
  if (safe.returnLeft <= 0) return 'docked';
  return battery > 0 ? 'returning' : 'stranded';
}
