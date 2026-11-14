// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Cultivo da estufa (D-18, docs/DECISOES.md). Motor puro, determinístico.
// A cultura cresce com a estufa ligada; irrigação e iluminação trocam consumo por velocidade; o desgaste
// reduz a eficiência até alguém fazer manutenção. A comida só entra no estoque quando um astronauta colhe.

export type Care = 'low' | 'normal' | 'high';
export const CARE_LEVELS: readonly Care[] = ['low', 'normal', 'high'];

export interface CropState {
  /** Crescimento da cultura, de 0 a 100 (100 = pronta para colher). */
  readonly growth: number;
  /** Desgaste dos equipamentos da estufa, de 0 a 100. */
  readonly wear: number;
  readonly irrigation: Care;
  readonly lighting: Care;
  /** Colheitas já feitas. */
  readonly harvests: number;
}

/** Horas para a cultura amadurecer com cuidado normal e sem desgaste. */
export const GROW_HOURS = 12;
/** Comida (0 a 100) por colheita. */
export const HARVEST_FOOD = 10;
/** Desgaste por hora de estufa ligada. */
export const WEAR_PER_HOUR = 0.25;
/** Perda máxima de eficiência com desgaste 100. */
export const WEAR_MAX_PENALTY = 0.4;
/** Fração do crescimento a partir da qual a cultura já está "desenvolvida" (antes disso, muda). */
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

/** Eficiência pelo desgaste: 1 (novo) até 1 − WEAR_MAX_PENALTY (desgaste 100). */
export function efficiency(crop: CropState): number {
  return 1 - WEAR_MAX_PENALTY * (crop.wear / 100);
}

/** Crescimento por hora de estufa ligada, em pontos de 0 a 100. */
export function growthPerHour(crop: CropState): number {
  return (100 / GROW_HOURS) * IRRIGATION[crop.irrigation].growth * LIGHTING[crop.lighting].growth * efficiency(crop);
}

/** Horas até a cultura ficar pronta (com a estufa ligada), ou 0 se já está. */
export function hoursToReady(crop: CropState): number {
  return crop.growth >= 100 ? 0 : (100 - crop.growth) / growthPerHour(crop);
}

/** Avança a cultura. Só cresce e desgasta com a estufa ligada. */
export function stepCrop(crop: CropState, hours: number, running: boolean): CropState {
  if (!running || hours <= 0) return crop;
  return {
    ...crop,
    growth: Math.min(100, crop.growth + growthPerHour(crop) * hours),
    wear: Math.min(100, crop.wear + WEAR_PER_HOUR * hours),
  };
}

/** Colhe: devolve a cultura recomeçando do zero. */
export function harvestCrop(crop: CropState): CropState {
  return { ...crop, growth: 0, harvests: crop.harvests + 1 };
}
