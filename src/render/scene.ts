// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Cena three.js: relevo, céu, base, robô e luz. Só desenha o estado recebido; regra fica no motor.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import type { GameState } from '../engine/game';
import { isGreenhouseOn } from '../engine/resources';
import { solarFactor, stormLevel, type SpaceWeatherSample } from '../engine/space-weather';
import { MAX_PANELS, TASK_HOURS, isWorking, type TaskKind } from '../engine/robot';
import { sampleAt } from '../engine/sun';
import { SUN } from '../data/sun';
import { TERRAIN_MESH } from '../data/terrain-mesh';
import { attachModel, loadGltf, loadModel } from './assets';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';

/** Paleta da cena. O azul de destaque é o mesmo --accent do HUD (index.html). */
export const PALETTE = {
  space: 0x03050a,
  crater: 0x3e4049,
  habitat: 0xdfe4ec,
  habitatAccent: 0x7fd1ff,
  hatch: 0x2a2c33,
  greenhouse: 0x9fe8b0,
  greenhouseRib: 0xdfe4ec,
  panel: 0x3f7fd0,
  panelGlow: 0x0c2446,
  metal: 0xdfe4ec,
  iceMarker: 0x9fe7ff,
  beacon: 0x7fd7ff,
  robot: 0xffc857,
  track: 0x2a2c33,
  sunlight: 0xfff1d6,
  skyFill: 0x8fa6c8,
  groundFill: 0x1a1c24,
} as const;

// ---------- Cena ----------

export const renderer = new THREE.WebGLRenderer({ antialias: true });
// Limite de densidade de pixels: 2x custa 4x de preenchimento na GPU.
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
// Sombras nítidas: PCF simples (o modo "soft" foi removido na versão atual do three.js).
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.insertBefore(renderer.domElement, document.body.firstChild);

export const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.space);
scene.fog = new THREE.Fog(PALETTE.space, 60, 220);

export const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 600);
// Enquadramento padrão: olha um pouco à esquerda, para a base aparecer à direita do painel de HUD.
const DEFAULT_CAMERA_POSITION = new THREE.Vector3(2, 17, 30);
const DEFAULT_TARGET = new THREE.Vector3(-8, 1, 0);
camera.position.copy(DEFAULT_CAMERA_POSITION);

// Câmera orbital em torno da base: arrastar gira, roda ou pinça aproxima, limites de distância e inclinação.
export const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(DEFAULT_TARGET);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
controls.enablePan = false;
controls.minDistance = 10;
controls.maxDistance = 70;
controls.minPolarAngle = THREE.MathUtils.degToRad(20);
controls.maxPolarAngle = THREE.MathUtils.degToRad(82);
controls.update();

// Plano de abertura (briefing): travelling lento de uma visão ampla até a base; a órbita fica desligada nesse trecho.
const INTRO_FROM = new THREE.Vector3(26, 34, 64);
const INTRO_SECONDS = 7;
let introPending = false;
let introStart = -1;

/** Pede o plano de abertura; ele começa no próximo quadro, no relógio visual da cena. */
export function startIntro(): void {
  introPending = true;
  introStart = -1;
  controls.enabled = false;
  camera.position.copy(INTRO_FROM);
  controls.target.copy(DEFAULT_TARGET);
}

function updateIntro(nowMs: number): void {
  if (introPending) {
    introPending = false;
    introStart = nowMs;
  }
  if (introStart < 0) return;
  const k = Math.min(1, (nowMs - introStart) / 1000 / INTRO_SECONDS);
  const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; // ease-in-out cúbico
  camera.position.lerpVectors(INTRO_FROM, DEFAULT_CAMERA_POSITION, e);
  if (k >= 1) {
    introStart = -1;
    controls.enabled = true;
  }
}

/** Volta à visão padrão da base (botão "Visão da base"). */
export function resetView(): void {
  camera.position.copy(DEFAULT_CAMERA_POSITION);
  controls.target.copy(DEFAULT_TARGET);
  controls.update();
}

// Em tela estreita o HUD ocupa a parte de baixo: a cena sobe para a base ficar visível acima dele.
export function frameForViewport(): void {
  if (window.innerWidth <= 700) {
    // Campo mais aberto compensa a tela estreita; o deslocamento reserva espaço para o HUD inferior.
    camera.fov = 68;
    camera.updateProjectionMatrix();
    const shift = window.innerHeight * 0.2;
    const horizontalShift = window.innerWidth * 0.36;
    camera.setViewOffset(window.innerWidth, window.innerHeight, horizontalShift, shift, window.innerWidth, window.innerHeight);
  } else {
    camera.fov = 50;
    camera.updateProjectionMatrix();
    camera.clearViewOffset();
  }
}
frameForViewport();

