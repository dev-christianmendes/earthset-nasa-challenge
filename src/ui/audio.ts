// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Áudio artístico pelo traje, rádio e condução; a Lua não transmite som ambiente (docs/data-sources.md).
// O contexto de áudio só nasce depois de um gesto do jogador (regra de reprodução automática dos navegadores).

export type Cue =
  | 'select'
  | 'confirm'
  | 'error'
  | 'alert'
  | 'complete'
  | 'step'
  | 'panel-installed'
  | 'antenna-online'
  | 'ice-delivered'
  | 'harvest'
  | 'maintained'
  | 'inspected'
  | 'calibrated'
  | 'tuned'
  | 'alert-power'
  | 'alert-water'
  | 'alert-air'
  | 'alert-food'
  | 'heart-lost';
export type Loop = 'rover' | 'drill' | 'servo' | 'arc' | 'fan' | 'pump' | 'heater' | 'fill';

const MUTE_KEY = 'earthset-sound';
const VOLUME_KEY = 'earthset-volume';
const MASTER = 0.35;
const LOOP_LEVEL: Record<Loop, number> = { rover: 0.06, drill: 0.05, servo: 0.05, arc: 0.04, fan: 0.025, pump: 0.035, heater: 0.05, fill: 0.05 };

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noiseBuffer: AudioBuffer | null = null;
let muted = readMuted();
let volume = readVolume();
const loops: Partial<Record<Loop, { gain: GainNode; stop: () => void }>> = {};

function readMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === 'off';
  } catch {
    return false;
  }
}

function readVolume(): number {
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    const v = raw === null ? 1 : Number(raw);
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 1;
  } catch {
    return 1;
  }
}

const masterLevel = (): number => (muted ? 0 : MASTER * volume);

export function initAudio(): void {
  const unlock = () => {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = masterLevel();
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
  };
  for (const ev of ['pointerdown', 'keydown', 'touchstart']) window.addEventListener(ev, unlock, { passive: true });
}

export function isMuted(): boolean {
  return muted;
}

export function setMuted(on: boolean): void {
  muted = on;
  try {
    localStorage.setItem(MUTE_KEY, on ? 'off' : 'on');
  } catch {
  }
  if (ctx && master) master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 0.05);
}

export function getVolume(): number {
  return volume;
}

/** Volume geral de 0 a 1 (SND-02). Salvo no navegador; 0 não liga o silêncio, só abaixa. */
export function setVolume(v: number): void {
  volume = Math.min(1, Math.max(0, Number.isFinite(v) ? v : 1));
  try {
    localStorage.setItem(VOLUME_KEY, String(volume));
  } catch {
  }
  if (ctx && master) master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 0.05);
}

function tone(freq: number, start: number, dur: number, type: OscillatorType, level: number, glideTo?: number): void {
  if (!ctx || !master) return;
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, start);
  if (glideTo) osc.frequency.exponentialRampToValueAtTime(glideTo, start + dur);
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(level, start + 0.012);
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  osc.connect(env).connect(master);
  osc.start(start);
  osc.stop(start + dur + 0.02);
}

function getNoise(c: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

function burst(start: number, dur: number, level: number, type: BiquadFilterType, freq: number, q = 1, sweepTo?: number): void {
  if (!ctx || !master) return;
  const src = ctx.createBufferSource();
  src.buffer = getNoise(ctx);
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(freq, start);
  if (sweepTo) filter.frequency.exponentialRampToValueAtTime(sweepTo, start + dur);
  filter.Q.value = q;
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, start);
  env.gain.exponentialRampToValueAtTime(level, start + 0.006);
  env.gain.exponentialRampToValueAtTime(0.0001, start + dur);
  src.connect(filter).connect(env).connect(master);
  src.start(start, Math.random() * 0.5);
  src.stop(start + dur + 0.02);
}

