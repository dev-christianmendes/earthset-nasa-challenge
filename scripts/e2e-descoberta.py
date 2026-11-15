# Uso: python3 scripts/e2e-descoberta.py [porta]   (precisa de `npm run dev` e GPU: Vulkan)
# Caminho de DESCOBERTA: menu -> New mission -> Cadet -> Begin -> Skip, depois só botões visíveis.
# Sem ?autostart e sem posições projetadas. Nasceu da auditoria v5 (docs/AUDITORIA_V5.md).
import json, sys
from playwright.sync_api import sync_playwright

port = sys.argv[1] if len(sys.argv) > 1 else "5180"
fails = []
def ok(cond, name, info=""):
    print(("ok   " if cond else "FALHA ") + name + (f"  [{info}]" if info != "" else ""))
    if not cond: fails.append(name)

CTX = "()=>{const c=document.getElementById('ctx');return {hidden:c.hidden,title:(document.getElementById('ctx-title')||{}).textContent,text:c.innerText.replace(/\\s+/g,' ')}}"
def ctx(pg): return pg.evaluate(CTX)

with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox", "--use-angle=vulkan", "--enable-features=Vulkan", "--ignore-gpu-blocklist"])
    pg = b.new_page(viewport={"width": 1280, "height": 800})
    errs = []
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    pg.goto(f"http://localhost:{port}/"); pg.wait_for_timeout(3000)
    ok("Earthset" in pg.title(), "a porta serve o Earthset", pg.title())
    for label in ["New mission", "Cadet", "Begin mission", "Skip intro"]:
        pg.get_by_role("button", name=label).first.click(); pg.wait_for_timeout(1200)
    pg.wait_for_timeout(1500)

    # Dica de descoberta
    pg.wait_for_function("document.getElementById('toast') && !document.getElementById('toast').hidden && /Tap the greenhouse/.test(document.getElementById('toast').innerText)", timeout=9000)
    ok(True, "a dica de que a cena é clicável aparece")

    # Estufa pela aba do menu inferior
    pg.click("[data-tool=greenhouse]"); pg.wait_for_timeout(500)
    c = ctx(pg)
    ok(not c["hidden"] and "Greenhouse" in c["title"], "aba Greenhouse abre o painel de ações", c["title"])
    for word in ["Inspect", "Harvest", "Maintenance", "Irrigation", "Lighting", "Mode"]:
        ok(word in c["text"], f"painel da estufa tem '{word}'")

    # Modo da estufa (antes só no painel antigo): muda e confere o estado
    pg.evaluate("[...document.querySelectorAll('#ctx-body .ctx-care')].find(e=>e.textContent.startsWith('Mode')).querySelectorAll('button')[2].click()")
    pg.wait_for_timeout(400)
    ok("Always on" in ctx(pg)["text"] and pg.evaluate("[...document.querySelectorAll('#ctx-body .ctx-care')].find(e=>e.textContent.startsWith('Mode')).querySelector('button.active').textContent") == "Always on", "modo 'Always on' aplicado")

    # Irrigação alta consome mais água (leitura da linha de consumo antes/depois)
    def use(): return pg.evaluate("[...document.querySelectorAll('#ctx-body li')].find(l=>l.textContent.startsWith('Consumption')).textContent")
    before = use()
    pg.evaluate("[...document.querySelectorAll('#ctx-body .ctx-care')].find(e=>e.textContent.startsWith('Irrigation')).querySelectorAll('button')[2].click()"); pg.wait_for_timeout(400)
    after = use(); ok(before != after, "irrigação alta muda o consumo da estufa", f"{before} -> {after}")

    # Tarefa de astronauta pela estufa
    pg.evaluate("[...document.querySelectorAll('#ctx-body .ctx-task')].find(b=>b.textContent.startsWith('Inspect')).click()"); pg.wait_for_timeout(600)
    toast = pg.evaluate("document.getElementById('toast').innerText.replace(/\\s+/g,' ')")
    ok("order received" in toast.lower(), "ordem de astronauta confirmada na tela", toast)

    # Aba Crew
    pg.click("[data-tool=crew]"); pg.wait_for_timeout(500)
    c = ctx(pg); ok(not c["hidden"] and "Astronaut" in c["title"], "aba Crew abre o painel do astronauta", c["title"])
    ok("Switch to" in c["text"], "há botão para trocar de astronauta")
    first = c["title"]
    pg.evaluate("[...document.querySelectorAll('#ctx-body .ctx-link')].find(b=>b.textContent.startsWith('Switch to')).click()"); pg.wait_for_timeout(500)
    ok(ctx(pg)["title"] != first, "troca para o outro astronauta", ctx(pg)["title"])
    pg.click("[data-tool=crew]"); pg.wait_for_timeout(300)
    ok(ctx(pg)["hidden"], "clicar a aba de novo fecha o painel")

    # Rover e Energia
    pg.click("[data-tool=rover]"); pg.wait_for_timeout(500)
    c = ctx(pg); ok("Rover" in c["title"] and "Lunar ice" in c["text"], "aba Rover abre as missões", c["title"])
    pg.click("[data-tool=energy]"); pg.wait_for_timeout(500)
    c = ctx(pg); ok(not c["hidden"] and "panel" in c["title"].lower(), "aba Energy abre os painéis solares", c["title"])

    # Abas que continuam laterais
    pg.click("[data-tool=missions]"); pg.wait_for_timeout(400)
    ok(ctx(pg)["hidden"] and not pg.evaluate("document.getElementById('side').hidden"), "aba Missions segue como painel lateral")
    ok(errs == [], "sem erros de console", errs[:3])
    pg.screenshot(path=sys.argv[2] if len(sys.argv) > 2 else "/dev/null")
    b.close()
print(json.dumps({"falhas": fails}, ensure_ascii=False))
sys.exit(1 if fails else 0)
