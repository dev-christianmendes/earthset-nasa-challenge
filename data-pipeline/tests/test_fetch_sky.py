# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Efemérides, transformação de referencial e catálogo: testes offline contra brutos preservados."""
import json
import math
import sys
import unittest
import contextlib
import io
from unittest.mock import patch
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fetch_sky import (ROOT, RAW, CATALOG_RAW, BODIES, build, parse_rows, parse_catalog_mirror,
                       unit, local, rotation, transform, angular_error, params, pack, Scenario)
from observer import grid_azimuth, site_observer
import fetch_sky


class SkyPipelineTests(unittest.TestCase):
    def test_consulta_mesmo_observador_e_refacao_desligada(self):
        p = params('399')
        self.assertEqual(p['SITE_COORD'], "'216.86989764584402,-89.9175552986833,1.474125'")
        self.assertEqual(p['CENTER'], "'coord@301'")
        self.assertEqual(p['APPARENT'], "'AIRLESS'")
        self.assertIn('45', p['QUANTITIES'])

    def test_raw_reproduz_tabela_versionada_sem_rede(self):
        self.assertEqual(pack(build(RAW)), json.loads((ROOT/'src/data/sky.json').read_text()))

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
        self.assertAlmostEqual(table['validation']['max_legacy_sun_error_deg'], 0.568113293)
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
        file = CATALOG_RAW/'bsc5-noirlab.html'
        if not file.exists(): self.skipTest('Catálogo NOIRLab indisponível, explicitamente documentado')
        stars = parse_catalog_mirror(file.read_text())
        self.assertEqual(len(stars), 904)
        sirius = next(s for s in stars if s['hr'] == 2491)
        self.assertAlmostEqual(sirius['ra'], 101.287, places=2)
        self.assertAlmostEqual(sirius['magnitude'], -1.46)
        self.assertEqual(sirius['pm_ra_cosdec'], -0.553)
        self.assertEqual(sirius['pm_dec'], -1.205)
        self.assertTrue(all(s['magnitude'] <= 4.5 for s in stars))
        with self.assertRaises(ValueError): parse_catalog_mirror('<html>indisponível</html>')

    def test_outro_cenario_muda_observador_data_e_limites(self):
        scenario = Scenario('2026-11-15 00:00', 48, 'slope')
        p = params('399', scenario)
        self.assertEqual(p['START_TIME'], "'2026-11-15 00:00'")
        self.assertEqual(p['STOP_TIME'], "'2026-11-17 00:00'")
        self.assertIn('315.0', p['SITE_COORD'])
        with self.assertRaises(ValueError): Scenario('1800-01-01 00:00')
        with self.assertRaises(ValueError): Scenario(hours=0)
        with self.assertRaises(ValueError): Scenario('2026-01-01 00:30')
        with self.assertRaises(ValueError): build(RAW, scenario)

    def test_cli_nao_sobrescreve_partida_por_alias_relativo_ou_destino_solar(self):
        sun = (ROOT/'src/data/sun-south-pole.json').read_bytes()
        sky = (ROOT/'src/data/sky.json').read_bytes()
        for args in [
            ['--site', 'slope', '--output', 'src/data/../data/sky.json'],
            ['--output', 'src/data/sun-south-pole.json'],
        ]:
            with patch('sys.argv', ['fetch_sky.py', *args]), contextlib.redirect_stderr(io.StringIO()):
                with self.assertRaises(SystemExit) as error: fetch_sky.main()
            self.assertEqual(error.exception.code, 2)
        self.assertEqual((ROOT/'src/data/sun-south-pole.json').read_bytes(), sun)
        self.assertEqual((ROOT/'src/data/sky.json').read_bytes(), sky)

    def test_sol_energetico_de_cada_site_corresponde_aos_brutos_horizons(self):
        sun = json.loads((ROOT/'src/data/sun-south-pole.json').read_text())
        for site in ['peak', 'slope', 'rim']:
            filename = 'sun.txt' if site == 'peak' else f'sun-{site}.txt'
            rows = parse_rows((RAW/filename).read_text())
            self.assertEqual(len(sun['samples_by_site'][site]), 709)
            self.assertEqual(sun['observers'][site], site_observer(site))
            for actual, original in zip(sun['samples_by_site'][site], rows):
                self.assertAlmostEqual(actual['az'], grid_azimuth(original['az'], site_observer(site)), delta=0.00000051)
                self.assertAlmostEqual(actual['el'], original['el'], delta=0.00000051)

    def test_empacotamento_nao_perde_amostras_ou_precisao_cientifica(self):
        table = build(RAW)
        packed = pack(table)
        for name in BODIES:
            for column, key in zip(packed['bodies'][name], packed['columns'][name]):
                value = 0
                for delta, original in zip(column, table['bodies'][name]):
                    if delta is None:
                        self.assertIsNone(original[key])
                    else:
                        value += delta
                        self.assertLessEqual(abs(value/packed['scale']-original[key]), 0.00000051)


if __name__ == '__main__':
    unittest.main()
