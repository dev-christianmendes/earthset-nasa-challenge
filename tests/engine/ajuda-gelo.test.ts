// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// D-06: com a tripulação livre, a tarefa de gelo dura 4 h em vez de 6 h.
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
  it('a ajuda acelera o gelo: 6 h de trabalho em 4 h de jogo', () => {
    expect(ICE_HELP_HOURS).toBe(4);
    expect(ICE_HELP_SPEED).toBeCloseTo(TASK_HOURS.ice / ICE_HELP_HOURS);
    const r = progressRobot({ ...createRobot(), queue: [{ kind: 'ice', hoursLeft: TASK_HOURS.ice }] }, 4, ICE_HELP_SPEED);
    expect(r.completed).toEqual(['ice']);
  });

  it('sem ajuda (velocidade 1), o gelo ainda leva 6 h', () => {
    const r = progressRobot({ ...createRobot(), queue: [{ kind: 'ice', hoursLeft: TASK_HOURS.ice }] }, 4, 1);
    expect(r.completed).toEqual([]);
    expect(r.robot.queue[0].hoursLeft).toBeCloseTo(2);
  });

  it('a ajuda não está disponível na radiação nem enquanto alguém ainda caminha até o abrigo', () => {
    expect(crewAvailableForHelp(createCrew(), false)).toBe(true);
    expect(crewAvailableForHelp(createCrew(), true)).toBe(false);
    const walking = advanceCrew(createCrew(), [true, false], true, 0.5).crew;
    expect(crewAvailableForHelp(walking, false)).toBe(false);
  });

  it('na partida, o gelo termina em 4 h com a tripulação livre', () => {
    let g = iceQueued();
    for (let i = 0; i < 4; i++) g = advance(g, 1, true, CALM);
    expect(g.robot.queue.length).toBe(0);
    expect(g.vitals.water).toBeGreaterThan(50 - 4 * 2);
  });
});