// Textura de regolito ilustrativa: grão aleatório gerado em canvas, repetido sobre o chão.
function regolithTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#a3a6b0';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const shade = Math.random() < 0.5 ? 0 : 255;
      ctx.fillStyle = `rgba(${shade},${shade},${shade},${(Math.random() * 0.18).toFixed(3)})`;
      ctx.fillRect(Math.random() * 256, Math.random() * 256, 1 + Math.random() * 2, 1 + Math.random() * 2);
    }
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(40, 40);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
/**
 * Material do chão: superfície lunar real (Poly Haven "Moon Dusted 01", CC0, sem pegadas; ver public/textures/moon/LICENSE.txt).
 * Começa com a textura procedural e troca pelas imagens quando carregam; se falhar, fica a procedural.
 */
function moonGroundMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, map: regolithTexture(), roughness: 1, metalness: 0 });
  const loader = new THREE.TextureLoader();
  const base = `${import.meta.env.BASE_URL}textures/moon/`;
  const tile = (t: THREE.Texture): THREE.Texture => {
    t.wrapS = THREE.RepeatWrapping;
    t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(40, 40);
    return t;
  };
  loader.load(`${base}dusted_diff.jpg`, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    mat.map = tile(t);
    mat.needsUpdate = true;
  });
  loader.load(`${base}dusted_nor.jpg`, (t) => {
    mat.normalMap = tile(t);
    mat.needsUpdate = true;
  });
  loader.load(`${base}dusted_rough.jpg`, (t) => {
    mat.roughnessMap = tile(t);
    mat.needsUpdate = true;
  });
  return mat;
}

