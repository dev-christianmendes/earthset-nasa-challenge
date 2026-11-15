// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { SPACE_EVENTS } from '../../src/data/space-weather-events';
import { alertAt } from '../../src/engine/alert';
import { createGame, dispatch } from '../../src/engine/game';
import { objectivesOf, nextObjective, OBJECTIVE_PANELS } from '../../src/engine/objectives';
import { lumaAdvice } from '../../src/engine/guide';
import { crewOutside } from '../../src/engine/crew';
import type { Installation } from '../../src/engine/resources';

const INST: Installation = { rank: 'explorador', site: 'peak', panels: 2, batteryCapacity: 1000, greenhouse: 'always' };

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

  it('abrigada, a tripulação não aceita tarefas na estufa', () => {
    const g = dispatch(createGame({ installation: INST }), { type: 'SET_CREW_ORDER', order: 'shelter' });
    if (!g.ok) throw new Error('ordem recusada');
    const r = dispatch(g.state, { type: 'ASSIGN_AGENT_TASK', kind: 'inspect' });
    expect(r).toEqual({ ok: false, reason: 'crew-sheltering' });
  });
});

describe('LUMA (guia por regras)', () => {
  it('sem perigo, orienta o passo do capítulo atual e aponta o sistema do rover', () => {
    const g = createGame({ installation: INST });
    const a = lumaAdvice(g, null);
    expect(a.key).toBe('luma.chapter.1');
    expect(a.action).toBe('rover');
    expect(a.severity).toBe('info');
  });

  it('com a primeira missão na fila, acompanha a operação em vez de repetir o pedido', () => {
    const r = dispatch(createGame({ installation: INST }), { type: 'ENQUEUE_TASK', kind: 'ice' });
    if (!r.ok) throw new Error('recusado');
    expect(lumaAdvice(r.state, null).key).toBe('luma.chapter.1.wait');
  });

  it('no modo Comandante (só alertas), sem perigo fica em silêncio operacional', () => {
    const g = createGame({ installation: INST });
    expect(lumaAdvice(g, null, 'critical').key).toBe('luma.quiet');
    const low = { ...g, vitals: { ...g.vitals, water: 5 } };
    expect(lumaAdvice(low, null, 'critical')).toMatchObject({ key: 'luma.low.water', action: 'rover' });
  });

  it('em monitoramento, cita o registro da NASA e não promete tempo restante', () => {
    const g = createGame({ installation: INST });
    const ep2 = SPACE_EVENTS.radiation_episodes[1];
    const alert = alertAt(SPACE_EVENTS, ep2.start_hour - 2, { reach: 12, sheltered: false });
    const advice = lumaAdvice(g, alert);
    expect(advice.key).toMatch(/^luma\.monitor\.(FLR|CME)$/);
    expect(advice.severity).toBe('warning');
    expect(advice.vars).toMatchObject({ id: alert.precursor?.id });
    expect(advice.vars).not.toHaveProperty('hours');
  });

  it('na recuperação, pede para esperar antes de sair', () => {
    const g = createGame({ installation: INST });
    const end = SPACE_EVENTS.radiation_episodes[0].end_hour;
    const advice = lumaAdvice(g, alertAt(SPACE_EVENTS, end + 1, { reach: null, sheltered: true }));
    expect(advice).toMatchObject({ key: 'luma.recovery', severity: 'warning' });
  });

  it('com radiação e tripulação em automático, cita o registro SEP da NASA', () => {
    const g = createGame({ installation: INST });
    const alert = alertAt(SPACE_EVENTS, 1, { reach: null, sheltered: false });
    const exposed = { ...g, crew: { ...g.crew, prevRadiation: true } };
    expect(lumaAdvice(exposed, alert)).toMatchObject({ key: 'luma.radiation.src', severity: 'critical', action: 'crew' });
    expect(lumaAdvice(exposed, null).key).toBe('luma.radiation');
  });

  it('com recurso crítico, pede atenção ao recurso mais baixo', () => {
    const g = createGame({ installation: INST });
    const low = { ...g, vitals: { ...g.vitals, air: 10 } };
    expect(lumaAdvice(low, null).key).toBe('luma.low.air');
  });
});
