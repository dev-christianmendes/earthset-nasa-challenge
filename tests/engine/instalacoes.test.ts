// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { PREP_HOURS, TASK_ENERGY_COST, TRAVEL_HOURS_BY_KIND, WORK_HOURS, type AgentTaskKind } from '../../src/engine/astronaut';
import {
  CALIBRATION_BONUS,
  CALIBRATION_HOURS,
  TUNE_HOURS,
  WARNING_AHEAD_BASE,
  WARNING_AHEAD_TUNED,
  calibrationFactor,
  warningAhead,
} from '../../src/engine/facilities';
import { advance, createGame, dispatch, type GameAction, type GameState } from '../../src/engine/game';
import type { Installation } from '../../src/engine/resources';

const CALM = { kp: 0, radiation: false };
const STORM = { kp: 0, radiation: true };
const INST: Installation = { rank: 'explorador', site: 'peak', panels: 6, batteryCapacity: 1200, greenhouse: 'off' };
const total = (kind: AgentTaskKind): number => PREP_HOURS + TRAVEL_HOURS_BY_KIND[kind] + WORK_HOURS[kind] + TRAVEL_HOURS_BY_KIND[kind];

const fresh = (): GameState => createGame({ installation: INST });
function ok(s: GameState, a: GameAction): GameState {
  const r = dispatch(s, a);
  if (!r.ok) throw new Error(`ação recusada: ${r.reason}`);
  return r.state;
}
const reason = (s: GameState, a: GameAction): string => {
  const r = dispatch(s, a);
  if (r.ok) throw new Error('ação aceita');
  return r.reason;
};
const withAntenna = (s: GameState): GameState => ({ ...s, robot: { ...s.robot, antennaInstalled: true } });
const calibrated = (): GameState => advance(ok(fresh(), { type: 'ASSIGN_AGENT_TASK', kind: 'calibrate' }), total('calibrate') + 0.01, true, CALM);

describe('regras puras', () => {
  it('a calibração soma até 12% e decai linearmente até zero', () => {
    expect(calibrationFactor(CALIBRATION_HOURS)).toBeCloseTo(1 + CALIBRATION_BONUS, 6);
    expect(calibrationFactor(CALIBRATION_HOURS / 2)).toBeCloseTo(1 + CALIBRATION_BONUS / 2, 6);
    expect(calibrationFactor(0)).toBe(1);
    expect(calibrationFactor(-5)).toBe(1);
  });

  it('o aviso de tempestade sobe de 6 para 12 h com a antena ajustada', () => {
    expect(warningAhead(0)).toBe(WARNING_AHEAD_BASE);
    expect(warningAhead(10)).toBe(WARNING_AHEAD_TUNED);
  });

  it('o campo solar é o destino mais longe', () => {
    expect(TRAVEL_HOURS_BY_KIND.calibrate).toBeGreaterThan(TRAVEL_HOURS_BY_KIND.tune);
    expect(TRAVEL_HOURS_BY_KIND.tune).toBeGreaterThan(TRAVEL_HOURS_BY_KIND.harvest);
  });
});

