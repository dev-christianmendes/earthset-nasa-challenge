// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { createGame, advance } from '../../src/engine/game';
import type { Installation } from '../../src/engine/resources';
import { dispatch } from '../../src/engine/game';
import { CALM, radiationHoursLeft, weatherAt, type SpaceWeatherTable } from '../../src/engine/space-weather';

const INSTALLATION: Installation = {
  rank: 'explorador',
  site: 'peak',
  panels: 4,
  batteryCapacity: 1200,
  greenhouse: 'off',
};

describe('clima espacial (C2 e C3)', () => {
  it('weatherAt devolve a hora certa e recusa hora negativa', () => {
    const table: SpaceWeatherTable = {
      start_utc: '2024-10-09 00:00',
      step_hours: 1,
      hours: 2,
      samples: [CALM, { kp: 9, radiation: true }, CALM],
    };
    expect(weatherAt(table, 1.5)).toEqual({ kp: 9, radiation: true });
    expect(weatherAt(table, 99)).toEqual(CALM);
    expect(() => weatherAt(table, -1)).toThrow(RangeError);
  });

  it('o Kp da Terra não muda nada na simulação (só a radiação conta)', () => {
    const base = createGame({ installation: INSTALLATION });
    const calm = advance(base, 6, true, CALM);
    const kpAlto = advance(base, 6, true, { kp: 9, radiation: false });
    expect(kpAlto.vitals).toEqual(calm.vitals);
    expect(kpAlto.hearts).toBe(calm.hearts);
  });

  it('radiação para o robô: com fila e bateria, ele não avança a tarefa', () => {
    let game = createGame({ installation: INSTALLATION });
    const queued = dispatch(game, { type: 'ENQUEUE_TASK', kind: 'ice' });
    expect(queued.ok).toBe(true);
    if (!queued.ok) return;
    game = queued.state;
    const hours0 = game.robot.queue[0].hoursLeft;
    const afterRadiation = advance(game, 2, true, { kp: 0, radiation: true });
    expect(afterRadiation.robot.queue[0].hoursLeft).toBe(hours0);
    const afterCalm = advance(game, 2, true, CALM);
    expect(afterCalm.robot.queue[0].hoursLeft).toBeLessThan(hours0);
  });
});

describe('radiationHoursLeft', () => {
  const table: SpaceWeatherTable = {
    start_utc: '2024-10-09T00:00:00Z',
    step_hours: 1,
    hours: 6,
    samples: [true, true, true, false, true, true].map((radiation) => ({ kp: 0, radiation })),
  };

  it('sem radiação, nada a esperar', () => {
    expect(radiationHoursLeft(table, 3.5)).toBe(0);
  });

  it('conta as horas até a radiação passar, a partir do meio de uma hora', () => {
    expect(radiationHoursLeft(table, 0)).toBe(3);
    expect(radiationHoursLeft(table, 1.25)).toBeCloseTo(1.75, 9);
  });

  it('no fim da tabela, para no último ponto', () => {
    expect(radiationHoursLeft(table, 4.5)).toBeCloseTo(1.5, 9);
  });
});
