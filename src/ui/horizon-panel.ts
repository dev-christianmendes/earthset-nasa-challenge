// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Painel polar: horizonte medido no LOLA e trajetória do Sol de 709 h (JPL Horizons).
// Só lê o motor (isSunlit, horizonAt) e as tabelas; não altera regra.
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

/**
 * Monta o painel no elemento `root` e devolve a função de atualização (hora inteira da partida).
 * Ponto amarelo: Sol acima do horizonte no momento. Cinza: Sol tapado pelo relevo.
 */
export function mountHorizonPanel(
  root: HTMLElement,
  sun: SunTable,
  terrain: TerrainTable,
  site: Site,
): (hour: number) => void {
  const svg = el('svg', { viewBox: `0 0 ${SIZE} ${SIZE}`, width: SIZE, height: SIZE, role: 'img' }) as SVGSVGElement;
  svg.setAttribute('aria-label', t('horizon.svg'));

  svg.append(el('circle', { cx: C, cy: C, r: R, fill: 'rgba(10,14,24,0.6)', stroke: 'rgba(255,255,255,0.18)' }));
  svg.append(el('circle', { cx: C, cy: C, r: radiusFor(30), fill: 'none', stroke: 'rgba(255,255,255,0.10)', 'stroke-dasharray': '2 3' }));

  // Relevo que tapa o Sol: a curva do horizonte medido, em todas as direções.
  const profile = terrain.sites[site].horizon_deg;
  const step = terrain.azimuth_step_deg;
  const shape = profile
    .map((deg, k) => {
      const [x, y] = point(k * step, radiusFor(deg));
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
  svg.append(el('polygon', { points: shape, fill: 'rgba(127,209,255,0.28)', stroke: '#7fd1ff', 'stroke-width': 1 }));

  // Trajetória do Sol em 709 horas, na borda: amarelo quando chega ao morro, cinza quando não.
  let litHours = 0;
  for (let h = 0; h < sun.samples.length; h++) {
    const s = sampleAt(sun, h);
    const lit = isSunlit(sun, h, site, terrain);
    if (lit) litHours++;
    const [x, y] = point(s.az, SUN_RING);
    svg.append(el('circle', { cx: x.toFixed(1), cy: y.toFixed(1), r: 1.9, fill: lit ? '#ffcf6b' : '#3a4150' }));
  }

  // Marcadores: norte e a posição do Sol na hora atual.
  svg.append(el('text', { x: C, y: 12, 'text-anchor': 'middle', fill: '#9aa6b8', 'font-size': 10 }, 'N'));
  const marker = el('circle', { cx: C, cy: C, r: 5, fill: '#ffffff', stroke: '#03050a', 'stroke-width': 1.5 });
  svg.append(marker);

  root.replaceChildren(svg);

  const caption = document.createElement('p');
  caption.className = 'cap';
  const captionFor = (): string => t('horizon.caption', { lit: litHours, total: sun.samples.length });
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
    const s = sampleAt(sun, h);
    const [x, y] = point(s.az, SUN_RING);
    marker.setAttribute('cx', x.toFixed(1));
    marker.setAttribute('cy', y.toFixed(1));
    marker.setAttribute('fill', isSunlit(sun, h, site, terrain) ? '#ffcf6b' : '#ffffff');
  };
}
