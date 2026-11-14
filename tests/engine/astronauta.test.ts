// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// D-18: astronautas com tarefas reais. Máquina de estados, ordens válidas e inválidas, cancelamento,
// pausa (tempo zero), velocidade (passos diferentes, mesmo resultado) e abrigo.
import { describe, expect, it } from 'vitest';
import {
  PREP_HOURS,
  REST_HOURS,
  TASK_ENERGY_COST,
  TRAVEL_HOURS,
  WORK_HOURS,
  agentStatus,
  cancelAgentTask,
  createAgents,
  isAvailable,
  newTask,
  stepAgent,
  taskFraction,
  type AgentState,
} from '../../src/engine/astronaut';
import { MATCH_HOURS } from '../../src/engine/clock';
import { advance, createGame, dispatch, outcomeOf, type GameAction, type GameState } from '../../src/engine/game';
import type { Installation } from '../../src/engine/resources';

const CALM = { kp: 0, radiation: false };
const STORM = { kp: 0, radiation: true };
const INST: Installation = { rank: 'explorador', site: 'peak', panels: 12, batteryCapacity: 1200, greenhouse: 'always' };
const total = (kind: 'inspect' | 'harvest' | 'maintain'): number => PREP_HOURS + TRAVEL_HOURS + WORK_HOURS[kind] + TRAVEL_HOURS;
const TOTAL_HARVEST = total('harvest');

function fresh(): GameState {
  return createGame({ installation: INST });
}
function ok(s: GameState, a: GameAction): GameState {
  const r = dispatch(s, a);
  if (!r.ok) throw new Error(`ação recusada: ${r.reason}`);
  return r.state;
}
function reason(s: GameState, a: GameAction): string {
  const r = dispatch(s, a);
  if (r.ok) throw new Error('ação aceita, era esperada recusa');
  return r.reason;
}
function ripe(): GameState {
  let g = fresh();
  for (let h = 0; h < 13; h++) g = advance(g, 1, true, CALM);
  return g;
}

describe('máquina de estados do astronauta', () => {
  it('percorre assigned, walking, working, returning, resting e idle', () => {
    let a: AgentState = { task: newTask('harvest'), restLeft: 0 };
    const seen: string[] = [agentStatus(a, false)];
    for (let i = 0; i < 1000; i++) {
      a = stepAgent(a, 0.05, false).agent;
      const st = agentStatus(a, false);
      if (seen[seen.length - 1] !== st) seen.push(st);
    }
    expect(seen).toEqual(['assigned', 'walking', 'working', 'returning', 'resting', 'idle']);
  });

  it('o efeito vale uma vez, ao fim do trabalho', () => {
    let a: AgentState = { task: newTask('inspect'), restLeft: 0 };
    let done = 0;
    for (let i = 0; i < 400; i++) {
      const r = stepAgent(a, 0.1, false);
      a = r.agent;
      if (r.completed) done++;
    }
    expect(done).toBe(1);
  });

  it('um passo grande atravessa várias fases e dá o mesmo resultado dos passos pequenos', () => {
    const big = stepAgent({ task: newTask('harvest'), restLeft: 0 }, TOTAL_HARVEST + 0.5, false);
    let a: AgentState = { task: newTask('harvest'), restLeft: 0 };
    let completed = null;
    for (let i = 0; i < 100; i++) {
      const r = stepAgent(a, (TOTAL_HARVEST + 0.5) / 100, false);
      a = r.agent;
      completed = completed ?? r.completed;
    }
    expect(big.completed).toBe('harvest');
    expect(completed).toBe('harvest');
    expect(big.agent.task).toBeNull();
    expect(a.task).toBeNull();
    expect(big.agent.restLeft).toBeCloseTo(a.restLeft, 6);
    expect(big.agent.restLeft).toBeCloseTo(REST_HOURS - 0.5, 6);
  });

  it('abrigo suspende a tarefa e o tempo não anda', () => {
    const a: AgentState = { task: newTask('harvest'), restLeft: 0 };
    const r = stepAgent(a, 5, true);
    expect(r.agent).toBe(a);
    expect(agentStatus(a, true)).toBe('sheltering');
  });

  it('tempo zero (pausa) não muda nada', () => {
    const a: AgentState = { task: newTask('harvest'), restLeft: 0 };
    expect(stepAgent(a, 0, false).agent).toBe(a);
  });

  it('a barra de progresso vai de 0 a 1', () => {
    expect(taskFraction(newTask('harvest'))).toBe(0);
    const late = stepAgent({ task: newTask('harvest'), restLeft: 0 }, TOTAL_HARVEST - 0.1, false).agent.task;
    expect(late && taskFraction(late)).toBeGreaterThan(0.95);
  });

  it('cancelar antes de sair apaga a tarefa; fora, o astronauta volta sem efeito', () => {
    expect(cancelAgentTask({ task: newTask('harvest'), restLeft: 0 }).task).toBeNull();
    const walking = stepAgent({ task: newTask('harvest'), restLeft: 0 }, PREP_HOURS + 0.5, false).agent;
    const back = cancelAgentTask(walking).task;
    expect(back?.phase).toBe('back');
    expect(back?.hoursLeft).toBeCloseTo(0.5, 6);
    const r = stepAgent(cancelAgentTask(walking), 2, false);
    expect(r.completed).toBeNull();
  });
});

