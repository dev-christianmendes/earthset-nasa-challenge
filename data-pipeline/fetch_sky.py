# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Céu lunar offline: corpos do JPL Horizons e estrelas do catálogo BSC5/CDS.

Observadores geodésicos derivados do LOLA. Cenários parametrizados; --activate
atualiza o Sol energético junto do céu, sem mudar terreno ou regras. --from-raw reprocessa dados sem rede. Fonte e limites em
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
from datetime import datetime, timedelta
from pathlib import Path

from fetch_sun import HOURS, HORIZONS_URL, START_UTC
from observer import site_observer, grid_azimuth
from dataclasses import dataclass

ROOT = Path(__file__).resolve().parent.parent
CATALOG_RAW = ROOT / 'data-pipeline/raw/sky'
RAW = CATALOG_RAW / 'peak-20241009-708'
OUT = ROOT / 'src/data/sky.json'
BODIES = {'sun': '10', 'earth': '399', 'mercury': '199', 'venus': '299',
          'mars': '499', 'jupiter': '599', 'saturn': '699'}
CATALOG_URL = 'https://cdsarc.cds.unistra.fr/ftp/V/50/catalog.gz'
README_URL = 'https://cdsarc.cds.unistra.fr/ftp/V/50/ReadMe'
CATALOG_MIRROR = 'https://www-kpno.kpno.noirlab.edu/Info/Caches/Catalogs/BSC5/catalog5.html'


@dataclass(frozen=True)
class Scenario:
    start: str = START_UTC
    hours: int = HOURS
    site: str = 'peak'

    def __post_init__(self):
        start = datetime.strptime(self.start, '%Y-%m-%d %H:%M')
        if not 1900 <= start.year <= 2100 or start.minute != 0 or not 1 <= self.hours <= 8784:
            raise ValueError('Cenário requer hora cheia, 1900–2100 e duração de 1–8784 h')
        site_observer(self.site)

    @property
    def observer(self):
        return site_observer(self.site)

    @property
    def key(self):
        return f'{self.site}-{datetime.strptime(self.start, "%Y-%m-%d %H:%M"):%Y%m%d%H}-{self.hours}'


def params(target: str, scenario=Scenario()) -> dict[str, str]:
    stop = datetime.strptime(scenario.start, '%Y-%m-%d %H:%M') + timedelta(hours=scenario.hours)
    o = scenario.observer
    return {'format': 'text', 'COMMAND': f"'{target}'", 'OBJ_DATA': "'NO'",
            'MAKE_EPHEM': "'YES'", 'EPHEM_TYPE': "'OBSERVER'", 'CENTER': "'coord@301'",
            'COORD_TYPE': "'GEODETIC'", 'SITE_COORD': f"'{o['longitude_deg']},{o['latitude_deg']},{o['altitude_km']}'",
            'START_TIME': f"'{scenario.start}'", 'STOP_TIME': f"'{stop:%Y-%m-%d %H:%M}'",
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
    a, b = normalize(a), normalize(b)
    cross = [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]
    return math.degrees(math.atan2(math.sqrt(dot(cross, cross)), dot(a, b)))


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
                      'magnitude': magnitude, 'pm_ra_cosdec': float(line[148:154].strip() or 0),
                      'pm_dec': float(line[154:160].strip() or 0)})
    if not stars:
        raise ValueError('Catálogo estelar vazio/inválido')
    return stars


def parse_catalog_mirror(text: str, max_magnitude=4.5) -> list[dict]:
    """Listagem BSC5 usada nos telescópios Kitt Peak (NOIRLab), época/equinócio J2000."""
    plain = html.unescape(re.sub(r'<[^>]+>', '', text))
    pattern = r'^\s*(\d+)\s+(\d+):(\d+):([\d.]+)\s+([+-])(\d+):(\d+):([\d.]+)\s+2000\.00\s+([+-][\d.]+)\s+([+-][\d.]+)\s+(-?[\d.]+)'
    stars = []
    for match in re.finditer(pattern, plain, re.M):
        hr, rh, rm, rs, sign, dd, dm, ds, pmra, pmdec, mag = match.groups()
        if float(mag) <= max_magnitude:
            stars.append({'hr': int(hr), 'ra': round(15*(int(rh)+int(rm)/60+float(rs)/3600), 6),
                          'dec': round((int(dd)+int(dm)/60+float(ds)/3600)*(-1 if sign=='-' else 1), 6),
                          'magnitude': float(mag), 'pm_ra_cosdec': float(pmra), 'pm_dec': float(pmdec)})
    if not stars:
        raise ValueError('Listagem NOIRLab vazia/inválida')
    return stars


