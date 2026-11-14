// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Recursos por hora: energia, ar, água e comida. Motor puro.
// Valores e regras: docs/regras-recursos.md (origem: especificação do protótipo). Todos ajustáveis.
import { ROBOT_LOAD_PER_HOUR } from './robot';

export type Rank = 'cadete' | 'explorador' | 'comandante';
export type Site = 'peak' | 'slope' | 'rim';
export type GreenhouseMode = 'off' | 'always' | 'surplus';

export interface Vitals {
  /** Energia armazenada, em unidades da bateria (0 a batteryCapacity). */
  readonly battery: number;
  /** Ar, água e comida: de 0 a 100. */
  readonly air: number;
  readonly water: number;
  readonly food: number;
}

/** Entradas que o cálculo por hora precisa, sem o relógio nem os corações. */
export interface Installation {
  readonly rank: Rank;
  readonly site: Site;
  readonly panels: number;
  readonly batteryCapacity: number;
  readonly greenhouse: GreenhouseMode;
}

/** Geração de cada painel com Sol, em unidades por hora. */
export const PANEL_OUTPUT_PER_HOUR = 0.9;
/** Consumo fixo da base, por hora. */
export const BASE_LOAD_PER_HOUR = 0.8;
/** Aquecimento por hora, com Sol e sem Sol, por local. */
export const HEATING_PER_HOUR: Record<Site, { sun: number; shade: number }> = {
  peak: { sun: 0.5, shade: 1.3 },
  slope: { sun: 0.3, shade: 0.7 },
  rim: { sun: 0.2, shade: 0.5 },
};
export const GREENHOUSE = { energy: 1.0, water: 0.08, food: 0.38 } as const;
export const ELECTROLYSIS = { energy: 0.6, water: 0.4, air: 2 } as const;
/** Fator de consumo de ar, água e comida por patente. */
export const RANK_FACTOR: Record<Rank, number> = { cadete: 0.75, explorador: 1, comandante: 1.15 };
/** Limites de ativação (fração da bateria ou valor de 0 a 100). */
export const RULES = {
  greenhouseAlwaysAboveBattery: 0.1,
  greenhouseSurplusAboveBattery: 0.5,
  economyBelowBattery: 0.4,
  electrolysisBelowAir: 90,
  electrolysisEconomyBelowAir: 40,
  electrolysisMinBattery: 0.05,
} as const;

export interface HourlyFlow {
  readonly energy: number;
  readonly air: number;
  readonly water: number;
  readonly food: number;
  readonly greenhouseOn: boolean;
  readonly electrolysisOn: boolean;
  readonly economy: boolean;
}

/** Decide quais equipamentos estão ligados, a partir do estado no início do passo. */
export function deriveFlow(
  vitals: Vitals,
  inst: Installation,
  sunlit: boolean,
  robotWorking = false,
): HourlyFlow {
  const batteryFraction = vitals.battery / inst.batteryCapacity;
  const economy = batteryFraction < RULES.economyBelowBattery;

  let greenhouseOn = false;
  if (!economy) {
    if (inst.greenhouse === 'always') greenhouseOn = batteryFraction > RULES.greenhouseAlwaysAboveBattery;
    if (inst.greenhouse === 'surplus') greenhouseOn = batteryFraction > RULES.greenhouseSurplusAboveBattery;
  }

  const electrolysisThreshold = economy ? RULES.electrolysisEconomyBelowAir : RULES.electrolysisBelowAir;
  const electrolysisOn =
    vitals.air < electrolysisThreshold &&
    vitals.water > 0 &&
    batteryFraction > RULES.electrolysisMinBattery;

  const generation = sunlit ? inst.panels * PANEL_OUTPUT_PER_HOUR : 0;
  const heating = HEATING_PER_HOUR[inst.site][sunlit ? 'sun' : 'shade'];
  const load =
    BASE_LOAD_PER_HOUR +
    heating +
    (greenhouseOn ? GREENHOUSE.energy : 0) +
    (electrolysisOn ? ELECTROLYSIS.energy : 0) +
    (robotWorking ? ROBOT_LOAD_PER_HOUR : 0);

  const factor = RANK_FACTOR[inst.rank];
  const waterUse = 0.2 * factor + (greenhouseOn ? GREENHOUSE.water : 0) + (electrolysisOn ? ELECTROLYSIS.water : 0);
  const foodGain = greenhouseOn && vitals.water > 0 ? GREENHOUSE.food : 0;

  return {
    energy: generation - load,
    air: -1 * factor + (electrolysisOn ? ELECTROLYSIS.air : 0),
    water: -waterUse,
    food: -0.2 * factor + foodGain,
    greenhouseOn,
    electrolysisOn,
    economy,
  };
}

/** Aplica o fluxo de um passo de `dtHours` e limita os valores aos limites físicos. */
export function applyFlow(vitals: Vitals, flow: HourlyFlow, inst: Installation, dtHours: number): Vitals {
  return {
    battery: clamp(vitals.battery + flow.energy * dtHours, 0, inst.batteryCapacity),
    air: clamp(vitals.air + flow.air * dtHours, 0, 100),
    water: clamp(vitals.water + flow.water * dtHours, 0, 100),
    food: clamp(vitals.food + flow.food * dtHours, 0, 100),
  };
}

export function startingVitals(batteryCapacity: number): Vitals {
  return { battery: 0.8 * batteryCapacity, air: 80, water: 50, food: 40 };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
