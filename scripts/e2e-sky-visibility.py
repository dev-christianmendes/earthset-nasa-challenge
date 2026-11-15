# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Visibilidade real dos pixels do céu e confirmação da exposição pela interface.
Uso: python3 -B -u scripts/e2e-sky-visibility.py [porta=5192] [--baseline]
"""
import base64
import io
import json
import sys
from pathlib import Path
from PIL import Image
from playwright.sync_api import sync_playwright

PORT = sys.argv[1] if len(sys.argv) > 1 else '5192'
BASELINE = '--baseline' in sys.argv
OUT = Path('.scratch-agent/sky-visibility')/('before' if BASELINE else 'after')
OUT.mkdir(parents=True, exist_ok=True)

with sync_playwright() as p:
    browser = p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
    results = {'profiles': {}, 'errors': []}
    for name, viewport, dpr in [('desktop',{'width':1280,'height':800},1),('mobile',{'width':390,'height':844},2)]:
        context = browser.new_context(viewport=viewport,device_scale_factor=dpr,is_mobile=name=='mobile',has_touch=name=='mobile')
        page = context.new_page()
        page.on('pageerror',lambda e: results['errors'].append(str(e)))
        page.on('console',lambda m: results['errors'].append(m.text[:300]) if m.type=='error' else None)
        page.goto(f'http://127.0.0.1:{PORT}/?autostart=cadet&clockAt=180&freeze')
        page.wait_for_selector('#hud:not([hidden])',timeout=60000)
        page.wait_for_timeout(1500)
        assert page.title().startswith('Earthset')
        page.evaluate("() => { window.auditImport = async path => import(performance.getEntriesByType('resource').find(r=>new URL(r.name).pathname===path)?.name ?? path); }")
        page.locator('[data-tool=science]').click()
        checkbox = page.locator('#sky-panel [data-sky-exposure]')
        default = checkbox.is_checked()
        profile = {'default_long_exposure': default, 'captures': {}}
        if BASELINE:
            page.evaluate("async()=>{const d=await auditImport('/src/render/director.ts');d.lookAtSky(0,45)}")
        else:
            page.locator('#sky-panel [data-sky-look-up]').click()
        for enabled in [False, True]:
            checkbox.set_checked(enabled)
            page.wait_for_timeout(350)
            capture = page.evaluate("""async()=>{
              const s=await auditImport('/src/render/scene.ts');
              const points=s.scene.getObjectByName('catalog-stars-and-planets');
              s.renderer.render(s.scene,s.camera);
              const bytes=new Uint8Array(points.geometry.attributes.position.array.buffer);
              let hash=2166136261;for(const b of bytes)hash=Math.imul(hash^b,16777619)>>>0;
              const view=s.camera.getWorldDirection(s.camera.position.clone());
              return {png:s.renderer.domElement.toDataURL('image/png'),positionHash:hash,solar:s.sun.position.toArray(),intensity:s.sun.intensity,exposure:points.material.uniforms.skyExposure.value,pixelRatio:s.renderer.getPixelRatio(),viewElevation:Math.asin(view.y)*180/Math.PI,draws:s.renderer.info.render.calls};
            }""")
            png=base64.b64decode(capture.pop('png').split(',')[1])
            label='long' if enabled else 'normal'
            (OUT/f'{name}-{label}-canvas.png').write_bytes(png)
            image=Image.open(io.BytesIO(png)).convert('RGB')
            # Campo só de céu acima do horizonte, sem DOM/HUD, disco solar ou Terra.
            capture['bright_pixels']=sum(1 for r,g,b in image.getdata() if max(r,g,b)>=40)
            capture['image_size']=image.size
            profile['captures'][label]=capture
        assert profile['captures']['normal']['positionHash']==profile['captures']['long']['positionHash']
        assert profile['captures']['normal']['solar']==profile['captures']['long']['solar']
        assert profile['captures']['normal']['intensity']==profile['captures']['long']['intensity']
        assert profile['captures']['long']['bright_pixels']>profile['captures']['normal']['bright_pixels']
        if not BASELINE:
            assert default, 'Exposição longa deve iniciar ativa'
            assert abs(profile['captures']['long']['viewElevation']-45)<.01, 'Botão deve enquadrar o céu'
            assert profile['captures']['long']['bright_pixels']>=100, 'Catálogo deve ser perceptível no campo de céu'
        # Mostrar a opção acionável e a cena de jogo, com o valor padrão restaurado.
        checkbox.set_checked(default)
        page.screenshot(path=str(OUT/f'{name}-science.png'))
        page.locator('[data-tool=science]').click()
        page.screenshot(path=str(OUT/f'{name}-sky.png'))
        results['profiles'][name]=profile
        print(name,json.dumps(profile),flush=True)
        context.close()
    # Diagnóstico observado do Sol em movimento real de jogo, sem alterar o motor.
    page = browser.new_page(viewport={'width':1280,'height':800})
    page.goto(f'http://127.0.0.1:{PORT}/?autostart=cadet&clockAt=24')
    page.wait_for_selector('#hud:not([hidden])',timeout=60000)
    page.evaluate("() => { window.auditImport = async path => import(performance.getEntriesByType('resource').find(r=>new URL(r.name).pathname===path)?.name ?? path); }")
    results['solar_steps'] = page.evaluate("""async()=>{
      const {sun}=await auditImport('/src/render/scene.ts');
      const frames=[];const start=performance.now();
      await new Promise(done=>{function f(t){frames.push([t,...sun.position.toArray()]);if(t-start<3100)requestAnimationFrame(f);else done();}requestAnimationFrame(f)});
      const changes=[];let repeated=0;
      for(let i=1;i<frames.length;i++){
        const a=frames[i-1].slice(1),b=frames[i].slice(1);
        if(a.every((x,j)=>x===b[j]))repeated++;
        else {const cos=a.reduce((s,x,j)=>s+x*b[j],0)/(Math.hypot(...a)*Math.hypot(...b));changes.push({at_ms:frames[i][0]-start,angle_deg:Math.acos(Math.max(-1,Math.min(1,cos)))*180/Math.PI});}
      }
      return {duration_ms:frames.at(-1)[0]-start,frames:frames.length,unchanged_pairs:repeated,changes};
    }""")
    print('SOLAR_STEPS',json.dumps(results['solar_steps']),flush=True)
    browser.close()
    (OUT/'validation.json').write_text(json.dumps(results,indent=2)+'\n')
    assert not results['errors'],results['errors']
