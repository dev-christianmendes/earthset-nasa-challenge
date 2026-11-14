// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { createGame, advance } from '../../src/engine/game';
import { deriveFlow, PANEL_OUTPUT_PER_HOUR, type Installation } from '../../src/engine/resources';
import { dispatch } from '../../src/engine/game';
import { CALM, hoursUntilStorm, solarFactor, stormLevel, weatherAt, type SpaceWeatherTable } from '../../src/engine/space-weather';

const INSTALLATION: Installation = {
  rank: 'explorador',
  site: 'peak',
  panels: 4,
  batteryCapacity: 1200,
  greenhouse: 'off',
};

describe('clima espacial (C2 e C3)', () => {
  it('nível G: Kp abaixo de 5 é calmo; Kp 5 é G1; Kp 9 é G5', () => {
    expect(stormLevel(4.9)).toBe(0);
    expect(stormLevel(5)).toBe(1);
    expect(stormLevel(8.67)).toBe(4);
    expect(stormLevel(9)).toBe(5);
  });

  it('recusa Kp não finito', () => {
    expect(() => stormLevel(Number.NaN)).toThrow(RangeError);
  });

  it('a geração cai 10% por nível G, e fica em 50% com G5', () => {
    expect(solarFactor(0)).toBe(1);
    expect(solarFactor(5)).toBeCloseTo(0.5);
  });

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

  it('tempestade G5 corta a geração dos painéis à metade', () => {
    const calm = deriveFlow({ battery: 500, air: 80, water: 50, food: 40 }, INSTALLATION, true, false, 1);
    const storm = deriveFlow({ battery: 500, air: 80, water: 50, food: 40 }, INSTALLATION, true, false, solarFactor(5));
    expect(calm.energy - storm.energy).toBeCloseTo((4 * PANEL_OUTPUT_PER_HOUR) / 2);
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

describe('aviso antecipado da antena (D-01)', () => {
  const table: SpaceWeatherTable = {
    start_utc: '2024-10-09 09:00',
    step_hours: 1,
    hours: 10,
    samples: [CALM, CALM, CALM, { kp: 8, radiation: false }, CALM, CALM, CALM, CALM, CALM, CALM, CALM],
  };
  it('acha a tempestade que começa dentro de 6 horas e diz quantas faltam', () => {
    expect(hoursUntilStorm(table, 0)).toBe(3);
    expect(hoursUntilStorm(table, 1)).toBe(2);
  });
  it('não avisa quando a tempestade começa depois da janela de 6 horas', () => {
    expect(hoursUntilStorm(table, 0, 2)).toBeNull();
    expect(hoursUntilStorm(table, 4)).toBeNull();
  });
});
