// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Partida: estado, ações do jogador, passagem do tempo e fim. Motor puro.
// Regra dos corações: docs/regras-recursos.md (ajustável).
import { MATCH_HOURS, advanceClock, createClock, type Clock } from './clock';
import { CALM, solarFactor, stormLevel, type SpaceWeatherSample } from './space-weather';
import {
  applyFlow,
  deriveFlow,
  startingVitals,
  type GreenhouseMode,
  type Installation,
  type Vitals,
} from './resources';
import {
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
}

export type GameAction =
  | { readonly type: 'SET_GREENHOUSE'; readonly mode: GreenhouseMode }
  | { readonly type: 'ENQUEUE_TASK'; readonly kind: TaskKind }
  | { readonly type: 'CANCEL_TASK'; readonly index: number };

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
    default:
      return { ok: false, reason: 'unknown-action' };
  }
}

/**
 * Passa `dtHours` de tempo de jogo. O Sol e o clima espacial vêm do chamador (sunlit, weather).
 * Tempestade reduz a geração dos painéis; radiação para o robô. Para ao fim da partida.
 */
export function advance(state: GameState, dtHours: number, sunlit: boolean, weather: SpaceWeatherSample = CALM): GameState {
  if (outcomeOf(state) !== 'playing') return state;
  if (!Number.isFinite(dtHours) || dtHours < 0) {
    throw new RangeError(`horas inválidas: ${dtHours}`);
  }
  const remaining = MATCH_HOURS - state.clock.hour;
  const step = Math.min(dtHours, remaining);
  if (step <= 0) return state;

  // Radiação de partículas solares para o robô: ele não trabalha enquanto ela durar.
  const working = isWorking(state.robot, state.vitals.battery) && !weather.radiation;
  const flow = deriveFlow(state.vitals, state.installation, sunlit, working, solarFactor(stormLevel(weather.kp)));
  const drained = applyFlow(state.vitals, flow, state.installation, step);

  const progress = working
    ? progressRobot(state.robot, step)
    : { robot: state.robot, completed: [] as readonly TaskKind[] };

  let installation = state.installation;
  let water = drained.water;
  for (const kind of progress.completed) {
    if (kind === 'ice') water = Math.min(100, water + ICE_WATER_PER_TRIP);
    if (kind === 'panel') installation = { ...installation, panels: installation.panels + 1 };
  }
  const vitals: Vitals = { ...drained, water };

  const anyVitalZero = vitals.battery <= 0 || vitals.air <= 0 || vitals.water <= 0 || vitals.food <= 0;
  let vitalZeroHours = anyVitalZero ? state.vitalZeroHours + step : 0;
  let hearts = state.hearts;
  while (vitalZeroHours >= HOURS_PER_HEART_LOSS && hearts > 0) {
    hearts -= 1;
    vitalZeroHours -= HOURS_PER_HEART_LOSS;
  }

  return {
    clock: advanceClock(state.clock, step),
    installation,
    vitals,
    robot: progress.robot,
    hearts,
    vitalZeroHours,
  };
}
