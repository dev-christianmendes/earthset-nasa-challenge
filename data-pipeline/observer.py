# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""LOLA LDEM_80S_20M: estereográfica esférica sul, ME DE421, longitude leste.

Inversa de Snyder, conferida com PROJ. Mantém a implantação e a convenção de
pixel de fetch_lola; x/y são eixos da grade, não leste/norte geográficos.
"""
import json
import math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RADIUS_M = 1737400.0

def inverse(x, y):
    rho = math.hypot(x, y)
    if rho == 0:
        raise ValueError('No polo exato, longitude/azimute geográfico são indeterminados')
    return math.degrees(math.atan2(x, y)) % 360, -90 + math.degrees(2 * math.atan(rho / (2 * RADIUS_M)))

def forward(lon, lat):
    rho = 2 * RADIUS_M * math.tan(math.radians(90 + lat) / 2)
    return rho * math.sin(math.radians(lon)), rho * math.cos(math.radians(lon))

def site_observer(site='peak'):
    # Arquivo pequeno versionado: não exige o DEM bruto para refazer efemérides.
    return json.loads((ROOT/'data-pipeline/observers.json').read_text())[site]

def grid_azimuth(true_azimuth, observer):
    return (true_azimuth + observer.get('grid_north_rotation_deg', 0)) % 360

def observers_from_dem(raw):
    """Reproduz também as alturas, sem refazer seleção de sites ou malha da cena."""
    from fetch_lola import Dem, band_rows, bilinear, xy_to_pixel
    first, last = band_rows()
    dem = Dem(raw.read_bytes(), first, last-first+1)
    sites = json.loads((ROOT/'src/data/terrain-sites.json').read_text())['sites']
    result = {}
    for name, site in sites.items():
        x, y = site['x_m'], site['y_m']
        lon, lat = inverse(x, y)
        result[name] = {'body': 301, 'longitude_deg': lon, 'latitude_deg': lat,
                        'altitude_km': bilinear(dem, *xy_to_pixel(x, y))/1000,
                        'frame': 'MEAN_ME / DE421', 'grid_north_rotation_deg': lon,
                        'x_m': x, 'y_m': y,
                        'source': 'https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_20M.LBL'}
    return result

if __name__ == '__main__':
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--from-dem', type=Path, required=True, help='Faixa binária produzida por fetch_lola.py')
    parser.add_argument('--output', type=Path, default=ROOT/'data-pipeline/observers.json')
    args = parser.parse_args()
    args.output.write_text(json.dumps(observers_from_dem(args.from_dem), indent=2)+'\n')
    print(f'Observadores gravados: {args.output}')
