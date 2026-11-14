// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Cena three.js (Earthset 4.0): relevo medido, céu, base por áreas, rover, tripulação e luz.
// Só desenha o estado recebido; regra fica no motor. Fases das missões vêm de src/engine/mission.ts.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import type { GameState } from '../engine/game';
import { isGreenhouseOn } from '../engine/resources';
import { phaseFraction } from '../engine/astronaut';
import { solarFactor, stormLevel, type SpaceWeatherSample } from '../engine/space-weather';
import { isWorking, type TaskKind } from '../engine/robot';
import { missionPhase, phaseProgress, type MissionPhase } from '../engine/mission';
import { sampleAt } from '../engine/sun';
import { SUN } from '../data/sun';
import { TERRAIN_MESH } from '../data/terrain-mesh';
import { attachModel, loadGltf, loadModel } from './assets';
import { VERTICAL_EXAGGERATION, surfaceHeight } from './terrain-height';
import { ANTENNA_WORK, AIRLOCK, DOCK, GREENHOUSE, ICE_PROCESSOR, ICE_ROUTE, PANEL_SLOTS, type Spot } from './layout';
import { base, loadBaseLayoutModels, updateBase } from './base-layout';
import { updateCrop } from './crop';

/** Paleta da cena (tokens de docs/VISUAL_DIRECTION.md). */
export const PALETTE = {
  space: 0x03050a,
  sunlight: 0xfff1d6,
  skyFill: 0x8fa6c8,
  groundFill: 0x1a1c24,
  robot: 0xffc857,
  beacon: 0x7fd7ff,
  panelGlow: 0x0c2446,
} as const;

// ---------- Renderizador ----------

export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = false;
renderer.shadowMap.type = THREE.PCFShadowMap;
// O mapa de sombra é redesenhado em quadros alternados (ver main.ts): metade do custo, diferença invisível a 60 fps.
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.insertBefore(renderer.domElement, document.body.firstChild);

export const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.space);
// Escurecimento por distância (preto, sem cor de céu): só esconde a borda do recorte de 400 m. Não é atmosfera.
scene.fog = new THREE.Fog(PALETTE.space, 150, 330);

export const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 900);
camera.position.set(34, 20, 34);

export const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0, 0);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = true;
controls.screenSpacePanning = false;
controls.minDistance = 4;
controls.maxDistance = 120;
controls.minPolarAngle = THREE.MathUtils.degToRad(8);
controls.maxPolarAngle = THREE.MathUtils.degToRad(84);
controls.update();

/** Qualidade: sombras em 2048 (alta) ou 1024 e densidade de pixels menor (baixa). */
export function setQuality(high: boolean): void {
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, high ? 1.5 : 1));
  sun.shadow.mapSize.set(high ? 2048 : 1024, high ? 2048 : 1024);
  sun.shadow.map?.dispose();
  sun.shadow.map = null;
  renderer.shadowMap.needsUpdate = true;
}

export function resizeRenderer(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.fov = window.innerWidth < window.innerHeight ? 62 : 45;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
resizeRenderer();

// ---------- Relevo medido (LRO LOLA) ----------

function regolithTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#a3a6b0';
    ctx.fillRect(0, 0, 128, 128);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Superfície lunar real (Poly Haven "Moon Dusted 01", CC0; public/textures/moon/LICENSE.txt). */
function moonGroundMaterial(): THREE.MeshStandardMaterial {
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, map: regolithTexture(), roughness: 1, metalness: 0 });
  const loader = new THREE.TextureLoader();
  const dir = `${import.meta.env.BASE_URL}textures/moon/`;
  const tile = (t: THREE.Texture): THREE.Texture => {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(60, 60);
    t.anisotropy = 4;
    return t;
  };
  loader.load(`${dir}dusted_diff.jpg`, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    m.map = tile(t);
    m.needsUpdate = true;
  });
  loader.load(`${dir}dusted_nor.jpg`, (t) => {
    m.normalMap = tile(t);
    m.needsUpdate = true;
  });
  loader.load(`${dir}dusted_rough.jpg`, (t) => {
    m.roughnessMap = tile(t);
    m.needsUpdate = true;
  });
  return m;
}

