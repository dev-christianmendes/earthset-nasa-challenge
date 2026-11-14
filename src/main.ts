// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Cena three.js e laço do jogo. Liga o motor (src/engine) à tela; a regra fica no motor.
// Sol, relevo, painéis e robô na cena são ilustrativos até a validação com dados da NASA (B2).
import * as THREE from 'three';
import { advance, createGame, dispatch, outcomeOf, type GameAction, type GameState } from './engine/game';
import type { GreenhouseMode, Installation } from './engine/resources';
import { MAX_PANELS, MAX_QUEUE, isWorking, type TaskKind } from './engine/robot';
import { MATCH_HOURS } from './engine/clock';
import { isSunlit, sampleAt, type SunTable } from './engine/sun';
import sunJson from './data/sun-south-pole.json';
import { EXPLANATIONS, SCHOOL_LABELS, type Explanation } from './school';

/** Sol real: JPL Horizons, gerado por data-pipeline/fetch_sun.py (ver docs/data-sources.md). */
const SUN = sunJson as SunTable;

/** Paleta da cena. O azul de destaque é o mesmo --accent do HUD (index.html). */
const PALETTE = {
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
  robot: 0xffc857,
  track: 0x2a2c33,
  sunlight: 0xfff1d6,
  skyFill: 0x8fa6c8,
  groundFill: 0x1a1c24,
} as const;

/** Configuração inicial da base. Valores de equilíbrio do motor (docs/regras-recursos.md). */
const INSTALLATION: Installation = {
  rank: 'explorador',
  site: 'slope',
  panels: 2,
  batteryCapacity: 1200,
  greenhouse: 'surplus',
};

/** Horas de jogo por segundo real. */
const HOURS_PER_SECOND = 2;
/** Maior passo de tempo real aceito por quadro, para a aba em segundo plano não pular a partida. */
const MAX_FRAME_SECONDS = 0.1;

const TASK_LABEL: Record<TaskKind, string> = { ice: 'Gelo', panel: 'Painel', antenna: 'Antena' };
const GREENHOUSE_LABEL: Record<GreenhouseMode, string> = {
  off: 'Desligada',
  always: 'Sempre ligada',
  surplus: 'Só com sobra',
};

// ---------- Elementos da tela ----------

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`elemento ausente na página: #${id}`);
  return found as T;
}

const ui = {
  hour: el('hour'),
  hearts: el('hearts'),
  batBar: el('bar-battery'),
  airBar: el('bar-air'),
  waterBar: el('bar-water'),
  foodBar: el('bar-food'),
  batVal: el('val-battery'),
  airVal: el('val-air'),
  waterVal: el('val-water'),
  foodVal: el('val-food'),
  panels: el('panels'),
  queue: el('queue'),
  greenhouse: el<HTMLSelectElement>('greenhouse'),
  message: el('message'),
  overlay: el('overlay'),
  overlayTitle: el('overlay-title'),
  overlayText: el('overlay-text'),
  restart: el('restart'),
};

for (const mode of Object.keys(GREENHOUSE_LABEL) as GreenhouseMode[]) {
  const opt = document.createElement('option');
  opt.value = mode;
  opt.textContent = GREENHOUSE_LABEL[mode];
  ui.greenhouse.appendChild(opt);
}

// ---------- Estado e ações ----------

let game: GameState = createGame({ installation: INSTALLATION });

function act(action: GameAction): void {
  const result = dispatch(game, action);
  if (result.ok) {
    game = result.state;
    setMessage('');
  } else {
    setMessage(result.reason);
  }
  renderHud();
}

function setMessage(text: string): void {
  ui.message.textContent = text;
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-task]')) {
  button.addEventListener('click', () => {
    act({ type: 'ENQUEUE_TASK', kind: button.dataset.task as TaskKind });
  });
}

ui.greenhouse.addEventListener('change', () => {
  act({ type: 'SET_GREENHOUSE', mode: ui.greenhouse.value as GreenhouseMode });
});

ui.queue.addEventListener('click', (event) => {
  const target = event.target as HTMLElement;
  const index = target.dataset.cancel;
  if (index !== undefined) act({ type: 'CANCEL_TASK', index: Number(index) });
});

ui.restart.addEventListener('click', () => {
  game = createGame({ installation: INSTALLATION });
  ui.greenhouse.value = INSTALLATION.greenhouse;
  setMessage('');
  renderHud();
});

// ---------- Modo escola (B3.4) ----------

const schoolToggle = el<HTMLInputElement>('school-mode');

// Guarda o texto normal de cada rótulo, para voltar a ele ao desligar o modo escola.
for (const node of document.querySelectorAll<HTMLElement>('[data-label]')) {
  node.dataset.normal = node.textContent ?? '';
}

