// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// HUD em DOM: lê o estado do motor e mostra; modo escola, alertas e idioma moram aqui. Sem regra de jogo.
import type { GameState } from '../engine/game';
import { outcomeOf } from '../engine/game';
import { MAX_PANELS, MAX_QUEUE, type TaskKind } from '../engine/robot';
import { MATCH_HOURS } from '../engine/clock';
import type { GreenhouseMode } from '../engine/resources';
import { solarFactor, stormLevel, type SpaceWeatherSample } from '../engine/space-weather';
import { EXPLANATIONS, HINT_TITLES, SCHOOL_LABELS } from '../school';
import { applyStatic, getLang, loadLang, setLang, t, type Lang } from '../i18n';

const GREENHOUSE_KEYS: Record<GreenhouseMode, string> = {
  off: 'greenhouse.off',
  always: 'greenhouse.always',
  surplus: 'greenhouse.surplus',
};

// ---------- Elementos da tela ----------

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`elemento ausente na página: #${id}`);
  return found as T;
}

export const ui = {
  space: el('space'),
  hour: el('hour'),
  hearts: el('hearts'),
  batBar: el('bar-battery'),
  airBar: el('bar-air'),
  waterBar: el('bar-water'),
  foodBar: el('bar-food'),
  batVal: el('val-battery'),
  airVal: el('val-air'),
  waterVal: el('val-water'),
  foodVal: el('val-food'),
  panels: el('panels'),
  queue: el('queue'),
  greenhouse: el<HTMLSelectElement>('greenhouse'),
  message: el('message'),
  overlay: el('overlay'),
  overlayTitle: el('overlay-title'),
  overlayText: el('overlay-text'),
  restart: el('restart'),
};
const schoolToggle = el<HTMLInputElement>('school-mode');
const langButton = el<HTMLButtonElement>('lang');
/** Última fila desenhada (referência). Zerada ao trocar de idioma, para reescrever os textos. */
let lastQueue: unknown = null;

// ---------- Idioma ----------

/** Opções da estufa, no idioma atual (mantém o modo escolhido). */
function buildGreenhouseOptions(): void {
  const keep = ui.greenhouse.value;
  ui.greenhouse.replaceChildren(
    ...(Object.keys(GREENHOUSE_KEYS) as GreenhouseMode[]).map((mode) => {
      const opt = document.createElement('option');
      opt.value = mode;
      opt.textContent = t(GREENHOUSE_KEYS[mode]);
      return opt;
    }),
  );
  if (keep) ui.greenhouse.value = keep;
}

function fillHint(node: HTMLElement, lang: Lang): void {
  const text = EXPLANATIONS[node.dataset.hint ?? '']?.[lang];
  if (!text) return;
  const titles = HINT_TITLES[lang];
  const lines: Array<[string, string]> = [
    [titles.what, text.what],
    [titles.why, text.why],
    [titles.source, text.source],
  ];
  node.replaceChildren(
    ...lines.map(([title, body]) => {
      const line = document.createElement('span');
      const strong = document.createElement('b');
      strong.textContent = title;
      line.append(strong, body);
      return line;
    }),
  );
}

// ---------- Modo escola (B3.4) ----------

function applySchoolMode(on: boolean): void {
  const lang = getLang();
  document.body.classList.toggle('school', on);
  for (const node of document.querySelectorAll<HTMLElement>('[data-label]')) {
    const school = SCHOOL_LABELS[node.dataset.label ?? '']?.[lang];
    node.textContent = on && school ? school : t(node.dataset.i18n ?? '');
  }
}

/** Troca o idioma de tudo que está na tela. A cena não tem texto. */
export function applyLanguage(lang: Lang): void {
  setLang(lang);
  applyStatic();
  buildGreenhouseOptions();
  for (const node of document.querySelectorAll<HTMLElement>('[data-hint]')) fillHint(node, lang);
  applySchoolMode(schoolToggle.checked);
  langButton.textContent = t('hud.lang');
  lastQueue = null;
}

schoolToggle.addEventListener('change', () => applySchoolMode(schoolToggle.checked));
langButton.addEventListener('click', () => applyLanguage(getLang() === 'en' ? 'pt' : 'en'));

