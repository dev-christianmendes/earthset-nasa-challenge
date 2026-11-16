// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { advanceCrew, createCrew, EXPOSURE_HOURS_PER_HEART } from '../../src/engine/crew';
import { advance, createGame } from '../../src/engine/game';
import type { Installation } from '../../src/engine/resources';

const BOTH_OUT = [true, true];
const NONE_OUT = [false, false];

describe('tripulação na radiação (D-05)', () => {
  it('sem radiação, não há exposição', () => {
    const r = advanceCrew(createCrew(), BOTH_OUT, false, 1);
    expect(r.crew.exposureHours).toBe(0);
    expect(r.heartsLost).toBe(0);
  });

  it('quem está dentro do habitat não se expõe', () => {
    const r = advanceCrew(createCrew(), NONE_OUT, true, 1);
    expect(r.crew.exposureHours).toBe(0);
  });

  it('no começo da radiação, quem estava fora leva 1 hora para entrar: 2 astronautas, 2 horas', () => {
    let crew = createCrew();
    let added = 0;
    for (let i = 0; i < 3; i++) {
      const r = advanceCrew(crew, BOTH_OUT, true, 1);
      crew = r.crew;
      added = r.crew.exposureHours;
    }
    expect(added).toBe(2);
  });

  it('acumula 12 horas de exposição e registra 1 coração perdido', () => {
    let crew = createCrew();
    // Cada evento de radiação (novo começo) expõe os dois por 1 hora: 2 horas por evento.
    for (let evento = 0; evento < 6; evento++) {
      crew = advanceCrew(crew, BOTH_OUT, true, 1).crew;
      crew = advanceCrew(crew, NONE_OUT, false, 1).crew;
    }
    expect(crew.exposureHours).toBe(12);
    expect(crew.heartsLostToExposure).toBe(1);
    expect(EXPOSURE_HOURS_PER_HEART).toBe(12);
  });
});

describe('partida com tripulação exposta', () => {
  const inst: Installation = { rank: 'explorador', site: 'peak', panels: 2, batteryCapacity: 1000, greenhouse: 'always' };

  it('a estufa ligada tira o astronauta de dentro: a radiação custa o caminho até o abrigo', () => {
    const g0 = createGame({ installation: inst });
    const g1 = advance(g0, 1, true, { kp: 0, radiation: true });
    expect(g1.crew.exposureHours).toBeCloseTo(1);
    expect(g1.hearts).toBe(3);
  });

  it('sem radiação, a partida não mexe na tripulação', () => {
    const g = advance(createGame({ installation: inst }), 5, true, { kp: 0, radiation: false });
    expect(g.crew.exposureHours).toBe(0);
    expect(g.hearts).toBe(3);
  });
});
