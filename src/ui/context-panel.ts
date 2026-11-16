// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Painel contextual (D-18): abre ao tocar um objeto da base na cena 3D. Mostra estado, ações, custos e progresso.
// Nenhuma regra mora aqui: a disponibilidade de cada ação vem de uma simulação em seco no motor (dispatch),
// então o motivo exibido é sempre o do motor. O painel só desenha e repassa as ordens.
import {
  AGENT_TASK_KINDS,
  GREENHOUSE_TASKS,
  INSPECT_WEAR_RELIEF,
  PREP_HOURS,
  TASK_ENERGY_COST,
  TRAVEL_HOURS_BY_KIND,
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
import { CALIBRATION_BONUS, CALIBRATION_HOURS, TUNE_HOURS, WARNING_AHEAD_TUNED, calibrationFactor, warningAhead } from '../engine/facilities';
import { EXPOSURE_HOURS_PER_HEART } from '../engine/crew';
import { GREENHOUSE, PANEL_OUTPUT_PER_HOUR, deriveFlow, type GreenhouseMode } from '../engine/resources';
import { isWorking } from '../engine/robot';
import { PHASES, missionPhase, phaseProgress, type MissionPhase } from '../engine/mission';
import type { WaterForecast } from '../engine/forecast';
import { ICE_HELP_HOURS, ICE_WATER_PER_TRIP, MAX_PANELS, TASK_HOURS, type TaskKind } from '../engine/robot';
import type { AlertView } from '../engine/alert';
import { safeStatus } from '../engine/safe-mode';
import { t } from '../i18n';
import type { SelectableId } from '../render/picking';
import type { Tool } from './hud';
import { reasonText } from './action-reason';

/** O que a interface sabe do mundo fora do estado do motor (clima, luz, aviso de tempestade, velocidade). */
export interface ContextInfo {
  radiation: boolean;
  lit: boolean;
  speed: number;
  /** Horas até a próxima tempestade avisada pela antena (null: sem aviso). */
  alert: AlertView;
  /** Horas de jogo até a radiação atual passar (0 sem radiação). */
  radiationLeft: number;
  /** Previsão da água com a fila atual (ROV-04). */
  water: WaterForecast;
}

export interface ContextHandlers {
  act(action: GameAction): void;
  /** Abre um painel de ferramenta (e fecha este). */
  openTool(tool: Tool): void;
  /** Volta para a visão geral da base. */
  overview(): void;
  /** Foco de câmera no objeto selecionado. */
  focus(id: SelectableId): void;
  /** Troca o objeto selecionado (ex.: de um astronauta para o outro). */
  select(id: SelectableId): void;
  close(): void;
  /** Previsão da água se a ação for aceita agora (ROV-04); calculada e guardada pelo main. */
  forecast(action: GameAction): WaterForecast;
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
/** Radiação que para o trabalho (falso se o jogador decidiu continuar fora). */
let radiationNow = false;
/** Evento de radiação em curso, qualquer que seja a decisão do jogador. */
let eventNow = false;
let speedNow = 1;
let world: ContextInfo = { radiation: false, lit: true, speed: 1, alert: { level: 'normal', episode: null, evidence: null, precursor: null, recoveryLeft: 0, lagRange: null }, radiationLeft: 0, water: { zeroIn: null, iceIn: null, risk: false } };

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
  return r.ok ? null : reasonText(r.reason);
}

const hours = (n: number): string => String(Math.round(n * 10) / 10);
const num = (n: number, digits = 2): string => String(Math.round(n * 10 ** digits) / 10 ** digits);

function taskTotal(kind: AgentTaskKind): number {
  return PREP_HOURS + TRAVEL_HOURS_BY_KIND[kind] * 2 + WORK_HOURS[kind];
}

function taskDetail(kind: AgentTaskKind): string {
  return t(`task.${kind}.d`, {
    h: hours(taskTotal(kind)),
    wear: INSPECT_WEAR_RELIEF,
    food: HARVEST_FOOD,
    cost: TASK_ENERGY_COST[kind],
    bonus: Math.round(CALIBRATION_BONUS * 100),
    span: kind === 'tune' ? TUNE_HOURS : CALIBRATION_HOURS,
    ahead: WARNING_AHEAD_TUNED,
  });
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

const GREENHOUSE_MODES: readonly GreenhouseMode[] = ['off', 'surplus', 'always'];

/** Modo de operação da estufa (antes só no painel lateral antigo). */
function modeControl(current: GreenhouseMode): HTMLElement {
  const wrap = make('div', 'ctx-care');
  wrap.append(make('div', 'ctx-care-label', t('gh2.mode')));
  const seg = make('div', 'seg three');
  for (const mode of GREENHOUSE_MODES) {
    const b = make('button', mode === current ? 'active' : '', t(`greenhouse.${mode}`));
    b.type = 'button';
    b.setAttribute('aria-pressed', String(mode === current));
    b.addEventListener('click', () => handlers.act({ type: 'SET_GREENHOUSE', mode }));
    seg.append(b);
  }
  wrap.append(seg, make('small', 'ctx-hint', t(`gh2.mode.${current}`)));
  return wrap;
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
    const resume = sheltered && radiationNow && world.radiationLeft > 0 ? ` · ${t('agent.wait.radiation', { s: Math.max(1, Math.round(world.radiationLeft / speedNow)) })}` : '';
    text.textContent = t('agent.doing', { who, task: `${t(`task.${agent.task.kind}`)} · ${t(`agent.status.${agentStatus(agent, sheltered)}`)}${resume}` });
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
  const blocked = GREENHOUSE_TASKS.map((k) => `${k}:${whyNot(state, { type: 'ASSIGN_AGENT_TASK', kind: k }) ?? ''}`).join('|');
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
        modeControl(s.installation.greenhouse),
        careControl(t('gh2.irrigation'), s.crop.irrigation, IRRIGATION, 'gh2.irrigation.hint', (level) => ({ type: 'SET_GREENHOUSE_CARE', irrigation: level })),
        careControl(t('gh2.lighting'), s.crop.lighting, LIGHTING, 'gh2.lighting.hint', (level) => ({ type: 'SET_GREENHOUSE_CARE', lighting: level })),
      );
      const tasks = make('div', 'ctx-tasks');
      for (const kind of GREENHOUSE_TASKS) tasks.append(taskButton(s, kind));
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
      const other = 1 - index;
      const swap = make('button', 'ctx-link', t('ctx.otherCrew', { who: t(`ctx.crew${other}`) }));
      swap.type = 'button';
      swap.addEventListener('click', () => handlers.select(other === 0 ? 'crew0' : 'crew1'));
      // Acompanhar com a câmera, como no rover (a câmera desvia sozinha de estruturas: director.ts).
      const follow = make('button', 'ctx-link', t('ctx.crew.follow'));
      follow.type = 'button';
      follow.addEventListener('click', () => handlers.focus(index === 0 ? 'crew0' : 'crew1'));
      return [status, heading(t('agent.assign')), tasks, agentProgress(index, who), follow, swap];
    },
  };
}