function buildTerrain(): THREE.BufferGeometry {
  const { n, size_m, heights_m } = TERRAIN_MESH;
  const step = size_m / (n - 1);
  const half = size_m / 2;
  const positions = new Float32Array(n * n * 3);
  const uvs = new Float32Array(n * n * 2);
  const colors = new Float32Array(n * n * 3);
  let minH = Infinity;
  let maxH = -Infinity;
  for (const h of heights_m) {
    minH = Math.min(minH, h);
    maxH = Math.max(maxH, h);
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      positions[3 * k] = -half + i * step;
      positions[3 * k + 1] = heights_m[k] * VERTICAL_EXAGGERATION;
      positions[3 * k + 2] = half - j * step;
      uvs[2 * k] = i / (n - 1);
      uvs[2 * k + 1] = j / (n - 1);
      // Tom decorativo: partes altas um pouco mais claras (a geometria medida não muda).
      const t = (heights_m[k] - minH) / Math.max(1e-6, maxH - minH);
      const grain = 0.93 + 0.07 * Math.sin(k * 12.9898) * Math.cos(k * 0.37);
      const shade = (0.82 + 0.18 * t) * grain;
      colors[3 * k] = shade;
      colors[3 * k + 1] = shade * 0.99;
      colors[3 * k + 2] = shade * 0.97;
    }
  }
  const index: number[] = [];
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      index.push(a, a + 1, a + n, a + 1, a + n + 1, a + n);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}
const ground = new THREE.Mesh(buildTerrain(), moonGroundMaterial());
ground.receiveShadow = true;
scene.add(ground);

// ---------- Luz ----------

/** Sol: luz direcional com sombras, na direção da tabela do JPL Horizons. */
const sun = new THREE.DirectionalLight(PALETTE.sunlight, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.04;
const SHADOW_HALF = 48;
Object.assign(sun.shadow.camera, { left: -SHADOW_HALF, right: SHADOW_HALF, top: SHADOW_HALF, bottom: -SHADOW_HALF, near: 1, far: 220 });
scene.add(sun, sun.target);
/** Preenchimento artístico (legibilidade): não faz parte da simulação de luz. */
const ambient = new THREE.HemisphereLight(PALETTE.skyFill, PALETTE.groundFill, 0.5);
scene.add(ambient);
/** Luz de recorte fria, oposta ao Sol: separa as peças do fundo escuro (escolha visual). */
const rim = new THREE.DirectionalLight(0x9fb8ff, 0.35);
scene.add(rim, rim.target);

const SKY_SUN_DISTANCE = 380;
const sunDisk = new THREE.Mesh(new THREE.SphereGeometry(5, 32, 16), new THREE.MeshBasicMaterial({ color: PALETTE.sunlight, fog: false, toneMapped: false }));
const sunGlow = new THREE.Mesh(
  new THREE.SphereGeometry(16, 32, 16),
  new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.2, depthWrite: false, fog: false, toneMapped: false }),
);
scene.add(sunDisk, sunGlow);

// ---------- Céu: estrelas e Terra ----------

const starsGeo = new THREE.BufferGeometry();
const starPositions: number[] = [];
const starColors: number[] = [];
let seed = 7;
const rnd = (): number => ((seed = (seed * 16807) % 2147483647) / 2147483647);
for (let i = 0; i < 2200; i++) {
  const theta = rnd() * Math.PI * 2;
  const phi = Math.acos(2 * rnd() - 1);
  const r = 600;
  starPositions.push(r * Math.sin(phi) * Math.cos(theta), Math.abs(r * Math.cos(phi)) - 20, r * Math.sin(phi) * Math.sin(theta));
  const b = 0.45 + rnd() * 0.55;
  const warm = rnd();
  starColors.push(b * (warm > 0.8 ? 1 : 0.85), b * 0.9, b * (warm < 0.2 ? 1 : 0.88));
}
starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
starsGeo.setAttribute('color', new THREE.Float32BufferAttribute(starColors, 3));
scene.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({ size: 1.4, sizeAttenuation: false, vertexColors: true, fog: false })));

