# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import sys
import unittest
from datetime import timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from fetch_donki import START_UTC, first_full_hour  # noqa: E402

class RadiacaoCausalTests(unittest.TestCase):
    def test_sep_fracionario_so_vale_da_proxima_hora_cheia(self):
        # SEP registrado a 415,75 h: a radiação não pode começar em 415 (antes da evidência).
        self.assertEqual(first_full_hour(START_UTC + timedelta(hours=415.75)), 416)

    def test_sep_em_hora_exata_comeca_nela(self):
        self.assertEqual(first_full_hour(START_UTC + timedelta(hours=415)), 415)

    def test_sep_antes_do_inicio_da_janela_fica_negativo(self):
        self.assertEqual(first_full_hour(START_UTC + timedelta(hours=-5.17)), -5)

if __name__ == "__main__":
    unittest.main()