def build(raw: Path, scenario=Scenario()) -> dict:
    expected = {name: params(target, scenario) for name, target in BODIES.items()}
    if json.loads((raw/'queries.json').read_text()) != expected:
        raise ValueError('Manifesto difere do cenário solicitado')
    bodies = {name: parse_rows((raw/f'{name}.txt').read_text()) for name in BODIES}
    start = datetime.strptime(scenario.start, '%Y-%m-%d %H:%M')
    for name, rows in bodies.items():
        if len(rows) != scenario.hours+1:
            raise ValueError(f'{name}: esperadas {scenario.hours+1} amostras, recebidas {len(rows)}')
        for h, row in enumerate(rows):
            if row['utc'] != (start+timedelta(hours=h)).strftime('%Y-%m-%dT%H:%MZ'):
                raise ValueError(f'{name}: horário fora da grade')
    for rows in bodies.values():
        for row in rows:
            row['az'] = grid_azimuth(row['az'], scenario.observer)
    frames = [rotation(a, b) for a, b in zip(bodies['sun'], bodies['jupiter'])]
    errors = [angular_error(transform(frames[h], unit(r['ra'], r['dec'])), local(r['az'], r['el']))
              for name, rows in bodies.items() for h, r in enumerate(rows)]
    if max(errors) > 0.001:
        raise ValueError(f'Rotação ICRF/horizonte inconsistente: {max(errors)}°')
    legacy = {'samples': parse_rows((CATALOG_RAW/'sun.txt').read_text())}
    delta = max(max(abs(((a['az']-b['az']+180)%360)-180), abs(a['el']-b['el']))
                for a, b in zip(legacy['samples'], bodies['sun'])) if scenario.start == START_UTC else None
    catalog_path = CATALOG_RAW/'catalog.gz'
    stars = parse_catalog(gzip.decompress(catalog_path.read_bytes()).decode('ascii')) if catalog_path.exists() else []
    catalog_source = CATALOG_URL
    if not stars and (CATALOG_RAW/'bsc5-noirlab.html').exists():
        stars = parse_catalog_mirror((CATALOG_RAW/'bsc5-noirlab.html').read_text())
        catalog_source = CATALOG_MIRROR
    files = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(raw.iterdir()) if p.is_file()}
    for p in [CATALOG_RAW/'catalog.gz', CATALOG_RAW/'bsc5-noirlab.html']:
        if p.exists(): files['catalog/'+p.name] = hashlib.sha256(p.read_bytes()).hexdigest()
    for rows in bodies.values():
        for row in rows:
            row.pop('utc')
            for key, value in row.items():
                if value is not None:
                    row[key] = round(value, 8)
    return {'source': 'NASA/JPL Horizons DE441; CDS V/50 BSC5', 'start_utc': scenario.start,
            'step_hours': 1, 'hours': scenario.hours,
            'observer': scenario.observer,
            'queries': {name: params(target, scenario) for name, target in BODIES.items()},
            'raw_sha256': files, 'bodies': bodies,
            'icrf_to_local': [[round(x, 12) for x in r] for r in frames],
            'stars': {'source': catalog_source, 'catalog': 'BSC5, CDS V/50 (NOIRLab mirror)', 'epoch': 'J2000.0',
                      'max_magnitude': 4.5, 'status': 'available' if stars else 'unavailable',
                      'limitation': 'Movimento próprio tangencial BSC5 incluído; sem paralaxe, velocidade radial ou deflexão gravitacional. Orientação Horizons 45/4.',
                      'samples': stars},
            'validation': {'max_frame_error_deg': max(errors), 'max_legacy_sun_error_deg': delta}}


