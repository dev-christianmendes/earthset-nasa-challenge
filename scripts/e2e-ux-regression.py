# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Regressões UXR-01 a UXR-07 por UI real (sem atalhos/alteração do motor).
Uso: python3 -B -u scripts/e2e-ux-regression.py [porta=5173] [pasta-de-saida]
Requer Playwright Python/Chromium. Fixtures numéricas mudam só o texto do DOM
enquanto a partida está pausada, para verificar o espaço de 0–100 no HUD.
"""
import json
import sys
from pathlib import Path

from playwright.sync_api import expect, sync_playwright

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 5173
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('.scratch-agent/ux-regression')
OUT.mkdir(parents=True, exist_ok=True)
RESULTS = []
TOOLS = ['base', 'rover', 'crew', 'energy', 'greenhouse', 'missions', 'science']
NAMES = {
    'en': ['Base', 'Rover', 'Crew', 'Energy', 'Greenhouse', 'Missions', 'Science'],
    'pt': ['Base', 'Rover', 'Tripulação', 'Energia', 'Estufa', 'Missões', 'Ciência'],
}
TITLES = {
    'en': ['Base', 'Rover', 'Astronaut 1', 'Solar panels', 'Greenhouse', 'Missions', 'Science'],
    'pt': ['Base', 'Rover', 'Astronauta 1', 'Painéis solares', 'Estufa', 'Missões', 'Ciência'],
}

def check(name, condition, evidence=None):
    RESULTS.append({'check': name, 'passed': bool(condition), 'evidence': evidence})
    (OUT / 'results.json').write_text(json.dumps(RESULTS, ensure_ascii=False, indent=2) + '\n')
    assert condition, f'{name}: {evidence}'
    print('PASS', name, flush=True)

def screenshot(page, name):
    page.screenshot(path=str(OUT / f'{name}.png'))

def menu(page):
    page.goto(f'http://127.0.0.1:{PORT}/')
    expect(page.locator('#menu')).to_be_visible(timeout=60000)
    assert page.title().startswith('Earthset')

def start(page):
    menu(page)
    for name in ['New mission', 'Lunar Cadet', 'Begin mission', 'Skip intro']:
        page.get_by_role('button', name=name).first.click()
    expect(page.locator('#hud')).to_be_visible()
    page.wait_for_timeout(750)  # saída da introdução, não avanço artificial do relógio

def language(page, lang):
    page.locator('#pause-btn').click()
    page.locator('#pause [data-open=settings]').click()
    if page.locator('html').get_attribute('lang') != ('pt-BR' if lang == 'pt' else 'en'):
        page.locator('#settings [data-lang-toggle]').click()
    page.locator('#settings [data-back]').click()
    page.locator('#resume').click()

def non_overlapping(page, label):
    # Interseção da área realmente pintada, incluindo o recorte da coluna rolável.
    page.evaluate('()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))')
    boxes = page.evaluate("""() => {
      const ids=['topbar','squad','coach','toast','luma','ctx','toolbar'];
      return ids.flatMap(id => {
        const e=document.getElementById(id);
        if (!e.getClientRects().length || getComputedStyle(e).visibility==='hidden') return [];
        const r=e.getBoundingClientRect(); let x=Math.max(0,r.left), y=Math.max(0,r.top), right=Math.min(innerWidth,r.right), bottom=Math.min(innerHeight,r.bottom);
        for(let p=e.parentElement;p;p=p.parentElement) {
          const s=getComputedStyle(p);
          if (/(auto|scroll|hidden|clip)/.test(s.overflowY+s.overflowX)) {
            const b=p.getBoundingClientRect(); x=Math.max(x,b.left); y=Math.max(y,b.top); right=Math.min(right,b.right); bottom=Math.min(bottom,b.bottom);
          }
        }
        return right>x && bottom>y ? [{id,x,y,right,bottom}] : [];
      });
    }""")
    collisions = []
    for i, a in enumerate(boxes):
        for b in boxes[i + 1:]:
            if min(a['right'], b['right']) - max(a['x'], b['x']) > 1 and min(a['bottom'], b['bottom']) - max(a['y'], b['y']) > 1:
                collisions.append([a['id'], b['id']])
    check(label, not collisions, {'boxes': boxes, 'collisions': collisions})

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'])
    print('Chromium', browser.version, flush=True)
    page = None
    try:
        for w, h in [(1920, 924), (1280, 800), (780, 493), (844, 390), (320, 568)]:
            ctx = browser.new_context(viewport={'width': w, 'height': h}, has_touch=w < 760, is_mobile=w < 760, reduced_motion='reduce')
            page = ctx.new_page()
            menu(page)
            logo = page.locator('#logo-title').bounding_box()
            check(f'UXR-01 menu à esquerda {w}x{h}', logo['x'] < w * .2, logo)
            screenshot(page, f'menu-{w}x{h}')
            page.mouse.wheel(0, 1500)
            page.wait_for_timeout(200)
            target = page.locator('#menu [data-lang-toggle]')
            if w < 760:
                target.tap()
            else:
                target.click()
            check(f'UXR-01 idioma alcançável {w}x{h}', page.locator('html').get_attribute('lang') == 'pt-BR', target.bounding_box())
            page.locator('#menu .menu-btn').first.focus()
            for _ in range(14):
                page.keyboard.press('Tab')
                assert page.evaluate("""()=>{const e=document.activeElement,r=e.getBoundingClientRect();return !!e.closest('#menu')&&r.top>=-1&&r.bottom<=innerHeight+1}"""), f'menu: foco fora da tela {w}x{h}'
            page.locator('#menu [data-open=credits]').click()
            expect(page.locator('#credits')).to_be_visible()
            page.keyboard.press('Escape')
            check(f'UXR-01 créditos/voltar e teclado {w}x{h}', page.evaluate("()=>document.activeElement?.dataset.open==='credits'"))
            screenshot(page, f'menu-bottom-{w}x{h}')
            ctx.close()

        ctx = browser.new_context(viewport={'width': 1280, 'height': 800}, reduced_motion='reduce')
        page = ctx.new_page()
        start(page)
        page.locator('#toolbar [data-tool=rover]').click()
        for name in ['Lunar ice', 'Solar array installation', 'Solar array installation', 'Antenna repair']:
            page.get_by_role('button', name=name).first.click()
            page.wait_for_timeout(300)  # ação entra na fronteira seguinte, até 0,25 s em 1×
        expect(page.locator('#rover-badge')).to_have_text('4')
        expect(page.locator('#ctx-body')).to_contain_text('Queue full (max 4 tasks).')
        check('UXR-06 limite em inglês', '{max}' not in page.locator('#ctx-body').inner_text())
        language(page, 'pt')
        expect(page.locator('#ctx-body')).to_contain_text('Fila cheia (máximo de 4 tarefas).')
        check('UXR-06 limite em português', '{max}' not in page.locator('#ctx-body').inner_text())
        language(page, 'en')

        page.locator('#pause-btn').click()
        speed = page.locator('#speed-btn').inner_text()
        hour = page.locator('#hour').inner_text()
        page.locator('#pause [data-open=settings]').click()
        for key in ['Tab', 'Shift+Tab']:
            for _ in range(24):
                page.keyboard.press(key)
                assert page.evaluate("()=>!!document.activeElement?.closest('#settings')"), key
        check('UXR-03 foco confinado e fundo inerte', page.evaluate("()=>['hud','cine'].every(id=>document.getElementById(id).inert)&&document.querySelector('canvas').inert"))
        page.locator('#settings [data-back]').focus()
        page.keyboard.press('Enter')
        check('UXR-03 Voltar restaura foco na pausa', page.evaluate("()=>document.activeElement?.dataset.open==='settings'"))
        page.keyboard.press('Enter')
        page.keyboard.press('Escape')
        check('UXR-03 Escape restaura foco e preserva jogo', page.evaluate("()=>document.activeElement?.dataset.open==='settings'") and page.locator('#speed-btn').inner_text() == speed and page.locator('#hour').inner_text() == hour)
        page.keyboard.press('Escape')
        check('UXR-03 retomar restaura Pausa e libera HUD', page.evaluate("()=>document.activeElement?.id==='pause-btn'&&!document.getElementById('hud').inert"))

        for i, tool in enumerate(TOOLS):
            page.locator(f'#toolbar [data-tool={tool}]').click()
            for lang in ['pt', 'en']:
                language(page, lang)
                heading = page.locator('#ctx-title:visible, #side-title:visible')
                expect(heading).to_have_text(TITLES[lang][i])
                check(f'UXR-07 painel {tool} em {lang}', True, heading.inner_text())
            if page.locator('#ctx').is_visible():
                page.locator('#ctx-close').click()
            else:
                page.locator('#side-close').click()

        for lang in ['pt', 'en']:
            language(page, lang)
            page.set_viewport_size({'width': 390, 'height': 844})
            for name in NAMES[lang]:
                expect(page.locator('#toolbar').get_by_role('button', name=name, exact=True)).to_have_count(1)
            check(f'UXR-02 sete nomes móveis em {lang}, fila com badge', True, NAMES[lang])

        page.locator('#pause-btn').click()
        original = page.locator('.chip b').all_text_contents()
        for w, h in [(320, 568), (390, 844), (412, 915), (667, 375), (844, 390)]:
            page.set_viewport_size({'width': w, 'height': h})
            page.wait_for_timeout(100)
            for value in ['0', '9', '99', '100']:
                measurement = page.evaluate("""v=>{
                  const es=[...document.querySelectorAll('.chip b')]; es.forEach((e,i)=>e.textContent=v+(i===0?'%':''));
                  return es.map(e=>{const r=document.createRange();r.selectNodeContents(e);const b=r.getBoundingClientRect(),c=e.closest('.chip').getBoundingClientRect();return {value:e.textContent,left:b.left,right:b.right,top:b.top,bottom:b.bottom,cardLeft:c.left,cardRight:c.right}});
                }""", value)
                fits = all(m['left'] >= m['cardLeft'] - .25 and m['right'] <= m['cardRight'] + .25 and m['left'] >= 0 and m['right'] <= w for m in measurement)
                separate = all(a['right'] <= b['left'] - 1 for a, b in zip(measurement, measurement[1:]))
                check(f'UXR-05 {w}x{h}, valor {value}', fits and separate, measurement)
            controls = page.evaluate("""()=>[...document.querySelectorAll('.clock,.chip,.tb-right button,.hearts,#space')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return {id:e.id||e.className,left:r.left,right:r.right,top:r.top,bottom:r.bottom}})""")
            collisions = [[a['id'], b['id']] for i, a in enumerate(controls) for b in controls[i+1:] if min(a['right'], b['right']) - max(a['left'], b['left']) > 1 and min(a['bottom'], b['bottom']) - max(a['top'], b['top']) > 1]
            check(f'UXR-05 relógio e controles separados {w}x{h}', not collisions and all(r['left'] >= 0 and r['right'] <= w for r in controls), {'boxes': controls, 'collisions': collisions})
            page.evaluate("texts=>document.querySelectorAll('.chip b').forEach((e,i)=>e.textContent=texts[i])", original)
            page.keyboard.press('Escape')
            screenshot(page, f'hud-{w}x{h}')
            page.locator('#pause-btn').click()
        ctx.close()

        ctx = browser.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, has_touch=True, is_mobile=True, reduced_motion='reduce')
        page = ctx.new_page()
        start(page)
        page.wait_for_timeout(5200)
        expect(page.locator('#coach')).to_be_visible()
        expect(page.locator('#toast')).to_be_hidden()
        non_overlapping(page, 'UXR-04 passo 1, dica suprimida e alerta preservado')
        screenshot(page, 'mobile-first-step')
        page.locator('#toolbar').get_by_role('button', name='Rover', exact=True).tap()
        non_overlapping(page, 'UXR-04 passo 2 e painel')
        page.get_by_role('button', name='Lunar ice').first.tap()
        expect(page.locator('#toast')).to_be_visible()
        expect(page.locator('#coach')).to_be_hidden()
        non_overlapping(page, 'UXR-04 confirmação substitui orientação')
        screenshot(page, 'mobile-order-received')
        page.wait_for_timeout(4400)
        expect(page.locator('#coach')).to_be_visible()
        non_overlapping(page, 'UXR-04 passo 3 reaparece após confirmação')
        page.locator('#ctx-close').tap()
        page.locator('#coach').get_by_role('button', name='Got it').tap()
        expect(page.locator('#coach')).to_be_hidden()
        expect(page.locator('#luma')).to_be_visible()
        page.locator('#luma-min').tap()
        check('UXR-04 alerta ainda consultável após concluir/minimizar', page.locator('#luma').is_visible() and page.locator('#luma').evaluate("e=>e.classList.contains('critical')"))
        page.locator('#luma-history-btn').tap()
        expect(page.locator('#luma-text')).to_be_visible()
        expect(page.locator('#luma-history')).to_be_visible()
        screenshot(page, 'mobile-alert-history')
        ctx.close()
        print(f'DONE {len(RESULTS)} checks; {OUT}', flush=True)
    except Exception:
        if page and not page.is_closed():
            screenshot(page, 'failure')
            (OUT / 'failure.html').write_text(page.content())
        raise
    finally:
        browser.close()
