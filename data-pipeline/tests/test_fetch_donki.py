# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Testes do clima espacial DONKI: janela, Kp e radiação (sem rede)."""

import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import fetch_donki as donki  # noqa: E402


class JanelaTest(unittest.TestCase):
    def test_hora_zero_e_o_inicio_do_cenario(self):
        self.assertEqual(donki.hour_index(donki.START_UTC), 0)

    def test_hora_antes_do_inicio_fica_negativa(self):
        self.assertLess(donki.hour_index(donki.START_UTC - donki.timedelta(hours=1)), 0)

    def test_tabela_tem_708_mais_um_pontos(self):
        samples = donki.build_samples([], [])
        self.assertEqual(len(samples), donki.HOURS + 1)


class KpTest(unittest.TestCase):
    def test_kp_marcado_em_t_cobre_as_3_horas_anteriores(self):
        # Kp às 18:00 UTC do dia 10 vale para 15:00 a 18:00 (convenção NOAA).
        gst = [{"allKpIndex": [{"kpIndex": 8.0, "observedTime": "2024-10-08T18:00Z"}]}]
        samples = donki.build_samples(gst, [])
        horas = [i for i, s in enumerate(samples) if s["kp"] == 8.0]
        self.assertEqual(horas, [15, 16, 17])

    def test_kp_maior_vence_quando_ha_sobreposicao(self):
        # Duas fontes com o mesmo horário: a hora fica com o Kp maior.
        gst = [
            {"allKpIndex": [{"kpIndex": 5.0, "observedTime": "2024-10-08T18:00Z"}]},
            {"allKpIndex": [{"kpIndex": 9.0, "observedTime": "2024-10-08T18:00Z"}]},
        ]
        samples = donki.build_samples(gst, [])
        self.assertEqual(samples[15]["kp"], 9.0)


class RadiacaoTest(unittest.TestCase):
    def test_sep_marca_radiacao_por_24_horas(self):
        sep = [{"eventTime": "2024-10-08T06:00Z"}]
        samples = donki.build_samples([], sep)
        marcadas = [i for i, s in enumerate(samples) if s["radiation"]]
        self.assertEqual(marcadas, list(range(6, 30)))


if __name__ == "__main__":
    unittest.main()
