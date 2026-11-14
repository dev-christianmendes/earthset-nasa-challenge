// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, expect, it } from 'vitest';
import { EXPLANATIONS, SCHOOL_LABELS } from '../src/school';

describe('modo escola (B3.4)', () => {
  it('toda explicação tem o que é, o porquê e a fonte, em texto curto', () => {
    for (const [key, text] of Object.entries(EXPLANATIONS)) {
      for (const part of [text.what, text.why, text.source]) {
        expect(part.length, `${key}: texto vazio`).toBeGreaterThan(0);
        expect(part.length, `${key}: texto longo demais para a tela`).toBeLessThanOrEqual(130);
      }
    }
  });

  it('cada explicação deixa claro se o dado é real ou ilustrativo', () => {
    for (const [key, text] of Object.entries(EXPLANATIONS)) {
      expect(/real|ilustrativ|regra do jogo/i.test(text.source), `${key}: fonte sem classificação`).toBe(true);
    }
  });

  it('rótulos do modo escola são curtos e não estão vazios', () => {
    for (const [key, label] of Object.entries(SCHOOL_LABELS)) {
      expect(label.length, `${key}: rótulo vazio`).toBeGreaterThan(0);
      expect(label.length, `${key}: rótulo longo`).toBeLessThanOrEqual(20);
    }
  });
});
