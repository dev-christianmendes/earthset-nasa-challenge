# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.

import math
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import fetch_lola as lola  # noqa: E402

class FlatDem:
    """Terreno plano, em metros, com um muro opcional em x = wall_x de altura wall_h."""

    def __init__(self, wall_x: float | None = None, wall_h: float = 0.0) -> None:
        self.wall_x = wall_x
        self.wall_h = wall_h

    def height(self, sample: int, line: int) -> float:
        x_m = (sample - lola.CENTER_PX) * lola.PIXEL_M
        if self.wall_x is not None and abs(x_m - self.wall_x) < lola.PIXEL_M:
            return self.wall_h
        return 0.0

class ProjecaoTest(unittest.TestCase):
    def test_polo_fica_no_centro_da_projecao(self):
        x, y = lola.xy_to_pixel(0.0, 0.0)
        self.assertEqual((x, y), (lola.CENTER_PX, lola.CENTER_PX))

    def test_norte_e_mais_linha_menor_e_leste_mais_coluna(self):
        s_leste, _ = lola.xy_to_pixel(100.0, 0.0)
        _, l_norte = lola.xy_to_pixel(0.0, 100.0)
        self.assertGreater(s_leste, lola.CENTER_PX)
        self.assertLess(l_norte, lola.CENTER_PX)

    def test_um_pixel_equivale_a_20_metros(self):
        s, _ = lola.xy_to_pixel(20.0, 0.0)
        self.assertAlmostEqual(s - lola.CENTER_PX, 1.0)

class FaixaTest(unittest.TestCase):
    def test_faixa_tem_2001_linhas_em_volta_do_polo(self):
        first, last = lola.band_rows()
        self.assertEqual(last - first + 1, 2 * lola.BAND_HALF_PX + 1)
        self.assertLessEqual(first, lola.CENTER_PX)
        self.assertGreaterEqual(last, lola.CENTER_PX)

    def test_intervalo_de_bytes_tem_o_tamanho_da_faixa(self):
        start, end = lola.byte_range()
        self.assertEqual(start % (lola.SIZE_PX * 2), 0)
        self.assertEqual((end + 1) % (lola.SIZE_PX * 2), 0)
        rows = (end + 1 - start) // (lola.SIZE_PX * 2)
        self.assertEqual(rows, 2 * lola.BAND_HALF_PX + 1)

class HorizonteTest(unittest.TestCase):
    def test_terreno_plano_tem_horizonte_zero(self):
        self.assertEqual(lola.horizon_deg(FlatDem(), 0.0, 0.0, 45.0), 0.0)

    def test_muro_de_100_m_a_1000_m_da_cerca_de_5_7_graus(self):
        # O muro fica a leste (az 90°). Com 100 m a 1000 m, o ângulo é atan(100/1000).
        dem = FlatDem(wall_x=1000.0, wall_h=100.0)
        angle = lola.horizon_deg(dem, 0.0, 0.0, 90.0)
        expected = math.degrees(math.atan2(100.0, 1000.0))
        self.assertAlmostEqual(angle, expected, delta=0.2)

    def test_muro_nao_aparece_na_direcao_oposta(self):
        dem = FlatDem(wall_x=1000.0, wall_h=100.0)
        self.assertEqual(lola.horizon_deg(dem, 0.0, 0.0, 270.0), 0.0)

    def test_curvatura_sozinha_nao_cria_horizonte(self):
        # Sem relevo, a queda da curvatura não aparece como horizonte: o resultado é zero.
        self.assertEqual(lola.horizon_deg(FlatDem(), 0.0, 0.0, 0.0), 0.0)

class EscolhaDePosicoesTest(unittest.TestCase):
    def test_escolhe_exposto_mediano_e_sombreado(self):
        scored = [
            (1.0, (0.0, 0.0), [1.0] * 72),
            (5.0, (100.0, 0.0), [5.0] * 72),
            (3.0, (0.0, 100.0), [3.0] * 72),
        ]
        sites = lola.pick_sites(scored)
        self.assertEqual((sites["peak"][0], sites["peak"][1]), (0.0, 0.0))
        self.assertEqual((sites["slope"][0], sites["slope"][1]), (0.0, 100.0))
        self.assertEqual((sites["rim"][0], sites["rim"][1]), (100.0, 0.0))

    def test_candidatos_ficam_dentro_do_disco(self):
        pts = lola.candidates()
        self.assertTrue(all(math.hypot(x, y) <= lola.CANDIDATE_RADIUS_M + 1e-6 for x, y in pts))
        self.assertIn((0.0, 0.0), pts)

if __name__ == "__main__":
    unittest.main()
