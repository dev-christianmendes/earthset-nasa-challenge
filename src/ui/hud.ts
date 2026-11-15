// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// HUD de jogo (Earthset 4.0): barra superior, barra de ferramentas, painel lateral por sistema e tela de fim.
// Só lê o estado do motor e mostra; ações vão para main.ts por eventos. Sem regra de jogo aqui.
import type { GameState } from '../engine/game';
import { outcomeOf } from '../engine/game';
import { MAX_PANELS, MAX_QUEUE, TASK_HOURS, isWorking, type TaskKind } from '../engine/robot';
import { MATCH_HOURS } from '../engine/clock';
import { deriveFlow, isGreenhouseOn, type GreenhouseMode } from '../engine/resources';
import type { SpaceWeatherSample } from '../engine/space-weather';
import { safeStatus } from '../engine/safe-mode';
import type { AlertView } from '../engine/alert';
import { crewOutside } from '../engine/crew';
import { hoursToReady } from '../engine/greenhouse';
import { chaptersOf, currentChapter } from '../engine/chapters';
import { missionPhase, phaseProgress, PHASES, type MissionPhase } from '../engine/mission';
import type { ModeConfig } from '../engine/modes';
import { EXPLANATIONS, HINT_TITLES } from '../school';
import { applyStatic, getLang, loadLang, setLang, t, type Lang } from '../i18n';
import { iconSvg, mountIcons } from './icons';

export type Tool = 'base' | 'rover' | 'crew' | 'energy' | 'greenhouse' | 'missions' | 'science';

export interface HudContext {
  readonly weather: SpaceWeatherSample;
  /** Horas até a tempestade (aviso da antena) ou null. */
  readonly alert: AlertView;
  readonly lit: boolean;
  readonly mode: ModeConfig;
  readonly explanations: boolean;
}

function el<T extends HTMLElement>(id: string): T {
  const found = document.getElementById(id);
  if (!found) throw new Error(`elemento ausente na página: #${id}`);
  return found as T;
}

export const ui = {
  hud: el('hud'),
  hour: el('hour'),
  clockFill: el('clock-fill'),
  nightMark: el('night-mark'),
  sunState: el('sun-state'),
  hearts: el('hearts'),
  space: el('space'),
  flows: el('flows'),
  chapterNum: el('chapter-num'),
  chapterName: el('chapter-name'),
  chapterChip: el('chapter-chip'),
  side: el('side'),
  sideTitle: el('side-title'),
  queue: el('queue'),
  message: el('message'),
  process: el('process'),
  processSteps: el('process-steps'),
  roverBadge: el('rover-badge'),
  panelNote: el('panel-count-note'),
  toast: el('toast'),
};

// ---------- Idioma ----------

const langListeners: Array<() => void> = [];
/** Quem precisa redesenhar texto ao trocar de idioma (LUMA, capítulos da história). */
export function onLanguage(fn: () => void): void {
  langListeners.push(fn);
}

/** Troca o idioma de tudo o que está na tela. A cena 3D não tem texto. */
export function applyLanguage(lang: Lang): void {
  setLang(lang);
  applyStatic();
  mountIcons();
  invalidate();
  for (const fn of langListeners) fn();
}

for (const button of document.querySelectorAll<HTMLButtonElement>('[data-lang-toggle]')) {
  button.addEventListener('click', () => applyLanguage(getLang() === 'en' ? 'pt' : 'en'));
}

// ---------- Painel lateral ----------

let openTool: Tool | null = null;
const toolListeners: Array<(tool: Tool | null) => void> = [];

export function onTool(fn: (tool: Tool | null) => void): void {
  toolListeners.push(fn);
}

export function setTool(tool: Tool | null): void {
  openTool = openTool === tool ? null : tool;
  ui.side.hidden = openTool === null;
  for (const body of ui.side.querySelectorAll<HTMLElement>('[data-panel]')) body.hidden = body.dataset.panel !== openTool;
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-tool]')) b.classList.toggle('active', b.dataset.tool === openTool);
  if (openTool) ui.sideTitle.textContent = t(`tool.${openTool}`);
  invalidate();
  for (const fn of toolListeners) fn(openTool);
}

