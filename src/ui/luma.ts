// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Painel da LUMA (comunicação de missão): orientação atual, eventos recentes, histórico, atalho e minimizar.
// O conteúdo vem do motor (src/engine/guide.ts, por regras); aqui só há apresentação.
import type { LumaAction, LumaAdvice, LumaEvent } from '../engine/guide';
import { t } from '../i18n';

const box = document.getElementById('luma') as HTMLElement;
const text = document.getElementById('luma-text') as HTMLElement;
const actionBtn = document.getElementById('luma-action') as HTMLButtonElement;
const history = document.getElementById('luma-history') as HTMLOListElement;
const historyBtn = document.getElementById('luma-history-btn') as HTMLButtonElement;
const minBtn = document.getElementById('luma-min') as HTMLButtonElement;

/** Tempo (ms reais) que um evento fica em destaque antes de voltar à orientação atual. */
const EVENT_MS = 7000;
const HISTORY_MAX = 30;

interface Entry {
  readonly hour: number;
  readonly key: string;
  readonly vars: Readonly<Record<string, string | number>>;
}

let current: LumaAdvice | null = null;
let event: (LumaEvent & { until: number }) | null = null;
let entries: Entry[] = [];
let shownKey = '';
let onAction: (action: LumaAction) => void = () => {};

export function initLuma(handler: (action: LumaAction) => void): void {
  onAction = handler;
}

actionBtn.addEventListener('click', () => {
  const action = (event ?? current)?.action;
  if (action) onAction(action);
});
historyBtn.addEventListener('click', () => {
  history.hidden = !history.hidden;
  box.classList.remove('min');
});
minBtn.addEventListener('click', () => box.classList.toggle('min'));

function show(msg: LumaAdvice, now: number): void {
  const key = `${msg.key}|${JSON.stringify(msg.vars)}|${t('luma.name')}`;
  if (key === shownKey) return;
  shownKey = key;
  text.textContent = t(msg.key, msg.vars);
  box.classList.remove('info', 'warning', 'critical', 'fresh');
  void box.offsetWidth; // reinicia a animação de chegada
  box.classList.add(msg.severity, 'fresh');
  actionBtn.hidden = msg.action === null;
  if (msg.action) actionBtn.textContent = t(`luma.action.${msg.action}`);
  // Mensagem crítica abre o painel minimizado.
  if (msg.severity === 'critical') box.classList.remove('min');
  void now;
}

function renderHistory(): void {
  history.replaceChildren(
    ...entries
      .slice()
      .reverse()
      .map((e) => {
        const item = document.createElement('li');
        const time = document.createElement('time');
        time.textContent = `h${Math.floor(e.hour)}`;
        item.append(time, t(e.key, e.vars));
        return item;
      }),
  );
}

function remember(hour: number, msg: LumaAdvice): void {
  const last = entries[entries.length - 1];
  if (last && last.key === msg.key && JSON.stringify(last.vars) === JSON.stringify(msg.vars)) return;
  entries.push({ hour, key: msg.key, vars: msg.vars });
  if (entries.length > HISTORY_MAX) entries = entries.slice(-HISTORY_MAX);
  renderHistory();
}

/** Orientação atual (chamada a cada atualização do HUD). */
export function updateLuma(advice: LumaAdvice, hour: number, now: number): void {
  if (!current || current.key !== advice.key || JSON.stringify(current.vars) !== JSON.stringify(advice.vars)) {
    remember(hour, advice);
  }
  current = advice;
  if (event && now < event.until && advice.severity !== 'critical') {
    show(event, now);
    return;
  }
  event = null;
  show(advice, now);
}

/** Eventos pontuais do motor (missão concluída, rover voltando, capítulo, radiação). */
export function pushLumaEvents(events: readonly LumaEvent[], hour: number, now: number): void {
  for (const e of events) {
    remember(hour, e);
    event = { ...e, until: now + EVENT_MS };
  }
  if (event) show(event, now);
}

/** Reinicia o histórico (nova missão) e redesenha no idioma atual. */
export function resetLuma(): void {
  entries = [];
  current = null;
  event = null;
  shownKey = '';
  history.replaceChildren();
  history.hidden = true;
  box.classList.remove('min');
}

/** Redesenha os textos ao trocar de idioma. */
export function relabelLuma(): void {
  shownKey = '';
  renderHistory();
  const msg = event ?? current;
  if (msg) show(msg, 0);
}
