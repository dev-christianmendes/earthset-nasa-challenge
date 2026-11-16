// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// O catálogo é retrospectivo: contém precursores de SEP, sem modelar falsos alarmes.

import { episodeAt, type LinkedEvent, type RadiationEpisode, type SepEvent, type SpaceEventCatalog } from './space-events';

export type AlertLevel = 'normal' | 'monitoring' | 'alert' | 'shelter' | 'recovery';

/** Horas depois do fim da radiação em que a base segue em recuperação (regra de jogo, sem base na DONKI). */
export const RECOVERY_HOURS = 6;

const PRECURSOR_TYPES: readonly string[] = ['FLR', 'CME'];

export interface AlertInput {
  /** Alcance da antena em horas, ou null sem antena instalada (sem antena não há MONITORAMENTO). */
  readonly reach: number | null;
  readonly sheltered: boolean;
}

export interface AlertView {
  readonly level: AlertLevel;
  /** Episódio em curso, em recuperação ou o próximo (no monitoramento). */
  readonly episode: RadiationEpisode | null;
  /** Registro SEP da DONKI que sustenta ALERTA, ABRIGO e RECUPERAÇÃO. */
  readonly evidence: SepEvent | null;
  /** Erupção ou CME registrada que sustenta o MONITORAMENTO. */
  readonly precursor: LinkedEvent | null;
  readonly recoveryLeft: number;
  /** Menor e maior intervalo, nos dados, entre a erupção ou CME mais próxima e o início do SEP. Só no monitoramento. */
  readonly lagRange: readonly [number, number] | null;
}

function sepsOf(catalog: SpaceEventCatalog, episode: RadiationEpisode): SepEvent[] {
  const ids = new Set(episode.sep_ids);
  return catalog.events.filter((e): e is SepEvent => e.type === 'SEP' && ids.has(e.id)).sort((a, b) => a.hour - b.hour);
}

function precursorsOf(catalog: SpaceEventCatalog, episode: RadiationEpisode): { onset: number; list: LinkedEvent[] } {
  const seps = sepsOf(catalog, episode);
  const onset = seps.length > 0 ? seps[0].hour : episode.start_hour;
  const seen = new Map<string, LinkedEvent>();
  for (const sep of seps) for (const l of sep.linked_events) if (PRECURSOR_TYPES.includes(l.type)) seen.set(l.id, l);
  return { onset, list: [...seen.values()].filter((l) => l.hour <= onset) };
}

export function lagRangeOf(catalog: SpaceEventCatalog): readonly [number, number] | null {
  const lags: number[] = [];
  for (const episode of catalog.radiation_episodes) {
    const { onset, list } = precursorsOf(catalog, episode);
    if (list.length > 0) lags.push(Math.min(...list.map((l) => onset - l.hour)));
  }
  return lags.length === 0 ? null : [Math.min(...lags), Math.max(...lags)];
}

const NONE = { episode: null, evidence: null, precursor: null, recoveryLeft: 0, lagRange: null } as const;

export function alertAt(catalog: SpaceEventCatalog, hour: number, input: AlertInput): AlertView {
  if (!Number.isFinite(hour)) throw new RangeError(`hora inválida para o alerta: ${hour}`);

  const active = episodeAt(catalog, hour);
  if (active) {
    const seps = sepsOf(catalog, active);
    const evidence = [...seps].reverse().find((s) => s.hour <= hour) ?? null;
    return { ...NONE, level: input.sheltered ? 'shelter' : 'alert', episode: active, evidence };
  }

  const ended = catalog.radiation_episodes.filter((e) => e.end_hour <= hour && hour < e.end_hour + RECOVERY_HOURS).sort((a, b) => b.end_hour - a.end_hour)[0];
  if (ended) {
    const seps = sepsOf(catalog, ended);
    const evidence = [...seps].reverse().find((s) => s.hour <= hour) ?? null;
    return { ...NONE, level: 'recovery', episode: ended, evidence, recoveryLeft: ended.end_hour + RECOVERY_HOURS - hour };
  }

  if (input.reach !== null) {
    const next = catalog.radiation_episodes.filter((e) => e.start_hour > hour).sort((a, b) => a.start_hour - b.start_hour)[0];
    if (next) {
      const { onset, list } = precursorsOf(catalog, next);
      const seen = list.filter((l) => l.hour <= hour && onset - l.hour <= (input.reach as number)).sort((a, b) => b.hour - a.hour)[0];
      if (seen) return { ...NONE, level: 'monitoring', episode: next, precursor: seen, lagRange: lagRangeOf(catalog) };
    }
  }
  return { ...NONE, level: 'normal' };
}
