// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Ponto de entrada: liga motor (src/engine), cena (src/render), HUD (src/ui) e o laço do jogo.
import { advance, createGame, dispatch, outcomeOf, type GameAction, type GameState } from './engine/game';
import type { GreenhouseMode, Installation } from './engine/resources';
import type { TaskKind } from './engine/robot';
import { isSunlit } from './engine/sun';
import { SUN } from './data/sun';
import { TERRAIN } from './data/terrain';
import { WEATHER } from './data/space-weather';
import { weatherAt, type SpaceWeatherSample } from './engine/space-weather';
import { camera, controls, frameForViewport, loadBaseModels, renderer, resetView, scene, updateScene } from './render/scene';
import { renderHud, ui } from './ui/hud';
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
  renderHud(game, currentWeather());
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
  ui.greenhouse.value = INSTALLATION.greenhouse;
  setMessage('');
  renderHud(game, currentWeather());
});

// ---------- Clima espacial (C2) ----------

/** Clima da hora atual do cenário de 09/10/2024 (NASA DONKI). */
function currentWeather(): SpaceWeatherSample {
  return weatherAt(WEATHER, game.clock.hour);
}

// ---------- Sol (ilustrativo) ----------

/** A base recebe Sol nessa hora? Tabela real, com o horizonte local do site (ilustrativo). */
function sunlit(hour: number): boolean {
  return isSunlit(SUN, hour, INSTALLATION.site, TERRAIN);
}

// ---------- Laço do jogo ----------

let last: number | null = null;
let hudDueAt = 0;
/** Intervalo de atualização do HUD (ms). Ações do jogador atualizam na hora. */
const HUD_INTERVAL_MS = 100;

const updateHorizon = mountHorizonPanel(document.getElementById('horizon-panel') as HTMLElement, SUN, TERRAIN, INSTALLATION.site);

function frame(now: number): void {
  if (last !== null && outcomeOf(game) === 'playing') {
    const seconds = Math.min(Math.max(0, (now - last) / 1000), MAX_FRAME_SECONDS);
    game = advance(game, seconds * HOURS_PER_SECOND, sunlit(game.clock.hour), currentWeather());
  }
  last = now;
  updateScene(game, now, sunlit(game.clock.hour), currentWeather());
  updateHorizon(game.clock.hour);
  controls.update();
  // O HUD é atualizado a cada HUD_INTERVAL_MS, não a cada quadro: a cena continua na taxa do navegador.
  if (now >= hudDueAt) {
    renderHud(game, currentWeather());
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
renderHud(game, currentWeather());
// Modelos GLB: carregam em segundo plano; até lá, as formas provisórias da cena continuam visíveis.
loadBaseModels().catch((error: unknown) => console.error('modelos 3D não carregaram:', error));
requestAnimationFrame(frame);
