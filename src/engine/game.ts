// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Partida: estado, ações do jogador, passagem do tempo e fim. Motor puro.
// Regra dos corações: docs/regras-recursos.md (ajustável).
import { MATCH_HOURS, advanceClock, createClock, type Clock } from './clock';
import { CALM, type SpaceWeatherSample } from './space-weather';
import { endSafeMode, isAway, isHeadingHome, startSafeMode, stepSafeMode } from './safe-mode';
import { advanceCrew, createCrew, crewAvailableForHelp, crewOutside, exposeCrew, type CrewState } from './crew';
import {
  AGENT_TASK_KINDS,
  INSPECT_WEAR_RELIEF,
  MAINTAIN_MIN_WEAR,
  TASK_ENERGY_COST,
  cancelAgentTask,
  createAgents,
  isAvailable,
  isOutside,
  newTask,
  stepAgent,
  type AgentState,
  type AgentTaskKind,
} from './astronaut';
import { CALIBRATION_HOURS, TUNE_HOURS, calibrationFactor, canRecalibrate, canRetune } from './facilities';
import {
  CARE_LEVELS,
  HARVEST_FOOD,
  createCrop,
  harvestCrop,
  stepCrop,
  type Care,
  type CropState,
} from './greenhouse';
import {
  applyFlow,
  deriveFlow,
  startingVitals,
  type GreenhouseMode,
  type Installation,
  type Vitals,
} from './resources';
import {
  ICE_HELP_SPEED,
  ICE_WATER_PER_TRIP,
  cancelTask,
  createRobot,
  enqueueTask,
  isWorking,
  progressRobot,
  rejectTask,
  type RobotState,
  type TaskKind,
} from './robot';

/** Horas seguidas com um recurso vital zerado para perder 1 coração. */
export const HOURS_PER_HEART_LOSS = 6;
export const MAX_HEARTS = 3;

export interface GameState {
  readonly clock: Clock;
  readonly installation: Installation;
  readonly vitals: Vitals;
  readonly robot: RobotState;
  readonly hearts: number;
  /** Horas seguidas com algum recurso vital zerado. */
  readonly vitalZeroHours: number;
  /** Horas já recebidas por advance() e ainda não integradas (fração do passo fixo, DT-02). */
  readonly pendingHours: number;
  /** Tripulação: exposição à radiação (D-05). */
  readonly crew: CrewState;
  /** Cultivo da estufa: crescimento, desgaste e cuidados (D-18). */
  readonly crop: CropState;
  /** Astronautas com tarefas reais (D-18). Índice 0 e 1. */
  readonly agents: readonly AgentState[];
  /** Tarefas de astronauta concluídas, por tipo. */
  readonly agentTasksDone: Readonly<Record<AgentTaskKind, number>>;
  /** Horas restantes da calibração dos painéis e do ajuste da antena (D-19). */
  readonly calibrationLeft: number;
  readonly antennaTuneLeft: number;
  /** Ordem do jogador para a tripulação: automática (trabalha) ou abrigar (fica dentro). */
  readonly crewOrder: CrewOrder;
  /** Missões do robô concluídas, por tipo (capítulos e eventos da LUMA leem daqui). */
  readonly missionsDone: Readonly<Record<TaskKind, number>>;
}

/**
 * auto: trabalha e, com radiação, vai ao abrigo. shelter: fica dentro sempre.
 * outside: decisão de continuar fora durante a radiação, aceitando a exposição; volta a auto quando ela acaba.
 */
export type CrewOrder = 'auto' | 'shelter' | 'outside';

export type GameAction =
  | { readonly type: 'SET_CREW_ORDER'; readonly order: CrewOrder }
  | { readonly type: 'SET_GREENHOUSE'; readonly mode: GreenhouseMode }
  | { readonly type: 'ENQUEUE_TASK'; readonly kind: TaskKind }
  | { readonly type: 'CANCEL_TASK'; readonly index: number }
  | { readonly type: 'ASSIGN_AGENT_TASK'; readonly kind: AgentTaskKind; readonly agent?: number }
  | { readonly type: 'CANCEL_AGENT_TASK'; readonly agent: number }
  | { readonly type: 'SET_GREENHOUSE_CARE'; readonly irrigation?: Care; readonly lighting?: Care };

export type DispatchResult =
  | { readonly ok: true; readonly state: GameState }
  | { readonly ok: false; readonly reason: string };  // código do motivo (ver src/i18n.ts, chaves reason.*)

export type Outcome = 'playing' | 'won' | 'lost';

export interface NewGameOptions {
  readonly installation: Installation;
}

