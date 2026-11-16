// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Ponto de entrada (Earthset 4.0): carregamento, menu, escolha de modo, história, introdução, partida, pausa e fim.
// Liga motor (src/engine), cena (src/render) e interface (src/ui). Regra de jogo só no motor.
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
import { camera, controls, crewObject, loadBaseModels, loadCrewModels, renderer, robot, resetScenePresentation, resizeRenderer, scene, setQuality, requestCrewWave, setCrewStepHandler, crewAnimationState, roverWorldState, updateScene } from './render/scene';
import { antenna, base, greenhouse, habitat, powerUnit, processor, storage } from './render/base-layout';
import { surfaceHeight } from './render/terrain-height';
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
import { apparentSunDirection } from './render/sky';
import { sampleAt } from './engine/sun';
import { getLang, setI18nDefaults, t } from './i18n';

/** Base inicial (equilíbrio do motor, docs/regras-recursos.md). A patente vem do modo (D-17). */
const BASE: Omit<Installation, 'rank'> = { site: 'peak', panels: 2, batteryCapacity: 1000, greenhouse: 'surplus' };
/** Velocidades da simulação (horas de jogo por segundo real). */
const SPEEDS = [1, 2, 4] as const;
/** Maior passo de tempo real por quadro: a aba em segundo plano não pula a partida. */
const MAX_FRAME_SECONDS = 0.1;
const HUD_INTERVAL_MS = 100;
/** Captura determinística só em desenvolvimento: relógio parado sem overlay de pausa. */
const captureFrozen = import.meta.env.DEV && new URLSearchParams(window.location.search).has('freeze');

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
/** Clima por hora de jogo, para o passo interno do motor (advance). */
const weatherAtHour = (hour: number): SpaceWeatherSample => weatherAt(WEATHER, hour);
/** Clima para a tela: "radiação" aqui significa trabalho parado; se o jogador decidiu ficar fora, o trabalho continua. */
const weatherForView = (): SpaceWeatherSample => {
  const w = weatherNow();
  return w.radiation && game.crewOrder === 'outside' ? { ...w, radiation: false } : w;
};
/** Estado de alerta pelo catálogo NASA DONKI; a antena instalada dá o alcance do monitoramento (D-01, emenda v5). */
const alertNow = (): AlertView =>
  alertAt(SPACE_EVENTS, game.clock.hour, {
    reach: game.robot.antennaInstalled ? warningAhead(game.antennaTuneLeft) : null,
    sheltered: crewSheltered(game.crew, game.crewOrder),
  });
// Horas e água das missões nos textos fixos do HTML (painel lateral do rover): vêm do motor, não ficam para trás.
setI18nDefaults({ w: ICE_WATER_PER_TRIP, help: Math.round(ICE_HELP_HOURS), iceH: Math.round(TASK_HOURS.ice), antennaH: Math.round(TASK_HOURS.antenna), panelH: Math.round(TASK_HOURS.panel) });

const contextInfo = (): ContextInfo => ({ radiation: weatherNow().radiation, lit: sunlit(game.clock.hour), speed: SPEEDS[speedIndex], alert: alertNow(), radiationLeft: radiationHoursLeft(WEATHER, game.clock.hour), water: waterForecast() });

// ---------- Previsão da água (ROV-04) ----------
// Simular 48 h custa ~3,6 ms: guarda o resultado e só recalcula quando muda algo que a altera
// (hora inteira, fila do rover, tarefas da tripulação, ordem de abrigo, água arredondada).
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

// ---------- Ações ----------

/** Ações do jogador validadas na hora e aplicadas na próxima fronteira de 0,25 h de jogo (decisão de 15/11, DT-02). */
const scheduled: { at: number; action: GameAction }[] = [];

/** Horas de jogo já recebidas (integradas ou ainda pendentes no motor). */
const grantedHours = (): number => game.clock.hour + game.pendingHours;

