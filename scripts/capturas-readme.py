# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
# Uso: npx vite --port 5190 --strictPort &  e depois  python3 scripts/capturas-readme.py [porta] [pasta-de-saida]
import json, os, sys
from playwright.sync_api import sync_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else "5190"
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "docs", "img")
BASE = f"http://localhost:{PORT}/"
DESKTOP = {"width": 1280, "height": 800}
MOBILE = {"width": 390, "height": 844}
ARGS = ["--no-sandbox", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"]
os.makedirs(OUT, exist_ok=True)
log = []

def note(name, ok, detail=""):
    log.append({"captura": name, "ok": ok, "detalhe": detail})
    print(("ok   " if ok else "FALHA ") + name + (f"  [{detail}]" if detail else ""))

def wait_game(pg):
    pg.wait_for_selector("[data-tool=rover]", state="visible", timeout=90000)
    pg.wait_for_timeout(2500)

def click_object(pg, who):
    pos = pg.evaluate("(w) => window.__earthset.screenOf(w)", who)
    if not pos:
        raise RuntimeError(f"objeto {who} fora da tela")
    pg.mouse.click(pos[0], pos[1])
    pg.wait_for_timeout(900)

def shot(pg, name):
    pg.screenshot(path=os.path.join(OUT, name), type="jpeg", quality=86)

def capture(browser, name, query, viewport=DESKTOP, steps=None, wait="game", lang_storage=None, delay=0):
    ctx = browser.new_context(viewport=viewport, device_scale_factor=1)
    pg = ctx.new_page()
    errs = []
    pg.on("pageerror", lambda e: errs.append(str(e)[:160]))
    try:
        pg.goto(BASE + query)
        if wait == "game":
            wait_game(pg)
        elif wait.startswith("#"):
            pg.wait_for_selector(wait, state="visible", timeout=60000)
            pg.wait_for_timeout(1200)
        else:
            pg.wait_for_timeout(2500)
        for step in steps or []:
            step(pg)
        if delay:
            pg.wait_for_timeout(delay)
        shot(pg, name)
        note(name, not errs, "; ".join(errs) if errs else f"query={query}")
    except Exception as e:
        note(name, False, str(e)[:200])
    finally:
        ctx.close()
    return name

with sync_playwright() as p:
    b = p.chromium.launch(args=ARGS)
    G = "?autostart=cadet&nointro&hour=30"

    capture(b, "01-menu.jpg", "", wait="[data-go=modes]")
    capture(b, "02-modos.jpg", "?screen=modes", wait="[data-mode=cadet]")
    capture(b, "03-como-jogar.jpg", "?screen=howto", wait="#howto")
    capture(b, "04-ciencia-menu.jpg", "?screen=science", wait="#science")
    capture(b, "05-configuracoes.jpg", "?screen=settings", wait="#settings")
    capture(b, "06-creditos.jpg", "?screen=credits", wait="#credits")
    capture(b, "07-historia.jpg", "?screen=story", wait="#story")

    capture(b, "08-introducao.jpg", "?autostart=cadet&cineAt=7", wait="other", delay=500)

    capture(b, "09-base-dia.jpg", G)
    capture(b, "10-base-noite.jpg", "?autostart=cadet&nointro&clockAt=400")
    capture(b, "11-base-pt.jpg", G + "&lang=pt")

    capture(b, "12-painel-rover.jpg", G + "&hour=30&task=ice&after=3&tool=rover&shot=rover")
    capture(b, "13-painel-estufa.jpg", G + "&tool=greenhouse")
    capture(b, "14-painel-tripulacao.jpg", G + "&tool=crew")
    capture(b, "15-painel-energia.jpg", G + "&tool=energy")
    capture(b, "16-painel-missoes.jpg", G + "&tool=missions")
    capture(b, "17-painel-ciencia.jpg", G + "&tool=science")
    capture(b, "18-tempestade-alerta.jpg", "?autostart=cadet&nointro&hour=30&clockAt=406&tool=science")

    capture(b, "19-selecao-habitat.jpg", G, steps=[lambda pg: click_object(pg, "habitat")])
    capture(b, "20-selecao-rover.jpg", G, steps=[lambda pg: click_object(pg, "rover")])
    capture(b, "21-selecao-astronauta.jpg", G, steps=[lambda pg: click_object(pg, "crew0")])

    capture(b, "22-antena-selecionada.jpg", G + "&antenna=tuned", steps=[lambda pg: click_object(pg, "antenna")])

    capture(b, "23-luma-historico.jpg", G, steps=[lambda pg: pg.click("#luma-history-btn")])
    capture(b, "24-pausa.jpg", G, steps=[lambda pg: pg.click("#pause-btn")])

    capture(b, "25-fim-partida.jpg", "?autostart=cadet&nointro&hour=708", delay=800)
    capture(b, "26-celular-base.jpg", G, viewport=MOBILE)
    capture(b, "27-celular-menu.jpg", "", viewport=MOBILE, wait="[data-go=modes]")

    ctx = b.new_context(viewport=DESKTOP, device_scale_factor=1)
    pg = ctx.new_page()
    try:
        pg.goto(BASE + "?screen=settings")
        pg.wait_for_selector("#set-explain", state="attached", timeout=60000)
        pg.check("#set-explain")
        pg.wait_for_timeout(400)
        pg.goto(BASE + G + "&tool=energy")
        wait_game(pg)
        pg.wait_for_timeout(600)
        shot(pg, "28-modo-escola-energia.jpg")
        note("28-modo-escola-energia.jpg", True)
        pg.goto(BASE + G + "&tool=base")
        wait_game(pg)
        pg.wait_for_timeout(600)
        shot(pg, "29-modo-escola-base.jpg")
        note("29-modo-escola-base.jpg", True)
    except Exception as e:
        note("28-modo-escola-energia.jpg", False, str(e)[:200])
    finally:
        ctx.close()

    b.close()

with open(os.path.join(OUT, "capturas.json"), "w", encoding="utf-8") as f:
    json.dump(log, f, ensure_ascii=False, indent=1)
falhas = [x for x in log if not x["ok"]]
print(f"\n{len(log) - len(falhas)}/{len(log)} capturas ok")
sys.exit(1 if falhas else 0)
