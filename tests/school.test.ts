// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { EXPLANATIONS, SCHOOL_LABELS } from '../src/school';

const LANGS = ['en', 'pt'] as const;

describe('modo escola (B3.4)', () => {
  it('toda explicação tem o que é, o porquê e a fonte, em texto curto, nos dois idiomas', () => {
    for (const [key, byLang] of Object.entries(EXPLANATIONS)) {
      for (const lang of LANGS) {
        const text = byLang[lang];
        for (const part of [text.what, text.why, text.source]) {
          expect(part.length, `${key} (${lang}): texto vazio`).toBeGreaterThan(0);
          expect(part.length, `${key} (${lang}): texto longo demais para a tela`).toBeLessThanOrEqual(130);
        }
      }
    }
  });

  it('cada fonte diz se o dado é real ou regra do jogo (nos dois idiomas)', () => {
    for (const [key, byLang] of Object.entries(EXPLANATIONS)) {
      expect(/real|ilustrativ|regra do jogo|game rule|illustrative/i.test(byLang.pt.source), `${key}: fonte pt`).toBe(true);
      expect(/real|illustrative|game rule/i.test(byLang.en.source), `${key}: fonte en`).toBe(true);
    }
  });

  it('rótulos do modo escola são curtos e existem nos dois idiomas', () => {
    for (const [key, byLang] of Object.entries(SCHOOL_LABELS)) {
      for (const lang of LANGS) {
        expect(byLang[lang].length, `${key} (${lang}): rótulo vazio`).toBeGreaterThan(0);
        expect(byLang[lang].length, `${key} (${lang}): rótulo longo`).toBeLessThanOrEqual(20);
      }
    }
  });
});
