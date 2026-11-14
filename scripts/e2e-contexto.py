# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
# Fluxo real de interface do painel contextual (D-18): seleção na cena, ordem, progresso, cancelamento,
# pausa, Esc e repetição de ordens (heap e FPS). Usa Playwright (Python) contra `npm run dev`.
# Uso: npx vite --port 5182 --strictPort &  e depois  python3 scripts/e2e-contexto.py [porta]
import json, sys
from playwright.sync_api import sync_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "5182"
URL = f"http://localhost:{PORT}/?autostart=cadet&nointro&hour=30&shot=habitat&perf=1"
FRAMES = "window.__ft=[];let _l=performance.now();(function f(n){window.__ft.push(n-_l);_l=n;requestAnimationFrame(f)})(performance.now());"
failures = []


def check(name, ok, detail=""):
    print(("ok   " if ok else "FAIL ") + name + (f"  [{detail}]" if detail else ""))
    if not ok:
        failures.append(name)


with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox", "--use-angle=vulkan", "--enable-features=Vulkan", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 1280, "height": 800})
    pg.add_init_script(FRAMES)
    errs = []
    pg.on("pageerror", lambda x: errs.append("pageerror " + str(x)[:200]))
    pg.on("console", lambda m: errs.append(m.text[:160]) if m.type == "error" else None)
    pg.goto(URL)
    pg.wait_for_selector("[data-tool=rover]", state="visible", timeout=60000)
    pg.wait_for_timeout(2500)

    def screen_of(who):
        """Posição na tela (px) de 'rover', 'crew0' ou 'crew1' (gancho de desenvolvimento em main.ts)."""
        return pg.evaluate("(w) => window.__earthset.screenOf(w)", who)

    def click_on(who):
        pos = screen_of(who)
        pg.mouse.click(pos[0], pos[1])

    def title():
        return pg.evaluate("document.getElementById('ctx').hidden ? '' : document.getElementById('ctx-title').textContent")

    def progress():
        return pg.evaluate("[...document.querySelectorAll('.ctx-progress:not([hidden]) .ctx-progress-line span')].map(s=>s.textContent)")

    def click_task(label):
        pg.evaluate("(l)=>[...document.querySelectorAll('#ctx-body .ctx-task')].find(b=>b.textContent.startsWith(l)).click()", label)

    # 1. Selecionar a estufa tocando na cena (visão geral, para tudo caber na tela)
    pg.click("[data-tool=base]"); pg.click("[data-cam=overview]"); pg.click("#side-close"); pg.wait_for_timeout(1800)
    click_on('greenhouse')
    pg.wait_for_timeout(300)
    check("tocar na estufa abre o painel", title() == "Greenhouse", title())

    # 2. Ordem: feedback em até 150 ms e progresso visível
    pg.evaluate("window.__t0 = performance.now(); window.__seen = null; new MutationObserver(()=>{ if(!window.__seen && document.querySelector('.ctx-progress:not([hidden])')) window.__seen = performance.now() }).observe(document.getElementById('ctx-body'), {childList:true, subtree:true, attributes:true, characterData:true})")
    click_task("Harvest")
    pg.wait_for_timeout(150)
    seen = pg.evaluate("window.__seen ? window.__seen - window.__t0 : null")
    check("ordem válida mostra o estado em ate 150 ms", seen is not None and seen <= 150, f"{seen}")
    pg.wait_for_timeout(300)
    check("estado 'ordem recebida' ou 'indo'", any("Harvest" in s for s in progress()), str(progress()))

    # 3. Velocidade 4x: a tarefa conclui e a comida sobe; barra some
    food0 = pg.evaluate("parseInt(document.querySelector('#hud-food, .res-food')?.textContent || '0')")
    for _ in range(2):
        pg.evaluate("document.getElementById('speed-btn').click()")
    pg.wait_for_function("!document.querySelector('.ctx-progress:not([hidden])')", timeout=90000)
    check("a colheita conclui em 4x", True)
    pg.evaluate("document.getElementById('speed-btn').click()")  # volta a 1x

    # 4. Cancelamento: ordenar inspeção, esperar, cancelar -> volta
    pg.wait_for_timeout(500)
    pg.evaluate("[...document.querySelectorAll('#ctx-body .ctx-task')].find(b=>b.textContent.startsWith('Inspect')).click()")
    pg.wait_for_timeout(2500)
    pg.evaluate("document.querySelector('.ctx-progress:not([hidden]) button').click()")
    pg.wait_for_timeout(300)
    check("cancelar manda o astronauta voltar", any("Returning" in s for s in progress()), str(progress()))
    pg.wait_for_function("!document.querySelector('.ctx-progress:not([hidden])')", timeout=90000)

    # 5. Selecionar rover e astronauta pela cena
    pg.keyboard.press("Escape")
    pg.wait_for_timeout(200)
    check("Esc fecha o painel sem pausar", title() == "" and not pg.evaluate("document.body.classList.contains('state-paused')"), title())
    pg.click("[data-tool=base]"); pg.click("[data-cam=rover]"); pg.click("#side-close"); pg.wait_for_timeout(1800)
    pos = screen_of("rover")
    check("rover tem posição na tela", pos is not None, str(pos))
    if pos:
        pg.mouse.click(pos[0], pos[1]); pg.wait_for_timeout(300)
        check("tocar no rover seleciona o rover", title() == "Rover", f"{title()} em {pos}")
    pos = screen_of("crew0")
    check("astronauta tem posição na tela", pos is not None, str(pos))
    if pos:
        pg.mouse.click(pos[0], pos[1]); pg.wait_for_timeout(300)
        check("tocar no astronauta seleciona o astronauta", title() == "Astronaut 1", f"{title()} em {pos}")

    # 6. Abrir uma ferramenta fecha o painel contextual
    pg.click("[data-tool=energy]"); pg.wait_for_timeout(300)
    check("abrir um painel de ferramenta fecha o contextual", title() == "", title())
    pg.click("#side-close")

    # 7. Pausa: tocar na cena não seleciona
    pg.click("#pause-btn"); pg.wait_for_timeout(300)
    click_on('greenhouse'); pg.wait_for_timeout(200)
    check("em pausa, tocar na cena não seleciona", title() == "", title())
    pg.evaluate("document.getElementById('resume').click()")

    # 8. Repetição: ordens seguidas a 4x (a base passiva perde perto da hora 117; por isso poucas repetições), heap e FPS estáveis (visão geral, com o painel fechado)
    pg.click("[data-tool=base]"); pg.click("[data-cam=overview]"); pg.click("#side-close"); pg.wait_for_timeout(1800)
    for _ in range(2):
        pg.evaluate("document.getElementById('speed-btn').click()")
    heap, fps = [], []
    for i in range(3):
        click_on('greenhouse'); pg.wait_for_timeout(250)
        pg.evaluate("[...document.querySelectorAll('#ctx-body .ctx-task')].find(b=>b.textContent.startsWith('Inspect')).click()")
        try:
            pg.wait_for_selector(".ctx-progress:not([hidden])", timeout=5000)
        except Exception:
            print("DEBUG", i, repr(title()), pg.evaluate("[...document.querySelectorAll('#ctx-body .ctx-task')].map(b=>b.textContent.slice(0,40)+(b.disabled?'[x]':''))"), pg.evaluate("document.body.className"), pg.evaluate("document.getElementById('toast').textContent"))
            raise
        pg.evaluate("window.__ft.length=0")
        try:
            pg.wait_for_function("!document.querySelector('.ctx-progress:not([hidden])')", timeout=30000)
        except Exception:
            print("DEBUG", i, pg.evaluate("document.getElementById('hour')?.textContent"), pg.evaluate("[...document.querySelectorAll('.screen:not([hidden])')].map(e=>e.id)"), pg.evaluate("document.getElementById('hud-hearts')?.textContent"), progress(), pg.evaluate("document.getElementById('speed-btn').textContent"))
            raise
        ft = pg.evaluate("window.__ft.slice(1)")
        fps.append(round(1000 / (sum(ft) / len(ft)), 1) if ft else 0)
        heap.append(pg.evaluate("Math.round(performance.memory.usedJSHeapSize/1048576)"))
        pg.keyboard.press("Escape"); pg.wait_for_timeout(300)
        pg.evaluate("document.getElementById('resume')?.click()")
    print("heap MB:", heap, "fps:", fps)
    check("heap estável nas repetições", max(heap) - min(heap) < 25, str(heap))
    check("FPS mantido nas repetições", min(fps) > 40, str(fps))
    check("sem erros de console", not errs, str(errs[:3]))
    b.close()

print(json.dumps({"falhas": failures}))
sys.exit(1 if failures else 0)