def pack(table):
    """Colunas numéricas, sem chaves repetidas/proveniência volumosa no JavaScript.

    Mantém ângulos com 6 casas (<0,004 arcsec por coordenada); nenhum downsample
    temporal. A tabela completa e os hashes são reconstituíveis pelos brutos.
    """
    fields = ['az', 'el', 'diameter_arcsec', 'illumination_pct', 'magnitude', 'phase_deg',
              'observer_lon', 'observer_lat', 'solar_lon', 'solar_lat', 'pole_ra', 'pole_dec', 'ra', 'dec']
    required = {'sun': ['az', 'el', 'diameter_arcsec', 'ra', 'dec']}
    planet = ['az', 'el', 'diameter_arcsec', 'illumination_pct', 'magnitude', 'phase_deg', 'ra', 'dec']
    result = {k: table[k] for k in ['source', 'start_utc', 'step_hours', 'hours', 'observer', 'validation']}
    result['format'] = 3
    result['scale'] = 1000000
    result['columns'] = {name: required.get(name, fields if name == 'earth' else planet) for name in BODIES}
    result['bodies'] = {}
    for name, rows in table['bodies'].items():
        columns = []
        for key in result['columns'][name]:
            previous = 0
            column = []
            for row in rows:
                value = row.get(key)
                if value is None:
                    column.append(None)
                else:
                    number = round(value * result['scale'])
                    column.append(number - previous)
                    previous = number
            columns.append(column)
        result['bodies'][name] = columns
    result['icrf_to_local'] = [[round(v, 9) for v in row] for row in table['icrf_to_local']]
    result['stars'] = {k: v for k, v in table['stars'].items() if k != 'samples'}
    result['stars']['columns'] = ['hr', 'ra', 'dec', 'magnitude', 'pm_ra_cosdec', 'pm_dec']
    result['stars']['samples'] = [[s[k] for k in result['stars']['columns']] for s in table['stars']['samples']]
    return result


def ensure_raw(raw, scenario):
    raw.mkdir(parents=True, exist_ok=True)
    expected = {name: params(target, scenario) for name, target in BODIES.items()}
    manifest = raw/'queries.json'
    if manifest.exists() and json.loads(manifest.read_text()) != expected:
        raise ValueError('Cache pertence a outro observador/data; use outro --raw-dir')
    if not manifest.exists() and any((raw/f'{name}.txt').exists() for name in BODIES):
        raise ValueError('Cache sem manifesto de observador/data; não reutilizar silenciosamente')
    manifest.write_text(json.dumps(expected, indent=2)+'\n')
    for name, query in expected.items():
        dest = raw/f'{name}.txt'
        if not dest.exists():
            print(f'Consultando {scenario.key}: {name}...', flush=True)
            download(HORIZONS_URL+'?'+urllib.parse.urlencode(query), dest)
        parse_rows(dest.read_text())  # Resposta de erro nunca vira tabela válida.


