// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Sons de retorno ao jogador, sintetizados no navegador (Web Audio): nenhum arquivo de áudio, nada de terceiros.
// Fidelidade: no vácuo lunar o som não viaja pelo ambiente. Os sinais aqui são estilizados e representam o que um
// astronauta ouviria pelo rádio e pelo traje (bipes de confirmação, alarme) ou por condução na estrutura (motor, broca).
// Não são gravação nem simulação de som externo. O texto da tela diz isso (botão de som).
// O contexto de áudio só nasce depois de um gesto do jogador (regra de reprodução automática dos navegadores).

export type Cue = 'select' | 'confirm' | 'error' | 'alert' | 'complete';
export type Loop = 'rover' | 'drill';

const STORAGE_KEY = 'earthset-sound';
const MASTER = 0.35;

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = readMuted();
const loops: Partial<Record<Loop, { gain: GainNode; stop: () => void }>> = {};

function readMuted(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'off';
  } catch {
    return false;
  }
}

/** Liga o áudio no primeiro gesto (clique, toque ou tecla). Chamado uma vez na carga. */
export function initAudio(): void {
  const unlock = () => {
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return;
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : MASTER;
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
    localStorage.setItem(STORAGE_KEY, on ? 'off' : 'on');
  } catch {
    // sem armazenamento: vale só nesta página
  }
  if (ctx && master) master.gain.setTargetAtTime(on ? 0 : MASTER, ctx.currentTime, 0.05);
}

/** Um tom curto com envelope (ataque rápido, queda exponencial). */
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

/** Toca um sinal. Sem contexto (antes do primeiro gesto) ou mudo, não faz nada. */
export function play(cue: Cue): void {
  if (!ctx || muted || ctx.state !== 'running') return;
  const t = ctx.currentTime;
  switch (cue) {
    case 'select': // clique de rádio
      tone(1400, t, 0.05, 'square', 0.05);
      break;
    case 'confirm': // dois bipes ascendentes: "ordem recebida"
      tone(880, t, 0.09, 'sine', 0.18);
      tone(1320, t + 0.1, 0.12, 'sine', 0.18);
      break;
    case 'error': // tom grave descendente
      tone(320, t, 0.22, 'triangle', 0.2, 200);
      break;
    case 'alert': // alarme do traje: três pulsos
      for (let i = 0; i < 3; i++) tone(980, t + i * 0.22, 0.14, 'square', 0.09);
      break;
    case 'complete': // acorde curto ascendente
      tone(660, t, 0.16, 'sine', 0.14);
      tone(880, t + 0.08, 0.18, 'sine', 0.14);
      tone(1175, t + 0.16, 0.26, 'sine', 0.14);
      break;
  }
}

function makeNoise(c: AudioContext): AudioBufferSourceNode {
  const buffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = c.createBufferSource();
  src.buffer = buffer;
  src.loop = true;
  return src;
}

/** Sons contínuos (motor do rover, broca): criados uma vez, ligados e desligados pelo volume. */
function ensureLoop(kind: Loop): { gain: GainNode; stop: () => void } | null {
  if (!ctx || !master) return null;
  const existing = loops[kind];
  if (existing) return existing;
  const gain = ctx.createGain();
  gain.gain.value = 0;
  gain.connect(master);
  let stop: () => void;
  if (kind === 'rover') {
    // Zumbido grave de motor elétrico, filtrado (estilizado: chegaria por rádio/telemetria, não pelo ar).
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 62;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 260;
    osc.connect(lp).connect(gain);
    osc.start();
    stop = () => osc.stop();
  } else {
    // Broca: ruído em banda estreita com leve vibração.
    const noise = makeNoise(ctx);
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 520;
    bp.Q.value = 3;
    noise.connect(bp).connect(gain);
    noise.start();
    stop = () => noise.stop();
  }
  loops[kind] = { gain, stop };
  return loops[kind]!;
}

/** Liga ou desliga um som contínuo (chamado por quadro; só muda o volume, suavemente). */
export function setLoop(kind: Loop, on: boolean): void {
  if (!ctx || ctx.state !== 'running') return;
  if (!on && !loops[kind]) return;
  const loop = ensureLoop(kind);
  if (!loop) return;
  const level = on && !muted ? (kind === 'rover' ? 0.06 : 0.05) : 0;
  loop.gain.gain.setTargetAtTime(level, ctx.currentTime, 0.15);
}
