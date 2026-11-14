// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Telas fora da partida (menu, modos, história, como jogar, ciência, configurações, créditos, pausa, fim)
// e configurações do jogador. Só DOM; nenhuma regra de jogo.

export type ScreenId = 'loading' | 'menu' | 'modes' | 'story' | 'howto' | 'science' | 'settings' | 'credits' | 'pause' | 'end';

const ALL: readonly ScreenId[] = ['loading', 'menu', 'modes', 'story', 'howto', 'science', 'settings', 'credits', 'pause', 'end'];
/** Telas abertas por cima de outra (voltar retorna à anterior). */
const stack: ScreenId[] = [];
const listeners: Array<(id: ScreenId | null) => void> = [];

function node(id: ScreenId): HTMLElement {
  const found = document.getElementById(id);
  if (!found) throw new Error(`tela ausente: #${id}`);
  return found;
}

function render(): void {
  const top = stack[stack.length - 1] ?? null;
  for (const id of ALL) node(id).hidden = id !== top;
  document.body.dataset.screen = top ?? 'game';
  for (const fn of listeners) fn(top);
}

/** Troca a tela de base (zera a pilha). null = nenhuma tela: a partida aparece. */
export function showScreen(id: ScreenId | null): void {
  stack.length = 0;
  if (id) stack.push(id);
  render();
}

/** Abre uma tela por cima da atual. */
export function pushScreen(id: ScreenId): void {
  if (stack[stack.length - 1] !== id) stack.push(id);
  render();
}

/** Volta à tela anterior. */
export function popScreen(): void {
  stack.pop();
  render();
}

export function currentScreen(): ScreenId | null {
  return stack[stack.length - 1] ?? null;
}

export function onScreenChange(fn: (id: ScreenId | null) => void): void {
  listeners.push(fn);
}

// ---------- Configurações (guardadas no navegador; falham em silêncio em janela privada) ----------

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
    // sem armazenamento: vale só nesta página
  }
}
