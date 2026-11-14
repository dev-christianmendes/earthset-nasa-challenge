// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// HUD em DOM: lê o estado do motor e mostra; o modo escola e os alertas moram aqui. Sem regra de jogo.
import type { GameState } from '../engine/game';
import { outcomeOf } from '../engine/game';
import { MAX_PANELS, MAX_QUEUE, type TaskKind } from '../engine/robot';
import { MATCH_HOURS } from '../engine/clock';
import type { GreenhouseMode } from '../engine/resources';
import { EXPLANATIONS, SCHOOL_LABELS, type Explanation } from '../school';

export const TASK_LABEL: Record<TaskKind, string> = { ice: 'Gelo', panel: 'Painel', antenna: 'Antena' };
export const GREENHOUSE_LABEL: Record<GreenhouseMode, string> = {
  off: 'Desligada',
  always: 'Sempre ligada',
  surplus: 'Só com sobra',
};

// ---------- Elementos da tela ----------

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`elemento ausente na página: #${id}`);
  return found as T;
}

export const ui = {
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

for (const mode of Object.keys(GREENHOUSE_LABEL) as GreenhouseMode[]) {
  const opt = document.createElement('option');
  opt.value = mode;
  opt.textContent = GREENHOUSE_LABEL[mode];
  ui.greenhouse.appendChild(opt);
}

// ---------- Modo escola (B3.4) ----------

const schoolToggle = el<HTMLInputElement>('school-mode');

// Guarda o texto normal de cada rótulo, para voltar a ele ao desligar o modo escola.
for (const node of document.querySelectorAll<HTMLElement>('[data-label]')) {
  node.dataset.normal = node.textContent ?? '';
}

function fillHint(node: HTMLElement, text: Explanation): void {
  const lines: Array<[string, string]> = [
    ['O que é: ', text.what],
    ['Por que muda: ', text.why],
    ['Fonte: ', text.source],
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
for (const node of document.querySelectorAll<HTMLElement>('[data-hint]')) {
  const text = EXPLANATIONS[node.dataset.hint ?? ''];
  if (text) fillHint(node, text);
}

function applySchoolMode(on: boolean): void {
  document.body.classList.toggle('school', on);
  for (const node of document.querySelectorAll<HTMLElement>('[data-label]')) {
    const school = SCHOOL_LABELS[node.dataset.label ?? ''];
    node.textContent = on && school ? school : (node.dataset.normal ?? '');
  }
}
schoolToggle.addEventListener('change', () => applySchoolMode(schoolToggle.checked));
// O navegador pode lembrar o estado da caixa ao recarregar a página.
applySchoolMode(schoolToggle.checked);

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

export function renderHud(state: GameState): void {
  const { vitals, installation, hearts, clock, robot: r } = state;
  ui.hour.textContent = String(Math.floor(clock.hour));
  ui.hearts.textContent = '♥'.repeat(hearts) + '♡'.repeat(Math.max(0, 3 - hearts));

  const batteryPct = pct(vitals.battery, installation.batteryCapacity);
  setBar(ui.batBar, ui.batVal, batteryPct, `${Math.round(batteryPct)}%`, batteryPct < LOW_ALERT_PERCENT.battery);
  setBar(ui.airBar, ui.airVal, pct(vitals.air, 100), `${Math.round(vitals.air)}`, vitals.air < LOW_ALERT_PERCENT.air);
  setBar(ui.waterBar, ui.waterVal, pct(vitals.water, 100), `${Math.round(vitals.water)}`, vitals.water < LOW_ALERT_PERCENT.water);
  setBar(ui.foodBar, ui.foodVal, pct(vitals.food, 100), `${Math.round(vitals.food)}`, vitals.food < LOW_ALERT_PERCENT.food);

  ui.panels.textContent = `${installation.panels} de ${MAX_PANELS}`;
  ui.greenhouse.value = installation.greenhouse;

  ui.queue.replaceChildren();
  if (r.queue.length === 0) {
    const li = document.createElement('li');
    li.className = 'empty';
    li.textContent = 'Robô ocioso';
    ui.queue.appendChild(li);
  }
  r.queue.forEach((task, index) => {
    const li = document.createElement('li');
    const label = document.createElement('span');
    label.textContent = `${index + 1}. ${TASK_LABEL[task.kind]} · ${task.hoursLeft.toFixed(1)} h`;
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.dataset.cancel = String(index);
    cancel.textContent = '×';
    cancel.setAttribute('aria-label', `Cancelar ${TASK_LABEL[task.kind]}`);
    li.append(label, cancel);
    ui.queue.appendChild(li);
  });

  const full = r.queue.length >= MAX_QUEUE;
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-task]')) {
    button.disabled = outcomeOf(state) !== 'playing' || full;
  }

  const outcome = outcomeOf(state);
  ui.overlay.hidden = outcome === 'playing';
  if (outcome === 'lost') {
    ui.overlayTitle.textContent = 'A base foi perdida';
    ui.overlayText.textContent = `Os corações acabaram na hora ${Math.floor(clock.hour)}. Sem energia, ar, água ou comida por tempo demais.`;
  } else if (outcome === 'won') {
    ui.overlayTitle.textContent = 'Um dia lunar sobrevivido';
    ui.overlayText.textContent = `A base chegou às ${MATCH_HOURS} horas com ${hearts} de 3 corações.`;
  }
}