const ROVER_KINDS: readonly TaskKind[] = ['ice', 'panel', 'antenna'];
const PHASE_INDEX: Record<MissionPhase, number> = { prep: 0, travel: 1, operate: 2, return: 3, deliver: 4 };

function phaseLabel(phase: MissionPhase, kind: TaskKind): string {
  if (phase === 'return' && kind === 'ice') return t('phase.return.ice');
  return phase === 'operate' || phase === 'deliver' ? t(`phase.${phase}.${kind}`) : t(`phase.${phase}`);
}

function missionDetail(kind: TaskKind, state: GameState): string {
  // Horas e água vêm do motor (TASK_HOURS, ICE_HELP_HOURS): o texto não fica para trás quando a regra muda.
  const hours = Math.round(TASK_HOURS[kind]);
  if (kind === 'panel') return t('mission.panel.count', { panelH: hours, n: state.installation.panels, max: MAX_PANELS });
  return t(`mission.${kind}.time`, { iceH: hours, antennaH: hours, help: Math.round(ICE_HELP_HOURS) });
}

/** Etapas da missão em andamento: cinco barras (preparo, ida, operação, volta, entrega) e o texto da etapa. */
function missionSteps(): HTMLElement {
  const box = make('div', 'ctx-mission');
  const bars = make('div', 'phases');
  const fills = PHASES.map(() => {
    const span = make('span');
    const fill = make('i');
    span.append(fill);
    bars.append(span);
    return { span, fill };
  });
  const label = make('div', 'phase-label');
  const eta = make('div', 'ctx-hint');
  box.append(bars, label, eta);
  updaters.push((s) => {
    const task = s.robot.queue[0];
    box.hidden = !task;
    if (!task) return;
    const phase = missionPhase(task);
    fills.forEach(({ span, fill }, i) => {
      span.classList.toggle('done', i < PHASE_INDEX[phase]);
      fill.style.width = i === PHASE_INDEX[phase] ? `${Math.round(phaseProgress(task) * 100)}%` : '0%';
    });
    const waiting = radiationNow || s.vitals.battery <= 0;
    label.classList.toggle('waiting', waiting);
    label.textContent = waitText(s) ?? (waiting ? t(radiationNow ? 'phase.wait.radiation' : 'phase.wait.battery') : phaseLabel(phase, task.kind));
    // Esperando: diz quanto falta para começar, não só a duração da tarefa (antes parecia que andaria em segundos).
    const h = Math.ceil(task.hoursLeft);
    if (waiting && radiationNow) eta.textContent = t('ctx.wait.radiation', { s: Math.max(1, Math.round(world.radiationLeft / speedNow)), speed: speedNow, h });
    else if (waiting) eta.textContent = t('ctx.wait.battery', { h });
    else eta.textContent = t('ctx.rover.eta', { h, s: Math.max(1, Math.round(task.hoursLeft / speedNow)), speed: speedNow });
  });
  return box;
}

