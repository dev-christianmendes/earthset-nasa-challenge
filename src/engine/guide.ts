// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import type { GameState } from './game';
import type { AlertView } from './alert';
import { currentChapter, type ChapterId } from './chapters';
import type { LumaLevel } from './modes';
import { missionPhase } from './mission';
import type { TaskKind } from './robot';

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
  air: 'energy',
  water: 'rover',
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

const utcLabel = (time: string): string => time.replace('T', ' ').replace('Z', ' UTC');

export function lumaAdvice(state: GameState, alert: AlertView | null, level: LumaLevel = 'full'): LumaAdvice {
  if (state.crewOrder === 'outside' && alert?.episode) return advice('luma.outside', 'critical', 'crew', { hours: state.crew.exposureHours.toFixed(1) });
  if (state.crewOrder === 'auto' && state.crew.prevRadiation) {
    const record = alert?.evidence;
    return record ? advice(state.robot.safe ? 'luma.radiation.src.rover' : 'luma.radiation.src', 'critical', 'crew', { id: record.id, time: utcLabel(record.time_utc) }) : advice('luma.radiation', 'critical', 'crew');
  }
  const [worst, value] = worstResource(state);
  if (state.hearts <= 1) return advice('luma.lastHeart', 'critical', RESOURCE_ACTION[worst]);
  // Monitoramento usa precursores já registrados; não prevê o início do SEP.
  if (alert?.level === 'monitoring' && alert.precursor) {
    const p = alert.precursor;
    const range = alert.lagRange;
    return advice(`luma.monitor.${p.type}`, 'warning', 'crew', { id: p.id, time: utcLabel(p.time_utc), min: range ? Math.round(range[0]) : '?', max: range ? Math.round(range[1]) : '?' });
  }
  if (alert?.level === 'recovery') return advice('luma.recovery', 'warning', null, { hours: Math.ceil(alert.recoveryLeft) });
  if (value < LUMA_LOW) return advice(`luma.low.${worst}`, 'warning', RESOURCE_ACTION[worst]);
  if (level === 'critical') return advice('luma.quiet', 'info', null);
  const chapter = currentChapter(state);
  if (chapter === 1 && state.robot.queue.length > 0) return advice('luma.chapter.1.wait', 'info', 'rover');
  return advice(`luma.chapter.${chapter}`, 'info', CHAPTER_ACTION[chapter]);
}

export interface LumaEvent extends LumaAdvice {
  readonly id: string;
}

const KINDS: readonly TaskKind[] = ['ice', 'panel', 'antenna'];

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
  for (const kind of ['inspect', 'harvest', 'maintain', 'calibrate', 'tune'] as const) {
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
