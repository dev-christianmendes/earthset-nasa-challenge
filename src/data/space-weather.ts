// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Clima espacial do cenário de 08/10/2024, gerado por data-pipeline/fetch_donki.py (NASA DONKI).
import weatherJson from './space-weather.json';
import type { SpaceWeatherTable } from '../engine/space-weather';

export const WEATHER = weatherJson as SpaceWeatherTable;
