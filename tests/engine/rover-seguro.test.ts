// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { advance, createGame, dispatch, type GameState } from '../../src/engine/game';
import { CALM } from '../../src/engine/space-weather';
import { TASK_HOURS, TASK_PHASE_HOURS, type TaskKind } from '../../src/engine/robot';
import { distanceFromBase, endSafeMode, isAway, safeStatus, startSafeMode } from '../../src/engine/safe-mode';
import { PHASE_BOUNDS_BY_KIND, missionPhase } from '../../src/engine/mission';
import type { Installation } from '../../src/engine/resources';

const INST: Installation = { rank: 'explorador', site: 'peak', panels: 6, batteryCapacity: 1200, greenhouse: 'off' };
const RAD = { ...CALM, radiation: true };

function withTask(kind: TaskKind, progress: number): GameState {
  const g = createGame({ installation: INST });
  const r = dispatch(g, { type: 'ENQUEUE_TASK', kind });
  if (!r.ok) throw new Error(r.reason);
  const s = r.state;
  return { ...s, robot: { ...s.robot, queue: [{ kind, hoursLeft: TASK_HOURS[kind] * (1 - progress) }] } };
}
function run(s: GameState, hours: number, weather = CALM): GameState {
  let g = s;
  for (let i = 0; i < hours * 20; i++) g = advance(g, 0.05, true, weather);
  return g;
}
const progress = (s: GameState): number => 1 - s.robot.queue[0]!.hoursLeft / TASK_HOURS[s.robot.queue[0]!.kind];

describe('rover em modo seguro', () => {
  it('longe da base (ida ou operação), a radiação faz o rover voltar', () => {
    const g = run(withTask('ice', 0.5), 0.25, RAD);
    expect(g.robot.safe).not.toBeNull();
    expect(safeStatus(g.robot, g.vitals.battery)).toBe('returning');
  });

  it('o tempo de volta é proporcional à distância: operação (longe) leva mais que o início da ida', () => {
    const longe = startSafeMode(withTask('ice', 0.5).robot).safe!;
    const perto = startSafeMode(withTask('ice', 0.1).robot).safe!;
    expect(longe.from).toBe(1);
    expect(perto.from).toBeLessThan(longe.from);
    expect(longe.total).toBeGreaterThan(perto.total);
  });

  it('chega à base, fica esperando e o progresso da tarefa não anda durante o evento', () => {
    const g = run(withTask('ice', 0.5), Math.ceil(TASK_PHASE_HOURS.ice[1]) + 1, RAD);
    expect(safeStatus(g.robot, g.vitals.battery)).toBe('docked');
    const parado = progress(g);
    const g2 = run(g, 3, RAD);
    expect(progress(g2)).toBeCloseTo(parado, 6);
  });

  it('ao fim do evento, recomeça a ida da base e perde o que já tinha andado', () => {
    const antes = withTask('ice', 0.5);
    let g = run(antes, Math.ceil(TASK_PHASE_HOURS.ice[1]) + 1, RAD);
    g = run(g, 0.25, CALM);
    expect(g.robot.safe).toBeNull();
    expect(missionPhase(g.robot.queue[0]!)).toBe('travel');
    expect(progress(g)).toBeLessThan(PHASE_BOUNDS_BY_KIND.ice.travel[0] + 0.05);
    g = run(g, TASK_HOURS.ice + 1, CALM);
    expect(g.robot.queue).toHaveLength(0);
    expect(g.missionsDone.ice).toBe(1);
  });

  it('já na volta para casa, o rover termina o trajeto mesmo com radiação (não entra em modo seguro)', () => {
    const g = run(withTask('ice', 0.8), 0.25, RAD);
    expect(g.robot.safe).toBeNull();
    expect(progress(g)).toBeGreaterThan(0.8);
  });

  it('ainda na preparação (na base), só pausa', () => {
    const g = run(withTask('ice', 0.02), 1, RAD);
    expect(g.robot.safe).toBeNull();
    expect(progress(g)).toBeCloseTo(0.02, 6);
  });

  it('sem bateria o rover não volta: fica preso fora até haver energia', () => {
    const base = withTask('ice', 0.5);
    const flat = { ...base, vitals: { ...base.vitals, battery: 0 } };
    const g = advance(flat, 1, false, RAD);
    expect(safeStatus(g.robot, g.vitals.battery)).toBe('stranded');
    expect(g.robot.safe!.returnLeft).toBeCloseTo(g.robot.safe!.total, 6);
  });

  it('a volta consome energia da base', () => {
    const rad = run(withTask('ice', 0.5), 1, RAD);
    const shelterOnly = run({ ...withTask('ice', 0.02) }, 1, RAD);
    expect(rad.vitals.battery).toBeLessThan(shelterOnly.vitals.battery);
  });

  it('cancelar a tarefa durante o modo seguro limpa o modo', () => {
    let g = run(withTask('ice', 0.5), 0.5, RAD);
    const r = dispatch(g, { type: 'CANCEL_TASK', index: 0 });
    if (!r.ok) throw new Error(r.reason);
    g = run(r.state, 0.25, RAD);
    expect(g.robot.safe).toBeNull();
  });

  it('decidir ficar fora: o rover não entra em modo seguro e segue trabalhando', () => {
    const g0 = withTask('ice', 0.5);
    const o = dispatch(g0, { type: 'SET_CREW_ORDER', order: 'outside' });
    if (!o.ok) throw new Error(o.reason);
    const g = run(o.state, 1, RAD);
    expect(g.robot.safe).toBeNull();
    expect(progress(g)).toBeGreaterThan(0.5);
  });

  it('funções puras: distância e fases', () => {
    expect(distanceFromBase({ kind: 'ice', hoursLeft: TASK_HOURS.ice * 0.5 })).toBe(1);
    expect(isAway({ kind: 'ice', hoursLeft: TASK_HOURS.ice * 0.5 })).toBe(true);
    expect(isAway({ kind: 'ice', hoursLeft: TASK_HOURS.ice * 0.1 })).toBe(false);
    expect(endSafeMode(withTask('ice', 0.5).robot).safe).toBeNull();
  });
});
