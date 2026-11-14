// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Painel contextual (D-18): abre ao tocar um objeto da base na cena 3D. Mostra estado, ações, custos e progresso.
// Nenhuma regra mora aqui: a disponibilidade de cada ação vem de uma simulação em seco no motor (dispatch),
// então o motivo exibido é sempre o do motor. O painel só desenha e repassa as ordens.
import {
  AGENT_TASK_KINDS,
  INSPECT_WEAR_RELIEF,
  PREP_HOURS,
  TASK_ENERGY_COST,
  TRAVEL_HOURS,
  WORK_HOURS,
  agentStatus,
  taskFraction,
  type AgentTaskKind,
} from '../engine/astronaut';
import { dispatch, type GameAction, type GameState } from '../engine/game';
import {
  CARE_LEVELS,
  HARVEST_FOOD,
  IRRIGATION,
  LIGHTING,
  cropStage,
  efficiency,
  growthPerHour,
  hoursToReady,
  type Care,
} from '../engine/greenhouse';
import { GREENHOUSE } from '../engine/resources';
import { taskProgress } from '../engine/mission';
import { t } from '../i18n';
import type { SelectableId } from '../render/picking';
import type { Tool } from './hud';

export interface ContextHandlers {
  act(action: GameAction): void;
  /** Abre um painel de ferramenta (e fecha este). */
  openTool(tool: Tool): void;
  /** Volta para a visão geral da base. */
  overview(): void;
  /** Foco de câmera no objeto selecionado. */
  focus(id: SelectableId): void;
  close(): void;
}

type Updater = (state: GameState, sheltered: boolean) => void;

let root: HTMLElement;
let body: HTMLElement;
let titleEl: HTMLElement;
let handlers: ContextHandlers;
let selected: SelectableId | null = null;
let signature = '';
let updaters: Updater[] = [];
let shelteredNow = false;

const TOOL_FOR: Partial<Record<SelectableId, Tool>> = {
  habitat: 'crew',
  panels: 'energy',
  antenna: 'rover',
  processor: 'rover',
  storage: 'base',
  rover: 'rover',
};

function make<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function row(label: string, bind?: (value: HTMLElement, state: GameState) => void): HTMLElement {
  const li = make('li');
  const value = make('b');
  li.append(make('span', undefined, label), value);
  if (bind) updaters.push((s) => bind(value, s));
  return li;
}

function bar(update: (state: GameState) => number, tone = ''): HTMLElement {
  const track = make('div', `ctx-bar ${tone}`);
  const fill = make('i');
  track.append(fill);
  updaters.push((s) => {
    fill.style.width = `${Math.round(Math.min(1, Math.max(0, update(s))) * 100)}%`;
  });
  return track;
}

function heading(text: string): HTMLElement {
  return make('h3', undefined, text);
}

/** Simula a ordem no motor: devolve null se vale, ou o texto do motivo da recusa. */
function whyNot(state: GameState, action: GameAction): string | null {
  const r = dispatch(state, action);
  return r.ok ? null : t(`reason.${r.reason}`);
}

const hours = (n: number): string => String(Math.round(n * 10) / 10);
const num = (n: number, digits = 2): string => String(Math.round(n * 10 ** digits) / 10 ** digits);

function taskTotal(kind: AgentTaskKind): number {
  return PREP_HOURS + TRAVEL_HOURS + WORK_HOURS[kind] + TRAVEL_HOURS;
}

function taskDetail(kind: AgentTaskKind): string {
  return t(`task.${kind}.d`, { h: hours(taskTotal(kind)), wear: INSPECT_WEAR_RELIEF, food: HARVEST_FOOD, cost: TASK_ENERGY_COST.maintain });
}

function taskButton(state: GameState, kind: AgentTaskKind, agent?: number): HTMLElement {
  const action: GameAction = { type: 'ASSIGN_AGENT_TASK', kind, agent };
  const blocked = whyNot(state, action);
  const button = make('button', 'ctx-task');
  button.type = 'button';
  button.append(make('b', undefined, t(`task.${kind}`)), make('small', undefined, taskDetail(kind)));
  if (blocked) {
    button.disabled = true;
    button.title = blocked;
    button.append(make('em', undefined, blocked));
  } else {
    button.classList.add('primary');
    button.addEventListener('click', () => handlers.act(action));
  }
  return button;
}

function careControl(
  label: string,
  current: Care,
  table: Readonly<Record<Care, { growth: number; use: number }>>,
  hintKey: string,
  set: (level: Care) => GameAction,
): HTMLElement {
  const wrap = make('div', 'ctx-care');
  wrap.append(make('div', 'ctx-care-label', label));
  const seg = make('div', 'seg three');
  for (const level of CARE_LEVELS) {
    const b = make('button', level === current ? 'active' : '', t(`care.${level}`));
    b.type = 'button';
    b.setAttribute('aria-pressed', String(level === current));
    b.addEventListener('click', () => handlers.act(set(level)));
    seg.append(b);
  }
  wrap.append(seg, make('small', 'ctx-hint', t(hintKey, { use: table[current].use, growth: table[current].growth })));
  return wrap;
}

