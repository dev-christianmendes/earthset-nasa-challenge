// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import './ui/styles.css';
import * as THREE from 'three';
import { ACTION_HOURS, advance, createGame, dispatch, outcomeOf, type GameAction, type GameState } from './engine/game';
import type { GreenhouseMode, Installation } from './engine/resources';
import type { TaskKind } from './engine/robot';
import { ICE_HELP_HOURS, ICE_WATER_PER_TRIP, TASK_HOURS } from './engine/robot';
import { createClock, MATCH_HOURS } from './engine/clock';
import { isSunlit } from './engine/sun';
import { radiationHoursLeft, weatherAt, type SpaceWeatherSample } from './engine/space-weather';
import { forecastWater, forecastWithAction, type WaterForecast } from './engine/forecast';
import { alertAt, type AlertView } from './engine/alert';
import { crewSheltered } from './engine/crew';
import { SPACE_EVENTS } from './data/space-weather-events';
import { MODES, installationFor, isModeId, type ModeId } from './engine/modes';
import { lumaAdvice, lumaEvents, type LumaAction } from './engine/guide';
import { SUN } from './data/sun';
import { TERRAIN } from './data/terrain';
import { WEATHER } from './data/space-weather';
import { camera, crewObject, loadBaseModels, loadCrewModels, renderer, robot, resetScenePresentation, resizeRenderer, scene, setQuality, requestCrewWave, setCrewStepHandler, updateScene } from './render/scene';
import { pickAt, setHighlight, updateHighlight, type SelectableId } from './render/picking';
import { mountContext, renderContext, selectedObject, showContext, type ContextInfo } from './ui/context-panel';
import { warningAhead } from './engine/facilities';
import { cameraMode, clearCameraKeys, followingShot, goFree, goTo, isFollowing, lookAtSky, setCameraKey, setCameraNotice, setDirectorEnabled, setReducedMotion, setViewInset, stopFollow, toggleFree, updateDirector, type Shot } from './render/director';
import { CAMERA_KEYS, cameraCommand, insetFor, type Rect } from './render/camera-rules';
import { cinematicRunning, freezeCinematic, skipCinematic, startCinematic, updateCinematic } from './render/cinematic';
import { applyLanguage, clearToast, currentTool, greenhouseFrom, onLanguage, openPanel, renderChapters, renderEnd, renderHud, setLightMap, setTool, showToast, ui, type Tool } from './ui/hud';
import { initLuma, pushLumaEvents, relabelLuma, resetLuma, updateLuma } from './ui/luma';
import { currentScreen, loadSettings, popScreen, pushScreen, saveSettings, showScreen, type ScreenId } from './ui/screens';
import { getVolume, initAudio, isMuted, play, setLoop, setMuted, setVolume } from './ui/audio';
import { soundCues } from './engine/sound-events';
import { isGreenhouseOn } from './engine/resources';
import { mountIcons } from './ui/icons';
import { reasonText } from './ui/action-reason';
import { coachActive, coachEvent, mountSquad, mountTags, placeTags, relabelCoach, relabelSquad, renderSquad, startCoach, type SquadId } from './ui/squad';
import { mountHorizonPanel } from './ui/horizon-panel';
import { mountSpacePanel } from './ui/space-panel';
import { mountSkyPanel, skyLongExposure } from './ui/sky-panel';
import { bodyAt, type BodyId } from './astronomy/sky';
import { earthNow, renderEarthButton } from './ui/earth-button';
import { SKY } from './data/sky';
import { sampleAt } from './engine/sun';
import { getLang, setI18nDefaults, t } from './i18n';
import { installDevTools } from './dev/tools';
import { mountPerformanceMonitor } from './ui/performance';

/** Base inicial (equilíbrio do motor, docs/regras-recursos.md). A patente vem do modo (D-17). */
const BASE: Omit<Installation, 'rank'> = { site: 'peak', panels: 2, batteryCapacity: 1000, greenhouse: 'surplus' };
/** Velocidades da simulação (horas de jogo por segundo real). */
const SPEEDS = [1, 2, 4] as const;
/** Maior passo de tempo real por quadro: a aba em segundo plano não pula a partida. */
const MAX_FRAME_SECONDS = 0.1;
const HUD_INTERVAL_MS = 100;
const captureFrozen = import.meta.env.DEV && new URLSearchParams(window.location.search).has('freeze');