/** Abre o painel (sem alternar). */
export function openPanel(tool: Tool): void {
  if (openTool !== tool) setTool(tool);
}

export function currentTool(): Tool | null {
  return openTool;
}

for (const b of document.querySelectorAll<HTMLButtonElement>('[data-tool]')) {
  b.addEventListener('click', () => setTool(b.dataset.tool as Tool));
}
el('side-close').addEventListener('click', () => setTool(null));

// ---------- Utilitários ----------

function pct(value: number, max: number): number {
  return Math.max(0, Math.min(100, (value / max) * 100));
}

/** Abaixo desses valores (em %), o recurso pisca em coral (alerta). */
const LOW_ALERT_PERCENT = { battery: 20, air: 30, water: 20, food: 20 } as const;

function setChip(res: keyof typeof LOW_ALERT_PERCENT, percent: number, text: string): void {
  el(`bar-${res}`).style.width = `${percent.toFixed(1)}%`;
  el(`val-${res}`).textContent = text;
  document.querySelector(`.chip[data-res="${res}"]`)?.classList.toggle('low', percent < LOW_ALERT_PERCENT[res]);
}

function li(label: string, value: string, tone: '' | 'ok' | 'warn' | 'bad' = ''): HTMLLIElement {
  const item = document.createElement('li');
  if (tone) item.className = tone;
  const a = document.createElement('span');
  a.textContent = label;
  const b = document.createElement('b');
  b.textContent = value;
  item.append(a, b);
  return item;
}

/** Explicação "o quê / por quê / fonte" (modo escola), para o modo Explorador ou a configuração. */
function explanation(key: string, lang: Lang): HTMLParagraphElement | null {
  const text = EXPLANATIONS[key]?.[lang];
  if (!text) return null;
  const titles = HINT_TITLES[lang];
  const p = document.createElement('p');
  for (const [title, body] of [[titles.what, text.what], [titles.why, text.why], [titles.source, text.source]] as const) {
    const b = document.createElement('b');
    b.textContent = `${title} `;
    p.append(b, body, document.createElement('br'));
  }
  return p;
}

// ---------- Mapa de luz (noite longa) ----------

/** Recebe a luz por hora (tabela real) para mostrar a longa noite na barra do relógio e no painel de energia. */
export function setLightMap(map: readonly boolean[]): void {
  // Maior trecho de sombra = longa noite.
  let best: [number, number] = [0, 0];
  let start = -1;
  for (let h = 0; h <= map.length; h++) {
    const dark = h < map.length && !map[h];
    if (dark && start < 0) start = h;
    if (!dark && start >= 0) {
      if (h - start > best[1] - best[0]) best = [start, h];
      start = -1;
    }
  }
  night = best;
  ui.nightMark.style.left = `${(best[0] / MATCH_HOURS) * 100}%`;
  ui.nightMark.style.width = `${((best[1] - best[0]) / MATCH_HOURS) * 100}%`;
}
let night: [number, number] = [0, 0];

// ---------- Desenho ----------

let lastKey = '';
let lastQueue: unknown = null;
function invalidate(): void {
  lastKey = '';
  lastQueue = null;
}

const PHASE_ORDER: Record<MissionPhase, number> = { prep: 0, travel: 1, operate: 2, return: 3, deliver: 4 };

function phaseText(phase: MissionPhase, kind: TaskKind): string {
  if (phase === 'operate' || phase === 'deliver') return t(`phase.${phase}.${kind}`);
  return t(`phase.${phase}`);
}

