// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { advance, createGame, dispatch, outcomeOf, type GameState } from '../../src/engine/game';
import { MODES, installationFor, isModeId, MODE_IDS, type ModeId } from '../../src/engine/modes';
import { chaptersOf, currentChapter, CHAPTER_ICE_TRIPS } from '../../src/engine/chapters';
import { missionPhase, phaseProgress, taskProgress } from '../../src/engine/mission';
import { lumaEvents } from '../../src/engine/guide';
import { MAX_PANELS, TASK_HOURS, TASK_PHASE_HOURS, type TaskKind } from '../../src/engine/robot';
import { isSunlit, type SunTable } from '../../src/engine/sun';
import { weatherAt, type SpaceWeatherTable } from '../../src/engine/space-weather';
import type { TerrainTable } from '../../src/engine/terrain';
import sunJson from '../../src/data/sun-south-pole.json';
import terrainJson from '../../src/data/terrain-sites.json';
import weatherJson from '../../src/data/space-weather.json';

const SUN = sunJson as SunTable;
const TERRAIN = terrainJson as TerrainTable;
const WEATHER = weatherJson as SpaceWeatherTable;
const BASE = { site: 'peak' as const, panels: 2, batteryCapacity: 1000, greenhouse: 'surplus' as const };
const CALM = { kp: 0, radiation: false };

function enqueue(g: GameState, kind: TaskKind): GameState {
  const r = dispatch(g, { type: 'ENQUEUE_TASK', kind });
  return r.ok ? r.state : g;
}

/** Mesmo plano de referência de partida.test.ts. */
function planHour(g: GameState): GameState {
  const queued = (k: TaskKind): number => g.robot.queue.filter((t) => t.kind === k).length;
  let s = g;
  if (s.vitals.water < 45 && queued('ice') < 2) s = enqueue(s, 'ice');
  if (s.installation.panels + queued('panel') < MAX_PANELS) s = enqueue(s, 'panel');
  if (!s.robot.antennaInstalled && queued('antenna') === 0) s = enqueue(s, 'antenna');
  if (queued('ice') < 2) s = enqueue(s, 'ice');
  return s;
}

function play(mode: ModeId): GameState {
  const inst = installationFor(mode, BASE);
  let g = createGame({ installation: inst });
  while (outcomeOf(g) === 'playing') {
    g = planHour(g);
    g = advance(g, 1, isSunlit(SUN, g.clock.hour, inst.site, TERRAIN), weatherAt(WEATHER, g.clock.hour));
  }
  return g;
}

describe('modos de experiência (D-17)', () => {
  it('cada modo usa uma patente do motor e só muda a apresentação e o fator de consumo', () => {
    expect(MODE_IDS.map((m) => MODES[m].rank)).toEqual(['cadete', 'explorador', 'comandante']);
    expect(installationFor('commander', BASE)).toEqual({ ...BASE, rank: 'comandante' });
    expect(isModeId('cadet')).toBe(true);
    expect(isModeId('god')).toBe(false);
  });

  it('com o plano de referência, Explorador e Cadete vencem; o Explorador termina com mais folga', () => {
    const explorer = play('explorer');
    const cadet = play('cadet');
    expect(outcomeOf(explorer)).toBe('won');
    expect(outcomeOf(cadet)).toBe('won');
    expect(explorer.hearts).toBeGreaterThanOrEqual(cadet.hearts);
  });

  it('o Comandante é mais exigente: com o mesmo plano não termina com mais corações que o Cadete', () => {
    const commander = play('commander');
    const cadet = play('cadet');
    expect(commander.hearts).toBeLessThanOrEqual(cadet.hearts);
  });
});

describe('capítulos da Operação Último Horizonte', () => {
  it('começa no capítulo 1, que fecha com a primeira missão concluída', () => {
    let g = createGame({ installation: installationFor('cadet', BASE) });
    expect(currentChapter(g)).toBe(1);
    g = enqueue(g, 'panel');
    expect(chaptersOf(g)[0].progress).toBe(0.5);
    for (let h = 0; h < TASK_HOURS.panel; h++) g = advance(g, 1, true, CALM);
    expect(g.missionsDone.panel).toBe(1);
    expect(chaptersOf(g)[0].done).toBe(true);
    expect(currentChapter(g)).toBe(2);
  });

  it('as viagens de gelo concluídas contam para o capítulo 3', () => {
    let g = createGame({ installation: installationFor('cadet', BASE) });
    g = enqueue(enqueue(g, 'ice'), 'ice');
    for (let h = 0; h < TASK_HOURS.ice * CHAPTER_ICE_TRIPS; h++) g = advance(g, 1, true, CALM);
    expect(g.missionsDone.ice).toBe(CHAPTER_ICE_TRIPS);
    expect(chaptersOf(g)[2].done).toBe(true);
  });

  it('a vitória fecha o capítulo 5', () => {
    const g = play('explorer');
    expect(chaptersOf(g)[4].done).toBe(true);
    expect(currentChapter(g)).toBe(5);
  });
});

describe('fases da missão (apresentação derivada do motor)', () => {
  it('as fases seguem o progresso real da tarefa', () => {
    // Fases em horas (TASK_PHASE_HOURS, D-22): preparo, ida, operação, volta, entrega.
    const [prep, travel, operate, ret] = TASK_PHASE_HOURS.ice;
    const total = TASK_HOURS.ice;
    const at = (elapsed: number) => ({ kind: 'ice' as const, hoursLeft: total - elapsed });
    expect(missionPhase(at(0))).toBe('prep');
    expect(missionPhase(at(prep + travel / 2))).toBe('travel');
    expect(missionPhase(at(prep + travel + operate / 2))).toBe('operate');
    expect(missionPhase(at(prep + travel + operate + ret / 2))).toBe('return');
    expect(missionPhase(at(total - 0.1))).toBe('deliver');
    expect(taskProgress(at(total / 2))).toBeCloseTo(0.5);
    expect(phaseProgress(at(prep + travel + operate / 2))).toBeCloseTo(0.5);
  });
});

describe('eventos da LUMA', () => {
  it('avisa missão concluída, rover voltando, capítulo novo e radiação', () => {
    let g = enqueue(createGame({ installation: installationFor('cadet', BASE) }), 'panel');
    let returning = false;
    let done = false;
    let chapter = false;
    for (let h = 0; h < TASK_HOURS.panel * 4; h++) {
      const next = advance(g, 0.25, true, CALM);
      const ids = lumaEvents(g, next).map((e) => e.id);
      returning ||= ids.includes('return-panel');
      done ||= ids.includes('done-panel');
      chapter ||= ids.includes('chapter-2');
      g = next;
    }
    expect([returning, done, chapter]).toEqual([true, true, true]);
    expect(lumaEvents(g, g, false, true).map((e) => e.id)).toEqual(['radiation-start']);
    expect(lumaEvents(g, g, true, false).map((e) => e.id)).toEqual(['radiation-end']);
  });
});
