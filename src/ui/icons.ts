// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.

const P: Record<string, string> = {
  bolt: '<path d="M13 2 4 14h7l-1 8 9-12h-7z"/>',
  air: '<path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8"/>',
  drop: '<path d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11z"/>',
  leaf: '<path d="M5 19c0-8 6-14 15-14 0 9-6 15-14 15M5 19c3-4 6-6 9-8"/>',
  home: '<path d="M3 11 12 4l9 7M5 10v10h14V10M10 20v-5h4v5"/>',
  rover: '<rect x="4" y="8" width="13" height="6" rx="1.5"/><path d="M17 10h2l2 4h-4M8 8V5h4M12 5l2-2"/><circle cx="7" cy="17" r="2"/><circle cx="14" cy="17" r="2"/><circle cx="19.5" cy="17" r="1.5"/>',
  crew: '<circle cx="12" cy="7" r="3.5"/><path d="M10 6.5h4M5 21v-3a7 7 0 0 1 14 0v3M9 14v4M15 14v4"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  orbit: '<circle cx="12" cy="12" r="3"/><ellipse cx="12" cy="12" rx="10" ry="4.5" transform="rotate(-25 12 12)"/>',
  pause: '<path d="M9 5v14M15 5v14"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  min: '<path d="M5 12h14"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  heartFill: '<path fill="currentColor" d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  shield: '<path d="M12 3 5 6v6c0 4.5 3 7.5 7 9 4-1.5 7-4.5 7-9V6z"/>',
  panel: '<path d="M3 15 6 5h12l3 10zM7.5 5 6 15M12 5v10M16.5 5 18 15M4.5 10h15M12 15v5M8 20h8"/>',
  antenna: '<path d="M5 9a8 8 0 0 0 10 10zM10 14l4-4M14 10a2 2 0 1 0 0-.01M8 19l-2 2M12 19v2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  mouse: '<rect x="7" y="3" width="10" height="18" rx="5"/><path d="M12 7v3"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="m15.5 8.5-2 5-5 2 2-5z"/>',
  rocket: '<path d="M12 2c3 2.5 4.5 6 4.5 10v4h-9v-4C7.5 8 9 4.5 12 2zM7.5 13 4 16v3h3.5M16.5 13 20 16v3h-3.5M10 20h4"/><circle cx="12" cy="9" r="1.6"/>',
  chart: '<path d="M4 20V4M4 20h16M8 16l4-5 3 3 5-7"/>',
  sound: '<path d="M4 9v6h4l5 4V5L8 9zM16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/>',
  soundOff: '<path d="M4 9v6h4l5 4V5L8 9zM17 9l5 6M22 9l-5 6"/>',
  camera: '<path d="M4 8h3l1.5-2h7L17 8h3v11H4zM12 17a3.6 3.6 0 1 0 0-.01"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/>',
};

export function iconSvg(name: string): string {
  const body = P[name] ?? '';
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
}

export function mountIcons(root: ParentNode = document): void {
  for (const node of root.querySelectorAll<HTMLElement>('[data-icon]')) {
    const name = node.dataset.icon ?? '';
    if (node.dataset.iconDone === name) continue;
    node.innerHTML = iconSvg(name);
    node.dataset.iconDone = name;
  }
}