/** Toca um sinal. Sem contexto (antes do primeiro gesto) ou mudo, não faz nada. `gain` de 0 a 1 só para passos. */
export function play(cue: Cue, gain = 1): void {
  if (!ctx || muted || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  switch (cue) {
    case 'select':
      tone(1400, t, 0.05, 'square', 0.05);
      break;
    case 'confirm':
      tone(880, t, 0.09, 'sine', 0.18);
      tone(1320, t + 0.1, 0.12, 'sine', 0.18);
      break;
    case 'error':
      tone(320, t, 0.22, 'triangle', 0.2, 200);
      break;
    case 'alert':
      for (let i = 0; i < 3; i++) tone(980, t + i * 0.22, 0.14, 'square', 0.09);
      break;
    case 'complete':
      tone(660, t, 0.16, 'sine', 0.14);
      tone(880, t + 0.08, 0.18, 'sine', 0.14);
      tone(1175, t + 0.16, 0.26, 'sine', 0.14);
      break;
    case 'step':
      tone(95, t, 0.09, 'sine', 0.12 * gain, 55);
      burst(t, 0.045, 0.06 * gain, 'lowpass', 520, 0.7);
      break;
    case 'panel-installed':
      burst(t, 0.035, 0.12, 'bandpass', 2600, 4);
      tone(130, t, 0.14, 'sine', 0.16, 85);
      tone(523, t + 0.12, 0.16, 'sine', 0.13);
      tone(784, t + 0.24, 0.3, 'sine', 0.13);
      break;
    case 'antenna-online':
      [1400, 1800, 2200, 1600, 2000, 2400].forEach((f, i) => tone(f, t + i * 0.06, 0.05, 'square', 0.05));
      tone(1760, t + 0.42, 0.34, 'sine', 0.14);
      break;
    case 'ice-delivered':
      [0, 0.09, 0.19].forEach((d, i) => burst(t + d, 0.1, 0.07, 'bandpass', 600 + i * 220, 5, 1100 + i * 250));
      tone(587, t + 0.3, 0.2, 'sine', 0.12);
      tone(880, t + 0.4, 0.28, 'sine', 0.12);
      break;
    case 'harvest':
      tone(520, t, 0.08, 'sine', 0.14, 260);
      burst(t, 0.03, 0.08, 'highpass', 3000);
      tone(880, t + 0.1, 0.22, 'triangle', 0.1);
      break;
    case 'maintained':
      [1800, 1250, 2100].forEach((f, i) => {
        tone(f, t + i * 0.11, 0.05, 'square', 0.06);
        burst(t + i * 0.11, 0.03, 0.06, 'bandpass', f, 6);
      });
      break;
    case 'inspected':
      [1000, 1200, 1500].forEach((f, i) => tone(f, t + i * 0.12, 0.08, 'sine', 0.11));
      break;
    case 'calibrated':
      tone(300, t, 0.5, 'triangle', 0.1, 900);
      tone(1100, t + 0.45, 0.25, 'sine', 0.11);
      break;
    case 'tuned':
      [660, 880, 1100].forEach((f, i) => tone(f, t + i * 0.08, 0.16, 'sine', 0.1));
      tone(1760, t + 0.26, 0.3, 'sine', 0.07);
      break;
    case 'alert-power':
      for (let i = 0; i < 2; i++) {
        tone(880, t + i * 0.34, 0.14, 'square', 0.07, 700);
        tone(660, t + i * 0.34 + 0.15, 0.16, 'square', 0.07, 520);
      }
      break;
    case 'alert-water':
      for (let i = 0; i < 3; i++) tone(900, t + i * 0.14, 0.12, 'sine', 0.12, 400);
      break;
    case 'alert-air':
      for (let i = 0; i < 5; i++) tone(1100, t + i * 0.1, 0.06, 'square', 0.06);
      break;
    case 'alert-food':
      for (let i = 0; i < 3; i++) tone(330, t + i * 0.2, 0.15, 'triangle', 0.14);
      break;
    case 'heart-lost':
      tone(90, t, 0.25, 'sine', 0.22, 45);
      tone(466, t + 0.05, 0.22, 'triangle', 0.12, 392);
      tone(392, t + 0.28, 0.4, 'triangle', 0.12, 330);
      break;
  }
}

function lfo(c: AudioContext, rate: number, depth: number, target: AudioParam, type: OscillatorType = 'sine'): OscillatorNode {
  const osc = c.createOscillator();
  osc.type = type;
  osc.frequency.value = rate;
  const amount = c.createGain();
  amount.gain.value = depth;
  osc.connect(amount).connect(target);
  osc.start();
  return osc;
}

/** Sons contínuos: criados uma vez, ligados e desligados pelo volume. */
function ensureLoop(kind: Loop): { gain: GainNode; stop: () => void } | null {
  if (!ctx || !master) return null;
  const existing = loops[kind];
  if (existing) return existing;
  const c = ctx;
  const gain = c.createGain();
  gain.gain.value = 0;
  gain.connect(master);
  const stops: Array<() => void> = [];
  const noise = (): AudioBufferSourceNode => {
    const src = c.createBufferSource();
    src.buffer = getNoise(c);
    src.loop = true;
    src.start();
    stops.push(() => src.stop());
    return src;
  };
  const osc = (type: OscillatorType, freq: number): OscillatorNode => {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.start();
    stops.push(() => o.stop());
    return o;
  };
  const filter = (type: BiquadFilterType, freq: number, q = 1): BiquadFilterNode => {
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    return f;
  };
  switch (kind) {
    case 'rover':
      osc('sawtooth', 62).connect(filter('lowpass', 260)).connect(gain);
      break;
    case 'drill': {
      const f = filter('bandpass', 520, 3);
      noise().connect(f).connect(gain);
      { const l = lfo(c, 17, 90, f.frequency); stops.push(() => l.stop()); }
      break;
    }
    case 'servo': {
      const o = osc('sawtooth', 190);
      o.connect(filter('lowpass', 900)).connect(gain);
      { const l = lfo(c, 5, 22, o.frequency); stops.push(() => l.stop()); }
      break;
    }
    case 'arc': {
      const am = c.createGain();
      am.gain.value = 0.5;
      noise().connect(filter('highpass', 2600)).connect(am).connect(gain);
      { const l = lfo(c, 13, 0.5, am.gain, 'square'); stops.push(() => l.stop()); }
      break;
    }
    case 'fan': {
      const a = osc('sawtooth', 48);
      const b = osc('sine', 49.7);
      const lp = filter('lowpass', 190);
      a.connect(lp);
      b.connect(lp);
      lp.connect(gain);
      break;
    }
    case 'pump': {
      const am = c.createGain();
      am.gain.value = 0.6;
      noise().connect(filter('lowpass', 650)).connect(am).connect(gain);
      { const l = lfo(c, 1.8, 0.35, am.gain); stops.push(() => l.stop()); }
      break;
    }
    case 'heater': {
      osc('sine', 72).connect(gain);
      const hiss = c.createGain();
      hiss.gain.value = 0.25;
      noise().connect(filter('highpass', 3200)).connect(hiss).connect(gain);
      break;
    }
    case 'fill': {
      const f = filter('bandpass', 800, 6);
      noise().connect(f).connect(gain);
      { const l = lfo(c, 6, 320, f.frequency); stops.push(() => l.stop()); }
      break;
    }
  }
  loops[kind] = { gain, stop: () => stops.forEach((s) => s()) };
  return loops[kind]!;
}

export function setLoop(kind: Loop, on: boolean): void {
  if (!ctx || ctx.state !== 'running') return;
  if (!on && !loops[kind]) return;
  const loop = ensureLoop(kind);
  if (!loop) return;
  const level = on && !muted ? LOOP_LEVEL[kind] : 0;
  loop.gain.gain.setTargetAtTime(level, ctx.currentTime, 0.15);
}
