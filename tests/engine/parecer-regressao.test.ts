// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Regressão dos defeitos E01 a E05 do parecer de julgamento (revisão 2ebfee6, 15/11/2026).
import { TASK_HOURS } from '../../src/engine/robot';
// Cada teste reproduz o cenário do parecer e falha se o defeito voltar.
// E06 (teste Python de metadado angular) é coberto em data-pipeline/tests.
import { describe, expect, it } from 'vitest';
import { advance, createGame, dispatch, type GameState } from '../../src/engine/game';
import type { Installation } from '../../src/engine/resources';
import { alertAt } from '../../src/engine/alert';
import { alertsUntil, eventsUntil, linkedEventsUntil, type SpaceEventCatalog } from '../../src/engine/space-events';
import catalogJson from '../../src/data/space-weather-events.json';

const CATALOG = catalogJson as unknown as SpaceEventCatalog;
const DARK = false;
const LIT = true;

function base(overrides: Partial<Installation> = {}): GameState {
  return createGame({ installation: { rank: 'explorador', site: 'peak', panels: 2, batteryCapacity: 1000, greenhouse: 'off', ...overrides } });
}

function withVitals(g: GameState, v: Partial<GameState['vitals']>): GameState {
  return { ...g, vitals: { ...g.vitals, ...v } };
}

function queueIce(g: GameState): GameState {
  const r = dispatch(g, { type: 'ENQUEUE_TASK', kind: 'ice' });
  if (!r.ok) throw new Error(`fila de gelo recusada: ${r.reason}`);
  return r.state;
}

describe('E01 · a mesma tarefa não depende do tamanho do passo', () => {
  it('sem energia, 6 h de uma vez ou 6 passos de 1 h dão o mesmo resultado', () => {
    const start = queueIce(withVitals(base(), { battery: 0.01, water: 10, air: 80, food: 80 }));
    const oneStep = advance(start, 6, DARK);
    let sixSteps = start;
    for (let i = 0; i < 6; i++) sixSteps = advance(sixSteps, 1, DARK);
    expect(sixSteps.vitals.water).toBeCloseTo(oneStep.vitals.water, 9);
    expect(sixSteps.robot.queue.length).toBe(oneStep.robot.queue.length);
  });

  it('sem energia, o gelo não conclui e a água não sobe', () => {
    const start = queueIce(withVitals(base(), { battery: 0.01, water: 10, air: 80, food: 80 }));
    const after = advance(start, 6, DARK);
    expect(after.robot.queue.length).toBe(1);
    expect(after.vitals.water).toBeLessThanOrEqual(10);
  });

  it('com Sol e bateria cheia, a partição do tempo não muda a água nem a fila', () => {
    const start = queueIce(withVitals(base(), { battery: 900, water: 30, air: 80, food: 80 }));
    const oneStep = advance(start, 6, LIT);
    let sixSteps = start;
    for (let i = 0; i < 6; i++) sixSteps = advance(sixSteps, 1, LIT);
    expect(sixSteps.vitals.water).toBeCloseTo(oneStep.vitals.water, 6);
    expect(sixSteps.robot.queue.length).toBe(oneStep.robot.queue.length);
  });
});

describe('E02 · alerta não usa evidência de SEP futura', () => {
  it('nas horas do parecer (415 e 455), a evidência registrada não está no futuro', () => {
    for (const hour of [415, 455]) {
      const view = alertAt(CATALOG, hour, { reach: 12, sheltered: false });
      if (view.evidence) expect(view.evidence.hour).toBeLessThanOrEqual(hour);
    }
  });

  it('em toda a missão, nenhuma evidência exibida tem horário posterior à hora atual', () => {
    for (let hour = 0; hour <= 708; hour += 0.25) {
      const view = alertAt(CATALOG, hour, { reach: 12, sheltered: false });
      if (view.evidence) expect(view.evidence.hour).toBeLessThanOrEqual(hour);
    }
  });
});

describe('E03 · histórico científico não mostra registros futuros', () => {
  it('na hora 417,2, nenhum evento, alerta ou notificação ligada tem horário posterior', () => {
    const hour = 417.2;
    for (const event of eventsUntil(CATALOG, hour)) {
      for (const alert of alertsUntil(event, hour)) expect(alert.hour).toBeLessThanOrEqual(hour);
      for (const linked of linkedEventsUntil(event, hour)) expect(linked.hour).toBeLessThanOrEqual(hour);
    }
    for (const event of CATALOG.events) {
      if (event.hour > hour) expect(eventsUntil(CATALOG, hour)).not.toContain(event);
    }
  });
});

describe('E04 · estufa não cresce sem água', () => {
  it('com água zero, 13 h de estufa ligada não geram crescimento', () => {
    let g = withVitals(base({ greenhouse: 'always' }), { water: 0, battery: 900 });
    for (let h = 0; h < 13; h++) g = advance(g, 1, LIT);
    expect(g.crop.growth).toBe(0);
  });
});

describe('E05 · ajuda de astronauta só com tripulação livre', () => {
  it('com os dois astronautas ocupados, o gelo leva o tempo cheio', () => {
    let g = withVitals(base(), { battery: 900 });
    g = { ...g, crop: { ...g.crop, wear: 40 } };
    const first = dispatch(g, { type: 'ASSIGN_AGENT_TASK', kind: 'inspect', agent: 0 });
    if (!first.ok) throw new Error(first.reason);
    const second = dispatch(first.state, { type: 'ASSIGN_AGENT_TASK', kind: 'maintain', agent: 1 });
    if (!second.ok) throw new Error(second.reason);
    const queued = queueIce(second.state);
    let s = queued;
    let hours = 0;
    while (s.robot.queue.length > 0 && hours < 2 * TASK_HOURS.ice) {
      s = advance(s, 1, LIT);
      hours++;
    }
    expect(hours).toBe(Math.ceil(TASK_HOURS.ice));
  });
});
