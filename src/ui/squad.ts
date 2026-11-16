// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Equipe na tela (passo 2 da interface): barra com Astronauta 1, Astronauta 2 e Rover (UX-04), etiquetas de tarefa
// sobre cada um na cena (UX-05) e a orientação curta da primeira partida (UX-07).
// Só lê o estado do motor e envia escolhas por callbacks; nenhuma regra de jogo aqui.
import { agentStatus, taskFraction } from '../engine/astronaut';
import type { GameState } from '../engine/game';
import { missionPhase, taskProgress } from '../engine/mission';
import { safeStatus } from '../engine/safe-mode';
import { t } from '../i18n';
import { iconSvg } from './icons';

export type SquadId = 'crew0' | 'crew1' | 'rover';
const IDS: readonly SquadId[] = ['crew0', 'crew1', 'rover'];

export interface SquadInfo {
  /** Radiação valendo para a base (já descontada a decisão de ficar fora). */
  radiation: boolean;
  /** Horas de jogo até a radiação passar. */
  radiationLeft: number;
  speed: number;
  /** Quem está selecionado no painel e quem a câmera acompanha. */
  selected: string | null;
  following: SquadId | null;
  /** Previsão da água (ROV-04): o cartão do rover avisa quando a fila deixa a base sem água. */
  water?: { zeroIn: number | null; risk: boolean };
}

export interface SquadHandlers {
  select(id: SquadId): void;
  follow(id: SquadId): void;
}

interface Entry {
  /** Texto curto do estado, progresso (0 a 1, −1 sem tarefa) e se está esperando algo. */
  status: string;
  progress: number;
  waiting: boolean;
  busy: boolean;
  /** Rótulo da etiqueta na cena (vazio: sem etiqueta). */
  tag: string;
}

const seconds = (hours: number, speed: number): number => Math.max(1, Math.round(hours / Math.max(1, speed)));

/** Estado de cada membro, em palavras de jogo. */
export function squadEntries(state: GameState, info: SquadInfo): Record<SquadId, Entry> {
  const out = {} as Record<SquadId, Entry>;
  const sheltered = info.radiation || state.crewOrder === 'shelter';
  [0, 1].forEach((i) => {
    const agent = state.agents[i];
    const id = i === 0 ? 'crew0' : 'crew1';
    if (!agent?.task) {
      out[id] = { status: t(`agent.status.${agentStatus(agent, sheltered)}`), progress: -1, waiting: false, busy: false, tag: '' };
      return;
    }
    const task = t(`task.${agent.task.kind}`);
    if (sheltered) {
      const why = info.radiation ? t('squad.wait.radiation', { s: seconds(info.radiationLeft, info.speed) }) : t('squad.wait.shelter');
      out[id] = { status: `${task} · ${why}`, progress: taskFraction(agent.task), waiting: true, busy: true, tag: `${task} · ${why}` };
      return;
    }
    out[id] = { status: `${task} · ${t(`agent.status.${agentStatus(agent, false)}`)}`, progress: taskFraction(agent.task), waiting: false, busy: true, tag: task };
  });
  const head = state.robot.queue[0];
  if (!head) {
    out.rover = { status: t('ctx.rover.idle'), progress: -1, waiting: false, busy: false, tag: '' };
  } else {
    const mission = t(`mission.${head.kind}`);
    const safe = safeStatus(state.robot, state.vitals.battery);
    let why: string | null = null;
    if (safe) why = t(`phase.safe.${safe}`);
    else if (info.radiation) why = t('squad.wait.radiation', { s: seconds(info.radiationLeft, info.speed) });
    else if (state.vitals.battery <= 0) why = t('squad.wait.battery');
    const phase = missionPhase(head);
    const phaseText = phase === 'operate' || phase === 'deliver' ? t(`phase.${phase}.${head.kind}`) : phase === 'return' && head.kind === 'ice' ? t('phase.return.ice') : t(`phase.${phase}`);
    const more = state.robot.queue.length > 1 ? ` · +${state.robot.queue.length - 1}` : '';
    out.rover = { status: `${mission} · ${why ?? phaseText}${more}`, progress: taskProgress(head), waiting: !!why, busy: true, tag: why ? `${mission} · ${why}` : mission };
  }
  // ROV-04: risco de ficar sem água antes do próximo gelo aparece no cartão do rover (com ou sem missão).
  if (info.water?.risk && info.water.zeroIn !== null) {
    const warn = t('squad.water', { s: seconds(info.water.zeroIn, info.speed) });
    out.rover = { ...out.rover, status: `⚠ ${warn} · ${out.rover.status}`, waiting: true };
  }
  return out;
}