// Relevo real: malha do LOLA (400 m centrados no morro). Norte = -z, como no céu e no Sol.
const VERTICAL_EXAGGERATION = 2; // exagero vertical; a HUD diz isso
function buildTerrain(): THREE.BufferGeometry {
  const { n, size_m, heights_m } = TERRAIN_MESH;
  const step = size_m / (n - 1);
  const half = size_m / 2;
  const positions = new Float32Array(n * n * 3);
  const uvs = new Float32Array(n * n * 2);
  for (let j = 0; j < n; j++) {
    for (let i = 0; i < n; i++) {
      const k = j * n + i;
      positions[3 * k] = -half + i * step;
      positions[3 * k + 1] = heights_m[k] * VERTICAL_EXAGGERATION;
      positions[3 * k + 2] = half - j * step;
      uvs[2 * k] = i / (n - 1);
      uvs[2 * k + 1] = j / (n - 1);
    }
  }
  const index: number[] = [];
  for (let j = 0; j < n - 1; j++) {
    for (let i = 0; i < n - 1; i++) {
      const a = j * n + i;
      const b = a + 1;
      const c = a + n;
      const d = c + 1;
      index.push(a, b, c, b, d, c); // faces viradas para cima
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geo.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
  // Variação de cor decorativa: terreno mais alto um pouco mais claro, com ruído fixo (sem alterar a geometria medida).
  const colors = new Float32Array(n * n * 3);
  let minH = Infinity;
  let maxH = -Infinity;
  for (const h of heights_m) {
    minH = Math.min(minH, h);
    maxH = Math.max(maxH, h);
  }
  for (let k = 0; k < n * n; k++) {
    const t = (heights_m[k] - minH) / Math.max(1e-6, maxH - minH);
    const grain = 0.92 + 0.08 * Math.sin(k * 12.9898) * Math.cos(k * 0.37);
    const shade = (0.86 + 0.14 * t) * grain;
    colors[3 * k] = shade;
    colors[3 * k + 1] = shade * 0.99;
    colors[3 * k + 2] = shade * 0.97;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}
const ground = new THREE.Mesh(
  buildTerrain(),
  moonGroundMaterial(),
);
ground.receiveShadow = true;
scene.add(ground);


// Sol: luz direcional com sombras.
const sun = new THREE.DirectionalLight(PALETTE.sunlight, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
// Viés calibrado: some com o serrilhado (acne) sem descolar a sombra dos pés dos objetos.
sun.shadow.bias = -0.0004;
sun.shadow.normalBias = 0.03;
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
scene.add(sun);
scene.add(sun.target);
const ambient = new THREE.HemisphereLight(PALETTE.skyFill, PALETTE.groundFill, 0.35);

// Disco do Sol no céu: na direção calculada pela tabela do JPL Horizons, só quando a luz chega à base
// (mesma regra de `lit`, que já considera o horizonte medido no LOLA). Sem névoa e sem tone mapping.
const SKY_SUN_DISTANCE = 320;
const sunDisk = new THREE.Mesh(
  new THREE.SphereGeometry(4.5, 32, 16),
  new THREE.MeshBasicMaterial({ color: PALETTE.sunlight, fog: false, toneMapped: false }),
);
const sunGlow = new THREE.Mesh(
  new THREE.SphereGeometry(14, 32, 16),
  new THREE.MeshBasicMaterial({ color: 0xffd28a, transparent: true, opacity: 0.22, depthWrite: false, fog: false, toneMapped: false }),
);
sunDisk.visible = false;
sunGlow.visible = false;
scene.add(sunDisk, sunGlow);
scene.add(ambient);

// Céu: estrelas e a Terra, ao fundo.
const starsGeo = new THREE.BufferGeometry();
const starPositions: number[] = [];
for (let i = 0; i < 1400; i++) {
  const theta = Math.random() * Math.PI * 2;
  const phi = Math.acos(2 * Math.random() - 1);
  const r = 280;
  starPositions.push(r * Math.sin(phi) * Math.cos(theta), Math.abs(r * Math.cos(phi)), r * Math.sin(phi) * Math.sin(theta));
}
starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
// Estrelas e Terra ficam fora da névoa: a névoa escondia tudo além de 220 unidades.
scene.add(new THREE.Points(starsGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 1.2, sizeAttenuation: false, fog: false })));

/**
 * Material da Terra: textura da NASA (Blue Marble, domínio público; ver public/textures/earth/LICENSE.txt).
 * Começa azul liso e troca pela textura quando carrega. Sem atmosfera: a Lua não tem.
 */
function earthMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({ color: 0x2f6fb0, roughness: 0.8, fog: false });
  new THREE.TextureLoader().load(`${import.meta.env.BASE_URL}textures/earth/earth_land_shallow_topo_2048.jpg`, (t) => {
    t.colorSpace = THREE.SRGBColorSpace;
    mat.map = t;
    mat.color.set(0xffffff);
    mat.needsUpdate = true;
  });
  return mat;
}

const earth = new THREE.Mesh(
  new THREE.SphereGeometry(7, 48, 32),
  earthMaterial(),
);
earth.position.set(-70, 60, -150);
scene.add(earth);

// Base: habitat, painéis (um por unidade instalada), estufa e robô.
const base = new THREE.Group();
scene.add(base);

const habitat = new THREE.Group();
habitat.position.set(0, 2.2, 0);
const habitatMat = new THREE.MeshStandardMaterial({ color: PALETTE.habitat, roughness: 0.5, metalness: 0.2 });
const hull = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.2, 6, 24), habitatMat);
hull.rotation.z = Math.PI / 2;
hull.castShadow = true;
habitat.add(hull);
// Tampas e faixa de cor: o módulo lê como estrutura pressurizada.
const accentMat = new THREE.MeshStandardMaterial({ color: PALETTE.habitatAccent, roughness: 0.4 });
for (const x of [-3.02, 3.02]) {
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(2.25, 2.25, 0.06, 24), accentMat);
  cap.rotation.z = Math.PI / 2;
  cap.position.x = x;
  habitat.add(cap);
}
const band = new THREE.Mesh(new THREE.CylinderGeometry(2.23, 2.23, 0.3, 24), accentMat);
band.rotation.z = Math.PI / 2;
habitat.add(band);
// Escotilha de entrada na frente do módulo.
const hatch = new THREE.Mesh(
  new THREE.BoxGeometry(1.2, 1.6, 0.3),
  new THREE.MeshStandardMaterial({ color: PALETTE.hatch, roughness: 0.6 }),
);
hatch.position.set(0, -0.6, 2.25);
habitat.add(hatch);
base.add(habitat);

const greenhouse = new THREE.Group();
greenhouse.position.set(-5.5, 0, 3);
const dome = new THREE.Mesh(
  new THREE.SphereGeometry(2.4, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: PALETTE.greenhouse, transparent: true, opacity: 0.35, roughness: 0.1 }),
);
dome.castShadow = true;
greenhouse.add(dome);
// Nervuras: arcos de metal sobre a cúpula, para ela ler como estufa e não como bolha.
const ribMat = new THREE.MeshStandardMaterial({ color: PALETTE.greenhouseRib, metalness: 0.4, roughness: 0.4 });
for (let i = 0; i < 3; i++) {
  const rib = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.05, 6, 32, Math.PI), ribMat);
  rib.rotation.y = (i * Math.PI) / 3;
  greenhouse.add(rib);
}
base.add(greenhouse);