/** Terra (NASA Blue Marble, domínio público). Posição ilustrativa: baixa no céu, perto do horizonte, como se vê do polo sul. */
export const EARTH_AZ = -18;
export const EARTH_EL = 7;
const EARTH_DISTANCE = 520;
function earthMaterial(): THREE.MeshStandardMaterial {
  // Brilho próprio fraco (escolha visual): a Terra continua legível mesmo com o lado do dia de costas.
  const m = new THREE.MeshStandardMaterial({ color: 0x2f6fb0, roughness: 0.75, fog: false, emissive: 0xffffff, emissiveIntensity: 0 });
  new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/earth/earth_land_shallow_topo_2048.jpg`, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    m.map = t;
    m.emissiveMap = t;
    m.emissiveIntensity = 0.55;
    m.color.set(0xffffff);
    m.needsUpdate = true;
  });
  return m;
}
const earth = new THREE.Mesh(new THREE.SphereGeometry(16, 48, 32), earthMaterial());
{
  const az = THREE.MathUtils.degToRad(EARTH_AZ);
  const el = THREE.MathUtils.degToRad(EARTH_EL);
  earth.position.set(Math.sin(az) * Math.cos(el) * EARTH_DISTANCE, Math.sin(el) * EARTH_DISTANCE, -Math.cos(az) * Math.cos(el) * EARTH_DISTANCE);
  earth.rotation.set(0.4, 2.2, 0);
}
// A Terra recebe a mesma luz do Sol da cena: a fase iluminada muda com o azimute real do Sol.
scene.add(earth);

// ---------- Base ----------

scene.add(base);

// ---------- Rover ----------

export const robot = new THREE.Group();
robot.name = 'rover';
const robotBodyMat = new THREE.MeshStandardMaterial({ color: PALETTE.robot, emissive: 0x402800, roughness: 0.4 });
{
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.6, 1.4), robotBodyMat);
  body.position.y = 0.8;
  body.castShadow = true;
  robot.add(body);
}
const beaconMat = new THREE.MeshStandardMaterial({ color: PALETTE.beacon, emissive: PALETTE.beacon, emissiveIntensity: 1.5 });
const rover = {
  beacon: null as THREE.Object3D | null,
  beaconMat,
  bodyMat: null as THREE.MeshStandardMaterial | null,
  wheels: [] as THREE.Object3D[],
  drill: null as THREE.Object3D | null,
  headlights: [] as THREE.MeshStandardMaterial[],
  cargo: null as THREE.Mesh | null,
};
scene.add(robot);
// Carga visível: caixa de gelo (azul) ou painel (placa) sobre o rover durante a volta ou a ida.
const cargoIce = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.35, 0.9), new THREE.MeshStandardMaterial({ color: 0x9fd8ff, emissive: 0x2f5f8f, emissiveIntensity: 0.6, roughness: 0.3 }));
const cargoPanel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 1.0), new THREE.MeshStandardMaterial({ color: 0x3f6fb0, metalness: 0.5, roughness: 0.3 }));
for (const c of [cargoIce, cargoPanel]) {
  c.position.set(-0.3, 1.55, 0);
  c.castShadow = true;
  c.visible = false;
  robot.add(c);
}

// ---------- Poeira (balística, sem ar: arcos parabólicos e queda limpa, sem nuvem) ----------

const DUST_MAX = 420;
const LUNAR_G = 1.62;
const dustPos = new Float32Array(DUST_MAX * 3);
const dustVel = new Float32Array(DUST_MAX * 3);
const dustLife = new Float32Array(DUST_MAX);
const dustGeo = new THREE.BufferGeometry();
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xb8b4aa, size: 0.09, transparent: true, opacity: 0.85, depthWrite: false }));
dust.frustumCulled = false;
scene.add(dust);
let dustCursor = 0;
for (let i = 0; i < DUST_MAX; i++) dustPos[3 * i + 1] = -999;

/** Lança `n` grãos a partir de (x, y, z), com velocidade horizontal até `spread` e vertical até `up` (m/s). */
export function emitDust(x: number, y: number, z: number, n: number, spread: number, up: number): void {
  for (let k = 0; k < n; k++) {
    const i = dustCursor;
    dustCursor = (dustCursor + 1) % DUST_MAX;
    const a = Math.random() * Math.PI * 2;
    const s = Math.random() * spread;
    dustPos.set([x, y, z], 3 * i);
    dustVel.set([Math.cos(a) * s, 0.3 + Math.random() * up, Math.sin(a) * s], 3 * i);
    dustLife[i] = 4;
  }
}

function updateDust(dt: number): void {
  if (dt <= 0) return;
  for (let i = 0; i < DUST_MAX; i++) {
    if (dustLife[i] <= 0) continue;
    dustLife[i] -= dt;
    dustVel[3 * i + 1] -= LUNAR_G * dt;
    const x = (dustPos[3 * i] += dustVel[3 * i] * dt);
    const z = (dustPos[3 * i + 2] += dustVel[3 * i + 2] * dt);
    dustPos[3 * i + 1] += dustVel[3 * i + 1] * dt;
    if (dustPos[3 * i + 1] < surfaceHeight(x, z) || dustLife[i] <= 0) {
      dustLife[i] = 0;
      dustPos[3 * i + 1] = -999;
    }
  }
  dustGeo.attributes.position.needsUpdate = true;
}

// ---------- Trajetos do rover ----------

type Path = readonly Spot[];

/** Ponto e rumo ao longo da linha, por fração do comprimento (0..1). */
function along(path: Path, k: number): { x: number; z: number; heading: number } {
  const seg: number[] = [];
  let total = 0;
  for (let i = 0; i < path.length - 1; i++) {
    const d = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].z - path[i].z);
    seg.push(d);
    total += d;
  }
  let dist = Math.min(1, Math.max(0, k)) * total;
  for (let i = 0; i < seg.length; i++) {
    if (dist <= seg[i] || i === seg.length - 1) {
      const f = seg[i] > 0 ? Math.min(1, dist / seg[i]) : 1;
      const a = path[i];
      const b = path[i + 1];
      return { x: a.x + (b.x - a.x) * f, z: a.z + (b.z - a.z) * f, heading: Math.atan2(-(b.z - a.z), b.x - a.x) };
    }
    dist -= seg[i];
  }
  const last = path[path.length - 1];
  return { x: last.x, z: last.z, heading: 0 };
}

const PROCESSOR_FRONT: Spot = { x: ICE_PROCESSOR.x, z: ICE_PROCESSOR.z - 2.6 };

/** Rotas de ida (garagem → local) por tipo de missão. A volta é a mesma linha ao contrário. */
function routeFor(kind: TaskKind, panelSlot: number): Path {
  if (kind === 'ice') return ICE_ROUTE;
  if (kind === 'antenna') return [DOCK, { x: 7, z: -9 }, ANTENNA_WORK];
  const slot = PANEL_SLOTS[Math.min(panelSlot, PANEL_SLOTS.length - 1)];
  // Contorna o habitat pelo norte e entra no campo solar pelo corredor entre as colunas.
  return [DOCK, { x: 6, z: -11 }, { x: -6, z: -11 }, { x: slot.x + 1.8, z: -11 }, { x: slot.x + 1.8, z: slot.z }];
}

/** Posição atual do rover (para voltar caminhando depois de cancelar). */
const roverAt = { x: DOCK.x, z: DOCK.z, heading: Math.PI / 2 };
const ROVER_RETURN_SPEED = 6; // m/s, só para voltar à garagem fora de uma missão

export interface RoverView {
  readonly working: boolean;
  readonly moving: boolean;
  readonly phase: MissionPhase | null;
  readonly kind: TaskKind | null;
  readonly k: number;
}

function setRover(x: number, z: number, heading: number, bob = 0): void {
  roverAt.x = x;
  roverAt.z = z;
  roverAt.heading = heading;
  robot.position.set(x, surfaceHeight(x, z) + bob, z);
  robot.rotation.y = heading;
}

/**
 * Posiciona o rover pela fase da tarefa da frente da fila (src/engine/mission.ts): preparação na garagem,
 * deslocamento pela rota, operação no local, volta e entrega. Tarefa suspensa (radiação ou sem bateria):
 * o rover fica parado onde estava, como o motor.
 */
function placeRover(state: GameState, t: number, dt: number, radiation: boolean): RoverView {
  const task = state.robot.queue[0];
  const working = !!task && isWorking(state.robot, state.vitals.battery) && !radiation;
  if (task && !working) {
    setRover(roverAt.x, roverAt.z, roverAt.heading);
    return { working: false, moving: false, phase: missionPhase(task), kind: task.kind, k: phaseProgress(task) };
  }
  if (!task) {
    const dx = DOCK.x - roverAt.x;
    const dz = DOCK.z - roverAt.z;
    const dist = Math.hypot(dx, dz);
    const step = Math.min(dist, ROVER_RETURN_SPEED * dt);
    if (dist > 0.05) {
      setRover(roverAt.x + (dx / dist) * step, roverAt.z + (dz / dist) * step, Math.atan2(-dz, dx));
      return { working: false, moving: step > 0, phase: null, kind: null, k: 0 };
    }
    roverAt.heading += (Math.PI / 2 - roverAt.heading) * Math.min(1, dt * 2);
    setRover(DOCK.x, DOCK.z, roverAt.heading);
    return { working: false, moving: false, phase: null, kind: null, k: 0 };
  }
  const phase = missionPhase(task);
  const k = phaseProgress(task);
  const route = routeFor(task.kind, state.installation.panels);
  const back: Path = task.kind === 'ice' ? [...route].reverse().slice(0, -1).concat([PROCESSOR_FRONT]) : [...route].reverse();
  let moving = false;
  if (phase === 'prep') {
    // Preparação: na garagem, girando para a rota.
    const first = along(route, 0.02);
    const h = roverAt.heading + (first.heading - roverAt.heading) * Math.min(1, dt * 3);
    setRover(DOCK.x, DOCK.z, h);
  } else if (phase === 'travel') {
    const p = along(route, k);
    setRover(p.x, p.z, p.heading, 0.015 * Math.sin(t * 22));
    moving = true;
  } else if (phase === 'operate') {
    const p = along(route, 1);
    setRover(p.x, p.z, roverAt.heading);
  } else if (phase === 'return') {
    const p = along(back, k);
    setRover(p.x, p.z, p.heading, 0.015 * Math.sin(t * 22));
    moving = true;
  } else {
    const p = along(back, 1);
    setRover(p.x, p.z, task.kind === 'ice' ? Math.PI / 2 : roverAt.heading);
  }
  return { working: true, moving, phase, kind: task.kind, k };
}

// ---------- Tripulação ----------

type Clip = 'idle' | 'walk' | 'run' | 'work' | 'wave';

interface Crew {
  mixer: THREE.AnimationMixer | null;
  actions: Partial<Record<Clip, THREE.AnimationAction>>;
  current: Clip | '';
  node: THREE.Object3D | null;
  x: number;
  z: number;
  home: { x: number; z: number };
  moving: boolean;
  working: boolean;
  /** Segundos restantes em que ainda conta como andando (evita piscar entre quadros). */
  moveTimer: number;
  /** Velocidade atual em m/s (cadência da caminhada). */
  speed: number;
  legs: THREE.Object3D[];
  arms: THREE.Object3D[];
}

const crew: Crew[] = [
  { mixer: null, actions: {}, current: '', node: null, x: 5.6, z: 1.4, home: { x: 5.6, z: 1.4 }, moving: false, working: false, moveTimer: 0, speed: 0, legs: [], arms: [] },
  { mixer: null, actions: {}, current: '', node: null, x: 6.2, z: -1.2, home: { x: 6.2, z: -1.2 }, moving: false, working: false, moveTimer: 0, speed: 0, legs: [], arms: [] },
];
const CREW_WALK_SPEED = 1.4;
/** Abrigo: dentro do habitat, pela câmara de descompressão. */
const SHELTER = { x: AIRLOCK.x - 1.2, z: AIRLOCK.z };

/**
 * Leva o astronauta até o destino sem teletransporte: o destino deriva do estado do motor (acompanha pausa
 * e velocidade do jogo) e a velocidade máxima só evita saltos (abrigo, retomada de tarefa).
 */
function followCrew(member: Crew, tx: number, tz: number, dt: number, maxSpeed: number): void {
  const dx = tx - member.x;
  const dz = tz - member.z;
  const dist = Math.hypot(dx, dz);
  const step = Math.min(dist, maxSpeed * dt);
  if (step > 1e-4) {
    member.x += (dx / dist) * step;
    member.z += (dz / dist) * step;
    member.moveTimer = 0.18;
    member.speed = dt > 0 ? step / dt : 0;
    if (member.node) member.node.rotation.y = Math.atan2(dx, dz);
  } else {
    member.moveTimer = Math.max(0, member.moveTimer - dt);
    member.speed = 0;
  }
  member.moving = member.moveTimer > 0;
  if (member.node) {
    member.node.position.set(member.x, surfaceHeight(member.x, member.z), member.z);
    // Dentro do habitat (abrigo) o astronauta não aparece.
    member.node.visible = Math.hypot(member.x - SHELTER.x, member.z - SHELTER.z) > 0.6;
  }
}

function faceTowards(member: Crew, x: number, z: number): void {
  if (member.node && !member.moving) member.node.rotation.y = Math.atan2(x - member.x, z - member.z);
}

function playCrewClip(member: Crew, name: Clip): void {
  if (!member.mixer || member.current === name) return;
  const next = member.actions[name] ?? (name === 'wave' || name === 'work' ? member.actions.idle : undefined);
  if (!next) return;
  next.reset().fadeIn(0.25).play();
  if (member.current) member.actions[member.current]?.fadeOut(0.25);
  member.current = name;
}

function animateCrew(member: Crew, t: number, dt: number): void {
  if (member.mixer) {
    playCrewClip(member, member.moving ? (member.actions.walk ? 'walk' : 'run') : member.working ? 'work' : 'idle');
    const cadence = member.moving ? Math.min(3, Math.max(0.6, member.speed / CREW_WALK_SPEED)) : 1;
    const gait = member.actions.walk ?? member.actions.run;
    if (gait) gait.timeScale = member.actions.walk ? cadence : 0.45 * cadence;
    member.mixer.update(dt);
    return;
  }
  const swing = member.moving ? Math.sin(t * 7) * 0.55 : 0;
  member.legs.forEach((leg, i) => (leg.rotation.x = i === 0 ? swing : -swing));
  member.arms.forEach((arm, i) => (arm.rotation.x = i === 0 ? -swing : swing));
}

/** Pontos de trabalho na estufa, um por astronauta (lados diferentes da porta). */
const GH_WORK_SPOTS: readonly Spot[] = [
  { x: GREENHOUSE.x + 3.1, z: GREENHOUSE.z - 1.9 },
  { x: GREENHOUSE.x + 2.4, z: GREENHOUSE.z + 1.7 },
];
/** Rota de casa até a estufa: contorna o habitat pelo lado leste. */
function crewPath(i: number): Path {
  return [crew[i].home, { x: 4.4, z: 5.4 }, GH_WORK_SPOTS[i] ?? GH_WORK_SPOTS[0]];
}
const CREW_FOLLOW_SPEED = 9;
const CREW_SHELTER_SPEED = 6;

/**
 * Tripulação (D-18): quem tem tarefa anda, trabalha e volta pela fase do motor (src/engine/astronaut.ts);
 * os outros ficam em casa (o ajudante vai ao processador durante a missão de gelo). Radiação ou abrigo: todos vão ao abrigo.
 */
function updateCrew(state: GameState, t: number, dt: number, view: RoverView, radiation: boolean): void {
  const shelter = radiation || state.crewOrder === 'shelter';
  crew.forEach((member, i) => {
    if (shelter) {
      followCrew(member, SHELTER.x, SHELTER.z, dt, CREW_SHELTER_SPEED);
      member.working = false;
      return;
    }
    const task = state.agents[i]?.task ?? null;
    if (task) {
      const out = crewPath(i);
      const spot = out[out.length - 1];
      if (task.phase === 'prep') {
        followCrew(member, member.home.x, member.home.z, dt, CREW_FOLLOW_SPEED);
        member.working = false;
        faceTowards(member, spot.x, spot.z);
      } else if (task.phase === 'work') {
        followCrew(member, spot.x, spot.z, dt, CREW_FOLLOW_SPEED);
        member.working = !member.moving;
        faceTowards(member, GREENHOUSE.x, GREENHOUSE.z);
      } else {
        const p = along(task.phase === 'out' ? out : [...out].reverse(), phaseFraction(task));
        followCrew(member, p.x, p.z, dt, CREW_FOLLOW_SPEED);
        member.working = false;
      }
      return;
    }
    const iceWork = i === 1 && view.kind === 'ice' && view.working && (view.phase === 'return' || view.phase === 'deliver' || view.phase === 'operate');
    if (iceWork) {
      followCrew(member, ICE_PROCESSOR.x - 2.2, ICE_PROCESSOR.z - 1, dt, CREW_WALK_SPEED);
      member.working = !member.moving;
      faceTowards(member, ICE_PROCESSOR.x, ICE_PROCESSOR.z);
    } else {
      followCrew(member, member.home.x, member.home.z, dt, CREW_WALK_SPEED);
      member.working = false;
      faceTowards(member, robot.position.x, robot.position.z);
    }
  });
  for (const member of crew) animateCrew(member, t, dt);
}

/** Astronauta: tenta o modelo externo CC0 (ext/astronaut), o Earthset v2, o CC0 OGA e por fim o antigo. */
export function loadCrewModels(): Promise<unknown> {
  return Promise.all(
    crew.map(async (member) => {
      const candidates: Array<{ name: string; scale: number; y: number; fix: boolean }> = [
        { name: 'ext/astronaut', scale: 1, y: 0, fix: false },
        { name: 'astronaut_v2', scale: 1.3, y: 0, fix: true },
        { name: 'astronaut_oga', scale: 1, y: 0.96, fix: false },
      ];
      for (const c of candidates) {
        try {
          const gltf = await loadGltf(c.name);
          const node = cloneSkinned(gltf.scene);
          node.traverse((obj) => {
            obj.castShadow = true;
            if (c.fix && obj instanceof THREE.Mesh) {
              const m = (obj.material as THREE.MeshStandardMaterial).clone();
              m.metalness = 0.05;
              m.roughness = 0.7;
              obj.material = m;
            }
          });
          node.position.y = c.y;
          node.scale.setScalar(c.scale);
          const holder = new THREE.Group();
          holder.name = 'astronaut';
          holder.add(node);
          scene.add(holder);
          member.node = holder;
          const mixer = new THREE.AnimationMixer(node);
          for (const clip of gltf.animations) {
            const n = clip.name.toLowerCase();
            const key: Clip | null = n.includes('wave') ? 'wave' : n.includes('walk') ? 'walk' : n.includes('run') ? 'run' : n.includes('work') || n.includes('interact') ? 'work' : n.includes('idle') || n === 'default' ? 'idle' : null;
            if (key && !member.actions[key]) member.actions[key] = mixer.clipAction(clip);
          }
          member.mixer = mixer;
          playCrewClip(member, 'idle');
          return;
        } catch {
          // tenta o próximo
        }
      }
      const source = await loadModel('astronaut');
      const node = source.clone(true);
      node.traverse((obj) => (obj.castShadow = true));
      scene.add(node);
      member.node = node;
      member.legs = ['leg_L', 'leg_R'].map((n) => node.getObjectByName(n)).filter((o): o is THREE.Object3D => o !== undefined);
      member.arms = ['arm_L', 'arm_R'].map((n) => node.getObjectByName(n)).filter((o): o is THREE.Object3D => o !== undefined);
    }),
  );
}

/** Objeto do astronauta (para a câmera). */
export function crewObject(i = 0): THREE.Object3D | null {
  return crew[i]?.node ?? null;
}

/** Faz um astronauta acenar (introdução e momentos da história), se o modelo tiver o clipe. */
export function crewWave(i: number, on: boolean): void {
  const member = crew[i];
  if (!member) return;
  if (on) playCrewClip(member, 'wave');
  else member.current = '';
}

// ---------- Atualização por quadro ----------

let lastNow = 0;
const sunDir = new THREE.Vector3();
const dustOffset = new THREE.Vector3();
const AXIS_Y = new THREE.Vector3(0, 1, 0);

export function updateScene(state: GameState, now: number, lit: boolean, weather: SpaceWeatherSample, animate = true): RoverView {
  // Sol na direção real (azimute a partir do norte = −z, leste = +x).
  const { az, el } = sampleAt(SUN, state.clock.hour);
  const azRad = THREE.MathUtils.degToRad(az);
  const elRad = THREE.MathUtils.degToRad(el);
  const dir = sunDir.set(Math.sin(azRad) * Math.cos(elRad), Math.sin(elRad), -Math.cos(azRad) * Math.cos(elRad));
  sun.position.copy(dir).multiplyScalar(120);
  sun.target.position.set(0, 0, 0);
  sun.intensity = lit ? 3.4 : 0;
  ambient.intensity = lit ? 0.55 : 0.42;
  rim.position.set(-dir.x * 100, 60, -dir.z * 100);
  sunDisk.position.copy(dir).multiplyScalar(SKY_SUN_DISTANCE);
  sunGlow.position.copy(sunDisk.position);
  sunDisk.visible = sunGlow.visible = lit;

  const t = now / 1000;
  const dt = !animate || lastNow === 0 ? 0 : Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
  lastNow = now;

  const view = placeRover(state, t, dt, weather.radiation);
  updateCrew(state, t, dt, view, weather.radiation);

  // Rover: rodas giram só ao se deslocar; broca desce e gira na operação de gelo; poeira das rodas e da broca.
  const speedSpin = view.moving ? 9 : 0;
  for (const wheel of rover.wheels) wheel.rotation.z -= speedSpin * dt;
  const drilling = view.working && view.kind === 'ice' && view.phase === 'operate';
  if (rover.drill) rover.drill.rotation.x += ((drilling ? -0.9 : 0) - rover.drill.rotation.x) * Math.min(1, dt * 4);
  if (view.moving && dt > 0 && Math.random() < 0.7) {
    const back = dustOffset.set(-1.2, 0, 0).applyAxisAngle(AXIS_Y, robot.rotation.y);
    emitDust(robot.position.x + back.x, robot.position.y + 0.25, robot.position.z + back.z, 3, 0.8, 1.2);
  }
  if (drilling && dt > 0 && Math.random() < 0.8) {
    const front = dustOffset.set(1.6, 0, 0).applyAxisAngle(AXIS_Y, robot.rotation.y);
    emitDust(robot.position.x + front.x, robot.position.y + 0.1, robot.position.z + front.z, 4, 1.1, 1.8);
  }
  updateDust(dt);
  // Carga: gelo na volta e na entrega; painel na ida.
  cargoIce.visible = view.working && view.kind === 'ice' && (view.phase === 'return' || (view.phase === 'deliver' && view.k < 0.5));
  cargoPanel.visible = view.working && view.kind === 'panel' && (view.phase === 'prep' || view.phase === 'travel');
  robotBodyMat.emissiveIntensity = view.working ? 0.6 : 0.15;
  if (rover.bodyMat) rover.bodyMat.emissiveIntensity = view.working ? 0.35 : 0.05;
  // Farol: azul em operação, vermelho na radiação; pisca enquanto trabalha.
  const beaconHex = weather.radiation ? 0xff5a5a : PALETTE.beacon;
  rover.beaconMat.color.setHex(beaconHex);
  rover.beaconMat.emissive.setHex(beaconHex);
  rover.beaconMat.emissiveIntensity = !view.working || Math.sin(t * 6) > -0.2 ? 2.2 : 0.2;
  for (const m of rover.headlights) m.emissiveIntensity = view.working ? 3 : 0.4;

  updateCrop(state.crop.growth);
  const level = stormLevel(weather.kp);
  const batteryPct = (state.vitals.battery / state.installation.batteryCapacity) * 100;
  updateBase({
    t,
    panels: state.installation.panels,
    building: view.working && view.kind === 'panel' && view.phase === 'operate' ? { slot: state.installation.panels, k: view.k } : null,
    batteryPct,
    anyCritical: batteryPct < 20 || state.vitals.air < 30 || state.vitals.water < 20 || state.vitals.food < 20,
    greenhouseOn: state.crewOrder === 'auto' && isGreenhouseOn(state.vitals, state.installation),
    greenhouseVisible: state.installation.greenhouse !== 'off',
    antennaOnline: state.robot.antennaInstalled,
    antennaRepairing: view.working && view.kind === 'antenna' && (view.phase === 'operate' || view.phase === 'deliver'),
    processing: view.working && view.kind === 'ice' && view.phase === 'deliver',
    iceActive: state.robot.queue.some((q) => q.kind === 'ice'),
    panelGlow: 0.6 * solarFactor(level) * (lit ? 1 : 0.25),
    earthAz: EARTH_AZ,
    earthEl: EARTH_EL,
  });
  return view;
}

/** Recomeça posições e fases das animações (nova missão). */
export function resetScenePresentation(): void {
  lastNow = 0;
  setRover(DOCK.x, DOCK.z, Math.PI / 2);
  for (const member of crew) {
    member.x = member.home.x;
    member.z = member.home.z;
    member.moving = false;
    member.node?.position.set(member.x, surfaceHeight(member.x, member.z), member.z);
  }
  for (let i = 0; i < DUST_MAX; i++) {
    dustLife[i] = 0;
    dustPos[3 * i + 1] = -999;
  }
}
setRover(DOCK.x, DOCK.z, Math.PI / 2);

// ---------- Modelos ----------

/** Base (v4 com recuo) e rover (v4 de seis rodas com recuo para o anterior). */
export function loadBaseModels(): Promise<unknown> {
  const roverJob = (async () => {
    for (const name of ['v4/rover_v4', 'ext/rover', 'rover']) {
      try {
        const model = await attachModel(robot, name);
        model.traverse((node) => {
          if (!(node instanceof THREE.Mesh)) return;
          const original = node.material as THREE.Material | THREE.Material[];
          const list = Array.isArray(original) ? original : [original];
          const mapped = list.map((m) => {
            if (!(m instanceof THREE.MeshStandardMaterial)) return m;
            if (m.name === 'chassis') {
              const c = m.clone();
              c.emissive.setHex(0x402800);
              rover.bodyMat = c;
              return c;
            }
            if (m.name === 'beacon') {
              const c = m.clone();
              rover.beaconMat = c;
              return c;
            }
            if (m.name === 'headlight') {
              const c = m.clone();
              rover.headlights.push(c);
              return c;
            }
            return m;
          });
          node.material = Array.isArray(original) ? mapped : mapped[0];
        });
        rover.beacon = model.getObjectByName('beacon') ?? null;
        rover.drill = model.getObjectByName('drill') ?? null;
        rover.wheels = [];
        model.traverse((node) => {
          if (/^wheel_/.test(node.name)) rover.wheels.push(node);
        });
        // O rover antigo era pequeno: escala para ~2,6 m de comprimento.
        if (name === 'rover') model.scale.setScalar(1.7);
        for (const c of [cargoIce, cargoPanel]) robot.add(c);
        cargoIce.visible = cargoPanel.visible = false;
        return;
      } catch {
        // próximo
      }
    }
  })();
  return Promise.allSettled([loadBaseLayoutModels(), roverJob]);
}