function renderTop(state: GameState, ctx: HudContext): void {
  const { vitals, installation, hearts, clock } = state;
  ui.hour.textContent = String(Math.floor(clock.hour));
  ui.clockFill.style.width = `${pct(clock.hour, MATCH_HOURS)}%`;
  ui.sunState.textContent = ctx.lit ? t('sun.lit') : t('sun.dark');
  ui.sunState.className = `sun-state ${ctx.lit ? 'lit' : 'dark'}`;
  const heartsKey = `${hearts}`;
  if (ui.hearts.dataset.k !== heartsKey) {
    ui.hearts.dataset.k = heartsKey;
    ui.hearts.innerHTML = [0, 1, 2].map((i) => `<span class="${i < hearts ? '' : 'lost'}">${iconSvg(i < hearts ? 'heartFill' : 'heart')}</span>`).join('');
  }
  const batteryPct = pct(vitals.battery, installation.batteryCapacity);
  setChip('battery', batteryPct, `${Math.round(batteryPct)}%`);
  setChip('air', vitals.air, `${Math.round(vitals.air)}`);
  setChip('water', vitals.water, `${Math.round(vitals.water)}`);
  setChip('food', vitals.food, `${Math.round(vitals.food)}`);

  const al = ctx.alert;
  let text = t('space.calm');
  let tone = '';
  if (al.level === 'monitoring' && al.precursor) {
    text = t(`space.monitoring.${al.precursor.type}`);
    tone = 'warn';
  } else if (al.level === 'alert' || al.level === 'shelter') {
    text = t(al.level === 'alert' && state.crewOrder === 'outside' ? 'space.outside' : `space.${al.level}`);
    tone = 'bad';
  } else if (al.level === 'recovery') {
    text = t('space.recovery', { hours: Math.ceil(al.recoveryLeft) });
    tone = 'warn';
  }
  ui.space.title = al.evidence ? `NASA DONKI ${al.evidence.id}` : al.precursor ? `NASA DONKI ${al.precursor.id}` : '';
  if (ui.space.textContent !== text) ui.space.textContent = text;
  ui.space.className = `alert-chip ${tone}`;

  const ch = currentChapter(state);
  ui.chapterNum.textContent = String(ch);
  const chName = t(`chapter.${ch}`);
  if (ui.chapterName.textContent !== chName) ui.chapterName.textContent = chName;
  ui.chapterChip.title = t(`chapter.${ch}.goal`);

  // HUD técnico (Comandante): fluxos por hora do motor.
  ui.flows.hidden = !ctx.mode.technicalHud;
  if (ctx.mode.technicalHud) {
    const working = isWorking(state.robot, vitals.battery) && !ctx.weather.radiation;
    const f = deriveFlow(vitals, installation, ctx.lit, working);
    const sign = (v: number) => (v >= 0 ? '+' : '') + v.toFixed(2);
    ui.flows.textContent = `E ${sign(f.energy)}/h · O₂ ${sign(f.air)}/h · H₂O ${sign(f.water)}/h · food ${sign(f.food)}/h`;
  }
}

function renderToolbar(state: GameState, ctx: HudContext): void {
  const n = state.robot.queue.length;
  ui.roverBadge.hidden = n === 0;
  ui.roverBadge.textContent = String(n);
  const attn = (tool: Tool, on: boolean) => document.querySelector(`[data-tool="${tool}"]`)?.classList.toggle('attn', on);
  const batteryPct = pct(state.vitals.battery, state.installation.batteryCapacity);
  attn('energy', batteryPct < LOW_ALERT_PERCENT.battery);
  attn('rover', state.vitals.water < LOW_ALERT_PERCENT.water);
  attn('greenhouse', state.vitals.food < LOW_ALERT_PERCENT.food);
  attn('crew', ctx.weather.radiation && state.crewOrder === 'auto');
}

