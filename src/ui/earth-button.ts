// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Botão "Terra" da barra superior: mostra se a Terra está acima do horizonte e leva a câmera até ela.
import { earthStatus, type EarthStatus } from '../astronomy/earth-status';
import { bodyAt } from '../astronomy/sky';
import { SKY } from '../data/sky';
import { TERRAIN } from '../data/terrain';
import type { Site } from '../engine/resources';
import { horizonAt } from '../engine/terrain';
import { t } from '../i18n';

/** Situação da Terra no site na hora dada, com o horizonte medido na direção dela. */
export function earthNow(hour: number, site: Site): EarthStatus {
  return earthStatus(
    hour,
    (h) => {
      const s = bodyAt(SKY, 'earth', h);
      return { el: s.el, horizon: Math.max(0, horizonAt(TERRAIN, site, s.az)) };
    },
    SKY.hours,
  );
}

/** Escreve o texto e o estado do botão. Sem Terra acima do horizonte, o botão fica desabilitado e diz quando ela sobe. */
export function renderEarthButton(button: HTMLButtonElement, status: EarthStatus): void {
  // Em telas estreitas a barra superior tem pouco espaço: rótulo curto.
  const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 760px)').matches;
  const suffix = narrow ? '.short' : '';
  if (status.up) {
    button.textContent = t(`earth.up${suffix}`, { el: status.elevation.toFixed(1) });
    button.disabled = false;
  } else if (status.hoursUntilUp !== null) {
    button.textContent = t(`earth.later${suffix}`, { h: status.hoursUntilUp });
    button.disabled = true;
  } else {
    button.textContent = t(`earth.never${suffix}`);
    button.disabled = true;
  }
}
