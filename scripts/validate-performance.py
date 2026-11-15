# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Carga fria + perfil móvel emulado + sessão longa, no build de produção.

Uso: python3 -B -u scripts/validate-performance.py [porta=5189] [segundos=1800]
Servidor: python3 -B scripts/serve-validation.py 5189. Não equivale a GPU móvel.
"""
import json
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else '5189'
DURATION = int(sys.argv[2]) if len(sys.argv) > 2 else 1800
OUT = Path(sys.argv[3]) if len(sys.argv) > 3 else Path('.scratch-agent/astronomy-followup')
OUT.mkdir(parents=True, exist_ok=True)
INIT = """(() => {
  const a = window.validation = {live:{}, created:{}, deleted:{}, frames:[], longTasks:0, longTaskMs:0, maxLongTaskMs:0, lostContexts:0};
  for (const P of [WebGLRenderingContext.prototype, WebGL2RenderingContext.prototype]) {
    for (const name of ['Buffer','Texture','Framebuffer','Renderbuffer','Program','Shader','VertexArray']) {
      const create = P['create'+name], del = P['delete'+name]; if (!create || !del) continue;
      const live = new WeakSet();
      P['create'+name] = function(...args) { const v = create.apply(this,args); if(v) {live.add(v);a.created[name]=(a.created[name]||0)+1;a.live[name]=(a.live[name]||0)+1;} return v; };
      P['delete'+name] = function(v) { if(v&&live.delete(v)) {a.deleted[name]=(a.deleted[name]||0)+1;a.live[name]--;} return del.call(this,v); };
    }
  }
  addEventListener('webglcontextlost',()=>a.lostContexts++,true);
  new PerformanceObserver(list=>{for(const e of list.getEntries()){a.longTasks++;a.longTaskMs+=e.duration;a.maxLongTaskMs=Math.max(a.maxLongTaskMs,e.duration);}}).observe({type:'longtask',buffered:true});
  let last; function f(t){if(last!==undefined){a.frames.push(t-last);if(a.frames.length>1800)a.frames.shift();}last=t;requestAnimationFrame(f);}requestAnimationFrame(f);
})();"""


def snapshot(page, cdp):
    result = page.evaluate("""() => { const a=validation,d=a.frames.slice(1).sort((x,y)=>x-y);return {fps:d.length?1000/(d.reduce((s,x)=>s+x,0)/d.length):0,p95:d[Math.floor(d.length*.95)],max:d.at(-1),live:{...a.live},created:{...a.created},deleted:{...a.deleted},longTasks:a.longTasks,longTaskMs:a.longTaskMs,maxLongTaskMs:a.maxLongTaskMs,lostContexts:a.lostContexts,perf:document.getElementById('perf')?.textContent,canvases:document.querySelectorAll('body>canvas').length,overflow:document.documentElement.scrollWidth>innerWidth}; }""")
    result['heap'] = cdp.send('Runtime.getHeapUsage')
    result['dom'] = cdp.send('Memory.getDOMCounters')
    return result


def begin(page):
    page.locator('#menu [data-go=modes]').first.click()
    page.locator('[data-mode=cadet]').click()
    page.locator('#story-go').click()
    page.locator('#cine-skip').click()
    page.wait_for_selector('#hud:not([hidden])')


with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist','--enable-precise-memory-info'])
    results = {'kind': 'desktop GPU + mobile emulation; not a physical phone', 'duration_seconds': DURATION, 'profiles': {}, 'soak': [], 'errors': []}
    for name, mobile in [('desktop',False),('mobile_emulated',True)]:
        ctx = browser.new_context(viewport={'width':390 if mobile else 1280,'height':844 if mobile else 800},device_scale_factor=2 if mobile else 1,is_mobile=mobile,has_touch=mobile)
        ctx.add_init_script(INIT)
        page = ctx.new_page(); cdp = ctx.new_cdp_session(page)
        page.on('pageerror',lambda e: results['errors'].append(str(e)))
        page.on('console',lambda m: results['errors'].append(m.text[:400]) if m.type=='error' else None)
        cdp.send('Network.enable'); cdp.send('Network.setCacheDisabled',{'cacheDisabled':True})
        if mobile:
            cdp.send('Emulation.setCPUThrottlingRate',{'rate':4})
            cdp.send('Network.emulateNetworkConditions',{'offline':False,'latency':150,'downloadThroughput':1600000/8,'uploadThroughput':750000/8,'connectionType':'cellular4g'})
        start = time.monotonic()
        page.goto(f'http://127.0.0.1:{PORT}/?perf=1',wait_until='domcontentloaded',timeout=120000)
        page.wait_for_selector('#menu:not([hidden])',timeout=120000)
        menu = time.monotonic()-start
        assert page.title().startswith('Earthset')
        begin(page)
        playable = time.monotonic()-start
        page.wait_for_function("performance.getEntriesByType('resource').some(e=>e.name.endsWith('.glb'))",timeout=90000)
        cold_snapshot = snapshot(page,cdp)
        page.wait_for_load_state('networkidle',timeout=120000)
        load_complete = time.monotonic()-start
        page.wait_for_timeout(3000)
        page.evaluate('validation.frames=[]')
        page.wait_for_timeout(5000)
        gpu = page.evaluate("() => {const gl=document.querySelector('body>canvas').getContext('webgl2');return gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL);}")
        result = {'menu_seconds':menu,'hud_seconds':playable,'load_complete_seconds':load_complete,'gpu':gpu,'cold_snapshot':cold_snapshot,'snapshot':snapshot(page,cdp),
                  'resources':page.evaluate("performance.getEntriesByType('resource').map(r=>({url:new URL(r.name).pathname,transfer:r.transferSize,encoded:r.encodedBodySize,decoded:r.decodedBodySize,end:r.responseEnd}))"),
                  'navigation':page.evaluate("performance.getEntriesByType('navigation')[0].toJSON()"),
                  'paint':page.evaluate("performance.getEntriesByType('paint').map(e=>({name:e.name,time:e.startTime}))")}
        page.screenshot(path=str(OUT/f'performance-{name}.png'))
        results['profiles'][name]=result
        (OUT/'performance.json').write_text(json.dumps(results,indent=2))
        print(name,json.dumps({k:v for k,v in result.items() if k not in ['resources','navigation','cold_snapshot']}),flush=True)
        if not mobile: ctx.close()
    # Rede permanece limitada; aquecimento inicial não é confundido com retenção.
    if DURATION > 0: page.wait_for_timeout(20000)
    cdp.send('HeapProfiler.collectGarbage')
    baseline = snapshot(page,cdp); results['soak_baseline']=baseline
    print('SOAK_START',json.dumps(baseline),flush=True)
    started=time.monotonic(); cycles=0; quality=False
    while time.monotonic()-started < DURATION:
        # Caminho público: menu, reinício, qualidade, foco e Ciência; nenhum import duplica renderizador.
        if page.locator('#end:not([hidden])').count():
            page.locator('#restart').click()
        page.locator('#pause-btn').click()
        page.locator('#pause [data-open=settings]').click()
        page.locator('#set-quality').set_checked(quality)
        quality=not quality
        page.locator('#settings [data-back]').click()
        page.locator('#to-menu').click()
        begin(page)
        for tool in ['greenhouse','crew','rover','energy','science']:
            page.locator(f'[data-tool={tool}]').click()
            page.wait_for_timeout(120)
        page.locator('[data-sky-exposure]').set_checked(cycles%2==0)
        page.locator('[data-tool=science]').click()
        page.wait_for_timeout(10000)
        cycles+=1
        if cycles%4==0:
            cdp.send('HeapProfiler.collectGarbage')
            sample=snapshot(page,cdp); sample.update({'seconds':time.monotonic()-started,'cycles':cycles})
            results['soak'].append(sample)
            (OUT/'performance.json').write_text(json.dumps(results,indent=2))
            print('SOAK',json.dumps(sample),flush=True)
    cdp.send('HeapProfiler.collectGarbage')
    results['soak_final']=snapshot(page,cdp)
    results['elapsed_seconds']=time.monotonic()-started
    results['cycles']=cycles
    page.screenshot(path=str(OUT/'performance-soak-final.png'))
    (OUT/'performance.json').write_text(json.dumps(results,indent=2))
    print('FINAL',json.dumps({'seconds':results['elapsed_seconds'],'cycles':cycles,'snapshot':results['soak_final'],'errors':results['errors']}),flush=True)
    browser.close()
    sys.exit(1 if results['errors'] or results['soak_final']['lostContexts'] else 0)
