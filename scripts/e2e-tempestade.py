# Uso: python3 scripts/e2e-tempestade.py [porta]   (precisa de `npm run dev` e GPU: Vulkan)
# Cenário histórico NASA DONKI de 09/10/2024: alerta, monitoramento (antena), abrigo e recuperação, pelo navegador.
# Usa os atalhos de captura do servidor de desenvolvimento: &clockAt=<hora> e &antenna=base|tuned.
import json, sys
from playwright.sync_api import sync_playwright

port = sys.argv[1] if len(sys.argv) > 1 else "5180"
fails = []
def ok(cond, name, info=""):
    print(("ok   " if cond else "FALHA ") + name + (f"  [{info}]" if info != "" else ""))
    if not cond: fails.append(name)

def chip(pg): return pg.evaluate("document.getElementById('space').textContent")
def hour(pg): return pg.evaluate("Number(document.querySelector('#hud').innerText.match(/Mission hour\\s*(\\d+)/)?.[1] ?? -1)")
def luma(pg): return pg.evaluate("document.querySelector('#luma')?.innerText.replace(/\\s+/g,' ') || ''")
def title(pg): return pg.evaluate("document.getElementById('space').title || ''")
def speed4(pg):
    for _ in range(2): pg.evaluate("document.getElementById('speed-btn').click()")

def open_game(b, query, w=1280, h=800):
    pg = b.new_page(viewport={"width": w, "height": h})
    pg.goto(f"http://localhost:{port}/?autostart=cadet&{query}"); pg.wait_for_timeout(3500)
    return pg

