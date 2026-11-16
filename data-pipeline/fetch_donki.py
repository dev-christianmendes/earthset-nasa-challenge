# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Clima espacial de um dia lunar de cenário, pela API NASA DONKI.

Janela histórica definida por START_UTC e HOURS. Não é previsão.

Fontes (NASA DONKI, https://api.nasa.gov/):
  GST  tempestades geomagnéticas, com o índice Kp de 3 em 3 horas (NOAA).
  SEP  eventos de partículas solares energéticas (radiação), com a hora do evento.
  O endpoint FLR respondeu 404 em 14/11/2026, por isso não é usado.

Método (ver docs/data-sources.md, seção 3):
  - Cada Kp marcado em t cobre as 3 horas anteriores, [t-3h, t) (convenção NOAA).
  - Cada SEP em t marca radiação em [t, t+24h). DONKI não dá a duração; 24 h é ilustrativo.

Saídas:
  data-pipeline/raw/donki_gst.json, donki_sep.json   respostas cruas (para auditoria)
  src/data/space-weather.json                        tabela horária usada pelo jogo
  src/data/space-weather-events.json                 catálogo de eventos (v5): ID, horário UTC, link, alertas,
                                                     eventos ligados e episódios de radiação, com a proveniência
                                                     de cada campo (observado, derivado do ID ou regra de jogo)

Proveniência no catálogo (campo "provenance" e "derived"):
  observed   registro da DONKI como veio (ID, horário, instrumento, link, Kp, alertas enviados)
  from-id    horário de um evento ligado (FLR, CME, IPS), lido do próprio identificador; o registro completo
             desses eventos NÃO foi baixado (FLR respondeu 404, CME e IPS responderam 429 com a DEMO_KEY)
  computed   conta do pipeline sobre dados observados (horas desde o início da janela, atrasos)
  game-rule  regra de jogo: radiação por 24 h depois de cada SEP (a duração não vem da DONKI)

Uso:
  python3 data-pipeline/fetch_donki.py                 # baixa (DEMO_KEY, ou NASA_API_KEY) e grava
  python3 data-pipeline/fetch_donki.py --from-raw DIR  # reprocessa as respostas já baixadas

Só biblioteca padrão do Python 3.10 ou mais novo. Testes: python3 -m unittest discover -s data-pipeline/tests
"""

from __future__ import annotations

import argparse
import math
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

API = "https://api.nasa.gov/DONKI"
START_UTC = datetime(2024, 10, 9, 9, 0, tzinfo=timezone.utc)  # nascer do Sol no morro
HOURS = 708
KP_WINDOW_H = 3
SEP_DURATION_H = 24

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data-pipeline" / "raw"
OUT_PATH = ROOT / "src" / "data" / "space-weather.json"
EVENTS_PATH = ROOT / "src" / "data" / "space-weather-events.json"

def parse_time(text: str) -> datetime:
    return datetime.strptime(text.replace("Z", ""), "%Y-%m-%dT%H:%M").replace(tzinfo=timezone.utc)

def hour_index(moment: datetime) -> int:
    return int((moment - START_UTC).total_seconds() // 3600)

def first_full_hour(moment: datetime) -> int:
    """Primeira hora inteira de jogo que começa em ou depois do instante.

    Regra causal (E02): a radiação de um SEP começa na primeira hora cheia após o registro,
    nunca antes. Com floor, o jogo mostraria radiação antes da evidência publicada.
    """
    return math.ceil((moment - START_UTC).total_seconds() / 3600)

def build_samples(gst: list[dict], sep: list[dict]) -> list[dict]:
    """Tabela horária: kp (máximo na hora) e radiação (booleano), para HOURS + 1 pontos."""
    kp = [0.0] * (HOURS + 1)
    radiation = [False] * (HOURS + 1)

    for storm in gst:
        for entry in storm.get("allKpIndex", []):
            end = parse_time(entry["observedTime"])
            value = float(entry["kpIndex"])
            for back in range(KP_WINDOW_H):
                idx = hour_index(end - timedelta(hours=back + 1))
                if 0 <= idx <= HOURS:
                    kp[idx] = max(kp[idx], value)

    for event in sep:
        begin = parse_time(event["eventTime"])
        first = first_full_hour(begin)
        for offset in range(SEP_DURATION_H):
            idx = first + offset
            if 0 <= idx <= HOURS:
                radiation[idx] = True

    return [{"kp": round(kp[i], 2), "radiation": radiation[i]} for i in range(HOURS + 1)]

def parse_activity_id(activity_id: str) -> tuple[datetime, str]:
    stamp, kind = activity_id.rsplit("-", 2)[0], activity_id.rsplit("-", 2)[1]
    moment = datetime.strptime(stamp, "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    return moment, kind

def hours_since_start(moment: datetime) -> float:
    """Horas (com fração) desde o início da janela; negativo se for antes."""
    return round((moment - START_UTC).total_seconds() / 3600, 2)

def utc_text(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%dT%H:%MZ")

def linked_events(record: dict, onset: datetime) -> list[dict]:
    result = []
    for link in record.get("linkedEvents") or []:
        moment, kind = parse_activity_id(link["activityID"])
        result.append(
            {
                "id": link["activityID"],
                "type": kind,
                "time_utc": utc_text(moment),
                "hour": hours_since_start(moment),
                "lag_to_event_hours": round((onset - moment).total_seconds() / 3600, 2),
                "provenance": "from-id",
            }
        )
    return sorted(result, key=lambda item: item["time_utc"])

def alerts_of(record: dict, onset: datetime) -> list[dict]:
    result = []
    for note in record.get("sentNotifications") or []:
        issued = parse_time(note["messageIssueTime"])
        result.append(
            {
                "id": note["messageID"],
                "issued_utc": utc_text(issued),
                "hour": hours_since_start(issued),
                "delay_after_event_hours": round((issued - onset).total_seconds() / 3600, 2),
                "url": note.get("messageURL"),
            }
        )
    return sorted(result, key=lambda item: item["issued_utc"])

def radiation_episodes(sep_events: list[dict]) -> list[dict]:
    """Une as janelas de 24 h dos SEP que se sobrepõem ou se tocam (regra de jogo)."""
    windows = sorted(
        (first_full_hour(parse_time(e["time_utc"])), e["id"]) for e in sep_events
    )
    episodes: list[dict] = []
    for begin, event_id in windows:
        end = begin + SEP_DURATION_H
        if episodes and begin <= episodes[-1]["end_hour"]:
            episodes[-1]["end_hour"] = max(episodes[-1]["end_hour"], end)
            episodes[-1]["sep_ids"].append(event_id)
        else:
            episodes.append({"start_hour": begin, "end_hour": end, "sep_ids": [event_id]})
    for number, episode in enumerate(episodes, start=1):
        episode["id"] = f"EP-{number:02d}"
        episode["before_window_start"] = episode["start_hour"] < 0
        episode["provenance"] = "game-rule"
    return [
        {key: episode[key] for key in ("id", "start_hour", "end_hour", "before_window_start", "sep_ids", "provenance")}
        for episode in episodes
    ]

def build_events(gst: list[dict], sep: list[dict]) -> dict:
    events: list[dict] = []
    for record in sep:
        onset = parse_time(record["eventTime"])
        events.append(
            {
                "id": record["sepID"],
                "type": "SEP",
                "time_utc": utc_text(onset),
                "hour": hours_since_start(onset),
                "before_window_start": onset < START_UTC,
                "instruments": [item["displayName"] for item in record.get("instruments") or []],
                "link": record.get("link"),
                "linked_events": linked_events(record, onset),
                "alerts": alerts_of(record, onset),
                "provenance": "observed",
            }
        )
    for record in gst:
        onset = parse_time(record["startTime"])
        kps = [float(entry["kpIndex"]) for entry in record.get("allKpIndex") or []]
        events.append(
            {
                "id": record["gstID"],
                "type": "GST",
                "time_utc": utc_text(onset),
                "hour": hours_since_start(onset),
                "before_window_start": onset < START_UTC,
                "kp_max": max(kps) if kps else None,
                "kp_source": sorted({entry.get("source", "") for entry in record.get("allKpIndex") or []}),
                "link": record.get("link"),
                "linked_events": linked_events(record, onset),
                "alerts": alerts_of(record, onset),
                "note": "Índice Kp é da magnetosfera da Terra; não mede radiação na Lua e não afeta o jogo.",
                "provenance": "observed",
            }
        )
    events.sort(key=lambda item: item["time_utc"])
    sep_events = [item for item in events if item["type"] == "SEP"]
    return {
        "source": "NASA DONKI (SEP e GST), https://ccmc.gsfc.nasa.gov/tools/DONKI/ ; ver data-pipeline/fetch_donki.py",
        "start_utc": START_UTC.strftime("%Y-%m-%d %H:%M"),
        "hours": HOURS,
        "radiation_rule": f"Cada SEP marca radiação por {SEP_DURATION_H} h a partir da hora do evento; a DONKI não informa a duração (regra de jogo).",
        "not_downloaded": ["FLR (endpoint 404 em 14/11/2026)", "CME (429 com DEMO_KEY)", "IPS (429 com DEMO_KEY)"],
        "events": events,
        "radiation_episodes": radiation_episodes(sep_events),
    }

def fetch_json(endpoint: str, api_key: str) -> list[dict]:
    end = START_UTC + timedelta(hours=HOURS)
    query = urllib.parse.urlencode(
        {
            "startDate": START_UTC.strftime("%Y-%m-%d"),
            "endDate": end.strftime("%Y-%m-%d"),
            "api_key": api_key,
        }
    )
    with urllib.request.urlopen(f"{API}/{endpoint}?{query}", timeout=60) as response:
        return json.loads(response.read().decode("utf-8"))

def download(api_key: str) -> tuple[list[dict], list[dict]]:
    gst = fetch_json("GST", api_key)
    sep = fetch_json("SEP", api_key)
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    (RAW_DIR / "donki_gst.json").write_text(json.dumps(gst, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    (RAW_DIR / "donki_sep.json").write_text(json.dumps(sep, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return gst, sep

def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--from-raw", type=Path, help="pasta com donki_gst.json e donki_sep.json já baixados")
    args = parser.parse_args(argv)
    if args.from_raw:
        gst = json.loads((args.from_raw / "donki_gst.json").read_text(encoding="utf-8"))
        sep = json.loads((args.from_raw / "donki_sep.json").read_text(encoding="utf-8"))
    else:
        gst, sep = download(os.environ.get("NASA_API_KEY", "DEMO_KEY"))
    table = {
        "start_utc": START_UTC.strftime("%Y-%m-%d %H:%M"),
        "step_hours": 1,
        "hours": HOURS,
        "source": "NASA DONKI (GST e SEP), cenário de 09/10/2024; ver data-pipeline/fetch_donki.py",
        "samples": build_samples(gst, sep),
    }
    OUT_PATH.write_text(json.dumps(table, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    EVENTS_PATH.write_text(json.dumps(build_events(gst, sep), indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"gravado: {EVENTS_PATH}", file=sys.stderr)
    print(f"gravado: {OUT_PATH}", file=sys.stderr)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