/** Texto do modo seguro do rover (voltando, na base, sem energia), ou null fora dele. */
function waitText(state: GameState): string | null {
  const status = safeStatus(state.robot, state.vitals.battery);
  return status ? t(`phase.safe.${status}`) : null;
}

function roverView(state: GameState): View {
  const queue = state.robot.queue;
  const blocked = ROVER_KINDS.map((k) => `${k}:${whyNot(state, { type: 'ENQUEUE_TASK', kind: k }) ?? ''}`).join('|');
  return {
    title: t('ctx.rover'),
    signature: `rover/${queue.map((q) => q.kind).join(',')}/${blocked}/${state.installation.panels}/${ROVER_KINDS.map((k) => (handlers.forecast({ type: 'ENQUEUE_TASK', kind: k }).risk ? 1 : 0)).join('')}`,
    build: (s) => {
      const status = make('ul', 'status-list');
      status.append(
        row(t('ctx.status'), (v, st) => {
          const task = st.robot.queue[0];
          v.textContent = !task ? t('ctx.rover.idle') : waitText(st) ?? (radiationNow ? t('phase.wait.radiation') : st.vitals.battery <= 0 ? t('phase.wait.battery') : phaseLabel(missionPhase(task), task.kind));
        }),
      );
      // ROV-04: aviso de água enquanto a fila deixar a base sem água antes do próximo gelo.
      const warn = make('p', 'ctx-warn');
      warn.setAttribute('role', 'status');
      updaters.push(() => {
        const f = world.water;
        warn.hidden = !f.risk;
        if (!f.risk || f.zeroIn === null) return;
        const s = Math.max(1, Math.round(f.zeroIn / Math.max(1, speedNow)));
        warn.textContent = f.iceIn === null ? t('water.risk.noIce', { s }) : t('water.risk.late', { s, ice: Math.max(1, Math.round(f.iceIn / Math.max(1, speedNow))) });
      });
      const missions = make('div', 'ctx-tasks');
      for (const kind of ROVER_KINDS) {
        const action: GameAction = { type: 'ENQUEUE_TASK', kind };
        const why = whyNot(s, action);
        const button = make('button', 'ctx-task');
        button.type = 'button';
        button.append(make('b', undefined, t(`mission.${kind}`)), make('small', undefined, `${t(`mission.${kind}.p`, { w: ICE_WATER_PER_TRIP })} ${missionDetail(kind, s)}`));
        if (why) {
          button.disabled = true;
          button.title = why;
          button.append(make('em', undefined, why));
        } else {
          button.classList.add('primary');
          button.addEventListener('click', () => handlers.act(action));
          // Missão que deixaria a base sem água antes do gelo: continua possível, mas avisada.
          if (kind !== 'ice' && handlers.forecast(action).risk) button.append(make('em', 'warn', t('water.risk.button')));
        }
        missions.append(button);
      }
      const list = make('ol', 'ctx-queue');
      queue.forEach((task, index) => {
        const item = make('li');
        const cancel = make('button', undefined, '✕');
        cancel.type = 'button';
        cancel.setAttribute('aria-label', t('hud.cancel', { task: t(`mission.${task.kind}`) }));
        cancel.addEventListener('click', () => handlers.act({ type: 'CANCEL_TASK', index }));
        item.append(make('span', undefined, `${index === 0 ? '' : `${t('queue.next')} · `}${t(`mission.${task.kind}`)}`), cancel);
        list.append(item);
      });
      const follow = make('button', 'ctx-link', t('ctx.rover.follow'));
      follow.type = 'button';
      follow.addEventListener('click', () => handlers.focus('rover'));
      return [status, warn, missionSteps(), heading(t('ctx.missions')), missions, ...(queue.length ? [heading(t('rover.queue')), list] : []), follow];
    },
  };
}

