# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Posição do Sol vista da base no polo sul lunar, pela API do JPL Horizons.

Fonte: NASA/JPL Horizons, efemérides DE441, observador na superfície da Lua
(centro 301) em 0° de longitude e -89,5° de latitude. Saída: azimute e elevação
aparentes do Sol, a cada hora, por um dia lunar de 708 h.

Uso:
  python3 data-pipeline/fetch_sun.py                 # baixa e grava os dois arquivos
  python3 data-pipeline/fetch_sun.py --from-raw FILE # reprocessa um texto já baixado

Saídas:
  data-pipeline/raw/horizons_sun_south_pole.txt   resposta crua do Horizons (para auditoria)
  src/data/sun-south-pole.json                    tabela usada pelo jogo

Só biblioteca padrão do Python 3.10 ou mais novo. Testes: python3 -m unittest discover -s data-pipeline/tests
"""

from __future__ import annotations

import argparse
import json
import sys
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

HORIZONS_URL = "https://ssd.jpl.nasa.gov/api/horizons.api"
SITE_LON_DEG = 0.0
SITE_LAT_DEG = -89.5  # base ilustrativa perto do polo sul; ver docs/data-sources.md
SITE_ALT_KM = 0.0
START_UTC = "2024-10-08 00:00"  # cenário de 08/10/2024, igual ao clima (D1)
HOURS = 708  # um dia lunar de jogo
STEP = "1 h"

ROOT = Path(__file__).resolve().parent.parent
RAW_PATH = ROOT / "data-pipeline" / "raw" / "horizons_sun_south_pole.txt"
OUT_PATH = ROOT / "src" / "data" / "sun-south-pole.json"


def build_params() -> dict[str, str]:
    """Parâmetros da consulta: Sol observado da superfície lunar, quantidade 4 (azimute e elevação)."""
    stop = datetime.strptime(START_UTC, "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
    stop_ts = stop.timestamp() + HOURS * 3600
    stop_dt = datetime.fromtimestamp(stop_ts, tz=timezone.utc)
    return {
        "format": "text",
        "COMMAND": "'10'",
        "OBJ_DATA": "'NO'",
        "MAKE_EPHEM": "'YES'",
        "EPHEM_TYPE": "'OBSERVER'",
        "CENTER": "'coord@301'",
        "COORD_TYPE": "'GEODETIC'",
        "SITE_COORD": f"'{SITE_LON_DEG},{SITE_LAT_DEG},{SITE_ALT_KM}'",
        "START_TIME": f"'{START_UTC}'",
        "STOP_TIME": f"'{stop_dt.strftime('%Y-%m-%d %H:%M')}'",
        "STEP_SIZE": f"'{STEP}'",
        "QUANTITIES": "'4'",
        "CSV_FORMAT": "'YES'",
    }


def fetch_raw(timeout_s: int = 90) -> str:
    url = HORIZONS_URL + "?" + urllib.parse.urlencode(build_params())
    with urllib.request.urlopen(url, timeout=timeout_s) as resp:  # noqa: S310 - URL fixa, da NASA
        return resp.read().decode("utf-8", errors="replace")


def parse_ephemeris(text: str) -> list[dict[str, float | str]]:
    """Extrai as linhas entre $$SOE e $$EOE. Cada linha: data, flag, vazio, azimute, elevação."""
    if "$$SOE" not in text or "$$EOE" not in text:
        raise ValueError("resposta do Horizons sem bloco $$SOE/$$EOE: confira a consulta ou o erro na resposta")
    body = text.split("$$SOE", 1)[1].split("$$EOE", 1)[0]
    rows: list[dict[str, float | str]] = []
    for line in body.splitlines():
        line = line.strip()
        if not line:
            continue
        cols = [c.strip() for c in line.split(",")]
        if len(cols) < 5:
            raise ValueError(f"linha inesperada na efeméride: {line!r}")
        rows.append(
            {
                "time": cols[0],
                "azimuth_deg": float(cols[3]),
                "elevation_deg": float(cols[4]),
            }
        )
    if not rows:
        raise ValueError("bloco $$SOE/$$EOE vazio")
    return rows


def build_table(rows: Iterable[dict[str, float | str]], generated: str) -> dict:
    rows = list(rows)
    samples = [
        {"az": round(float(r["azimuth_deg"]), 4), "el": round(float(r["elevation_deg"]), 4)} for r in rows
    ]
    sunlit = sum(1 for s in samples if s["el"] > 0)
    return {
        "source": "NASA/JPL Horizons (DE441), observador lunar em "
        f"{SITE_LAT_DEG}° lat, {SITE_LON_DEG}° lon",
        "generated_by": "data-pipeline/fetch_sun.py",
        "generated_utc": generated,
        "start_utc": START_UTC,
        "step_hours": 1,
        "hours": len(samples) - 1,
        "sunlit_fraction": round(sunlit / len(samples), 4) if samples else 0,
        "note": "Sem sombra de relevo: o Sol é considerado visível quando a elevação é maior que zero.",
        "samples": samples,
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--from-raw", type=Path, help="reprocessa um texto já baixado do Horizons")
    args = parser.parse_args(argv)

    if args.from_raw:
        text = args.from_raw.read_text(encoding="utf-8")
    else:
        text = fetch_raw()
        RAW_PATH.parent.mkdir(parents=True, exist_ok=True)
        RAW_PATH.write_text(text, encoding="utf-8")

    rows = parse_ephemeris(text)
    if len(rows) != HOURS + 1:
        raise SystemExit(f"esperadas {HOURS + 1} linhas, vieram {len(rows)}")
    generated = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    table = build_table(rows, generated)
    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    OUT_PATH.write_text(json.dumps(table, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"ok: {len(rows)} amostras, fração com Sol = {table['sunlit_fraction']} -> {OUT_PATH}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
