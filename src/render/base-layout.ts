// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Base lunar composta por áreas (habitação, energia, ciência, logística, comunicação, pouso) e seus estados
// visuais. Só lê o estado do motor; nenhum recurso nasce aqui. Modelos: public/models/v4 (Blender, D-16) com
// recuo para os modelos anteriores ou formas simples enquanto carregam.
import * as THREE from 'three';
import { attachModel, loadModel } from './assets';
import { groundFor, surfaceHeight } from './terrain-height';
import {
  ANTENNA,
  CLEAR_ZONES,
  DOCK,
  GREENHOUSE,
  HABITAT,
  ICE_PROCESSOR,
  ICE_ROUTE,
  ICE_SITE,
  LANDING_PAD,
  LIGHT_TOWERS,
  PANEL_SLOTS,
  POWER_UNIT,
  STORAGE,
  TANKS,
  type Spot,
} from './layout';
import { MAX_PANELS } from '../engine/robot';

const mat = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.2, ...extra });

/** Coloca o grupo no ponto, pousado no relevo medido, com a rotação do ponto. */
function place(group: THREE.Object3D, spot: Spot, radius = 1, lift = 0): void {
  group.position.set(spot.x, groundFor(spot.x, spot.z, radius) + lift, spot.z);
  group.rotation.y = spot.rot ?? 0;
}

/** Primeiro modelo que carregar da lista (v4, depois o anterior). Null se nenhum existir. */
async function attachFirst(group: THREE.Object3D, names: readonly string[]): Promise<THREE.Object3D | null> {
  for (const name of names) {
    try {
      return await attachModel(group, name);
    } catch {
      // tenta o próximo
    }
  }
  return null;
}

/** Materiais do modelo por nome (o mesmo material pode aparecer em várias malhas). */
function materialsNamed(root: THREE.Object3D, name: string): THREE.MeshStandardMaterial[] {
  const out = new Set<THREE.MeshStandardMaterial>();
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const list = Array.isArray(node.material) ? node.material : [node.material];
    for (const m of list) if (m instanceof THREE.MeshStandardMaterial && m.name === name) out.add(m);
  });
  return [...out];
}

/** Troca, nas malhas do modelo, o material de nome `name` por uma cópia própria (para animar só esta peça). */
function ownMaterial(root: THREE.Object3D, name: string): THREE.MeshStandardMaterial | null {
  let copy: THREE.MeshStandardMaterial | null = null;
  root.traverse((node) => {
    if (!(node instanceof THREE.Mesh)) return;
    const swap = (m: THREE.Material) => {
      if (!(m instanceof THREE.MeshStandardMaterial) || m.name !== name) return m;
      copy ??= m.clone();
      return copy;
    };
    node.material = Array.isArray(node.material) ? node.material.map(swap) : swap(node.material);
  });
  return copy;
}

// ---------- Peças ----------

export const base = new THREE.Group();
base.name = 'base';

function group(name: string): THREE.Group {
  const g = new THREE.Group();
  g.name = name;
  base.add(g);
  return g;
}

export const habitat = group('habitat');
export const greenhouse = group('greenhouse');
export const antenna = group('antenna');
export const powerUnit = group('power');
export const processor = group('processor');
export const tanks = group('tanks');
export const storage = group('storage');
export const pad = group('pad');
export const lander = group('lander');
export const panelUnits: THREE.Group[] = PANEL_SLOTS.map((_, i) => group(`panel_${i}`));
const towers: THREE.Group[] = LIGHT_TOWERS.map((_, i) => group(`tower_${i}`));
const iceSite = group('ice-site');

// Formas provisórias (aparecem só se o GLB não carregar).
function box(w: number, h: number, d: number, m: THREE.Material, y = h / 2): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
  mesh.position.y = y;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
