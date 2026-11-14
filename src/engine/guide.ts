// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// LUMA, o assistente que guia o jogador (versão baseada em regras, sem modelo de IA em tempo de jogo).
// Escolhe a dica mais urgente a partir do estado. Só devolve chaves de texto; o texto fica em src/i18n.ts.
import type { GameState } from './game';
import { nextObjective, objectivesOf, type Objective } from './objectives';
import { isGreenhouseOn } from './resources';

export interface LumaAdvice {
  /** Chave de texto em src/i18n.ts (prefixo luma.). */
  readonly key: string;
  readonly vars: Readonly<Record<string, string | number>>;
}

/** Recurso abaixo deste nível (em %) dispara um alerta do LUMA. */
export const LUMA_LOW = 25;

export function lumaAdvice(state: GameState, stormInHours: number | null): LumaAdvice {
  const { vitals, hearts } = state;
  // 1. Perigo agora: radiação ou recurso crítico.
  if (state.crewOrder === 'auto' && state.crew.prevRadiation) {
    return { key: 'luma.radiation', vars: {} };
  }
  if (hearts <= 1) return { key: 'luma.lastHeart', vars: {} };
  // 2. Aviso da antena: tempestade em até 6 h.
  if (stormInHours !== null) return { key: 'luma.storm', vars: { hours: stormInHours } };
  // 3. Recurso baixo.
  const low: Array<[string, number]> = [
    ['battery', (vitals.battery / state.installation.batteryCapacity) * 100],
    ['air', vitals.air],
    ['water', vitals.water],
    ['food', vitals.food],
  ];
  const worst = low.reduce((a, b) => (b[1] < a[1] ? b : a));
  if (worst[1] < LUMA_LOW) return { key: `luma.low.${worst[0]}`, vars: {} };
  // 4. Próximo objetivo.
  const next: Objective | null = nextObjective(objectivesOf(state));
  if (next) return { key: `luma.next.${next.id}`, vars: {} };
  // 5. Tudo em ordem.
  return { key: isGreenhouseOn(vitals, state.installation) ? 'luma.greenhouseOn' : 'luma.calm', vars: {} };
}
