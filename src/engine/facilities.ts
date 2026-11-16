// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.

export const CALIBRATION_HOURS = 120;
export const CALIBRATION_BONUS = 0.12;
export const TUNE_HOURS = 150;
export const WARNING_AHEAD_BASE = 6;
export const WARNING_AHEAD_TUNED = 12;
/** Só se repete a tarefa quando o efeito anterior caiu abaixo desta fração. */
export const REDO_BELOW = 0.5;

export function calibrationFactor(left: number): number {
  return 1 + CALIBRATION_BONUS * Math.min(1, Math.max(0, left / CALIBRATION_HOURS));
}

export function warningAhead(left: number): number {
  return left > 0 ? WARNING_AHEAD_TUNED : WARNING_AHEAD_BASE;
}

export const canRecalibrate = (left: number): boolean => left <= CALIBRATION_HOURS * REDO_BELOW;
export const canRetune = (left: number): boolean => left <= TUNE_HOURS * REDO_BELOW;
