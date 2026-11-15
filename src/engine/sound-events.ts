// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Eventos sonoros do jogo (UX-01): compara o estado antes e depois de um passo e diz o que aconteceu de audível.
// Motor puro: não toca som nenhum. A camada de interface (src/ui/audio.ts) escolhe como soar cada evento.

import type { GameState } from './game';

export type SoundCue =
  | 'panel-installed'
  | 'antenna-online'
  | 'ice-delivered'
  | 'harvest'
  | 'maintained'
  | 'inspected'
  | 'calibrated'
  | 'tuned'
  | 'alert-power'
  | 'alert-water'
  | 'alert-air'
  | 'alert-food'
  | 'heart-lost';

/** Limites dos alertas de recurso (os mesmos do alarme visual da cena, src/render/scene.ts). */
export const ALERT_POWER_PCT = 20;
export const ALERT_WATER = 20;
export const ALERT_AIR = 30;
export const ALERT_FOOD = 20;

/** Eventos de áudio entre dois estados consecutivos da mesma partida. Ordem estável. */
export function soundCues(prev: GameState, next: GameState): SoundCue[] {
  const out: SoundCue[] = [];
  if (next.missionsDone.panel > prev.missionsDone.panel) out.push('panel-installed');
  if (!prev.robot.antennaInstalled && next.robot.antennaInstalled) out.push('antenna-online');
  if (next.missionsDone.ice > prev.missionsDone.ice) out.push('ice-delivered');
  const a = prev.agentTasksDone;
  const b = next.agentTasksDone;
  if (b.harvest > a.harvest) out.push('harvest');
  if (b.maintain > a.maintain) out.push('maintained');
  if (b.inspect > a.inspect) out.push('inspected');
  if (b.calibrate > a.calibrate) out.push('calibrated');
  if (b.tune > a.tune) out.push('tuned');
  // Alertas só na hora em que o recurso cruza o limite para baixo (não repetem enquanto estiver baixo).
  const pct = (s: GameState): number => (s.vitals.battery / s.installation.batteryCapacity) * 100;
  if (pct(prev) >= ALERT_POWER_PCT && pct(next) < ALERT_POWER_PCT) out.push('alert-power');
  if (prev.vitals.water >= ALERT_WATER && next.vitals.water < ALERT_WATER) out.push('alert-water');
  if (prev.vitals.air >= ALERT_AIR && next.vitals.air < ALERT_AIR) out.push('alert-air');
  if (prev.vitals.food >= ALERT_FOOD && next.vitals.food < ALERT_FOOD) out.push('alert-food');
  if (next.hearts < prev.hearts) out.push('heart-lost');
  return out;
}