/** Fluxo por hora agora (energia, ar, água e comida), com o mesmo cálculo do motor. */
function flowNow(state: GameState): ReturnType<typeof deriveFlow> {
  const working = isWorking(state.robot, state.vitals.battery) && !radiationNow;
  const solar = calibrationFactor(state.calibrationLeft);
  return deriveFlow(state.vitals, state.installation, world.lit, working, solar, state.crop);
}

const signed = (n: number, digits = 1): string => `${n > 0 ? '+' : ''}${num(n, digits)}`;

function agentProgressBlocks(): HTMLElement[] {
  return [0, 1].map((i) => agentProgress(i, t(`ctx.crew${i}`)));
}

function tasksFor(state: GameState, kinds: readonly AgentTaskKind[]): HTMLElement {
  const box = make('div', 'ctx-tasks');
  for (const kind of kinds) box.append(taskButton(state, kind));
  return box;
}

function missionButton(state: GameState, kind: TaskKind): HTMLElement {
  const action: GameAction = { type: 'ENQUEUE_TASK', kind };
  const why = whyNot(state, action);
  const button = make('button', 'ctx-task');
  button.type = 'button';
  button.append(make('b', undefined, t(`mission.${kind}`)), make('small', undefined, `${t(`mission.${kind}.p`, { w: ICE_WATER_PER_TRIP })} ${missionDetail(kind, state)}`));
  if (why) {
    button.disabled = true;
    button.title = why;
    button.append(make('em', undefined, why));
  } else {
    button.classList.add('primary');
    button.addEventListener('click', () => handlers.act(action));
  }
  return button;
}

function blockedSig(state: GameState, kinds: readonly AgentTaskKind[]): string {
  return kinds.map((k) => `${k}:${whyNot(state, { type: 'ASSIGN_AGENT_TASK', kind: k }) ?? ''}`).join('|') + `|${state.agents.map((a) => a.task?.kind ?? '-').join(',')}`;
}

function panelsView(state: GameState): View {
  const sig = `panels/${blockedSig(state, ['calibrate'])}/${whyNot(state, { type: 'ENQUEUE_TASK', kind: 'panel' }) ?? ''}/${state.installation.panels}`;
  return {
    title: t('ctx.panels'),
    signature: sig,
    build: (s) => {
      const list = make('ul', 'status-list');
      list.append(
        row(t('pan.count'), (v, st) => void (v.textContent = t('pan.count.v', { n: st.installation.panels, max: MAX_PANELS }))),
        row(t('pan.output'), (v, st) => {
          const maxOut = st.installation.panels * PANEL_OUTPUT_PER_HOUR * calibrationFactor(st.calibrationLeft);
          const now = world.lit ? maxOut : 0;
          v.textContent = world.lit ? t('pan.output.v', { now: num(now, 1), max: num(maxOut, 1) }) : t('pan.dark');
        }),
        row(t('pan.calibration'), (v, st) => {
          v.textContent = st.calibrationLeft > 0 ? t('pan.calibration.v', { pct: Math.round((calibrationFactor(st.calibrationLeft) - 1) * 100), h: Math.ceil(st.calibrationLeft) }) : t('pan.calibration.none');
        }),
        row(t('pan.battery'), (v, st) => void (v.textContent = `${Math.round((st.vitals.battery / st.installation.batteryCapacity) * 100)}%`)),
      );
      return [list, bar((st) => st.vitals.battery / st.installation.batteryCapacity, 'amber'), heading(t('ctx.tasks')), tasksFor(s, ['calibrate']), ...agentProgressBlocks(), heading(t('ctx.missions')), missionButton(s, 'panel')];
    },
  };
}