export function createGame(options: NewGameOptions): GameState {
  return {
    clock: createClock(0),
    installation: options.installation,
    vitals: startingVitals(options.installation.batteryCapacity),
    robot: createRobot(),
    hearts: MAX_HEARTS,
    vitalZeroHours: 0,
    pendingHours: 0,
    crew: createCrew(),
    crop: createCrop(),
    agents: createAgents(),
    agentTasksDone: { inspect: 0, harvest: 0, maintain: 0, calibrate: 0, tune: 0 },
    calibrationLeft: 0,
    antennaTuneLeft: 0,
    crewOrder: 'auto',
    missionsDone: { ice: 0, panel: 0, antenna: 0 },
  };
}

export function outcomeOf(state: GameState): Outcome {
  if (state.hearts <= 0) return 'lost';
  if (state.clock.finished) return 'won';
  return 'playing';
}

const GREENHOUSE_MODES: readonly GreenhouseMode[] = ['off', 'always', 'surplus'];
const TASK_KINDS: readonly TaskKind[] = ['ice', 'panel', 'antenna'];

/** Valida e aplica uma ação do jogador. Nunca altera o estado original. */
export function dispatch(state: GameState, action: GameAction): DispatchResult {
  if (outcomeOf(state) !== 'playing') {
    return { ok: false, reason: 'match-over' };
  }
  switch (action.type) {
    case 'SET_CREW_ORDER': {
      if (action.order !== 'auto' && action.order !== 'shelter' && action.order !== 'outside') {
        return { ok: false, reason: 'invalid-mode' };
      }
      return { ok: true, state: { ...state, crewOrder: action.order } };
    }
    case 'SET_GREENHOUSE': {
      if (!GREENHOUSE_MODES.includes(action.mode)) {
        return { ok: false, reason: 'invalid-mode' };
      }
      return {
        ok: true,
        state: { ...state, installation: { ...state.installation, greenhouse: action.mode } },
      };
    }
    case 'ENQUEUE_TASK': {
      if (!TASK_KINDS.includes(action.kind)) {
        return { ok: false, reason: 'unknown-task' };
      }
      const reason = rejectTask(state.robot, action.kind, state.installation.panels);
      if (reason !== null) return { ok: false, reason };
      return { ok: true, state: { ...state, robot: enqueueTask(state.robot, action.kind) } };
    }
    case 'CANCEL_TASK': {
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= state.robot.queue.length) {
        return { ok: false, reason: 'no-task-at-index' };
      }
      return { ok: true, state: { ...state, robot: cancelTask(state.robot, action.index) } };
    }
    case 'ASSIGN_AGENT_TASK': {
      if (!AGENT_TASK_KINDS.includes(action.kind)) return { ok: false, reason: 'unknown-task' };
      if (action.agent !== undefined && (!Number.isInteger(action.agent) || action.agent < 0 || action.agent >= state.agents.length)) {
        return { ok: false, reason: 'no-such-agent' };
      }
      if (state.crewOrder === 'shelter') return { ok: false, reason: 'crew-sheltering' };
      if (action.kind === 'harvest' && state.crop.growth < 100) return { ok: false, reason: 'crop-not-ready' };
      if (action.kind === 'maintain' && state.crop.wear < MAINTAIN_MIN_WEAR) return { ok: false, reason: 'no-wear' };
      if (action.kind === 'calibrate' && !canRecalibrate(state.calibrationLeft)) return { ok: false, reason: 'already-calibrated' };
      if (action.kind === 'tune' && !state.robot.antennaInstalled) return { ok: false, reason: 'no-antenna' };
      if (action.kind === 'tune' && !canRetune(state.antennaTuneLeft)) return { ok: false, reason: 'already-tuned' };
      if (state.agents.some((a) => a.task?.kind === action.kind)) return { ok: false, reason: 'task-in-progress' };
      if (state.vitals.battery < TASK_ENERGY_COST[action.kind]) return { ok: false, reason: 'low-battery' };
      const index = action.agent ?? state.agents.findIndex(isAvailable);
      if (index < 0 || !isAvailable(state.agents[index])) return { ok: false, reason: 'agent-busy' };
      const agents = state.agents.map((a, i) => (i === index ? { ...a, task: newTask(action.kind) } : a));
      const vitals = { ...state.vitals, battery: state.vitals.battery - TASK_ENERGY_COST[action.kind] };
      return { ok: true, state: { ...state, agents, vitals } };
    }
    case 'CANCEL_AGENT_TASK': {
      const agent = state.agents[action.agent];
      if (!Number.isInteger(action.agent) || !agent || !agent.task) return { ok: false, reason: 'no-agent-task' };
      if (agent.task.phase === 'back') return { ok: false, reason: 'already-returning' };
      return { ok: true, state: { ...state, agents: state.agents.map((a, i) => (i === action.agent ? cancelAgentTask(a) : a)) } };
    }
    case 'SET_GREENHOUSE_CARE': {
      const { irrigation, lighting } = action;
      if ((irrigation !== undefined && !CARE_LEVELS.includes(irrigation)) || (lighting !== undefined && !CARE_LEVELS.includes(lighting))) {
        return { ok: false, reason: 'invalid-mode' };
      }
      return { ok: true, state: { ...state, crop: { ...state.crop, irrigation: irrigation ?? state.crop.irrigation, lighting: lighting ?? state.crop.lighting } } };
    }
    default:
      return { ok: false, reason: 'unknown-action' };
  }
}

