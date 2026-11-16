// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import type { Shot } from './director';

export type CamMode = 'overview' | 'follow' | 'focus' | 'free';

export interface CamLimits {
  /** Distância mínima e máxima do alvo (m). */
  readonly min: number;
  readonly max: number;
  /** Ângulo polar (graus a partir da vertical): mínimo = quase de cima, máximo = quase rente ao chão. */
  readonly polarMin: number;
  readonly polarMax: number;
}

const FOLLOW_CREW: CamLimits = { min: 2.4, max: 26, polarMin: 10, polarMax: 80 };
const FOCUS: CamLimits = { min: 4, max: 60, polarMin: 10, polarMax: 80 };

export const SHOT_LIMITS: Readonly<Record<Shot | 'free', CamLimits>> = {
  overview: { min: 14, max: 120, polarMin: 10, polarMax: 80 },
  // Terra: o horizonte fica quase na altura da câmera, então o ângulo polar precisa passar de 60°.
  earth: { min: 6, max: 40, polarMin: 60, polarMax: 120 },
  crew: FOLLOW_CREW,
  crew1: FOLLOW_CREW,
  rover: { min: 3.5, max: 40, polarMin: 10, polarMax: 80 },
  ice: FOCUS,
  energy: FOCUS,
  antenna: FOCUS,
  greenhouse: FOCUS,
  habitat: FOCUS,
  logistics: FOCUS,
  showcase: { min: 10, max: 80, polarMin: 20, polarMax: 84 },
  free: { min: 3, max: 150, polarMin: 5, polarMax: 88 },
};

export interface KeyIntent {
  /** +1 = a câmera anda para a direita do jogador, em volta do alvo. */
  readonly yaw: number;
  /** +1 = a câmera sobe (mais de cima). */
  readonly pitch: number;
  /** +1 = aproxima. */
  readonly zoom: number;
}

const has = (held: ReadonlySet<string>, ...keys: string[]): boolean => keys.some((k) => held.has(k));

export function keyIntent(held: ReadonlySet<string>): KeyIntent {
  return {
    yaw: (has(held, 'ArrowRight') ? 1 : 0) - (has(held, 'ArrowLeft') ? 1 : 0),
    pitch: (has(held, 'ArrowUp') ? 1 : 0) - (has(held, 'ArrowDown') ? 1 : 0),
    zoom: (has(held, '+', '=') ? 1 : 0) - (has(held, '-', '_') ? 1 : 0),
  };
}

export const CAMERA_KEYS: ReadonlySet<string> = new Set(['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '=', '-', '_']);

export type CamCommand = 'overview' | 'free-toggle';

export function cameraCommand(key: string): CamCommand | null {
  if (key === 'o' || key === 'O' || key === 'Home') return 'overview';
  if (key === 'c' || key === 'C') return 'free-toggle';
  return null;
}

/** Velocidade da câmera pelo teclado: radianos por segundo no giro e na inclinação, e fração de distância por segundo no zoom. */
export const KEY_SPEED = { yaw: 1.25, pitch: 0.9, zoom: 1.1, fastFactor: 2.2 } as const;

export interface Rect {
  readonly left: number;
  readonly top: number;
  readonly right: number;
  readonly bottom: number;
}

export interface Viewport {
  readonly width: number;
  readonly height: number;
}

const MAX_INSET = 0.34;

/**
 * Deslocamento da vista (px) para o alvo aparecer no centro da área livre quando painéis cobrem parte da tela.
 * Painel largo (folha de baixo, no celular em pé) desloca na vertical; painel lateral, na horizontal.
 * `x` e `y` positivos empurram o conteúdo para a esquerda e para cima (convenção de `camera.setViewOffset`).
 */
export function insetFor(viewport: Viewport, panels: readonly Rect[]): { x: number; y: number } {
  let x = 0;
  let y = 0;
  for (const p of panels) {
    const w = p.right - p.left;
    const h = p.bottom - p.top;
    if (w <= 0 || h <= 0) continue;
    if (w >= viewport.width * 0.8) {
      y = Math.max(y, Math.max(0, viewport.height - p.top) / 2);
    } else if (p.left > viewport.width / 2) {
      x = Math.max(x, Math.max(0, viewport.width - p.left) / 2);
    }
  }
  return { x: Math.min(x, viewport.width * MAX_INSET), y: Math.min(y, viewport.height * MAX_INSET) };
}

export function clampToArea(x: number, z: number, cx: number, cz: number, radius: number): { x: number; z: number } {
  if (!Number.isFinite(x) || !Number.isFinite(z)) return { x: cx, z: cz };
  const dx = x - cx;
  const dz = z - cz;
  const d = Math.hypot(dx, dz);
  if (d <= radius) return { x, z };
  return { x: cx + (dx / d) * radius, z: cz + (dz / d) * radius };
}

export const PLAY_AREA = { cx: 3, cz: -11, radius: 70 } as const;

/** Segundos sem o alvo acompanhado à vista até a câmera voltar sozinha à visão geral. */
export const FOLLOW_LOST_SECONDS = 1.5;