describe('calibrar painéis', () => {
  it('cobra energia na hora e o efeito vale ao fim do trabalho, antes da volta', () => {
    const s0 = fresh();
    let s = ok(s0, { type: 'ASSIGN_AGENT_TASK', kind: 'calibrate' });
    expect(s.vitals.battery).toBe(s0.vitals.battery - TASK_ENERGY_COST.calibrate);
    const atWorkEnd = PREP_HOURS + TRAVEL_HOURS_BY_KIND.calibrate + WORK_HOURS.calibrate;
    s = advance(s, atWorkEnd - 1, true, CALM);
    expect(s.agentTasksDone.calibrate).toBe(0);
    s = advance(s, 1.5, true, CALM);
    expect(s.agentTasksDone.calibrate).toBe(1);
    expect(s.calibrationLeft).toBeGreaterThan(CALIBRATION_HOURS - 5);
  });

  it('aumenta a geração: a bateria sobe mais com o Sol', () => {
    const a = advance(calibrated(), 10, true, CALM);
    const control = advance(advance(fresh(), total('calibrate') + 0.01, true, CALM), 10, true, CALM);
    const gainA = a.vitals.battery - calibrated().vitals.battery;
    const gainControl = control.vitals.battery - advance(fresh(), total('calibrate') + 0.01, true, CALM).vitals.battery;
    expect(gainA).toBeGreaterThan(gainControl);
  });

  it('sem Sol, a calibração não rende e continua decaindo', () => {
    const s = calibrated();
    const night = advance(s, 20, false, CALM);
    expect(night.calibrationLeft).toBeCloseTo(s.calibrationLeft - 20, 6);
  });

  it('o efeito acaba depois de CALIBRATION_HOURS', () => {
    const s = advance(calibrated(), CALIBRATION_HOURS + 1, true, CALM);
    expect(s.calibrationLeft).toBe(0);
  });

  it('só se repete quando o efeito caiu abaixo da metade', () => {
    const s = calibrated();
    expect(reason(s, { type: 'ASSIGN_AGENT_TASK', kind: 'calibrate' })).toBe('already-calibrated');
    const later = advance(s, CALIBRATION_HOURS * 0.6, true, CALM);
    expect(dispatch(later, { type: 'ASSIGN_AGENT_TASK', kind: 'calibrate' }).ok).toBe(true);
  });

  it('com pouca bateria, é recusada', () => {
    const s = fresh();
    const weak = { ...s, vitals: { ...s.vitals, battery: TASK_ENERGY_COST.calibrate - 1 } };
    expect(reason(weak, { type: 'ASSIGN_AGENT_TASK', kind: 'calibrate' })).toBe('low-battery');
  });

  it('cancelada no caminho, não calibra', () => {
    let s = ok(fresh(), { type: 'ASSIGN_AGENT_TASK', kind: 'calibrate' });
    s = advance(s, PREP_HOURS + 3, true, CALM);
    s = ok(s, { type: 'CANCEL_AGENT_TASK', agent: 0 });
    s = advance(s, 30, true, CALM);
    expect(s.agentTasksDone.calibrate).toBe(0);
    expect(s.calibrationLeft).toBe(0);
  });

  it('a radiação suspende a viagem', () => {
    let s = ok(fresh(), { type: 'ASSIGN_AGENT_TASK', kind: 'calibrate' });
    s = advance(s, 3, true, CALM);
    const left = s.agents[0].task?.hoursLeft;
    s = advance(s, 5, true, STORM);
    expect(s.agents[0].task?.hoursLeft).toBe(left);
  });
});

describe('ajustar a antena', () => {
  it('sem antena instalada, é recusada', () => {
    expect(reason(fresh(), { type: 'ASSIGN_AGENT_TASK', kind: 'tune' })).toBe('no-antenna');
  });

  it('com antena, conclui e estende o aviso por TUNE_HOURS', () => {
    let s = ok(withAntenna(fresh()), { type: 'ASSIGN_AGENT_TASK', kind: 'tune' });
    expect(s.vitals.battery).toBeLessThan(withAntenna(fresh()).vitals.battery);
    s = advance(s, total('tune') + 0.01, true, CALM);
    expect(s.agentTasksDone.tune).toBe(1);
    expect(warningAhead(s.antennaTuneLeft)).toBe(WARNING_AHEAD_TUNED);
    // Repõe os recursos a cada hora: a base passiva perderia antes do fim do ajuste.
    for (let h = 0; h < TUNE_HOURS + 1; h++) {
      s = advance(s, 1, true, CALM);
      s = { ...s, vitals: { ...s.vitals, air: 100, water: 100, food: 100, battery: s.installation.batteryCapacity } };
    }
    expect(warningAhead(s.antennaTuneLeft)).toBe(WARNING_AHEAD_BASE);
  });

  it('só se repete depois de metade do efeito', () => {
    const s = advance(ok(withAntenna(fresh()), { type: 'ASSIGN_AGENT_TASK', kind: 'tune' }), total('tune') + 0.01, true, CALM);
    expect(reason(s, { type: 'ASSIGN_AGENT_TASK', kind: 'tune' })).toBe('already-tuned');
  });

  it('as duas tarefas podem andar juntas, cada uma com um astronauta', () => {
    let s = ok(withAntenna(fresh()), { type: 'ASSIGN_AGENT_TASK', kind: 'calibrate' });
    s = ok(s, { type: 'ASSIGN_AGENT_TASK', kind: 'tune' });
    expect(s.agents[0].task?.kind).toBe('calibrate');
    expect(s.agents[1].task?.kind).toBe('tune');
    expect(reason(s, { type: 'ASSIGN_AGENT_TASK', kind: 'inspect' })).toBe('agent-busy');
  });
});

describe('equilíbrio', () => {
  it('sem ordens, o estado novo não muda nada em relação ao anterior', () => {
    const s = advance(fresh(), 10, true, CALM);
    expect(s.calibrationLeft).toBe(0);
    expect(s.antennaTuneLeft).toBe(0);
  });
});
