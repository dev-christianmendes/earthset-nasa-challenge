// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { isGreenhouseOn } from '../../src/engine/resources';
import { describe, expect, it } from 'vitest';
import { applyFlow, deriveFlow, startingVitals, type Installation, type Vitals } from '../../src/engine/resources';

const base: Installation = { rank: 'explorador', site: 'peak', panels: 2, batteryCapacity: 100, greenhouse: 'off' };
const calm: Vitals = { battery: 50, air: 100, water: 50, food: 50 };

describe('energia por hora', () => {
  it('soma geração com Sol e subtrai carga da base e aquecimento', () => {
    // 2 painéis × 0,9 = 1,8; carga 0,8 + aquecimento do morro com Sol 0,5 = 1,3; saldo +0,5
    const f = deriveFlow(calm, base, true);
    expect(f.energy).toBeCloseTo(0.5);
  });

  it('sem Sol, não há geração e o aquecimento sobe', () => {
    // carga 0,8 + aquecimento sem Sol 1,3 = 2,1; saldo −2,1
    const f = deriveFlow(calm, base, false);
    expect(f.energy).toBeCloseTo(-2.1);
  });
});

describe('ar, água e comida por patente', () => {
  it.each([
    ['cadete', 0.75],
    ['explorador', 1],
    ['comandante', 1.15],
  ] as const)('consumo de ar da patente %s', (rank, factor) => {
    const f = deriveFlow(calm, { ...base, rank }, true);
    expect(f.air).toBeCloseTo(-factor);
    expect(f.water).toBeCloseTo(-0.2 * factor);
    expect(f.food).toBeCloseTo(-0.2 * factor);
  });

  it('eletrólise liga com ar abaixo de 90, com água e bateria acima de 5%', () => {
    const f = deriveFlow({ battery: 50, air: 80, water: 50, food: 50 }, base, true);
    expect(f.electrolysisOn).toBe(true);
    expect(f.air).toBeCloseTo(-1 + 2);
    expect(f.water).toBeCloseTo(-0.2 - 0.4);
  });

  it('eletrólise não liga sem água', () => {
    const f = deriveFlow({ battery: 50, air: 80, water: 0, food: 50 }, base, true);
    expect(f.electrolysisOn).toBe(false);
  });
});

describe('estufa', () => {
  it('modo sempre liga com bateria acima de 10%, e dá comida com água', () => {
    const f = deriveFlow({ battery: 50, air: 100, water: 50, food: 50 }, { ...base, greenhouse: 'always' }, true);
    expect(f.greenhouseOn).toBe(true);
    expect(f.food).toBeCloseTo(-0.2 + 0.38);
    expect(f.water).toBeCloseTo(-0.2 - 0.08);
  });

  it('modo só com sobra exige bateria acima de 50%', () => {
    const low = deriveFlow({ battery: 45, air: 100, water: 50, food: 50 }, { ...base, greenhouse: 'surplus' }, true);
    const high = deriveFlow({ battery: 60, air: 100, water: 50, food: 50 }, { ...base, greenhouse: 'surplus' }, true);
    expect(low.greenhouseOn).toBe(false);
    expect(high.greenhouseOn).toBe(true);
  });

  it('modo economia (bateria abaixo de 40%) desliga a estufa mesmo em modo sempre', () => {
    const f = deriveFlow({ battery: 30, air: 100, water: 50, food: 50 }, { ...base, greenhouse: 'always' }, true);
    expect(f.economy).toBe(true);
    expect(f.greenhouseOn).toBe(false);
  });

  it('sem água, a estufa não dá comida', () => {
    const f = deriveFlow({ battery: 50, air: 100, water: 0, food: 50 }, { ...base, greenhouse: 'always' }, true);
    expect(f.greenhouseOn).toBe(true);
    expect(f.food).toBeCloseTo(-0.2);
  });
});

describe('limites físicos', () => {
  it('bateria não passa da capacidade e não fica negativa', () => {
    const full = applyFlow({ battery: 99.9, air: 0, water: 0, food: 0 }, { energy: 5, air: 0, water: 0, food: 0, greenhouseOn: false, electrolysisOn: false, economy: false }, base, 1);
    expect(full.battery).toBe(100);
    const empty = applyFlow({ battery: 0.1, air: 0, water: 0, food: 0 }, { energy: -5, air: 0, water: 0, food: 0, greenhouseOn: false, electrolysisOn: false, economy: false }, base, 1);
    expect(empty.battery).toBe(0);
  });

  it('partida começa com 80% da bateria e 80/50/40 de ar, água e comida', () => {
    expect(startingVitals(100)).toEqual({ battery: 80, air: 80, water: 50, food: 40 });
  });
});

describe('estufa ligada (para a animação da tela)', () => {
  const inst = { rank: 'explorador', site: 'peak', panels: 2, batteryCapacity: 1000, greenhouse: 'surplus' } as const;
  it('só com sobra: liga acima de 50% de bateria, desliga na economia', () => {
    expect(isGreenhouseOn({ battery: 600, air: 80, water: 50, food: 40 }, inst)).toBe(true);
    expect(isGreenhouseOn({ battery: 400, air: 80, water: 50, food: 40 }, inst)).toBe(false);
  });
  it('desligada no modo off, mesmo com bateria cheia', () => {
    expect(isGreenhouseOn({ battery: 1000, air: 80, water: 50, food: 40 }, { ...inst, greenhouse: 'off' })).toBe(false);
  });
});
