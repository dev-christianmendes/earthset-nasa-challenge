// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Ponto de entrada: liga motor (src/engine), cena (src/render), HUD (src/ui) e o laço do jogo.
import { advance, createGame, dispatch, outcomeOf, type GameAction, type GameState } from './engine/game';
import type { GreenhouseMode, Installation } from './engine/resources';
import type { TaskKind } from './engine/robot';
import { isSunlit } from './engine/sun';
import { SUN } from './data/sun';
import { TERRAIN } from './data/terrain';
import { WEATHER } from './data/space-weather';
import { antennaWarning, weatherAt, type SpaceWeatherSample } from './engine/space-weather';
import { camera, controls, frameForViewport, loadBaseModels, loadCrewModels, renderer, resetScenePresentation, resetView, scene, startIntro, updateScene } from './render/scene';
import { applyLanguage, renderHud, ui } from './ui/hud';
import { getLang } from './i18n';
import { t } from './i18n';
import { MAX_PANELS, MAX_QUEUE } from './engine/robot';
import { mountHorizonPanel } from './ui/horizon-panel';

/** Configuração inicial da base. Valores de equilíbrio do motor (docs/regras-recursos.md). */
const INSTALLATION: Installation = {
  rank: 'explorador',
  site: 'peak',
  panels: 2,
  batteryCapacity: 1000,
  greenhouse: 'surplus',
};

/** Horas de jogo por segundo real. */
const HOURS_PER_SECOND = 2;
/** Maior passo de tempo real aceito por quadro, para a aba em segundo plano não pular a partida. */
const MAX_FRAME_SECONDS = 0.1;


// ---------- Estado e ações ----------

let game: GameState = createGame({ installation: INSTALLATION });

function act(action: GameAction): void {
  const result = dispatch(game, action);
  if (result.ok) {
    game = result.state;
    setMessage('');
  } else {
    setMessage(reasonText(result.reason));
  }
  renderNow();
}