const white = mat(0xd9dcd6);
const grey = mat(0x6f7782, { metalness: 0.5 });
const dark = mat(0x2a2e35);
// Comprimento no eixo x do modelo: a rotação do ponto (π/2) o deixa ao longo da crista (z).
habitat.add(box(12, 3.2, 3.4, white, 2.2));
greenhouse.add(new THREE.Mesh(new THREE.SphereGeometry(2.6, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x9fe8b0, { transparent: true, opacity: 0.35, roughness: 0.1 })));
powerUnit.add(box(2.4, 1.4, 1.4, grey));
processor.add(box(3.6, 2, 1.8, grey));
tanks.add(box(3, 1.8, 1.6, white));
storage.add(box(2, 1, 1.2, mat(0xb98a3e)));
pad.add(new THREE.Mesh(new THREE.CylinderGeometry(6, 6, 0.15, 40), dark));
lander.add(box(3, 4, 3, mat(0xc9a24a), 3));
for (const t of towers) t.add(box(0.2, 4, 0.2, grey));
for (const u of panelUnits) u.add(box(2, 0.08, 1.2, mat(0x3f7fd0, { metalness: 0.5, roughness: 0.25 }), 1.2));

place(habitat, HABITAT, 6);
place(greenhouse, GREENHOUSE, 2.4);
place(antenna, ANTENNA, 1.4);
place(powerUnit, POWER_UNIT, 1.2);
place(processor, ICE_PROCESSOR, 2);
place(tanks, TANKS, 1.5);
place(storage, STORAGE, 1.5);
place(pad, LANDING_PAD, 6);
place(lander, LANDING_PAD, 2, 0.15);
PANEL_SLOTS.forEach((spot, i) => place(panelUnits[i], spot, 1));
/** Escala dos painéis na tela: legíveis ao lado do habitat (o tamanho real de um painel é escolha de jogo). */
const PANEL_SCALE = 1.5;
LIGHT_TOWERS.forEach((spot, i) => place(towers[i], spot, 0.5));
place(iceSite, ICE_SITE, 1);

// Local do gelo: bandeirolas e farol azul (o depósito em si está abaixo da superfície, misturado ao regolito).
const iceBeaconMat = new THREE.MeshStandardMaterial({ color: 0x9fe7ff, emissive: 0x6dc8ff, emissiveIntensity: 2 });
const iceBeacon = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 8), iceBeaconMat);
iceBeacon.position.y = 2.3;
const iceMast = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.2, 6), grey);
iceMast.position.y = 1.1;
iceSite.add(iceMast, iceBeacon);
for (let i = 0; i < 4; i++) {
  const a = (i / 4) * Math.PI * 2 + 0.4;
  const flag = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.9, 5), mat(0x6d9fe8, { emissive: 0x23446e }));
  flag.position.set(Math.cos(a) * 3.2, 0.45, Math.sin(a) * 3.2);
  flag.position.y = surfaceHeight(ICE_SITE.x + flag.position.x, ICE_SITE.z + flag.position.z) - iceSite.position.y + 0.45;
  iceSite.add(flag);
}
// Mancha escura do regolito com gelo (decalque simples no chão).
const icePatch = new THREE.Mesh(
  new THREE.CircleGeometry(3, 32),
  new THREE.MeshStandardMaterial({ color: 0x3a4250, roughness: 1, transparent: true, opacity: 0.55, depthWrite: false }),
);
icePatch.rotation.x = -Math.PI / 2;
icePatch.position.y = 0.05;
iceSite.add(icePatch);

// ---------- Luzes operacionais (preenchimento artístico, não é simulação física) ----------

/** Luzes pontuais sem sombra: deixam a base legível na sombra e dão leitura de "instalação em operação". */
const habitatLight = new THREE.PointLight(0xffd7a0, 30, 18, 1.8);
habitatLight.position.set(5.5, 3.4, 0);
base.add(habitatLight);
const yardLight = new THREE.PointLight(0xcfe3ff, 22, 20, 1.8);
yardLight.position.set(11, 4.5, -1);
base.add(yardLight);
const fieldLight = new THREE.PointLight(0xcfe3ff, 14, 18, 1.8);
fieldLight.position.set(-11, 4.5, 0);
base.add(fieldLight);
for (const l of [habitatLight, yardLight, fieldLight]) l.position.y += surfaceHeight(l.position.x, l.position.z);

// ---------- Pedras (instanciadas) ----------

