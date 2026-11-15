# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Conferência independente: PROJ e ERFA (só auditoria, não entram no jogo).

Executar com Python contendo pyproj e pyerfa. Saída local em .scratch-agent.
"""
import json
import math
import sys
from pathlib import Path
import erfa
from pyproj import Proj

sys.path.insert(0, str(Path(__file__).resolve().parents[1]/'data-pipeline'))
from observer import site_observer, forward, ROOT
from fetch_sky import parse_catalog_mirror, CATALOG_RAW, unit, normalize, angular_error

projection = Proj(proj='stere', lat_0=-90, lon_0=0, R=1737400, k=1)
results = {'projection': [], 'proper_motion': [], 'sources': ['PROJ stereographic sphere', 'ERFA pmsafe (SOFA), parallax=0, RV=0']}
for site in ['peak','slope','rim']:
    o = site_observer(site)
    lon, lat = projection(o['x_m'], o['y_m'], inverse=True)
    error = max(abs(((lon-o['longitude_deg']+180)%360)-180),abs(lat-o['latitude_deg']))
    assert error < 1e-9
    p = projection(o['longitude_deg'],o['latitude_deg']+0.000001)
    north = math.degrees(math.atan2(p[0]-o['x_m'],p[1]-o['y_m']))%360
    assert abs(((north-o['grid_north_rotation_deg']+180)%360)-180)<1e-5
    results['projection'].append({'site':site,'max_inverse_error_deg':error,'north_grid_deg':north})
stars = parse_catalog_mirror((CATALOG_RAW/'bsc5-noirlab.html').read_text())
for star in [s for s in stars if s['hr'] in [2491, 5459, 5460, 2943, 424]]:
    a,d = map(math.radians,[star['ra'],star['dec']])
    for year in [2024.773,2026.873,2100]:
        dt=year-2000
        ra=star['pm_ra_cosdec']*math.pi/648000*dt
        dec=star['pm_dec']*math.pi/648000*dt
        p=unit(star['ra'],star['dec'])
        own=normalize([p[0]-ra*math.sin(a)-dec*math.cos(a)*math.sin(d),p[1]+ra*math.cos(a)-dec*math.sin(a)*math.sin(d),p[2]+dec*math.cos(d)])
        # SOFA pmRA é dRA/dt em rad/ano, sem cosδ: converter explicitamente.
        ref=erfa.pmsafe(a,d,star['pm_ra_cosdec']*math.pi/648000/math.cos(d),star['pm_dec']*math.pi/648000,0,0,2451545.,0,2451545.,dt*365.25)
        expected=unit(math.degrees(ref[0]),math.degrees(ref[1]))
        error=angular_error(own,expected)*3600
        assert error < 0.005
        results['proper_motion'].append({'hr':star['hr'],'year':year,'error_arcsec':error,'vector':own})
out=ROOT/'.scratch-agent/astronomy-followup/science-validation.json'
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps(results,indent=2))