describe('ordens do jogador aos astronautas', () => {
  it('ordem válida atribui ao primeiro disponível e muda o estado na hora', () => {
    const s = ok(fresh(), { type: 'ASSIGN_AGENT_TASK', kind: 'inspect' });
    expect(s.agents[0].task?.kind).toBe('inspect');
    expect(agentStatus(s.agents[0], false)).toBe('assigned');
    expect(s.agents[1].task).toBeNull();
  });

  it('escolher o astronauta é respeitado; ocupado é recusado', () => {
    let s = ok({ ...fresh(), crop: { ...fresh().crop, wear: 40 } }, { type: 'ASSIGN_AGENT_TASK', kind: 'inspect', agent: 1 });
    expect(s.agents[1].task?.kind).toBe('inspect');
    expect(reason(s, { type: 'ASSIGN_AGENT_TASK', kind: 'inspect', agent: 1 })).toBe('task-in-progress');
    expect(reason(s, { type: 'ASSIGN_AGENT_TASK', kind: 'maintain', agent: 1 })).toBe('agent-busy');
  });

  it('astronauta ocupado ou descansando não aceita outra tarefa', () => {
    let s = fresh();
    s = { ...s, crop: { ...s.crop, wear: 50 } };
    s = ok(s, { type: 'ASSIGN_AGENT_TASK', kind: 'inspect', agent: 0 });
    expect(reason(s, { type: 'ASSIGN_AGENT_TASK', kind: 'maintain', agent: 0 })).toBe('agent-busy');
    s = advance(s, total('inspect') + 0.1, true, CALM);
    expect(s.agents[0].restLeft).toBeGreaterThan(0);
    expect(isAvailable(s.agents[0])).toBe(false);
    expect(reason(s, { type: 'ASSIGN_AGENT_TASK', kind: 'maintain', agent: 0 })).toBe('agent-busy');
  });

  it('sem astronauta livre, recusa', () => {
    let s = fresh();
    s = { ...s, crop: { ...s.crop, wear: 50, growth: 100 } };
    s = ok(s, { type: 'ASSIGN_AGENT_TASK', kind: 'inspect' });
    s = ok(s, { type: 'ASSIGN_AGENT_TASK', kind: 'harvest' });
    expect(reason(s, { type: 'ASSIGN_AGENT_TASK', kind: 'maintain' })).toBe('agent-busy');
  });

  it('colher sem cultura pronta é recusado', () => {
    expect(reason(fresh(), { type: 'ASSIGN_AGENT_TASK', kind: 'harvest' })).toBe('crop-not-ready');
  });

  it('manutenção sem desgaste é recusada; com pouca bateria também', () => {
    expect(reason(fresh(), { type: 'ASSIGN_AGENT_TASK', kind: 'maintain' })).toBe('no-wear');
    const s = fresh();
    const weak = { ...s, crop: { ...s.crop, wear: 60 }, vitals: { ...s.vitals, battery: TASK_ENERGY_COST.maintain - 1 } };
    expect(reason(weak, { type: 'ASSIGN_AGENT_TASK', kind: 'maintain' })).toBe('low-battery');
  });

  it('manutenção cobra energia na hora e zera o desgaste ao concluir', () => {
    const s0 = fresh();
    let s = { ...s0, crop: { ...s0.crop, wear: 60 } };
    const battery = s.vitals.battery;
    s = ok(s, { type: 'ASSIGN_AGENT_TASK', kind: 'maintain' });
    expect(s.vitals.battery).toBe(battery - TASK_ENERGY_COST.maintain);
    s = advance(s, total('maintain') + 0.1, true, CALM);
    expect(s.crop.wear).toBeLessThan(10);
    expect(s.agentTasksDone.maintain).toBe(1);
  });

  it('inspeção alivia parte do desgaste', () => {
    const s0 = fresh();
    let s = ok({ ...s0, crop: { ...s0.crop, wear: 50 } }, { type: 'ASSIGN_AGENT_TASK', kind: 'inspect' });
    s = { ...s, installation: { ...s.installation, greenhouse: 'off' } };
    s = advance(s, total('inspect') + 0.1, true, CALM);
    expect(s.crop.wear).toBe(30);
  });

  it('astronauta inexistente e tipo desconhecido são recusados', () => {
    expect(reason(fresh(), { type: 'ASSIGN_AGENT_TASK', kind: 'inspect', agent: 5 })).toBe('no-such-agent');
    expect(reason(fresh(), { type: 'ASSIGN_AGENT_TASK', kind: 'voar' as never })).toBe('unknown-task');
  });

  it('cancelar a tarefa devolve o astronauta; sem tarefa ou já voltando, recusa', () => {
    let s = ok(fresh(), { type: 'ASSIGN_AGENT_TASK', kind: 'inspect' });
    expect(reason(s, { type: 'CANCEL_AGENT_TASK', agent: 1 })).toBe('no-agent-task');
    s = advance(s, PREP_HOURS + 0.5, true, CALM);
    s = ok(s, { type: 'CANCEL_AGENT_TASK', agent: 0 });
    expect(s.agents[0].task?.phase).toBe('back');
    expect(reason(s, { type: 'CANCEL_AGENT_TASK', agent: 0 })).toBe('already-returning');
    s = advance(s, 8, true, CALM);
    expect(s.agentTasksDone.inspect).toBe(0);
  });

  it('abrigar a tripulação recusa novas tarefas e suspende as ativas', () => {
    let s = ok(fresh(), { type: 'ASSIGN_AGENT_TASK', kind: 'inspect' });
    s = advance(s, 1, true, CALM);
    const left = s.agents[0].task?.hoursLeft;
    s = ok(s, { type: 'SET_CREW_ORDER', order: 'shelter' });
    s = advance(s, 5, true, CALM);
    expect(s.agents[0].task?.hoursLeft).toBe(left);
    expect(reason(s, { type: 'ASSIGN_AGENT_TASK', kind: 'maintain' })).toBe('crew-sheltering');
  });

  it('a radiação suspende a tarefa e ela retoma depois', () => {
    let s = ok(fresh(), { type: 'ASSIGN_AGENT_TASK', kind: 'inspect' });
    s = advance(s, 1, true, CALM);
    const before = taskFraction(s.agents[0].task!);
    s = advance(s, 2, true, STORM);
    expect(taskFraction(s.agents[0].task!)).toBe(before);
    s = advance(s, 1, true, CALM);
    expect(taskFraction(s.agents[0].task!)).toBeGreaterThan(before);
  });

  it('colheita concluída soma comida uma vez e recomeça o cultivo', () => {
    let s = ok(ripe(), { type: 'ASSIGN_AGENT_TASK', kind: 'harvest' });
    const food = s.vitals.food;
    s = advance(s, TOTAL_HARVEST + 0.1, true, CALM);
    expect(s.agentTasksDone.harvest).toBe(1);
    expect(s.crop.harvests).toBe(1);
    expect(s.vitals.food).toBeGreaterThan(food);
    expect(s.crop.growth).toBeLessThan(100);
  });

  it('cuidado da estufa: valores válidos mudam, inválidos são recusados', () => {
    const s = ok(fresh(), { type: 'SET_GREENHOUSE_CARE', irrigation: 'high' });
    expect(s.crop.irrigation).toBe('high');
    expect(s.crop.lighting).toBe('normal');
    expect(reason(fresh(), { type: 'SET_GREENHOUSE_CARE', lighting: 'turbo' as never })).toBe('invalid-mode');
  });

  it('a ordem não altera o estado de entrada', () => {
    const s = fresh();
    const copy = JSON.stringify(s);
    ok(s, { type: 'ASSIGN_AGENT_TASK', kind: 'inspect' });
    expect(JSON.stringify(s)).toBe(copy);
  });

  it('após o fim da partida, ordens são recusadas', () => {
    let s = fresh();
    s = advance(s, MATCH_HOURS, true, CALM);
    expect(outcomeOf(s)).not.toBe('playing');
    expect(reason(s, { type: 'ASSIGN_AGENT_TASK', kind: 'inspect' })).toBe('match-over');
  });
});

describe('estado inicial e reinício', () => {
  it('nova partida tem astronautas livres e cultivo do zero', () => {
    const s = fresh();
    expect(s.agents).toEqual(createAgents());
    expect(s.agents.every((a) => a.task === null && a.restLeft === 0)).toBe(true);
    expect(s.crop.growth).toBe(0);
  });
});
