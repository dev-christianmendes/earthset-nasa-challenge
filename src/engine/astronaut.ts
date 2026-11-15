// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Astronautas com tarefas reais (D-18, docs/DECISOES.md). Motor puro, determinístico.
// Cada astronauta é uma máquina de estados pequena: o estado exibido deriva da fase da tarefa.
//   idle → assigned (preparo) → walking → working → returning → resting → idle
//   sheltering: radiação ou ordem de abrigo; a tarefa fica suspensa e retoma depois.
// Todas as durações são horas de JOGO: a animação deriva do progresso e acompanha pausa e velocidade.

export const AGENT_COUNT = 2;

export type AgentTaskKind = 'inspect' | 'harvest' | 'maintain' | 'calibrate' | 'tune';
export const AGENT_TASK_KINDS: readonly AgentTaskKind[] = ['inspect', 'harvest', 'maintain', 'calibrate', 'tune'];
/** Tarefas feitas na estufa (o painel da estufa só oferece estas). */
export const GREENHOUSE_TASKS: readonly AgentTaskKind[] = ['inspect', 'harvest', 'maintain'];

export type AgentPhase = 'prep' | 'out' | 'work' | 'back';
export type AgentStatus = 'idle' | 'assigned' | 'walking' | 'working' | 'returning' | 'resting' | 'sheltering';

export interface AgentTask {
  readonly kind: AgentTaskKind;
  readonly phase: AgentPhase;
  /** Horas de jogo que faltam para terminar a fase atual. */
  readonly hoursLeft: number;
}

export interface AgentState {
  readonly task: AgentTask | null;
  /** Horas de descanso que faltam depois de uma tarefa. */
  readonly restLeft: number;
}

/** Horas de jogo (ilustrativas; equilíbrio, não dado científico). */
export const PREP_HOURS = 0.25;
/** Cada trecho de ida ou volta até a estufa: 1 h de jogo (1 s a 1×), para a tarefa começar de imediato (pedido do autor, 15/11). */
export const TRAVEL_HOURS = 1;
/** Trecho de ida ou volta por tarefa: proporcional ao caminho até o destino (campo solar é o mais longe). */
export const TRAVEL_HOURS_BY_KIND: Record<AgentTaskKind, number> = { inspect: 1, harvest: 1, maintain: 1, calibrate: 2, tune: 1.5 };
export const REST_HOURS = 1;
export const WORK_HOURS: Record<AgentTaskKind, number> = { inspect: 2, harvest: 3, maintain: 5, calibrate: 4, tune: 3 };
/** Custo imediato de energia (unidades da bateria) ao ordenar a tarefa. */
export const TASK_ENERGY_COST: Record<AgentTaskKind, number> = { inspect: 0, harvest: 0, maintain: 15, calibrate: 10, tune: 5 };
/** Desgaste removido ao concluir (inspeção) ou zerado (manutenção). */
export const INSPECT_WEAR_RELIEF = 20;
/** Só vale a manutenção a partir deste desgaste. */
export const MAINTAIN_MIN_WEAR = 10;

const PHASE_ORDER: readonly AgentPhase[] = ['prep', 'out', 'work', 'back'];

export function createAgents(): readonly AgentState[] {
  return Array.from({ length: AGENT_COUNT }, () => ({ task: null, restLeft: 0 }));
}

function phaseHours(kind: AgentTaskKind, phase: AgentPhase): number {
  if (phase === 'prep') return PREP_HOURS;
  if (phase === 'work') return WORK_HOURS[kind];
  return TRAVEL_HOURS_BY_KIND[kind];
}

export function newTask(kind: AgentTaskKind): AgentTask {
  return { kind, phase: 'prep', hoursLeft: PREP_HOURS };
}

/** Disponível para uma ordem: sem tarefa e já descansado. */
export function isAvailable(agent: AgentState): boolean {
  return agent.task === null && agent.restLeft <= 0;
}

/** Fora do habitat (exposto à radiação): da saída até a volta. */
export function isOutside(agent: AgentState): boolean {
  return agent.task !== null && agent.task.phase !== 'prep';
}

export function agentStatus(agent: AgentState, sheltered: boolean): AgentStatus {
  if (sheltered) return 'sheltering';
  const task = agent.task;
  if (!task) return agent.restLeft > 0 ? 'resting' : 'idle';
  switch (task.phase) {
    case 'prep': return 'assigned';
    case 'out': return 'walking';
    case 'work': return 'working';
    default: return 'returning';
  }
}

/** Fração concluída da fase atual (0 a 1), para animar o trajeto e o trabalho. */
export function phaseFraction(task: AgentTask): number {
  const total = phaseHours(task.kind, task.phase);
  return Math.min(1, Math.max(0, 1 - task.hoursLeft / total));
}

/** Fração concluída da tarefa inteira (0 a 1), para a barra de progresso. */
export function taskFraction(task: AgentTask): number {
  let done = 0;
  let total = 0;
  for (const phase of PHASE_ORDER) {
    const h = phaseHours(task.kind, phase);
    total += h;
    const idx = PHASE_ORDER.indexOf(phase);
    const cur = PHASE_ORDER.indexOf(task.phase);
    if (idx < cur) done += h;
    else if (idx === cur) done += h - task.hoursLeft;
  }
  return Math.min(1, Math.max(0, done / total));
}

/** Cancela: antes de sair a tarefa some; fora, o astronauta volta pelo caminho já andado (sem efeito). */
export function cancelAgentTask(agent: AgentState): AgentState {
  const task = agent.task;
  if (!task || task.phase === 'back') return agent;
  if (task.phase === 'prep') return { ...agent, task: null };
  const trip = TRAVEL_HOURS_BY_KIND[task.kind];
  const walked = task.phase === 'out' ? trip - task.hoursLeft : trip;
  return { ...agent, task: { kind: task.kind, phase: 'back', hoursLeft: Math.max(0, walked) } };
}

export interface AgentStep {
  readonly agent: AgentState;
  /** Tarefa cujo trabalho terminou neste passo (o efeito vale uma vez, ao fim da fase `work`). */
  readonly completed: AgentTaskKind | null;
}

/** Avança um astronauta `hours` horas de jogo. Suspenso (abrigo): a tarefa não anda; o descanso também não. */
export function stepAgent(agent: AgentState, hours: number, sheltered: boolean): AgentStep {
  if (sheltered || hours <= 0) return { agent, completed: null };
  let left = hours;
  let { task, restLeft } = agent;
  let completed: AgentTaskKind | null = null;
  while (left > 1e-12 && task) {
    const used = Math.min(left, task.hoursLeft);
    left -= used;
    const remaining = task.hoursLeft - used;
    if (remaining > 1e-12) {
      task = { ...task, hoursLeft: remaining };
      break;
    }
    if (task.phase === 'work') completed = task.kind;
    const next = PHASE_ORDER[PHASE_ORDER.indexOf(task.phase) + 1];
    if (next) {
      task = { kind: task.kind, phase: next, hoursLeft: phaseHours(task.kind, next) };
    } else {
      task = null;
      restLeft = REST_HOURS;
    }
  }
  if (!task && left > 0) restLeft = Math.max(0, restLeft - left);
  return { agent: { task, restLeft }, completed };
}