function antennaView(state: GameState): View {
  const installed = state.robot.antennaInstalled;
  const sig = `antenna/${installed}/${blockedSig(state, ['tune'])}/${whyNot(state, { type: 'ENQUEUE_TASK', kind: 'antenna' }) ?? ''}`;
  return {
    title: t('ctx.antenna'),
    signature: sig,
    build: (s) => {
      const list = make('ul', 'status-list');
      list.append(
        row(t('ant.status'), (v, st) => void (v.textContent = t(st.robot.antennaInstalled ? 'ctx.info.antenna.on' : 'ctx.info.antenna.off'))),
        row(t('ant.lead'), (v, st) => void (v.textContent = st.robot.antennaInstalled ? t('ant.lead.v', { h: warningAhead(st.antennaTuneLeft) }) : '—')),
        row(t('ant.tuned'), (v, st) => void (v.textContent = st.antennaTuneLeft > 0 ? t('ant.tuned.v', { h: Math.ceil(st.antennaTuneLeft) }) : t('ant.tuned.none'))),
        row(t('ant.next'), (v, st) => {
          v.textContent = !st.robot.antennaInstalled ? '—' : t(`alert.level.${world.alert.level}`);
        }),
      );
      const nodes: HTMLElement[] = [list];
      if (installed) nodes.push(heading(t('ctx.tasks')), tasksFor(s, ['tune']), ...agentProgressBlocks());
      else nodes.push(heading(t('ctx.missions')), make('p', 'ctx-hint', t('ant.offline')), missionButton(s, 'antenna'));
      return nodes;
    },
  };
}

function habitatView(state: GameState): View {
  return {
    title: t('ctx.habitat'),
    signature: `habitat/${state.crewOrder}/${eventNow}`,
    build: (s) => {
      const crew = make('ul', 'status-list');
      for (const i of [0, 1]) {
        crew.append(row(t(`ctx.crew${i}`), (v, st) => void (v.textContent = t(`agent.status.${agentStatus(st.agents[i], shelteredNow)}`))));
      }
      const rates = make('ul', 'status-list');
      const rate = (label: string, pick: (f: ReturnType<typeof deriveFlow>) => number): HTMLElement =>
        row(label, (v, st) => void (v.textContent = t('hab.rate', { v: signed(pick(flowNow(st)), 2) })));
      rates.append(
        rate(t('hab.air'), (f) => f.air),
        rate(t('hab.water'), (f) => f.water),
        rate(t('hab.food'), (f) => f.food),
        rate(t('hab.energy'), (f) => f.energy),
        row(t('hab.exposure'), (v, st) => void (v.textContent = t('hab.exposure.v', { h: num(st.crew.exposureHours % EXPOSURE_HOURS_PER_HEART, 1), max: EXPOSURE_HOURS_PER_HEART }))),
      );
      const seg = make('div', 'seg');
      const orders = eventNow ? (['auto', 'shelter', 'outside'] as const) : (['auto', 'shelter'] as const);
      for (const order of orders) {
        const b = make('button', s.crewOrder === order ? 'active' : '', t(`hab.order.${order}`));
        b.type = 'button';
        b.setAttribute('aria-pressed', String(s.crewOrder === order));
        b.addEventListener('click', () => handlers.act({ type: 'SET_CREW_ORDER', order }));
        seg.append(b);
      }
      const risk = eventNow ? make('p', 'fine', s.crewOrder === 'outside' ? t('hab.risk.outside', { max: EXPOSURE_HOURS_PER_HEART }) : `${t('hab.risk.shelter')} ${t('hab.risk.outside', { max: EXPOSURE_HOURS_PER_HEART })}`) : null;
      return [heading(t('hab.crew')), crew, heading(t('hab.order')), seg, ...(risk ? [risk] : []), heading(t('ctx.status')), rates];
    },
  };
}

