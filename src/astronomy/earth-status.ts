// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Situação da Terra no céu do site: acima do horizonte agora, ou quantas horas faltam para subir.
// Função pura: recebe a amostragem e não lê dados nem a cena.

export interface EarthSample {
  /** Elevação do centro da Terra, em graus. */
  el: number;
  /** Horizonte medido na direção da Terra, em graus. */
  horizon: number;
}

export interface EarthStatus {
  /** O centro da Terra está acima do horizonte nesta hora. */
  up: boolean;
  /** Elevação do centro agora, em graus. */
  elevation: number;
  /** Horas até o centro voltar a ficar acima do horizonte (null: não volta até o fim da partida). */
  hoursUntilUp: number | null;
}

/**
 * Situação da Terra na hora `hour`. `sampleAt(h)` devolve a amostra da hora inteira h;
 * `lastHour` é a última hora com dado (inclusive).
 */
export function earthStatus(hour: number, sampleAt: (h: number) => EarthSample, lastHour: number): EarthStatus {
  const start = Math.max(0, Math.min(lastHour, Math.floor(hour)));
  const now = sampleAt(start);
  const up = now.el > now.horizon;
  if (up) return { up: true, elevation: now.el, hoursUntilUp: 0 };
  for (let h = start + 1; h <= lastHour; h++) {
    const s = sampleAt(h);
    if (s.el > s.horizon) return { up: false, elevation: now.el, hoursUntilUp: h - start };
  }
  return { up: false, elevation: now.el, hoursUntilUp: null };
}
