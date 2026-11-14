// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Ponto de entrada (Earthset 4.0): carregamento, menu, escolha de modo, história, introdução, partida, pausa e fim.
// Liga motor (src/engine), cena (src/render) e interface (src/ui). Regra de jogo só no motor.
import './ui/styles.css';
import * as THREE from 'three';
import { advance, createGame, dispatch, outcomeOf, type GameAction, type GameState } from './engine/game';
import type { GreenhouseMode, Installation } from './engine/resources';
import type { TaskKind } from './engine/robot';
import { MAX_PANELS, MAX_QUEUE } from './engine/robot';
import { MATCH_HOURS } from './engine/clock';
import { isSunlit } from './engine/sun';
import { antennaWarning, weatherAt, type SpaceWeatherSample } from './engine/space-weather';
import { MODES, installationFor, isModeId, type ModeId } from './engine/modes';
import { lumaAdvice, lumaEvents, type LumaAction } from './engine/guide';
import { SUN } from './data/sun';
import { TERRAIN } from './data/terrain';
import { WEATHER } from './data/space-weather';
import { camera, loadBaseModels, loadCrewModels, renderer, resetScenePresentation, resizeRenderer, scene, setQuality, updateScene } from './render/scene';
import { goTo, setDirectorEnabled, setReducedMotion, stopFollow, updateDirector, type Shot } from './render/director';
import { cinematicRunning, freezeCinematic, skipCinematic, startCinematic, updateCinematic } from './render/cinematic';
import { applyLanguage, currentTool, greenhouseFrom, onLanguage, openPanel, renderChapters, renderEnd, renderHud, setLightMap, setTool, showToast, ui, type Tool } from './ui/hud';
import { initLuma, pushLumaEvents, relabelLuma, resetLuma, updateLuma } from './ui/luma';
import { currentScreen, loadSettings, popScreen, pushScreen, saveSettings, showScreen, type ScreenId } from './ui/screens';
import { mountHorizonPanel } from './ui/horizon-panel';
import { getLang, t } from './i18n';

/** Base inicial (equilíbrio do motor, docs/regras-recursos.md). A patente vem do modo (D-17). */
const BASE: Omit<Installation, 'rank'> = { site: 'peak', panels: 2, batteryCapacity: 1000, greenhouse: 'surplus' };
/** Velocidades da simulação (horas de jogo por segundo real). */
const SPEEDS = [1, 2, 4] as const;
/** Maior passo de tempo real por quadro: a aba em segundo plano não pula a partida. */
const MAX_FRAME_SECONDS = 0.1;
const HUD_INTERVAL_MS = 100;

let mode: ModeId = 'cadet';
let game: GameState = createGame({ installation: installationFor(mode, BASE) });
let started = false;
let paused = false;
let ended = false;
let speedIndex = 0;
let visualTime = 0;
let settings = loadSettings();

// ---------- Luz do Sol (tabela real + horizonte medido) ----------

const LIT: boolean[] = Array.from({ length: MATCH_HOURS + 1 }, (_, h) => isSunlit(SUN, h, BASE.site, TERRAIN));
setLightMap(LIT);
const sunlit = (hour: number): boolean => LIT[Math.min(MATCH_HOURS, Math.max(0, Math.floor(hour)))];
const weatherNow = (): SpaceWeatherSample => weatherAt(WEATHER, game.clock.hour);
const warningNow = (): number | null => antennaWarning(WEATHER, game.clock.hour, game.robot.antennaInstalled);

// ---------- Ações ----------

function act(action: GameAction): void {
  const result = dispatch(game, action);
  if (result.ok) {
    game = result.state;
    ui.message.textContent = '';
  } else {
    const vars: Record<string, number> = result.reason === 'queue-full' ? { max: MAX_QUEUE } : result.reason === 'panel-limit' ? { max: MAX_PANELS } : {};
    ui.message.textContent = t(`reason.${result.reason}`, vars);
  }
  renderNow(performance.now());
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-task]')) {
  button.addEventListener('click', () => {
    act({ type: 'ENQUEUE_TASK', kind: button.dataset.task as TaskKind });
    // Primeira missão: a câmera acompanha o rover saindo da garagem.
    if (game.robot.queue.length === 1) goTo('rover', performance.now());
  });
}
ui.queue.addEventListener('click', (event) => {
  const index = (event.target as HTMLElement).closest<HTMLElement>('[data-cancel]')?.dataset.cancel;
  if (index !== undefined) act({ type: 'CANCEL_TASK', index: Number(index) });
});
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-crew]')) {
  b.addEventListener('click', () => act({ type: 'SET_CREW_ORDER', order: b.dataset.crew as 'auto' | 'shelter' }));
}
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-gh]')) {
  b.addEventListener('click', () => {
    const value: GreenhouseMode | null = greenhouseFrom(b);
    if (value) act({ type: 'SET_GREENHOUSE', mode: value });
  });
}
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-cam]')) {
  b.addEventListener('click', () => goTo(b.dataset.cam as Shot, performance.now()));
}
const speedBtn = document.getElementById('speed-btn') as HTMLButtonElement;
speedBtn.addEventListener('click', () => {
  speedIndex = (speedIndex + 1) % SPEEDS.length;
  speedBtn.textContent = `${SPEEDS[speedIndex]}×`;
});

