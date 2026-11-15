// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Invariantes de causalidade apontados na auditoria independente de 15/11/2026 (E01 a E05).
import { describe, expect, it } from 'vitest';
import { SPACE_EVENTS } from '../../src/data/space-weather-events';
import { alertAt } from '../../src/engine/alert';
import { advance, createGame, dispatch, type GameState } from '../../src/engine/game';
import type { Installation } from '../../src/engine/resources';
import { CALM } from '../../src/engine/space-weather';
import { alertsUntil, linkedEventsUntil } from '../../src/engine/space-events';

const inst: Installation = { rank: 'explorador', site: 'peak', panels: 2, batteryCapacity: 1000, greenhouse: 'always' };

function ok(state: GameState, action: Parameters<typeof dispatch>[1]): GameState {
  const r = dispatch(state, action);
  if (!r.ok) throw new Error(`ação recusada: ${r.reason}`);
  return r.state;
}

describe('E01 · o resultado não depende da forma como o tempo é repartido', () => {
  it('6 h de uma vez = seis passos de 1 h, sem Sol, com gelo na fila', () => {
    const start = (): GameState => {
      let g = createGame({ installation: inst });
      g = { ...g, vitals: { ...g.vitals, battery: 0.01, water: 10 } };
      return ok(g, { type: 'ENQUEUE_TASK', kind: 'ice' });
    };
    const once = advance(start(), 6, false, CALM);
    let split = start();
    for (let h = 0; h < 6; h++) split = advance(split, 1, false, CALM);
    expect(split.clock.hour).toBe(once.clock.hour);
    expect(split.vitals).toEqual(once.vitals);
    expect(split.missionsDone).toEqual(once.missionsDone);
    expect(split.hearts).toBe(once.hearts);
  });

  it('a luz pode mudar dentro de uma chamada longa e o resultado continua igual', () => {
    const sun = (hour: number): boolean => Math.floor(hour / 3) % 2 === 0;
    const g = createGame({ installation: inst });
    const once = advance(g, 12, sun, CALM);
    let split = g;
    for (let h = 0; h < 12; h++) split = advance(split, 1, sun, CALM);
    expect(split.vitals).toEqual(once.vitals);
    expect(split.clock.hour).toBe(once.clock.hour);
  });
});

describe('E02 · evidência de SEP nunca vem do futuro', () => {
  it('na hora 415, o SEP de 415,75 h ainda não aparece como evidência', () => {
    const a = alertAt(SPACE_EVENTS, 415, { reach: null, sheltered: false });
    if (a.evidence) expect(a.evidence.hour).toBeLessThanOrEqual(415);
  });

  it('a radiação começa na primeira hora cheia depois do SEP registrado', () => {
    const ep = SPACE_EVENTS.radiation_episodes.find((e) => e.id === 'EP-02');
    expect(ep).toBeDefined();
    const sep = SPACE_EVENTS.events.find((e) => e.type === 'SEP' && e.hour > 415 && e.hour < 416);
    expect(sep).toBeDefined();
    expect(ep!.start_hour).toBeGreaterThanOrEqual(sep!.hour);
  });
});

describe('E03 · painel científico não mostra notificações posteriores à hora atual', () => {
  it('um evento ligado a 451,22 h não aparece na hora 417,2', () => {
    const withLinks = SPACE_EVENTS.events.find((e) => e.linked_events.some((l) => l.hour > 417.2));
    expect(withLinks).toBeDefined(); // o catálogo real tem um evento ligado com horário posterior
    expect(linkedEventsUntil(withLinks!, 417.2).every((l) => l.hour <= 417.2)).toBe(true);
    expect(alertsUntil(withLinks!, 417.2).every((a) => a.hour <= 417.2)).toBe(true);
  });
});

describe('E04 · cultura não cresce sem água', () => {
  it('com água zero, a estufa ligada não faz a cultura crescer', () => {
    let g = createGame({ installation: inst });
    g = { ...g, vitals: { ...g.vitals, battery: 900, water: 0 } };
    const after = advance(g, 13, true, CALM);
    expect(after.crop.growth).toBe(0);
  });
});

describe('E05 · quem está ocupado não ajuda o rover', () => {
  it('com os dois astronautas em tarefa, a missão de gelo leva o tempo cheio', () => {
    let g = createGame({ installation: inst });
    g = ok(g, { type: 'ENQUEUE_TASK', kind: 'ice' });
    const free = advance(g, 4, true, CALM);
    let busy = ok(g, { type: 'ASSIGN_AGENT_TASK', kind: 'inspect', agent: 0 });
    busy = ok(busy, { type: 'ASSIGN_AGENT_TASK', kind: 'calibrate', agent: 1 });
    const occupied = advance(busy, 4, true, CALM);
    // Com um astronauta livre, a ajuda encurta a viagem; ocupados, não.
    expect(free.missionsDone.ice).toBeGreaterThanOrEqual(occupied.missionsDone.ice);
    expect(occupied.missionsDone.ice).toBe(0);
    expect(free.missionsDone.ice).toBe(1);
  });
});