/** Gerador determinístico: a mesma paisagem a cada carga (sem Math.random). */
function seeded(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function rockGeometry(seed: number): THREE.BufferGeometry {
  const geo = new THREE.IcosahedronGeometry(1, 2);
  const rand = seeded(seed);
  const pos = geo.attributes.position;
  const v = new THREE.Vector3();
  const bumps = Array.from({ length: 5 }, () => new THREE.Vector3(rand() - 0.5, rand() - 0.5, rand() - 0.5).normalize());
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const dir = v.clone().normalize();
    let r = 1;
    for (const b of bumps) r += 0.18 * Math.max(0, dir.dot(b)) ** 3;
    r *= 0.85 + 0.3 * rand();
    v.copy(dir.multiplyScalar(r));
    v.y *= 0.62;
    pos.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

const rockMat = new THREE.MeshStandardMaterial({ color: 0x8a8d93, roughness: 0.95, metalness: 0 });
const ROCK_COUNT = 140;
const rocks: THREE.InstancedMesh[] = [];
function scatterRocks(geos: THREE.BufferGeometry[], material: THREE.Material): void {
  for (const r of rocks) {
    base.remove(r);
    r.dispose();
  }
  rocks.length = 0;
  const rand = seeded(20241009);
  const per = Math.ceil(ROCK_COUNT / geos.length);
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const e = new THREE.Euler();
  geos.forEach((geo) => {
    const inst = new THREE.InstancedMesh(geo, material, per);
    inst.castShadow = true;
    inst.receiveShadow = true;
    let placed = 0;
    let guard = 0;
    while (placed < per && guard++ < per * 20) {
      const ang = rand() * Math.PI * 2;
      const dist = 8 + rand() * 70;
      const x = Math.cos(ang) * dist;
      const z = Math.sin(ang) * dist;
      if (CLEAR_ZONES.some(([cx, cz, r]) => Math.hypot(x - cx, z - cz) < r)) continue;
      const big = rand() < 0.08;
      const s = big ? 1 + rand() * 1.4 : 0.15 + rand() * 0.55;
      e.set(rand() * 0.6, rand() * Math.PI * 2, rand() * 0.6);
      q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, surfaceHeight(x, z) + s * 0.15, z), q, new THREE.Vector3(s, s, s));
      inst.setMatrixAt(placed++, m);
    }
    inst.count = placed;
    inst.instanceMatrix.needsUpdate = true;
    base.add(inst);
    rocks.push(inst);
  });
}
scatterRocks([rockGeometry(1), rockGeometry(2), rockGeometry(3)], rockMat);

// ---------- Cabos de energia (tubos finos sobre o chão) ----------

const cableMat = new THREE.MeshStandardMaterial({ color: 0x1d2128, roughness: 0.7 });
function cable(points: Array<[number, number]>): void {
  const pts = points.map(([x, z]) => new THREE.Vector3(x, surfaceHeight(x, z) + 0.06, z));
  const curve = new THREE.CatmullRomCurve3(pts);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, pts.length * 10), 0.05, 5, false), cableMat);
  tube.receiveShadow = true;
  base.add(tube);
}
cable([[-5.5, -4], [-2, -3], [-1.6, -1]]);

// Cabos do campo solar: só existem para painéis montados. Tronco da unidade de energia até cada coluna
// e um ramal por painel, ao longo da coluna (leve deslocamento por linha, como um feixe de cabos).
function cableMesh(points: Array<[number, number]>): THREE.Mesh {
  const pts = points.map(([x, z]) => new THREE.Vector3(x, surfaceHeight(x, z) + 0.06, z));
  const tube = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), Math.max(8, pts.length * 10), 0.05, 5, false), cableMat);
  tube.receiveShadow = true;
  tube.visible = false;
  base.add(tube);
  return tube;
}
const FIELD_TRUNK_Z = POWER_UNIT.z;
const fieldColumns = [...new Set(PANEL_SLOTS.map((s) => s.x))];
/** Tronco até cada coluna (índice = coluna). */
const columnTrunks = fieldColumns.map((x) => cableMesh([[POWER_UNIT.x, FIELD_TRUNK_Z], [(POWER_UNIT.x + x) / 2, FIELD_TRUNK_Z], [x, FIELD_TRUNK_Z]]));
/** Ramal de cada vaga: do tronco ao painel. */
const slotCables = PANEL_SLOTS.map((slot, i) => {
  const dx = 0.12 * (Math.floor(i / fieldColumns.length) - 1.5);
  return cableMesh([[slot.x + dx, FIELD_TRUNK_Z], [slot.x + dx, (FIELD_TRUNK_Z + slot.z) / 2], [slot.x + dx, slot.z]]);
});
cable([[10, 4.5], [12.5, 3.5], [14, 3]]);
cable([[1.7, 4], [2.5, 7], [-1, 9]]);