/** Atalho da LUMA: abre o sistema e enquadra a área ligada a ele. */
const ACTION_TOOL: Record<LumaAction, Tool> = { rover: 'rover', energy: 'energy', greenhouse: 'greenhouse', crew: 'crew', science: 'science' };
const ACTION_SHOT: Partial<Record<LumaAction, Shot>> = { energy: 'energy', crew: 'crew' };
initLuma((action) => {
  openPanel(ACTION_TOOL[action]);
  const shot = ACTION_SHOT[action];
  if (shot) goTo(shot, performance.now());
  if (action === 'rover') {
    for (const card of document.querySelectorAll<HTMLElement>('.mission-card')) {
      card.classList.toggle('hl', card.dataset.mission === (game.vitals.water < 45 ? 'ice' : game.installation.panels < 4 ? 'panel' : 'antenna'));
    }
  }
});

// ---------- HUD e LUMA ----------

let hudDueAt = 0;
function renderNow(now: number): void {
  const weather = weatherNow();
  const warning = warningNow();
  renderHud(game, { weather, warningHours: warning, lit: sunlit(game.clock.hour), mode: MODES[mode], explanations: settings.explanations || MODES[mode].explanations });
  if (started) updateLuma(lumaAdvice(game, warning, MODES[mode].luma), game.clock.hour, now);
}

onLanguage(() => {
  relabelLuma();
  renderChapters(document.getElementById('story-chapters') as HTMLElement, null);
  speedBtn.title = t('hud.speed');
});

// ---------- Ciência (painel polar) ----------

const updateHorizon = mountHorizonPanel(document.getElementById('horizon-panel') as HTMLElement, SUN, TERRAIN, BASE.site);
const updateScienceHorizon = mountHorizonPanel(document.getElementById('science-horizon') as HTMLElement, SUN, TERRAIN, BASE.site);

// ---------- Telas ----------

for (const b of document.querySelectorAll<HTMLButtonElement>('[data-go]')) {
  b.addEventListener('click', () => pushScreen(b.dataset.go as ScreenId));
}
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-open]')) {
  b.addEventListener('click', () => pushScreen(b.dataset.open as ScreenId));
}
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-back]')) {
  b.addEventListener('click', () => popScreen());
}
for (const card of document.querySelectorAll<HTMLButtonElement>('[data-mode]')) {
  card.addEventListener('click', () => {
    const id = card.dataset.mode;
    if (!isModeId(id)) return;
    mode = id;
    renderChapters(document.getElementById('story-chapters') as HTMLElement, null);
    pushScreen('story');
  });
}
document.getElementById('story-go')?.addEventListener('click', () => newMission(settings.intro));

// Configurações.
const setIntro = document.getElementById('set-intro') as HTMLInputElement;
const setMotion = document.getElementById('set-motion') as HTMLInputElement;
const setExplain = document.getElementById('set-explain') as HTMLInputElement;
const setQualityBox = document.getElementById('set-quality') as HTMLInputElement;
function applySettings(): void {
  setIntro.checked = settings.intro;
  setMotion.checked = settings.reducedMotion;
  setExplain.checked = settings.explanations;
  setQualityBox.checked = settings.quality;
  setReducedMotion(settings.reducedMotion);
  setQuality(settings.quality);
}
for (const box of [setIntro, setMotion, setExplain, setQualityBox]) {
  box.addEventListener('change', () => {
    settings = { intro: setIntro.checked, reducedMotion: setMotion.checked, explanations: setExplain.checked, quality: setQualityBox.checked };
    saveSettings(settings);
    applySettings();
    renderNow(performance.now());
  });
}
applySettings();

// ---------- Fluxo da missão ----------

const cine = document.getElementById('cine') as HTMLElement;
const cineCaption = document.getElementById('cine-caption') as HTMLElement;
const cineLuma = document.getElementById('cine-luma') as HTMLElement;
const cineLumaText = document.getElementById('cine-luma-text') as HTMLElement;

function resetGame(): void {
  game = createGame({ installation: installationFor(mode, BASE) });
  visualTime = 0;
  ended = false;
  paused = false;
  resetScenePresentation();
  resetLuma();
  setTool(null);
  if (currentTool()) setTool(null);
  ui.message.textContent = '';
}

