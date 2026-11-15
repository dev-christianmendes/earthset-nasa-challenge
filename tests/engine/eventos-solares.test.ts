// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { SPACE_EVENTS } from '../../src/data/space-weather-events';
import { WEATHER } from '../../src/data/space-weather';
import { EMPTY_CATALOG, episodeAt, eventsUntil } from '../../src/engine/space-events';
import { weatherAt } from '../../src/engine/space-weather';

describe('catálogo de eventos solares (dados versionados da NASA DONKI)', () => {
  it('tem 17 registros SEP e 1 GST, todos com ID único e link da DONKI', () => {
    const sep = SPACE_EVENTS.events.filter((e) => e.type === 'SEP');
    const gst = SPACE_EVENTS.events.filter((e) => e.type === 'GST');
    expect(sep).toHaveLength(17);
    expect(gst).toHaveLength(1);
    expect(new Set(SPACE_EVENTS.events.map((e) => e.id)).size).toBe(SPACE_EVENTS.events.length);
    for (const e of SPACE_EVENTS.events) expect(e.link).toMatch(/^https:\/\/ccmc\.gsfc\.nasa\.gov\/DONKI\//);
  });

  it('todo registro vem marcado como observado, e os eventos ligados como lidos do ID', () => {
    for (const e of SPACE_EVENTS.events) {
      expect(e.provenance).toBe('observed');
      for (const l of e.linked_events) expect(l.provenance).toBe('from-id');
    }
  });

  it('o horário UTC e a hora de jogo do registro são coerentes (início da janela 09/10/2024 09:00 UTC)', () => {
    const start = Date.parse('2024-10-09T09:00:00Z');
    for (const e of SPACE_EVENTS.events) {
      const hours = (Date.parse(e.time_utc.replace('Z', ':00Z')) - start) / 3_600_000;
      expect(Math.abs(hours - e.hour)).toBeLessThan(0.01);
      expect(e.before_window_start).toBe(e.hour < 0);
    }
  });

  it('o Kp é só observação da Terra: o GST avisa que não afeta o jogo', () => {
    const gst = SPACE_EVENTS.events.find((e) => e.type === 'GST');
    expect(gst && gst.type === 'GST' && gst.note).toMatch(/Terra/);
  });

  it('os episódios de radiação batem hora a hora com a tabela que o jogo usa', () => {
    for (let hour = 0; hour <= 708; hour++) {
      expect(episodeAt(SPACE_EVENTS, hour) !== null, `hora ${hour}`).toBe(weatherAt(WEATHER, hour).radiation);
    }
  });

  it('o jogo abre com radiação em curso: 9 SEP começaram antes das 09:00 UTC do dia 09/10', () => {
    const first = episodeAt(SPACE_EVENTS, 0);
    expect(first?.before_window_start).toBe(true);
    expect(first?.sep_ids).toHaveLength(9);
  });

  it('eventsUntil não mostra eventos do futuro e recusa hora inválida', () => {
    expect(eventsUntil(SPACE_EVENTS, 100).every((e) => e.hour <= 100)).toBe(true);
    expect(eventsUntil(SPACE_EVENTS, 100).some((e) => e.hour > 400)).toBe(false);
    expect(() => eventsUntil(SPACE_EVENTS, Number.NaN)).toThrow(RangeError);
  });

  it('janela sem eventos ou dados indisponíveis: catálogo vazio não quebra nada', () => {
    expect(episodeAt(EMPTY_CATALOG, 10)).toBeNull();
    expect(eventsUntil(EMPTY_CATALOG, 10)).toEqual([]);
  });
});
