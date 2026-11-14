# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Clima espacial de um dia lunar de cenário, pela API NASA DONKI.

Cenário (decisão D1 em docs/arquitetura.md): a janela de 708 h começa em 2024-10-08 00:00 UTC,
com Sol acima do horizonte no polo sul em 706 das 709 horas (ver fetch_sun.py); a tempestade geomagnética G4 de 10 a 11/10/2024 cai dentro da janela (a confirmar na DONKI). A partida é um cenário
histórico, rotulado como tal na tela. Não é previsão.

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

Uso:
  python3 data-pipeline/fetch_donki.py                 # baixa (DEMO_KEY, ou NASA_API_KEY) e grava
  python3 data-pipeline/fetch_donki.py --from-raw DIR  # reprocessa as respostas já baixadas

Só biblioteca padrão do Python 3.10 ou mais novo. Testes: python3 -m unittest discover -s data-pipeline/tests
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

API = "https://api.nasa.gov/DONKI"
START_UTC = datetime(2024, 10, 8, 0, 0, tzinfo=timezone.utc)
HOURS = 708
KP_WINDOW_H = 3
SEP_DURATION_H = 24

ROOT = Path(__file__).resolve().parent.parent
RAW_DIR = ROOT / "data-pipeline" / "raw"
OUT_PATH = ROOT / "src" / "data" / "space-weather.json"


def parse_time(text: str) -> datetime:
    """Horário da DONKI, por exemplo '2024-10-08T18:00Z'."""
    return datetime.strptime(text.replace("Z", ""), "%Y-%m-%dT%H:%M").replace(tzinfo=timezone.utc)


def hour_index(moment: datetime) -> int:
    """Índice da hora de jogo (0 = início da janela), com floor."""
    return int((moment - START_UTC).total_seconds() // 3600)


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
        first = hour_index(begin)
        for offset in range(SEP_DURATION_H):
            idx = first + offset
            if 0 <= idx <= HOURS:
                radiation[idx] = True

    return [{"kp": round(kp[i], 2), "radiation": radiation[i]} for i in range(HOURS + 1)]


def fetch_json(endpoint: str, api_key: str) -> list[dict]:
    """Consulta a DONKI para a janela do cenário."""
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
        "source": "NASA DONKI (GST e SEP), cenário de 08/10/2024; ver data-pipeline/fetch_donki.py",
        "samples": build_samples(gst, sep),
    }
    OUT_PATH.write_text(json.dumps(table, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"gravado: {OUT_PATH}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
