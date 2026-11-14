// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import {
  MAX_PANELS,
  MAX_QUEUE,
  TASK_HOURS,
  cancelTask,
  createRobot,
  enqueueTask,
  isWorking,
  progressRobot,
  rejectTask,
  type RobotState,
} from '../../src/engine/robot';

function withQueue(kinds: Array<'ice' | 'panel' | 'antenna'>): RobotState {
  return kinds.reduce((r, k) => enqueueTask(r, k), createRobot());
}

describe('fila do robô', () => {
  it('aceita tarefa com fila livre e a põe no fim, com o tempo da tarefa', () => {
    const r = enqueueTask(createRobot(), 'ice');
    expect(r.queue).toEqual([{ kind: 'ice', hoursLeft: TASK_HOURS.ice }]);
  });

  it('recusa a quinta tarefa', () => {
    const full = withQueue(['ice', 'ice', 'ice', 'ice']);
    expect(full.queue).toHaveLength(MAX_QUEUE);
    expect(rejectTask(full, 'ice', 2)).toMatch(/fila cheia/);
  });

  it('recusa painel além do limite, contando os da fila', () => {
    const r = withQueue(['panel']);
    expect(rejectTask(r, 'panel', MAX_PANELS - 1)).toMatch(/limite/);
    expect(rejectTask(r, 'panel', MAX_PANELS - 2)).toBeNull();
  });

  it('recusa segunda antena, na fila ou já instalada', () => {
    expect(rejectTask(withQueue(['antenna']), 'antenna', 2)).toMatch(/antena/);
    const installed: RobotState = { ...createRobot(), antennaInstalled: true };
    expect(rejectTask(installed, 'antenna', 2)).toMatch(/antena/);
  });

  it('cancela pela posição e ignora posição inválida', () => {
    const r = withQueue(['ice', 'panel', 'antenna']);
    expect(cancelTask(r, 1).queue.map((t) => t.kind)).toEqual(['ice', 'antenna']);
    expect(cancelTask(r, 9)).toBe(r);
    expect(cancelTask(r, -1)).toBe(r);
  });
});

describe('andamento das tarefas', () => {
  it('não faz nada com fila vazia', () => {
    const p = progressRobot(createRobot(), 5);
    expect(p.completed).toEqual([]);
    expect(p.robot.queue).toEqual([]);
  });

  it('reduz o tempo da tarefa sem concluir quando o passo é curto', () => {
    const p = progressRobot(withQueue(['ice']), 2);
    expect(p.completed).toEqual([]);
    expect(p.robot.queue[0].hoursLeft).toBeCloseTo(TASK_HOURS.ice - 2);
  });

  it('conclui e passa o tempo que sobra para a próxima tarefa', () => {
    const p = progressRobot(withQueue(['panel', 'ice']), TASK_HOURS.panel + 1);
    expect(p.completed).toEqual(['panel']);
    expect(p.robot.queue[0]).toEqual({ kind: 'ice', hoursLeft: TASK_HOURS.ice - 1 });
  });

  it('marca a antena como instalada ao concluí-la', () => {
    const p = progressRobot(withQueue(['antenna']), TASK_HOURS.antenna);
    expect(p.completed).toEqual(['antenna']);
    expect(p.robot.antennaInstalled).toBe(true);
  });

  it('recusa horas negativas ou não finitas', () => {
    expect(() => progressRobot(createRobot(), -1)).toThrow(RangeError);
    expect(() => progressRobot(createRobot(), Number.NaN)).toThrow(RangeError);
  });
});

describe('trabalho do robô', () => {
  it('só trabalha com tarefa na fila e energia na base', () => {
    expect(isWorking(createRobot(), 50)).toBe(false);
    expect(isWorking(withQueue(['ice']), 0)).toBe(false);
    expect(isWorking(withQueue(['ice']), 0.1)).toBe(true);
  });
});