function renderRover(state: GameState, ctx: HudContext): void {
  const r = state.robot;
  const full = r.queue.length >= MAX_QUEUE;
  const playing = outcomeOf(state) === 'playing';
  for (const button of document.querySelectorAll<HTMLButtonElement>('[data-task]')) {
    const kind = button.dataset.task as TaskKind;
    const blocked = (kind === 'panel' && state.installation.panels + r.queue.filter((q) => q.kind === 'panel').length >= MAX_PANELS)
      || (kind === 'antenna' && (r.antennaInstalled || r.queue.some((q) => q.kind === 'antenna')));
    button.disabled = !playing || full || blocked;
  }
  ui.panelNote.textContent = t('mission.panel.count', { panelH: Math.round(TASK_HOURS.panel), n: state.installation.panels, max: MAX_PANELS });
  const waiting = r.queue.length > 0 && (ctx.weather.radiation || state.vitals.battery <= 0 || r.safe !== null);
  const key = `${getLang()}|${waiting}|${safeStatus(r, state.vitals.battery)}|${r.queue.map((q) => `${q.kind}:${q.hoursLeft.toFixed(2)}`).join(',')}`;
  if (key === lastQueue) return;
  lastQueue = key;
  ui.queue.replaceChildren();
  if (r.queue.length === 0) {
    const item = document.createElement('li');
    item.className = 'empty';
    item.textContent = t('queue.empty');
    ui.queue.appendChild(item);
  }
  r.queue.forEach((task, index) => {
    const item = document.createElement('li');
    const head = document.createElement('div');
    head.className = 'q-head';
    const name = document.createElement('b');
    name.textContent = t(`mission.${task.kind}`);
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.dataset.cancel = String(index);
    cancel.textContent = '✕';
    cancel.setAttribute('aria-label', t('hud.cancel', { task: t(`mission.${task.kind}`) }));
    head.append(name, cancel);
    item.appendChild(head);
    if (index === 0) {
      const phase = missionPhase(task);
      const bars = document.createElement('div');
      bars.className = 'phases';
      for (const p of PHASES) {
        const span = document.createElement('span');
        const fill = document.createElement('i');
        if (PHASE_ORDER[p] < PHASE_ORDER[phase]) span.className = 'done';
        else if (p === phase) fill.style.width = `${Math.round(phaseProgress(task) * 100)}%`;
        span.appendChild(fill);
        bars.appendChild(span);
      }
      const label = document.createElement('div');
      label.className = 'phase-label';
      if (waiting) {
        label.classList.add('waiting');
        {
          const sm = safeStatus(state.robot, state.vitals.battery);
          label.textContent = sm ? t(`phase.safe.${sm}`) : t(ctx.weather.radiation ? 'phase.wait.radiation' : 'phase.wait.battery');
        }
      } else {
        const b = document.createElement('b');
        b.textContent = phaseText(phase, task.kind);
        label.append(b, ` · ${task.hoursLeft.toFixed(1)} h`);
      }
      item.append(bars, label);
    } else {
      const label = document.createElement('div');
      label.className = 'phase-label';
      label.textContent = `${t('queue.next')} · ${task.hoursLeft.toFixed(1)} h`;
      item.appendChild(label);
    }
    ui.queue.appendChild(item);
  });

  // Do gelo à água: etapas reais do processo, ligadas à fase da missão de gelo em andamento.
  const ice = r.queue[0]?.kind === 'ice' ? r.queue[0] : null;
  ui.process.hidden = !ice;
  if (ice) {
    const phase = missionPhase(ice);
    const step = phase === 'prep' || phase === 'travel' || phase === 'operate' ? 0 : phase === 'return' ? 1 : 2 + Math.min(2, Math.floor(phaseProgress(ice) * 3));
    ui.processSteps.replaceChildren(
      ...[1, 2, 3, 4, 5].map((n, i) => {
        const s = document.createElement('li');
        s.textContent = t(`process.${n}`);
        s.className = i < step ? 'done' : i === step ? 'now' : '';
        return s;
      }),
    );
  }
}

function renderBase(state: GameState, ctx: HudContext): void {
  const r = state.robot;
  const ghOn = isGreenhouseOn(state.vitals, state.installation);
  const rover = r.queue.length === 0 ? t('val.garage') : ctx.weather.radiation || state.vitals.battery <= 0 || r.safe ? t('val.waiting') : t('val.mission');
  const processing = r.queue[0]?.kind === 'ice' && missionPhase(r.queue[0]) === 'deliver';
  el('base-status').replaceChildren(
    li(t('status.habitat'), t('val.pressurised'), 'ok'),
    li(t('status.panels'), `${state.installation.panels} / ${MAX_PANELS}`, state.installation.panels >= 4 ? 'ok' : 'warn'),
    li(t('status.antenna'), r.antennaInstalled ? t('val.online') : t('val.repair'), r.antennaInstalled ? 'ok' : 'warn'),
    li(t('status.greenhouse'), state.installation.greenhouse === 'off' ? t('val.off') : ghOn ? t('val.growing') : t('val.idle'), ghOn ? 'ok' : 'warn'),
    li(t('status.rover'), rover, r.queue.length ? 'ok' : ''),
    li(t('status.processor'), processing ? t('val.processing') : t('val.standby'), processing ? 'ok' : ''),
  );
  const box = el('base-explain');
  box.replaceChildren();
  if (ctx.explanations) {
    for (const key of ['battery', 'air', 'water', 'food']) {
      const p = explanation(key, getLang());
      if (p) box.appendChild(p);
    }
  }
}