function processorView(state: GameState): View {
  return {
    title: t('ctx.processor'),
    signature: `processor/${whyNot(state, { type: 'ENQUEUE_TASK', kind: 'ice' }) ?? ''}`,
    build: (s) => {
      const list = make('ul', 'status-list');
      list.append(
        row(t('proc.state'), (v, st) => {
          const task = st.robot.queue[0];
          const processing = task?.kind === 'ice' && missionPhase(task) === 'deliver';
          const coming = st.robot.queue.some((q) => q.kind === 'ice');
          v.textContent = t(processing ? 'proc.state.working' : coming ? 'proc.state.waiting' : 'proc.state.idle');
        }),
        row(t('proc.trips'), (v, st) => void (v.textContent = String(st.missionsDone.ice))),
        row(t('proc.water'), (v, st) => void (v.textContent = `+${st.missionsDone.ice * ICE_WATER_PER_TRIP}`)),
        row(t('sto.water'), (v, st) => void (v.textContent = `${Math.round(st.vitals.water)}`)),
      );
      return [list, bar((st) => st.vitals.water / 100), heading(t('ctx.missions')), missionButton(s, 'ice')];
    },
  };
}

function storageView(state: GameState): View {
  return {
    title: t('ctx.storage'),
    signature: `storage/${state.installation.panels}`,
    build: () => {
      const box = make('div');
      const entry = (label: string, level: (st: GameState) => number, flow: (f: ReturnType<typeof deriveFlow>) => number, limit: (st: GameState) => number, tone: string): HTMLElement[] => {
        const list = make('ul', 'status-list');
        list.append(
          row(label, (v, st) => {
            const per = flow(flowNow(st));
            const left = per < -1e-6 ? t('sto.lasts', { h: Math.round(level(st) / -per) }) : t('sto.grows');
            v.textContent = `${Math.round(level(st))} / ${Math.round(limit(st))} · ${left}`;
          }),
        );
        return [list, bar((st) => level(st) / limit(st), tone)];
      };
      box.append(
        ...entry(t('sto.battery'), (st) => st.vitals.battery, (f) => f.energy, (st) => st.installation.batteryCapacity, 'amber'),
        ...entry(t('sto.air'), (st) => st.vitals.air, (f) => f.air, () => 100, ''),
        ...entry(t('sto.water'), (st) => st.vitals.water, (f) => f.water, () => 100, ''),
        ...entry(t('sto.food'), (st) => st.vitals.food, (f) => f.food, () => 100, 'green'),
      );
      const crates = make('ul', 'status-list');
      crates.append(row(t('sto.crates'), (v, st) => void (v.textContent = String(Math.max(0, MAX_PANELS - st.installation.panels)))));
      box.append(crates);
      return [box];
    },
  };
}

function viewFor(id: SelectableId, state: GameState): View {
  if (id === 'greenhouse') return greenhouseView(state);
  if (id === 'crew0') return crewView(state, 0);
  if (id === 'crew1') return crewView(state, 1);
  if (id === 'rover') return roverView(state);
  if (id === 'panels') return panelsView(state);
  if (id === 'antenna') return antennaView(state);
  if (id === 'habitat') return habitatView(state);
  if (id === 'processor') return processorView(state);
  return storageView(state);
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

/**
 * Painel enxuto (UX-06): em cada lista de tarefas, as possíveis ficam à vista; as indisponíveis vão para um grupo
 * recolhido, cada uma com o motivo. Se nenhuma está disponível, o grupo abre sozinho para explicar por quê.
 */
function groupBlocked(root: HTMLElement): void {
  for (const list of root.querySelectorAll<HTMLElement>('.ctx-tasks')) {
    const blocked = [...list.querySelectorAll<HTMLButtonElement>(':scope > button.ctx-task:disabled')];
    if (blocked.length === 0) continue;
    const details = make('details', 'ctx-blocked');
    const summary = make('summary', undefined, t('ctx.blocked', { n: blocked.length }));
    details.append(summary, ...blocked);
    if (!list.querySelector(':scope > button.ctx-task:not(:disabled)')) details.open = true;
    list.append(details);
  }
}

/** Atualiza o painel: reconstrói só quando algo discreto mudou; barras e números mudam no lugar. */
export function renderContext(state: GameState, info: ContextInfo): void {
  if (!selected) return;
  world = info;
  eventNow = info.radiation;
  radiationNow = info.radiation && state.crewOrder !== 'outside';
  speedNow = info.speed;
  const radiation = radiationNow;
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
    groupBlocked(body);
  }
  for (const update of updaters) update(state, shelteredNow);
}