let mode: ModeId = 'cadet';
let game: GameState = createGame({ installation: installationFor(mode, BASE) });
let started = false;
let paused = false;
let ended = false;
let speedIndex = 0;
let visualTime = 0;
let settings = loadSettings();

const LIT: boolean[] = Array.from({ length: MATCH_HOURS + 1 }, (_, h) => isSunlit(SUN, h, BASE.site, TERRAIN));
setLightMap(LIT);
const sunlit = (hour: number): boolean => LIT[Math.min(MATCH_HOURS, Math.max(0, Math.floor(hour)))];
const weatherNow = (): SpaceWeatherSample => weatherAt(WEATHER, game.clock.hour);
const weatherAtHour = (hour: number): SpaceWeatherSample => weatherAt(WEATHER, hour);
/** Clima para a tela: "radiação" aqui significa trabalho parado; se o jogador decidiu ficar fora, o trabalho continua. */
const weatherForView = (): SpaceWeatherSample => {
  const w = weatherNow();
  return w.radiation && game.crewOrder === 'outside' ? { ...w, radiation: false } : w;
};
const alertNow = (): AlertView =>
  alertAt(SPACE_EVENTS, game.clock.hour, {
    reach: game.robot.antennaInstalled ? warningAhead(game.antennaTuneLeft) : null,
    sheltered: crewSheltered(game.crew, game.crewOrder),
  });
setI18nDefaults({ w: ICE_WATER_PER_TRIP, help: Math.round(ICE_HELP_HOURS), iceH: Math.round(TASK_HOURS.ice), antennaH: Math.round(TASK_HOURS.antenna), panelH: Math.round(TASK_HOURS.panel) });

const contextInfo = (): ContextInfo => ({ radiation: weatherNow().radiation, lit: sunlit(game.clock.hour), speed: SPEEDS[speedIndex], alert: alertNow(), radiationLeft: radiationHoursLeft(WEATHER, game.clock.hour), water: waterForecast() });

// A previsão reexecuta o motor; o cache evita simular 48 h por atualização do HUD.
/** Instante (relógio da página) até o qual o tanque está enchendo, para o som de borbulho. */
let fillUntil = 0;
let forecastKey = '';
const forecastCache = new Map<string, WaterForecast>();
function forecastStateKey(): string {
  const queue = game.robot.queue.map((q) => q.kind).join(',');
  const crew = game.agents.map((a) => (a.task ? `${a.task.kind}:${a.task.phase}` : '-')).join(',');
  return `${Math.floor(game.clock.hour)}|${queue}|${crew}|${game.crewOrder}|${Math.round(game.vitals.water)}|${game.robot.safe ? 1 : 0}`;
}
function cachedForecast(tag: string, run: () => WaterForecast): WaterForecast {
  const key = forecastStateKey();
  if (key !== forecastKey) {
    forecastKey = key;
    forecastCache.clear();
  }
  let f = forecastCache.get(tag);
  if (!f) {
    f = run();
    forecastCache.set(tag, f);
  }
  return f;
}
function waterForecast(): WaterForecast {
  return cachedForecast('now', () => forecastWater(game, sunlit, weatherAtHour));
}
function waterForecastWith(action: GameAction): WaterForecast {
  if (action.type !== 'ENQUEUE_TASK') return waterForecast();
  return cachedForecast(`enqueue:${action.kind}`, () => forecastWithAction(game, action, sunlit, weatherAtHour));
}

/** Ações entram na fronteira global de 0,25 h para o resultado não depender do quadro. */
const scheduled: { at: number; action: GameAction }[] = [];

const grantedHours = (): number => game.clock.hour + game.pendingHours;

function act(action: GameAction): string | null {
  const check = dispatch(game, action);
  if (!check.ok) {
    play('error');
    const failure = reasonText(check.reason);
    ui.message.textContent = failure;
    renderNow(performance.now());
    return failure;
  }
  ui.message.textContent = '';
  play('confirm');
  coachEvent('ordered');
  if (isRunning()) {
    const at = (Math.floor(grantedHours() / ACTION_HOURS + 1e-9) + 1) * ACTION_HOURS;
    scheduled.push({ at, action });
  } else {
    game = check.state;
  }
  renderNow(performance.now());
  return null;
}