function act(action: GameAction): string | null {
  // Validação imediata: a mensagem de recusa aparece na hora, como antes.
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
    // Com o tempo correndo, a ação vale na próxima fronteira de 0,25 h; o resultado não depende do quadro.
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

/** Avança o tempo de jogo `hours`, aplicando as ações agendadas nas fronteiras de 0,25 h. */
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

/**
 * Texto do aviso de ordem recebida: se a ordem vai esperar (radiação, ordem de abrigo, bateria vazia), diz por quê
 * e quanto tempo. Antes, a ordem confirmada ficava parada sem explicação no começo da partida (radiação das horas 0 a 24).
 */
function orderToast(crew: boolean): string {
  const radiation = weatherNow().radiation && game.crewOrder !== 'outside';
  let why: string | null = null;
  if (radiation) why = t('wait.why.radiation', { s: Math.max(1, Math.round(radiationHoursLeft(WEATHER, game.clock.hour) / SPEEDS[speedIndex])) });
  else if (crew && game.crewOrder === 'shelter') why = t('wait.why.shelter');
  else if (!crew && game.vitals.battery <= 0) why = t('wait.why.battery');
  return why ? t('toast.order.wait', { why }) : t('toast.order');
}

// ---------- Seleção na cena e painel contextual (D-18) ----------

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
    // Ordem recebida: confirmação imediata e um enquadramento curto (o jogador mantém o controle da câmera).
    if (action.type === 'ASSIGN_AGENT_TASK') {
      showToast(orderToast(true), t(`task.${action.kind}`));
      // Quem escolheu acompanhar alguém continua acompanhando; senão, um enquadramento curto do local.
      if (!isFollowing()) goTo(action.kind === 'calibrate' ? 'energy' : action.kind === 'tune' ? 'antenna' : 'greenhouse', performance.now(), 0.9);
    }
    if (action.type === 'ENQUEUE_TASK') {
      // A previsão do estado já com a ordem (calculada antes de aceitar) decide o aviso de água.
      // Se a ordem já espera (radiação, bateria), esse motivo vem primeiro; senão, o risco de água.
      const risky = riskAfterOrder && orderToast(false) === t('toast.order');
      showToast(risky ? t('toast.order.risk') : orderToast(false), t(`mission.${action.kind}`));
      // Primeira missão da fila: a câmera acompanha o rover saindo da garagem (o jogador pode arrastar para soltar).
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

// Abas do menu inferior ligadas a objetos da cena abrem o painel contextual (com todas as ações):
// é o lugar onde o jogador procura primeiro. Base, Missões e Ciência continuam painéis laterais.
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

// Toque curto na cena (sem arrastar) seleciona; arrastar continua girando a câmera.
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
// Botão Terra: leva a câmera até a Terra quando ela está acima do horizonte do site (ver earth-status.ts).
const earthBtn = document.getElementById('earth-btn') as HTMLButtonElement;
earthBtn.addEventListener('click', () => goTo('earth', performance.now()));
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
let previousAlertLevel = 'normal';
// ---------- Equipe na tela (UX-04, UX-05) ----------

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
  // U-06: a tripulação acena quando o aviso da antena começa (monitoramento com antena instalada).
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

// ---------- Ciência (painel polar) ----------

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
const setVolumeInput = document.getElementById('set-volume') as HTMLInputElement;
setVolumeInput.value = String(Math.round(getVolume() * 100));
setVolumeInput.addEventListener('input', () => {
  setVolume(Number(setVolumeInput.value) / 100);
  play('select');
});
setCrewStepHandler((gain) => play('step', gain));

// ---------- Fluxo da missão ----------

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
  startCoach(document.getElementById('coach') as HTMLElement);
  if (!coachActive()) showToast(t('toast.chapter', { n: 1 }), t('chapter.1'));
  renderNow(performance.now());
  if (MODES[mode].luma === 'full') openPanel('rover');
  // Descoberta: a cena é clicável. Aparece depois do aviso do capítulo.
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
// Som (sinais estilizados de rádio e traje; ver src/ui/audio.ts). O estado fica salvo no navegador.
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
/** Teclas 1 a 9 selecionam os mesmos objetos do toque (acessibilidade por teclado). */
const KEY_OBJECTS: readonly SelectableId[] = ['habitat', 'greenhouse', 'rover', 'crew0', 'crew1', 'panels', 'antenna', 'processor', 'storage'];

window.addEventListener('keydown', (event) => {
  if (/^[1-9]$/.test(event.key) && !event.ctrlKey && !event.metaKey && !event.altKey) {
    const target = event.target as HTMLElement | null;
    if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
    if (!started || ended || paused || currentScreen() !== null || cinematicRunning()) return;
    selectObject(KEY_OBJECTS[Number(event.key) - 1]);
    // Foco no painel: quem navega por teclado segue direto para as ações (Tab) e Esc fecha.
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

// ---------- Câmera: teclado, botão e margem livre dos painéis (CAM-01, CAM-02) ----------

/** Teclas de câmera só valem com o jogo na tela, fora de campos de texto e sem atalhos do sistema. */
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

/** Botão de câmera: o ícone fica o mesmo e o texto diz o modo e o que o toque faz (visão geral ↔ câmera livre). */
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
// Quem estava sendo acompanhado saiu de vista (entrou no abrigo): a câmera volta sozinha e o jogador é avisado.
setCameraNotice((lost) => showToast(t('camctl.lost.small'), t('camctl.lost', { who: whoOf(lost) })));

/** Painéis abertos cobrem parte da tela: desloca a vista para o alvo ficar na área livre (camera-rules.ts). */
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

// ---------- Laço ----------

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
    // Um som por conclusão e por alerta de recurso (src/engine/sound-events.ts); sobrepostos entram em fila curta.
    const cues = soundCues(prev, game);
    cues.forEach((cue, i) => window.setTimeout(() => play(cue), i * 260));
    if (game.vitals.water - prev.vitals.water > 0.005) fillUntil = now + 450;
  }
  last = now;
  // A cena anda no relógio visual (parado na pausa); no menu e na introdução, no relógio real.
  const sceneTime = started ? visualTime : now;
  const roverView = updateScene(game, sceneTime, sunlit(game.clock.hour), weatherForView(), started ? active : true, skyLongExposure());
  // Sons contínuos estilizados: motor do rover em deslocamento e broca na escavação (só com o jogo correndo).
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
    perfEl.textContent = `${Math.round((perfFrames * 1000) / (now - perfSince))} fps · ${perfMin}-${perfMax} draws · ${renderer.info.render.triangles} tris · geo ${renderer.info.memory.geometries} tex ${renderer.info.memory.textures} prog ${renderer.info.programs?.length ?? 0}${mem ? ` · ${Math.round(mem.usedJSHeapSize / 1048576)} MB` : ''}`;
    perfFrames = 0;
    perfMin = Infinity;
    perfMax = 0;
    perfSince = now;
  }
}

/**
 * Atalhos de captura, só no servidor de desenvolvimento (não entram no build):
 * ?autostart=cadet&nointro&hour=30&task=ice&after=3&tool=rover&shot=rover&lang=pt&cineAt=9&screen=modes
 * Alertas: &clockAt=406 (muda só o relógio, sem simular recursos) e &antenna=base|tuned (antena instalada, sem ou com ajuste).
 */
function maybeAutostart(): void {
  if (!import.meta.env.DEV) return;
  // Gancho só de desenvolvimento para os testes de interface: posição de um objeto na tela (px).
  (window as unknown as { __earthset: unknown }).__earthset = {
    sunDirection: apparentSunDirection,
    crewState: crewAnimationState,
    roverState: roverWorldState,
    /** Envia uma ação ao motor como o painel faria (verificação da tripulação e do rover). */
    act: (action: GameAction) => act(action),
    hour: () => game.clock.hour,
    state: () => game,
    /** Relatório de assentamento (dev): para cada grupo da base, o ponto mais baixo do modelo contra o relevo sob a pegada. */
    groundReport(): Array<{ name: string; base: number; terrainMin: number; terrainMax: number; buried: number; gap: number }> {
      const out: Array<{ name: string; base: number; terrainMin: number; terrainMax: number; buried: number; gap: number }> = [];
      base.updateMatrixWorld(true);
      for (const group of base.children) {
        if (!(group instanceof THREE.Group) || !group.name) continue;
        const box = new THREE.Box3();
        group.traverse((n) => {
          if (n instanceof THREE.Mesh && n.visible && n.geometry && !n.userData.persistent) {
            n.geometry.computeBoundingBox();
            if (n.geometry.boundingBox) box.union(n.geometry.boundingBox.clone().applyMatrix4(n.matrixWorld));
          }
        });
        if (box.isEmpty()) continue;
        let tMin = Infinity;
        let tMax = -Infinity;
        for (let i = 0; i <= 4; i++) {
          for (let j = 0; j <= 4; j++) {
            const h = surfaceHeight(box.min.x + ((box.max.x - box.min.x) * i) / 4, box.min.z + ((box.max.z - box.min.z) * j) / 4);
            tMin = Math.min(tMin, h);
            tMax = Math.max(tMax, h);
          }
        }
        const r = (v: number) => Math.round(v * 100) / 100;
        out.push({ name: group.name, base: r(box.min.y), terrainMin: r(tMin), terrainMax: r(tMax), buried: r(Math.max(0, tMax - box.min.y)), gap: r(Math.max(0, box.min.y - tMin)) });
      }
      return out;
    },
    /** Altera o estado só para verificar telas (dev): mescla campos de primeiro nível e de `crop`/`vitals`/`robot`. */
    patch(partial: Record<string, unknown>): void {
      const next = { ...game } as Record<string, unknown>;
      for (const [key, value] of Object.entries(partial)) {
        const current = (game as unknown as Record<string, unknown>)[key];
        next[key] = value && typeof value === 'object' && !Array.isArray(value) && current && typeof current === 'object' ? { ...(current as object), ...(value as object) } : value;
      }
      game = next as unknown as GameState;
    },
    /** Estado real da câmera (dev): posição, alvo, distância, ângulos e limites em vigor. */
    cameraState(): Record<string, unknown> {
      const off = camera.position.clone().sub(controls.target);
      const dist = off.length();
      return {
        pos: camera.position.toArray().map((v) => Math.round(v * 100) / 100),
        target: controls.target.toArray().map((v) => Math.round(v * 100) / 100),
        dist: Math.round(dist * 100) / 100,
        theta: Math.round(Math.atan2(off.x, off.z) * 1000) / 1000,
        polarDeg: Math.round((Math.acos(Math.min(1, Math.max(-1, off.y / dist))) * 180) / Math.PI * 10) / 10,
        limits: [controls.minDistance, controls.maxDistance, Math.round((controls.minPolarAngle * 180) / Math.PI), Math.round((controls.maxPolarAngle * 180) / Math.PI)],
        mode: cameraMode(),
        following: followingShot(),
        viewOffset: camera.view?.enabled ? [camera.view.offsetX, camera.view.offsetY] : null,
      };
    },
    /** Posiciona a câmera de verificação (dev): desliga a direção e esconde o HUD. */
    view(cx: number, cy: number, cz: number, tx: number, ty: number, tz: number): void {
      setDirectorEnabled(false);
      camera.position.set(cx, cy, cz);
      controls.target.set(tx, ty, tz);
      controls.update();
      ui.hud.hidden = true;
    },
    /** Áudio real do jogo, para a verificação dos sons (dev). */
    audio: { play, setLoop, setVolume, getVolume, setMuted, isMuted },
    radiation: () => weatherNow().radiation,
    screenOf(id: SelectableId): [number, number] | null {
      const fixed: Partial<Record<SelectableId, THREE.Object3D>> = { rover: robot, greenhouse, habitat, antenna, processor, storage, panels: powerUnit };
      const object = fixed[id] ?? crewObject(id === 'crew0' ? 0 : 1);
      if (!object) return null;
      const v = object.getWorldPosition(new THREE.Vector3());
      v.y += 0.8;
      v.project(camera);
      return [((v.x + 1) / 2) * window.innerWidth, ((1 - v.y) / 2) * window.innerHeight];
    },
  };
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
  void getLang;
}

requestAnimationFrame(frame);

// O aviso de clima espacial do HUD abre o painel científico (registro NASA, limites e histórico).
ui.space.addEventListener('click', () => openPanel('science'));
ui.space.style.cursor = 'pointer';
