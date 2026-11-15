// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Navegação e locomoção da tripulação (módulos puros de src/render): rotas sem atravessar estruturas,
// coerência com as horas de trajeto do motor, movimento contínuo, chegada suave e independência do FPS.
import { describe, expect, it } from 'vitest';
import { AGENT_TASK_KINDS, TRAVEL_HOURS_BY_KIND } from '../../src/engine/astronaut';
import { CLEARANCE, CREW_HOMES, ICE_HELPER, OBSTACLES, distanceTo, isInside, pathBetween, workSpot, type PolyPath } from '../../src/render/crew-nav';
import { MOON_GRAVITY, buildGaitProfile, createWalker, flightTime, remaining, setPath, stepGait, stepWalker, type Drive, type Walker } from '../../src/render/crew-gait';

/** Menor folga do caminho a cada obstáculo, ignorando os primeiros e últimos `skip` metros (postos encostados). */
function minClearance(path: PolyPath, skip: number): { d: number; who: string } {
  let best = { d: Infinity, who: '' };
  for (let i = 0; i < path.xs.length; i++) {
    if (path.acc[i] < skip || path.length - path.acc[i] < skip) continue;
    const p = { x: path.xs[i], z: path.zs[i] };
    for (const o of OBSTACLES) {
      const d = distanceTo(o, p);
      if (d < best.d) best = { d, who: o.name };
    }
  }
  return best;
}

/** Densifica o caminho para checar a folga também entre os vértices. */
function dense(path: PolyPath): PolyPath {
  const xs: number[] = [];
  const zs: number[] = [];
  const acc: number[] = [];
  for (let i = 0; i < path.xs.length - 1; i++) {
    const seg = path.acc[i + 1] - path.acc[i];
    const n = Math.max(1, Math.ceil(seg / 0.05));
    for (let k = 0; k < n; k++) {
      const f = k / n;
      xs.push(path.xs[i] + (path.xs[i + 1] - path.xs[i]) * f);
      zs.push(path.zs[i] + (path.zs[i + 1] - path.zs[i]) * f);
      acc.push(path.acc[i] + seg * f);
    }
  }
  xs.push(path.xs[path.xs.length - 1]);
  zs.push(path.zs[path.zs.length - 1]);
  acc.push(path.length);
  return { xs: Float64Array.from(xs), zs: Float64Array.from(zs), acc: Float64Array.from(acc), length: path.length };
}

describe('rotas da tripulação', () => {
  it('nenhuma casa ou posto de trabalho fica dentro de uma estrutura', () => {
    const spots = [...CREW_HOMES, ICE_HELPER, ...CREW_HOMES.flatMap((_, i) => AGENT_TASK_KINDS.map((k) => workSpot(i, k)))];
    for (const s of spots) for (const o of OBSTACLES) expect(isInside(o, s), `${JSON.stringify(s)} em ${o.name}`).toBe(false);
  });

  it('de casa a cada posto e de volta, mantém a folga de todas as estruturas', () => {
    for (let i = 0; i < CREW_HOMES.length; i++) {
      for (const kind of AGENT_TASK_KINDS) {
        for (const [a, b] of [
          [CREW_HOMES[i], workSpot(i, kind)],
          [workSpot(i, kind), CREW_HOMES[i]],
        ]) {
          const { d, who } = minClearance(dense(pathBetween(a, b)), 1.2);
          expect(d, `astronauta ${i}, ${kind}: ${who}`).toBeGreaterThanOrEqual(CLEARANCE * 0.85);
        }
      }
    }
  });

  it('contorna o habitat em vez de atravessá-lo', () => {
    const path = dense(pathBetween({ x: 5.5, z: 3 }, { x: -5.5, z: 3 }));
    const { d } = minClearance(path, 0);
    expect(d).toBeGreaterThanOrEqual(CLEARANCE * 0.85);
    expect(path.length).toBeGreaterThan(11);
  });

  it('do abrigo (dentro da câmara) sai pela porta, nunca pela parede lateral', () => {
    const airlock = OBSTACLES.find((o) => o.name === 'airlock');
    if (!airlock || airlock.kind !== 'rect') throw new Error('sem câmara');
    const shelter = { x: 3, z: 0 };
    for (const dest of [workSpot(0, 'inspect'), workSpot(1, 'calibrate'), workSpot(0, 'tune'), CREW_HOMES[1]]) {
      for (const path of [dense(pathBetween(shelter, dest)), dense(pathBetween(dest, shelter))]) {
        for (let i = 0; i < path.xs.length; i++) {
          const p = { x: path.xs[i], z: path.zs[i] };
          if (isInside(airlock, p)) expect(Math.abs(p.z)).toBeLessThan(0.5);
          else if (distanceTo(airlock, p) < 0.1) expect(p.x).toBeGreaterThan(airlock.maxX - 0.01);
        }
      }
    }
  });

  it('o trajeto do motor cabe num passo lunar crível (1,2 a 2,0 m/s em 1×)', () => {
    for (const kind of AGENT_TASK_KINDS) {
      for (let i = 0; i < CREW_HOMES.length; i++) {
        const speed = pathBetween(CREW_HOMES[i], workSpot(i, kind)).length / TRAVEL_HOURS_BY_KIND[kind];
        expect(speed, `astronauta ${i}, ${kind}`).toBeGreaterThan(1.2);
        expect(speed, `astronauta ${i}, ${kind}`).toBeLessThanOrEqual(2.0);
      }
    }
  });
});

