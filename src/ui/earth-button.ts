// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { earthStatus, type EarthStatus } from '../astronomy/earth-status';
import { bodyAt } from '../astronomy/sky';
import { SKY } from '../data/sky';
import { TERRAIN } from '../data/terrain';
import type { Site } from '../engine/resources';
import { horizonAt } from '../engine/terrain';
import { t } from '../i18n';

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

export function renderEarthButton(button: HTMLButtonElement, status: EarthStatus): void {
  const narrow = typeof window !== 'undefined' && window.matchMedia('(max-width: 900px)').matches;
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
