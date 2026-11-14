# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Testes do pipeline do Sol. Rodar: python3 -m unittest discover -s data-pipeline/tests"""

import sys
import unittest
from pathlib import Path

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE.parent))

import fetch_sun  # noqa: E402

FIXTURE = HERE / "fixtures" / "horizons_sun_6h.txt"


class ParseTest(unittest.TestCase):
    def test_extrai_as_sete_linhas_do_bloco(self):
        rows = fetch_sun.parse_ephemeris(FIXTURE.read_text(encoding="utf-8"))
        self.assertEqual(len(rows), 7)  # 00:00 a 06:00 inclusive
        self.assertEqual(rows[0]["time"], "2026-Nov-15 00:00")  # fixture: amostra real de 2026
        self.assertAlmostEqual(rows[0]["azimuth_deg"], 114.442858)
        self.assertAlmostEqual(rows[0]["elevation_deg"], 1.349506)

    def test_sem_bloco_soe_falha_com_mensagem(self):
        with self.assertRaises(ValueError):
            fetch_sun.parse_ephemeris("erro: parâmetro inválido")

    def test_bloco_vazio_falha(self):
        with self.assertRaises(ValueError):
            fetch_sun.parse_ephemeris("$$SOE\n$$EOE")


class TableTest(unittest.TestCase):
    def test_tabela_conta_fracao_com_sol(self):
        rows = [
            {"time": "t0", "azimuth_deg": 10.0, "elevation_deg": 1.0},
            {"time": "t1", "azimuth_deg": 11.0, "elevation_deg": -0.5},
            {"time": "t2", "azimuth_deg": 12.0, "elevation_deg": 0.2},
            {"time": "t3", "azimuth_deg": 13.0, "elevation_deg": 0.0},
        ]
        table = fetch_sun.build_table(rows, "2026-11-14T00:00:00Z")
        self.assertEqual(table["hours"], 3)
        self.assertEqual(table["sunlit_fraction"], 0.5)  # 2 de 4 com elevação > 0
        self.assertEqual(table["samples"][0], {"az": 10.0, "el": 1.0})

    def test_parametros_cobrem_um_dia_lunar(self):
        p = fetch_sun.build_params()
        self.assertEqual(p["START_TIME"], "'2024-10-09 09:00'")
        # 708 h depois de 15/11 00:00 UT é 14/12 12:00 UT
        self.assertEqual(p["STOP_TIME"], "'2024-11-07 21:00'")
        self.assertEqual(p["QUANTITIES"], "'4'")


if __name__ == "__main__":
    unittest.main()
