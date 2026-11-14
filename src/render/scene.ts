// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Cena three.js: relevo, céu, base, robô e luz. Só desenha o estado recebido; regra fica no motor.
import * as THREE from 'three';
import type { GameState } from '../engine/game';
import { solarFactor, stormLevel, type SpaceWeatherSample } from '../engine/space-weather';
import { MAX_PANELS, isWorking } from '../engine/robot';
import { sampleAt } from '../engine/sun';
import { SUN } from '../data/sun';
import { TERRAIN_MESH } from '../data/terrain-mesh';

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
  beacon: 0x7fd7ff,
  robot: 0xffc857,
  track: 0x2a2c33,
  sunlight: 0xfff1d6,
  skyFill: 0x8fa6c8,
  groundFill: 0x1a1c24,
} as const;

// ---------- Cena ----------

export const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.insertBefore(renderer.domElement, document.body.firstChild);

export const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.space);
scene.fog = new THREE.Fog(PALETTE.space, 60, 220);

export const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(2, 17, 30);
// Olha um pouco à esquerda: a base aparece à direita do painel de HUD.
camera.lookAt(-8, 1, 0);

// Em tela estreita o HUD ocupa a parte de baixo: a cena sobe para a base ficar visível acima dele.
export function frameForViewport(): void {
  if (window.innerWidth <= 700) {
    const shift = window.innerHeight * 0.22;
    camera.setViewOffset(window.innerWidth, window.innerHeight, 0, shift, window.innerWidth, window.innerHeight);
  } else {
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
  geo.setIndex(index);
  geo.computeVertexNormals();
  return geo;
}
const ground = new THREE.Mesh(
  buildTerrain(),
  new THREE.MeshStandardMaterial({ color: 0xffffff, map: regolithTexture(), roughness: 1, metalness: 0 }),
);
ground.receiveShadow = true;
scene.add(ground);


// Sol: luz direcional com sombras.
const sun = new THREE.DirectionalLight(PALETTE.sunlight, 2.6);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.left = -30;
sun.shadow.camera.right = 30;
sun.shadow.camera.top = 30;
sun.shadow.camera.bottom = -30;
sun.shadow.camera.near = 1;
sun.shadow.camera.far = 120;
scene.add(sun);
scene.add(sun.target);
const ambient = new THREE.HemisphereLight(PALETTE.skyFill, PALETTE.groundFill, 0.35);
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

const earth = new THREE.Mesh(
  new THREE.SphereGeometry(7, 48, 32),
  new THREE.MeshStandardMaterial({ color: 0x2f6fb0, roughness: 0.8, emissive: 0x0a1a33, emissiveIntensity: 0.4, fog: false }),
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

export function updateScene(state: GameState, now: number, lit: boolean, weather: SpaceWeatherSample): void {
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
    ambient.intensity = 0.8;
  } else {
    // Sol acima do horizonte plano, mas tapado pelo relevo: só a luz de fundo.
    sun.intensity = 0;
    ambient.intensity = 0.55;
  }
  sun.target.position.set(0, 0, 0);

  for (let i = 0; i < panelMeshes.length; i++) {
    panelMeshes[i].visible = i < state.installation.panels;
  }
  greenhouse.visible = state.installation.greenhouse !== 'off';

  baseAntenna.visible = state.robot.antennaInstalled;

  const working = isWorking(state.robot, state.vitals.battery);
  const t = now / 1000;
  if (working) {
    const a = t * 0.8;
    // Leve balanço ao andar; a luz do corpo acende e a antena pisca.
    robot.position.set(Math.cos(a) * 9, Math.abs(Math.sin(t * 6)) * 0.05, Math.sin(a) * 6 + 2);
    robot.rotation.y = -a;
  } else {
    robot.position.set(9, 0, 4);
  }
  robotBodyMat.emissiveIntensity = working ? 1 : 0.2;
  // Tempestade: os painéis perdem brilho na proporção da geração (ver solarFactor).
  panelMat.emissiveIntensity = 0.6 * solarFactor(stormLevel(weather.kp));
  // Radiação de partículas solares: o farol do robô fica vermelho enquanto dura.
  beaconMat.color.setHex(weather.radiation ? 0xff5a5a : PALETTE.beacon);
  beaconMat.emissive.setHex(weather.radiation ? 0xff5a5a : PALETTE.beacon);
  beacon.visible = !working || Math.sin(t * 4) > -0.2;
}