/** Nova missão: zera a partida e, se configurado, toca a introdução antes. */
function newMission(withIntro: boolean): void {
  resetGame();
  showScreen(null);
  ui.hud.hidden = true;
  if (withIntro) {
    cine.hidden = false;
    cine.classList.remove('out');
    setDirectorEnabled(false);
    startCinematic(performance.now(), {
      caption(key, big) {
        cineCaption.classList.toggle('show', key !== null);
        cineCaption.classList.toggle('big', !!big);
        if (key) cineCaption.textContent = t(key);
      },
      luma(key) {
        cineLuma.hidden = key === null;
        if (key) cineLumaText.textContent = t(key);
      },
      end: beginPlay,
    }, settings.reducedMotion);
  } else {
    beginPlay();
  }
}

/** Começa a simulação: o HUD entra e o jogador recebe o primeiro objetivo. */
function beginPlay(): void {
  cine.classList.add('out');
  window.setTimeout(() => (cine.hidden = true), 700);
  setDirectorEnabled(true);
  goTo('overview', performance.now(), 1.2);
  ui.hud.hidden = false;
  started = true;
  showToast(t('toast.chapter', { n: 1 }), t('chapter.1'));
  renderNow(performance.now());
  if (MODES[mode].luma === 'full') openPanel('rover');
}

document.getElementById('cine-skip')?.addEventListener('click', () => skipCinematic());

function backToMenu(): void {
  if (cinematicRunning()) skipCinematic();
  started = false;
  resetGame();
  ui.hud.hidden = true;
  setDirectorEnabled(true);
  stopFollow();
  showScreen('menu');
  goTo('showcase', performance.now(), 1.6);
}

function setPaused(on: boolean): void {
  if (!started || ended) return;
  paused = on;
  if (on) pushScreen('pause');
  else showScreen(null);
}
document.getElementById('pause-btn')?.addEventListener('click', () => setPaused(true));
document.getElementById('resume')?.addEventListener('click', () => setPaused(false));
document.getElementById('to-menu')?.addEventListener('click', backToMenu);
document.getElementById('end-menu')?.addEventListener('click', backToMenu);
document.getElementById('restart')?.addEventListener('click', () => newMission(false));
window.addEventListener('keydown', (event) => {
  if (event.key !== 'Escape') return;
  if (cinematicRunning()) {
    skipCinematic();
    return;
  }
  const screen = currentScreen();
  if (started && !ended && screen === null) setPaused(true);
  else if (started && !ended && screen === 'pause') setPaused(false);
  else if (screen && screen !== 'menu' && screen !== 'loading' && screen !== 'end') popScreen();
});

// ---------- Laço ----------

let last: number | null = null;
let radiationBefore = false;
let shadowTick = 0;
let lastFrameAt = 0;

function frame(now: number): void {
  perfTick(now);
  const screen = currentScreen();
  const active = started && !paused && !ended && screen === null && outcomeOf(game) === 'playing';
  if (active && last !== null) {
    const seconds = Math.min(Math.max(0, (now - last) / 1000), MAX_FRAME_SECONDS);
    const weather = weatherNow();
    const prev = game;
    game = advance(game, seconds * SPEEDS[speedIndex], sunlit(game.clock.hour), weather);
    const radiationNow = weatherNow().radiation;
    const events = lumaEvents(prev, game, radiationBefore, radiationNow);
    radiationBefore = radiationNow;
    if (events.length) {
      pushLumaEvents(events, game.clock.hour, now);
      const chapter = events.find((e) => e.id.startsWith('chapter-'));
      if (chapter) showToast(t('toast.chapter', { n: chapter.vars.n }), t(`chapter.${chapter.vars.n}`));
      if (currentTool() === 'missions') renderNow(now);
    }
    visualTime += seconds * 1000;
  }
  last = now;
  // A cena anda no relógio visual (parado na pausa); no menu e na introdução, no relógio real.
  const sceneTime = started ? visualTime : now;
  updateScene(game, sceneTime, sunlit(game.clock.hour), weatherNow(), started ? active : true);
  if (cinematicRunning()) updateCinematic(now);
  else updateDirector(now);
  if (now >= hudDueAt) {
    if (started) renderNow(now);
    updateHorizon(game.clock.hour);
    if (screen === 'science') updateScienceHorizon(game.clock.hour);
    hudDueAt = now + HUD_INTERVAL_MS;
  }
  if (started && !ended && outcomeOf(game) !== 'playing') {
    ended = true;
    renderEnd(game, MODES[mode]);
    setTool(null);
    showScreen('end');
  }
  // Sombras em quadros alternados; a cada quadro quando o jogo já está lento (abaixo de ~30 fps).
  renderer.shadowMap.needsUpdate = (shadowTick++ & 1) === 0 || now - lastFrameAt > -1;
  lastFrameAt = now;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => resizeRenderer());