// Antena de comunicação no teto do habitat: aparece quando o robô instala a antena (B1.4).
const baseAntenna = new THREE.Group();
const antennaMast = new THREE.Mesh(
  new THREE.CylinderGeometry(0.06, 0.06, 1.8, 8),
  new THREE.MeshStandardMaterial({ color: 0xdfe4ec, metalness: 0.4, roughness: 0.4 }),
);
antennaMast.position.y = 0.9;
baseAntenna.add(antennaMast);
const dish = new THREE.Mesh(
  new THREE.SphereGeometry(0.7, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2),
  new THREE.MeshStandardMaterial({ color: 0xe8ecf2, metalness: 0.3, roughness: 0.35, side: THREE.DoubleSide }),
);
dish.rotation.x = Math.PI;
dish.position.y = 1.8;
baseAntenna.add(dish);
baseAntenna.position.set(1.2, 4.4, 0);
baseAntenna.visible = false;
base.add(baseAntenna);

const panelMat = new THREE.MeshStandardMaterial({ color: PALETTE.panel, roughness: 0.25, metalness: 0.5, emissive: PALETTE.panelGlow, emissiveIntensity: 0.6 });
const panelCellMats: THREE.MeshStandardMaterial[] = [];
const postMat = new THREE.MeshStandardMaterial({ color: PALETTE.metal, metalness: 0.4, roughness: 0.4 });
const panelMeshes: THREE.Group[] = [];
for (let i = 0; i < MAX_PANELS; i++) {
  const col = i % 6;
  const row = Math.floor(i / 6);
  // Cada unidade é um suporte com o painel inclinado, presa ao chão.
  const unit = new THREE.Group();
  unit.position.set(-3 + col * 2 + 2, 0, 5 + row * 2.4);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 1.2, 8), postMat);
  post.position.y = 0.6;
  post.castShadow = true;
  unit.add(post);
  const panel = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.08, 1.1), panelMat);
  panel.position.y = 1.2;
  panel.rotation.x = -0.45;
  panel.castShadow = true;
  panel.receiveShadow = true;
  unit.add(panel);
  unit.visible = false;
  base.add(unit);
  panelMeshes.push(unit);
}

// Robô de coleta: corpo, duas esteiras, antena com luz de status. Modelo ilustrativo.
const robot = new THREE.Group();
const robotBodyMat = new THREE.MeshStandardMaterial({ color: PALETTE.robot, emissive: 0x402800, roughness: 0.4 });
const robotBody = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.4, 0.8), robotBodyMat);
robotBody.position.y = 0.35;
robotBody.castShadow = true;
robot.add(robotBody);
const trackMat = new THREE.MeshStandardMaterial({ color: PALETTE.track, roughness: 0.9 });
for (const z of [-0.5, 0.5]) {
  const track = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.22, 0.18), trackMat);
  track.position.set(0, 0.11, z);
  track.castShadow = true;
  robot.add(track);
}
const mast = new THREE.Mesh(
  new THREE.CylinderGeometry(0.03, 0.03, 0.5, 8),
  new THREE.MeshStandardMaterial({ color: 0xdfe4ec, metalness: 0.4, roughness: 0.4 }),
);
mast.position.set(0.3, 0.8, 0);
robot.add(mast);
const beaconMat = new THREE.MeshStandardMaterial({ color: PALETTE.beacon, emissive: PALETTE.beacon, emissiveIntensity: 1.5 });
const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 8), beaconMat);
beacon.position.set(0.3, 1.1, 0);
robot.add(beacon);
// Escala maior que o modelo original: o robô precisa ser legível na tela de 1280 px.
robot.scale.setScalar(1.7);
scene.add(robot);

// ---------- Atualização por quadro ----------

// ---------- Robô: movimento ligado à fila do motor ----------

/** Base: onde o rover fica parado. Lado norte da base (−z), longe dos painéis. */
const DOCK: { x: number; z: number } = { x: 8, z: -5 };
/** Local de cada tarefa, dentro do recorte de 400 m do LOLA e perto da base para caber na visão padrão. Ilustrativo: o gelo ainda não está medido no recorte. */
const SITE: Record<TaskKind, { x: number; z: number }> = {
  ice: { x: -18, z: -16 },
  panel: { x: 5, z: 12 },
  antenna: { x: 1.2, z: -3 },
};

/** Altura do relevo (metros, já com exagero) no ponto (x, z) da cena, por interpolação na malha do LOLA. */
function surfaceHeight(x: number, z: number): number {
  const { n, size_m, heights_m } = TERRAIN_MESH;
  const step = size_m / (n - 1);
  const half = size_m / 2;
  const fi = Math.min(n - 1.001, Math.max(0, (x + half) / step));
  const fj = Math.min(n - 1.001, Math.max(0, (half - z) / step));
  const i = Math.floor(fi);
  const j = Math.floor(fj);
  const di = fi - i;
  const dj = fj - j;
  const h = (a: number, b: number) => heights_m[b * n + a];
  const top = h(i, j) * (1 - di) + h(i + 1, j) * di;
  const bottom = h(i, j + 1) * (1 - di) + h(i + 1, j + 1) * di;
  return (top * (1 - dj) + bottom * dj) * VERTICAL_EXAGGERATION;
}

