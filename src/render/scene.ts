// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Cena three.js (Earthset 4.0): relevo medido, céu, base por áreas, rover, tripulação e luz.
// Só desenha o estado recebido; regra fica no motor. Fases das missões vêm de src/engine/mission.ts.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GameState } from '../engine/game';
import { isGreenhouseOn } from '../engine/resources';
import { phaseFraction, type AgentTaskKind } from '../engine/astronaut';
import { TUNE_HOURS, calibrationFactor } from '../engine/facilities';
import type { SpaceWeatherSample } from '../engine/space-weather';
import { isWorking, type TaskKind } from '../engine/robot';
import { safeDistance } from '../engine/safe-mode';
import { missionPhase, phaseProgress, type MissionPhase } from '../engine/mission';
import { sunPositionAt } from '../engine/sun';
import { bodyAt, direction } from '../astronomy/sky';
import { SKY } from '../data/sky';
import { SUN } from '../data/sun';
import { TERRAIN_MESH } from '../data/terrain-mesh';
import { attachModel, loadGltf, loadModel } from './assets';
import { LEVELED_HEIGHTS, surfaceHeight } from './terrain-height';
import { AIRLOCK, DOCK, GREENHOUSE_DOOR, ICE_PROCESSOR, ICE_SITE, PANEL_SLOTS, type Spot } from './layout';
import { antenna, base, loadBaseLayoutModels, updateBase } from './base-layout';
import { updateCrop } from './crop';
import { astronomicalSky, updateSky } from './sky';
import { CREW_HOMES, ICE_HELPER, PANEL_FIELD_WORK, pathBetween, sampleInto, siteFocus, workSpot } from './crew-nav';
import { distanceAt, roverReturn, roverRoute, roverTrack } from './rover-routes';
import { createWalker, LOPE_SPEED, remaining, setPath, stepGait, stepWalker, type Drive, type Walker } from './crew-gait';
import { CrewRig, type PoseClip } from './crew-rig';

/** Paleta da cena (tokens de docs/VISUAL_DIRECTION.md). */
export const PALETTE = {
  space: 0x03050a,
  sunlight: 0xfffaf3,
  skyFill: 0x969696,
  groundFill: 0x282828,
  robot: 0xffc857,
  beacon: 0x7fd7ff,
  panelGlow: 0x0c2446,
} as const;

// ---------- Renderizador ----------

export const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
// O mapa de sombra é redesenhado em quadros alternados (ver main.ts): metade do custo, diferença invisível a 60 fps.
renderer.shadowMap.autoUpdate = false;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.95;
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
  const size = high ? 2048 : 1024;
  if (sun.shadow.mapSize.x !== size) {
    sun.shadow.map?.dispose();
    sun.shadow.map = null;
    sun.shadow.mapSize.set(size, size);
  }
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
  const { n, size_m } = TERRAIN_MESH;
  const step = size_m / (n - 1);
  const half = size_m / 2;
  const positions = new Float32Array(n * n * 3);
  const uvs = new Float32Array(n * n * 2);
  const colors = new Float32Array(n * n * 3);
  let minH = Infinity;
  let maxH = -Infinity;
  // Alturas já com exagero e plataforma da base (terrain-height.ts): o mesmo valor que os objetos usam para pousar.
  for (const h of LEVELED_HEIGHTS) {
    minH = Math.min(minH, h);
    maxH = Math.max(maxH, h);
  }
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      positions[3 * k] = -half + i * step;
      positions[3 * k + 1] = LEVELED_HEIGHTS[k];
      positions[3 * k + 2] = half - j * step;
      uvs[2 * k] = i / (n - 1);
      uvs[2 * k + 1] = j / (n - 1);
      // Tom decorativo: partes altas um pouco mais claras (a geometria medida não muda).
      const t = (LEVELED_HEIGHTS[k] - minH) / Math.max(1e-6, maxH - minH);
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
ground.castShadow = true;
scene.add(ground);

// ---------- Luz ----------