function renderCrew(state: GameState, ctx: HudContext): void {
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-crew]')) b.classList.toggle('active', b.dataset.crew === state.crewOrder);
  const outside = crewOutside(state.installation, state.vitals, state.robot, state.crewOrder).filter(Boolean).length;
  el('crew-status').replaceChildren(
    li(t('crew.order'), t(`hud.crew.${state.crewOrder}`)),
    li(t('crew.out'), `${outside} / 2`, ctx.weather.radiation && outside > 0 ? 'bad' : ''),
    li(t('crew.exposure'), t('crew.exposure.v', { h: state.crew.exposureHours.toFixed(1) }), state.crew.exposureHours > 6 ? 'bad' : state.crew.exposureHours > 0 ? 'warn' : 'ok'),
  );
}

function renderEnergy(state: GameState, ctx: HudContext): void {
  const { vitals, installation } = state;
  const batteryPct = pct(vitals.battery, installation.batteryCapacity);
  el('energy-pct').textContent = `${Math.round(batteryPct)}%`;
  el('energy-cap').textContent = `${Math.round(vitals.battery)} ${t('energy.cap', { cap: installation.batteryCapacity })}`;
  const working = isWorking(state.robot, vitals.battery) && !ctx.weather.radiation;
  const flow = deriveFlow(vitals, installation, ctx.lit, working);
  const hour = state.clock.hour;
  const nightText = hour < night[0] ? t('energy.night.in', { h: Math.ceil(night[0] - hour) }) : hour < night[1] ? t('energy.night.now', { h: night[1] }) : t('energy.night.past');
  el('energy-status').replaceChildren(
    li(t('energy.sun'), ctx.lit ? t('energy.lit') : t('energy.dark'), ctx.lit ? 'ok' : 'warn'),
    li(t('status.panels'), `${installation.panels} / ${MAX_PANELS}`),
    li(t('energy.flow'), t('energy.flow.v', { v: (flow.energy >= 0 ? '+' : '') + flow.energy.toFixed(2) }), flow.energy >= 0 ? 'ok' : 'warn'),
    li(t('energy.night'), nightText, hour >= night[0] && hour < night[1] ? 'warn' : ''),
  );
  const box = el('energy-explain');
  box.replaceChildren();
  if (ctx.explanations) {
    const p = explanation('battery', getLang());
    if (p) box.appendChild(p);
    const q = explanation('panels', getLang());
    if (q) box.appendChild(q);
  }
}

function renderGreenhouse(state: GameState): void {
  const mode = state.installation.greenhouse;
  for (const b of document.querySelectorAll<HTMLButtonElement>('[data-gh]')) b.classList.toggle('active', b.dataset.gh === mode);
  const on = state.crewOrder === 'auto' && isGreenhouseOn(state.vitals, state.installation);
  el('greenhouse-status').replaceChildren(
    li(t('gh.state'), mode === 'off' ? t('val.off') : on ? t('val.growing') : t('val.idle'), on ? 'ok' : 'warn'),
    li(t('gh.harvest'), state.crop.growth >= 100 ? t('gh.ready') : on ? t('gh.harvest.v', { h: Math.ceil(hoursToReady(state.crop)) }) : '—'),
    li(t('hud.food'), `${Math.round(state.vitals.food)}`),
  );
}

