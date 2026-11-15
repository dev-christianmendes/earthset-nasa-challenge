// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Previsão da água (ROV-04): simula as próximas horas com as próprias regras do motor (consumo, fila do rover, ajuda
// da tripulação, Sol, radiação) e diz quando a água zera e quando chega a próxima entrega de gelo.
// Não muda regra nem estado: trabalha numa cópia. Motor puro.
import { advance, dispatch, outcomeOf, type GameAction, type GameState, type SunlitAt, type WeatherAt } from './game';

/** Horizonte da previsão em horas de jogo (uma missão de painel inteira cabe nele). */
export const FORECAST_HOURS = 48;

export interface WaterForecast {
  /** Horas de jogo até a água chegar a zero (null: não zera no horizonte). */
  readonly zeroIn: number | null;
  /** Horas de jogo até a próxima entrega de gelo terminar (null: nenhuma no horizonte). */
  readonly iceIn: number | null;
  /** A água zera antes de o gelo chegar (ou sem gelo à vista): é hora de avisar. */
  readonly risk: boolean;
}

/** Simula `horizon` horas, de hora em hora, a partir de uma cópia do estado. */
export function forecastWater(state: GameState, sunlit: SunlitAt, weather: WeatherAt, horizon = FORECAST_HOURS): WaterForecast {
  let s = state;
  let zeroIn: number | null = state.vitals.water <= 0 ? 0 : null;
  let iceIn: number | null = null;
  const iceBefore = state.missionsDone.ice;
  for (let h = 1; h <= horizon && outcomeOf(s) === 'playing'; h++) {
    s = advance(s, 1, sunlit, weather);
    if (zeroIn === null && s.vitals.water <= 0) zeroIn = h;
    if (iceIn === null && s.missionsDone.ice > iceBefore) iceIn = h;
    if (zeroIn !== null && iceIn !== null) break;
  }
  const risk = zeroIn !== null && (iceIn === null || iceIn > zeroIn);
  return { zeroIn, iceIn, risk };
}

/** Previsão se a ação for aceita agora (para avisar antes de enfileirar). Ação recusada: previsão do estado atual. */
export function forecastWithAction(state: GameState, action: GameAction, sunlit: SunlitAt, weather: WeatherAt, horizon = FORECAST_HOURS): WaterForecast {
  const r = dispatch(state, action);
  return forecastWater(r.ok ? r.state : state, sunlit, weather, horizon);
}