function isRunning(): boolean {
  return started && !paused && !ended && currentScreen() === null && outcomeOf(game) === 'playing';
}

function advanceGame(hours: number): void {
  const target = grantedHours() + hours;
  scheduled.sort((a, b) => a.at - b.at);
  while (scheduled.length && scheduled[0].at <= target + 1e-9) {
    const job = scheduled.shift()!;
    const need = job.at - grantedHours();
    if (need > 1e-9) game = advance(game, need, sunlit, weatherAtHour);
    const result = dispatch(game, job.action);
    if (result.ok) game = result.state;
    else ui.message.textContent = reasonText(result.reason);
  }
  const rest = target - grantedHours();
  if (rest > 1e-9) game = advance(game, rest, sunlit, weatherAtHour);
}

function orderToast(crew: boolean): string {
  const radiation = weatherNow().radiation && game.crewOrder !== 'outside';
  let why: string | null = null;
  if (radiation) why = t('wait.why.radiation', { s: Math.max(1, Math.round(radiationHoursLeft(WEATHER, game.clock.hour) / SPEEDS[speedIndex])) });
  else if (crew && game.crewOrder === 'shelter') why = t('wait.why.shelter');
  else if (!crew && game.vitals.battery <= 0) why = t('wait.why.battery');
  return why ? t('toast.order.wait', { why }) : t('toast.order');
}

const FOCUS_SHOT: Record<SelectableId, Shot> = {
  habitat: 'habitat',
  greenhouse: 'greenhouse',
  rover: 'rover',
  crew0: 'crew',
  crew1: 'crew1',
  panels: 'energy',
  antenna: 'antenna',
  processor: 'logistics',
  storage: 'logistics',
};

function selectObject(id: SelectableId | null): void {
  if (id) {
    play('select');
    coachEvent('selected');
  }
  if (id) setTool(null);
  showContext(id);
  setHighlight(id);
  if (id) renderContext(game, contextInfo());
}

let riskAfterOrder = false;
mountContext(document.getElementById('ctx') as HTMLElement, {
  forecast: (action) => waterForecastWith(action),
  act(action) {
    riskAfterOrder = action.type === 'ENQUEUE_TASK' && action.kind !== 'ice' && waterForecastWith(action).risk;
    const failure = act(action);
    if (failure) {
      showToast(t('ctx.status'), failure);
      return;
    }
    if (action.type === 'ASSIGN_AGENT_TASK') {
      showToast(orderToast(true), t(`task.${action.kind}`));
      if (!isFollowing()) goTo(action.kind === 'calibrate' ? 'energy' : action.kind === 'tune' ? 'antenna' : 'greenhouse', performance.now(), 0.9);
    }
    if (action.type === 'ENQUEUE_TASK') {
      const risky = riskAfterOrder && orderToast(false) === t('toast.order');
      showToast(risky ? t('toast.order.risk') : orderToast(false), t(`mission.${action.kind}`));
      if (game.robot.queue.length === 1 && !isFollowing()) goTo('rover', performance.now(), 0.9);
    }
  },
  openTool(tool) {
    selectObject(null);
    setTool(tool);
  },
  overview: () => goTo('overview', performance.now()),
  focus: (id) => goTo(FOCUS_SHOT[id], performance.now(), 0.9),
  select: (id) => selectObject(id),
  close: () => selectObject(null),
});

const TOOL_OBJECT: Partial<Record<Tool, SelectableId>> = { greenhouse: 'greenhouse', crew: 'crew0', rover: 'rover', energy: 'panels' };
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-tool]')) {
  const id = TOOL_OBJECT[button.dataset.tool as Tool];
  if (!id) continue;
  button.addEventListener(
    'click',
    (event) => {
      event.stopImmediatePropagation();
      if (!started || ended || paused || currentScreen() !== null || cinematicRunning()) return;
      const again = selectedObject() === id || (id === 'crew0' && selectedObject() === 'crew1');
      selectObject(again ? null : id);
      if (!again) goTo(FOCUS_SHOT[id], performance.now(), 0.9);
      for (const b of document.querySelectorAll<HTMLButtonElement>('[data-tool]')) b.classList.toggle('active', !again && b === button);
    },
    true,
  );
}

