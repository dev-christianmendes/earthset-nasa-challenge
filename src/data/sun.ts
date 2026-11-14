// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Sol real (JPL Horizons), gerado por data-pipeline/fetch_sun.py. Ver docs/data-sources.md.
import sunJson from './sun-south-pole.json';
import type { SunTable } from '../engine/sun';

export const SUN = sunJson as SunTable;