/** Bloco de acompanhamento da tarefa de um astronauta: estado, barra de progresso e cancelamento. */
function agentProgress(index: number, who: string): HTMLElement {
  const box = make('div', 'ctx-progress');
  const line = make('div', 'ctx-progress-line');
  const text = make('span');
  const cancel = make('button', undefined, t('agent.cancel'));
  cancel.type = 'button';
  cancel.addEventListener('click', () => handlers.act({ type: 'CANCEL_AGENT_TASK', agent: index }));
  line.append(text, cancel);
  box.append(line, bar((s) => (s.agents[index].task ? taskFraction(s.agents[index].task!) : 0), 'amber'));
  updaters.push((s, sheltered) => {
    const agent = s.agents[index];
    box.hidden = agent.task === null;
    if (!agent.task) return;
    text.textContent = t('agent.doing', { who, task: `${t(`task.${agent.task.kind}`)} · ${t(`agent.status.${agentStatus(agent, sheltered)}`)}` });
    cancel.hidden = agent.task.phase === 'back' || sheltered;
  });
  return box;
}

// ---------- Visões ----------

interface View {
  title: string;
  signature: string;
  build(state: GameState): HTMLElement[];
}

function greenhouseView(state: GameState): View {
  const crop = state.crop;
  const blocked = AGENT_TASK_KINDS.map((k) => `${k}:${whyNot(state, { type: 'ASSIGN_AGENT_TASK', kind: k }) ?? ''}`).join('|');
  const sig = ['gh', cropStage(crop), crop.irrigation, crop.lighting, state.installation.greenhouse, blocked, state.agents.map((a) => a.task?.kind ?? '-').join(',')].join('/');
  return {
    title: t('ctx.greenhouse'),
    signature: sig,
    build: (s) => {
      const growth = make('ul', 'status-list');
      growth.append(
        row(t('gh2.growth'), (v, st) => {
          v.textContent = `${t(`gh2.stage.${cropStage(st.crop)}`)} · ${Math.round(st.crop.growth)}%`;
        }),
        row(t('gh2.next'), (v, st) => {
          v.textContent = st.crop.growth >= 100 ? t('gh2.ready') : st.installation.greenhouse === 'off' ? t('gh2.paused') : t('gh2.in', { h: Math.ceil(hoursToReady(st.crop)) });
        }),
      );
      const details = make('ul', 'status-list');
      details.append(
        row(t('gh2.production'), (v, st) => {
          v.textContent = t('gh2.production.v', { food: HARVEST_FOOD, rate: Math.round((growthPerHour(st.crop) / 100) * HARVEST_FOOD * 100) });
        }),
        row(t('gh2.use'), (v, st) => {
          v.textContent = st.installation.greenhouse === 'off' ? t('gh2.use.off') : t('gh2.use.v', { water: num(GREENHOUSE.water * IRRIGATION[st.crop.irrigation].use), energy: num(GREENHOUSE.energy * LIGHTING[st.crop.lighting].use, 1) });
        }),
        row(t('gh2.mode'), (v, st) => {
          v.textContent = t(`gh2.mode.${st.installation.greenhouse}`);
        }),
        row(t('gh2.wear'), (v, st) => {
          v.textContent = t('gh2.wear.v', { wear: Math.round(st.crop.wear), eff: Math.round(efficiency(st.crop) * 100) });
        }),
      );
      const care = make('div', 'ctx-cares');
      care.append(
        careControl(t('gh2.irrigation'), s.crop.irrigation, IRRIGATION, 'gh2.irrigation.hint', (level) => ({ type: 'SET_GREENHOUSE_CARE', irrigation: level })),
        careControl(t('gh2.lighting'), s.crop.lighting, LIGHTING, 'gh2.lighting.hint', (level) => ({ type: 'SET_GREENHOUSE_CARE', lighting: level })),
      );
      const tasks = make('div', 'ctx-tasks');
      for (const kind of AGENT_TASK_KINDS) tasks.append(taskButton(s, kind));
      const progress = [0, 1].map((i) => agentProgress(i, t(`ctx.crew${i}`)));
      return [
        bar((st) => st.crop.growth / 100, 'green'),
        growth,
        heading(t('ctx.tasks')),
        tasks,
        ...progress,
        heading(t('ctx.status')),
        details,
        bar((st) => st.crop.wear / 100, 'coral'),
        heading(t('ctx.care')),
        care,
      ];
    },
  };
}

