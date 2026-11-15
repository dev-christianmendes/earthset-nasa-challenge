// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Sons de retorno ao jogador, sintetizados no navegador (Web Audio): nenhum arquivo de áudio, nada de terceiros,
// logo nada a licenciar (registro em docs/data-sources.md, seção de sons).
// Fidelidade: no vácuo lunar o som não viaja pelo ambiente. Os sinais aqui são estilizados e representam o que um
// astronauta ouviria pelo rádio e pelo interior do traje (bipes, alarmes, passos) ou por condução na estrutura e nas
// máquinas (motor, broca, ventiladores, bombas). Não são gravação nem simulação de som externo.
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
/** Sons contínuos: motor, broca, servo do painel, arco da antena, ventilador, bomba, aquecedor e enchimento. */
export type Loop = 'rover' | 'drill' | 'servo' | 'arc' | 'fan' | 'pump' | 'heater' | 'fill';

const MUTE_KEY = 'earthset-sound';
const VOLUME_KEY = 'earthset-volume';
const MASTER = 0.35;
/** Volume de cada som contínuo (antes do volume geral). */
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

/** Liga o áudio no primeiro gesto (clique, toque ou tecla). Chamado uma vez na carga. */
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
    // sem armazenamento: vale só nesta página
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
    // sem armazenamento: vale só nesta página
  }
  if (ctx && master) master.gain.setTargetAtTime(masterLevel(), ctx.currentTime, 0.05);
}

// ---------- Blocos de síntese ----------

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

/** Ruído branco de 1 s, criado uma vez e reaproveitado por todos os sons. */
function getNoise(c: AudioContext): AudioBuffer {
  if (!noiseBuffer) {
    noiseBuffer = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const data = noiseBuffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return noiseBuffer;
}

/** Estalo de ruído filtrado (clique, batida, respingo). */
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
    case 'step': // passo no traje: batida grave e abafada
      tone(95, t, 0.09, 'sine', 0.12 * gain, 55);
      burst(t, 0.045, 0.06 * gain, 'lowpass', 520, 0.7);
      break;
    case 'panel-installed': // trava mecânica e dois acordes
      burst(t, 0.035, 0.12, 'bandpass', 2600, 4);
      tone(130, t, 0.14, 'sine', 0.16, 85);
      tone(523, t + 0.12, 0.16, 'sine', 0.13);
      tone(784, t + 0.24, 0.3, 'sine', 0.13);
      break;
    case 'antenna-online': // sequência de dados e travamento do enlace
      [1400, 1800, 2200, 1600, 2000, 2400].forEach((f, i) => tone(f, t + i * 0.06, 0.05, 'square', 0.05));
      tone(1760, t + 0.42, 0.34, 'sine', 0.14);
      break;
    case 'ice-delivered': // respingo de água e aviso suave
      [0, 0.09, 0.19].forEach((d, i) => burst(t + d, 0.1, 0.07, 'bandpass', 600 + i * 220, 5, 1100 + i * 250));
      tone(587, t + 0.3, 0.2, 'sine', 0.12);
      tone(880, t + 0.4, 0.28, 'sine', 0.12);
      break;
    case 'harvest': // colheita: estalo de talo e chime
      tone(520, t, 0.08, 'sine', 0.14, 260);
      burst(t, 0.03, 0.08, 'highpass', 3000);
      tone(880, t + 0.1, 0.22, 'triangle', 0.1);
      break;
    case 'maintained': // chave de manutenção: três batidas metálicas
      [1800, 1250, 2100].forEach((f, i) => {
        tone(f, t + i * 0.11, 0.05, 'square', 0.06);
        burst(t + i * 0.11, 0.03, 0.06, 'bandpass', f, 6);
      });
      break;
    case 'inspected': // varredura do scanner
      [1000, 1200, 1500].forEach((f, i) => tone(f, t + i * 0.12, 0.08, 'sine', 0.11));
      break;
    case 'calibrated': // aceleração de painéis calibrados
      tone(300, t, 0.5, 'triangle', 0.1, 900);
      tone(1100, t + 0.45, 0.25, 'sine', 0.11);
      break;
    case 'tuned': // antena ajustada: arpejo e brilho
      [660, 880, 1100].forEach((f, i) => tone(f, t + i * 0.08, 0.16, 'sine', 0.1));
      tone(1760, t + 0.26, 0.3, 'sine', 0.07);
      break;
    case 'alert-power': // energia baixa: dois tons descendo, repetidos
      for (let i = 0; i < 2; i++) {
        tone(880, t + i * 0.34, 0.14, 'square', 0.07, 700);
        tone(660, t + i * 0.34 + 0.15, 0.16, 'square', 0.07, 520);
      }
      break;
    case 'alert-water': // água baixa: três gotas caindo
      for (let i = 0; i < 3; i++) tone(900, t + i * 0.14, 0.12, 'sine', 0.12, 400);
      break;
    case 'alert-air': // ar baixo: pulsos rápidos e agudos
      for (let i = 0; i < 5; i++) tone(1100, t + i * 0.1, 0.06, 'square', 0.06);
      break;
    case 'alert-food': // comida baixa: três pulsos graves
      for (let i = 0; i < 3; i++) tone(330, t + i * 0.2, 0.15, 'triangle', 0.14);
      break;
    case 'heart-lost': // perda: batida grave e terça menor descendo
      tone(90, t, 0.25, 'sine', 0.22, 45);
      tone(466, t + 0.05, 0.22, 'triangle', 0.12, 392);
      tone(392, t + 0.28, 0.4, 'triangle', 0.12, 330);
      break;
  }
}