// ---------- Trilhas do rover (marcas no regolito) ----------

const trackMat = new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.22, depthWrite: false });
function track(points: Array<[number, number]>): void {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, z]) => new THREE.Vector3(x, 0, z)));
  const samples = curve.getSpacedPoints(80);
  for (const side of [-0.75, 0.75]) {
    const pos: number[] = [];
    for (let i = 0; i < samples.length - 1; i++) {
      const a = samples[i];
      const b = samples[i + 1];
      const dir = new THREE.Vector3().subVectors(b, a).normalize();
      const n = new THREE.Vector3(-dir.z, 0, dir.x);
      const w = 0.16;
      const quad = [
        a.clone().addScaledVector(n, side - w),
        a.clone().addScaledVector(n, side + w),
        b.clone().addScaledVector(n, side - w),
        b.clone().addScaledVector(n, side + w),
      ].map((p) => new THREE.Vector3(p.x, surfaceHeight(p.x, p.z) + 0.03, p.z));
      pos.push(...quad[0].toArray(), ...quad[2].toArray(), ...quad[1].toArray(), ...quad[1].toArray(), ...quad[2].toArray(), ...quad[3].toArray());
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    base.add(new THREE.Mesh(geo, trackMat));
  }
}
track(ICE_ROUTE.map((p) => [p.x, p.z] as [number, number]));
track([[DOCK.x, DOCK.z], [10, 1.5]]);

// ---------- Estados visuais ----------

const handles = {
  windowLight: [] as THREE.MeshStandardMaterial[],
  extLight: [] as THREE.MeshStandardMaterial[],
  growLight: [] as THREE.MeshStandardMaterial[],
  screen: [] as THREE.MeshStandardMaterial[],
  statusLight: [] as THREE.MeshStandardMaterial[],
  lamp: [] as THREE.MeshStandardMaterial[],
  padLight: [] as THREE.MeshStandardMaterial[],
  engineGlow: [] as THREE.MeshStandardMaterial[],
  yoke: null as THREE.Object3D | null,
  dish: null as THREE.Object3D | null,
  antennaLight: new THREE.MeshStandardMaterial({ color: 0xe47767, emissive: 0xe47767, emissiveIntensity: 2 }),
};

// Luz de status da antena (vermelha: precisa de reparo; verde: operando).
const antennaStatus = new THREE.Mesh(new THREE.SphereGeometry(0.12, 10, 8), handles.antennaLight);
antennaStatus.position.set(0, 0.5, 1.0);
antenna.add(antennaStatus);
// Faróis de alerta no habitat (recurso crítico).
const alertMat = new THREE.MeshStandardMaterial({ color: 0xe47767, emissive: 0xe47767, emissiveIntensity: 0 });
const alertLights: THREE.Mesh[] = [];
for (const x of [-5, 5]) {
  const a = new THREE.Mesh(new THREE.SphereGeometry(0.16, 10, 8), alertMat);
  a.position.set(x, 4.1, 0);
  habitat.add(a);
  alertLights.push(a);
}