renderer.domElement.setAttribute('role', 'img');
renderer.domElement.setAttribute('aria-label', t('a11y.scene'));

let pressAt: { x: number; y: number; time: number } | null = null;
renderer.domElement.addEventListener('pointerdown', (event) => {
  pressAt = { x: event.clientX, y: event.clientY, time: performance.now() };
});
// Usa `click` (e não `pointerup`): em telas de toque o clique sintético cairia no painel recém-aberto.
renderer.domElement.addEventListener('click', (event) => {
  const press = pressAt;
  pressAt = null;
  if (!press) return;
  if (Math.hypot(event.clientX - press.x, event.clientY - press.y) > 6 || performance.now() - press.time > 450) return;
  if (!started || ended || paused || currentScreen() !== null || cinematicRunning()) return;
  selectObject(pickAt(event.clientX, event.clientY));
});

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-task]')) {
  button.addEventListener('click', () => {
    act({ type: 'ENQUEUE_TASK', kind: button.dataset.task as TaskKind });
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
const earthBtn = document.getElementById('earth-btn') as HTMLButtonElement;
earthBtn.addEventListener('click', () => goTo('earth', performance.now()));
const speedBtn = document.getElementById('speed-btn') as HTMLButtonElement;
speedBtn.addEventListener('click', () => {
  speedIndex = (speedIndex + 1) % SPEEDS.length;
  speedBtn.textContent = `${SPEEDS[speedIndex]}×`;
});

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

let hudDueAt = 0;
let previousAlertLevel = 'normal';

let squadEntries: ReturnType<typeof renderSquad> | null = null;
const SHOT_TO_SQUAD: Partial<Record<Shot, SquadId>> = { crew: 'crew0', crew1: 'crew1', rover: 'rover' };
const squadInfo = () => {
  const info = contextInfo();
  const shot = followingShot();
  return { radiation: info.radiation && game.crewOrder !== 'outside', radiationLeft: info.radiationLeft, speed: info.speed, selected: selectedObject(), following: shot ? SHOT_TO_SQUAD[shot] ?? null : null, water: info.water };
};
mountSquad(document.getElementById('squad') as HTMLElement, {
  select: (id) => selectObject(id),
  follow: (id) => goTo(id === 'rover' ? 'rover' : id === 'crew0' ? 'crew' : 'crew1', performance.now(), 0.9),
});
mountTags(document.getElementById('tags') as HTMLElement);
const tagVec = new THREE.Vector3();
/** Ponto da tela (px) acima de um objeto, ou null se escondido, atrás da câmera ou fora da vista. */
function tagPoint(obj: THREE.Object3D | null, lift: number): readonly [number, number] | null {
  if (!obj || !obj.visible) return null;
  obj.getWorldPosition(tagVec);
  tagVec.y += lift;
  tagVec.project(camera);
  if (tagVec.z > 1 || Math.abs(tagVec.x) > 1.05 || Math.abs(tagVec.y) > 1.05) return null;
  return [((tagVec.x + 1) / 2) * window.innerWidth, ((1 - tagVec.y) / 2) * window.innerHeight];
}

function renderNow(now: number): void {
  const weather = weatherForView();
  const alert = alertNow();
  if (started && game.robot.antennaInstalled && alert.level === 'monitoring' && previousAlertLevel !== 'monitoring') requestCrewWave(3);
  previousAlertLevel = alert.level;
  renderHud(game, { weather, alert, lit: sunlit(game.clock.hour), mode: MODES[mode], explanations: settings.explanations || MODES[mode].explanations });
  if (started && selectedObject()) renderContext(game, contextInfo());
  if (started) squadEntries = renderSquad(game, squadInfo());
  if (started) updateLuma(lumaAdvice(game, alert, MODES[mode].luma), game.clock.hour, now);
  if (started && currentTool() === 'science') {
    updateSpacePanel(game.clock.hour, alert, getLang());
    updateSkyPanel(game.clock.hour, game.installation.site);
  }
}

onLanguage(() => {
  renderer.domElement.setAttribute('aria-label', t('a11y.scene'));
  relabelLuma();
  renderSoundBtn();
  relabelSquad();
  relabelCoach();
  showContext(selectedObject());
  renderChapters(document.getElementById('story-chapters') as HTMLElement, null);
  speedBtn.title = t('hud.speed');
});

const updateSpacePanel = mountSpacePanel(document.getElementById('space-panel') as HTMLElement, SPACE_EVENTS);
const updateHorizon = mountHorizonPanel(document.getElementById('horizon-panel') as HTMLElement, SUN, TERRAIN, BASE.site);
const updateScienceHorizon = mountHorizonPanel(document.getElementById('science-horizon') as HTMLElement, SUN, TERRAIN, BASE.site);
function inspectSky(id: BodyId): void {
  const sample = id === 'sun' ? sampleAt(SUN, game.clock.hour, game.installation.site) : bodyAt(SKY, id, game.clock.hour);
  lookAtSky(sample.az, sample.el);
}
// Enquadramento do céu acima do horizonte; não representa um corpo ou posição inventada.
const inspectStarField = (): void => lookAtSky(0, 45);
const updateSkyPanel = mountSkyPanel(document.getElementById('sky-panel') as HTMLElement, inspectSky, inspectStarField);
const updateMenuSky = mountSkyPanel(document.getElementById('science-sky') as HTMLElement, inspectSky, inspectStarField);

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
const setVolumeInput = document.getElementById('set-volume') as HTMLInputElement;
setVolumeInput.value = String(Math.round(getVolume() * 100));
setVolumeInput.addEventListener('input', () => {
  setVolume(Number(setVolumeInput.value) / 100);
  play('select');
});
setCrewStepHandler((gain) => play('step', gain));

const cine = document.getElementById('cine') as HTMLElement;
const cineCaption = document.getElementById('cine-caption') as HTMLElement;
const cineLuma = document.getElementById('cine-luma') as HTMLElement;
const cineLumaText = document.getElementById('cine-luma-text') as HTMLElement;

function resetGame(): void {
  scheduled.length = 0;
  game = createGame({ installation: installationFor(mode, BASE) });
  visualTime = 0;
  ended = false;
  paused = false;
  resetScenePresentation();
  resetLuma();
  clearToast();
  setTool(null);
  if (currentTool()) setTool(null);
  selectObject(null);
  ui.message.textContent = '';
}

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

function beginPlay(): void {
  cine.classList.add('out');
  window.setTimeout(() => (cine.hidden = true), 700);
  setDirectorEnabled(true);
  goTo('overview', performance.now(), 1.2);
  ui.hud.hidden = false;
  started = true;
  startCoach(document.getElementById('coach') as HTMLElement);
  if (!coachActive()) showToast(t('toast.chapter', { n: 1 }), t('chapter.1'));
  renderNow(performance.now());
  if (MODES[mode].luma === 'full') openPanel('rover');
  window.setTimeout(() => {
    if (started && !ended && !coachActive() && !selectedObject()) showToast(t('toast.hint.small'), t('toast.hint'));
  }, 5000);
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
initAudio();
function renderSoundBtn(): void {
  const soundBtn = document.getElementById('sound-btn');
  if (!soundBtn) return;
  soundBtn.innerHTML = '';
  const icon = document.createElement('span');
  icon.dataset.icon = isMuted() ? 'soundOff' : 'sound';
  soundBtn.append(icon);
  mountIcons(soundBtn);
  soundBtn.setAttribute('aria-pressed', String(!isMuted()));
  soundBtn.setAttribute('aria-label', t(isMuted() ? 'sound.on' : 'sound.off'));
  soundBtn.title = `${t(isMuted() ? 'sound.on' : 'sound.off')}. ${t('sound.note')}`;
}
document.getElementById('sound-btn')?.addEventListener('click', () => {
  setMuted(!isMuted());
  renderSoundBtn();
  if (!isMuted()) play('select');
});
renderSoundBtn();
document.getElementById('resume')?.addEventListener('click', () => setPaused(false));
document.getElementById('to-menu')?.addEventListener('click', backToMenu);
document.getElementById('end-menu')?.addEventListener('click', backToMenu);
document.getElementById('restart')?.addEventListener('click', () => newMission(false));
const KEY_OBJECTS: readonly SelectableId[] = ['habitat', 'greenhouse', 'rover', 'crew0', 'crew1', 'panels', 'antenna', 'processor', 'storage'];

window.addEventListener('keydown', (event) => {
  if (/^[1-9]$/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const target = event.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (!started || ended || paused || currentScreen() !== null || cinematicRunning()) return;
    selectObject(KEY_OBJECTS[Number(event.key) - 1]);
    (document.getElementById('ctx') as HTMLElement).focus({ preventScroll: true });
    return;
  }
  if (event.key !== 'Escape') return;
  if (cinematicRunning()) {
    skipCinematic();
    return;
  }
  const screen = currentScreen();
  if (started && !ended && screen === null && selectedObject()) {
    selectObject(null);
    return;
  }
  if (started && !ended && screen === null) setPaused(true);
  else if (started && !ended && screen === 'pause') setPaused(false);
  else if (screen && screen !== 'menu' && screen !== 'loading' && screen !== 'end') popScreen();
});

function cameraKeysAllowed(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return false;
  const target = event.target as HTMLElement | null;
  if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return false;
  return started && !ended && currentScreen() === null && !cinematicRunning();
}
window.addEventListener('keydown', (event) => {
  if (!cameraKeysAllowed(event)) return;
  const command = cameraCommand(event.key);
  if (command) {
    if (event.repeat) return;
    if (command === 'overview') goTo('overview', performance.now(), 1.0);
    else toggleFree(performance.now());
    renderCamBtn();
    return;
  }
  if (CAMERA_KEYS.has(event.key)) {
    event.preventDefault();
    setCameraKey(event.key, true, event.shiftKey);
  }
});
window.addEventListener('keyup', (event) => setCameraKey(event.key, false, event.shiftKey));
window.addEventListener('blur', clearCameraKeys);

const SHOT_WHO: Partial<Record<Shot, string>> = { crew: 'ctx.crew0', crew1: 'ctx.crew1', rover: 'ctx.rover' };
const whoOf = (shot: Shot | null): string => t(SHOT_WHO[shot ?? 'crew'] ?? 'ctx.crew0');

function renderCamBtn(): void {
  const btn = document.getElementById('cam-btn');
  if (!btn) return;
  if (!btn.firstChild) {
    const icon = document.createElement('span');
    icon.dataset.icon = 'camera';
    btn.append(icon);
    mountIcons(btn);
  }
  const mode = cameraMode();
  const label = t(`camctl.${mode}`, { who: whoOf(followingShot()) });
  if (btn.getAttribute('aria-label') !== label) {
    btn.setAttribute('aria-label', label);
    btn.title = label;
  }
  btn.dataset.mode = mode;
  btn.setAttribute('aria-pressed', String(mode === 'free'));
}
document.getElementById('cam-btn')?.addEventListener('click', () => {
  if (cameraMode() === 'overview') goFree();
  else goTo('overview', performance.now(), 1.0);
  renderCamBtn();
});
setCameraNotice((lost) => showToast(t('camctl.lost.small'), t('camctl.lost', { who: whoOf(lost) })));

function updateViewInset(): void {
  const rects: Rect[] = [];
  for (const id of ['ctx', 'side']) {
    const el = document.getElementById(id);
    if (!el || el.hidden) continue;
    const r = el.getBoundingClientRect();
    rects.push({ left: r.left, top: r.top, right: r.right, bottom: r.bottom });
  }
  const inset = insetFor({ width: window.innerWidth, height: window.innerHeight }, rects);
  setViewInset(inset.x, inset.y);
}

let last: number | null = null;
let radiationBefore = false;
let shadowTick = 0;
let lastFrameAt = 0;

function frame(now: number): void {
  perfTick(now);
  const screen = currentScreen();
  const active = !captureFrozen && started && !paused && !ended && screen === null && outcomeOf(game) === 'playing';
  if (active && last !== null) {
    const seconds = Math.min(Math.max(0, (now - last) / 1000), MAX_FRAME_SECONDS);
    const prev = game;
    advanceGame(seconds * SPEEDS[speedIndex]);
    const radiationNow = weatherNow().radiation;
    const events = lumaEvents(prev, game, radiationBefore, radiationNow);
    radiationBefore = radiationNow;
    if (events.length) {
      pushLumaEvents(events, game.clock.hour, now);
      if (events.some((e) => e.id === 'radiation-start')) play('alert');
      else if (events.some((e) => e.id.startsWith('chapter-'))) play('complete');
      const chapter = events.find((e) => e.id.startsWith('chapter-'));
      if (chapter) showToast(t('toast.chapter', { n: chapter.vars.n }), t(`chapter.${chapter.vars.n}`));
      if (currentTool() === 'missions') renderNow(now);
    }
    visualTime += seconds * 1000;
    const cues = soundCues(prev, game);
    cues.forEach((cue, i) => window.setTimeout(() => play(cue), i * 260));
    if (game.vitals.water - prev.vitals.water > 0.005) fillUntil = now + 450;
  }
  last = now;
  // A cena anda no relógio visual (parado na pausa); no menu e na introdução, no relógio real.
  const sceneTime = started ? visualTime : now;
  const roverView = updateScene(game, sceneTime, sunlit(game.clock.hour), weatherForView(), started ? active : true, skyLongExposure());
  setLoop('rover', active && roverView.moving);
  setLoop('drill', active && roverView.working && roverView.kind === 'ice' && roverView.phase === 'operate');
  setLoop('servo', active && roverView.working && roverView.kind === 'panel' && roverView.phase === 'operate');
  setLoop('arc', active && roverView.working && roverView.kind === 'antenna' && roverView.phase === 'operate');
  setLoop('heater', active && roverView.working && roverView.kind === 'ice' && roverView.phase === 'deliver');
  const ghOn = game.crewOrder === 'auto' && isGreenhouseOn(game.vitals, game.installation);
  setLoop('fan', active && ghOn);
  setLoop('pump', active && ghOn && game.crop.irrigation !== 'low');
  setLoop('fill', active && now < fillUntil);
  updateHighlight(now / 1000);
  if (cinematicRunning()) updateCinematic(now);
  else updateDirector(now);
  if (started) placeTags(squadEntries, { crew0: tagPoint(crewObject(0), 2.2), crew1: tagPoint(crewObject(1), 2.2), rover: tagPoint(robot, 2.6) });
  if (now >= hudDueAt) {
    renderEarthButton(earthBtn, earthNow(game.clock.hour, game.installation.site));
    if (currentTool() !== null && selectedObject()) selectObject(null);
    if (started) {
      renderNow(now);
      renderCamBtn();
      updateViewInset();
    }
    updateHorizon(game.clock.hour);
    if (screen === 'science') {
      updateScienceHorizon(game.clock.hour);
      updateMenuSky(game.clock.hour, game.installation.site);
    }
    hudDueAt = now + HUD_INTERVAL_MS;
  }
  if (started && !ended && outcomeOf(game) !== 'playing') {
    ended = true;
    renderEnd(game, MODES[mode]);
    setTool(null);
    showScreen('end');
  }
  // Sombras em quadros alternados; a cada quadro quando o jogo já está lento (abaixo de ~30 fps).
  renderer.shadowMap.needsUpdate = renderer.shadowMap.needsUpdate || (shadowTick++ & 1) === 0 || now - lastFrameAt > 1000 / 30;
  lastFrameAt = now;
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

window.addEventListener('resize', () => resizeRenderer());

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

const perfTick = mountPerformanceMonitor(renderer);

function maybeAutostart(): void {
  if (!import.meta.env.DEV) return;
  installDevTools({
    getState: () => game,
    setState: (state) => { game = state; },
    act,
    radiation: () => weatherNow().radiation,
  });
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
  const clockAt = q.get('clockAt');
  if (clockAt !== null) game = { ...game, clock: createClock(Number(clockAt)) };
  const antennaMode = q.get('antenna');
  if (antennaMode === 'base' || antennaMode === 'tuned') {
    game = { ...game, robot: { ...game.robot, antennaInstalled: true }, antennaTuneLeft: antennaMode === 'tuned' ? 150 : 0 };
  }
  const step = (hours: number) => {
    for (let h = 0; h < hours; h += 0.25) {
      const prev = game;
      game = advance(game, 0.25, sunlit, weatherAtHour);
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
  const sky = q.get('sky');
  if (sky && ['sun', 'earth', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'].includes(sky)) inspectSky(sky as BodyId);
  if (q.has('pause')) setPaused(true);
  renderNow(performance.now());
}

requestAnimationFrame(frame);

ui.space.addEventListener('click', () => openPanel('science'));
ui.space.style.cursor = 'pointer';