def ensure_catalog():
    if (CATALOG_RAW/'catalog.gz').exists() or (CATALOG_RAW/'bsc5-noirlab.html').exists():
        return
    try:
        download(README_URL, CATALOG_RAW/'ReadMe')
        download(CATALOG_URL, CATALOG_RAW/'catalog.gz')
    except Exception as exc:
        print(f'CDS indisponível: {exc}; tentando NOIRLab', flush=True)
        try:
            download(CATALOG_MIRROR, CATALOG_RAW/'bsc5-noirlab.html')
        except Exception as fallback:
            print(f'Catálogo indisponível; sem estrelas inventadas: {fallback}', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--from-raw', type=Path)
    parser.add_argument('--raw-dir', type=Path)
    parser.add_argument('--start', default=START_UTC, help='UTC, YYYY-MM-DD HH:MM (hora cheia)')
    parser.add_argument('--hours', type=int, default=HOURS)
    parser.add_argument('--site', choices=['peak', 'slope', 'rim'], default='peak')
    parser.add_argument('--output', type=Path, default=OUT)
    parser.add_argument('--activate', action='store_true', help='Atualiza também o Sol energético do cenário padrão')
    args = parser.parse_args()
    args.output = args.output.resolve()
    scenario = Scenario(args.start, args.hours, args.site)
    if args.output == ROOT/'src/data/sun-south-pole.json':
        parser.error('Destino solar reservado: use --activate para gerar Sol/céu juntos')
    if args.output == OUT and scenario != Scenario():
        parser.error('Cenário alternativo exige --output separado; não substitui energia/clima da partida')
    if args.activate and (scenario != Scenario() or args.output != OUT):
        parser.error('--activate só aceita o cenário padrão, validado com partidas completas')
    raw = args.from_raw or args.raw_dir or (RAW if scenario == Scenario() else CATALOG_RAW/scenario.key)
    if args.from_raw is None:
        ensure_raw(raw, scenario)
        ensure_catalog()
    manifest = raw/'queries.json'
    if not manifest.exists() or json.loads(manifest.read_text()) != {name: params(target, scenario) for name, target in BODIES.items()}:
        raise ValueError('Brutos não correspondem ao cenário solicitado')
    table = build(raw, scenario)
    provenance = {k: v for k, v in table.items() if k not in ['bodies', 'icrf_to_local', 'stars']}
    provenance['stars'] = {k: v for k, v in table['stars'].items() if k != 'samples'}
    provenance_path = ROOT/'data-pipeline/sky-provenance.json' if args.output == OUT else args.output.with_suffix('.provenance.json')
    sun = None
    if args.activate:
        samples = [{k: round(r[k], 6) for k in ['az', 'el']} for r in table['bodies']['sun']]
        by_site = {'peak': samples}
        for site in ['slope', 'rim']:
            query = params('10', Scenario(site=site))
            dest = raw/f'sun-{site}.txt'
            manifest = raw/f'sun-{site}.query.json'
            if args.from_raw is None and not dest.exists():
                download(HORIZONS_URL+'?'+urllib.parse.urlencode(query), dest)
                manifest.write_text(json.dumps(query, indent=2)+'\n')
            if not manifest.exists() or json.loads(manifest.read_text()) != query:
                raise ValueError(f'Sol {site}: manifesto ausente ou incorreto')
            rows = parse_rows(dest.read_text())
            if len(rows) != scenario.hours+1 or any(row['utc'] != (datetime.strptime(scenario.start, '%Y-%m-%d %H:%M')+timedelta(hours=h)).strftime('%Y-%m-%dT%H:%MZ') for h,row in enumerate(rows)):
                raise ValueError(f'Sol {site}: grade inválida')
            by_site[site] = [{'az': round(grid_azimuth(r['az'], site_observer(site)), 6), 'el': round(r['el'], 6)} for r in rows]
        sun = {'source': 'NASA/JPL Horizons; observadores LOLA ME DE421; azimute da grade polar',
               'start_utc': scenario.start, 'step_hours': 1, 'hours': scenario.hours,
               'observer': scenario.observer, 'observers': {site: site_observer(site) for site in by_site},
               'samples': samples, 'samples_by_site': by_site}
        # Os outros dois observadores podem ter acabado de ser baixados.
        provenance['raw_sha256'].update({p.name: hashlib.sha256(p.read_bytes()).hexdigest()
                                       for p in sorted(raw.iterdir()) if p.is_file()})
    # Validar todas as entradas antes de publicar qualquer tabela ativa.
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(pack(table), ensure_ascii=False, separators=(',', ':'))+'\n')
    provenance_path.write_text(json.dumps(provenance, ensure_ascii=False, indent=2)+'\n')
    if sun is not None:
        (ROOT/'src/data/sun-south-pole.json').write_text(json.dumps(sun, separators=(',', ':'))+'\n')
    print(json.dumps({'scenario': scenario.key, 'bodies': len(table['bodies']), 'stars': len(table['stars']['samples']),
                      'validation': table['validation'], 'bytes': args.output.stat().st_size}))


if __name__ == '__main__':
    main()
