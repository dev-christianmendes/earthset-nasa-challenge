# Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
"""Horizonte medido no relevo LOLA, em volta do polo sul lunar.

Fonte: LRO LOLA, modelo de elevação LDEM_80S_20M (20 m por pixel, projeção polar
estereográfica, centro no polo sul), arquivo IMG do MIT/PDS. Ver docs/data-sources.md.

O arquivo completo tem 1,76 GB. Este script baixa só a faixa de 40 km em volta do
polo (2000 linhas, ~122 MB, por HTTP Range) e grava o resultado reduzido em
src/data/terrain-sites.json. O bruto fica em data-pipeline/raw/ (fora do git).

Método (ver docs/data-sources.md, seção 2):
  1. Para cada candidato num disco de 3 km em volta do polo, lança 72 raios (a cada 5°)
     até 20 km e mede o maior ângulo de elevação do relevo visto do candidato, já
     descontada a curvatura da Lua (d² / 2R).
  2. Três posições são escolhidas pelo próprio horizonte: a mais exposta (peak), a de
     horizonte mediano (slope) e a mais sombreada (rim). Os nomes seguem o jogo.

Convenção de azimute: a do JPL Horizons (0° = norte local, 90° = leste, sentido horário).
Norte = +y da projeção (direção do meridiano 0°, afastando-se do polo); leste = +x.
É a convenção padrão da estereográfica polar sul (EPSG:3031). Ver a suposição em
docs/data-sources.md, seção 2.

Uso:
  python3 data-pipeline/fetch_lola.py                  # baixa a faixa e grava o JSON
  python3 data-pipeline/fetch_lola.py --from-raw FILE  # reprocessa a faixa já baixada

Só biblioteca padrão do Python 3.10 ou mais novo. Testes: python3 -m unittest discover -s data-pipeline/tests
"""

from __future__ import annotations

import argparse
import array
import json
import math
import sys
import urllib.request
from pathlib import Path

IMG_URL = "https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_20M.IMG"
SIZE_PX = 30400
PIXEL_M = 20.0
HEIGHT_SCALE = 0.5  # metros por unidade do pixel (SCALING_FACTOR no rótulo)
CENTER_PX = 15199.5  # centro do polo na projeção (LINE/SAMPLE_PROJECTION_OFFSET)
MOON_RADIUS_M = 1_737_400.0
BAND_HALF_PX = 1000  # 1000 px = 20 km para cada lado do polo
RAY_MAX_M = 20_000.0
RAY_STEP_M = 20.0
AZ_STEP_DEG = 5
CANDIDATE_RADIUS_M = 3_000.0
CANDIDATE_STEP_M = 500.0

ROOT = Path(__file__).resolve().parent.parent
RAW_PATH = ROOT / "data-pipeline" / "raw" / "lola_south_pole_band.bin"
OUT_PATH = ROOT / "src" / "data" / "terrain-sites.json"


def band_rows() -> tuple[int, int]:
    """Primeira e última linha (0-based, inclusive) da faixa baixada."""
    first = int(CENTER_PX) - BAND_HALF_PX
    last = int(CENTER_PX) + BAND_HALF_PX
    return first, last


def byte_range() -> tuple[int, int]:
    """Bytes da faixa no arquivo IMG (linhas de SIZE_PX amostras de 16 bits)."""
    first, last = band_rows()
    row_bytes = SIZE_PX * 2
    return first * row_bytes, (last + 1) * row_bytes - 1


def download_band(dest: Path, url: str = IMG_URL) -> Path:
    """Baixa só a faixa, por HTTP Range. Não baixa o arquivo inteiro."""
    start, end = byte_range()
    dest.parent.mkdir(parents=True, exist_ok=True)
    request = urllib.request.Request(url, headers={"Range": f"bytes={start}-{end}"})
    with urllib.request.urlopen(request, timeout=120) as response:
        data = response.read()
    expected = end - start + 1
    if len(data) != expected:
        raise RuntimeError(f"faixa incompleta: {len(data)} de {expected} bytes")
    dest.write_bytes(data)
    return dest


class Dem:
    """Elevação de uma faixa de linhas do LDEM, em metros relativos ao raio de referência."""

    def __init__(self, raw: bytes, first_row: int, rows: int) -> None:
        if sys.byteorder != "little":
            raise RuntimeError("este script lê o IMG em little-endian (LSB_INTEGER)")
        self.values = array.array("h")
        self.values.frombytes(raw)
        self.first_row = first_row
        self.rows = rows
        if len(self.values) != rows * SIZE_PX:
            raise RuntimeError("tamanho da faixa não bate com o número de linhas")

    def height(self, sample: int, line: int) -> float:
        """Elevação no pixel (sample, line), 0-based. Fora da faixa: ValueError."""
        row = line - self.first_row
        if not (0 <= row < self.rows and 0 <= sample < SIZE_PX):
            raise ValueError("pixel fora da faixa")
        return self.values[row * SIZE_PX + sample] * HEIGHT_SCALE


