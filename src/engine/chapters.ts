// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// História "Operação Último Horizonte": cinco capítulos derivados do estado da partida (motor puro, sem texto).
// O capítulo avança pelas ações do jogador; não há botão de "continuar". Textos em src/i18n.ts (chapter.*).
import type { GameState } from './game';
import { MATCH_HOURS } from './clock';

export type ChapterId = 1 | 2 | 3 | 4 | 5;

export interface Chapter {
  readonly id: ChapterId;
  readonly done: boolean;
  /** Progresso de 0 a 1 da meta do capítulo. */
  readonly progress: number;
}

/** Painéis instalados para fechar o capítulo 2. */
export const CHAPTER_PANELS = 4;
/** Viagens de gelo concluídas para fechar o capítulo 3. */
export const CHAPTER_ICE_TRIPS = 2;

/** Os cinco capítulos com estado e progresso. Um capítulo pode fechar fora de ordem; o atual é o primeiro aberto. */
export function chaptersOf(state: GameState): readonly Chapter[] {
  const m = state.missionsDone;
  const anyMission = m.ice + m.panel + m.antenna;
  const panels = state.installation.panels;
  return [
    { id: 1, done: anyMission >= 1, progress: anyMission >= 1 ? 1 : state.robot.queue.length > 0 ? 0.5 : 0 },
    { id: 2, done: panels >= CHAPTER_PANELS, progress: Math.min(1, panels / CHAPTER_PANELS) },
    { id: 3, done: m.ice >= CHAPTER_ICE_TRIPS, progress: Math.min(1, m.ice / CHAPTER_ICE_TRIPS) },
    { id: 4, done: state.robot.antennaInstalled, progress: state.robot.antennaInstalled ? 1 : 0 },
    { id: 5, done: state.clock.finished && state.hearts > 0, progress: Math.min(1, state.clock.hour / MATCH_HOURS) },
  ];
}

/** Capítulo atual: o primeiro ainda aberto; 5 quando todos os anteriores fecharam. */
export function currentChapter(state: GameState): ChapterId {
  const open = chaptersOf(state).find((c) => !c.done);
  return open ? open.id : 5;
}
