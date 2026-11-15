// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Corpo animado de um astronauta (three.js). Recebe o estado da locomoção (crew-gait.ts) e só desenha:
// posição no relevo, giro e inclinação do corpo, e mistura dos clipes do GLB.
// Um AnimationMixer por astronauta, criado uma vez. Caminhada e passo saltado têm o tempo controlado pela fase
// da passada (pé apoiado sem deslizar); as poses (parado, trabalho, aceno) tocam no próprio ritmo com transição.
// Os pesos sempre somam 1: sem isso o three.js mistura a pose de amarração (T) do esqueleto.
import * as THREE from 'three';
import type { GLTF } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { buildGaitProfile, clipPhase, nominalProfile, type GaitProfile, type Walker } from './crew-gait';

/** Poses fora da locomoção. Sem o clipe no modelo, a pose cai para `idle`. */
export type PoseClip = 'idle' | 'interact' | 'work' | 'harvest' | 'plant' | 'wave';
const POSES: readonly PoseClip[] = ['idle', 'interact', 'work', 'harvest', 'plant', 'wave'];

/** Tempo (s) da transição entre poses. */
const POSE_FADE = 0.35;
const PROFILE_SAMPLES = 48;

const profileCache = new WeakMap<THREE.AnimationClip, GaitProfile>();
const tmpV = new THREE.Vector3();

function findFoot(root: THREE.Object3D, side: 'l' | 'r'): THREE.Object3D | null {
  let found: THREE.Object3D | null = null;
  const re = side === 'l' ? /^foot[_.]?l$/i : /^foot[_.]?r$/i;
  root.traverse((n) => {
    if (!found && re.test(n.name)) found = n;
  });
  return found;
}

/** Mede o perfil da passada amostrando o clipe num mixer temporário (uma vez por clipe). */
function measureProfile(root: THREE.Object3D, clip: THREE.AnimationClip, nominalSpeed: number): GaitProfile {
  const cached = profileCache.get(clip);
  if (cached) return cached;
  const fl = findFoot(root, 'l');
  const fr = findFoot(root, 'r');
  let profile: GaitProfile;
  if (!fl || !fr || clip.duration <= 0) {
    profile = nominalProfile(Math.max(clip.duration, 0.5), nominalSpeed);
  } else {
    const tmp = new THREE.AnimationMixer(root);
    tmp.clipAction(clip).play();
    const ly = new Float32Array(PROFILE_SAMPLES);
    const lz = new Float32Array(PROFILE_SAMPLES);
    const ry = new Float32Array(PROFILE_SAMPLES);
    const rz = new Float32Array(PROFILE_SAMPLES);
    for (let i = 0; i < PROFILE_SAMPLES; i++) {
      tmp.setTime((clip.duration * i) / PROFILE_SAMPLES);
      root.updateMatrixWorld(true);
      fl.getWorldPosition(tmpV);
      ly[i] = tmpV.y;
      lz[i] = tmpV.z;
      fr.getWorldPosition(tmpV);
      ry[i] = tmpV.y;
      rz[i] = tmpV.z;
    }
    tmp.stopAllAction();
    tmp.uncacheRoot(root);
    profile = buildGaitProfile(clip.duration, ly, lz, ry, rz);
  }
  profileCache.set(clip, profile);
  return profile;
}

function clipKey(name: string): PoseClip | 'walk' | 'run' | null {
  const n = name.toLowerCase();
  const exact: Record<string, PoseClip | 'walk' | 'run'> = { idle: 'idle', default: 'idle', walk: 'walk', run: 'run', work: 'work', interact: 'interact', harvest: 'harvest', plant: 'plant', wave: 'wave' };
  if (exact[n]) return exact[n];
  if (n.includes('wave')) return 'wave';
  if (n.includes('walk')) return 'walk';
  if (n.includes('run')) return 'run';
  if (n.includes('interact')) return 'interact';
  if (n.includes('work')) return 'work';
  if (n.includes('idle')) return 'idle';
  return null;
}

export class CrewRig {
  /** Nó posicionado no mundo (posição, giro e inclinação). */
  readonly holder = new THREE.Group();
  private readonly mixer: THREE.AnimationMixer | null;
  private readonly walk: THREE.AnimationAction | null = null;
  private readonly run: THREE.AnimationAction | null = null;
  private readonly walkProfile: GaitProfile | null = null;
  private readonly runProfile: GaitProfile | null = null;
  private readonly poses: Partial<Record<PoseClip, THREE.AnimationAction>> = {};
  private readonly poseWeight: Record<PoseClip, number> = { idle: 1, interact: 0, work: 0, harvest: 0, plant: 0, wave: 0 };
  private currentPose: PoseClip = 'idle';
  /** Modelo antigo sem esqueleto: pernas e braços giram pela fase da passada. */
  private readonly legs: THREE.Object3D[] = [];
  private readonly arms: THREE.Object3D[] = [];

