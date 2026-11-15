// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// ROV-04: previsão da água pelas regras do motor, para avisar antes de a fila deixar a base sem água.
import { describe, expect, it } from 'vitest';
import { createGame, dispatch, type GameState } from '../../src/engine/game';
import { forecastWater, forecastWithAction } from '../../src/engine/forecast';
import type { Installation } from '../../src/engine/resources';

const INST: Installation = { rank: 'explorador', site: 'peak', panels: 2, batteryCapacity: 1000, greenhouse: 'off' };
const CALM = { kp: 0, radiation: false };

function withWater(water: number): GameState {
  const g = createGame({ installation: INST });
  return { ...g, vitals: { ...g.vitals, water } };
}
function enqueue(g: GameState, kind: 'ice' | 'panel'): GameState {
  const r = dispatch(g, { type: 'ENQUEUE_TASK', kind });
  if (!r.ok) throw new Error(r.reason);
  return r.state;
}

describe('previsão da água (ROV-04)', () => {
  it('sem gelo na fila e pouca água, avisa e diz em quantas horas zera', () => {
    const f = forecastWater(withWater(10), true, CALM);
    expect(f.iceIn).toBeNull();
    expect(f.zeroIn).not.toBeNull();
    expect(f.risk).toBe(true);
  });

  it('com gelo logo na frente da fila, a entrega chega antes de zerar: sem aviso', () => {
    const f = forecastWater(enqueue(withWater(40), 'ice'), true, CALM);
    expect(f.iceIn).not.toBeNull();
    expect(f.risk).toBe(false);
  });

  it('um painel na frente do gelo atrasa a entrega e a água zera antes: o aviso aparece ao enfileirar', () => {
    const g = withWater(20);
    const iceFirst = forecastWithAction(g, { type: 'ENQUEUE_TASK', kind: 'ice' }, true, CALM);
    const panelFirst = forecastWithAction(g, { type: 'ENQUEUE_TASK', kind: 'panel' }, true, CALM);
    expect(iceFirst.risk).toBe(false);
    expect(panelFirst.risk).toBe(true);
  });

  it('não altera o estado recebido', () => {
    const g = enqueue(withWater(30), 'panel');
    const copy = JSON.stringify(g);
    forecastWater(g, true, CALM);
    expect(JSON.stringify(g)).toBe(copy);
  });
});