/** Simula uma ida rastreando a fração do motor (que avança em degraus de 0,05 h) e registra a velocidade. */
function simulateTrip(fps: number, travelHours: number, rate: number): { w: Walker; maxDv: number; maxYaw: number; maxSpeed: number; frames: number } {
  const path = pathBetween(CREW_HOMES[1], workSpot(1, 'calibrate'));
  const w = createWalker(CREW_HOMES[1].x, CREW_HOMES[1].z, Math.PI / 2);
  setPath(w, path);
  const dt = 1 / fps;
  let hour = 0;
  let maxDv = 0;
  let maxYaw = 0;
  let maxSpeed = 0;
  let frames = 0;
  // Ida mais 4 s de folga para a frenagem final.
  while (hour < travelHours + 4 * rate) {
    hour += dt * rate;
    const engineHour = Math.floor(hour / 0.05) * 0.05;
    const drive: Drive = engineHour < travelHours ? { kind: 'track', fraction: engineHour / travelHours } : { kind: 'goto', cruise: 2 };
    const before = w.speed;
    const h0 = w.heading;
    stepWalker(w, dt, drive, rate, null);
    stepGait(w, dt, rate, null, null);
    maxDv = Math.max(maxDv, Math.abs(w.speed - before) / dt);
    maxYaw = Math.max(maxYaw, Math.abs(Math.atan2(Math.sin(w.heading - h0), Math.cos(w.heading - h0))) / dt);
    maxSpeed = Math.max(maxSpeed, w.speed);
    frames++;
  }
  return { w, maxDv, maxYaw, maxSpeed, frames };
}