/** Painéis guardados no depósito (caixas): um por painel ainda não instalado. */
const storedCrates: THREE.Object3D[] = [];
function buildStoredCrates(source: THREE.Object3D | null): void {
  for (const c of storedCrates) {
    storage.remove(c);
    // Só as caixas provisórias têm geometria própria; os clones do modelo compartilham a da fonte.
    if (c instanceof THREE.Mesh) c.geometry.dispose();
  }
  storedCrates.length = 0;
  for (let i = 0; i < MAX_PANELS; i++) {
    const crate = source ? source.clone(true) : box(1.1, 0.5, 1.6, mat(0x3f6fb0, { metalness: 0.3 }));
    const col = i % 4;
    const row = Math.floor(i / 4) % 2;
    const layer = Math.floor(i / 8);
    crate.position.set(-2.4 + col * 1.25, layer * 0.55, -1.2 - row * 1.8);
    crate.scale.setScalar(source ? 0.9 : 1);
    storage.add(crate);
    storedCrates.push(crate);
  }
}
buildStoredCrates(null);

// ---------- Modelos ----------

/** Carrega os modelos v4 (com recuo). Os nomes de material e nó seguem assets-src/blender/build_v4.py. */
export function loadBaseLayoutModels(): Promise<unknown> {
  const jobs: Array<Promise<unknown>> = [
    attachFirst(habitat, ['v4/habitat_v4', 'habitat']).then((m) => {
      if (!m) return;
      handles.windowLight = materialsNamed(m, 'window_light');
      handles.extLight = materialsNamed(m, 'ext_light');
      // O habitat antigo era alinhado em x; o v4 também: a rotação do ponto o põe ao longo da crista.
    }),
    attachFirst(greenhouse, ['v4/greenhouse_v4', 'greenhouse']).then((m) => {
      if (m) handles.growLight = materialsNamed(m, 'grow_light');
    }),
    attachFirst(antenna, ['v4/antenna_v4', 'antenna']).then((m) => {
      if (!m) return;
      handles.yoke = m.getObjectByName('yoke') ?? null;
      handles.dish = m.getObjectByName('dish') ?? null;
      antennaStatus.position.set(0, 0.6, 0.9);
    }),
    attachFirst(powerUnit, ['v4/power_unit_v4']).then((m) => {
      if (m) handles.statusLight.push(...materialsNamed(m, 'status_light'));
    }),
    attachFirst(processor, ['v4/ice_processor_v4']).then((m) => {
      if (m) handles.screen.push(...materialsNamed(m, 'screen'));
    }),
    attachFirst(tanks, ['v4/tanks_v4']),
    attachFirst(pad, ['v4/landing_pad_v4']).then((m) => {
      if (m) handles.padLight = materialsNamed(m, 'pad_light');
    }),
    attachFirst(lander, ['v4/lander_v4']).then((m) => {
      if (m) handles.engineGlow = materialsNamed(m, 'engine_glow');
      setEngineGlow(0);
    }),
    ...towers.map((tw) =>
      attachFirst(tw, ['v4/light_tower_v4']).then((m) => {
        if (m) handles.lamp.push(...materialsNamed(m, 'lamp'));
      }),
    ),
    attachFirst(storage, ['v4/crate_stack_v4']),
    loadModel('v4/crate_v4').then((m) => buildStoredCrates(m)).catch(() => undefined),
    loadModel('v4/rocks_v4')
      .then((m) => {
        const geos: THREE.BufferGeometry[] = [];
        let material: THREE.Material = rockMat;
        m.updateMatrixWorld(true);
        m.traverse((node) => {
          if (node instanceof THREE.Mesh && node.name.startsWith('rock_')) {
            const g = node.geometry.clone();
            g.applyMatrix4(node.matrixWorld);
            g.center();
            g.computeBoundingSphere();
            const r = g.boundingSphere?.radius ?? 1;
            g.scale(1 / r, 1 / r, 1 / r);
            geos.push(g);
            material = node.material as THREE.Material;
          }
        });
        if (geos.length) scatterRocks(geos, material);
      })
      .catch(() => undefined),
    ...panelUnits.map((unit) =>
      attachFirst(unit, ['v4/solar_array_v4', 'solar_panel']).then((m) => {
        if (!m) return;
        const own = ownMaterial(m, 'panel_cell');
        unit.userData.cells = own ? [own] : [];
      }),
    ),
  ];
  return Promise.allSettled(jobs);
}

// ---------- Atualização ----------