/** Texto do motivo de recusa, no idioma atual (o motor manda só o código). */
function reasonText(code: string): string {
  const vars: Record<string, number> =
    code === 'queue-full' ? { max: MAX_QUEUE } : code === 'panel-limit' ? { max: MAX_PANELS } : {};
  return t(`reason.${code}`, vars);
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

document.getElementById('reset-view')?.addEventListener('click', () => resetView());

ui.restart.addEventListener('click', () => {
  game = createGame({ installation: INSTALLATION });
  visualTime = 0;
  resetScenePresentation(INSTALLATION.panels);
  ui.greenhouse.value = INSTALLATION.greenhouse;
  setMessage('');
  renderNow();
});

// ---------- Clima espacial (C2) ----------

/** Clima da hora atual do cenário de 09/10/2024 (NASA DONKI). */
function currentWeather(): SpaceWeatherSample {
  return weatherAt(WEATHER, game.clock.hour);
}

/** Aviso antecipado de tempestade: só com a antena instalada (D-01). */
function warningNow(): number | null {
  return antennaWarning(WEATHER, game.clock.hour, game.robot.antennaInstalled);
}

/** Atualiza o HUD com o estado atual, o clima e o aviso da antena. */
function renderNow(): void {
  renderHud(game, currentWeather(), warningNow());
}

// ---------- Sol (ilustrativo) ----------

/** A base recebe Sol nessa hora? Tabela real, com o horizonte local do site (ilustrativo). */
function sunlit(hour: number): boolean {
  return isSunlit(SUN, hour, INSTALLATION.site, TERRAIN);
}

// ---------- Laço do jogo ----------

let last: number | null = null;
/** Relógio da cena: só avança enquanto a partida está ativa. */
let visualTime = 0;
let hudDueAt = 0;
/** A partida só avança depois de "Nova missão" (tela inicial). */
let started = false;
/** Pausa: a simulação para; a cena continua desenhando. Esc alterna. */
let paused = false;
/** Intervalo de atualização do HUD (ms). Ações do jogador atualizam na hora. */
const HUD_INTERVAL_MS = 100;

const updateHorizon = mountHorizonPanel(document.getElementById('horizon-panel') as HTMLElement, SUN, TERRAIN, INSTALLATION.site);

function frame(now: number): void {
  if (perfEl) {
    perfFrames++;
    if (perfSince === 0) perfSince = now;
    if (now - perfSince >= 1000) {
      perfEl.textContent = `${Math.round((perfFrames * 1000) / (now - perfSince))} fps · ${renderer.info.render.calls} draws · ${renderer.info.render.triangles} tris`;
      perfFrames = 0;
      perfSince = now;
    }
  }
  const active = started && !paused && outcomeOf(game) === 'playing';
  if (active && last !== null) {
    const seconds = Math.min(Math.max(0, (now - last) / 1000), MAX_FRAME_SECONDS);
    game = advance(game, seconds * HOURS_PER_SECOND, sunlit(game.clock.hour), currentWeather());
    visualTime += seconds * 1000;
  }
  last = now;
  updateScene(game, visualTime, sunlit(game.clock.hour), currentWeather(), active);
  updateHorizon(game.clock.hour);
  controls.update();
  // O HUD é atualizado a cada HUD_INTERVAL_MS, não a cada quadro: a cena continua na taxa do navegador.
  if (now >= hudDueAt) {
    renderNow();
    hudDueAt = now + HUD_INTERVAL_MS;
  }
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
renderNow();
// Tela inicial: começar a missão, idioma e créditos. A cena fica visível de fundo.
document.getElementById('start')?.addEventListener('click', () => {
  // "Nova missão" abre o briefing; a partida começa só no botão "Começar missão".
  document.getElementById('title')?.setAttribute('hidden', '');
  document.getElementById('brief')?.removeAttribute('hidden');
});
document.getElementById('brief-start')?.addEventListener('click', () => {
  started = true;
  startIntro();
  document.getElementById('brief')?.setAttribute('hidden', '');
});
for (const b of document.querySelectorAll<HTMLButtonElement>('[data-crew]')) {
  b.addEventListener('click', () => act({ type: 'SET_CREW_ORDER', order: b.dataset.crew as 'auto' | 'shelter' }));
}
document.getElementById('title-lang')?.addEventListener('click', () => applyLanguage(getLang() === 'en' ? 'pt' : 'en'));
document.getElementById('show-credits')?.addEventListener('click', () => {
  document.getElementById('title-menu')?.setAttribute('hidden', '');
  document.getElementById('title-credits')?.removeAttribute('hidden');
});
document.getElementById('hide-credits')?.addEventListener('click', () => {
  document.getElementById('title-credits')?.setAttribute('hidden', '');
  document.getElementById('title-menu')?.removeAttribute('hidden');
});

function setPaused(on: boolean): void {
  paused = on && started;
  document.getElementById('pause')?.toggleAttribute('hidden', !paused);
  if (!paused) document.getElementById('pause-controls')?.setAttribute('hidden', '');
  if (paused) document.getElementById('pause-menu')?.removeAttribute('hidden');
}
document.getElementById('pause-btn')?.addEventListener('click', () => setPaused(!paused));
document.getElementById('resume')?.addEventListener('click', () => setPaused(false));
document.getElementById('show-controls')?.addEventListener('click', () => {
  document.getElementById('pause-menu')?.setAttribute('hidden', '');
  document.getElementById('pause-controls')?.removeAttribute('hidden');
});
document.getElementById('hide-controls')?.addEventListener('click', () => {
  document.getElementById('pause-controls')?.setAttribute('hidden', '');
  document.getElementById('pause-menu')?.removeAttribute('hidden');
});
document.getElementById('to-menu')?.addEventListener('click', () => {
  // Volta à tela inicial e começa uma nova partida na próxima "Nova missão".
  started = false;
  paused = false;
  game = createGame({ installation: INSTALLATION });
  visualTime = 0;
  resetScenePresentation(INSTALLATION.panels);
  ui.greenhouse.value = INSTALLATION.greenhouse;
  setMessage('');
  renderNow();
  document.getElementById('pause')?.setAttribute('hidden', '');
  document.getElementById('brief')?.setAttribute('hidden', '');
  document.getElementById('title')?.removeAttribute('hidden');
  document.getElementById('title-menu')?.removeAttribute('hidden');
  document.getElementById('title-credits')?.setAttribute('hidden', '');
});
window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && started) setPaused(!paused);
});

// Modelos GLB: carregam em segundo plano; até lá, as formas provisórias da cena continuam visíveis.
loadBaseModels().catch((error: unknown) => console.error('modelos 3D não carregaram:', error));
loadCrewModels().catch((error: unknown) => console.error('astronautas não carregaram:', error));
// Pré-compila os shaders com a cena montada: evita o travamento na primeira vez que cada material aparece.
Promise.allSettled([loadBaseModels(), loadCrewModels()]).then(() => renderer.compile(scene, camera));

// Contador de quadros: ?perf=1 na URL mostra FPS e carga de desenho (para medir em qualquer máquina).
const perfEl = new URLSearchParams(window.location.search).has('perf') ? document.createElement('div') : null;
if (perfEl) {
  perfEl.id = 'perf';
  perfEl.style.cssText = 'position:fixed;left:50%;bottom:44px;transform:translateX(-50%);z-index:20;background:rgba(0,0,0,0.6);color:#fff;font:12px monospace;padding:4px 8px;border-radius:6px';
  document.body.appendChild(perfEl);
}
let perfFrames = 0;
let perfSince = 0;
requestAnimationFrame(frame);
