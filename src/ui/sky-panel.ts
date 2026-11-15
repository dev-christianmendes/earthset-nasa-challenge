// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Informação astronômica só na aba Ciência; a exposição extra não afeta a simulação.
import { BODY_IDS, bodyAt, trueAzimuth, utcAt, visibility, type BodyId } from '../astronomy/sky';
import { SKY } from '../data/sky';
import { SUN } from '../data/sun';
import { TERRAIN } from '../data/terrain';
import { sampleAt } from '../engine/sun';
import type { Site } from '../engine/resources';
import { getLang, t } from '../i18n';

// Padrão de apresentação para tornar o catálogo perceptível durante a partida.
let longExposure = true;
export const skyLongExposure = (): boolean => longExposure;
export function mountSkyPanel(root: HTMLElement, inspect: (id: BodyId) => void, lookUp: () => void): (hour: number, site: Site) => void {
  let signature = '';
  root.addEventListener('change', (event) => {
    if ((event.target as HTMLElement).matches('[data-sky-exposure]')) longExposure = (event.target as HTMLInputElement).checked;
  });
  root.addEventListener('click', (event) => {
    if ((event.target as HTMLElement).closest('[data-sky-look-up]')) lookUp();
    const id = (event.target as HTMLElement).closest<HTMLElement>('[data-sky-body]')?.dataset.skyBody;
    if (BODY_IDS.includes(id as BodyId)) inspect(id as BodyId);
  });
  return (hour, site) => {
    const key = `${Math.floor(hour)}|${getLang()}|${site}|${longExposure}`;
    if (key === signature) return;
    signature = key;
    const rows = BODY_IDS.map((id) => {
      const data = bodyAt(SKY, id, hour);
      const sample = id === 'sun' ? { ...data, ...sampleAt(SUN, hour, site) } : data;
      const view = visibility(sample, TERRAIN, site);
      return `<tr><th scope="row">${t(`sky.body.${id}`)}</th><td>${trueAzimuth(SKY, sample.az).toFixed(2)}°<br>${sample.el.toFixed(2)}°</td>
        <td>${(sample.diameter_arcsec / 3600).toFixed(id === 'sun' || id === 'earth' ? 3 : 4)}°<br>${sample.illumination_pct === null ? '—' : sample.illumination_pct.toFixed(1) + '%'}</td>
        <td><button type="button" data-sky-body="${id}" ${view.anyVisible ? '' : 'disabled'}>${t(view.fullVisible ? 'sky.visible' : view.anyVisible ? 'sky.partial' : 'sky.hidden')}</button></td></tr>`;
    }).join('');
    root.innerHTML = `<details class="sky-details" open><summary>${t('sky.title')}</summary>
      <p class="sky-time">${utcAt(SKY, Math.floor(hour))}</p>
      <p class="fine">${t('sky.observer', { lat: SKY.observer.latitude_deg.toFixed(6), lon: SKY.observer.longitude_deg.toFixed(6), alt: SKY.observer.altitude_km.toFixed(6) })}</p>
      <div class="sky-table-wrap"><table class="sky-table"><thead><tr><th>${t('sky.object')}</th><th>${t('sky.direction')}</th><th>${t('sky.scale')}</th><th>${t('sky.view')}</th></tr></thead><tbody>${rows}</tbody></table></div>
      <label class="sky-exposure"><input type="checkbox" data-sky-exposure ${longExposure ? 'checked' : ''}> ${t('sky.exposure')}</label>
      <button class="sky-look" type="button" data-sky-look-up>${t('sky.lookUp')}</button>
      <p class="fine">${t('sky.limits')}</p>
      <p class="fine">${t(SKY.stars.status === 'available' ? 'sky.catalog' : 'sky.catalogMissing', { n: SKY.stars.samples.length })}</p>
      <p class="fine">${t('sky.light')}</p>
      <p class="sky-sources"><a href="https://ssd.jpl.nasa.gov/horizons/manual.html" target="_blank" rel="noopener noreferrer">JPL Horizons</a> · <a href="${SKY.stars.source}" target="_blank" rel="noopener noreferrer">BSC5 / NOIRLab</a></p>
    </details>`;
  };
}
