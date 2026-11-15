# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Céu/sombras em Chromium Vulkan; capturas e métricas em .scratch-agent (sem upload).
Uso: python3 -B scripts/e2e-astronomy.py [porta=5188]
"""
import hashlib
import json
import sys
from pathlib import Path
from playwright.sync_api import sync_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else '5188'
URL = f'http://localhost:{PORT}/'
OUT = Path(sys.argv[2]) if len(sys.argv) > 2 else Path('.scratch-agent/astronomy-2026-11-15')
OUT.mkdir(parents=True, exist_ok=True)
failures = []
checks = []
source_sun = {s['hour']: s['az'] for s in json.loads(Path('tests/fixtures/sky-horizons-peak-2024.json').read_text())['samples']['sun']}


def check(name, condition, detail=None):
    checks.append({'name': name, 'ok': bool(condition), 'detail': detail})
    if not condition:
        failures.append(name)
    print(('ok ' if condition else 'FAIL ') + name, detail if detail is not None else '', flush=True)


with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox', '--use-angle=vulkan', '--enable-features=Vulkan', '--ignore-gpu-blocklist'])
    page = browser.new_page(viewport={'width': 1280, 'height': 800})
    errors = []
    page.on('pageerror', lambda e: errors.append(str(e)))
    page.on('console', lambda m: errors.append(m.text[:600]) if m.type == 'error' else None)

    def open_hour(hour, extra=''):
        page.goto(f'{URL}?autostart=cadet&clockAt={hour}&freeze&perf=1{extra}')
        page.wait_for_selector('#hud:not([hidden])', timeout=60000)
        page.wait_for_timeout(1500)
        # Vite pode versionar módulos por ?t= durante edições externas. Importar a URL usada pelo app,
        # não criar outra instância de scene.ts (que criaria outro WebGLRenderer/canvas).
        page.evaluate("() => { window.auditImport = async (path) => import(performance.getEntriesByType('resource').find(r=>new URL(r.name).pathname===path)?.name ?? path); }")

    open_hour(24)
    check('a porta serve Earthset', page.title().startswith('Earthset'), page.title())
    check('apenas uma instância do renderizador', page.locator('body > canvas').count() == 1)
    check('painel polar conta 708 intervalos, sem somar o ponto final', '433 of 708 h' in page.locator('#horizon-panel .cap').text_content())
    state = page.evaluate('''async()=>{const s=await auditImport('/src/render/scene.ts');const a=await auditImport('/src/astronomy/sky.ts');const d=await auditImport('/src/data/sun.ts');const sky=await auditImport('/src/data/sky.ts');const gl=s.renderer.getContext(),e=gl.getExtension('WEBGL_debug_renderer_info');const sun=a.direction(d.SUN.samples[24].az,d.SUN.samples[24].el);return{gpu:gl.getParameter(e.UNMASKED_RENDERER_WEBGL),shadows:s.renderer.shadowMap.enabled,sunDirection:s.sun.position.clone().sub(s.sun.target.position).normalize().toArray(),expected:sun,ground:s.scene.children.filter(o=>o.isMesh&&o.geometry.attributes.position?.count===25600).map(o=>({cast:o.castShadow,receive:o.receiveShadow})),sky:s.scene.getObjectByName('astronomical-sky').children.map(o=>o.name),stars:sky.SKY.stars.samples.length}}''')
    check('sombras globais ligadas', state['shadows'])
    check('luz usa direção exata da tabela energética', max(abs(a-b) for a,b in zip(state['sunDirection'],state['expected'])) < 1e-10)
    check('terreno recebe e projeta sombras', state['ground'] == [{'cast': True, 'receive': True}])
    check('céu sem halo esférico nem estrelas aleatórias', len(state['sky']) == 3 and state['stars'] == 904, state['sky'])
    casters = page.evaluate('''async()=>{const s=await auditImport('/src/render/scene.ts'),b=await auditImport('/src/render/base-layout.ts');const roots={astronaut:s.crewObject(0),rover:s.robot,habitat:b.habitat,greenhouse:b.greenhouse,panels:b.panelUnits[0]};return Object.fromEntries(Object.entries(roots).map(([id,o])=>{let count=0;o.traverse(n=>{if(n.isMesh&&n.castShadow)count++});return[id,count]}))}''')
    for name, count in casters.items():check(f'{name}: malhas projetam sombra',count>0,count)
    page.wait_for_timeout(2000)

    metrics = page.evaluate('''async()=>{const s=await auditImport('/src/render/scene.ts');let samples=[];await new Promise(resolve=>{let last=performance.now(),end=last+3000;function f(n){samples.push({dt:n-last,draws:s.renderer.info.render.calls});last=n;if(n<end)requestAnimationFrame(f);else resolve()}requestAnimationFrame(f)});samples=samples.slice(1);const sorted=samples.map(x=>x.dt).sort((a,b)=>a-b);return{fps:1000/(sorted.reduce((a,b)=>a+b,0)/sorted.length),p95:sorted[Math.floor(sorted.length*.95)],max:sorted.at(-1),drawsMin:Math.min(...samples.map(s=>s.draws)),drawsMax:Math.max(...samples.map(s=>s.draws)),memory:s.renderer.info.memory}}''')
    check('medição GPU executada', 'SwiftShader' not in state['gpu'], state['gpu'])
    print('PERFORMANCE', json.dumps(metrics), flush=True)
    # Repetir a medição no mesmo contexto para expor variação, sem escolher apenas a melhor amostra.
    trials = [metrics]
    for _ in range(2):
        trials.append(page.evaluate('''()=>new Promise(resolve=>{let d=[],last=performance.now(),end=last+3000;function f(t){d.push(t-last);last=t;if(t<end)requestAnimationFrame(f);else{d=d.slice(1).sort((a,b)=>a-b);resolve({fps:1000/(d.reduce((a,b)=>a+b,0)/d.length),p95:d[Math.floor(d.length*.95)],max:d.at(-1)})}}requestAnimationFrame(f)})'''))
    print('PERFORMANCE_TRIALS',json.dumps(trials),flush=True)

    observations = []
    for hour in [0, 180, 360, 500, 650]:
        open_hour(hour)
        info = page.evaluate('''async(h)=>{const s=await auditImport('/src/render/scene.ts');const a=await auditImport('/src/astronomy/sky.ts');const sky=await auditImport('/src/data/sky.ts');const data=await auditImport('/src/data/sun.ts');const t=await auditImport('/src/data/terrain.ts');const b=a.bodyAt(sky.SKY,'earth',h),sun=a.solarView(data.SUN,h,'peak',t.TERRAIN);return{hour:h,solar:sun,earth:b,earthVisibility:a.visibility(b,t.TERRAIN,'peak'),intensity:s.sun.intensity,angularSun:2*Math.asin(s.scene.getObjectByName('sun-apparent-disc').scale.x/700)*180/Math.PI,angularEarth:2*Math.asin(s.scene.getObjectByName('earth-apparent-disc').scale.x/700)*180/Math.PI}}''',hour)
        observations.append(info)
        check(f'hora {hour}: luz e geração concordam', (info['intensity'] > 0) == info['solar']['lit'])
        check(f'hora {hour}: escala solar física', abs(info['angularSun']-.534) < .02)
        page.screenshot(path=str(OUT/f'desktop-hour-{hour}.png'))
        page.click('[data-tool=science]')
        page.wait_for_selector('#sky-panel table')
        check(f'hora {hour}: Ciência tem sete corpos e fontes', page.locator('#sky-panel tbody tr').count() == 7 and page.locator('#sky-panel a').count() == 2)
        if hour in source_sun:
            displayed = float(page.locator('#sky-panel tbody tr').first.locator('td').first.inner_text().split('°')[0])
            check(f'hora {hour}: azimute geográfico da interface confere com Horizons', abs(((displayed-source_sun[hour]+180)%360)-180) < .006)
    # Detalhe de limbo solar e fase terrestre, sem modificar posições ou iluminação via console.
    open_hour(0,'&sky=sun')
    page.screenshot(path=str(OUT/'sun-limb-hour-0.png'))
    visible = 360
    open_hour(visible,'&sky=earth')
    page.screenshot(path=str(OUT/f'earth-phase-hour-{visible}.png'))
    quality = page.evaluate('''async()=>{const s=await auditImport('/src/render/scene.ts');s.setQuality(false);const low=s.sun.shadow.mapSize.x;s.setQuality(true);return{low,high:s.sun.shadow.mapSize.x,enabled:s.renderer.shadowMap.enabled}}''')
    check('qualidade 1024/2048 mantém sombras habilitadas',quality=={'low':1024,'high':2048,'enabled':True},quality)

    open_hour(180)
    page.click('[data-tool=science]')
    page.locator('[data-sky-exposure]').check()
    page.wait_for_timeout(250)
    check('exposição opcional não altera geração', page.evaluate("async()=>{const s=await auditImport('/src/render/scene.ts');return s.sun.intensity}") == observations[1]['intensity'])
    page.locator('#sky-panel [data-sky-body=sun]').click()
    page.screenshot(path=str(OUT/'science-sun-desktop.png'))
    # Troca pública de idioma pelo menu de pausa; o HUD não tem botão de idioma permanente.
    page.click('#pause-btn')
    page.locator('#pause [data-open=settings]').click()
    page.locator('[data-lang-toggle]:visible').first.click()
    page.locator('#settings [data-back]').click()
    page.click('#resume')
    page.wait_for_timeout(250)
    check('Ciência em português', 'Céu astronômico' in page.locator('#sky-panel').inner_text())
    page.set_viewport_size({'width':390,'height':844})
    page.wait_for_timeout(350)
    check('celular sem rolagem horizontal', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    page.screenshot(path=str(OUT/'science-mobile-pt.png'))
    check('sem erros JS/GLSL', not errors, errors[:5])
    browser.close()

baseline = OUT/'baseline.json'
preserved = {}
if baseline.exists():
    old = json.loads(baseline.read_text())
    for file, digest in old['preserved_sha256'].items():
        preserved[file] = hashlib.sha256(Path(file).read_bytes()).hexdigest() == digest
    check('terreno, posicionamento e Sol energético preservados', all(preserved.values()), preserved)
    print('BASELINE', json.dumps(old['baseline']), flush=True)
result = {'checks': checks, 'failures': failures, 'gpu': state['gpu'], 'metrics': metrics, 'trials': trials,
          'observations': observations, 'preserved': preserved, 'errors': errors}
(OUT/'validation.json').write_text(json.dumps(result, ensure_ascii=False, indent=2))
sys.exit(1 if failures else 0)
