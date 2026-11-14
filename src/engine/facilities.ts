// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Instalações (D-19, docs/DECISOES.md): calibração dos painéis e ajuste da antena, feitos por astronautas.
// São melhorias temporárias que decaem com o tempo: o jogador troca tempo de astronauta, energia e exposição
// por mais geração ou por aviso antecipado de tempestade. Sem a ordem, nada muda (equilíbrio de referência intacto).

/** Horas até a calibração dos painéis acabar de decair. */
export const CALIBRATION_HOURS = 120;
/** Aumento máximo da geração dos painéis logo após calibrar (decai linearmente até 0). */
export const CALIBRATION_BONUS = 0.12;
/** Horas até o ajuste da antena acabar. */
export const TUNE_HOURS = 150;
/** Antecedência do aviso de tempestade sem ajuste e com ajuste (horas). */
export const WARNING_AHEAD_BASE = 6;
export const WARNING_AHEAD_TUNED = 12;
/** Só se repete a tarefa quando o efeito anterior caiu abaixo desta fração. */
export const REDO_BELOW = 0.5;

/** Multiplicador de geração dos painéis com `left` horas de calibração restantes (1 a 1,12). */
export function calibrationFactor(left: number): number {
  return 1 + CALIBRATION_BONUS * Math.min(1, Math.max(0, left / CALIBRATION_HOURS));
}

/** Antecedência do aviso de tempestade (horas) com `left` horas de ajuste restantes. */
export function warningAhead(left: number): number {
  return left > 0 ? WARNING_AHEAD_TUNED : WARNING_AHEAD_BASE;
}

export const canRecalibrate = (left: number): boolean => left <= CALIBRATION_HOURS * REDO_BELOW;
export const canRetune = (left: number): boolean => left <= TUNE_HOURS * REDO_BELOW;
