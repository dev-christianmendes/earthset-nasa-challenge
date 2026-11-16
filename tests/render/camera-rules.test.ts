// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// CAM-01 e CAM-02: regras puras da câmera (limites por plano, teclas, margem livre, área de jogo).
import { describe, expect, it } from 'vitest';
import { CAMERA_KEYS, PLAY_AREA, SHOT_LIMITS, cameraCommand, clampToArea, insetFor, keyIntent } from '../../src/render/camera-rules';

describe('limites da câmera por plano', () => {
  it('todo plano tem faixa de distância e de inclinação válidas, sem passar do chão nem do zênite', () => {
    for (const [name, l] of Object.entries(SHOT_LIMITS)) {
      expect(l.min, name).toBeGreaterThan(0);
      expect(l.max, name).toBeGreaterThan(l.min);
      expect(l.polarMin, name).toBeGreaterThanOrEqual(5);
      expect(l.polarMax, name).toBeGreaterThan(l.polarMin);
      expect(l.polarMax, name).toBeLessThanOrEqual(88);
    }
  });

  it('acompanhar alguém limita o afastamento; a visão geral e a câmera livre são as mais largas', () => {
    expect(SHOT_LIMITS.crew.max).toBeLessThan(SHOT_LIMITS.rover.max);
    expect(SHOT_LIMITS.rover.max).toBeLessThan(SHOT_LIMITS.overview.max);
    expect(SHOT_LIMITS.free.max).toBeGreaterThanOrEqual(SHOT_LIMITS.overview.max);
    expect(SHOT_LIMITS.free.min).toBeLessThan(SHOT_LIMITS.overview.min);
    expect(SHOT_LIMITS.crew.min).toBeLessThan(SHOT_LIMITS.rover.min);
  });
});

describe('teclas de câmera', () => {
  it('setas giram e inclinam, + e − dão zoom (também as variantes com Shift)', () => {
    expect(keyIntent(new Set(['ArrowRight']))).toEqual({ yaw: 1, pitch: 0, zoom: 0 });
    expect(keyIntent(new Set(['ArrowLeft']))).toEqual({ yaw: -1, pitch: 0, zoom: 0 });
    expect(keyIntent(new Set(['ArrowUp']))).toEqual({ yaw: 0, pitch: 1, zoom: 0 });
    expect(keyIntent(new Set(['ArrowDown']))).toEqual({ yaw: 0, pitch: -1, zoom: 0 });
    expect(keyIntent(new Set(['+']))).toEqual({ yaw: 0, pitch: 0, zoom: 1 });
    expect(keyIntent(new Set(['=']))).toEqual({ yaw: 0, pitch: 0, zoom: 1 });
    expect(keyIntent(new Set(['-']))).toEqual({ yaw: 0, pitch: 0, zoom: -1 });
    expect(keyIntent(new Set(['_']))).toEqual({ yaw: 0, pitch: 0, zoom: -1 });
  });

  it('teclas opostas se anulam e as combinações somam', () => {
    expect(keyIntent(new Set(['ArrowLeft', 'ArrowRight']))).toEqual({ yaw: 0, pitch: 0, zoom: 0 });
    expect(keyIntent(new Set(['ArrowRight', 'ArrowUp', '+']))).toEqual({ yaw: 1, pitch: 1, zoom: 1 });
    expect(keyIntent(new Set(['a', 'Enter']))).toEqual({ yaw: 0, pitch: 0, zoom: 0 });
  });

  it('só as teclas de câmera são reivindicadas; números e letras de outros atalhos ficam livres', () => {
    for (const key of ['1', '5', '9', 'Escape', 'Tab', 'Enter', ' ', 'a', 'p']) expect(CAMERA_KEYS.has(key), key).toBe(false);
    for (const key of ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', '+', '-']) expect(CAMERA_KEYS.has(key), key).toBe(true);
  });

  it('O e Home voltam à visão geral; C alterna a câmera livre', () => {
    expect(cameraCommand('o')).toBe('overview');
    expect(cameraCommand('O')).toBe('overview');
    expect(cameraCommand('Home')).toBe('overview');
    expect(cameraCommand('c')).toBe('free-toggle');
    expect(cameraCommand('C')).toBe('free-toggle');
    expect(cameraCommand('x')).toBeNull();
    expect(cameraCommand('1')).toBeNull();
  });
});

describe('margem livre quando um painel cobre a tela', () => {
  const desktop = { width: 1280, height: 800 };
  const phone = { width: 412, height: 915 };

  it('sem painel não desloca nada', () => {
    expect(insetFor(desktop, [])).toEqual({ x: 0, y: 0 });
    expect(insetFor(desktop, [{ left: 0, top: 0, right: 0, bottom: 0 }])).toEqual({ x: 0, y: 0 });
  });

  it('painel à direita centra o alvo na área livre à esquerda', () => {
    const inset = insetFor(desktop, [{ left: 928, top: 88, right: 1268, bottom: 704 }]);
    // A área livre é de 0 a 928: o centro dela fica 176 px à esquerda do centro da tela (640 → 464).
    expect(inset.x).toBeCloseTo((1280 - 928) / 2, 6);
    expect(inset.y).toBe(0);
  });

  it('folha de baixo no celular em pé desloca na vertical', () => {
    const inset = insetFor(phone, [{ left: 8, top: 520, right: 404, bottom: 840 }]);
    expect(inset.x).toBe(0);
    expect(inset.y).toBeCloseTo((915 - 520) / 2, 6);
  });

  it('limita o deslocamento a um terço da tela para o alvo nunca sair do outro lado', () => {
    const inset = insetFor(desktop, [{ left: 400, top: 0, right: 1280, bottom: 800 }]);
    expect(inset.x).toBeLessThanOrEqual(desktop.width * 0.34 + 1e-9);
  });
});

describe('área de jogo', () => {
  it('dentro da área não muda; fora vai para a borda na mesma direção; valores inválidos voltam ao centro', () => {
    const { cx, cz, radius } = PLAY_AREA;
    expect(clampToArea(cx + 10, cz - 5, cx, cz, radius)).toEqual({ x: cx + 10, z: cz - 5 });
    const out = clampToArea(cx + 300, cz, cx, cz, radius);
    expect(out.x).toBeCloseTo(cx + radius, 9);
    expect(out.z).toBeCloseTo(cz, 9);
    const diag = clampToArea(cx + 300, cz + 400, cx, cz, radius);
    expect(Math.hypot(diag.x - cx, diag.z - cz)).toBeCloseTo(radius, 9);
    expect(clampToArea(NaN, 5, cx, cz, radius)).toEqual({ x: cx, z: cz });
  });
});
