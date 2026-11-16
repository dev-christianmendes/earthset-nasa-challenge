// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.

export type ScreenId = 'loading' | 'menu' | 'modes' | 'story' | 'howto' | 'science' | 'settings' | 'credits' | 'pause' | 'end';

const ALL: readonly ScreenId[] = ['loading', 'menu', 'modes', 'story', 'howto', 'science', 'settings', 'credits', 'pause', 'end'];
interface ScreenFrame {
  id: ScreenId;
  returnFocus: HTMLElement | null;
}
const stack: ScreenFrame[] = [];
const listeners: Array<(id: ScreenId | null) => void> = [];

function node(id: ScreenId): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`tela ausente: #${id}`);
  return found;
}

const FOCUSABLE = 'button, a[href], input, select, textarea, [tabindex]';

function canFocus(element: HTMLElement): boolean {
  return element.isConnected && !element.closest('[hidden], [inert]')
    && !element.matches(':disabled') && element.getClientRects().length > 0;
}

function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)]
    .filter((element) => element.tabIndex >= 0 && canFocus(element));
}

function render(restore: HTMLElement | null = null): void {
  const top = currentScreen();
  for (const id of ALL) {
    const screen = node(id);
    screen.hidden = id !== top;
    screen.inert = id !== top;
    if (screen.classList.contains('screen-panel')) {
      screen.setAttribute('role', 'dialog');
      screen.setAttribute('aria-modal', String(id === top));
    }
  }
  for (const background of document.querySelectorAll<HTMLElement>('#hud, #cine, canvas')) background.inert = top !== null;
  document.body.dataset.screen = top ?? 'game';
  for (const fn of listeners) fn(top);
  if (restore && canFocus(restore) && (!top || node(top).contains(restore))) {
    restore.focus({ preventScroll: true });
  } else if (top) {
    const screen = node(top);
    screen.tabIndex = -1;
    (focusables(screen)[0] ?? screen).focus({ preventScroll: true });
  } else {
    const resumeTarget = document.getElementById('pause-btn');
    if (resumeTarget && canFocus(resumeTarget)) resumeTarget.focus({ preventScroll: true });
    else if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  }
}

document.addEventListener('keydown', (event) => {
  const top = currentScreen();
  if (!top || event.key !== 'Tab') return;
  const screen = node(top);
  const controls = focusables(screen);
  const active = document.activeElement;
  const first = controls[0] ?? screen;
  const last = controls[controls.length - 1] ?? screen;
  if (!screen.contains(active) || active === screen || (event.shiftKey ? active === first : active === last)) {
    event.preventDefault();
    (event.shiftKey ? last : first).focus();
  }
});

/** Troca a tela de base (zera a pilha). null = nenhuma tela: a partida aparece. */
export function showScreen(id: ScreenId | null): void {
  const restore = stack[0]?.returnFocus ?? null;
  stack.length = 0;
  if (id) stack.push({ id, returnFocus: null });
  render(id ? null : restore);
}

export function pushScreen(id: ScreenId): void {
  if (currentScreen() === id) return;
  const returnFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  stack.push({ id, returnFocus });
  render();
}

export function popScreen(): void {
  const frame = stack.pop();
  render(frame?.returnFocus ?? null);
}

export function currentScreen(): ScreenId | null {
  return stack[stack.length - 1]?.id ?? null;
}

export function onScreenChange(fn: (id: ScreenId | null) => void): void {
  listeners.push(fn);
}

export interface Settings {
  intro: boolean;
  reducedMotion: boolean;
  explanations: boolean;
  quality: boolean;
}

const KEY = 'earthset-settings';

export function loadSettings(): Settings {
  const prefersReduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fallback: Settings = { intro: true, reducedMotion: prefersReduced, explanations: false, quality: true };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return fallback;
    const saved = JSON.parse(raw) as Partial<Settings>;
    return {
      intro: typeof saved.intro === 'boolean' ? saved.intro : fallback.intro,
      reducedMotion: typeof saved.reducedMotion === 'boolean' ? saved.reducedMotion : fallback.reducedMotion,
      explanations: typeof saved.explanations === 'boolean' ? saved.explanations : fallback.explanations,
      quality: typeof saved.quality === 'boolean' ? saved.quality : fallback.quality,
    };
  } catch {
    return fallback;
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
  }
}
