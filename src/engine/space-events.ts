// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Catálogo de eventos de clima espacial (NASA DONKI), gerado por data-pipeline/fetch_donki.py. Motor puro.
// Cada campo tem proveniência: observed (registro da DONKI), from-id (horário lido do ID de um evento ligado),
// computed (conta do pipeline) ou game-rule (regra de jogo). Nada aqui é previsão.

export type Provenance = 'observed' | 'from-id' | 'computed' | 'game-rule';

export interface LinkedEvent {
  readonly id: string;
  /** Tipo lido do ID: FLR (erupção), CME (ejeção de massa coronal), IPS (choque interplanetário), MPC etc. */
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

/** SEP: partículas solares energéticas. É o que importa para a radiação na superfície lunar. */
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

/** Catálogo vazio: janela sem eventos ou dados indisponíveis. O jogo continua, sem radiação. */
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

/** Episódio de radiação em curso na hora `hour`, ou null. */
export function episodeAt(catalog: SpaceEventCatalog, hour: number): RadiationEpisode | null {
  checkHour(hour);
  return catalog.radiation_episodes.find((e) => hour >= e.start_hour && hour < e.end_hour) ?? null;
}

/** Eventos já registrados até a hora `hour` (inclusive), do mais antigo ao mais novo. Não mostra o futuro. */
export function eventsUntil(catalog: SpaceEventCatalog, hour: number): readonly SpaceEvent[] {
  checkHour(hour);
  return catalog.events.filter((e) => e.hour <= hour);
}