/** Posição atual do rover (acompanha a posição de destino; anda devagar ao voltar de uma tarefa cancelada). */
const roverAt = { x: DOCK.x, z: DOCK.z };
const ROVER_WALK_SPEED = 4; // m/s, só para voltar à base depois de cancelar
let lastNow = 0;

/**
 * Posiciona o rover pela tarefa da frente da fila. Progresso p = 1 − horas restantes / horas da tarefa:
 * sai da base (0 a 35%), trabalha no local (35 a 65%), volta (65 a 100%). O motor não modela viagem;
 * o tempo de viagem é a parte visual do tempo de tarefa.
 * Sem tarefa em andamento (ou depois de cancelar), o rover caminha de volta à base.
 */
function placeRover(state: GameState, t: number, dt: number, radiation: boolean): { working: boolean; moving: boolean; workSite: { x: number; z: number } | null } {
  const task = state.robot.queue[0];
  const working = isWorking(state.robot, state.vitals.battery) && !radiation;
  // Uma tarefa suspensa mantém o rover onde estava; a fila não avança no motor.
  if (task && !working) {
    robot.position.set(roverAt.x, surfaceHeight(roverAt.x, roverAt.z), roverAt.z);
    return { working: false, moving: false, workSite: null };
  }
  if (!task) {
    const dx = DOCK.x - roverAt.x;
    const dz = DOCK.z - roverAt.z;
    const dist = Math.hypot(dx, dz);
    const step = Math.min(dist, ROVER_WALK_SPEED * dt);
    if (dist > 1e-3) {
      roverAt.x += (dx / dist) * step;
      roverAt.z += (dz / dist) * step;
      robot.rotation.y = Math.atan2(-dz, dx);
    }
    robot.position.set(roverAt.x, surfaceHeight(roverAt.x, roverAt.z), roverAt.z);
    return { working: false, moving: step > 0, workSite: null };
  }
  const p = Math.min(1, Math.max(0, 1 - task.hoursLeft / TASK_HOURS[task.kind]));
  const site = SITE[task.kind];
  const OUT = 0.35;
  const BACK = 0.65;
  let from = DOCK;
  let to = site;
  let k = 0;
  let moving = true;
  let workSite: { x: number; z: number } | null = null;
  if (p < OUT) {
    k = p / OUT;
  } else if (p < BACK) {
    from = site;
    to = site;
    moving = false;
    workSite = site;
  } else {
    from = site;
    to = DOCK;
    k = (p - BACK) / (1 - BACK);
  }
  roverAt.x = from.x + (to.x - from.x) * k;
  roverAt.z = from.z + (to.z - from.z) * k;
  robot.position.set(roverAt.x, surfaceHeight(roverAt.x, roverAt.z) + (moving ? 0.02 * Math.sin(t * 8) : 0), roverAt.z);
  if (moving) {
    // Rumo: +x é a frente do modelo. Aponta para o destino do trecho.
    robot.rotation.y = Math.atan2(-(to.z - from.z), to.x - from.x);
  }
  return { working: true, moving, workSite };
}

// ---------- Tripulação: dois astronautas que reagem ao estado do motor ----------

interface Crew {
  /** Mixer e clipes do modelo com animação (astronaut_oga). Null se o modelo de fallback estiver em uso. */
  mixer: THREE.AnimationMixer | null;
  actions: Partial<Record<'idle' | 'walk' | 'run' | 'work', THREE.AnimationAction>>;
  current: 'idle' | 'walk' | 'run' | 'work' | '';
  node: THREE.Object3D | null;
  x: number;
  z: number;
  home: { x: number; z: number };
  moving: boolean;
  legs: THREE.Object3D[];
  arms: THREE.Object3D[];
}

const crew: Crew[] = [
  { mixer: null, actions: {}, current: '', node: null, x: -3.0, z: 5.2, home: { x: -3.0, z: 5.2 }, moving: false, legs: [], arms: [] },
  { mixer: null, actions: {}, current: '', node: null, x: 2.6, z: 4.6, home: { x: 2.6, z: 4.6 }, moving: false, legs: [], arms: [] },
];
const CREW_WALK_SPEED = 1.3; // m/s
/** Abrigo: em frente à escotilha do habitat (lado +z, onde fica a porta). */
const SHELTER = { x: 0, z: 3.6 } as const;

