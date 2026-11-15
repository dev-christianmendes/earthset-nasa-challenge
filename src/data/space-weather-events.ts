// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Catálogo de eventos do cenário de 09/10/2024, gerado por data-pipeline/fetch_donki.py (NASA DONKI).
import eventsJson from './space-weather-events.json';
import type { SpaceEventCatalog } from '../engine/space-events';

export const SPACE_EVENTS = eventsJson as SpaceEventCatalog;