/** Lista de capítulos (painel Missões e tela de história). */
export function renderChapters(list: HTMLElement, state: GameState | null): void {
  const chapters = state ? chaptersOf(state) : null;
  const current = state ? currentChapter(state) : 0;
  list.replaceChildren(
    ...[1, 2, 3, 4, 5].map((n) => {
      const item = document.createElement('li');
      const c = chapters?.[n - 1];
      if (c?.done) item.classList.add('done');
      if (n === current && !c?.done) item.classList.add('current');
      const num = document.createElement('span');
      num.className = 'n';
      num.textContent = c?.done ? '✓' : String(n);
      const name = document.createElement('b');
      name.textContent = t(`chapter.${n}`);
      const goal = document.createElement('small');
      goal.textContent = t(`chapter.${n}.goal`);
      item.append(num, name, goal);
      if (c) {
        const bar = document.createElement('span');
        bar.className = 'ch-bar';
        const fill = document.createElement('i');
        fill.style.width = `${Math.round(c.progress * 100)}%`;
        bar.appendChild(fill);
        item.appendChild(bar);
      }
      return item;
    }),
  );
}

export function renderHud(state: GameState, ctx: HudContext): void {
  renderTop(state, ctx);
  renderToolbar(state, ctx);
  // O painel aberto é redesenhado só quando algo visível muda (chave), não a cada atualização.
  const key = `${getLang()}|${openTool}|${Math.floor(state.clock.hour * 4)}|${state.robot.queue.length}|${state.crewOrder}|${state.installation.greenhouse}|${state.installation.panels}|${ctx.lit}|${ctx.weather.radiation}|${ctx.explanations}`;
  if (openTool === 'rover') renderRover(state, ctx);
  if (key === lastKey) return;
  lastKey = key;
  if (openTool === 'base') renderBase(state, ctx);
  if (openTool === 'crew') renderCrew(state, ctx);
  if (openTool === 'energy') renderEnergy(state, ctx);
  if (openTool === 'greenhouse') renderGreenhouse(state);
  if (openTool === 'missions') renderChapters(el('chapters'), state);
}

/** Aviso grande e curto no topo (capítulo novo). */
let toastTimer = 0;
export function showToast(small: string, big: string): void {
  ui.toast.innerHTML = '';
  const s = document.createElement('small');
  s.textContent = small;
  const b = document.createElement('b');
  b.textContent = big;
  ui.toast.append(s, b);
  ui.toast.hidden = false;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => (ui.toast.hidden = true), 4200);
}

/** Tela de fim: vitória ou derrota, com o resumo da partida. */
export function renderEnd(state: GameState, mode: ModeConfig): void {
  const outcome = outcomeOf(state);
  const won = outcome === 'won';
  el('end-eyebrow').textContent = t(won ? 'end.won.eyebrow' : 'end.lost.eyebrow');
  el('end-title').textContent = t(won ? 'overlay.won.title' : 'overlay.lost.title');
  el('end-text').textContent = won
    ? t('overlay.won.text', { hours: MATCH_HOURS, hearts: state.hearts })
    : t('overlay.lost.text', { hour: Math.floor(state.clock.hour) });
  const done = chaptersOf(state).filter((c) => c.done).length;
  const stat = (label: string, value: string) => {
    const item = document.createElement('li');
    const a = document.createElement('span');
    a.textContent = label;
    const b = document.createElement('b');
    b.textContent = value;
    item.append(a, b);
    return item;
  };
  el('end-stats').replaceChildren(
    stat(t('end.stat.mode'), t(`mode.${mode.id}`)),
    stat(t('end.stat.hours'), `${Math.floor(state.clock.hour)} / ${MATCH_HOURS}`),
    stat(t('end.stat.hearts'), `${state.hearts} / 3`),
    stat(t('end.stat.ice'), String(state.missionsDone.ice)),
    stat(t('end.stat.panels'), `${state.installation.panels} / ${MAX_PANELS}`),
    stat(t('end.stat.chapters'), `${done} / 5`),
  );
}

/** Valor do modo da estufa a partir do botão. */
export function greenhouseFrom(button: HTMLElement): GreenhouseMode | null {
  const v = button.dataset.gh;
  return v === 'off' || v === 'always' || v === 'surplus' ? v : null;
}

// Ao carregar: idioma guardado (padrão inglês) e ícones.
applyLanguage(loadLang());