/** Anda até (tx, tz) e devolve se ainda está andando. */
function walkCrew(member: Crew, tx: number, tz: number, dt: number): void {
  const dx = tx - member.x;
  const dz = tz - member.z;
  const dist = Math.hypot(dx, dz);
  member.moving = dist > 0.05;
  if (member.moving) {
    const step = Math.min(dist, CREW_WALK_SPEED * dt);
    member.x += (dx / dist) * step;
    member.z += (dz / dist) * step;
  }
  if (member.node) {
    member.node.position.set(member.x, surfaceHeight(member.x, member.z), member.z);
    if (dist > 0.05) member.node.rotation.y = Math.atan2(dx, dz); // a frente do astronauta é +Z
  }
}

/** Troca o clipe do astronauta com transição curta (idle quando parado, run quando anda). */
function playCrewClip(member: Crew, name: 'idle' | 'walk' | 'run' | 'work'): void {
  if (!member.mixer || member.current === name) return;
  const next = member.actions[name];
  if (!next) return;
  next.reset().fadeIn(0.2).play();
  if (member.current) member.actions[member.current]?.fadeOut(0.2);
  member.current = name;
}

function animateCrew(member: Crew, t: number, dt: number): void {
  if (member.mixer) {
    playCrewClip(member, member.moving ? (member.actions.walk ? 'walk' : 'run') : 'idle');
    // O modelo antigo não tem clipe de caminhada; reduzimos a corrida como fallback.
    const run = member.actions.run;
    if (run) run.timeScale = member.moving && !member.actions.walk ? 0.45 : 1;
    member.mixer.update(dt);
    return;
  }
  const swing = member.moving ? Math.sin(t * 7) * 0.55 : 0;
  member.legs.forEach((leg, i) => (leg.rotation.x = i === 0 ? swing : -swing));
  member.arms.forEach((arm, i) => (arm.rotation.x = i === 0 ? -swing : swing));
}

/** Astronautas: o da estufa cuida dela quando ela está ligada; o outro ajuda o rover no local da tarefa. */
function updateCrew(state: GameState, t: number, dt: number, workSite: { x: number; z: number } | null, radiation: boolean): void {
  const greenhouseRunning = isGreenhouseOn(state.vitals, state.installation);
  const [keeper, helper] = crew;
  if (radiation) {
    // Radiação: a tripulação corre para a escotilha (D-05).
    walkCrew(keeper, SHELTER.x, SHELTER.z, dt);
    walkCrew(helper, SHELTER.x + 0.9, SHELTER.z, dt);
  } else if (greenhouseRunning) {
    const phase = Math.floor(t / 4) % 2 === 0;
    // Caminho fora da cúpula (centro em -5.5, 3; raio 2.4): os dois pontos ficam a mais de 3 m do centro.
    walkCrew(keeper, phase ? -3.0 : -4.0, phase ? 5.2 : 6.6, dt);
  } else {
    walkCrew(keeper, keeper.home.x, keeper.home.z, dt);
  }
  if (!radiation) {
    if (workSite) {
      walkCrew(helper, workSite.x + 1.1, workSite.z + 0.4, dt);
    } else {
      walkCrew(helper, helper.home.x, helper.home.z, dt);
    }
  }
  for (const member of crew) animateCrew(member, t, dt);
}

/**
 * Carrega o astronauta Earthset (clipes idle, walk e run). Se falhar, usa o modelo CC0 OGA e depois o fallback
 * fallback astronaut.glb com as animações procedurais antigas. Uma cópia por astronauta.
 */
export function loadCrewModels(): Promise<unknown> {
  return Promise.all(
    crew.map(async (member) => {
      try {
        const gltf = await loadGltf('astronaut_v2');
        // Clone com esqueleto próprio: Object3D.clone() não copia os ossos de um modelo skinado.
        const node = cloneSkinned(gltf.scene);
        node.traverse((obj) => {
          obj.castShadow = true;
          if (obj instanceof THREE.Mesh) {
            // Mantém o traje fosco e legível sob a iluminação lunar.
            const mat = (obj.material as THREE.MeshStandardMaterial).clone();
            mat.metalness = 0.05;
            mat.roughness = 0.7;
            obj.material = mat;
          }
        });
        // A origem do modelo Earthset fica no chão, entre os pés.
        node.position.y = 0;
        node.scale.setScalar(1.3);
        const holder = new THREE.Group();
        holder.add(node);
        scene.add(holder);
        member.node = holder;
        const mixer = new THREE.AnimationMixer(node);
        const byName: Record<string, 'idle' | 'walk' | 'run' | 'work'> = { idle: 'idle', walk: 'walk', run: 'run', work: 'work', default: 'idle' };
        for (const clip of gltf.animations) {
          const key = byName[clip.name];
          if (key) member.actions[key] = mixer.clipAction(clip);
        }
        member.mixer = mixer;
        playCrewClip(member, 'idle');
      } catch (error) {
        console.warn('astronaut_v2 não carregou; tentando astronauta CC0:', error);
        try {
          const gltf = await loadGltf('astronaut_oga');
          const node = cloneSkinned(gltf.scene);
          node.position.y = 0.96;
          const holder = new THREE.Group();
          holder.add(node);
          scene.add(holder);
          member.node = holder;
          const mixer = new THREE.AnimationMixer(node);
          for (const clip of gltf.animations) {
            const key = clip.name === 'run' ? 'run' : 'idle';
            member.actions[key] = mixer.clipAction(clip);
          }
          member.mixer = mixer;
          playCrewClip(member, 'idle');
          return;
        } catch (ogaError) {
          console.warn('astronauta CC0 não carregou; usando o fallback:', ogaError);
        }
        const source = await loadModel('astronaut');
        const node = source.clone(true);
        node.traverse((obj) => {
          obj.castShadow = true;
        });
        scene.add(node);
        member.node = node;
        member.legs = ['leg_L', 'leg_R'].map((name) => node.getObjectByName(name)).filter((o): o is THREE.Object3D => o !== undefined);
        member.arms = ['arm_L', 'arm_R'].map((name) => node.getObjectByName(name)).filter((o): o is THREE.Object3D => o !== undefined);
      }
    }),
  );
}

