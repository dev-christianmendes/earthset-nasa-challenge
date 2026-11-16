# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Medição de contraste WCAG AA (UX-09) por navegador real.

Uso: python3 -B -u scripts/e2e-ux-contrast.py [porta=5173] [pasta-de-saida]

Mede cada texto visível do menu, do HUD e de painéis em desktop (1280x800) e
celular (412x915). A cor de fundo é composta a partir dos ancestrais; texto
sobre a cena 3D (canvas, sem fundo opaco no DOM) é marcado como não medido.
Limiares: 4,5:1 para texto normal; 3:1 para texto grande (24 px, ou 18,66 px
em negrito).
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('.scratch-agent/ux-contrast')
OUT.mkdir(parents=True, exist_ok=True)

VIEWPORTS = {'desktop': (1280, 800), 'mobile': (412, 915)}
TOOLS = ['base', 'rover', 'crew', 'energy', 'greenhouse', 'missions', 'science']

MEASURE_JS = r"""
() => {
  const parse = s => {
    const m = s.match(/rgba?\(([^)]+)\)/);
    if (!m) return null;
    const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number);
    return { r: p[0], g: p[1], b: p[2], a: p.length > 3 ? p[3] : 1 };
  };
  const over = (top, bot) => {
    const a = top.a + bot.a * (1 - top.a);
    const mix = k => a === 0 ? 0 : (top[k] * top.a + bot[k] * bot.a * (1 - top.a)) / a;
    return { r: mix('r'), g: mix('g'), b: mix('b'), a };
  };
  const lum = c => {
    const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
  };
  const ratio = (a, b) => {
    const l1 = lum(a), l2 = lum(b);
    return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
  };
  const effOpacity = el => {
    let o = 1;
    for (let e = el; e; e = e.parentElement) o *= parseFloat(getComputedStyle(e).opacity);
    return o;
  };
  const backdrop = el => {
    // Camadas de fundo do elemento até a raiz; compõe de cima para baixo.
    const layers = [];
    for (let e = el; e; e = e.parentElement) {
      const c = parse(getComputedStyle(e).backgroundColor);
      if (c && c.a > 0) layers.push(c);
      if (c && c.a === 1) break;
    }
    if (!layers.length || layers[layers.length - 1].a < 1) return null; // sem base opaca
    let acc = layers[layers.length - 1];
    for (let i = layers.length - 2; i >= 0; i--) acc = over(layers[i], acc);
    return acc;
  };
  const out = [];
  const seen = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const text = node.textContent.trim();
    const el = node.parentElement;
    if (!text || !el || seen.has(el)) continue;
    if (el.closest('script,style,noscript,canvas')) continue;
    seen.add(el);
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden') continue;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) continue;
    if (rect.right <= 0 || rect.bottom <= 0 || rect.left >= innerWidth || rect.top >= innerHeight) continue;
    const fg = parse(cs.color);
    if (!fg) continue;
    const op = effOpacity(el);
    fg.a *= op;
    const bg = backdrop(el);
    const size = parseFloat(cs.fontSize);
    const weight = parseInt(cs.fontWeight, 10);
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const need = large ? 3 : 4.5;
    let r = null;
    if (bg) {
      const solid = over({ ...fg, a: fg.a }, bg);
      r = ratio(solid, bg);
    }
    out.push({
      text: text.slice(0, 60),
      id: el.id || '',
      cls: (el.className && typeof el.className === 'string') ? el.className.slice(0, 40) : '',
      size, weight, need,
      ratio: r === null ? null : Math.round(r * 100) / 100,
      fg: `rgba(${fg.r|0},${fg.g|0},${fg.b|0},${Math.round(fg.a*100)/100})`,
      bg: bg ? `rgb(${bg.r|0},${bg.g|0},${bg.b|0})` : null,
    });
  }
  return out;
}
"""


def run_page(page, label, results):
    items = page.evaluate(MEASURE_JS)
    for it in items:
        it['where'] = label
        it['fail'] = it['ratio'] is not None and it['ratio'] < it['need']
        it['unmeasured'] = it['ratio'] is None
    results.extend(items)
    print(f'{label}: {len(items)} textos, '
          f'{sum(1 for i in items if i["fail"])} abaixo, '
          f'{sum(1 for i in items if i["unmeasured"])} sem fundo opaco', flush=True)


def open_menu(page):
    page.goto(f'http://127.0.0.1:{PORT}/')
    expect(page.locator('#menu')).to_be_visible(timeout=60000)


def start_game(page):
    open_menu(page)
    for name in ['New mission', 'Lunar Cadet', 'Begin mission', 'Skip intro']:
        page.get_by_role('button', name=name).first.click()
    expect(page.locator('#hud')).to_be_visible()
    page.wait_for_timeout(750)


def main():
    results = []
    with sync_playwright() as p:
        browser = p.chromium.launch()
        for vp_name, (w, h) in VIEWPORTS.items():
            ctx = browser.new_context(viewport={'width': w, 'height': h})
            page = ctx.new_page()
            open_menu(page)
            page.wait_for_timeout(500)
            run_page(page, f'{vp_name}/menu', results)
            start_game(page)
            run_page(page, f'{vp_name}/hud', results)
            for tool in TOOLS:
                page.locator(f'#toolbar [data-tool={tool}]').click()
                page.wait_for_timeout(400)
                run_page(page, f'{vp_name}/painel:{tool}', results)
            ctx.close()
        browser.close()

    (OUT / 'contrast.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
    fails = [r for r in results if r['fail']]
    # Agrupa repetições do mesmo texto/cor para o resumo.
    uniq = {}
    for r in fails:
        key = (r['text'], r['fg'], r['bg'])
        uniq.setdefault(key, {**r, 'where': []})['where'].append(r['where'])
    print(f'\nTotal de textos: {len(results)} · abaixo do limite: {len(fails)} · únicos: {len(uniq)}')
    for (text, fg, bg), r in sorted(uniq.items(), key=lambda kv: kv[1]['ratio']):
        print(f"{r['ratio']:>5} / {r['need']} {fg} sobre {bg} · {r['size']}px w{r['weight']} · "
              f"'{text}' · {r['where'][0]}{' (+' + str(len(r['where'])-1) + ')' if len(r['where']) > 1 else ''}")


if __name__ == '__main__':
    main()
