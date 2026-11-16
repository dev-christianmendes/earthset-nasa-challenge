# References

Draft for the submission (backlog item E-06). Every data source, library, third-party asset and AI tool used in Earthset is listed here. Details and provenance: `docs/data-sources.md`, `docs/ART_ASSET_PIPELINE.md`, `AI_DISCLOSURE.md`.

## 1. Scientific data

| Data | Source | How it is used |
|---|---|---|
| Sun, Earth, Mercury, Venus, Mars, Jupiter, Saturn: positions, apparent diameters, illumination | NASA/JPL Horizons, DE441 ephemeris ([manual](https://ssd.jpl.nasa.gov/horizons/manual.html)) | Sky and Sun model, hourly over the 708-hour match window (2024-10-09 09:00 to 2024-11-07 21:00 UTC) |
| Lunar south pole terrain and local horizon | LRO LOLA, LDEM_80S_20M elevation model, NASA PDS (distributed by MIT: [LDEM_80S_20M.LBL](https://imbrium.mit.edu/DATA/LOLA_GDR/POLAR/IMG/LDEM_80S_20M.LBL)) | Measured horizon per site (peak, slope, rim); terrain mesh in the scene |
| Star catalogue (BSC5) | Yale Bright Star Catalogue 5, via CDS V/50 and the NOIRLab mirror | Star field in the sky view |
| Solar storms (geomagnetic and energetic particle events) | NASA DONKI API (GST and SEP records) | Historical space weather scenario; SEP drives the radiation rule |
| Water and ice on the Moon | Colaprete et al. (2010), *Science*; Li et al. (2018), *PNAS* (M3 and Chandrayaan data); NASA PRIME-1 / TRIDENT on IM-2 (2025) | Ice mission rules and figures, as cited in `docs/data-sources.md` section 4b |
| Lunar polar observer and grid | Derived from the LOLA label and `data-pipeline/observers.json` | Observer location for Horizons queries |

Game rules (resource numbers, robot speed, heart losses) are **illustrative**: marked in the code and the screen, and explained in `docs/regras-recursos.md`. Fictional facts are never presented as NASA measurements.

## 2. Software and libraries

| Name | Use |
|---|---|
| [three.js](https://threejs.org/) | 3D rendering in the browser |
| [Vite](https://vitejs.dev/) | Development server and build |
| [TypeScript](https://www.typescriptlang.org/) | Language |
| [Vitest](https://vitest.dev/) | Unit and match tests (development only) |
| Python 3 with the standard library | Data pipelines in `data-pipeline/` |
| [Blender](https://www.blender.org/) 5.x | Scripted generation of the base, rover and astronaut models |
| Web Audio API | Sound effects, synthesised at run time (no audio files) |

## 3. Third-party visual assets

| Asset | Source | License | Where it is used |
|---|---|---|---|
| Lunar surface "Moon Dusted 01" (diffuse, normal, roughness) | [Poly Haven](https://polyhaven.com) | CC0 1.0 | Ground texture (`public/textures/moon/`) |
| Earth texture (Blue Marble, land shallow topography, 2048 px) | NASA Blue Marble, via Wikimedia Commons | Public domain (NASA media) | Earth disc in the sky (`public/textures/earth/`) |
| Astronaut (suit, helmet, backpack; animation clips) | [Quaternius](https://quaternius.com/) Universal Animation Library 1 and 2, and build of the astronaut model | CC0 1.0 | Crew characters (`public/models/ext/astronaut.glb`) |
| Modules, tunnels, landers, boxes, rocks, rover and truck | KayKit Space Base Bits (Kay Lousberg) and Quaternius, via [poly.pizza](https://poly.pizza) | CC0 1.0 | Alternative models; see `SOURCE.md` in each folder |
| Habitat, rover, power unit, processor, tanks, greenhouse, antenna, solar panels | Own models, built by `assets-src/blender/build_v4.py` | Project | Base and rover |

No NASA logo, insignia, flag or patch is used anywhere in the assets or the screen.

## 4. AI tools

| Tool | Use | Model |
|---|---|---|
| Claude Code (Anthropic) | Code, tests and documentation | Claude Haiku, Sonnet and Opus |
| Codex (OpenAI) | Code and documentation from 14/11/2026 | gpt6-luna |

No generative AI image or model is used as a final asset, and no generative AI runs during the game. Each TypeScript file created or changed with AI assistance starts with the header `// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.`
