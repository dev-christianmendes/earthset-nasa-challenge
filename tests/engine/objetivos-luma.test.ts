// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { advance, createGame, dispatch } from '../../src/engine/game';
import { objectivesOf, nextObjective, OBJECTIVE_PANELS } from '../../src/engine/objectives';
import { lumaAdvice } from '../../src/engine/guide';
import { crewOutside } from '../../src/engine/crew';
import type { Installation } from '../../src/engine/resources';

const INST: Installation = { rank: 'explorador', site: 'peak', panels: 2, batteryCapacity: 1000, greenhouse: 'always' };
const CALM = { kp: 0, radiation: false };

describe('objetivos da missão', () => {
  it('começa com 4 objetivos, nenhum cumprido, e o primeiro é o de painéis', () => {
    const objs = objectivesOf(createGame({ installation: INST }));
    expect(objs.map((o) => o.id)).toEqual(['panels', 'ice', 'antenna', 'survive']);
    expect(objs.every((o) => !o.done)).toBe(true);
    expect(nextObjective(objs)?.id).toBe('panels');
  });

  it('o progresso dos painéis sobe com as instalações e cumpre em 4', () => {
    const g = { ...createGame({ installation: { ...INST, panels: OBJECTIVE_PANELS } }) };
    expect(objectivesOf(g)[0].done).toBe(true);
  });

  it('sem objetivos pendentes, não há próxima recomendação', () => {
    const g = createGame({ installation: { ...INST, panels: 4 } });
    const done = { ...g, robot: { ...g.robot, antennaInstalled: true }, vitals: { ...g.vitals, water: 90 }, clock: { ...g.clock, hour: 100 } };
    expect(nextObjective(objectivesOf(done))).toBeNull();
  });
});

describe('ordem de abrigo da tripulação', () => {
  it('abrigar tira a tripulação de fora: nenhum astronauta conta como exposto', () => {
    const g = createGame({ installation: INST });
    expect(crewOutside(INST, g.vitals, g.robot, 'shelter')).toEqual([false, false]);
  });

  it('o jogador pode mudar a ordem, e a ordem inválida é recusada', () => {
    const g = createGame({ installation: INST });
    const r = dispatch(g, { type: 'SET_CREW_ORDER', order: 'shelter' });
    expect(r.ok && r.state.crewOrder).toBe('shelter');
    expect(dispatch(g, { type: 'SET_CREW_ORDER', order: 'pular' as never }).ok).toBe(false);
  });

  it('abrigada, a tripulação não colhe na estufa', () => {
    let g = dispatch(createGame({ installation: INST }), { type: 'SET_CREW_ORDER', order: 'shelter' });
    if (!g.ok) throw new Error('ordem recusada');
    let s = g.state;
    for (let h = 0; h < 13; h++) s = advance(s, 1, true, CALM);
    expect(s.greenhouseHours).toBe(0);
  });
});

describe('LUMA (guia por regras)', () => {
  it('sem perigo, recomenda o próximo objetivo', () => {
    const g = createGame({ installation: INST });
    expect(lumaAdvice(g, null).key).toBe('luma.next.panels');
  });

  it('com tempestade anunciada, avisa com as horas restantes', () => {
    const g = createGame({ installation: INST });
    expect(lumaAdvice(g, 3)).toEqual({ key: 'luma.storm', vars: { hours: 3 } });
  });

  it('com recurso crítico, pede atenção ao recurso mais baixo', () => {
    const g = createGame({ installation: INST });
    const low = { ...g, vitals: { ...g.vitals, air: 10 } };
    expect(lumaAdvice(low, null).key).toBe('luma.low.air');
  });
});