describe('locomoção', () => {
  it('chega ao posto, parada, sem saltos de velocidade nem giro instantâneo', () => {
    const { w, maxDv, maxYaw, maxSpeed } = simulateTrip(60, TRAVEL_HOURS_BY_KIND.calibrate, 1);
    expect(remaining(w)).toBeLessThan(0.05);
    expect(w.speed).toBeLessThan(0.02);
    expect(maxDv).toBeLessThanOrEqual(1.5 + 1e-6);
    expect(maxYaw).toBeLessThanOrEqual(3.2 + 1e-6);
    expect(maxSpeed).toBeLessThan(2.7);
  });

  it('o resultado não depende do FPS (30, 60 e 144 quadros por segundo)', () => {
    const at = (fps: number) => {
      const path = pathBetween(CREW_HOMES[0], workSpot(0, 'tune'));
      const w = createWalker(CREW_HOMES[0].x, CREW_HOMES[0].z, 0);
      setPath(w, path);
      const dt = 1 / fps;
      for (let t = 0; t < 4; t += dt) stepWalker(w, dt, { kind: 'goto', cruise: 2 }, 1, null);
      return w;
    };
    const a = at(30);
    const b = at(144);
    const c = at(60);
    expect(Math.hypot(a.x - b.x, a.z - b.z)).toBeLessThan(0.12);
    expect(Math.hypot(c.x - b.x, c.z - b.z)).toBeLessThan(0.06);
  });

  it('em 4× tudo acontece 4 vezes mais depressa (time-lapse), sem perder a chegada suave', () => {
    const { w, maxSpeed } = simulateTrip(60, TRAVEL_HOURS_BY_KIND.calibrate, 4);
    expect(remaining(w)).toBeLessThan(0.05);
    expect(maxSpeed).toBeLessThan(4 * 2.7);
  });

  it('parado, vira progressivamente para o alvo', () => {
    const w = createWalker(0, 0, 0);
    stepWalker(w, 1 / 60, { kind: 'hold' }, 1, Math.PI / 2);
    expect(w.heading).toBeGreaterThan(0);
    expect(w.heading).toBeLessThan(0.1);
    for (let i = 0; i < 120; i++) stepWalker(w, 1 / 60, { kind: 'hold' }, 1, Math.PI / 2);
    expect(Math.abs(w.heading - Math.PI / 2)).toBeLessThan(0.02);
  });
});

/** Perfil sintético: pé esquerdo no chão em [0, 0,15), direito em [0,5, 0,65); voo no resto; pé apoiado a 5 m/s de clipe. */
function syntheticRun(): ReturnType<typeof buildGaitProfile> {
  const n = 40;
  const ly = new Float32Array(n);
  const lz = new Float32Array(n);
  const ry = new Float32Array(n);
  const rz = new Float32Array(n);
  const D = 1;
  for (let i = 0; i < n; i++) {
    const p = i / n;
    const onL = p < 0.15;
    const onR = p >= 0.5 && p < 0.65;
    ly[i] = onL ? 0.1 : 0.4;
    ry[i] = onR ? 0.1 : 0.4;
    lz[i] = onL ? 0.4 - 5 * D * p : 0;
    rz[i] = onR ? 0.4 - 5 * D * (p - 0.5) : 0;
  }
  return buildGaitProfile(D, ly, lz, ry, rz);
}

describe('passada lunar', () => {
  it('mede no clipe o apoio, a velocidade do pé e as janelas de voo', () => {
    const p = syntheticRun();
    expect(p.plant).toBe(0);
    expect(p.footSpeed).toBeCloseTo(5, 5);
    expect(p.flightLen[0]).toBe(0);
    expect(p.flightLen[10]).toBeCloseTo(0.35, 5);
  });

  it('com o pé no chão, a fase avança no ritmo do chão (pé apoiado não desliza)', () => {
    const p = syntheticRun();
    const w = createWalker(0, 0, 0);
    w.speed = 2;
    w.phase = 0.02;
    const dt = 0.005;
    stepGait(w, dt, 1, null, p);
    // Fase por segundo no apoio = v / (velocidade do pé × duração do clipe) = 2 / 5.
    expect((w.phase - 0.02) / dt).toBeCloseTo(0.4, 5);
  });

  it('no voo, o corpo sobe só alguns centímetros e o voo dura o tempo balístico lunar', () => {
    const p = syntheticRun();
    const w = createWalker(0, 0, 0);
    w.speed = 2;
    w.moveWeight = 1;
    w.hopWeight = 1;
    let maxLift = 0;
    let t = 0;
    for (let i = 0; i < 2000; i++) {
      stepGait(w, 0.002, 1, null, p);
      maxLift = Math.max(maxLift, w.lift);
      t += 0.002;
    }
    const tf = flightTime(2);
    expect(maxLift).toBeGreaterThan(0.01);
    expect(maxLift).toBeLessThanOrEqual((MOON_GRAVITY * tf * tf) / 8 + 1e-6);
    expect(maxLift).toBeLessThan(0.08);
  });
});