/** Sol: luz direcional com sombras, na direção da tabela do JPL Horizons. */
export const sun = new THREE.DirectionalLight(PALETTE.sunlight, 3.2);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.bias = -0.000015;
sun.shadow.normalBias = 0.025;
// Volume longo na direção solar: casters do relevo inteiro e sombras rasantes não são cortados a 220 m.
const SHADOW_HALF = 72;
Object.assign(sun.shadow.camera, { left: -SHADOW_HALF, right: SHADOW_HALF, top: SHADOW_HALF, bottom: -SHADOW_HALF, near: 700, far: 1700 });
scene.add(sun, sun.target);
/** Preenchimento artístico (legibilidade): não faz parte da simulação de luz. */
const ambient = new THREE.HemisphereLight(PALETTE.skyFill, PALETTE.groundFill, 0.3);
scene.add(ambient);
/** Luz de recorte fria, oposta ao Sol: separa as peças do fundo escuro (escolha visual). */
const rim = new THREE.DirectionalLight(0xffffff, 0.12);
scene.add(rim, rim.target);
// Corpos e catálogo no mesmo referencial do Sol; sem halo atmosférico e sem emissivo no lado noturno terrestre.
scene.add(astronomicalSky);

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
// Carga da missão de gelo: regolito com gelo (escuro, ~5,6% de água em massa em Cabeus, LCROSS), não um bloco de gelo.
// Um monte que cresce na escavação e some na descarga. Ver docs/data-sources.md (extração de água).
const regolithMat = new THREE.MeshStandardMaterial({ color: 0x5d5a55, roughness: 1 });
const cargoIce = new THREE.Mesh(new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), regolithMat);
cargoIce.scale.set(0.95, 0.55, 0.95);
/** Grãos de gelo à vista no monte (brilho frio discreto). */
const cargoFrost = new THREE.Mesh(new THREE.SphereGeometry(0.51, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xcfe6f5, roughness: 0.6, transparent: true, opacity: 0.18, depthWrite: false }));
cargoIce.add(cargoFrost);
const cargoPanel = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.1, 1.0), new THREE.MeshStandardMaterial({ color: 0x3f6fb0, metalness: 0.5, roughness: 0.3 }));
for (const c of [cargoIce, cargoPanel]) {
  c.position.set(-0.3, 1.55, 0);
  c.castShadow = true;
  c.visible = false;
  robot.add(c);
}

// ---------- Local do gelo e processamento ----------
// Sequência apoiada em pesquisa (docs/data-sources.md): broca rotativa tipo TRIDENT/PRIME-1 traz o regolito com gelo,
// o rover leva ao processador, que aquece o material (conceito RESOLVE: ~150 °C) e recaptura o vapor numa armadilha fria.
// O aquecimento e a armadilha fria são conceitos testados em laboratório, ainda não operados na Lua: a tela diz isso.

/** Pilha de material escavado ao lado do furo: cresce na escavação e permanece no local (consequência visível). */
const spoilPile = new THREE.Mesh(new THREE.SphereGeometry(0.7, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x4f4c48, roughness: 1 }));
spoilPile.receiveShadow = true;
spoilPile.visible = false;
scene.add(spoilPile);
/** Brilho de aquecimento dentro do processador durante a descarga. */
const heaterLight = new THREE.PointLight(0xff8a3d, 0, 5, 2);
heaterLight.position.set(ICE_PROCESSOR.x, surfaceHeight(ICE_PROCESSOR.x, ICE_PROCESSOR.z) + 1.2, ICE_PROCESSOR.z);
scene.add(heaterLight);
let spoilVolume = 0;
let lastDigK = 0;

function updateIceSite(drilling: boolean, digK: number, deliverK: number, t: number): void {
  // A pilha cresce com o que foi escavado (cada viagem soma) e não diminui na partida.
  if (drilling && digK > lastDigK) spoilVolume = Math.min(6, spoilVolume + (digK - lastDigK));
  lastDigK = drilling ? digK : 0;
  if (spoilVolume > 0.01) {
    const r = 0.45 + 0.35 * Math.cbrt(spoilVolume);
    const px = ICE_SITE.x + 2.1;
    const pz = ICE_SITE.z + 1.4;
    spoilPile.visible = true;
    spoilPile.position.set(px, surfaceHeight(px, pz) - 0.05, pz);
    spoilPile.scale.set(r, 0.45 * r, r);
  }
  // Processador: aquece na primeira metade da descarga (material entrando), esfria na segunda.
  heaterLight.intensity = deliverK < 0 ? 0 : (deliverK < 0.85 ? 6 : 6 * (1 - (deliverK - 0.85) / 0.15)) * (0.85 + 0.15 * Math.sin(t * 9));
}

/** Nova partida: o local do gelo volta intocado. */
function resetIceSite(): void {
  spoilVolume = 0;
  lastDigK = 0;
  spoilPile.visible = false;
  heaterLight.intensity = 0;
}

// ---------- Faíscas (reparo da antena e ligação do painel) ----------
// Mesma física da poeira: arcos balísticos na gravidade lunar, sem ar. Brilho âmbar, rápidas.

