// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Catálogo de eventos de clima espacial (NASA DONKI), gerado por data-pipeline/fetch_donki.py. Motor puro.
// Proveniência: observed=DONKI, from-id=horário no ID, computed=pipeline, game-rule=simulação. Não é previsão.

export type Provenance = 'observed' | 'from-id' | 'computed' | 'game-rule';

export interface LinkedEvent {
  readonly id: string;
  readonly type: string;
  readonly time_utc: string;
  /** Horas desde o início da partida (negativo = antes do início da janela). */
  readonly hour: number;
  /** Horas entre este evento e o evento que o cita (positivo = veio antes). */
  readonly lag_to_event_hours: number;
  readonly provenance: 'from-id';
}

export interface SentAlert {
  readonly id: string;
  readonly issued_utc: string;
  readonly hour: number;
  /** Horas entre o registro do evento e o alerta enviado pela NASA (negativo = o alerta saiu antes). */
  readonly delay_after_event_hours: number;
  readonly url: string | null;
}

interface EventBase {
  readonly id: string;
  readonly time_utc: string;
  readonly hour: number;
  readonly before_window_start: boolean;
  readonly link: string | null;
  readonly linked_events: readonly LinkedEvent[];
  readonly alerts: readonly SentAlert[];
  readonly provenance: 'observed';
}

export interface SepEvent extends EventBase {
  readonly type: 'SEP';
  readonly instruments: readonly string[];
}

/** GST: tempestade geomagnética. O Kp é da Terra e NÃO tem efeito no jogo. */
export interface GstEvent extends EventBase {
  readonly type: 'GST';
  readonly kp_max: number | null;
  readonly kp_source: readonly string[];
  readonly note: string;
}

export type SpaceEvent = SepEvent | GstEvent;

/** Radiação do jogo: união das janelas de 24 h dos SEP (regra de jogo; a duração não vem da DONKI). */
export interface RadiationEpisode {
  readonly id: string;
  /** Primeira hora com radiação (pode ser negativa). */
  readonly start_hour: number;
  /** Primeira hora sem radiação depois do episódio. */
  readonly end_hour: number;
  readonly before_window_start: boolean;
  readonly sep_ids: readonly string[];
  readonly provenance: 'game-rule';
}

export interface SpaceEventCatalog {
  readonly source: string;
  readonly start_utc: string;
  readonly hours: number;
  readonly radiation_rule: string;
  readonly not_downloaded: readonly string[];
  readonly events: readonly SpaceEvent[];
  readonly radiation_episodes: readonly RadiationEpisode[];
}

export const EMPTY_CATALOG: SpaceEventCatalog = {
  source: 'sem dados',
  start_utc: '',
  hours: 0,
  radiation_rule: '',
  not_downloaded: [],
  events: [],
  radiation_episodes: [],
};

function checkHour(hour: number): void {
  if (!Number.isFinite(hour)) throw new RangeError(`hora inválida para o catálogo de eventos: ${hour}`);
}

export function episodeAt(catalog: SpaceEventCatalog, hour: number): RadiationEpisode | null {
  checkHour(hour);
  return catalog.radiation_episodes.find((e) => hour >= e.start_hour && hour < e.end_hour) ?? null;
}

export function eventsUntil(catalog: SpaceEventCatalog, hour: number): readonly SpaceEvent[] {
  checkHour(hour);
  return catalog.events.filter((e) => e.hour <= hour);
}

export function linkedEventsUntil(event: SpaceEvent, hour: number): SpaceEvent['linked_events'] {
  checkHour(hour);
  return event.linked_events.filter((l) => l.hour <= hour);
}

export function alertsUntil(event: SpaceEvent, hour: number): SpaceEvent['alerts'] {
  checkHour(hour);
  return event.alerts.filter((a) => a.hour <= hour);
}