/** Deslocamento em relação ao rover parado no local: o marcador fica ao lado, não sobre o modelo. */
const ICE_MARKER_OFFSET = { x: 3.0, z: -3.0 };
/** Marcador do gelo no local da tarefa de gelo (item de missão). Visível enquanto há tarefa de gelo na fila. */
const iceMarker = new THREE.Mesh(
  new THREE.IcosahedronGeometry(1.1, 0),
  new THREE.MeshStandardMaterial({ color: PALETTE.iceMarker, emissive: PALETTE.iceMarker, emissiveIntensity: 1.0, transparent: true, opacity: 0.9, roughness: 0.2 }),
);
iceMarker.visible = false;
scene.add(iceMarker);

/** Transição de instalação (T5): a peça cresce de 0 a 100% em ~0,8 s quando aparece; some de repente. */
const INSTALL_SECONDS = 0.8;
function setInstalled(obj: THREE.Object3D, installed: boolean, now: number): void {
  if (installed && !obj.visible) {
    obj.visible = true;
    obj.userData.installedAt = now / 1000;
  }
  if (!installed) {
    obj.visible = false;
    return;
  }
  const age = now / 1000 - (obj.userData.installedAt as number);
  const k = Math.min(1, Math.max(0, age / INSTALL_SECONDS));
  const ease = 1 - Math.pow(1 - k, 3); // desaceleração suave
  obj.scale.setScalar(Math.max(0.001, ease));
}

export function updateScene(state: GameState, now: number, lit: boolean, weather: SpaceWeatherSample, animate = true): void {
  updateIntro(now);
  // Direção do Sol a partir do azimute (norte = -z, leste = +x) e da elevação reais.
  const { az, el } = sampleAt(SUN, state.clock.hour);
  const azRad = (az * Math.PI) / 180;
  const elRad = (el * Math.PI) / 180;
  sun.position.set(
    Math.sin(azRad) * Math.cos(elRad) * 40,
    Math.sin(elRad) * 40,
    -Math.cos(azRad) * Math.cos(elRad) * 40,
  );
  if (lit) {
    sun.intensity = 3.2;
    ambient.intensity = 0.6; // contraste: sombra dura sobre luz de preenchimento fria
  } else {
    // Sol acima do horizonte plano, mas tapado pelo relevo: só a luz de fundo.
    sun.intensity = 0;
    ambient.intensity = 0.4;
  }
  sun.target.position.set(0, 0, 0);
  // Disco do Sol na mesma direção da luz; visível só quando a luz chega à base.
  const sunDir = sun.position.clone().normalize().multiplyScalar(SKY_SUN_DISTANCE);
  sunDisk.position.copy(sunDir);
  sunGlow.position.copy(sunDir);
  sunDisk.visible = lit;
  sunGlow.visible = lit;

  for (let i = 0; i < panelMeshes.length; i++) {
    setInstalled(panelMeshes[i], i < state.installation.panels, now);
  }
  greenhouse.visible = state.installation.greenhouse !== 'off';

  setInstalled(baseAntenna, state.robot.antennaInstalled, now);

  const t = now / 1000;
  const dt = !animate || lastNow === 0 ? 0 : Math.min(0.1, Math.max(0, (now - lastNow) / 1000));
  lastNow = now;
  const { working, moving, workSite } = placeRover(state, t, dt, weather.radiation);
  updateCrew(state, t, dt, workSite, weather.radiation);
  robotBodyMat.emissiveIntensity = working ? 1 : 0.2;
  if (rover.bodyMat) rover.bodyMat.emissiveIntensity = working ? 0.45 : 0.08;
  // Tempestade: os painéis perdem brilho na proporção da geração (ver solarFactor).
  const panelGlow = 0.6 * solarFactor(stormLevel(weather.kp));
  panelMat.emissiveIntensity = panelGlow;
  for (const mat of panelCellMats) mat.emissiveIntensity = panelGlow;
  // Radiação de partículas solares: o farol do robô fica vermelho enquanto dura.
  rover.beaconMat.color.setHex(weather.radiation ? 0xff5a5a : PALETTE.beacon);
  rover.beaconMat.emissive.setHex(weather.radiation ? 0xff5a5a : PALETTE.beacon);
  rover.beacon.visible = !working || Math.sin(t * 4) > -0.2;
  // Rodas giram só enquanto o robô se desloca (sair, voltar), não quando trabalha no local.
  if (moving) for (const wheel of rover.wheels) wheel.rotation.z = -t * 6;
  // Marcador do gelo: aparece enquanto há tarefa de gelo na fila (item de missão).
  iceMarker.visible = state.robot.queue.some((task) => task.kind === 'ice');
  const iceMarkerX = SITE.ice.x + ICE_MARKER_OFFSET.x;
  const iceMarkerZ = SITE.ice.z + ICE_MARKER_OFFSET.z;
  iceMarker.position.set(iceMarkerX, surfaceHeight(iceMarkerX, iceMarkerZ) + 2.5 + Math.sin(t * 2) * 0.15, iceMarkerZ);
  iceMarker.rotation.y = t * 0.6;
}

