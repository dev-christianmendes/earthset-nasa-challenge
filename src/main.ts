// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Ponto de entrada: liga motor (src/engine), cena (src/render), HUD (src/ui) e o laço do jogo.
import { advance, createGame, dispatch, outcomeOf, type GameAction, type GameState } from './engine/game';
import type { GreenhouseMode, Installation } from './engine/resources';
import type { TaskKind } from './engine/robot';
import { isSunlit } from './engine/sun';
import { SUN } from './data/sun';
import { TERRAIN } from './data/terrain';
import { camera, frameForViewport, renderer, scene, updateScene } from './render/scene';
import { renderHud, ui } from './ui/hud';

/** Configuração inicial da base. Valores de equilíbrio do motor (docs/regras-recursos.md). */
const INSTALLATION: Installation = {
  rank: 'explorador',
  site: 'slope',
  panels: 2,
  batteryCapacity: 1200,
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
    setMessage(result.reason);
  }
  renderHud(game);
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

ui.restart.addEventListener('click', () => {
  game = createGame({ installation: INSTALLATION });
  ui.greenhouse.value = INSTALLATION.greenhouse;
  setMessage('');
  renderHud(game);
});

// ---------- Sol (ilustrativo) ----------

/** A base recebe Sol nessa hora? Tabela real, com o horizonte local do site (ilustrativo). */
function sunlit(hour: number): boolean {
  return isSunlit(SUN, hour, INSTALLATION.site, TERRAIN);
}

// ---------- Laço do jogo ----------

let last: number | null = null;

function frame(now: number): void {
  if (last !== null && outcomeOf(game) === 'playing') {
    const seconds = Math.min(Math.max(0, (now - last) / 1000), MAX_FRAME_SECONDS);
    game = advance(game, seconds * HOURS_PER_SECOND, sunlit(game.clock.hour));
  }
  last = now;
  updateScene(game, now, sunlit(game.clock.hour));
  renderHud(game);
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
renderHud(game);
requestAnimationFrame(frame);