function fillHint(node: HTMLElement, text: Explanation): void {
  const lines: Array<[string, string]> = [
    ['O que é: ', text.what],
    ['Por que muda: ', text.why],
    ['Fonte: ', text.source],
  ];
  node.replaceChildren(
    ...lines.map(([title, body]) => {
      const line = document.createElement('span');
      const strong = document.createElement('b');
      strong.textContent = title;
      line.append(strong, body);
      return line;
    }),
  );
}
for (const node of document.querySelectorAll<HTMLElement>('[data-hint]')) {
  const text = EXPLANATIONS[node.dataset.hint ?? ''];
  if (text) fillHint(node, text);
}

function applySchoolMode(on: boolean): void {
  document.body.classList.toggle('school', on);
  for (const node of document.querySelectorAll<HTMLElement>('[data-label]')) {
    const school = SCHOOL_LABELS[node.dataset.label ?? ''];
    node.textContent = on && school ? school : (node.dataset.normal ?? '');
  }
}
schoolToggle.addEventListener('change', () => applySchoolMode(schoolToggle.checked));
// O navegador pode lembrar o estado da caixa ao recarregar a página.
applySchoolMode(schoolToggle.checked);

// ---------- Sol (ilustrativo) ----------

/** A base recebe Sol nessa hora? Tabela real, com o horizonte local do site (ilustrativo). */
function sunlit(hour: number): boolean {
  return isSunlit(SUN, hour, INSTALLATION.site);
}

// ---------- Cena ----------

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.insertBefore(renderer.domElement, document.body.firstChild);

const scene = new THREE.Scene();
scene.background = new THREE.Color(PALETTE.space);
scene.fog = new THREE.Fog(PALETTE.space, 60, 220);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 600);
camera.position.set(2, 17, 30);
// Olha um pouco à esquerda: a base aparece à direita do painel de HUD.
camera.lookAt(-8, 1, 0);

// Em tela estreita o HUD ocupa a parte de baixo: a cena sobe para a base ficar visível acima dele.
function frameForViewport(): void {
  if (window.innerWidth <= 700) {
    const shift = window.innerHeight * 0.22;
    camera.setViewOffset(window.innerWidth, window.innerHeight, 0, shift, window.innerWidth, window.innerHeight);
  } else {
    camera.clearViewOffset();
  }
}
frameForViewport();

// Relevo ilustrativo: chão com ondulação suave e crateras escuras.
const groundGeo = new THREE.PlaneGeometry(120, 120, 120, 120);
const pos = groundGeo.attributes.position as THREE.BufferAttribute;
for (let i = 0; i < pos.count; i++) {
  const x = pos.getX(i);
  const y = pos.getY(i);
  const bump = Math.sin(x * 0.11) * 0.35 + Math.cos(y * 0.09) * 0.3 + Math.sin((x + y) * 0.23) * 0.12;
  pos.setZ(i, bump);
}
groundGeo.computeVertexNormals();
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
  tex.repeat.set(14, 14);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
const ground = new THREE.Mesh(
  groundGeo,
  new THREE.MeshStandardMaterial({ color: 0xffffff, map: regolithTexture(), roughness: 1, metalness: 0 }),
);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

const craterMat = new THREE.MeshStandardMaterial({ color: PALETTE.crater, roughness: 1 });
const craters: Array<[number, number, number]> = [
  [-18, -12, 4.5],
  [14, -20, 6],
  [24, 6, 3.2],
  [-26, 10, 5.5],
  [4, 18, 2.6],
];
for (const [x, z, r] of craters) {
  const c = new THREE.Mesh(new THREE.CircleGeometry(r, 36), craterMat);
  c.rotation.x = -Math.PI / 2;
  c.position.set(x, 0.05, z);
  c.receiveShadow = true;
  scene.add(c);
}

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
const beacon = new THREE.Mesh(
  new THREE.SphereGeometry(0.08, 12, 8),
  new THREE.MeshStandardMaterial({ color: 0x7fd7ff, emissive: 0x7fd7ff, emissiveIntensity: 1.5 }),
);
beacon.position.set(0.3, 1.1, 0);
robot.add(beacon);
// Escala maior que o modelo original: o robô precisa ser legível na tela de 1280 px.
robot.scale.setScalar(1.7);
scene.add(robot);

// ---------- Atualização por quadro ----------

