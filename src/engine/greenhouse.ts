// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.

export type Care = 'low' | 'normal' | 'high';
export const CARE_LEVELS: readonly Care[] = ['low', 'normal', 'high'];

export interface CropState {
  /** Crescimento da cultura, de 0 a 100 (100 = pronta para colher). */
  readonly growth: number;
  /** Desgaste dos equipamentos da estufa, de 0 a 100. */
  readonly wear: number;
  readonly irrigation: Care;
  readonly lighting: Care;
  readonly harvests: number;
}

/** Cultivo e desgaste são regras de jogo; valores em docs/regras-recursos.md. */
export const GROW_HOURS = 12;
/** Comida (0 a 100) por colheita. */
export const HARVEST_FOOD = 10;
export const WEAR_PER_HOUR = 0.25;
export const WEAR_MAX_PENALTY = 0.4;
export const STAGE_DEVELOPED = 34;

/** Multiplicadores: `growth` no ritmo de crescimento; `use` no consumo (água ou energia da estufa). */
export const IRRIGATION: Readonly<Record<Care, { growth: number; use: number }>> = {
  low: { growth: 0.8, use: 0.5 },
  normal: { growth: 1, use: 1 },
  high: { growth: 1.25, use: 2 },
};
export const LIGHTING: Readonly<Record<Care, { growth: number; use: number }>> = {
  low: { growth: 0.8, use: 0.6 },
  normal: { growth: 1, use: 1 },
  high: { growth: 1.25, use: 1.5 },
};

export type CropStage = 'seedling' | 'developed' | 'ready';

export function createCrop(): CropState {
  return { growth: 0, wear: 0, irrigation: 'normal', lighting: 'normal', harvests: 0 };
}

export function cropStage(crop: CropState): CropStage {
  if (crop.growth >= 100) return 'ready';
  return crop.growth >= STAGE_DEVELOPED ? 'developed' : 'seedling';
}

export function efficiency(crop: CropState): number {
  return 1 - WEAR_MAX_PENALTY * (crop.wear / 100);
}

/** Crescimento por hora de estufa ligada, em pontos de 0 a 100. */
export function growthPerHour(crop: CropState): number {
  return (100 / GROW_HOURS) * IRRIGATION[crop.irrigation].growth * LIGHTING[crop.lighting].growth * efficiency(crop);
}

export function hoursToReady(crop: CropState): number {
  return crop.growth >= 100 ? 0 : (100 - crop.growth) / growthPerHour(crop);
}

export function stepCrop(crop: CropState, hours: number, running: boolean): CropState {
  if (!running || hours <= 0) return crop;
  return {
    ...crop,
    growth: Math.min(100, crop.growth + growthPerHour(crop) * hours),
    wear: Math.min(100, crop.wear + WEAR_PER_HOUR * hours),
  };
}

export function harvestCrop(crop: CropState): CropState {
  return { ...crop, growth: 0, harvests: crop.harvests + 1 };
}
