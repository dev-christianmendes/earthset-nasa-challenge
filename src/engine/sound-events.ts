// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.

import type { GameState } from './game';
import { RESOURCE_ALERT_PERCENT } from './resource-alerts';

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
  const pct = (s: GameState): number => (s.vitals.battery / s.installation.batteryCapacity) * 100;
  if (pct(prev) >= RESOURCE_ALERT_PERCENT.battery && pct(next) < RESOURCE_ALERT_PERCENT.battery) out.push('alert-power');
  if (prev.vitals.water >= RESOURCE_ALERT_PERCENT.water && next.vitals.water < RESOURCE_ALERT_PERCENT.water) out.push('alert-water');
  if (prev.vitals.air >= RESOURCE_ALERT_PERCENT.air && next.vitals.air < RESOURCE_ALERT_PERCENT.air) out.push('alert-air');
  if (prev.vitals.food >= RESOURCE_ALERT_PERCENT.food && next.vitals.food < RESOURCE_ALERT_PERCENT.food) out.push('alert-food');
  if (next.hearts < prev.hearts) out.push('heart-lost');
  return out;
}
