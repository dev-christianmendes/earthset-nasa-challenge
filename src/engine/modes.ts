// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import type { Installation, Rank } from './resources';

export type ModeId = 'explorer' | 'cadet' | 'commander';

export type LumaLevel = 'full' | 'goals' | 'critical';

export interface ModeConfig {
  readonly id: ModeId;
  /** Patente usada pelo motor para aplicar RANK_FACTOR. */
  readonly rank: Rank;
  readonly luma: LumaLevel;
  readonly explanations: boolean;
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

export function installationFor(mode: ModeId, base: Omit<Installation, 'rank'>): Installation {
  return { ...base, rank: MODES[mode].rank };
}