// ---------- Carregamento ----------

const loadFill = document.getElementById('load-fill') as HTMLElement;
const loadText = document.getElementById('load-text') as HTMLElement;
THREE.DefaultLoadingManager.onProgress = (_url, loaded, total) => {
  loadFill.style.width = `${Math.max(4, Math.round((loaded / Math.max(1, total)) * 100))}%`;
  loadText.textContent = t('load.models');
};

let menuShown = false;
function showMenu(): void {
  if (menuShown) return;
  menuShown = true;
  document.body.classList.remove('state-loading');
  loadFill.style.width = '100%';
  showScreen('menu');
  goTo('showcase', performance.now(), 0);
  maybeAutostart();
}
showScreen('loading');
ui.hud.hidden = true;
renderChapters(document.getElementById('story-chapters') as HTMLElement, null);
const models = Promise.allSettled([loadBaseModels(), loadCrewModels()]);
// Pré-compila os shaders com a cena montada (evita travadas na primeira aparição de cada material).
models.then(() => {
  renderer.compile(scene, camera);
  showMenu();
});
// Se algum arquivo demorar, o menu abre assim mesmo (os modelos entram quando chegarem).
window.setTimeout(showMenu, 9000);

// ---------- Diagnóstico ----------

// ?perf=1 mostra FPS e carga de desenho (para medir em qualquer máquina).
const perfEl = new URLSearchParams(window.location.search).has('perf') ? document.createElement('div') : null;
if (perfEl) {
  perfEl.id = 'perf';
  document.body.appendChild(perfEl);
}
let perfFrames = 0;
let perfSince = 0;
let perfMin = Infinity;
let perfMax = 0;
function perfTick(now: number): void {
  if (!perfEl) return;
  perfFrames++;
  perfMin = Math.min(perfMin, renderer.info.render.calls);
  perfMax = Math.max(perfMax, renderer.info.render.calls);
  if (perfSince === 0) perfSince = now;
  if (now - perfSince >= 1000) {
    const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
    perfEl.textContent = `${Math.round((perfFrames * 1000) / (now - perfSince))} fps · ${perfMin}-${perfMax} draws · ${renderer.info.render.triangles} tris${mem ? ` · ${Math.round(mem.usedJSHeapSize / 1048576)} MB` : ''}`;
    perfFrames = 0;
    perfMin = Infinity;
    perfMax = 0;
    perfSince = now;
  }
}

/**
 * Atalhos de captura, só no servidor de desenvolvimento (não entram no build):
 * ?autostart=cadet&nointro&hour=30&task=ice&after=3&tool=rover&shot=rover&lang=pt&cineAt=9&screen=modes
 */
function maybeAutostart(): void {
  if (!import.meta.env.DEV) return;
  const q = new URLSearchParams(window.location.search);
  if (q.get('lang') === 'pt' || q.get('lang') === 'en') applyLanguage(q.get('lang') as 'pt' | 'en');
  const screen = q.get('screen');
  if (screen) pushScreen(screen as ScreenId);
  const auto = q.get('autostart');
  if (!isModeId(auto)) return;
  mode = auto;
  const cineAt = q.get('cineAt');
  if (cineAt !== null) {
    newMission(true);
    freezeCinematic(Number(cineAt));
    startCinematic(performance.now() - Number(cineAt) * 1000, {
      caption(key, big) {
        cineCaption.classList.toggle('show', key !== null);
        cineCaption.classList.toggle('big', !!big);
        if (key) cineCaption.textContent = t(key);
      },
      luma(key) {
        cineLuma.hidden = key === null;
        if (key) cineLumaText.textContent = t(key);
      },
      end: beginPlay,
    }, false);
    return;
  }
  newMission(false);
  const step = (hours: number) => {
    for (let h = 0; h < hours; h += 0.25) {
      const prev = game;
      game = advance(game, 0.25, sunlit(game.clock.hour), weatherNow());
      pushLumaEvents(lumaEvents(prev, game), game.clock.hour, performance.now());
    }
  };
  step(Number(q.get('hour') ?? 0));
  for (const kind of (q.get('task') ?? '').split(',').filter(Boolean)) act({ type: 'ENQUEUE_TASK', kind: kind as TaskKind });
  step(Number(q.get('after') ?? 0));
  const tool = q.get('tool');
  if (tool) openPanel(tool as Tool);
  const shot = q.get('shot');
  if (shot) goTo(shot as Shot, performance.now(), 0);
  if (q.has('pause')) setPaused(true);
  renderNow(performance.now());
  void getLang;
}

requestAnimationFrame(frame);