const SPARK_MAX = 120;
const sparkPos = new Float32Array(SPARK_MAX * 3);
const sparkVel = new Float32Array(SPARK_MAX * 3);
const sparkLife = new Float32Array(SPARK_MAX);
const sparkGeo = new THREE.BufferGeometry();
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
const sparks = new THREE.Points(sparkGeo, new THREE.PointsMaterial({ color: 0xffd27a, size: 0.09, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending }));
sparks.frustumCulled = false;
scene.add(sparks);
let sparkCursor = 0;
for (let i = 0; i < SPARK_MAX; i++) sparkPos[3 * i + 1] = -999;

function emitSparks(x: number, y: number, z: number, n: number): void {
  for (let k = 0; k < n; k++) {
    const i = sparkCursor;
    sparkCursor = (sparkCursor + 1) % SPARK_MAX;
    const a = Math.random() * Math.PI * 2;
    const s = 0.6 + Math.random() * 2.2;
    sparkPos.set([x, y, z], 3 * i);
    sparkVel.set([Math.cos(a) * s, 0.8 + Math.random() * 2.2, Math.sin(a) * s], 3 * i);
    sparkLife[i] = 0.5 + Math.random() * 0.6;
  }
}

function updateSparks(dt: number): void {
  if (dt <= 0) return;
  for (let i = 0; i < SPARK_MAX; i++) {
    if (sparkLife[i] <= 0) continue;
    sparkLife[i] -= dt;
    sparkVel[3 * i + 1] -= LUNAR_G * dt;
    const x = (sparkPos[3 * i] += sparkVel[3 * i] * dt);
    const z = (sparkPos[3 * i + 2] += sparkVel[3 * i + 2] * dt);
    sparkPos[3 * i + 1] += sparkVel[3 * i + 1] * dt;
    if (sparkLife[i] <= 0 || sparkPos[3 * i + 1] < surfaceHeight(x, z)) {
      sparkLife[i] = 0;
      sparkPos[3 * i + 1] = -999;
    }
  }
  sparkGeo.attributes.position.needsUpdate = true;
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

const roverProbe = { x: 0, z: 0, heading: 0 };
/**
 * Ponto e rumo do rover na trajetória (rover-routes.ts): `k` é o progresso do trecho no motor; o perfil de
 * velocidade decide a distância (freia nas curvas). `geometric` usa a fração da distância (modo seguro). O modelo olha para +x.
 */
function along(route: Path, k: number, geometric = false): { x: number; z: number; heading: number } {
  const track = roverTrack(route);
  const s = geometric ? Math.min(1, Math.max(0, k)) * track.path.length : distanceAt(track, k);
  sampleInto(track.path, s, roverProbe);
  return { x: roverProbe.x, z: roverProbe.z, heading: roverProbe.heading - Math.PI / 2 };
}

/** Velocidade visual máxima do rover nos trechos de missão (unidades por segundo real). */
const VISUAL_TRIP_SPEED = 40;

/** Posição atual do rover (para voltar caminhando depois de cancelar). */
const roverAt = { x: DOCK.x, z: DOCK.z, heading: Math.PI / 2 };
const ROVER_RETURN_SPEED = 3.5; // m/s, só para voltar à garagem fora de uma missão (mesma escala das missões, D-22)

export interface RoverView {
  readonly working: boolean;
  readonly moving: boolean;
  readonly phase: MissionPhase | null;
  readonly kind: TaskKind | null;
  readonly k: number;
}

/** Rover em trecho de missão: segue o alvo do motor com suavização (o motor avança em passos de 0,25 h). */
function followRover(tx: number, tz: number, th: number, dt: number, bob = 0): void {
  const k = Math.min(1, dt * 14);
  const dx = tx - roverAt.x;
  const dz = tz - roverAt.z;
  const dist = Math.hypot(dx, dz);
  // Passo limitado: se o quadro atrasa, o rover não salta de uma vez (ritmo constante).
  const step = Math.min(dist * k, VISUAL_TRIP_SPEED * dt);
  if (dist > 1e-9) {
    roverAt.x += (dx / dist) * step;
    roverAt.z += (dz / dist) * step;
  }
  let dh = th - roverAt.heading;
  dh = Math.atan2(Math.sin(dh), Math.cos(dh));
  roverAt.heading += dh * k;
  setRover(roverAt.x, roverAt.z, roverAt.heading, bob);
}

/** Meio comprimento e meia bitola do rover (m), onde o relevo é amostrado sob as rodas. */
const ROVER_HALF_LENGTH = 1.2;
const ROVER_HALF_TRACK = 0.8;
robot.rotation.order = 'YZX';
let roverPitch = 0;
let roverRoll = 0;

/** Pousa o rover no relevo: altura média sob as rodas e chassi inclinado (frente/trás e lateral), suavizado. */
function setRover(x: number, z: number, heading: number, bob = 0): void {
  roverAt.x = x;
  roverAt.z = z;
  roverAt.heading = heading;
  // Frente do modelo em +x: depois do giro `heading`, a frente aponta para (cos h, −sin h) no plano x–z.
  const fx = Math.cos(heading);
  const fz = -Math.sin(heading);
  const front = surfaceHeight(x + fx * ROVER_HALF_LENGTH, z + fz * ROVER_HALF_LENGTH);
  const back = surfaceHeight(x - fx * ROVER_HALF_LENGTH, z - fz * ROVER_HALF_LENGTH);
  // Lados: +z do modelo (direita) e −z (esquerda). Giro positivo em x baixa o lado +z.
  const sidePlus = surfaceHeight(x - fz * ROVER_HALF_TRACK, z + fx * ROVER_HALF_TRACK);
  const sideMinus = surfaceHeight(x + fz * ROVER_HALF_TRACK, z - fx * ROVER_HALF_TRACK);
  const pitch = Math.atan2(front - back, 2 * ROVER_HALF_LENGTH);
  const roll = Math.atan2(sideMinus - sidePlus, 2 * ROVER_HALF_TRACK);
  roverPitch += (pitch - roverPitch) * 0.25;
  roverRoll += (roll - roverRoll) * 0.25;
  robot.position.set(x, (front + back + sidePlus + sideMinus) / 4 + bob, z);
  robot.rotation.set(roverRoll, heading, roverPitch);
}

/**
 * Posiciona o rover pela fase da tarefa da frente da fila (src/engine/mission.ts): preparação na garagem,
 * deslocamento pela rota, operação no local, volta e entrega. Tarefa suspensa (radiação ou sem bateria):
 * o rover fica parado onde estava, como o motor.
 */
function placeRover(state: GameState, t: number, dt: number, radiation: boolean): RoverView {
  const task = state.robot.queue[0];
  const safe = state.robot.safe;
  if (task && safe) {
    // Modo seguro: volta pela rota da missão, na posição dada pela distância restante (motor).
    const d = safeDistance(safe);
    const p = along([...roverRoute(task.kind, state.installation.panels)].reverse(), 1 - d, true);
    const moving = safe.returnLeft > 0 && state.vitals.battery > 0;
    setRover(p.x, p.z, moving ? p.heading : roverAt.heading, moving ? 0.015 * Math.sin(t * 22) : 0);
    return { working: false, moving, phase: null, kind: null, k: 0 };
  }
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
  const route = roverRoute(task.kind, state.installation.panels);
  const back = roverReturn(task.kind, state.installation.panels);
  let moving = false;
  if (phase === 'prep') {
    // Preparação: na garagem, girando para a rota.
    const first = along(route, 0.02, true);
    const turn = Math.atan2(Math.sin(first.heading - roverAt.heading), Math.cos(first.heading - roverAt.heading));
    const h = roverAt.heading + turn * Math.min(1, dt * 3);
    setRover(DOCK.x, DOCK.z, h);
  } else if (phase === 'travel') {
    const p = along(route, k);
    followRover(p.x, p.z, p.heading, dt, 0.015 * Math.sin(t * 22));
    moving = true;
  } else if (phase === 'operate') {
    // Chega ao local com o mesmo ritmo da viagem (sem teleporte se o quadro atrasou).
    const p = along(route, 1);
    followRover(p.x, p.z, roverAt.heading, dt);
  } else if (phase === 'return') {
    const p = along(back, k);
    followRover(p.x, p.z, p.heading, dt, 0.015 * Math.sin(t * 22));
    moving = true;
  } else {
    const p = along(back, 1);
    followRover(p.x, p.z, task.kind === 'ice' ? Math.PI / 2 : roverAt.heading, dt);
  }
  return { working: true, moving, phase, kind: task.kind, k };
}

// ---------- Tripulação ----------
// Quatro camadas separadas: o motor diz a fase da tarefa (src/engine/astronaut.ts); crew-nav.ts planeja a rota
// contornando as estruturas; crew-gait.ts move o corpo com inércia e passada lunar; crew-rig.ts desenha e anima.

interface CrewMember {
  readonly walker: Walker;
  rig: CrewRig | null;
  readonly home: Spot;
  /** Destino da rota atual (a rota só é refeita quando ele muda). */
  destKey: string;
  driveKind: Drive['kind'] | '';
  pose: PoseClip;
  /** Aceno pedido pela introdução (cinematic.ts). */
  cineWave: boolean;
  /** Apoios já avisados ao som e segundos até poder avisar de novo (evita chuva de passos em 4×). */
  lastSteps: number;
  stepCooldown: number;
}

function member(home: Spot, heading: number): CrewMember {
  return { walker: createWalker(home.x, home.z, heading), rig: null, home, destKey: '', driveKind: '', pose: 'idle', cineWave: false, lastSteps: 0, stepCooldown: 0 };
}

const crew: CrewMember[] = CREW_HOMES.map((home) => member(home, Math.PI / 2));
/** Abrigo: dentro da câmara de descompressão (a rota entra pela porta). */
const SHELTER: Spot = { x: AIRLOCK.x - 1.2, z: AIRLOCK.z };
/** Ritmos próprios (m/s em 1×) fora das tarefas do motor: voltar para casa, ajudar no gelo, correr para o abrigo. */
const HOME_CRUISE = 1.3;
const HELPER_CRUISE = 1.6;
const SHELTER_CRUISE = 2.4;

/** Clipe de cada tarefa (o modelo externo tem todos; sem o clipe, a pose cai para parado). */
const TASK_POSE: Record<AgentTaskKind, PoseClip> = { inspect: 'interact', harvest: 'harvest', maintain: 'work', calibrate: 'interact', tune: 'interact' };

/** Horas de jogo por segundo real, estimadas pelo relógio (1 em 1×, 4 em 4×): o time-lapse da locomoção. */
let simRate = 1;
let simRateRaw = 1;
let lastClockHour = -1;

function headingTo(from: { x: number; z: number }, to: { x: number; z: number }): number {
  return Math.atan2(to.x - from.x, to.z - from.z);
}

/** Leva o astronauta a `dest`, refazendo a rota só quando o destino muda (sem salto: parte da posição atual). */
function routeTo(m: CrewMember, dest: Spot, drive: Drive): void {
  const key = `${dest.x.toFixed(2)},${dest.z.toFixed(2)}`;
  const w = m.walker;
  if (key !== m.destKey) {
    setPath(w, pathBetween({ x: w.x, z: w.z }, dest), drive.kind === 'track' ? drive.fraction : 0);
    m.destKey = key;
  } else if (drive.kind === 'track' && m.driveKind !== 'track') {
    w.prevTarget = drive.fraction * (w.path?.length ?? 0);
  }
  m.driveKind = drive.kind;
}

function arrived(w: Walker): boolean {
  return remaining(w) < 0.05 && w.speed < 0.05 * simRate;
}

function aligned(w: Walker, heading: number): boolean {
  return Math.abs(Math.atan2(Math.sin(heading - w.heading), Math.cos(heading - w.heading))) < 0.3;
}

/**
 * Passos para o som (UX-01): cada apoio de pé vira um aviso, com volume pela velocidade, mais baixo no passo saltado
 * (gravidade lunar: pouso macio) e pela distância da câmera. Em 4× a taxa de avisos é limitada.
 */
let stepHandler: ((gain: number) => void) | null = null;
export function setCrewStepHandler(handler: ((gain: number) => void) | null): void {
  stepHandler = handler;
}
function reportSteps(m: CrewMember, dt: number): void {
  const w = m.walker;
  m.stepCooldown = Math.max(0, m.stepCooldown - dt);
  if (w.steps === m.lastSteps) return;
  const fresh = w.steps - m.lastSteps;
  m.lastSteps = w.steps;
  if (!stepHandler || fresh <= 0 || m.stepCooldown > 0 || !m.rig?.holder.visible) return;
  m.stepCooldown = 0.14;
  const near = Math.min(1, Math.max(0.12, 1 - camera.position.distanceTo(m.rig.holder.position) / 55));
  const speed = Math.min(1, w.speed / (2.2 * simRate));
  stepHandler(near * (0.35 + 0.65 * speed) * (1 - 0.3 * w.hopWeight));
}

/** Alguém trabalhando ou chegando à porta de serviço da estufa: a porta abre (e fecha quando ele sai). */
function crewAtGreenhouseDoor(): boolean {
  return crew.some((m) => {
    const d = Math.hypot(m.walker.x - GREENHOUSE_DOOR.x, m.walker.z - GREENHOUSE_DOOR.z);
    return d < 3.8 && (m.pose !== 'idle' || m.walker.speed > 0.2);
  });
}

/** Posição do rover no mundo (só para verificação em desenvolvimento). */
let lastRoverView: RoverView | null = null;
export function roverWorldState(): { x: number; z: number; heading: number; phase: string | null } {
  return { x: roverAt.x, z: roverAt.z, heading: roverAt.heading, phase: lastRoverView?.phase ?? null };
}

/** Estado da animação de cada astronauta (só para verificação em desenvolvimento). */
export function crewAnimationState(): {
  current: string;
  pose: string;
  x: number;
  z: number;
  heading: number;
  speed: number;
  lift: number;
  moving: boolean;
  remaining: number;
  hasWave: boolean;
  waveOpen: boolean;
  sceneSec: number;
  waveUntilSec: number;
}[] {
  const r2 = (v: number) => Math.round(v * 100) / 100;
  return crew.map((m) => ({
    current: m.rig ? m.rig.dominantClip(m.walker) : '',
    pose: m.pose,
    x: r2(m.walker.x),
    z: r2(m.walker.z),
    heading: r2(m.walker.heading),
    speed: r2(m.walker.speed),
    lift: Math.round(m.walker.lift * 1000) / 1000,
    moving: m.walker.moveWeight > 0.5,
    remaining: r2(remaining(m.walker)),
    hasWave: !!m.rig?.hasWave,
    waveOpen: lastSceneSec < crewWaveUntil,
    sceneSec: lastSceneSec,
    waveUntilSec: crewWaveUntil,
  }));
}

/** Aceno pedido pela interface (aviso da antena), em segundos de cena; consumido em updateScene. */
let crewWaveRequest = 0;
let crewWaveUntil = -Infinity;
let lastSceneSec = 0;

/** Pede à tripulação um aceno de `seconds` segundos (U-06). Só acena quem está parado e tem o clipe. */
export function requestCrewWave(seconds: number): void {
  crewWaveRequest = seconds;
}

/**
 * Tripulação (D-18): quem tem tarefa sai, trabalha e volta pela fase do motor; os outros ficam em casa
 * (o ajudante vai ao processador durante a missão de gelo). Radiação ou abrigo: todos vão ao abrigo.
 * Sequência visual: parado → preparo (vira para a saída) → deslocamento → frenagem → alinhamento → trabalho → volta.
 */
function updateCrew(state: GameState, t: number, dt: number, view: RoverView, radiation: boolean): void {
  const shelter = radiation || state.crewOrder === 'shelter';
  crew.forEach((m, i) => {
    const w = m.walker;
    let face: number | null = null;
    let pose: PoseClip = 'idle';
    let drive: Drive;
    const task = state.agents[i]?.task ?? null;
    if (shelter) {
      drive = { kind: 'goto', cruise: SHELTER_CRUISE };
      routeTo(m, SHELTER, drive);
    } else if (task) {
      const spot = workSpot(i, task.kind);
      if (task.phase === 'prep') {
        // Preparo: em casa, vira para a saída.
        drive = { kind: 'goto', cruise: HOME_CRUISE };
        routeTo(m, m.home, drive);
        face = headingTo(m.home, spot);
      } else if (task.phase === 'out') {
        drive = { kind: 'track', fraction: phaseFraction(task) };
        routeTo(m, spot, drive);
      } else if (task.phase === 'work') {
        // Termina a chegada (se atrasou) no ritmo da viagem, alinha com o equipamento e só então trabalha.
        drive = { kind: 'goto', cruise: LOPE_SPEED };
        routeTo(m, spot, drive);
        face = headingTo(spot, siteFocus(task.kind));
        if (arrived(w) && aligned(w, face)) pose = TASK_POSE[task.kind];
      } else {
        drive = { kind: 'track', fraction: phaseFraction(task) };
        routeTo(m, m.home, drive);
      }
    } else if (i === 1 && view.kind === 'ice' && view.working && (view.phase === 'return' || view.phase === 'deliver' || view.phase === 'operate')) {
      drive = { kind: 'goto', cruise: HELPER_CRUISE };
      routeTo(m, ICE_HELPER, drive);
      face = headingTo(ICE_HELPER, ICE_PROCESSOR);
      if (arrived(w) && aligned(w, face)) pose = 'work';
    } else {
      drive = { kind: 'goto', cruise: HOME_CRUISE };
      routeTo(m, m.home, drive);
      face = headingTo(m.home, robot.position);
    }
    stepWalker(w, dt, drive, simRate, face);
    stepGait(w, dt, simRate, m.rig?.walkGait ?? null, m.rig?.runGait ?? null);
    reportSteps(m, dt);
    if (pose === 'idle' && arrived(w) && ((t < crewWaveUntil && !shelter) || m.cineWave)) pose = 'wave';
    m.pose = pose;
    if (m.rig) {
      m.rig.update(w, pose, surfaceHeight(w.x, w.z), dt);
      // Dentro do habitat (abrigo) o astronauta não aparece.
      m.rig.holder.visible = Math.hypot(w.x - SHELTER.x, w.z - SHELTER.z) > 0.7;
    }
  });
}

/** Astronauta: tenta o modelo externo CC0 (ext/astronaut), o Earthset v2, o CC0 OGA e por fim o antigo sem esqueleto. */
export function loadCrewModels(): Promise<unknown> {
  // Monta o grafo de navegação agora, não no primeiro passo de uma tarefa.
  pathBetween(crew[0].home, PANEL_FIELD_WORK);
  return Promise.all(
    crew.map(async (m) => {
      const candidates: Array<{ name: string; scale: number; y: number; matte: boolean }> = [
        { name: 'ext/astronaut', scale: 1, y: 0, matte: false },
        { name: 'astronaut_v2', scale: 1.3, y: 0, matte: true },
        { name: 'astronaut_oga', scale: 1, y: 0.96, matte: false },
      ];
      let rig: CrewRig | null = null;
      for (const c of candidates) {
        try {
          rig = CrewRig.fromGltf(await loadGltf(c.name), c.scale, c.y, c.matte);
          break;
        } catch {
          // tenta o próximo
        }
      }
      if (!rig) rig = CrewRig.fromStatic(await loadModel('astronaut'));
      scene.add(rig.holder);
      m.rig = rig;
      rig.update(m.walker, 'idle', surfaceHeight(m.walker.x, m.walker.z), 0);
    }),
  );
}

/** Objeto do astronauta (para a câmera). */
export function crewObject(i = 0): THREE.Object3D | null {
  return crew[i]?.rig?.holder ?? null;
}

/** Faz um astronauta acenar (introdução e momentos da história), se o modelo tiver o clipe. */
export function crewWave(i: number, on: boolean): void {
  const m = crew[i];
  if (m) m.cineWave = on;
}

// ---------- Atualização por quadro ----------

let lastNow = 0;
const sunDir = new THREE.Vector3();
const dustOffset = new THREE.Vector3();
const AXIS_Y = new THREE.Vector3(0, 1, 0);

export function updateScene(state: GameState, now: number, lit: boolean, weather: SpaceWeatherSample, animate = true, longExposure = true): RoverView {
  // Sol na grade polar LOLA (0° = −z); convergência geográfica corrigida no pipeline.
  const { az, el } = sunPositionAt(SUN, state.clock.hour, state.installation.site);
  const dir = sunDir.fromArray(direction(az, el));
  sun.position.copy(dir).multiplyScalar(1200);
  sun.target.position.set(0, 0, 0);
  sun.intensity = lit ? 3.4 : 0;
  ambient.intensity = lit ? 0.3 : 0.18;
  rim.position.set(-dir.x * 100, 60, -dir.z * 100);
  updateSky(state.clock.hour, lit, state.installation.site, longExposure, renderer.getPixelRatio());
  const earthView = bodyAt(SKY, 'earth', state.clock.hour);

  const t = now / 1000;
  lastSceneSec = t;
  if (crewWaveRequest > 0) {
    crewWaveUntil = t + crewWaveRequest;
    crewWaveRequest = 0;
  }
  const dt = !animate || lastNow === 0 ? 0 : Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
  lastNow = now;
  // Ritmo do jogo (horas por segundo real) pelo próprio relógio: a locomoção acompanha 1×, 2× e 4× sem saber do HUD.
  if (dt > 0 && lastClockHour >= 0) {
    const dh = state.clock.hour - lastClockHour;
    // O motor avança em degraus (0,05 h): filtra a taxa bruta e só depois limita, para não enviesar a média.
    if (dh >= 0 && dh < 2) simRateRaw += (dh / dt - simRateRaw) * Math.min(1, dt / 0.6);
    simRate = Math.min(4, Math.max(0.5, simRateRaw));
  }
  lastClockHour = state.clock.hour;

  const view = placeRover(state, t, dt, weather.radiation);
  lastRoverView = view;
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
  // Faíscas: solda da antena na operação e ligação do painel à rede (fim da montagem e entrega).
  if (dt > 0 && view.working) {
    if (view.kind === 'antenna' && view.phase === 'operate' && Math.random() < 0.45) {
      emitSparks(antenna.position.x + (Math.random() - 0.5) * 0.9, antenna.position.y + 2.2 + Math.random() * 0.9, antenna.position.z + 0.2, 2);
    }
    if (view.kind === 'panel' && ((view.phase === 'operate' && view.k > 0.7) || view.phase === 'deliver') && Math.random() < 0.3) {
      const slot = PANEL_SLOTS[Math.min(state.installation.panels, PANEL_SLOTS.length - 1)];
      emitSparks(slot.x + (Math.random() - 0.5) * 0.4, surfaceHeight(slot.x, slot.z) + 0.15, slot.z + (Math.random() - 0.5) * 0.4, 2);
    }
  }
  updateSparks(dt);
  // Carga de regolito: enche durante a escavação, vai cheia na volta, esvazia na descarga do processador.
  const iceTask = view.working && view.kind === 'ice';
  const load = !iceTask ? 0 : view.phase === 'operate' ? view.k : view.phase === 'return' ? 1 : view.phase === 'deliver' ? Math.max(0, 1 - view.k * 2) : 0;
  cargoIce.visible = load > 0.02;
  cargoIce.scale.set(0.95, 0.55 * Math.max(0.05, load), 0.95);
  updateIceSite(drilling, view.phase === 'operate' ? view.k : 0, iceTask && view.phase === 'deliver' ? view.k : -1, t);
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
  const batteryPct = (state.vitals.battery / state.installation.batteryCapacity) * 100;
  updateBase({
    t,
    panels: state.installation.panels,
    // Montagem na operação; montado e desligado na volta e na entrega (DT-11); ligado só quando o motor conclui.
    building:
      view.working && view.kind === 'panel' && (view.phase === 'operate' || view.phase === 'return' || view.phase === 'deliver')
        ? { slot: state.installation.panels, k: view.phase === 'operate' ? view.k : 1, connected: false }
        : null,
    batteryPct,
    anyCritical: batteryPct < 20 || state.vitals.air < 30 || state.vitals.water < 20 || state.vitals.food < 20,
    greenhouseOn: state.crewOrder === 'auto' && isGreenhouseOn(state.vitals, state.installation),
    greenhouseVisible: state.installation.greenhouse !== 'off',
    greenhouseWear: state.crop.wear,
    greenhouseReady: state.crop.growth >= 100,
    harvests: state.crop.harvests,
    greenhouseLighting: state.crop.lighting,
    greenhouseDoorOpen: crewAtGreenhouseDoor(),
    antennaOnline: state.robot.antennaInstalled,
    antennaRepairing: view.working && view.kind === 'antenna' && (view.phase === 'operate' || view.phase === 'deliver'),
    antennaFixed: view.working && view.kind === 'antenna' && ((view.phase === 'operate' && view.k > 0.85) || view.phase === 'return' || view.phase === 'deliver'),
    antennaTune: Math.min(1, state.antennaTuneLeft / TUNE_HOURS),
    waterLevel: state.vitals.water,
    airLevel: state.vitals.air,
    processing: view.working && view.kind === 'ice' && view.phase === 'deliver',
    iceActive: state.robot.queue.some((q) => q.kind === 'ice'),
    panelGlow: 0.6 * calibrationFactor(state.calibrationLeft) * (lit ? 1 : 0.25),
    earthAz: earthView.az,
    earthEl: earthView.el,
  });
  return view;
}

/** Recomeça posições e fases das animações (nova missão). */
export function resetScenePresentation(): void {
  lastNow = 0;
  setRover(DOCK.x, DOCK.z, Math.PI / 2);
  lastClockHour = -1;
  simRate = simRateRaw = 1;
  resetIceSite();
  sparkLife.fill(0);
  for (let i = 0; i < SPARK_MAX; i++) sparkPos[3 * i + 1] = -999;
  for (const m of crew) {
    Object.assign(m.walker, createWalker(m.home.x, m.home.z, Math.PI / 2));
    m.destKey = '';
    m.driveKind = '';
    m.pose = 'idle';
    m.lastSteps = 0;
    m.stepCooldown = 0;
    m.rig?.update(m.walker, 'idle', surfaceHeight(m.walker.x, m.walker.z), 0);
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
