// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
// Textos da interface: as duas línguas têm as mesmas chaves e os mesmos {marcadores}.
import { describe, expect, it } from 'vitest';
import { DICT_FOR_TESTS } from '../src/i18n';

const placeholders = (text: string): string[] => (text.match(/\{[a-z]+\}/g) ?? []).sort();

describe('idioma da interface (R-LANG)', () => {
  it('toda chave existe em inglês e em português', () => {
    for (const [key, entry] of Object.entries(DICT_FOR_TESTS)) {
      expect(entry.en, `${key}: falta en`).toBeTruthy();
      expect(entry.pt, `${key}: falta pt`).toBeTruthy();
    }
  });

  it('os dois idiomas usam os mesmos marcadores {variável}', () => {
    for (const [key, entry] of Object.entries(DICT_FOR_TESTS)) {
      expect(placeholders(entry.en), `${key}`).toEqual(placeholders(entry.pt));
    }
  });
});