/** Recomeça as posições e a fase das animações após reiniciar a missão. */
export function resetScenePresentation(initialPanels: number): void {
  lastNow = 0;
  panelMeshes.forEach((unit, index) => {
    unit.visible = index < initialPanels;
    unit.scale.setScalar(1);
    unit.userData.installedAt = -INSTALL_SECONDS;
  });
  baseAntenna.visible = false;
  baseAntenna.scale.setScalar(1);
  roverAt.x = DOCK.x;
  roverAt.z = DOCK.z;
  robot.position.set(DOCK.x, surfaceHeight(DOCK.x, DOCK.z), DOCK.z);
  for (const member of crew) {
    member.x = member.home.x;
    member.z = member.home.z;
    member.moving = false;
    member.node?.position.set(member.x, surfaceHeight(member.x, member.z), member.z);
  }
}

// ---------- Modelos 3D (assets-src/blender) ----------

/** Peças do rover que a animação usa. Começam como as formas provisórias e são trocadas pelo modelo. */
export const rover: {
  beacon: THREE.Object3D;
  beaconMat: THREE.MeshStandardMaterial;
  bodyMat: THREE.MeshStandardMaterial | null;
  wheels: THREE.Object3D[];
} = { beacon, beaconMat, bodyMat: null, wheels: [] };

/** Troca as formas provisórias pelos modelos GLB. Enquanto carregam, o código continua funcionando. */
export function loadBaseModels(): Promise<unknown> {
  return Promise.all([
    attachModel(habitat, 'habitat'),
    attachModel(greenhouse, 'greenhouse'),
    attachModel(baseAntenna, 'antenna'),
    ...panelMeshes.map((unit) => attachModel(unit, 'solar_panel').then((model) => {
      model.traverse((object) => {
        if (!(object instanceof THREE.Mesh)) return;
        const original = object.material as THREE.MeshStandardMaterial | THREE.MeshStandardMaterial[];
        const prepare = (mat: THREE.MeshStandardMaterial): THREE.MeshStandardMaterial => {
          if (mat.name !== 'panel_cell') return mat;
          const cell = mat.clone();
          cell.emissive.setHex(PALETTE.panelGlow);
          panelCellMats.push(cell);
          return cell;
        };
        object.material = Array.isArray(original) ? original.map(prepare) : prepare(original);
      });
    })),
    attachModel(robot, 'rover').then((model) => {
      const chassisNode = model.getObjectByName('chassis');
      if (chassisNode instanceof THREE.Mesh) {
        const mat = (chassisNode.material as THREE.MeshStandardMaterial).clone();
        mat.emissive.setHex(0x402800);
        chassisNode.material = mat;
        rover.bodyMat = mat;
      }
      const beaconNode = model.getObjectByName('beacon');
      if (beaconNode instanceof THREE.Mesh) {
        const mat = (beaconNode.material as THREE.MeshStandardMaterial).clone();
        beaconNode.material = mat;
        rover.beacon = beaconNode;
        rover.beaconMat = mat;
      }
      rover.wheels = model.children.filter((child) => child.name.startsWith('wheel_'));
    }),
  ]);
}
