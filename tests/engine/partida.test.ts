// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Partidas completas com o motor: base passiva perde; plano com robô vence.
// Sol real: tabela do JPL Horizons (src/data/sun-south-pole.json) e horizonte medido no LOLA (src/data/terrain-sites.json).
// Sem robô, a base perde; com plano razoável, vence com folga (ver asserções).
import { describe, expect, it } from 'vitest';
import { MATCH_HOURS } from '../../src/engine/clock';
import { advance, createGame, dispatch, outcomeOf, type GameState } from '../../src/engine/game';
import type { Installation } from '../../src/engine/resources';
import { MAX_PANELS, type TaskKind } from '../../src/engine/robot';
import { isSunlit, type SunTable } from '../../src/engine/sun';
import sunJson from '../../src/data/sun-south-pole.json';
import terrainJson from '../../src/data/terrain-sites.json';
import type { TerrainTable } from '../../src/engine/terrain';

const SUN = sunJson as SunTable;
const TERRAIN = terrainJson as TerrainTable;

const INSTALLATION: Installation = {
  rank: 'explorador',
  site: 'slope',
  panels: 2,
  // Capacidade de armazenamento: escolha de equilíbrio, ajustável (ver docs/regras-recursos.md).
  batteryCapacity: 1200,
  greenhouse: 'surplus',
};

const sunlit = (hour: number): boolean => isSunlit(SUN, hour, INSTALLATION.site, TERRAIN);

function enqueue(g: GameState, kind: TaskKind): GameState {
  const r = dispatch(g, { type: 'ENQUEUE_TASK', kind });
  return r.ok ? r.state : g;
}

/** Plano simples: mantém água, instala todos os painéis e a antena, e reabastece gelo. */
function planHour(g: GameState): GameState {
  const queued = (k: TaskKind): number => g.robot.queue.filter((t) => t.kind === k).length;
  let s = g;
  if (s.vitals.water < 45 && queued('ice') < 2) s = enqueue(s, 'ice');
  if (s.installation.panels + queued('panel') < MAX_PANELS) s = enqueue(s, 'panel');
  if (!s.robot.antennaInstalled && queued('antenna') === 0) s = enqueue(s, 'antenna');
  if (queued('ice') < 2) s = enqueue(s, 'ice');
  return s;
}

function play(plan: ((g: GameState) => GameState) | null): GameState {
  let g = createGame({ installation: INSTALLATION });
  while (outcomeOf(g) === 'playing') {
    if (plan) g = plan(g);
    g = advance(g, 1, sunlit(g.clock.hour));
  }
  return g;
}

describe('partida completa', () => {
  it('base passiva, sem robô, perde', () => {
    const g = play(null);
    expect(outcomeOf(g)).toBe('lost');
    expect(g.clock.hour).toBeLessThan(MATCH_HOURS);
  });

  it('plano com robô chega a 708 h com pelo menos 1 coração', () => {
    const g = play(planHour);
    expect(outcomeOf(g)).toBe('won');
    expect(g.clock.hour).toBeGreaterThanOrEqual(MATCH_HOURS);
    expect(g.hearts).toBeGreaterThan(0);
    expect(g.robot.antennaInstalled).toBe(true);
    expect(g.installation.panels).toBe(MAX_PANELS);
  });

  it('depois do fim, nenhuma ação é aceita', () => {
    const g = play(planHour);
    const r = dispatch(g, { type: 'ENQUEUE_TASK', kind: 'ice' });
    expect(r.ok).toBe(false);
  });
});
