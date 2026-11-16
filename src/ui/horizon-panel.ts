// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { isSunlit, sampleAt, type SunTable } from '../engine/sun';
import type { TerrainTable } from '../engine/terrain';
import type { Site } from '../engine/resources';
import { getLang, t } from '../i18n';

const SIZE = 240;
const C = SIZE / 2;
const R = 88; // raio do círculo de horizonte (0 graus)
const MAX_DEG = 60; // o horizonte desenhado vai até 60 graus de elevação
const SUN_RING = R + 10;
const NS = 'http://www.w3.org/2000/svg';

/** Ponto na tela: azimute em graus (0 = norte no topo, 90 = leste à direita), raio em pixels. */
function point(az: number, r: number): [number, number] {
  const a = (az * Math.PI) / 180;
  return [C + r * Math.sin(a), C - r * Math.cos(a)];
}

function radiusFor(deg: number): number {
  return R * (1 - Math.min(Math.max(deg, 0), MAX_DEG) / MAX_DEG);
}

function el(tag: string, attrs: Record<string, string | number>, text?: string): SVGElement {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  if (text !== undefined) node.textContent = text;
  return node as SVGElement;
}

export function mountHorizonPanel(
  root: HTMLElement,
  sun: SunTable,
  terrain: TerrainTable,
  site: Site,
): (hour: number) => void {
  const svg = el('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, width: SIZE, height: SIZE, role: 'img' }) as SVGSVGElement;
  const rotation = sun.observers?.[site]?.grid_north_rotation_deg ?? sun.observer?.grid_north_rotation_deg ?? 0;
  svg.setAttribute('aria-label', t('horizon.svg'));

  svg.append(el('circle', { cx: C, cy: C, r: R, fill: 'rgba(10,14,24,0.6)', stroke: 'rgba(255,255,255,0.18)' }));
  svg.append(el('circle', { cx: C, cy: C, r: radiusFor(30), fill: 'none', stroke: 'rgba(255,255,255,0.10)', 'stroke-dasharray': '2 3' }));

  const profile = terrain.sites[site].horizon_deg;
  const step = terrain.azimuth_step_deg;
  const shape = profile
    .map((deg, k) => {
      const [x, y] = point(k * step - rotation, radiusFor(deg));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  svg.append(el('polygon', { points: shape, fill: 'rgba(127,209,255,0.28)', stroke: '#7fd1ff', 'stroke-width': 1 }));

  // Um elemento por cor (não 709): menos trabalho de repintura a cada mudança de hora.
  let litHours = 0;
  let litD = '';
  let unlitD = '';
  for (let h = 0; h < sun.hours; h += sun.step_hours) {
    const s = sampleAt(sun, h, site);
    const lit = isSunlit(sun, h, site, terrain);
    if (lit) litHours += sun.step_hours;
    const [x, y] = point(s.az - rotation, SUN_RING);
    const seg = `M${x.toFixed(1)} ${y.toFixed(1)}h0.01`;
    if (lit) litD += seg;
    else unlitD += seg;
  }
  svg.append(el('path', { d: unlitD, stroke: '#3a4150', 'stroke-width': 3.8, 'stroke-linecap': 'round', fill: 'none' }));
  svg.append(el('path', { d: litD, stroke: '#ffcf6b', 'stroke-width': 3.8, 'stroke-linecap': 'round', fill: 'none' }));

  svg.append(el('text', { x: C, y: 12, 'text-anchor': 'middle', fill: '#9aa6b8', 'font-size': 10 }, 'N'));
  const marker = el('circle', { cx: C, cy: C, r: 5, fill: '#ffffff', stroke: '#03050a', 'stroke-width': 1.5 });
  svg.append(marker);

  root.replaceChildren(svg);

  const caption = document.createElement('p');
  caption.className = 'cap';
  const captionFor = (): string => t('horizon.caption', { lit: litHours, total: sun.hours });
  caption.textContent = captionFor();
  root.append(caption);

  let shownLang = getLang();
  let lastHour = -1;
  return (hour: number) => {
    if (getLang() !== shownLang) {
      shownLang = getLang();
      caption.textContent = captionFor();
      svg.setAttribute('aria-label', t('horizon.svg'));
    }
    const h = Math.floor(hour);
    if (h === lastHour) return;
    lastHour = h;
    const s = sampleAt(sun, h, site);
    const [x, y] = point(s.az - rotation, SUN_RING);
    marker.setAttribute('cx', x.toFixed(1));
    marker.setAttribute('cy', y.toFixed(1));
    marker.setAttribute('fill', isSunlit(sun, h, site, terrain) ? '#ffcf6b' : '#ffffff');
  };
}
