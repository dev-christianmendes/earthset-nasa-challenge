# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Referencial da projeção polar e contratos entre observador, grade e DEM."""
import json
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from observer import inverse, forward, grid_azimuth, site_observer, ROOT


class ObserverTests(unittest.TestCase):
    def test_sites_voltam_a_implantacao_preservada(self):
        sites = json.loads((ROOT/'src/data/terrain-sites.json').read_text())['sites']
        for name, site in sites.items():
            o = site_observer(name)
            lon, lat = inverse(site['x_m'], site['y_m'])
            self.assertAlmostEqual(lon, o['longitude_deg'], places=10)
            self.assertAlmostEqual(lat, o['latitude_deg'], places=10)
            x, y = forward(lon, lat)
            self.assertAlmostEqual(x, site['x_m'], places=5)
            self.assertAlmostEqual(y, site['y_m'], places=5)

    def test_meridianos_cardinais_e_distancia_ao_polo(self):
        for lon in [0, 90, 180, 270]:
            x, y = forward(lon, -89.5)
            a, b = inverse(x, y)
            self.assertAlmostEqual(a, lon)
            self.assertAlmostEqual(b, -89.5)
        self.assertAlmostEqual(math.hypot(*forward(0, -89.5)), 15161.7736, delta=0.01)

    def test_norte_geografico_e_leste_sao_rotacionados_na_grade(self):
        for site in ['peak', 'slope', 'rim']:
            o = site_observer(site)
            lon, lat = o['longitude_deg'], o['latitude_deg']
            x, y = forward(lon, lat)
            for az, p in [(0, forward(lon, lat+0.000001)), (90, forward(lon+0.000001, lat))]:
                projected = math.degrees(math.atan2(p[0]-x, p[1]-y)) % 360
                error = ((projected-grid_azimuth(az, o)+180) % 360)-180
                self.assertLess(abs(error), 0.00001)

    def test_polo_exato_nao_inventa_longitude(self):
        with self.assertRaises(ValueError): inverse(0, 0)


if __name__ == '__main__': unittest.main()