// ---------- Barra da equipe (UX-04) ----------

let bar: HTMLElement | null = null;
const cards = new Map<SquadId, { root: HTMLButtonElement; status: HTMLElement; fill: HTMLElement }>();

const ICON: Record<SquadId, string> = { crew0: 'crew', crew1: 'crew', rover: 'rover' };

/** Monta a barra (uma vez). Toque seleciona; tocar de novo no selecionado passa a acompanhar com a câmera. */
export function mountSquad(root: HTMLElement, handlers: SquadHandlers): void {
  bar = root;
  root.replaceChildren();
  for (const id of IDS) {
    const card = document.createElement('button');
    card.type = 'button';
    card.className = 'squad-card';
    card.dataset.squad = id;
    const icon = document.createElement('span');
    icon.className = 'squad-icon';
    icon.innerHTML = iconSvg(ICON[id]);
    const text = document.createElement('span');
    text.className = 'squad-text';
    const name = document.createElement('b');
    name.dataset.name = id;
    const status = document.createElement('small');
    text.append(name, status);
    const meter = document.createElement('i');
    meter.className = 'squad-meter';
    const fill = document.createElement('i');
    meter.append(fill);
    card.append(icon, text, meter);
    card.addEventListener('click', () => {
      if (card.classList.contains('selected')) handlers.follow(id);
      else handlers.select(id);
    });
    root.append(card);
    cards.set(id, { root: card, status, fill });
  }
  relabelSquad();
}

/** Nomes no idioma atual. */
export function relabelSquad(): void {
  if (!bar) return;
  for (const id of IDS) {
    const name = bar.querySelector<HTMLElement>(`[data-name="${id}"]`);
    if (name) name.textContent = t(id === 'rover' ? 'ctx.rover' : `ctx.${id}`);
  }
}

/** Atualiza textos, progresso e destaque (chamado no ritmo do HUD). */
export function renderSquad(state: GameState, info: SquadInfo): Record<SquadId, Entry> {
  const entries = squadEntries(state, info);
  for (const id of IDS) {
    const card = cards.get(id);
    if (!card) continue;
    const e = entries[id];
    if (card.status.textContent !== e.status) card.status.textContent = e.status;
    card.fill.style.width = e.progress < 0 ? '0%' : `${Math.round(e.progress * 100)}%`;
    card.root.classList.toggle('busy', e.busy);
    card.root.classList.toggle('waiting', e.waiting);
    card.root.classList.toggle('selected', info.selected === id);
    card.root.classList.toggle('following', info.following === id);
    const hint = info.selected === id ? t('squad.followHint') : t('squad.selectHint');
    card.root.setAttribute('aria-label', `${t(id === 'rover' ? 'ctx.rover' : `ctx.${id}`)}: ${e.status}. ${hint}`);
    card.root.title = hint;
  }
  return entries;
}

// ---------- Etiquetas na cena (UX-05) ----------

let tagLayer: HTMLElement | null = null;
const tags = new Map<SquadId, { root: HTMLElement; label: HTMLElement; ring: HTMLElement }>();

