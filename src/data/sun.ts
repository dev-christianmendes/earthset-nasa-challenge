// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Sol JPL Horizons gerado por data-pipeline/fetch_sky.py --activate. Ver docs/data-sources.md.
import sunJson from './sun-south-pole.json';
import type { SunTable } from '../engine/sun';

export const SUN = sunJson as SunTable;