def xy_to_pixel(x_m: float, y_m: float) -> tuple[float, float]:
    """Coordenadas da projeção (x para leste, y para norte, metros) para (sample, line)."""
    return CENTER_PX + x_m / PIXEL_M, CENTER_PX - y_m / PIXEL_M


def horizon_deg(dem: Dem, x0: float, y0: float, az_deg: float) -> float:
    """Maior ângulo de elevação do relevo visto de (x0, y0) na direção de azimute az_deg."""
    h0 = dem.height(*map(round, xy_to_pixel(x0, y0)))
    sin_a = math.sin(math.radians(az_deg))
    cos_a = math.cos(math.radians(az_deg))
    best = -90.0
    d = RAY_STEP_M
    while d <= RAY_MAX_M:
        sample, line = xy_to_pixel(x0 + d * sin_a, y0 + d * cos_a)
        try:
            h = dem.height(round(sample), round(line))
        except ValueError:
            break
        # Curvatura da Lua: o chão ao longe "cai" d²/2R abaixo do plano tangente.
        drop = d * d / (2 * MOON_RADIUS_M)
        angle = math.degrees(math.atan2(h - drop - h0, d))
        if angle > best:
            best = angle
        d += RAY_STEP_M
    return max(best, 0.0)


def horizon_profile(dem: Dem, x0: float, y0: float) -> list[float]:
    """Horizonte em todas as direções, a cada AZ_STEP_DEG graus."""
    return [round(horizon_deg(dem, x0, y0, az), 2) for az in range(0, 360, AZ_STEP_DEG)]


def candidates() -> list[tuple[float, float]]:
    """Pontos num disco de CANDIDATE_RADIUS_M em volta do polo, em passo de CANDIDATE_STEP_M."""
    pts: list[tuple[float, float]] = []
    steps = int(CANDIDATE_RADIUS_M // CANDIDATE_STEP_M)
    for i in range(-steps, steps + 1):
        for j in range(-steps, steps + 1):
            x, y = i * CANDIDATE_STEP_M, j * CANDIDATE_STEP_M
            if math.hypot(x, y) <= CANDIDATE_RADIUS_M:
                pts.append((x, y))
    return pts


def pick_sites(scored: list[tuple[float, tuple[float, float], list[float]]]) -> dict[str, tuple[float, float, list[float]]]:
    """Escolhe peak (mais exposto), slope (mediano) e rim (mais sombreado) pelo horizonte médio."""
    ordered = sorted(scored, key=lambda item: item[0])
    exposed = ordered[0]
    median = ordered[len(ordered) // 2]
    shadowed = ordered[-1]
    return {
        "peak": (exposed[1][0], exposed[1][1], exposed[2]),
        "slope": (median[1][0], median[1][1], median[2]),
        "rim": (shadowed[1][0], shadowed[1][1], shadowed[2]),
    }


def build(dem: Dem) -> dict:
    scored = []
    for x, y in candidates():
        profile = horizon_profile(dem, x, y)
        mean = sum(profile) / len(profile)
        scored.append((mean, (x, y), profile))
    sites = pick_sites(scored)
    return {
        "source": "LRO LOLA LDEM_80S_20M (NASA PDS / MIT), 20 m por pixel, polo sul",
        "method": "horizonte medido em 72 direções até 20 km, com curvatura lunar; ver data-pipeline/fetch_lola.py",
        "azimuth_step_deg": AZ_STEP_DEG,
        "azimuth_reference": "0° = norte (+y da projeção), 90° = leste (+x), sentido horário (convenção Horizons)",
        "sites": {
            name: {
                "x_m": round(x, 1),
                "y_m": round(y, 1),
                "horizon_deg": profile,
            }
            for name, (x, y, profile) in sites.items()
        },
    }


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--from-raw", type=Path, help="reprocessa uma faixa já baixada")
    args = parser.parse_args(argv)
    raw_file = args.from_raw or RAW_PATH
    if args.from_raw is None and not RAW_PATH.exists():
        print(f"baixando a faixa LOLA ({byte_range()[1] - byte_range()[0] + 1} bytes)...", file=sys.stderr)
        download_band(RAW_PATH)
    first, last = band_rows()
    dem = Dem(raw_file.read_bytes(), first, last - first + 1)
    result = build(dem)
    OUT_PATH.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"gravado: {OUT_PATH}", file=sys.stderr)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