// Ao carregar: idioma guardado (padrão inglês) e modo escola (o navegador pode lembrar a caixa).
applyLanguage(loadLang());

// ---------- HUD ----------

function pct(value: number, max: number): number {
  return Math.max(0, Math.min(100, (value / max) * 100));
}

/** Abaixo desses valores (em %), o recurso aparece em vermelho no HUD (alerta, B3.1). */
const LOW_ALERT_PERCENT = { battery: 20, air: 30, water: 20, food: 20 } as const;

function setBar(bar: HTMLElement, value: HTMLElement, percent: number, text: string, low: boolean): void {
  bar.style.width = `${percent.toFixed(1)}%`;
  value.textContent = text;
  bar.closest('.meter')?.classList.toggle('low', low);
}

export function renderHud(state: GameState, weather: SpaceWeatherSample, warningHours: number | null = null): void {
  const { vitals, installation, hearts, clock, robot: r } = state;
  ui.hour.textContent = String(Math.floor(clock.hour));
  ui.hearts.textContent = '♥'.repeat(hearts) + '♡'.repeat(Math.max(0, 3 - hearts));

  const batteryPct = pct(vitals.battery, installation.batteryCapacity);
  setBar(ui.batBar, ui.batVal, batteryPct, `${Math.round(batteryPct)}%`, batteryPct < LOW_ALERT_PERCENT.battery);
  setBar(ui.airBar, ui.airVal, pct(vitals.air, 100), `${Math.round(vitals.air)}`, vitals.air < LOW_ALERT_PERCENT.air);
  setBar(ui.waterBar, ui.waterVal, pct(vitals.water, 100), `${Math.round(vitals.water)}`, vitals.water < LOW_ALERT_PERCENT.water);
  setBar(ui.foodBar, ui.foodVal, pct(vitals.food, 100), `${Math.round(vitals.food)}`, vitals.food < LOW_ALERT_PERCENT.food);

  ui.panels.textContent = `${installation.panels} / ${MAX_PANELS}`;

  const level = stormLevel(weather.kp);
  const storm =
    level === 0
      ? t('space.calm')
      : t('space.storm', { level, percent: Math.round(solarFactor(level) * 100) });
  const base = weather.radiation ? t('space.radiation', { storm }) : storm;
  // Aviso da antena (D-01): só quando não há tempestade agora e a antena está instalada.
  ui.space.textContent = warningHours !== null && level === 0 && !weather.radiation
    ? `${base} · ${t('space.warning', { hours: warningHours })}`
    : base;
  ui.space.classList.toggle('storm', level > 0 || weather.radiation);
  ui.greenhouse.value = installation.greenhouse;

  // A fila só é reconstruída quando muda (ou quando o idioma muda): evita trabalho de DOM a cada atualização.
  if (r.queue !== lastQueue) {
    lastQueue = r.queue;
    rebuildQueue(state);
  }

  const full = r.queue.length >= MAX_QUEUE;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-task]')) {
    button.disabled = outcomeOf(state) !== 'playing' || full;
  }

  const outcome = outcomeOf(state);
  ui.overlay.hidden = outcome === 'playing';
  if (outcome === 'lost') {
    ui.overlayTitle.textContent = t('overlay.lost.title');
    ui.overlayText.textContent = t('overlay.lost.text', { hour: Math.floor(clock.hour) });
  } else if (outcome === 'won') {
    ui.overlayTitle.textContent = t('overlay.won.title');
    ui.overlayText.textContent = t('overlay.won.text', { hours: MATCH_HOURS, hearts });
  }
}

function rebuildQueue(state: GameState): void {
  const r = state.robot;
  const taskLabel = (kind: TaskKind): string => t(`task.${kind}`);
  ui.queue.replaceChildren();
  if (r.queue.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = t('hud.idle');
    ui.queue.appendChild(li);
  }
  r.queue.forEach((task, index) => {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = t('hud.queueItem', {
      n: index + 1,
      task: taskLabel(task.kind),
      hours: task.hoursLeft.toFixed(1),
    });
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.dataset.cancel = String(index);
    cancel.textContent = '×';
    cancel.setAttribute('aria-label', t('hud.cancel', { task: taskLabel(task.kind) }));
    li.append(label, cancel);
    ui.queue.appendChild(li);
  });

}
