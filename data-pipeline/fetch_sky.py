# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Céu lunar offline: corpos do JPL Horizons e estrelas do catálogo BSC5/CDS.

Não altera Sol, horizonte, terreno ou regras existentes. Mesmo observador e janela
de fetch_sun.py. --from-raw reprocessa dados sem rede. Fonte e limites em
docs/data-sources.md. Sem SPICE no navegador: a rotação ICRF -> horizonte é
recuperada de dois vetores aparentes do Horizons (quantidades 45 e 4), e
conferida contra os outros corpos. Horizons não é catálogo de estrelas.
"""
from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import html
import json
import math
import re
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fetch_sun import HOURS, HORIZONS_URL, SITE_ALT_KM, SITE_LAT_DEG, SITE_LON_DEG, START_UTC

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / 'data-pipeline/raw/sky'
OUT = ROOT / 'src/data/sky.json'
BODIES = {'sun': '10', 'earth': '399', 'mercury': '199', 'venus': '299',
          'mars': '499', 'jupiter': '599', 'saturn': '699'}
CATALOG_URL = 'https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz'
README_URL = 'https://cdsarc.cds.unistra.fr/ftp/V/50/ReadMe'
CATALOG_MIRROR = 'https://www-kpno.kpno.noirlab.edu/Info/Caches/Catalogs/BSC5/catalog5.html'


def params(target: str) -> dict[str, str]:
    stop = datetime.strptime(START_UTC, '%Y-%m-%d %H:%M') + timedelta(hours=HOURS)
    return {'format': 'text', 'COMMAND': f"'{target}'", 'OBJ_DATA': "'NO'",
            'MAKE_EPHEM': "'YES'", 'EPHEM_TYPE': "'OBSERVER'", 'CENTER': "'coord@301'",
            'COORD_TYPE': "'GEODETIC'", 'SITE_COORD': f"'{SITE_LON_DEG},{SITE_LAT_DEG},{SITE_ALT_KM}'",
            'START_TIME': f"'{START_UTC}'", 'STOP_TIME': f"'{stop:%Y-%m-%d %H:%M}'",
            'STEP_SIZE': "'1 h'", 'QUANTITIES': "'4,9,10,13,14,15,20,24,32,45'",
            'CSV_FORMAT': "'YES'", 'ANG_FORMAT': "'DEG'", 'APPARENT': "'AIRLESS'",
            'EXTRA_PREC': "'YES'"}


def download(url: str, dest: Path) -> None:
    request = urllib.request.Request(url, headers={'User-Agent': 'Earthset-science-pipeline/1.0'})
    with urllib.request.urlopen(request, timeout=45) as response:
        data = response.read()
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)


def parse_rows(text: str) -> list[dict]:
    if '$$SOE' not in text or '$$EOE' not in text:
        raise ValueError('Horizons sem bloco de efeméride')
    header = next((s for s in text.split('$$SOE')[0].splitlines() if 'Date__(UT)' in s), None)
    if header is None:
        raise ValueError('Cabeçalho CSV ausente')
    names = [re.sub(r'[^a-z0-9]', '', s.lower()) for s in next(csv.reader([header]))]
    aliases = {'az': 'azimuthaapp', 'el': 'elevationaapp', 'diameter_arcsec': 'angdiam',
               'illumination_pct': 'illu', 'magnitude': 'apmag', 'distance_au': 'delta',
               'phase_deg': 'sto', 'observer_lon': 'obssublon', 'observer_lat': 'obssublat',
               'solar_lon': 'sunsublon', 'solar_lat': 'sunsublat', 'pole_ra': 'npolera',
               'pole_dec': 'npoledc', 'ra': 'raicrfaapp', 'dec': 'decicrfaapp'}
    # EXTRA_PREC expande Azi/Elev para Azimuth/Elevation; aceitar ambos os cabeçalhos oficiais.
    names = [{'aziaapp': 'azimuthaapp', 'elevaapp': 'elevationaapp'}.get(n, n) for n in names]
    indices = {key: names.index(label) for key, label in aliases.items() if label in names}
    for key in ['az', 'el', 'diameter_arcsec', 'ra', 'dec']:
        if key not in indices:
            raise ValueError(f'Coluna {key} ausente: {names}')
    rows = []
    for cols in csv.reader(text.split('$$SOE')[1].split('$$EOE')[0].strip().splitlines()):
        if not cols:
            continue
        row = {}
        for key, index in indices.items():
            value = cols[index].strip()
            number = None if value in ('n.a.', '') else float(value)
            if number is not None and not math.isfinite(number):
                raise ValueError('Número não finito na efeméride')
            row[key] = number
        row['utc'] = datetime.strptime(cols[0].strip(), '%Y-%b-%d %H:%M').strftime('%Y-%m-%dT%H:%MZ')
        rows.append(row)
    if not rows:
        raise ValueError('Efeméride vazia')
    return rows


def unit(ra: float, dec: float) -> list[float]:
    ra, dec = math.radians(ra), math.radians(dec)
    return [math.cos(dec)*math.cos(ra), math.cos(dec)*math.sin(ra), math.sin(dec)]


def local(az: float, el: float) -> list[float]:
    az, el = math.radians(az), math.radians(el)
    return [math.sin(az)*math.cos(el), math.sin(el), -math.cos(az)*math.cos(el)]


def dot(a, b):
    return sum(x*y for x, y in zip(a, b))


def normalize(a):
    norm = math.sqrt(dot(a, a))
    if norm < 1e-8:
        raise ValueError('Vetores degenerados para orientar o céu')
    return [v/norm for v in a]


def basis(a, b):
    a = normalize(a)
    d = dot(a, b)
    b = normalize([v-d*x for v, x in zip(b, a)])
    c = [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
    return [a, b, c]


def rotation(first, second):
    inertial = basis(unit(first['ra'], first['dec']), unit(second['ra'], second['dec']))
    horizon = basis(local(first['az'], first['el']), local(second['az'], second['el']))
    return [sum(horizon[k][i]*inertial[k][j] for k in range(3)) for i in range(3) for j in range(3)]


def transform(matrix, vector):
    return [dot(matrix[i:i+3], vector) for i in (0, 3, 6)]


def angular_error(a, b):
    return math.degrees(math.acos(max(-1, min(1, dot(normalize(a), normalize(b))))))


def parse_catalog(text: str, max_magnitude=4.5) -> list[dict]:
    """BSC5, CDS V/50: colunas 76–90 (J2000), 103–107 (V), 149–160 (movimento próprio)."""
    stars = []
    for line in text.splitlines():
        if len(line) < 107 or not line[75:83].strip():
            continue
        magnitude = float(line[102:107])
        if magnitude > max_magnitude:
            continue
        ra = 15*(int(line[75:77])+int(line[77:79])/60+float(line[79:83])/3600)
        dec = (int(line[84:86])+int(line[86:88])/60+int(line[88:90])/3600)*(-1 if line[83]=='-' else 1)
        stars.append({'hr': int(line[:4]), 'ra': round(ra, 6), 'dec': round(dec, 6),
                      'magnitude': magnitude})
    if not stars:
        raise ValueError('Catálogo estelar vazio/inválido')
    return stars


def parse_catalog_mirror(text: str, max_magnitude=4.5) -> list[dict]:
    """Listagem BSC5 usada nos telescópios Kitt Peak (NOIRLab), época/equinócio J2000."""
    plain = html.unescape(re.sub(r'<[^>]+>', '', text))
    pattern = r'^\s*(\d+)\s+(\d+):(\d+):([\d.]+)\s+([+-])(\d+):(\d+):([\d.]+)\s+2000\.00\s+[+-][\d.]+\s+[+-][\d.]+\s+(-?[\d.]+)'
    stars = []
    for match in re.finditer(pattern, plain, re.M):
        hr, rh, rm, rs, sign, dd, dm, ds, mag = match.groups()
        if float(mag) <= max_magnitude:
            stars.append({'hr': int(hr), 'ra': round(15*(int(rh)+int(rm)/60+float(rs)/3600), 6),
                          'dec': round((int(dd)+int(dm)/60+float(ds)/3600)*(-1 if sign=='-' else 1), 6),
                          'magnitude': float(mag)})
    if not stars:
        raise ValueError('Listagem NOIRLab vazia/inválida')
    return stars


def build(raw: Path) -> dict:
    bodies = {name: parse_rows((raw/f'{name}.txt').read_text()) for name in BODIES}
    start = datetime.strptime(START_UTC, '%Y-%m-%d %H:%M')
    for name, rows in bodies.items():
        if len(rows) != HOURS+1:
            raise ValueError(f'{name}: esperadas {HOURS+1} amostras, recebidas {len(rows)}')
        for h, row in enumerate(rows):
            if row['utc'] != (start+timedelta(hours=h)).strftime('%Y-%m-%dT%H:%MZ'):
                raise ValueError(f'{name}: horário fora da grade')
    frames = [rotation(a, b) for a, b in zip(bodies['sun'], bodies['jupiter'])]
    errors = [angular_error(transform(frames[h], unit(r['ra'], r['dec'])), local(r['az'], r['el']))
              for name, rows in bodies.items() for h, r in enumerate(rows)]
    if max(errors) > 0.001:
        raise ValueError(f'Rotação ICRF/horizonte inconsistente: {max(errors)}°')
    legacy = json.loads((ROOT/'src/data/sun-south-pole.json').read_text())
    delta = max(max(abs(((a['az']-b['az']+180)%360)-180), abs(a['el']-b['el']))
                for a, b in zip(legacy['samples'], bodies['sun']))
    if delta > 0.0003:
        raise ValueError(f'Sol novo diverge da tabela energética preservada: {delta}°')
    catalog_path = raw/'catalog.gz'
    stars = parse_catalog(gzip.decompress(catalog_path.read_bytes()).decode('ascii')) if catalog_path.exists() else []
    catalog_source = CATALOG_URL
    if not stars and (raw/'bsc5-noirlab.html').exists():
        stars = parse_catalog_mirror((raw/'bsc5-noirlab.html').read_text())
        catalog_source = CATALOG_MIRROR
    files = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(raw.iterdir()) if p.is_file()}
    for rows in bodies.values():
        for row in rows:
            row.pop('utc')
            for key, value in row.items():
                if value is not None:
                    row[key] = round(value, 8)
    return {'source': 'NASA/JPL Horizons DE441; CDS V/50 BSC5', 'start_utc': START_UTC,
            'step_hours': 1, 'hours': HOURS,
            'observer': {'body': 301, 'longitude_deg': SITE_LON_DEG, 'latitude_deg': SITE_LAT_DEG,
                         'altitude_km': SITE_ALT_KM, 'frame': 'MEAN_ME (Horizons)'},
            'queries': {name: params(target) for name, target in BODIES.items()},
            'raw_sha256': files, 'bodies': bodies,
            'icrf_to_local': [[round(x, 12) for x in r] for r in frames],
            'stars': {'source': catalog_source, 'catalog': 'BSC5, CDS V/50 (NOIRLab mirror)', 'epoch': 'J2000.0',
                      'max_magnitude': 4.5, 'status': 'available' if stars else 'unavailable',
                      'limitation': 'Sem movimento próprio, paralaxe ou aberração individual; orientação lunar derivada de Horizons 45/4.',
                      'samples': stars},
            'validation': {'max_frame_error_deg': max(errors), 'max_legacy_sun_error_deg': delta}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--from-raw', type=Path)
    args = parser.parse_args()
    raw = args.from_raw or RAW
    if args.from_raw is None:
        for name, target in BODIES.items():
            dest = raw/f'{name}.txt'
            if not dest.exists():
                print(f'Consultando {name}...', flush=True)
                download(HORIZONS_URL+'?'+urllib.parse.urlencode(params(target)), dest)
        if not (raw/'catalog.gz').exists() and not (raw/'bsc5-noirlab.html').exists():
            try:
                download(README_URL, raw/'ReadMe')
                download(CATALOG_URL, raw/'catalog.gz')
            except Exception as exc:
                print(f'CDS indisponível, tentando listagem NOIRLab: {exc}', flush=True)
                try:
                    download(CATALOG_MIRROR, raw/'bsc5-noirlab.html')
                except Exception as fallback:
                    print(f'Catálogo indisponível; sem estrelas inventadas: {fallback}', flush=True)
    table = build(raw)
    OUT.write_text(json.dumps(table, ensure_ascii=False, separators=(',', ':'))+'\n')
    print(json.dumps({'bodies': len(table['bodies']), 'stars': len(table['stars']['samples']),
                      'validation': table['validation']}))


if __name__ == '__main__':
    main()