export function mountTags(root: HTMLElement): void {
  tagLayer = root;
  root.replaceChildren();
  for (const id of IDS) {
    const el = document.createElement('div');
    el.className = 'scene-tag';
    el.hidden = true;
    const ring = document.createElement('span');
    ring.className = 'tag-ring';
    ring.innerHTML = iconSvg(ICON[id]);
    const label = document.createElement('span');
    label.className = 'tag-label';
    el.append(ring, label);
    root.append(el);
    tags.set(id, { root: el, label, ring });
  }
}

/** Posição na tela (px) de cada membro, ou null se fora da vista. Chamado a cada quadro. */
export function placeTags(entries: Record<SquadId, Entry> | null, screen: Record<SquadId, readonly [number, number] | null>): void {
  if (!tagLayer || !entries) return;
  for (const id of IDS) {
    const tag = tags.get(id);
    if (!tag) continue;
    const e = entries[id];
    const at = screen[id];
    const show = !!e.tag && !!at;
    if (tag.root.hidden === show) tag.root.hidden = !show;
    if (!show || !at) continue;
    tag.root.style.transform = `translate(${Math.round(at[0])}px, ${Math.round(at[1])}px) translate(-50%, -100%)`;
    if (tag.label.textContent !== e.tag) tag.label.textContent = e.tag;
    tag.root.classList.toggle('waiting', e.waiting);
    tag.ring.style.setProperty('--p', `${Math.round(Math.max(0, e.progress) * 360)}deg`);
  }
}

// ---------- Orientação da primeira partida (UX-07) ----------

const COACH_KEY = 'earthset-coach';
type CoachStep = 'select' | 'order' | 'camera' | 'done';
let coachStep: CoachStep = 'done';
let coachEl: HTMLElement | null = null;

/** Evita dicas redundantes enquanto a orientação inicial está ativa. */
export function coachActive(): boolean {
  return coachStep !== 'done';
}

function coachDone(): boolean {
  try {
    return localStorage.getItem(COACH_KEY) === 'done';
  } catch {
    return false;
  }
}

function saveCoachDone(): void {
  try {
    localStorage.setItem(COACH_KEY, 'done');
  } catch {
    // sem armazenamento: vale só nesta página
  }
}

/** Começa a orientação (só na primeira partida, ou de novo se `force`). */
export function startCoach(root: HTMLElement, force = false): void {
  coachEl = root;
  if (!force && coachDone()) {
    coachStep = 'done';
    root.hidden = true;
    return;
  }
  coachStep = 'select';
  renderCoach();
}

function renderCoach(): void {
  if (!coachEl) return;
  if (coachStep === 'done') {
    coachEl.hidden = true;
    return;
  }
  coachEl.hidden = false;
  const n = coachStep === 'select' ? 1 : coachStep === 'order' ? 2 : 3;
  coachEl.replaceChildren();
  const step = document.createElement('small');
  step.textContent = t('coach.step', { n, total: 3 });
  const text = document.createElement('p');
  text.textContent = t(`coach.${coachStep}`);
  const actions = document.createElement('div');
  actions.className = 'coach-actions';
  const skip = document.createElement('button');
  skip.type = 'button';
  skip.textContent = t(coachStep === 'camera' ? 'coach.finish' : 'coach.skip');
  skip.addEventListener('click', () => {
    coachStep = 'done';
    saveCoachDone();
    renderCoach();
  });
  actions.append(skip);
  coachEl.append(step, text, actions);
}

/** Avança a orientação pelos atos do jogador: selecionou alguém → escolher tarefa → câmera. */
export function coachEvent(event: 'selected' | 'ordered'): void {
  if (coachStep === 'select' && event === 'selected') coachStep = 'order';
  else if ((coachStep === 'order' || coachStep === 'select') && event === 'ordered') coachStep = 'camera';
  else return;
  renderCoach();
}

export function relabelCoach(): void {
  renderCoach();
}
