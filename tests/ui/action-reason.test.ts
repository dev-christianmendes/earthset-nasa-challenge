// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createGame, dispatch } from '../../src/engine/game';
import { MAX_PANELS, MAX_QUEUE } from '../../src/engine/robot';
import { setLang } from '../../src/i18n';
import { reasonText } from '../../src/ui/action-reason';

beforeEach(() => vi.stubGlobal('document', { documentElement: { lang: '' } }));
afterEach(() => {
  setLang('en');
  vi.unstubAllGlobals();
});

describe('motivos de recusa na interface (UXR-06)', () => {
  it.each(['en', 'pt'] as const)('informa a capacidade da fila em %s a partir da recusa real do motor', (lang) => {
    setLang(lang);
    let state = createGame({ installation: { rank: 'cadete', site: 'peak', panels: 2, batteryCapacity: 1000, greenhouse: 'off' } });
    for (let i = 0; i < MAX_QUEUE; i++) {
      const result = dispatch(state, { type: 'ENQUEUE_TASK', kind: 'ice' });
      if (!result.ok) throw new Error(result.reason);
      state = result.state;
    }
    const result = dispatch(state, { type: 'ENQUEUE_TASK', kind: 'ice' });
    if (result.ok) throw new Error('a fila cheia aceitou outra tarefa');
    expect(reasonText(result.reason)).toBe(lang === 'en' ? `Queue full (max ${MAX_QUEUE} tasks).` : `Fila cheia (máximo de ${MAX_QUEUE} tarefas).`);
  });

  it.each(['en', 'pt'] as const)('informa o limite de painéis em %s sem reutilizar a capacidade da fila', (lang) => {
    setLang(lang);
    const state = createGame({ installation: { rank: 'cadete', site: 'peak', panels: MAX_PANELS, batteryCapacity: 1000, greenhouse: 'off' } });
    const result = dispatch(state, { type: 'ENQUEUE_TASK', kind: 'panel' });
    if (result.ok) throw new Error('aceitou painel além do limite');
    expect(reasonText(result.reason)).toBe(lang === 'en' ? `Panel limit of ${MAX_PANELS} reached.` : `Limite de ${MAX_PANELS} painéis atingido.`);
  });
});
