# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Efemérides, transformação de referencial e catálogo: testes offline contra brutos preservados."""
import json
import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fetch_sky import (ROOT, RAW, BODIES, build, parse_rows, parse_catalog_mirror,
                       unit, local, rotation, transform, angular_error, params)


class SkyPipelineTests(unittest.TestCase):
    def test_consulta_mesmo_observador_e_refacao_desligada(self):
        p = params('399')
        self.assertEqual(p['SITE_COORD'], "'0.0,-89.5,0.0'")
        self.assertEqual(p['CENTER'], "'coord@301'")
        self.assertEqual(p['APPARENT'], "'AIRLESS'")
        self.assertIn('45', p['QUANTITIES'])

    def test_raw_reproduz_tabela_versionada_sem_rede(self):
        self.assertEqual(build(RAW), json.loads((ROOT/'src/data/sky.json').read_text()))

    def test_709_horarios_e_numeros_validos_por_corpo(self):
        for name in BODIES:
            rows = parse_rows((RAW/f'{name}.txt').read_text())
            self.assertEqual(len(rows), 709)
            for row in rows:
                self.assertTrue(0 <= row['az'] < 360)
                self.assertTrue(-90 <= row['el'] <= 90)
                self.assertGreater(row['diameter_arcsec'], 0)
                self.assertTrue(all(v is None or isinstance(v, str) or math.isfinite(v) for v in row.values()))

    def test_sol_preservado_e_rotacao_conferida_com_outros_corpos(self):
        table = build(RAW)
        self.assertLess(table['validation']['max_legacy_sun_error_deg'], 0.0001)
        self.assertLess(table['validation']['max_frame_error_deg'], 0.00001)

    def test_rejeita_resposta_de_erro_ou_vazia(self):
        with self.assertRaises(ValueError): parse_rows('API error')
        with self.assertRaises(ValueError): parse_rows('Date__(UT)__HR:MN\n$$SOE\n$$EOE')

    def test_recupera_rotacao_conhecida_e_preserva_norma(self):
        a = {'ra': 0, 'dec': 0, 'az': 90, 'el': 0}
        b = {'ra': 90, 'dec': 0, 'az': 0, 'el': 90}
        m = rotation(a, b)
        for sample in [a, b]:
            self.assertLess(angular_error(transform(m, unit(sample['ra'], sample['dec'])), local(sample['az'], sample['el'])), 1e-5)
        self.assertAlmostEqual(sum(x*x for x in transform(m, unit(43, -16))), 1)

    def test_rejeita_referencial_degenerado(self):
        a = {'ra': 0, 'dec': 0, 'az': 90, 'el': 0}
        with self.assertRaises(ValueError): rotation(a, a)

    def test_catalogo_noirlab_preserva_sirius_e_nao_inventa_entradas(self):
        file = RAW/'bsc5-noirlab.html'
        if not file.exists(): self.skipTest('Catálogo NOIRLab indisponível, explicitamente documentado')
        stars = parse_catalog_mirror(file.read_text())
        self.assertEqual(len(stars), 904)
        sirius = next(s for s in stars if s['hr'] == 2491)
        self.assertAlmostEqual(sirius['ra'], 101.287, places=2)
        self.assertAlmostEqual(sirius['magnitude'], -1.46)
        self.assertTrue(all(s['magnitude'] <= 4.5 for s in stars))
        with self.assertRaises(ValueError): parse_catalog_mirror('<html>indisponível</html>')


if __name__ == '__main__':
    unittest.main()