/**
 * Passa `dtHours` de tempo de jogo. O Sol e o clima espacial vêm do chamador (sunlit, weather).
 * Tempestade reduz a geração dos painéis; radiação para o robô. Para ao fim da partida.
 */
/**
 * Passo interno da simulação, em horas de jogo. Fixo: o resultado não depende de como o tempo
 * é repartido entre chamadas (6 h de uma vez = seis de 1 h = 24 de 0,25 h).
 */
export const SUBSTEP_HOURS = 0.05;
/** Fronteira em que as ações do jogador entram em vigor (decisão de 15/11, DT-02). Múltipla de SUBSTEP_HOURS. */
export const ACTION_HOURS = 0.25;
/** Tolerância para fechar a partida na hora 708 (erro de ponto flutuante). */
const END_SNAP_HOURS = 1e-6;

/** Luz e clima: valor fixo ou função da hora de jogo (usada pelo laço de tela e pelos testes de partida). */
export type SunlitAt = boolean | ((hour: number) => boolean);
export type WeatherAt = SpaceWeatherSample | ((hour: number) => SpaceWeatherSample);

export function advance(state: GameState, dtHours: number, sunlit: SunlitAt, weather: WeatherAt = CALM): GameState {
  if (outcomeOf(state) !== 'playing') return state;
  if (!Number.isFinite(dtHours) || dtHours < 0) {
    throw new RangeError(`horas inválidas: ${dtHours}`);
  }
  const sunAt = typeof sunlit === 'function' ? sunlit : () => sunlit;
  const wxAt = typeof weather === 'function' ? weather : () => weather;
  // Integração sempre em passos fixos de SUBSTEP_HOURS, do início da partida: o tamanho da chamada não muda o resultado (DT-02).
  // O tempo que sobra (menos de um passo) fica em pendingHours e entra na próxima chamada.
  let current = state;
  let total = state.pendingHours + dtHours;
  const EPS = 1e-9;
  while (outcomeOf(current) === 'playing') {
    const toEnd = MATCH_HOURS - current.clock.hour;
    if (total >= SUBSTEP_HOURS - EPS && toEnd >= SUBSTEP_HOURS - EPS) {
      current = advanceStep(current, SUBSTEP_HOURS, sunAt(current.clock.hour), wxAt(current.clock.hour));
      total -= SUBSTEP_HOURS;
    } else if (toEnd > EPS && total >= toEnd - EPS) {
      current = advanceStep(current, toEnd, sunAt(current.clock.hour), wxAt(current.clock.hour));
      total -= toEnd;
    } else {
      break;
    }
  }
  if (current.clock.hour > MATCH_HOURS - END_SNAP_HOURS && current.clock.hour < MATCH_HOURS) {
    current = { ...current, clock: createClock(MATCH_HOURS) };
  }
  return { ...current, pendingHours: outcomeOf(current) === 'playing' ? Math.max(0, total) : 0 };
}

