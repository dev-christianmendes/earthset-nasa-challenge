// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { MAX_PANELS, MAX_QUEUE } from '../engine/robot';
import { t } from '../i18n';

export function reasonText(reason: string): string {
  const vars: Record<string, number> = reason === 'queue-full' ? { max: MAX_QUEUE } : reason === 'panel-limit' ? { max: MAX_PANELS } : {};
  return t(`reason.${reason}`, vars);
}