  private constructor(body: THREE.Object3D, gltf: GLTF | null, scale: number) {
    this.holder.name = 'astronaut';
    this.holder.rotation.order = 'YXZ';
    this.holder.add(body);
    if (!gltf || gltf.animations.length === 0) {
      this.mixer = null;
      this.legs = ['leg_L', 'leg_R'].map((n) => body.getObjectByName(n)).filter((o): o is THREE.Object3D => o !== undefined);
      this.arms = ['arm_L', 'arm_R'].map((n) => body.getObjectByName(n)).filter((o): o is THREE.Object3D => o !== undefined);
      return;
    }
    const mixer = new THREE.AnimationMixer(body);
    this.mixer = mixer;
    const clips: Partial<Record<PoseClip | 'walk' | 'run', THREE.AnimationClip>> = {};
    for (const clip of gltf.animations) {
      const key = clipKey(clip.name);
      if (key && !clips[key]) clips[key] = clip;
    }
    // Perfis medidos no modelo antes de escalar: a velocidade do pé escala junto com o corpo.
    const scaleProfile = (p: GaitProfile): GaitProfile => ({ ...p, footSpeed: p.footSpeed * scale });
    if (clips.walk) {
      this.walk = mixer.clipAction(clips.walk);
      this.walkProfile = scaleProfile(measureProfile(body, clips.walk, 0.9));
    }
    if (clips.run) {
      this.run = mixer.clipAction(clips.run);
      this.runProfile = scaleProfile(measureProfile(body, clips.run, 3));
    }
    for (const gait of [this.walk, this.run]) {
      if (!gait) continue;
      gait.timeScale = 0;
      gait.weight = 0;
      gait.play();
    }
    for (const pose of POSES) {
      const clip = clips[pose];
      if (!clip) continue;
      const action = mixer.clipAction(clip);
      action.weight = pose === 'idle' ? 1 : 0;
      action.play();
      this.poses[pose] = action;
    }
  }

  static fromGltf(gltf: GLTF, scale: number, y: number, matteMaterials: boolean): CrewRig {
    const body = cloneSkinned(gltf.scene);
    body.traverse((obj) => {
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (matteMaterials && obj instanceof THREE.Mesh) {
        const m = (obj.material as THREE.MeshStandardMaterial).clone();
        m.metalness = 0.05;
        m.roughness = 0.7;
        obj.material = m;
      }
    });
    const rig = new CrewRig(body, gltf, scale);
    body.position.y = y;
    body.scale.setScalar(scale);
    return rig;
  }

  static fromStatic(source: THREE.Object3D): CrewRig {
    const body = source.clone(true);
    body.traverse((obj) => {
      obj.castShadow = true;
      obj.receiveShadow = true;
    });
    return new CrewRig(body, null, 1);
  }

  /** Perfis medidos da caminhada e do passo saltado (null se o modelo não tem o clipe). */
  get walkGait(): GaitProfile | null {
    return this.walkProfile;
  }

  get runGait(): GaitProfile | null {
    return this.runProfile;
  }

  get hasWave(): boolean {
    return !!this.poses.wave;
  }

  /** Clipe dominante (verificação em desenvolvimento). */
  dominantClip(w: Walker): string {
    if (w.moveWeight > 0.5) return w.hopWeight > 0.4 && this.run ? 'run' : this.walk ? 'walk' : 'run';
    return this.currentPose;
  }

  /** Desenha o astronauta: `ground` é a altura do relevo sob ele; `pose` vale quando parado. */
  update(w: Walker, pose: PoseClip, ground: number, dt: number): void {
    this.holder.position.set(w.x, ground + w.lift, w.z);
    this.holder.rotation.set(w.pitch, w.heading, w.roll);
    if (!this.mixer) {
      const swing = Math.sin(w.phase * Math.PI * 2) * 0.55 * w.moveWeight;
      this.legs.forEach((leg, i) => (leg.rotation.x = i === 0 ? swing : -swing));
      this.arms.forEach((arm, i) => (arm.rotation.x = i === 0 ? -swing : swing));
      return;
    }
    const want: PoseClip = this.poses[pose] ? pose : 'idle';
    if (want !== this.currentPose) {
      // Pose que volta do zero recomeça do início (o aceno e o trabalho não entram pela metade).
      const action = this.poses[want];
      if (action && this.poseWeight[want] < 0.05) action.time = 0;
      this.currentPose = want;
    }
    const k = Math.min(1, dt / POSE_FADE);
    for (const p of POSES) this.poseWeight[p] += ((p === want ? 1 : 0) - this.poseWeight[p]) * k;
    const hasGait = !!(this.walk || this.run);
    const move = hasGait ? w.moveWeight : 0;
    const hop = this.run ? (this.walk ? w.hopWeight : 1) : 0;
    if (this.walk && this.walkProfile) {
      this.walk.weight = move * (1 - hop);
      this.walk.time = clipPhase(this.walkProfile, w.phase) * this.walkProfile.duration;
    }
    if (this.run && this.runProfile) {
      this.run.weight = move * hop;
      this.run.time = clipPhase(this.runProfile, w.phase) * this.runProfile.duration;
    }
    // Poses dividem o que sobra da locomoção; pose ausente no modelo empresta o peso ao `idle`.
    let lost = 0;
    for (const p of POSES) {
      const action = this.poses[p];
      if (action) action.weight = (1 - move) * this.poseWeight[p];
      else lost += this.poseWeight[p];
    }
    if (this.poses.idle) this.poses.idle.weight += (1 - move) * lost;
    this.mixer.update(dt);
  }
}