/** Oscilador de baixa frequência que modula um parâmetro (vibração, estalo, borbulho). */
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
    case 'rover': // zumbido de motor elétrico, filtrado
      osc('sawtooth', 62).connect(filter('lowpass', 260)).connect(gain);
      break;
    case 'drill': { // broca: ruído em banda estreita com trepidação
      const f = filter('bandpass', 520, 3);
      noise().connect(f).connect(gain);
      { const l = lfo(c, 17, 90, f.frequency); stops.push(() => l.stop()); }
      break;
    }
    case 'servo': { // servo do painel: lamento que oscila
      const o = osc('sawtooth', 190);
      o.connect(filter('lowpass', 900)).connect(gain);
      { const l = lfo(c, 5, 22, o.frequency); stops.push(() => l.stop()); }
      break;
    }
    case 'arc': { // arco da antena: estalos em alta frequência
      const am = c.createGain();
      am.gain.value = 0.5;
      noise().connect(filter('highpass', 2600)).connect(am).connect(gain);
      { const l = lfo(c, 13, 0.5, am.gain, 'square'); stops.push(() => l.stop()); }
      break;
    }
    case 'fan': { // ventilador da estufa: dois tons graves em batimento
      const a = osc('sawtooth', 48);
      const b = osc('sine', 49.7);
      const lp = filter('lowpass', 190);
      a.connect(lp);
      b.connect(lp);
      lp.connect(gain);
      break;
    }
    case 'pump': { // bomba de irrigação: fio d'água
      const am = c.createGain();
      am.gain.value = 0.6;
      noise().connect(filter('lowpass', 650)).connect(am).connect(gain);
      { const l = lfo(c, 1.8, 0.35, am.gain); stops.push(() => l.stop()); }
      break;
    }
    case 'heater': { // aquecimento do processador: zumbido com chiado
      osc('sine', 72).connect(gain);
      const hiss = c.createGain();
      hiss.gain.value = 0.25;
      noise().connect(filter('highpass', 3200)).connect(hiss).connect(gain);
      break;
    }
    case 'fill': { // enchimento do tanque: borbulho
      const f = filter('bandpass', 800, 6);
      noise().connect(f).connect(gain);
      { const l = lfo(c, 6, 320, f.frequency); stops.push(() => l.stop()); }
      break;
    }
  }
  loops[kind] = { gain, stop: () => stops.forEach((s) => s()) };
  return loops[kind]!;
}

/** Liga ou desliga um som contínuo (chamado por quadro; só muda o volume, suavemente). */
export function setLoop(kind: Loop, on: boolean): void {
  if (!ctx || ctx.state !== 'running') return;
  if (!on && !loops[kind]) return;
  const loop = ensureLoop(kind);
  if (!loop) return;
  const level = on && !muted ? LOOP_LEVEL[kind] : 0;
  loop.gain.gain.setTargetAtTime(level, ctx.currentTime, 0.15);
}
