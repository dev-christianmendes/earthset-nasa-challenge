# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Sequência do disco solar em 1× (AST-VIS-02): o Sol se move a cada quadro, sem degraus.

Lê `window.__earthset.sunDirection()` (só em `npm run dev`) durante alguns segundos
e mede: quantas leituras mudam, a maior sequência de leituras iguais e o maior passo angular.
Uso: python3 -B -u scripts/e2e-sol-continuo.py [porta=5193] [segundos=4]
"""
import json
import math
import sys
import time
from pathlib import Path

from playwright.sync_api import sync_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else '5193'
SECONDS = float(sys.argv[2]) if len(sys.argv) > 2 else 4.0
OUT = Path('.scratch-agent/sol-continuo')
OUT.mkdir(parents=True, exist_ok=True)

def angle_deg(a, b):
    dot = max(-1.0, min(1.0, sum(x * y for x, y in zip(a, b))))
    return math.degrees(math.acos(dot))

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'])
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.goto(f'http://localhost:{PORT}/?autostart=cadet&nointro&hour=60&lang=en')
    page.wait_for_function('() => window.__earthset && window.__earthset.sunDirection', timeout=60000)
    page.wait_for_timeout(1500)

    samples = []
    t0 = time.perf_counter()
    while time.perf_counter() - t0 < SECONDS:
        d = page.evaluate('() => window.__earthset.sunDirection()')
        samples.append((time.perf_counter() - t0, d))
        page.wait_for_timeout(50)
    browser.close()

distinct = 0
longest_run = run = 1
steps = []
for (t_a, a), (t_b, b) in zip(samples, samples[1:]):
    step = angle_deg(a, b)
    steps.append(step)
    if step > 1e-9:
        distinct += 1
        run = 1
    else:
        run += 1
        longest_run = max(longest_run, run)

# Em 1× o Sol anda cerca de 0,51° por hora simulada; passo esperado por leitura é pequeno.
span = samples[-1][0] - samples[0][0]
result = {
    'reads': len(samples),
    'span_s': round(span, 2),
    'reads_per_s': round(len(samples) / span, 1),
    'changed_reads': distinct,
    'longest_identical_run': longest_run,
    'max_step_deg': round(max(steps), 5),
    'median_step_deg': round(sorted(steps)[len(steps) // 2], 5),
    'errors': errors[:5],
}
(OUT / 'resultado.json').write_text(json.dumps(result, indent=2), encoding='utf-8')
print(json.dumps(result, indent=2))