with sync_playwright() as p:
    b = p.chromium.launch(args=["--no-sandbox", "--use-angle=vulkan", "--enable-features=Vulkan", "--ignore-gpu-blocklist"])
    errs = []

    # 1. Abertura do cenário: o EP-01 já está em curso na hora 0 (janela mantida pelo autor).
    pg = open_game(b, "nointro")
    pg.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
    c = chip(pg); ok("ALERT" in c or "SHELTER" in c, "hora 0: o jogo abre em ALERTA ou ABRIGO (radiação em curso)", c)
    pg.wait_for_timeout(3500)
    c = chip(pg); ok("SHELTER" in c, "depois do caminho até o abrigo, o estado é ABRIGO", c)
    ok("DONKI" in title(pg), "o chip cita o registro NASA DONKI", title(pg))
    l = luma(pg); ok("DONKI" in l and "2024-10-09" in l, "a LUMA cita o registro SEP e o horário UTC", l[:160])
    ok("24 h" in l, "a LUMA diz que a duração de 24 h é suposição do jogo")

    # 2. Tripulação abrigada: a ordem é aceita, mas a tarefa fica pausada no abrigo
    CREW = "document.getElementById('ctx').innerText.replace(/\\s+/g,' ')"
    pg.keyboard.press("4"); pg.wait_for_timeout(500)
    ok("In the shelter (task paused)" in pg.evaluate(CREW), "astronauta aparece no abrigo durante a radiação", pg.evaluate(CREW)[:70])
    pg.evaluate("[...document.querySelectorAll('#ctx-body .ctx-task')].find(b=>!b.disabled && b.textContent.startsWith('Inspect')).click()"); pg.wait_for_timeout(800)
    t = pg.evaluate(CREW)
    ok("Task Inspect" in t and "task paused" in t, "ordem dada durante a radiação fica registrada e pausada no abrigo", t[:110])
    pg.keyboard.press("Escape")

    # 3. Pausa e aceleração durante o evento
    h0 = hour(pg); pg.click("#pause-btn"); pg.wait_for_timeout(1500); h1 = hour(pg)
    ok(h0 == h1, "em pausa a hora não avança", f"{h0}->{h1}")
    pg.evaluate("document.getElementById('resume').click()")
    # 4. Recuperação e volta ao normal
    pg.close()
    pg = open_game(b, "nointro&clockAt=22")
    pg.keyboard.press("4"); pg.wait_for_timeout(500)
    pg.evaluate("[...document.querySelectorAll('#ctx-body .ctx-task')].find(b=>!b.disabled && b.textContent.startsWith('Inspect')).click()"); pg.wait_for_timeout(500)
    pg.keyboard.press("Escape")
    speed4(pg)
    seen = set()
    for _ in range(40):
        pg.wait_for_timeout(500); c = chip(pg)
        for key in ("SHELTER", "recovery", "calm space weather"):
            if key in c: seen.add(key)
        if "calm space weather" in c: break
    ok("recovery" in seen, "ao fim do episódio entra em RECUPERAÇÃO", sorted(seen))
    ok("calm space weather" in chip(pg), "depois da recuperação volta ao NORMAL", chip(pg))
    pg.keyboard.press("4"); pg.wait_for_timeout(500)
    t = pg.evaluate("document.getElementById('ctx').innerText.replace(/\\s+/g,' ')")
    ok("task paused" not in t and ("Task Inspect" in t or "Inspect" in t.split("ASSIGN")[0]), "terminado o evento, o astronauta retoma a tarefa (ou a conclui)", t[:120])
    pg.close()

    # 5. Monitoramento: só com a antena ajustada; sem ajuste e sem antena o estado segue calmo
    for mode, expect in (("&antenna=tuned", True), ("&antenna=base", False), ("", False)):
        pg = open_game(b, f"nointro&clockAt=409{mode}")
        pg.wait_for_timeout(800); c = chip(pg)
        ok(("monitoring" in c) == expect, f"hora 409 {mode or 'sem antena'}: monitoramento {'ligado' if expect else 'desligado'}", c)
        if expect:
            ok("DONKI" in title(pg), "o monitoramento cita o ID da NASA", title(pg))
            l = luma(pg); ok("NASA DONKI recorded" in l and "later" in l, "a LUMA fala de erupção ou CME, sem prometer hora", l[:170])
            ok("hours left" not in l.lower() and " in about" not in l.lower(), "a LUMA não promete tempo restante")
            speed4(pg); got = False
            for _ in range(30):
                pg.wait_for_timeout(500)
                if "ALERT" in chip(pg) or "SHELTER" in chip(pg): got = True; break
            ok(got, "ao chegar o SEP registrado, o estado vira ALERTA ou ABRIGO", chip(pg))
        pg.close()

    # 7. Painel científico: o chip do HUD abre; histórico só com o passado; limites e proveniência visíveis
    SCI = "document.querySelector('#space-panel')?.innerText.replace(/\\s+/g,' ') || ''"
    pg = open_game(b, "nointro")
    pg.evaluate("document.getElementById('space').click()"); pg.wait_for_timeout(800)
    s0 = pg.evaluate(SCI)
    n0 = pg.evaluate("document.querySelectorAll('#space-panel .sci-ev').length")
    ok("event history" in s0.lower() and n0 >= 1, "clicar no chip abre o painel científico com histórico", f"{n0} eventos")
    ok("9-10" in s0 or "2024-10-0" in s0, "mostra horário UTC e ID NASA do evento", s0[150:260])
    ok("false alarm" in s0, "declara a limitação: catálogo sem falsos alarmes")
    ok("game rule" in s0 and "observed" in s0, "distingue observado de regra do jogo")
    ok(pg.evaluate("[...document.querySelectorAll('#space-panel a')].every(a=>a.rel.includes('noopener'))"), "links externos com noopener")
    pg.close()
    pg = open_game(b, "nointro&clockAt=430")
    pg.evaluate("document.getElementById('space').click()"); pg.wait_for_timeout(800)
    n1 = pg.evaluate("document.querySelectorAll('#space-panel .sci-ev').length")
    s1 = pg.evaluate(SCI)
    ok("no effect on the lunar base" in s1 and "Kp" in s1, "evento GST: explica que o Kp não vale para a Lua", s1[s1.find("Geomagnetic"):][:120])
    ok(n1 > n0, "o histórico cresce com o tempo (não mostra o futuro)", f"{n0} -> {n1}")
    pg.close()

    # 8. Decisão do jogador: continuar fora (risco explícito) e voltar atrás
    CTX = "document.getElementById('ctx').innerText.replace(/\\s+/g,' ')"
    def exposure(pg):
        m = __import__("re").search(r"Radiation exposure ([\d.]+) of", pg.evaluate(CTX)); return float(m.group(1)) if m else -1
    pg = open_game(b, "nointro"); pg.wait_for_timeout(3500)
    pg.keyboard.press("1"); pg.wait_for_timeout(500)
    ok("Stay outside and accept the risk" in pg.evaluate(CTX), "durante o evento o habitat oferece a decisão de ficar fora")
    ok("12 h of exposure cost 1 heart" in pg.evaluate(CTX), "o risco aparece escrito: horas de exposição e custo em coração")
    pg.evaluate("[...document.querySelectorAll('#ctx-body button')].find(b=>b.textContent.startsWith('Stay outside')).click()"); pg.wait_for_timeout(600)
    ok("by your order" in chip(pg), "com a decisão de ficar fora o chip diz ALERTA por ordem do jogador", chip(pg))
    ok("stay outside" in luma(pg).lower(), "a LUMA registra a decisão e o custo", luma(pg)[:120])
    e0 = exposure(pg); pg.wait_for_timeout(2500); e1 = exposure(pg)  # 1×: em 4× passaria de 12 h e o painel (módulo 12) reiniciaria
    ok(e1 > e0, "a exposição cresce enquanto a equipe fica fora", f"{e0} -> {e1}")
    pg.evaluate("[...document.querySelectorAll('#ctx-body button')].find(b=>b.textContent.startsWith('Shelter')).click()")
    got = False
    for _ in range(30):
        pg.wait_for_timeout(500)
        if "SHELTER" in chip(pg): got = True; break
    ok(got, "mudar de ideia e abrigar leva ao estado ABRIGO", chip(pg))
    pg.close()

    # 6. Reinício da partida: menu → nova missão volta à hora 0 e ao cenário
    pg = b.new_page(viewport={"width": 1280, "height": 800}); pg.goto(f"http://localhost:{port}/"); pg.wait_for_timeout(3000)
    for label in ["New mission", "Cadet", "Begin mission", "Skip intro"]:
        pg.get_by_role("button", name=label).first.click(); pg.wait_for_timeout(1200)
    pg.wait_for_timeout(2500)
    pg.click("#pause-btn"); pg.wait_for_timeout(300); pg.evaluate("document.getElementById('to-menu').click()"); pg.wait_for_timeout(1500)
    for label in ["New mission", "Cadet", "Begin mission", "Skip intro"]:
        pg.get_by_role("button", name=label).first.click(); pg.wait_for_timeout(1200)
    pg.wait_for_timeout(1500)
    c = chip(pg); ok(hour(pg) <= 3 and ("ALERT" in c or "SHELTER" in c), "reiniciar volta à hora 0 com o cenário em ALERTA ou ABRIGO", f"hora {hour(pg)} · {c}")
    ok(errs == [], "sem erros de console", errs[:3])
    b.close()
print(json.dumps({"falhas": fails}, ensure_ascii=False))
sys.exit(1 if fails else 0)
