// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { advance, createGame, dispatch } from '../../src/engine/game';
import { advanceCrew, createCrew, crewAvailableForHelp } from '../../src/engine/crew';
import type { Installation } from '../../src/engine/resources';
import { ICE_HELP_HOURS, ICE_HELP_SPEED, TASK_HOURS, progressRobot, createRobot } from '../../src/engine/robot';

const INST: Installation = { rank: 'explorador', site: 'peak', panels: 2, batteryCapacity: 1000, greenhouse: 'off' };
const CALM = { kp: 0, radiation: false };

function iceQueued() {
  const r = dispatch(createGame({ installation: INST }), { type: 'ENQUEUE_TASK', kind: 'ice' });
  if (!r.ok) throw new Error('fila de gelo recusada');
  return r.state;
}

describe('ajuda ao gelo (D-06)', () => {
  it('a ajuda acelera o gelo 1,5×: a missão inteira cabe em ICE_HELP_HOURS', () => {
    expect(ICE_HELP_SPEED).toBeCloseTo(1.5);
    expect(ICE_HELP_SPEED).toBeCloseTo(TASK_HOURS.ice / ICE_HELP_HOURS);
    const r = progressRobot({ ...createRobot(), queue: [{ kind: 'ice', hoursLeft: TASK_HOURS.ice }] }, ICE_HELP_HOURS, ICE_HELP_SPEED);
    expect(r.completed).toEqual(['ice']);
  });

  it('sem ajuda (velocidade 1), o gelo leva o tempo cheio', () => {
    const r = progressRobot({ ...createRobot(), queue: [{ kind: 'ice', hoursLeft: TASK_HOURS.ice }] }, ICE_HELP_HOURS, 1);
    expect(r.completed).toEqual([]);
    expect(r.robot.queue[0].hoursLeft).toBeCloseTo(TASK_HOURS.ice - ICE_HELP_HOURS);
  });

  it('a ajuda não está disponível na radiação nem enquanto alguém ainda caminha até o abrigo', () => {
    expect(crewAvailableForHelp(createCrew(), false)).toBe(true);
    expect(crewAvailableForHelp(createCrew(), true)).toBe(false);
    const walking = advanceCrew(createCrew(), [true, false], true, 0.5).crew;
    expect(crewAvailableForHelp(walking, false)).toBe(false);
  });

  it('na partida, o gelo termina em ICE_HELP_HOURS com a tripulação livre', () => {
    let g = iceQueued();
    for (let i = 0; i < Math.ceil(ICE_HELP_HOURS); i++) g = advance(g, 1, true, CALM);
    expect(g.robot.queue.length).toBe(0);
    expect(g.vitals.water).toBeGreaterThan(50 - Math.ceil(ICE_HELP_HOURS) * 2);
  });
});
