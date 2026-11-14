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
import weatherJson from '../../src/data/space-weather.json';
import { weatherAt, type SpaceWeatherTable } from '../../src/engine/space-weather';
import type { TerrainTable } from '../../src/engine/terrain';

const SUN = sunJson as SunTable;
const TERRAIN = terrainJson as TerrainTable;
const WEATHER = weatherJson as SpaceWeatherTable;

const INSTALLATION: Installation = {
  rank: 'explorador',
  site: 'peak',
  panels: 2,
  // Capacidade de armazenamento: escolha de equilíbrio, ajustável (ver docs/regras-recursos.md).
  batteryCapacity: 1000,
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

/** O plano de referência mais o cuidado da estufa: colhe quando pronta e faz manutenção com desgaste alto. */
function planWithCrew(g: GameState): GameState {
  let s = planHour(g);
  const order = (kind: 'harvest' | 'maintain'): void => {
    const r = dispatch(s, { type: 'ASSIGN_AGENT_TASK', kind });
    if (r.ok) s = r.state;
  };
  if (s.crop.growth >= 100) order('harvest');
  if (s.crop.wear > 50) order('maintain');
  return s;
}

function play(plan: ((g: GameState) => GameState) | null): GameState {
  let g = createGame({ installation: INSTALLATION });
  while (outcomeOf(g) === 'playing') {
    if (plan) g = plan(g);
    // Clima real do cenário (DONKI), igual ao da tela.
    g = advance(g, 1, sunlit(g.clock.hour), weatherAt(WEATHER, g.clock.hour));
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

  it('equilíbrio com o Sol real: o plano de referência termina com 2 corações (B2.3)', () => {
    // Capacidade 1000: com 950 o plano perde na noite; com 1050 ou mais, sobra folga (ver docs/regras-recursos.md).
    const g = play(planHour);
    expect(g.hearts).toBe(2);
  });

  it('com astronautas colhendo e fazendo manutenção, o plano mantém o resultado e rende muitas colheitas (D-18)', () => {
    const g = play(planWithCrew);
    expect(outcomeOf(g)).toBe('won');
    // A manutenção custa 15 de energia; com capacidade 1000 (equilíbrio apertado) isso pode custar 1 coração.
    // Só colher (sem manutenção) mantém os 2 corações: a decisão de gastar energia é real.
    expect(g.hearts).toBeGreaterThanOrEqual(1);
    expect(g.crop.harvests).toBeGreaterThan(15);
    expect(g.agentTasksDone.harvest).toBe(g.crop.harvests);
  });

  it('depois do fim, nenhuma ação é aceita', () => {
    const g = play(planHour);
    const r = dispatch(g, { type: 'ENQUEUE_TASK', kind: 'ice' });
    expect(r.ok).toBe(false);
  });
});
