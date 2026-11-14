// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// LUMA, o sistema de suporte da estação (baseado em regras, sem modelo de IA em tempo de jogo; D-12).
// Escolhe a orientação mais urgente a partir do estado e detecta eventos entre dois estados.
// Só devolve chaves de texto, gravidade e o sistema a abrir; o texto fica em src/i18n.ts (luma.*).
import type { GameState } from './game';
import { currentChapter, type ChapterId } from './chapters';
import type { LumaLevel } from './modes';
import { missionPhase } from './mission';
import type { TaskKind } from './robot';

/** Sistema da interface que resolve a orientação (atalho na mensagem). */
export type LumaAction = 'rover' | 'energy' | 'greenhouse' | 'crew' | 'science';
export type LumaSeverity = 'critical' | 'warning' | 'info';

export interface LumaAdvice {
  /** Chave de texto em src/i18n.ts (prefixo luma.). */
  readonly key: string;
  readonly vars: Readonly<Record<string, string | number>>;
  readonly severity: LumaSeverity;
  readonly action: LumaAction | null;
}

/** Recurso abaixo deste nível (em %) dispara um alerta da LUMA. */
export const LUMA_LOW = 25;

type Resource = 'battery' | 'air' | 'water' | 'food';

const RESOURCE_ACTION: Readonly<Record<Resource, LumaAction>> = {
  battery: 'energy',
  air: 'energy', // a eletrólise usa água e bateria
  water: 'rover', // gelo
  food: 'greenhouse',
};

const CHAPTER_ACTION: Readonly<Record<ChapterId, LumaAction>> = {
  1: 'rover',
  2: 'rover',
  3: 'rover',
  4: 'rover',
  5: 'science',
};

function worstResource(state: GameState): [Resource, number] {
  const { vitals } = state;
  const list: Array<[Resource, number]> = [
    ['battery', (vitals.battery / state.installation.batteryCapacity) * 100],
    ['air', vitals.air],
    ['water', vitals.water],
    ['food', vitals.food],
  ];
  return list.reduce((a, b) => (b[1] < a[1] ? b : a));
}

function advice(key: string, severity: LumaSeverity, action: LumaAction | null, vars: Record<string, string | number> = {}): LumaAdvice {
  return { key, vars, severity, action };
}

/**
 * Orientação atual. Perigos aparecem em todos os modos; o passo da história só nos modos com dicas
 * ('full' e 'goals'). No modo 'critical' (Comandante), sem perigo, a LUMA fica em silêncio operacional.
 */
export function lumaAdvice(state: GameState, stormInHours: number | null, level: LumaLevel = 'full'): LumaAdvice {
  // 1. Perigo agora: radiação com a tripulação em modo automático, ou último coração.
  if (state.crewOrder === 'auto' && state.crew.prevRadiation) return advice('luma.radiation', 'critical', 'crew');
  const [worst, value] = worstResource(state);
  if (state.hearts <= 1) return advice('luma.lastHeart', 'critical', RESOURCE_ACTION[worst]);
  // 2. Aviso da antena: tempestade em até 6 h.
  if (stormInHours !== null) return advice('luma.storm', 'warning', 'crew', { hours: stormInHours });
  // 3. Recurso baixo.
  if (value < LUMA_LOW) return advice(`luma.low.${worst}`, 'warning', RESOURCE_ACTION[worst]);
  // 4. Passo da história (capítulo atual).
  if (level === 'critical') return advice('luma.quiet', 'info', null);
  const chapter = currentChapter(state);
  // Capítulo 1 com a primeira missão já na fila: acompanhar a operação em vez de repetir o pedido.
  if (chapter === 1 && state.robot.queue.length > 0) return advice('luma.chapter.1.wait', 'info', 'rover');
  return advice(`luma.chapter.${chapter}`, 'info', CHAPTER_ACTION[chapter]);
}

/** Evento pontual (mensagem que entra no histórico da LUMA). */
export interface LumaEvent extends LumaAdvice {
  readonly id: string;
}

const KINDS: readonly TaskKind[] = ['ice', 'panel', 'antenna'];

/**
 * Eventos entre dois estados consecutivos: missão concluída, rover voltando, capítulo novo, coração perdido,
 * início e fim de radiação (o clima vem do chamador, como em advance).
 */
export function lumaEvents(prev: GameState, next: GameState, radiationBefore = false, radiationNow = false): readonly LumaEvent[] {
  const out: LumaEvent[] = [];
  const push = (id: string, key: string, severity: LumaSeverity, action: LumaAction | null, vars: Record<string, string | number> = {}) =>
    out.push({ id, key, vars, severity, action });

  if (!radiationBefore && radiationNow) push('radiation-start', 'luma.event.radiationStart', 'critical', 'crew');
  if (radiationBefore && !radiationNow) push('radiation-end', 'luma.event.radiationEnd', 'info', 'rover');
  if (next.hearts < prev.hearts) push('heart', 'luma.event.heart', 'critical', null, { hearts: next.hearts });

  for (const kind of KINDS) {
    if (next.missionsDone[kind] > prev.missionsDone[kind]) push(`done-${kind}`, `luma.event.done.${kind}`, 'info', null);
  }
  for (const kind of ['inspect', 'harvest', 'maintain'] as const) {
    if (next.agentTasksDone[kind] > prev.agentTasksDone[kind]) push(`agent-${kind}`, `luma.event.agent.${kind}`, 'info', null);
  }
  if (prev.crop.growth < 100 && next.crop.growth >= 100) push('crop-ready', 'luma.event.cropReady', 'info', null);
  const a = prev.robot.queue[0];
  const b = next.robot.queue[0];
  if (a && b && a.kind === b.kind && missionPhase(a) !== 'return' && missionPhase(b) === 'return') {
    push(`return-${b.kind}`, 'luma.event.returning', 'info', 'rover');
  }
  const chapterBefore = currentChapter(prev);
  const chapterNow = currentChapter(next);
  if (chapterNow > chapterBefore) push(`chapter-${chapterNow}`, 'luma.event.chapter', 'info', null, { n: chapterNow });
  return out;
}
