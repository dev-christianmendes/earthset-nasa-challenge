# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Testes do clima espacial DONKI: janela, Kp e radiação (sem rede)."""

import json
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

import fetch_donki as donki  # noqa: E402


def at(hours: float) -> str:
    """Horário da DONKI, a `hours` horas do início do cenário (independe da data escolhida)."""
    return (donki.START_UTC + donki.timedelta(hours=hours)).strftime("%Y-%m-%dT%H:%MZ")


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
        gst = [{"allKpIndex": [{"kpIndex": 8.0, "observedTime": at(18)}]}]
        samples = donki.build_samples(gst, [])
        horas = [i for i, s in enumerate(samples) if s["kp"] == 8.0]
        self.assertEqual(horas, [15, 16, 17])

    def test_kp_maior_vence_quando_ha_sobreposicao(self):
        # Duas fontes com o mesmo horário: a hora fica com o Kp maior.
        gst = [
            {"allKpIndex": [{"kpIndex": 5.0, "observedTime": at(18)}]},
            {"allKpIndex": [{"kpIndex": 9.0, "observedTime": at(18)}]},
        ]
        samples = donki.build_samples(gst, [])
        self.assertEqual(samples[15]["kp"], 9.0)


class RadiacaoTest(unittest.TestCase):
    def test_sep_marca_radiacao_por_24_horas(self):
        sep = [{"eventTime": at(6)}]
        samples = donki.build_samples([], sep)
        marcadas = [i for i, s in enumerate(samples) if s["radiation"]]
        self.assertEqual(marcadas, list(range(6, 30)))


def sep_record(sep_id: str, when: str, linked=None, alerts=None) -> dict:
    return {"sepID": sep_id, "eventTime": when, "instruments": [{"displayName": "GOES-P: SEISS >100 MeV"}],
            "link": "https://ccmc.gsfc.nasa.gov/DONKI/view/SEP/1/-1", "linkedEvents": linked, "sentNotifications": alerts}


class CatalogoTest(unittest.TestCase):
    def test_id_da_donki_vira_horario_e_tipo(self):
        moment, kind = donki.parse_activity_id("2024-10-09T01:25:00-FLR-001")
        self.assertEqual(kind, "FLR")
        self.assertEqual(donki.utc_text(moment), "2024-10-09T01:25Z")

    def test_hora_do_evento_e_atraso_do_evento_ligado(self):
        sep = [sep_record("S-1", at(10), linked=[{"activityID": (donki.START_UTC + donki.timedelta(hours=6)).strftime("%Y-%m-%dT%H:%M:%S") + "-FLR-001"}])]
        event = donki.build_events([], sep)["events"][0]
        self.assertEqual(event["hour"], 10.0)
        self.assertEqual(event["linked_events"][0]["lag_to_event_hours"], 4.0)
        self.assertEqual(event["linked_events"][0]["provenance"], "from-id")
        self.assertEqual(event["provenance"], "observed")

    def test_alerta_enviado_guarda_o_atraso_depois_do_evento(self):
        alerts = [{"messageID": "A-1", "messageIssueTime": at(12.5), "messageURL": "https://x/1"}]
        event = donki.build_events([], [sep_record("S-1", at(10), alerts=alerts)])["events"][0]
        self.assertEqual(event["alerts"][0]["delay_after_event_hours"], 2.5)

    def test_campos_nulos_da_donki_nao_quebram(self):
        event = donki.build_events([], [sep_record("S-1", at(3), linked=None, alerts=None)])["events"][0]
        self.assertEqual(event["linked_events"], [])
        self.assertEqual(event["alerts"], [])

    def test_evento_antes_do_inicio_da_janela_e_marcado(self):
        event = donki.build_events([], [sep_record("S-1", at(-5))])["events"][0]
        self.assertTrue(event["before_window_start"])
        self.assertLess(event["hour"], 0)

    def test_gst_guarda_kp_maximo_e_avisa_que_e_da_terra(self):
        gst = [{"gstID": "G-1", "startTime": at(30), "link": "https://x/g", "allKpIndex": [
            {"kpIndex": 7.0, "observedTime": at(33), "source": "NOAA"}, {"kpIndex": 8.67, "observedTime": at(36), "source": "NOAA"}]}]
        event = donki.build_events(gst, [])["events"][0]
        self.assertEqual(event["kp_max"], 8.67)
        self.assertIn("Terra", event["note"])

    def test_episodios_unem_janelas_que_se_tocam_e_separam_as_distantes(self):
        sep = [sep_record("S-1", at(10)), sep_record("S-2", at(20)), sep_record("S-3", at(100))]
        episodes = donki.build_events([], sep)["radiation_episodes"]
        self.assertEqual([(e["start_hour"], e["end_hour"], len(e["sep_ids"])) for e in episodes], [(10, 44, 2), (100, 124, 1)])
        self.assertTrue(all(e["provenance"] == "game-rule" for e in episodes))

    def test_sem_eventos_o_catalogo_fica_vazio_sem_erro(self):
        catalog = donki.build_events([], [])
        self.assertEqual(catalog["events"], [])
        self.assertEqual(catalog["radiation_episodes"], [])

    def test_episodios_cobrem_exatamente_as_horas_com_radiacao_da_tabela(self):
        sep = [sep_record("S-1", at(-5)), sep_record("S-2", at(30)), sep_record("S-3", at(40)), sep_record("S-4", at(700))]
        samples = donki.build_samples([], sep)
        episodes = donki.build_events([], sep)["radiation_episodes"]
        covered = {h for e in episodes for h in range(e["start_hour"], e["end_hour"]) if 0 <= h <= donki.HOURS}
        self.assertEqual(covered, {i for i, x in enumerate(samples) if x["radiation"]})


class DadosVersionadosTest(unittest.TestCase):
    """Confere o catálogo gravado contra as respostas cruas da NASA versionadas (sem rede)."""

    def setUp(self):
        raw = donki.RAW_DIR
        self.sep = json.loads((raw / "donki_sep.json").read_text(encoding="utf-8"))
        self.gst = json.loads((raw / "donki_gst.json").read_text(encoding="utf-8"))
        self.catalog = json.loads(donki.EVENTS_PATH.read_text(encoding="utf-8"))

    def test_todo_registro_cru_esta_no_catalogo_sem_inventar_nenhum(self):
        ids = {e["id"] for e in self.catalog["events"]}
        self.assertEqual(ids, {r["sepID"] for r in self.sep} | {r["gstID"] for r in self.gst})
        self.assertEqual(len(ids), len(self.catalog["events"]))

    def test_catalogo_regravado_e_igual_ao_versionado(self):
        self.assertEqual(donki.build_events(self.gst, self.sep), self.catalog)

    def test_todo_evento_tem_link_da_nasa(self):
        for event in self.catalog["events"]:
            self.assertTrue(event["link"].startswith("https://ccmc.gsfc.nasa.gov/DONKI/"), event["id"])

    def test_episodios_batem_com_a_tabela_horaria_versionada(self):
        table = json.loads(donki.OUT_PATH.read_text(encoding="utf-8"))["samples"]
        covered = {h for e in self.catalog["radiation_episodes"] for h in range(e["start_hour"], e["end_hour"]) if 0 <= h <= donki.HOURS}
        self.assertEqual(covered, {i for i, x in enumerate(table) if x["radiation"]})


if __name__ == "__main__":
    unittest.main()