function advanceStep(state: GameState, step: number, sunlit: boolean, weather: SpaceWeatherSample): GameState {

  // Radiação de partículas solares para o robô: ele não trabalha enquanto ela durar.
  // Decisão 'outside': o jogador aceita o risco e a equipe continua fora; senão a radiação abriga a todos.
  const exposed = weather.radiation && state.crewOrder === 'outside';
  const shelterRad = weather.radiation && !exposed;
  // Modo seguro (safe-mode.ts): longe da base, o rover volta; na volta com carga, termina o trajeto; na base, espera.
  let robotNow = state.robot;
  const head = robotNow.queue[0];
  if (shelterRad && head && isAway(head)) robotNow = startSafeMode(robotNow);
  else if (robotNow.safe && (!shelterRad || !head)) robotNow = endSafeMode(robotNow);
  const powered = state.vitals.battery > 0;
  const driving = !!robotNow.safe && robotNow.safe.returnLeft > 0 && powered;
  const working = isWorking(robotNow, state.vitals.battery) && !robotNow.safe && (!shelterRad || (!!head && isHeadingHome(head)));
  const flow = deriveFlow(state.vitals, state.installation, sunlit, working || driving, calibrationFactor(state.calibrationLeft), state.crop);
  const drained = applyFlow(state.vitals, flow, state.installation, step);

  // Com a tripulação livre, o astronauta ajuda na viagem de gelo (D-06).
  // Ajuda só com um astronauta livre (sem tarefa e descansado): quem está ocupado não ajuda (D-06, E05).
  const helpAvailable = state.crewOrder === 'auto' && crewAvailableForHelp(state.crew, shelterRad) && state.agents.some(isAvailable);
  const progress = working
    ? progressRobot(robotNow, step, helpAvailable ? ICE_HELP_SPEED : 1)
    : { robot: stepSafeMode(robotNow, step, powered), completed: [] as readonly TaskKind[] };

  let installation = state.installation;
  let water = drained.water;
  let missionsDone = state.missionsDone;
  for (const kind of progress.completed) {
    missionsDone = { ...missionsDone, [kind]: missionsDone[kind] + 1 };
    if (kind === 'ice') water = Math.min(100, water + ICE_WATER_PER_TRIP);
    if (kind === 'panel') installation = { ...installation, panels: installation.panels + 1 };
  }
  // Astronautas: a tarefa anda no tempo de jogo; radiação ou ordem de abrigo a suspende (eles ficam no abrigo).
  const sheltered = shelterRad || state.crewOrder === 'shelter';
  // Sem água, a cultura não cresce (E04): a estufa só trabalha com água no início do passo.
  let crop = stepCrop(state.crop, step, flow.greenhouseOn && state.vitals.water > 0);
  let agentTasksDone = state.agentTasksDone;
  let calibrationLeft = Math.max(0, state.calibrationLeft - step);
  let antennaTuneLeft = Math.max(0, state.antennaTuneLeft - step);
  let foodGain = 0;
  const agents = state.agents.map((agent) => {
    const r = stepAgent(agent, step, sheltered);
    if (r.completed) {
      agentTasksDone = { ...agentTasksDone, [r.completed]: agentTasksDone[r.completed] + 1 };
      if (r.completed === 'harvest' && crop.growth >= 100) {
        crop = harvestCrop(crop);
        foodGain += HARVEST_FOOD;
      }
      if (r.completed === 'maintain') crop = { ...crop, wear: 0 };
      if (r.completed === 'calibrate') calibrationLeft = CALIBRATION_HOURS;
      if (r.completed === 'tune') antennaTuneLeft = TUNE_HOURS;
      if (r.completed === 'inspect') crop = { ...crop, wear: Math.max(0, crop.wear - INSPECT_WEAR_RELIEF) };
    }
    return r.agent;
  });
  const vitals: Vitals = { ...drained, water, food: Math.min(100, drained.food + foodGain) };

  const anyVitalZero = vitals.battery <= 0 || vitals.air <= 0 || vitals.water <= 0 || vitals.food <= 0;
  // Arredondado a 1e-9 h: somas de passos de 0,05 h não podem deixar o limite de 6 h um passo atrasado.
  let vitalZeroHours = anyVitalZero ? Math.round((state.vitalZeroHours + step) * 1e9) / 1e9 : 0;
  let hearts = state.hearts;
  while (vitalZeroHours >= HOURS_PER_HEART_LOSS && hearts > 0) {
    hearts -= 1;
    vitalZeroHours -= HOURS_PER_HEART_LOSS;
  }

  // Tripulação: quem está fora quando a radiação começa leva 1 hora para entrar; cada 12 h de exposição tira 1 coração.
  const outsideNow = crewOutside(state.installation, state.vitals, state.robot, state.crewOrder).map((out, i) => out || (state.agents[i] ? isOutside(state.agents[i]) : false));
  const crewStep = exposed ? exposeCrew(state.crew, outsideNow, step) : advanceCrew(state.crew, outsideNow, weather.radiation, step);
  hearts = Math.max(0, hearts - crewStep.heartsLost);

  return {
    clock: advanceClock(state.clock, step),
    installation,
    vitals,
    robot: progress.robot,
    hearts,
    vitalZeroHours,
    pendingHours: state.pendingHours,
    crew: crewStep.crew,
    crop,
    agents,
    agentTasksDone,
    calibrationLeft,
    antennaTuneLeft,
    // A decisão de ficar fora vale só durante o evento.
    crewOrder: state.crewOrder === 'outside' && !weather.radiation ? 'auto' : state.crewOrder,
    missionsDone,
  };
}