export interface BaseView {
  readonly t: number;
  readonly panels: number;
  /**
   * Painel da missão em andamento: `k` = montagem (0..1) na operação; depois fica montado e desligado
   * (`connected: false`) na volta e na entrega, até o motor concluir a tarefa e contar o painel.
   */
  readonly building: { readonly slot: number; readonly k: number; readonly connected: boolean } | null;
  readonly batteryPct: number;
  readonly anyCritical: boolean;
  readonly greenhouseOn: boolean;
  readonly greenhouseVisible: boolean;
  readonly antennaOnline: boolean;
  /** Antena em reparo (fase de operação da missão). */
  readonly antennaRepairing: boolean;
  readonly processing: boolean;
  readonly iceActive: boolean;
  readonly panelGlow: number;
  /** Direção da Terra (azimute em graus a partir do norte, elevação em graus), para orientar a antena. */
  readonly earthAz: number;
  readonly earthEl: number;
}

const INSTALL_SECONDS = 0.8;

function setInstalled(obj: THREE.Object3D, installed: boolean, now: number): void {
  if (installed && obj.userData.installed !== true) {
    obj.userData.installed = true;
    obj.userData.installedAt = now;
  }
  if (!installed) {
    obj.userData.installed = false;
    return;
  }
  // Relógio da cena recomeça a cada missão: idade negativa reinicia a transição.
  if (now < (obj.userData.installedAt as number)) obj.userData.installedAt = now - INSTALL_SECONDS;
  const age = now - (obj.userData.installedAt as number);
  const k = Math.min(1, Math.max(0, age / INSTALL_SECONDS));
  obj.scale.setScalar(Math.max(0.001, 1 - Math.pow(1 - k, 3)));
}

