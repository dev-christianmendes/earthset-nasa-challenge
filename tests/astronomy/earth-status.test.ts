// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { earthStatus, type EarthSample } from '../../src/astronomy/earth-status';

const series: EarthSample[] = [
  -3, -2, -1, -0.5, -0.2, 1, 2, 3, -1, -2,
].map((el) => ({ el, horizon: 0 }));
const at = (h: number) => series[h];

describe('situação da Terra no céu', () => {
  it('mostra que está acima do horizonte quando o centro passa do horizonte medido', () => {
    expect(earthStatus(6, at, 9)).toEqual({ up: true, elevation: 2, hoursUntilUp: 0 });
  });

  it('conta as horas até subir quando está abaixo', () => {
    expect(earthStatus(2, at, 9)).toEqual({ up: false, elevation: -1, hoursUntilUp: 3 });
  });

  it('usa o horizonte medido da direção, não zero', () => {
    const high: EarthSample[] = [{ el: 2, horizon: 4 }, { el: 5, horizon: 4 }];
    expect(earthStatus(0, (h) => high[h], 1)).toEqual({ up: false, elevation: 2, hoursUntilUp: 1 });
  });

  it('informa que não sobe quando a partida acaba antes', () => {
    expect(earthStatus(8, at, 9)).toEqual({ up: false, elevation: -1, hoursUntilUp: null });
  });

  it('nunca lê fora do intervalo de dados', () => {
    expect(earthStatus(50, at, 9).up).toBe(false);
    expect(earthStatus(-4, at, 9).up).toBe(false);
  });
});