function crewView(state: GameState, index: number): View {
  const agent = state.agents[index];
  const blocked = AGENT_TASK_KINDS.map((k) => `${k}:${whyNot(state, { type: 'ASSIGN_AGENT_TASK', kind: k, agent: index }) ?? ''}`).join('|');
  const sig = ['crew', index, blocked, agent.task ? agent.task.kind : '-'].join('/');
  const who = t(`ctx.crew${index}`);
  return {
    title: who,
    signature: sig,
    build: (s) => {
      const status = make('ul', 'status-list');
      status.append(
        row(t('ctx.status'), (v, st) => void (v.textContent = t(`agent.status.${agentStatus(st.agents[index], shelteredNow)}`))),
        row(t('agent.task'), (v, st) => {
          const task = st.agents[index].task;
          v.textContent = task ? t(`task.${task.kind}`) : t('agent.none');
        }),
      );
      const tasks = make('div', 'ctx-tasks');
      for (const kind of AGENT_TASK_KINDS) tasks.append(taskButton(s, kind, index));
      return [status, heading(t('agent.assign')), tasks, agentProgress(index, who)];
    },
  };
}

function roverView(state: GameState): View {
  const first = state.robot.queue[0];
  return {
    title: t('ctx.rover'),
    signature: `rover/${first ? first.kind : '-'}/${state.robot.queue.length}`,
    build: () => {
      const status = make('ul', 'status-list');
      status.append(
        row(t('ctx.status'), (v, st) => {
          v.textContent = st.robot.queue[0] ? t('ctx.rover.busy') : t('ctx.rover.idle');
        }),
        row(t('ctx.rover.queue'), (v, st) => {
          v.textContent = `${st.robot.queue.length}`;
        }),
      );
      const cancel = make('button', undefined, t('ctx.rover.cancel'));
      cancel.type = 'button';
      cancel.hidden = !first;
      cancel.addEventListener('click', () => handlers.act({ type: 'CANCEL_TASK', index: 0 }));
      return [status, bar((st) => (st.robot.queue[0] ? taskProgress(st.robot.queue[0]) : 0), 'amber'), cancel];
    },
  };
}

function infoView(id: SelectableId): View {
  const lines: Record<string, (s: GameState) => string> = {
    habitat: (s) => t('ctx.info.habitat', { air: Math.round(s.vitals.air), water: Math.round(s.vitals.water), food: Math.round(s.vitals.food) }),
    panels: (s) => t('ctx.info.panels', { n: s.installation.panels, pct: Math.round((s.vitals.battery / s.installation.batteryCapacity) * 100) }),
    antenna: (s) => t(s.robot.antennaInstalled ? 'ctx.info.antenna.on' : 'ctx.info.antenna.off'),
    processor: (s) => t('ctx.info.processor', { n: s.missionsDone.ice }),
    storage: (s) => t('ctx.info.storage', { food: Math.round(s.vitals.food), water: Math.round(s.vitals.water) }),
  };
  return {
    title: t(`ctx.${id}`),
    signature: `info/${id}`,
    build: () => {
      const status = make('ul', 'status-list');
      status.append(row(t('ctx.status'), (v, st) => void (v.textContent = lines[id]?.(st) ?? '')));
      return [status];
    },
  };
}

function viewFor(id: SelectableId, state: GameState): View {
  if (id === 'greenhouse') return greenhouseView(state);
  if (id === 'crew0') return crewView(state, 0);
  if (id === 'crew1') return crewView(state, 1);
  if (id === 'rover') return roverView(state);
  return infoView(id);
}

// ---------- API ----------

export function mountContext(element: HTMLElement, h: ContextHandlers): void {
  root = element;
  handlers = h;
  titleEl = root.querySelector('#ctx-title') as HTMLElement;
  body = root.querySelector('#ctx-body') as HTMLElement;
  (root.querySelector('#ctx-close') as HTMLElement).addEventListener('click', () => h.close());
  (root.querySelector('#ctx-overview') as HTMLElement).addEventListener('click', () => h.overview());
}

export function selectedObject(): SelectableId | null {
  return selected;
}

export function showContext(id: SelectableId | null): void {
  selected = id;
  signature = '';
  root.hidden = id === null;
}

/** Atualiza o painel: reconstrói só quando algo discreto mudou; barras e números mudam no lugar. */
export function renderContext(state: GameState, radiation: boolean): void {
  if (!selected) return;
  shelteredNow = radiation || state.crewOrder === 'shelter';
  const view = viewFor(selected, state);
  if (view.signature !== signature) {
    signature = view.signature;
    updaters = [];
    titleEl.textContent = view.title;
    const nodes = view.build(state);
    const tool = TOOL_FOR[selected];
    if (tool) {
      const open = make('button', 'ctx-link', t('ctx.openTool'));
      open.type = 'button';
      open.addEventListener('click', () => handlers.openTool(tool));
      nodes.push(open);
    }
    const focus = make('button', 'ctx-link', t('ctx.focus'));
    focus.type = 'button';
    const id = selected;
    focus.addEventListener('click', () => handlers.focus(id));
    nodes.push(focus);
    body.replaceChildren(...nodes);
  }
  for (const update of updaters) update(state, shelteredNow);
}
