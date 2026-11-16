# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Verificação UX-03: painel contextual recolhível no celular em pé (412×915, toque).

Uso: python3 -B -u scripts/e2e-ux-mobile-panel.py [porta=5173] [pasta-de-saida]

Abre o painel do rover por toque, mede a área coberta, recolhe e reabre pelo
botão de recolher, e confere que a área recolhida fica só com o cabeçalho.
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('.scratch-agent/ux-mobile-panel')
OUT.mkdir(parents=True, exist_ok=True)
W, H = 412, 915
RESULTS = []


def check(name, condition, evidence=None):
    RESULTS.append({'check': name, 'passed': bool(condition), 'evidence': evidence})
    (OUT / 'results.json').write_text(json.dumps(RESULTS, ensure_ascii=False, indent=2) + '\n')
    print('PASS' if condition else 'FAIL', name, evidence, flush=True)
    assert condition, name


def panel_box(page):
    return page.evaluate("""() => {
      const e = document.getElementById('ctx');
      const r = e.getBoundingClientRect();
      const body = document.getElementById('ctx-body');
      return { top: r.top, bottom: r.bottom, height: r.height, vh: innerHeight,
               hidden: e.hidden, folded: e.classList.contains('folded'),
               bodyVisible: getComputedStyle(body).display !== 'none',
               expanded: document.getElementById('ctx-fold').getAttribute('aria-expanded') };
    }""")


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch()
        ctx = browser.new_context(viewport={'width': W, 'height': H}, has_touch=True, is_mobile=True, device_scale_factor=1)
        page = ctx.new_page()
        page.goto(f'http://127.0.0.1:{PORT}/')
        expect(page.locator('#menu')).to_be_visible(timeout=60000)
        for name in ['New mission', 'Lunar Cadet', 'Begin mission', 'Skip intro']:
            page.get_by_role('button', name=name).first.tap()
        expect(page.locator('#hud')).to_be_visible()
        page.wait_for_timeout(750)

        page.locator('#toolbar [data-tool=rover]').tap()
        expect(page.locator('#ctx')).to_be_visible()
        page.wait_for_timeout(400)

        open_box = panel_box(page)
        page.screenshot(path=str(OUT / 'aberto.png'))
        check('painel aberto ocupa a metade da tela (referência)',
              open_box['height'] / H > 0.4, f"altura {open_box['height']:.0f}px de {H}px")
        check('botão de recolher visível no celular',
              page.locator('#ctx-fold').is_visible(), 'visível')

        page.locator('#ctx-fold').tap()
        page.wait_for_timeout(200)
        folded = panel_box(page)
        page.screenshot(path=str(OUT / 'recolhido.png'))
        check('recolhido: corpo oculto e aria-expanded=false',
              folded['folded'] and not folded['bodyVisible'] and folded['expanded'] == 'false', str(folded))
        check('recolhido: cobre no máximo o cabeçalho (até 15% da tela)',
              folded['height'] / H <= 0.15, f"altura {folded['height']:.0f}px = {folded['height']/H:.0%} da tela")
        check('recolhido: painel continua aberto (não fechou)',
              not folded['hidden'], 'visível')

        page.locator('#ctx-fold').tap()
        page.wait_for_timeout(200)
        back = panel_box(page)
        check('reaberto: corpo volta e aria-expanded=true',
              not back['folded'] and back['bodyVisible'] and back['expanded'] == 'true', str(back))
        check('reaberto: altura volta ao painel completo',
              abs(back['height'] - open_box['height']) < 2, f"{back['height']:.0f}px contra {open_box['height']:.0f}px")

        browser.close()
    print(f"{sum(r['passed'] for r in RESULTS)}/{len(RESULTS)} verificações", flush=True)


if __name__ == '__main__':
    main()
