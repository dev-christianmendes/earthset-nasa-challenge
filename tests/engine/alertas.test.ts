// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { SPACE_EVENTS } from '../../src/data/space-weather-events';
import { alertAt, lagRangeOf, RECOVERY_HOURS } from '../../src/engine/alert';
import { EMPTY_CATALOG, type SpaceEventCatalog } from '../../src/engine/space-events';

const IN = { reach: 12, sheltered: false };
const NO_ANTENNA = { reach: null, sheltered: false };

describe('alertas com o catálogo real da NASA DONKI (cenário de 09/10/2024)', () => {
  it('a partida abre em ALERTA: o episódio EP-01 já estava em curso na hora 0', () => {
    const a = alertAt(SPACE_EVENTS, 0, NO_ANTENNA);
    expect(a.level).toBe('alert');
    expect(a.episode?.id).toBe('EP-01');
    expect(a.evidence?.type).toBe('SEP');
    expect(a.evidence?.link).toMatch(/^https:\/\/ccmc\.gsfc\.nasa\.gov\/DONKI\//);
  });

  it('vira ABRIGO quando a tripulação está toda dentro', () => {
    expect(alertAt(SPACE_EVENTS, 3, { reach: null, sheltered: true }).level).toBe('shelter');
  });

  it('depois do EP-01 vem a RECUPERAÇÃO por 6 h e depois NORMAL', () => {
    const end = SPACE_EVENTS.radiation_episodes[0].end_hour;
    const rec = alertAt(SPACE_EVENTS, end + 1, IN);
    expect(rec.level).toBe('recovery');
    expect(rec.recoveryLeft).toBeCloseTo(RECOVERY_HOURS - 1);
    expect(alertAt(SPACE_EVENTS, end + RECOVERY_HOURS, IN).level).toBe('normal');
  });

  it('nas horas calmas (24 a 400) o estado é NORMAL, com ou sem antena', () => {
    for (const hour of [60, 200, 399]) {
      expect(alertAt(SPACE_EVENTS, hour, IN).level).toBe('normal');
      expect(alertAt(SPACE_EVENTS, hour, NO_ANTENNA).level).toBe('normal');
    }
  });

  it('EP-02: com a antena ajustada (12 h) há MONITORAMENTO antes do SEP; sem ajuste (6 h) e sem antena, não', () => {
    const ep2 = SPACE_EVENTS.radiation_episodes[1];
    const hour = ep2.start_hour - 2;
    const tuned = alertAt(SPACE_EVENTS, hour, { reach: 12, sheltered: false });
    expect(tuned.level).toBe('monitoring');
    expect(tuned.precursor?.provenance).toBe('from-id');
    expect(['FLR', 'CME']).toContain(tuned.precursor?.type);
    expect(alertAt(SPACE_EVENTS, hour, { reach: 6, sheltered: false }).level).toBe('normal');
    expect(alertAt(SPACE_EVENTS, hour, NO_ANTENNA).level).toBe('normal');
  });

  it('o monitoramento não promete tempo restante e mostra a incerteza (intervalo entre erupção e SEP nos dados)', () => {
    const ep2 = SPACE_EVENTS.radiation_episodes[1];
    const a = alertAt(SPACE_EVENTS, ep2.start_hour - 2, IN);
    expect(a).not.toHaveProperty('hoursToOnset');
    expect(a.lagRange).not.toBeNull();
    const [min, max] = a.lagRange as readonly [number, number];
    expect(min).toBeGreaterThan(1);
    expect(max).toBeGreaterThan(40);
  });

  it('não mostra o futuro: antes de a erupção ser registrada o estado é NORMAL', () => {
    const ep2 = SPACE_EVENTS.radiation_episodes[1];
    expect(alertAt(SPACE_EVENTS, ep2.start_hour - 20, IN).level).toBe('normal');
  });

  it('EP-03: a erupção ligada veio 50 h antes, fora do alcance da antena: o primeiro estado é ALERTA no SEP', () => {
    const ep3 = SPACE_EVENTS.radiation_episodes[2];
    expect(alertAt(SPACE_EVENTS, ep3.start_hour - 1, { reach: 24, sheltered: false }).level).toBe('normal');
    expect(alertAt(SPACE_EVENTS, ep3.start_hour + 0.5, IN).level).toBe('alert');
  });

  it('o intervalo erupção→SEP vai de poucas horas a dias nos dados', () => {
    const range = lagRangeOf(SPACE_EVENTS);
    expect(range?.[0]).toBeLessThan(3);
    expect(range?.[1]).toBeGreaterThan(40);
  });

  it('recusa hora não finita', () => {
    expect(() => alertAt(SPACE_EVENTS, Number.NaN, IN)).toThrow(RangeError);
  });
});

describe('alertas sem dados ou com dados incompletos', () => {
  it('janela sem eventos ou dados indisponíveis: sempre NORMAL, sem erro', () => {
    for (const hour of [0, 100, 707]) expect(alertAt(EMPTY_CATALOG, hour, IN).level).toBe('normal');
  });

  const incomplete: SpaceEventCatalog = {
    ...EMPTY_CATALOG,
    radiation_episodes: [{ id: 'EP-X', start_hour: 50, end_hour: 74, before_window_start: false, sep_ids: ['sep-que-nao-existe'], provenance: 'game-rule' }],
  };

  it('episódio sem o registro SEP no catálogo: ALERTA continua, só sem evidência (nada é inventado)', () => {
    const a = alertAt(incomplete, 55, IN);
    expect(a.level).toBe('alert');
    expect(a.evidence).toBeNull();
  });

  it('episódio sem erupção ligada: sem MONITORAMENTO, sem erro', () => {
    expect(alertAt(incomplete, 45, IN).level).toBe('normal');
  });
});
