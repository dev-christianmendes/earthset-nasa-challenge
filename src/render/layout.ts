// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Planta da base (Earthset 4.0): posições por área funcional, em metros na cena (norte = −z, leste = +x).
// Posições são escolha de jogo (ilustrativas); o relevo e o Sol não mudam.

export interface Spot {
  readonly x: number;
  readonly z: number;
  /** Rotação em torno de y (radianos). */
  readonly rot?: number;
}

export const HABITAT: Spot = { x: 0, z: 0, rot: Math.PI / 2 };
export const AIRLOCK: Spot = { x: 4.2, z: 0 };
/**
 * Ciência e vida: módulo da estufa acoplado ao colar sul do habitat (D-25). Centro do módulo de 6 m: o colar do habitat
 * termina em z = 7,21 e a face de acoplamento da estufa fica 3,0 m antes do centro. Mesmo eixo (x = 0) e mesma altura.
 */
export const GREENHOUSE: Spot = { x: 0, z: 10.21 };
export const GREENHOUSE_LENGTH = 6;
export const GREENHOUSE_DOOR: Spot = { x: GREENHOUSE.x + 1.75, z: GREENHOUSE.z };
export const PANEL_SLOTS: readonly Spot[] = (() => {
  const out: Spot[] = [];
  const cols = [-9, -12.5, -16];
  const rows = [-6, -2, 2, 6];
  for (const z of rows) for (const x of cols) out.push({ x, z, rot: -Math.PI / 2 });
  return out;
})();
export const POWER_UNIT: Spot = { x: -5.5, z: -4, rot: Math.PI / 2 };
export const DOCK: Spot = { x: 9, z: -3, rot: 0 };
export const ICE_PROCESSOR: Spot = { x: 10, z: 4.5, rot: Math.PI };
export const TANKS: Spot = { x: 14, z: 3, rot: Math.PI / 2 };
export const STORAGE: Spot = { x: 12.5, z: -12, rot: 0.3 };
export const ANTENNA: Spot = { x: 0.5, z: -11, rot: 0 };
export const LANDING_PAD: Spot = { x: -2, z: -30, rot: 0.2 };
export const LIGHT_TOWERS: readonly Spot[] = [
  { x: 6, z: -9, rot: 2.4 },
  { x: -7, z: 8, rot: -0.8 },
  { x: 16, z: 8, rot: 2.2 },
  { x: -19, z: -9, rot: 0.6 },
];
/** Local do gelo: terreno mais baixo a leste (ilustrativo; o gelo não está medido neste recorte). */
export const ICE_SITE: Spot = { x: 29, z: -8 };
export const ANTENNA_WORK: Spot = { x: 3.5, z: -10 };

export const ICE_ROUTE: readonly Spot[] = [DOCK, { x: 17, z: -4 }, { x: 24, z: -7 }, ICE_SITE];

/** Zonas onde não se espalham pedras (centro e raio, em metros). */
export const CLEAR_ZONES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 0, 11],
  [-12.5, 0, 10],
  [0, 10.2, 7],
  [11, 0, 9],
  [12.5, -12, 4],
  [0.5, -11, 4],
  [-2, -30, 9],
  [29, -8, 5],
  [19, -5, 4],
];
