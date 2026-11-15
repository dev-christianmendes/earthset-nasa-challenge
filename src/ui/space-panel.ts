// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Painel científico do clima espacial (aba Ciência): histórico dos eventos NASA DONKI já ocorridos,
// o que é observado e o que é regra do jogo, limites dos dados. Só mostra o passado da partida.
import type { AlertView } from '../engine/alert';
import { eventsUntil, type SpaceEvent, type SpaceEventCatalog } from '../engine/space-events';
import { t } from '../i18n';

const esc = (s: string): string => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);

function utc(iso: string): string {
  return iso.replace('T', ' ').replace('Z', ' UTC');
}

function linkedLine(ev: SpaceEvent): string {
  if (!ev.linked_events.length) return '';
  const list = ev.linked_events
    .map((l) => `${esc(l.type)} ${esc(utc(l.time_utc))} <small>(${t('sci.lag', { h: l.lag_to_event_hours.toFixed(1) })})</small>`)
    .join('; ');
  return `<p><b>${t('sci.linked')}</b> ${list}<br><small class="prov">${t('sci.prov.fromId')}</small></p>`;
}

function alertsLine(ev: SpaceEvent): string {
  if (!ev.alerts.length) return '';
  const first = ev.alerts[0]!;
  const late = first.delay_after_event_hours > 0;
  return `<p><b>${t('sci.nasaAlert')}</b> ${esc(utc(first.issued_utc))} <small>${esc(first.id)}</small> — ${
    late ? t('sci.alert.late', { h: first.delay_after_event_hours.toFixed(1) }) : t('sci.alert.early', { h: Math.abs(first.delay_after_event_hours).toFixed(1) })
  }</p>`;
}

function eventHtml(ev: SpaceEvent, activeId: string | null): string {
  const sep = ev.type === 'SEP';
  const active = sep && activeId !== null && ev.id === activeId;
  const link = ev.link ? ` <a href="${esc(ev.link)}" target="_blank" rel="noopener noreferrer">${t('sci.open')}</a>` : '';
  const body = sep
    ? `<p>${t('sci.sep.what')}</p><p><b>${t('sci.apply')}</b> ${t('sci.sep.apply')}</p><p><b>${t('sci.conseq')}</b> ${t('sci.sep.conseq')} <small class="prov">${t('sci.prov.rule')}</small></p>`
    : `<p>${t('sci.gst.what')}</p><p><b>${t('sci.apply')}</b> ${t('sci.gst.apply')}</p>`;
  const kp = !sep && 'kp_max' in ev && ev.kp_max !== null ? `<p><b>Kp</b> ${ev.kp_max} <small class="prov">${t('sci.prov.earth')}</small></p>` : '';
  return `<li class="sci-ev${sep ? '' : ' muted'}${active ? ' active' : ''}">
    <div class="sci-head"><b>${t(`sci.type.${ev.type}`)}</b><span class="sci-badge">${t('sci.prov.observed')}</span></div>
    <p><b>${t('sci.when')}</b> ${esc(utc(ev.time_utc))}${ev.before_window_start ? ` <small>(${t('sci.before')})</small>` : ''}</p>
    <p><b>${t('sci.id')}</b> ${esc(ev.id)}${link}</p>
    ${body}${kp}${linkedLine(ev)}${alertsLine(ev)}
  </li>`;
}

/** Monta o painel; devolve a função de atualização (só redesenha quando algo muda). */
export function mountSpacePanel(root: HTMLElement, catalog: SpaceEventCatalog): (hour: number, alert: AlertView, lang: string) => void {
  let last = '';
  return (hour, alert, lang) => {
    const events = eventsUntil(catalog, hour);
    const sig = `${lang}|${events.length}|${alert.level}|${alert.evidence?.id ?? ''}`;
    if (sig === last) return;
    last = sig;
    const items = [...events].reverse().map((e) => eventHtml(e, alert.evidence?.id ?? null)).join('');
    root.innerHTML = `
      <h3>${t('sci.h')}</h3>
      <p class="side-sub">${t('sci.intro')}</p>
      <p class="sci-legend"><span class="sci-badge">${t('sci.prov.observed')}</span> ${t('sci.legend.observed')} · <span class="sci-badge calc">${t('sci.prov.rule')}</span> ${t('sci.legend.rule')}</p>
      <h4>${t('sci.history')} (${events.length})</h4>
      ${events.length ? `<ol class="sci-list">${items}</ol>` : `<p class="fine">${t('sci.none')}</p>`}
      <h4>${t('sci.limits')}</h4>
      <ul class="sci-limits">
        <li>${t('sci.lim.hindsight')}</li>
        <li>${t('sci.lim.duration')}</li>
        <li>${t('sci.lim.kp')}</li>
        <li>${t('sci.lim.missing', { list: catalog.not_downloaded.join('; ') || '—' })}</li>
        <li>${t('sci.lim.window')}</li>
      </ul>`;
  };
}