function updateScene(hour: number, now: number): void {
  // Direção do Sol a partir do azimute (norte = -z, leste = +x) e da elevação reais.
  const { az, el } = sampleAt(SUN, hour);
  const azRad = (az * Math.PI) / 180;
  const elRad = (el * Math.PI) / 180;
  sun.position.set(
    Math.sin(azRad) * Math.cos(elRad) * 40,
    Math.sin(elRad) * 40,
    -Math.cos(azRad) * Math.cos(elRad) * 40,
  );
  if (sunlit(hour)) {
    sun.intensity = 3.2;
    ambient.intensity = 0.8;
  } else {
    // Sol acima do horizonte plano, mas tapado pelo relevo: só a luz de fundo.
    sun.intensity = 0;
    ambient.intensity = 0.55;
  }
  sun.target.position.set(0, 0, 0);

  for (let i = 0; i < panelMeshes.length; i++) {
    panelMeshes[i].visible = i < game.installation.panels;
  }
  greenhouse.visible = game.installation.greenhouse !== 'off';

  baseAntenna.visible = game.robot.antennaInstalled;

  const working = isWorking(game.robot, game.vitals.battery);
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
  beacon.visible = !working || Math.sin(t * 4) > -0.2;
}

// ---------- HUD ----------

function pct(value: number, max: number): number {
  return Math.max(0, Math.min(100, (value / max) * 100));
}

/** Abaixo desses valores (em %), o recurso aparece em vermelho no HUD (alerta, B3.1). */
const LOW_ALERT_PERCENT = { battery: 20, air: 30, water: 20, food: 20 } as const;

function setBar(bar: HTMLElement, value: HTMLElement, percent: number, text: string, low: boolean): void {
  bar.style.width = `${percent.toFixed(1)}%`;
  value.textContent = text;
  bar.closest('.meter')?.classList.toggle('low', low);
}

function renderHud(): void {
  const { vitals, installation, hearts, clock, robot: r } = game;
  ui.hour.textContent = String(Math.floor(clock.hour));
  ui.hearts.textContent = '♥'.repeat(hearts) + '♡'.repeat(Math.max(0, 3 - hearts));

  const batteryPct = pct(vitals.battery, installation.batteryCapacity);
  setBar(ui.batBar, ui.batVal, batteryPct, `${Math.round(batteryPct)}%`, batteryPct < LOW_ALERT_PERCENT.battery);
  setBar(ui.airBar, ui.airVal, pct(vitals.air, 100), `${Math.round(vitals.air)}`, vitals.air < LOW_ALERT_PERCENT.air);
  setBar(ui.waterBar, ui.waterVal, pct(vitals.water, 100), `${Math.round(vitals.water)}`, vitals.water < LOW_ALERT_PERCENT.water);
  setBar(ui.foodBar, ui.foodVal, pct(vitals.food, 100), `${Math.round(vitals.food)}`, vitals.food < LOW_ALERT_PERCENT.food);

  ui.panels.textContent = `${installation.panels} de ${MAX_PANELS}`;
  ui.greenhouse.value = installation.greenhouse;

  ui.queue.replaceChildren();
  if (r.queue.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Robô ocioso';
    ui.queue.appendChild(li);
  }
  r.queue.forEach((task, index) => {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = `${index + 1}. ${TASK_LABEL[task.kind]} · ${task.hoursLeft.toFixed(1)} h`;
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.dataset.cancel = String(index);
    cancel.textContent = '×';
    cancel.setAttribute('aria-label', `Cancelar ${TASK_LABEL[task.kind]}`);
    li.append(label, cancel);
    ui.queue.appendChild(li);
  });

  const full = r.queue.length >= MAX_QUEUE;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-task]')) {
    button.disabled = outcomeOf(game) !== 'playing' || full;
  }

  const outcome = outcomeOf(game);
  ui.overlay.hidden = outcome === 'playing';
  if (outcome === 'lost') {
    ui.overlayTitle.textContent = 'A base foi perdida';
    ui.overlayText.textContent = `Os corações acabaram na hora ${Math.floor(clock.hour)}. Sem energia, ar, água ou comida por tempo demais.`;
  } else if (outcome === 'won') {
    ui.overlayTitle.textContent = 'Um dia lunar sobrevivido';
    ui.overlayText.textContent = `A base chegou às ${MATCH_HOURS} horas com ${hearts} de 3 corações.`;
  }
}

// ---------- Laço do jogo ----------

let last: number | null = null;

function frame(now: number): void {
  if (last !== null && outcomeOf(game) === 'playing') {
    const seconds = Math.min(Math.max(0, (now - last) / 1000), MAX_FRAME_SECONDS);
    game = advance(game, seconds * HOURS_PER_SECOND, sunlit(game.clock.hour));
  }
  last = now;
  updateScene(game.clock.hour, now);
  renderHud();
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  frameForViewport();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

ui.greenhouse.value = INSTALLATION.greenhouse;
renderHud();
requestAnimationFrame(frame);
