# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Diagnóstico exploratório de UX por interface real.
Uso: python3 -B -u scripts/e2e-ux-review.py [porta=5173] [pasta-de-saida]
Não usa atalhos, imports de motor ou alteração do estado da partida.
Os resultados registram problemas observados; exit 0 significa coleta concluída.
"""
import json,time,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
PORT=int(sys.argv[1]) if len(sys.argv)>1 else 5173;OUT=Path(sys.argv[2]) if len(sys.argv)>2 else Path('.scratch-agent/ux-review');OUT.mkdir(parents=True,exist_ok=True)
results={}
def dump(page):return page.evaluate("""()=>({screen:document.body.dataset.screen,text:document.body.innerText,active:{id:document.activeElement?.id,text:document.activeElement?.textContent?.slice(0,120),inSettings:!!document.activeElement?.closest('#settings')},overflow:document.documentElement.scrollWidth>innerWidth})""")
def shot(page,name):page.screenshot(path=str(OUT/(name+'.png')))
def start(page):
 page.goto(f'http://127.0.0.1:{PORT}/');page.wait_for_selector('#menu:not([hidden])',timeout=60000);assert page.title().startswith('Earthset')
 for name in ['New mission','Lunar Cadet','Begin mission','Skip intro']:
  page.get_by_role('button',name=name).first.click();page.wait_for_timeout(150)
 page.wait_for_selector('#hud:not([hidden])')
with sync_playwright() as p:
 b=p.chromium.launch(args=['--no-sandbox','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist'])
 results['environment']={'browser':b.version,'desktop':[1280,800],'mobile':[390,844],'compact':[780,493]}
 pg=b.new_page(viewport={'width':780,'height':493});pg.goto(f'http://127.0.0.1:{PORT}/');pg.wait_for_selector('#menu:not([hidden])',timeout=60000)
 target=pg.get_by_role('button',name='Português',exact=True)
 r={'before':target.bounding_box()};shot(pg,'compact-menu')
 pg.mouse.wheel(0,1000);pg.wait_for_timeout(200);r['after_wheel']=target.bounding_box()
 try:target.click(timeout=2000);r['click']='ok'
 except Exception as e:r['click']=str(e).split('Call log')[0]
 results['compact']=r;pg.close();print('COMPACT',json.dumps(r),flush=True)
 pg=b.new_page(viewport={'width':1280,'height':800});start(pg)
 pg.get_by_role('button',name='Rover',exact=True).click()
 pg.evaluate("""()=>{window.uxTiming={};document.addEventListener('pointerdown',()=>uxTiming.pointer=performance.now(),{once:true,capture:true});const o=new MutationObserver(()=>{if(document.getElementById('toast')?.innerText.includes('ORDER RECEIVED')){uxTiming.received=performance.now();o.disconnect()}});o.observe(document.body,{childList:true,subtree:true,characterData:true});}""")
 pg.get_by_role('button',name='Lunar ice').first.click();pg.wait_for_timeout(500)
 for title in ['Solar array installation','Solar array installation','Antenna repair']:pg.get_by_role('button',name=title).first.click();pg.wait_for_timeout(150)

 r={'initial':dump(pg),'timing':pg.evaluate('uxTiming')};shot(pg,'rover-eta-start');pg.wait_for_timeout(7000);r['after7s']=dump(pg);shot(pg,'rover-eta-after7s');results['eta']=r
 pg.locator('#pause-btn').click();pg.get_by_role('button',name='Settings',exact=True).click()
 pg.get_by_role('button',name='Back',exact=True).focus();pg.keyboard.press('Tab');results['focus']=dump(pg);shot(pg,'settings-focus-escape')
 pg.get_by_role('button',name='Back',exact=True).click();pg.locator('#resume').click();pg.get_by_role('button',name='Science',exact=True).click();pg.locator('#pause-btn').click();pg.get_by_role('button',name='Settings',exact=True).click();pg.get_by_role('button',name='Português',exact=True).click();pg.get_by_role('button',name='Voltar',exact=True).click();pg.locator('#resume').click();pg.wait_for_timeout(250)
 results['translation']={'heading':pg.locator('#side-title').inner_text(),'ui':dump(pg)};shot(pg,'science-pt-heading')
 pg.locator('#pause-btn').click();pg.close();(OUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n');print('DESKTOP',json.dumps({'timing':r['timing'],'focus':results['focus']['active'],'heading':results['translation']['heading']}),flush=True)
 ctx=b.new_context(viewport={'width':390,'height':844},device_scale_factor=2,is_mobile=True,has_touch=True);pg=ctx.new_page();start(pg);pg.wait_for_timeout(5200);shot(pg,'mobile-onboarding')
 results['mobile_initial']=dump(pg);results['mobile_layout']=pg.evaluate('''()=>{const fields=['val-battery','val-air','val-water','val-food'].map(id=>{const e=document.getElementById(id);const range=document.createRange();range.selectNodeContents(e);const r=range.getBoundingClientRect();return{id,text:e.innerText,box:[r.x,r.y,r.width,r.height]}});const overlays=[...document.querySelectorAll('#toast,.onboarding,.first-steps,.luma,.coach')].filter(e=>e.getClientRects().length).map(e=>{const r=e.getBoundingClientRect();return{id:e.id,className:e.className,text:e.innerText,box:[r.x,r.y,r.width,r.height]}});return{fields,overlays}}''');results['mobile_accessibility']=pg.accessibility.snapshot();(OUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
 pg.locator('[data-tool=rover]').tap();pg.get_by_role('button',name='Lunar ice').first.tap();pg.wait_for_timeout(250);shot(pg,'mobile-rover-panel');results['mobile_rover']=dump(pg)
 pg.locator('#pause-btn').tap();pg.close();ctx.close();b.close()
 (OUT/'results.json').write_text(json.dumps(results,ensure_ascii=False,indent=2)+'\n')
 print('DONE',OUT/'results.json',flush=True)
