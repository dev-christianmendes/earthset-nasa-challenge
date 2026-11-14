// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Modos de experiência (D-17). Mesmo núcleo científico nos três; a diferença é o fator de consumo já
// existente e testado (patente do motor) e quanto a interface ajuda. Não é classificação etária.
import type { Installation, Rank } from './resources';

export type ModeId = 'explorer' | 'cadet' | 'commander';

/** Quanto a LUMA fala: tudo, dicas de objetivo e alertas, ou só alertas críticos. */
export type LumaLevel = 'full' | 'goals' | 'critical';

export interface ModeConfig {
  readonly id: ModeId;
  /** Patente do motor (fator de consumo em RANK_FACTOR). Nomes anteriores aos modos; ver D-17. */
  readonly rank: Rank;
  readonly luma: LumaLevel;
  /** Explicações "o quê / por quê / fonte" ao lado dos recursos (modo escola). */
  readonly explanations: boolean;
  /** HUD técnico: números de fluxo por hora e dados de Sol e clima no topo. */
  readonly technicalHud: boolean;
}

export const MODES: Readonly<Record<ModeId, ModeConfig>> = {
  explorer: { id: 'explorer', rank: 'cadete', luma: 'full', explanations: true, technicalHud: false },
  cadet: { id: 'cadet', rank: 'explorador', luma: 'goals', explanations: false, technicalHud: false },
  commander: { id: 'commander', rank: 'comandante', luma: 'critical', explanations: false, technicalHud: true },
};

export const MODE_IDS: readonly ModeId[] = ['explorer', 'cadet', 'commander'];

export function isModeId(value: unknown): value is ModeId {
  return typeof value === 'string' && (MODE_IDS as readonly string[]).includes(value);
}

/** Instalação inicial do modo: mesma base, só a patente muda. */
export function installationFor(mode: ModeId, base: Omit<Installation, 'rank'>): Installation {
  return { ...base, rank: MODES[mode].rank };
}
