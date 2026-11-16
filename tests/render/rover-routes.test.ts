// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { MAX_PANELS, TASK_PHASE_HOURS, type TaskKind } from '../../src/engine/robot';
import { OBSTACLES, distanceTo } from '../../src/render/crew-nav';
import { MIN_TURN_RADIUS, ROVER_CLEARANCE, distanceAt, filletRoute, peakSpeed, roverReturn, roverRoute, roverTrack } from '../../src/render/rover-routes';

/** Velocidade de projeto do rover das Apollo (13 km/h) e recorde (18 km/h), em m/s. */
const LRV_DESIGN = 13 / 3.6;
const LRV_RECORD = 18 / 3.6;
const CASES: Array<[TaskKind, number]> = [['ice', 0], ['antenna', 0], ...Array.from({ length: MAX_PANELS - 2 }, (_, i) => ['panel', i + 2] as [TaskKind, number])];

describe('trajetória do rover', () => {
  it('não atravessa estruturas: folga do veículo fora das pontas (a garagem e o campo solar ficam de fora)', () => {
    const structures = OBSTACLES.filter((o) => o.name !== 'dock' && o.name !== 'panels');
    for (const [kind, slot] of CASES) {
      for (const route of [roverRoute(kind, slot), roverReturn(kind, slot)]) {
        const { path } = roverTrack(route);
        for (let i = 0; i < path.xs.length; i++) {
          if (path.acc[i] < 2 || path.length - path.acc[i] < 2) continue;
          for (const o of structures) {
            const d = distanceTo(o, { x: path.xs[i], z: path.zs[i] });
            expect(d, `${kind} vaga ${slot}: ${o.name}`).toBeGreaterThanOrEqual(ROVER_CLEARANCE * 0.8);
          }
        }
      }
    }
  });

  it('as curvas são arcos contínuos: o rumo nunca salta e o raio não fica muito abaixo do mínimo', () => {
    for (const [kind, slot] of CASES) {
      const track = roverTrack(roverRoute(kind, slot));
      const { xs, zs } = track.path;
      for (let i = 1; i < xs.length - 1; i++) {
        const h0 = Math.atan2(xs[i] - xs[i - 1], zs[i] - zs[i - 1]);
        const h1 = Math.atan2(xs[i + 1] - xs[i], zs[i + 1] - zs[i]);
        expect(Math.abs(Math.atan2(Math.sin(h1 - h0), Math.cos(h1 - h0))), `${kind} vaga ${slot}`).toBeLessThan(0.2);
      }
      for (const k of track.curvature) expect(k, `${kind} vaga ${slot}`).toBeLessThan(1 / (MIN_TURN_RADIUS * 0.45));
    }
  });

  it('o arco é tangente aos dois trechos de um canto em L', () => {
    const arc = filletRoute([{ x: 0, z: 0 }, { x: 0, z: 10 }, { x: 10, z: 10 }], 3);
    const near = (p: { x: number; z: number }, x: number, z: number) => Math.hypot(p.x - x, p.z - z) < 1e-6;
    expect(arc.some((p) => near(p, 0, 7))).toBe(true);
    expect(arc.some((p) => near(p, 3, 10))).toBe(true);
    for (const p of arc) if (p.x > 0 && p.z < 10) expect(Math.hypot(p.x - 3, p.z - 7)).toBeCloseTo(3, 6);
  });

  it('em 1×, o pico fica dentro do recorde do rover das Apollo e a média dentro do projeto', () => {
    for (const [kind, slot] of CASES) {
      const leg = TASK_PHASE_HOURS[kind][1];
      for (const route of [roverRoute(kind, slot), roverReturn(kind, slot)]) {
        const track = roverTrack(route);
        expect(track.path.length / leg, `${kind} vaga ${slot}`).toBeLessThanOrEqual(LRV_DESIGN);
        expect(peakSpeed(track, leg), `${kind} vaga ${slot}`).toBeLessThanOrEqual(LRV_RECORD);
      }
    }
  });

  it('o perfil parte e chega parado, avança sem voltar e cobre o trecho inteiro', () => {
    const track = roverTrack(roverRoute('panel', 7));
    expect(distanceAt(track, 0)).toBe(0);
    expect(distanceAt(track, 1)).toBeCloseTo(track.path.length, 9);
    let prev = 0;
    for (let i = 1; i <= 400; i++) {
      const s = distanceAt(track, i / 400);
      expect(s).toBeGreaterThanOrEqual(prev - 1e-12);
      prev = s;
    }
    const startV = distanceAt(track, 0.005) / 0.005;
    const cruiseV = (distanceAt(track, 0.5) - distanceAt(track, 0.495)) / 0.005;
    expect(startV).toBeLessThan(cruiseV * 0.5);
  });
});
