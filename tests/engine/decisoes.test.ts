// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { TASK_HOURS } from '../../src/engine/robot';
import { describe, expect, it } from 'vitest';
import { advance, createGame, dispatch, type GameState } from '../../src/engine/game';
import { EXPOSURE_HOURS_PER_HEART, crewSheltered, exposeCrew, createCrew } from '../../src/engine/crew';
import { CALM } from '../../src/engine/space-weather';
import type { Installation } from '../../src/engine/resources';

const INST: Installation = { rank: 'explorador', site: 'peak', panels: 6, batteryCapacity: 1200, greenhouse: 'always' };
const RAD = { ...CALM, radiation: true };

function game(): GameState {
  return createGame({ installation: INST });
}
function run(s: GameState, hours: number, weather = RAD): GameState {
  let g = s;
  for (let i = 0; i < hours * 4; i++) g = advance(g, 0.25, true, weather);
  return g;
}
function order(s: GameState, o: 'auto' | 'shelter' | 'outside'): GameState {
  const r = dispatch(s, { type: 'SET_CREW_ORDER', order: o });
  if (!r.ok) throw new Error(r.reason);
  return r.state;
}

describe('decisão de continuar fora (risco explícito)', () => {
  it('a ordem "outside" é aceita e uma ordem inválida continua recusada', () => {
    expect(order(game(), 'outside').crewOrder).toBe('outside');
    expect(dispatch(game(), { type: 'SET_CREW_ORDER', order: 'x' as never }).ok).toBe(false);
  });

  it('padrão (auto): a radiação abriga, a exposição para depois do caminho de 1 h', () => {
    const g = run(game(), 6);
    expect(g.crew.exposureHours).toBeLessThanOrEqual(2);
  });

  it('continuar fora: a exposição cresce 1 h por pessoa fora, por hora', () => {
    const g0 = order(game(), 'outside');
    const out = exposeCrew(createCrew(), [true, true], 3);
    expect(out.crew.exposureHours).toBe(6);
    const g = run(g0, 4);
    expect(g.crew.exposureHours).toBeGreaterThan(2);
  });

  it('continuar fora custa 1 coração a cada 12 h de exposição somada', () => {
    const r = exposeCrew(createCrew(), [true, true], EXPOSURE_HOURS_PER_HEART / 2);
    expect(r.heartsLost).toBe(1);
    const again = exposeCrew(r.crew, [true, true], 1);
    expect(again.heartsLost).toBe(0);
  });

  it('quem está dentro não se expõe, mesmo com a decisão de ficar fora', () => {
    expect(exposeCrew(createCrew(), [false, false], 5).crew.exposureHours).toBe(0);
  });

  it('o robô continua trabalhando se o jogador decide ficar fora; no abrigo ele para', () => {
    const queued = (s: GameState): GameState => {
      const r = dispatch(s, { type: 'ENQUEUE_TASK', kind: 'ice' });
      if (!r.ok) throw new Error(r.reason);
      return r.state;
    };
    const fora = run(queued(order(game(), 'outside')), 2);
    const abrigo = run(queued(game()), 2);
    expect(abrigo.robot.queue[0]!.hoursLeft).toBe(TASK_HOURS.ice);
    expect(fora.robot.queue[0]!.hoursLeft).toBeLessThan(TASK_HOURS.ice);
  });

  it('a decisão vale só durante o evento: quando a radiação acaba, volta a auto', () => {
    const g = run(order(game(), 'outside'), 1, CALM);
    expect(g.crewOrder).toBe('auto');
  });

  it('voltar a abrigar no meio do evento: quem estava fora leva 1 h de caminho de novo', () => {
    let g = run(order(game(), 'outside'), 3);
    expect(crewSheltered(g.crew, g.crewOrder)).toBe(false);
    const antes = g.crew.exposureHours;
    g = run(order(g, 'auto'), 3);
    expect(g.crew.exposureHours - antes).toBeLessThanOrEqual(2 + 1e-9);
    expect(crewSheltered(g.crew, g.crewOrder)).toBe(true);
  });

  it('exposição prolongada fora pode derrubar a partida, e o estado nunca fica inconsistente', () => {
    const g = run(order(game(), 'outside'), 24);
    expect(g.hearts).toBeLessThan(3);
    expect(g.hearts).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(g.crew.exposureHours)).toBe(true);
  });
});
