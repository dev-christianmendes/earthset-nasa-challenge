// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Posiciona equipe e comunicação abaixo do HUD real, incluindo quebras de linha e mudanças de viewport.
// ResizeObserver só reage a mudanças de tamanho; não há leituras de layout no loop de renderização.
export function mountHudLayout(): void {
  const hud = document.getElementById('hud');
  const topbar = document.getElementById('topbar');
  const squad = document.getElementById('squad');
  const guidance = document.getElementById('guidance');
  const panels = [...document.querySelectorAll<HTMLElement>('#side, #ctx')];
  if (!hud || !topbar || !squad || !guidance) return;

  const layout = (): void => {
    if (hud.hidden) return;
    const squadTop = topbar.offsetTop + topbar.offsetHeight + 8;
    const guidanceTop = squadTop + squad.offsetHeight + 8;
    hud.style.setProperty('--squad-top', `${squadTop}px`);
    hud.style.setProperty('--guidance-top', `${guidanceTop}px`);
    let panelLimit = 0;
    for (const panel of panels) {
      if (panel.hidden) continue;
      if (panel.offsetLeft < guidance.offsetLeft + guidance.offsetWidth && panel.offsetLeft + panel.offsetWidth > guidance.offsetLeft) {
        panelLimit = Math.max(panelLimit, hud.clientHeight - panel.offsetTop + 8);
      }
    }
    hud.style.setProperty('--guidance-panel-limit', `${panelLimit}px`);
  };
  const observer = new ResizeObserver(layout);
  observer.observe(hud);
  observer.observe(topbar);
  observer.observe(squad);
  for (const panel of panels) observer.observe(panel);
  window.addEventListener('resize', layout);
  layout();
}