export function updateBase(v: BaseView): void {
  const { t } = v;
  // Painéis: instalados aparecem com transição; a vaga em montagem mostra o painel crescendo (só visual;
  // a contagem de painéis muda só na conclusão da tarefa, no motor).
  panelUnits.forEach((unit, i) => {
    const installed = i < v.panels;
    if (installed) {
      unit.visible = true;
      setInstalled(unit, true, t);
      unit.scale.multiplyScalar(PANEL_SCALE);
    } else if (v.building && v.building.slot === i) {
      unit.visible = true;
      unit.userData.installed = false;
      unit.scale.set(PANEL_SCALE, PANEL_SCALE * Math.max(0.05, v.building.k), PANEL_SCALE);
    } else {
      unit.visible = false;
      unit.userData.installed = false;
    }
    // Células acesas só em painel ligado (contado pelo motor); o painel recém-montado fica apagado até a conclusão.
    for (const m of (unit.userData.cells as THREE.MeshStandardMaterial[] | undefined) ?? []) m.emissiveIntensity = installed ? v.panelGlow : 0;
    // Ramal aparece quando o painel está montado e sendo ligado, e fica enquanto ele existir.
    slotCables[i].visible = installed || (!!v.building && v.building.slot === i && v.building.k >= 1);
  });
  columnTrunks.forEach((trunk, c) => (trunk.visible = PANEL_SLOTS.some((slot, i) => slot.x === fieldColumns[c] && slotCables[i].visible)));
  // Caixas de painéis guardados: uma a menos a cada painel instalado ou em montagem.
  const stored = MAX_PANELS - v.panels - (v.building ? 1 : 0);
  storedCrates.forEach((c, i) => (c.visible = i < stored));

  // Habitat: janelas acesas com bateria; piscam com bateria muito baixa.
  const flicker = v.batteryPct < 8 ? (Math.sin(t * 23) > 0 ? 1 : 0.15) : 1;
  const windows = v.batteryPct > 0 ? 2.2 * flicker : 0;
  for (const m of handles.windowLight) m.emissiveIntensity = windows;
  for (const m of handles.extLight) m.emissiveIntensity = v.batteryPct > 0 ? 3 : 0;
  habitatLight.intensity = v.batteryPct > 0 ? 30 * flicker : 0;
  yardLight.intensity = v.batteryPct > 0 ? 22 : 0;
  fieldLight.intensity = v.batteryPct > 0 ? 14 : 0;
  for (const m of handles.lamp) m.emissiveIntensity = v.batteryPct > 0 ? 4 : 0.05;
  for (const m of handles.padLight) m.emissiveIntensity = v.batteryPct > 0 ? (Math.sin(t * 3) > 0 ? 3 : 0.6) : 0;
  for (const m of handles.statusLight) {
    m.emissive.setHex(v.batteryPct < 20 ? 0xe47767 : 0x56b9a4);
    m.emissiveIntensity = 2;
  }
  // Alerta: recurso crítico acende os faróis vermelhos do habitat.
  alertMat.emissiveIntensity = v.anyCritical ? (Math.sin(t * 6) > 0 ? 4 : 0.3) : 0;

  // Estufa: luz de cultivo quando está produzindo.
  greenhouse.visible = true;
  for (const m of handles.growLight) m.emissiveIntensity = v.greenhouseOn ? 2.4 + 0.3 * Math.sin(t * 1.5) : v.greenhouseVisible ? 0.15 : 0;

  // Antena: apontada para baixo e luz vermelha até o reparo; depois orienta para a Terra e fica verde.
  const dishTarget = v.antennaOnline ? v.earthEl : -35;
  const yawTarget = v.antennaOnline ? -THREE.MathUtils.degToRad(v.earthAz) - antenna.rotation.y : 0.6;
  if (handles.yoke) {
    const jitter = v.antennaRepairing ? Math.sin(t * 9) * 0.25 : 0;
    handles.yoke.rotation.y += (yawTarget + jitter - handles.yoke.rotation.y) * 0.05;
  }
  if (handles.dish) handles.dish.rotation.x += (THREE.MathUtils.degToRad(-dishTarget) - handles.dish.rotation.x) * 0.05;
  handles.antennaLight.color.setHex(v.antennaOnline ? 0x6fe39a : 0xe47767);
  handles.antennaLight.emissive.setHex(v.antennaOnline ? 0x6fe39a : 0xe47767);
  handles.antennaLight.emissiveIntensity = v.antennaRepairing ? (Math.sin(t * 12) > 0 ? 3 : 0.2) : 2;

  // Processador de gelo: tela acesa e pulsando durante a entrega (aquecimento e condensação).
  for (const m of handles.screen) m.emissiveIntensity = v.processing ? 2 + Math.sin(t * 5) : 0.5;
  // Local do gelo: farol mais forte com missão de gelo na fila.
  iceBeaconMat.emissiveIntensity = v.iceActive ? 2.5 + 1.5 * Math.sin(t * 4) : 0.6;
}

/** Brilho do motor do módulo de descida (introdução). */
export function setEngineGlow(k: number): void {
  for (const m of handles.engineGlow) m.emissiveIntensity = 6 * k;
}

/** Altura do módulo de descida acima da plataforma (0 = pousado). */
export function setLanderAltitude(h: number): void {
  lander.position.y = groundFor(LANDING_PAD.x, LANDING_PAD.z, 2) + 0.15 + h;
}

/** Ponto central de cada área, para a câmera. */
export const FOCUS = {
  greenhouse: new THREE.Vector3(GREENHOUSE.x, surfaceHeight(GREENHOUSE.x, GREENHOUSE.z) + 1.2, GREENHOUSE.z),
  habitat: new THREE.Vector3(HABITAT.x, surfaceHeight(HABITAT.x, HABITAT.z) + 2, HABITAT.z),
  energy: new THREE.Vector3(-12.5, surfaceHeight(-12.5, 0) + 1, 0),
  logistics: new THREE.Vector3(11, surfaceHeight(11, 0) + 1, 0),
  pad: new THREE.Vector3(LANDING_PAD.x, surfaceHeight(LANDING_PAD.x, LANDING_PAD.z) + 2, LANDING_PAD.z),
  ice: new THREE.Vector3(ICE_SITE.x, surfaceHeight(ICE_SITE.x, ICE_SITE.z) + 1, ICE_SITE.z),
  antenna: new THREE.Vector3(ANTENNA.x, surfaceHeight(ANTENNA.x, ANTENNA.z) + 2, ANTENNA.z),
};
