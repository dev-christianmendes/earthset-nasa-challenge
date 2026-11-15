// Desenvolvido com auxílio de IA. Ver AI_DISCLOSURE.md.
import { describe, it, expect } from 'vitest';
import { BODY_IDS, angularRadius, bodyAt, direction, equatorial, illuminatedFraction, skyAngles, solarView, stellarDirection, terrestrial, transform, trueAzimuth, utcAt, visibility } from '../../src/astronomy/sky';
import { decodeSky } from '../../src/astronomy/format';
import packed from '../../src/data/sky.json';
import horizons from '../fixtures/sky-horizons-peak-2024.json';
import alternatePacked from '../fixtures/sky-slope-2026.json';
import { SKY } from '../../src/data/sky';
import { SUN } from '../../src/data/sun';
import { TERRAIN } from '../../src/data/terrain';
import { isSunlit, sampleAt } from '../../src/engine/sun';

describe('céu lunar verificado', () => {
  it('mantém observador, época e grade temporal do Sol energético', () => {
    expect(SKY.start_utc).toBe(SUN.start_utc);
    expect(SKY.hours).toBe(SUN.hours);
    expect(SKY.observer).toMatchObject({ body: 301, latitude_deg: -89.9175552986833, longitude_deg: 216.86989764584402, altitude_km: 1.474125 });
    for (const id of BODY_IDS) expect(SKY.bodies[id]).toHaveLength(709);
  });
  it('a compactação reproduz amostras brutas Horizons, incluindo norte geográfico e atributos terrestres', () => {
    for (const id of BODY_IDS) for (const original of horizons.samples[id]) {
      const sample = bodyAt(SKY, id, original.hour);
      expect(Math.abs(((trueAzimuth(SKY, sample.az) - original.az + 540) % 360) - 180)).toBeLessThan(0.000001);
      for (const key of packed.columns[id]) {
        if (key === 'az') continue;
        const k = key as keyof typeof sample;
        if (original[k] === null) expect(sample[k]).toBeNull();
        else expect(Math.abs(sample[k]! - original[k]!)).toBeLessThanOrEqual(0.00000051);
      }
    }
  });
  it('recusa dados compactados truncados, coordenadas nulas e deltas fracionários', () => {
    const cut = structuredClone(packed);
    cut.bodies.sun[0].pop();
    expect(() => decodeSky(cut)).toThrow(/temporal/);
    const absent = structuredClone(packed) as unknown as { bodies: { sun: (number | null)[][] } };
    absent.bodies.sun[0][0] = null;
    expect(() => decodeSky(absent)).toThrow(/ausente/);
    const delta = structuredClone(packed);
    delta.bodies.sun[0][0] = 0.5;
    expect(() => decodeSky(delta)).toThrow(/Amostra/);
  });
  it('carrega outro observador e outra época sem contaminar a partida histórica', () => {
    // Gerado por fetch_sky.py --start '2026-11-15 00:00' --hours 48 --site slope --output …
    const table = decodeSky(alternatePacked);
    expect(table.observer.longitude_deg).toBe(315);
    expect(table.observer.latitude_deg).toBeCloseTo(-89.97668111334877, 10);
    for (const id of BODY_IDS) expect(table.bodies[id]).toHaveLength(49);
    expect(utcAt(table, 48)).toBe('2026-11-17 00:00:00 UTC');
    expect(() => bodyAt(table, 'sun', 49)).toThrow(RangeError);
    expect(bodyAt(table, 'earth', 0)).not.toEqual(bodyAt(SKY, 'earth', 0));
    expect(SUN.start_utc).toBe('2024-10-09 09:00');
    expect(SKY.observer.longitude_deg).toBe(216.86989764584402);
  });
  it('propaga movimento próprio de Sirius, Alpha Centauri e Polaris contra ERFA pmsafe', () => {
    // Referência independente: scripts/validate-science.py, dt=100 anos julianos J2000.
    const table = { ...SKY, start_utc: '2100-01-01 12:00' };
    const reference: Record<number, readonly number[]> = {
      2491: [-0.1871582042940772, 0.9391052861264652, -0.28818929219307665],
      5459: [-0.37521781092929873, -0.31142458511223636, -0.8730557382831274],
      424: [0.010120811525590145, 0.00791722373988049, 0.9999174399630782],
    };
    for (const [id, vector] of Object.entries(reference)) {
      const star = SKY.stars.samples.find((s) => s.hr === Number(id))!;
      const direction = stellarDirection(star, table, 0);
      direction.forEach((v, i) => expect(v).toBeCloseTo(vector[i], 10));
      expect(Math.hypot(...direction)).toBeCloseTo(1, 12);
    }
  });
  it('usa exatamente o Sol energético para direção e bloqueio por relevo', () => {
    for (let hour = 0; hour <= 708; hour++) {
      const solar = solarView(SUN, hour, 'peak', TERRAIN);
      expect(solar.lit).toBe(isSunlit(SUN, hour, 'peak', TERRAIN));
      expect(solar.direction).toEqual(direction(sampleAt(SUN, hour).az, sampleAt(SUN, hour).el));
      expect(Math.abs(bodyAt(SKY, 'sun', hour).el - solar.el)).toBeLessThan(0.0001);
    }
  });
  it('reproduz azimute e elevação de TODOS os corpos a partir do referencial inercial', () => {
    for (let h = 0; h <= 708; h += 12) for (const id of BODY_IDS) {
      const s = bodyAt(SKY, id, h);
      const projected = skyAngles(transform(SKY.icrf_to_local[h], equatorial(s.ra, s.dec)));
      expect(Math.abs(((projected.az - s.az + 540) % 360) - 180)).toBeLessThan(0.00001);
      expect(projected.el).toBeCloseTo(s.el, 5);
    }
  });
  it('tem Sol com cerca de meio grau e Terra com tamanho obtido da efeméride', () => {
    for (const id of ['sun', 'earth'] as const) {
      const s = bodyAt(SKY, id, 180);
      const r = angularRadius(s.diameter_arcsec, 700);
      expect(2 * Math.asin(r / 700) * 180 / Math.PI).toBeCloseTo(s.diameter_arcsec / 3600, 10);
    }
    expect(bodyAt(SKY, 'sun', 0).diameter_arcsec / 3600).toBeCloseTo(0.534, 2);
  });
  it('concorda fase calculada, ponto subsolar e fração iluminada da Terra', () => {
    for (const h of [0, 180, 360, 500, 708]) {
      const s = bodyAt(SKY, 'earth', h);
      expect(illuminatedFraction(s.phase_deg!)).toBeCloseTo(s.illumination_pct! / 100, 4);
      const observer = terrestrial(s.observer_lon!, s.observer_lat!);
      const solar = terrestrial(s.solar_lon!, s.solar_lat!);
      const fraction = (1 + observer.reduce((sum, x, i) => sum + x * solar[i], 0)) / 2;
      // Globo esférico; a efeméride terrestre usa elipsoide e latitudes geodéticas.
      expect(Math.abs(fraction - s.illumination_pct! / 100)).toBeLessThan(0.003);
    }
  });
  it('oculta a Terra inicial e distingue centro, limbo e corpo inteiro', () => {
    expect(visibility(bodyAt(SKY, 'earth', 0), TERRAIN, 'peak').anyVisible).toBe(false);
    const sample = { az: 0, el: -0.1, diameter_arcsec: 1900 };
    const flat = { ...TERRAIN, sites: { ...TERRAIN.sites, peak: { ...TERRAIN.sites.peak, horizon_deg: Array(72).fill(0) } } };
    expect(visibility(sample, flat, 'peak')).toMatchObject({ centerVisible: false, anyVisible: true, fullVisible: false });
  });
  it('estrelas têm IDs e coordenadas de catálogo, sem preenchimento aleatório', () => {
    if (SKY.stars.status === 'available') {
      expect(SKY.stars.samples.length).toBeGreaterThan(100);
      const sirius = SKY.stars.samples.find((s) => s.hr === 2491)!;
      expect(sirius.ra).toBeCloseTo(101.287, 2);
      expect(sirius.dec).toBeCloseTo(-16.716, 2);
      expect(sirius.magnitude).toBeCloseTo(-1.46, 2);
      expect(new Set(SKY.stars.samples.map((s) => s.hr)).size).toBe(SKY.stars.samples.length);
    } else expect(SKY.stars.samples).toHaveLength(0);
  });
  it('preserva orientação norte/leste e recusa tempo inválido', () => {
    expect(direction(0, 0)[2]).toBe(-1);
    expect(direction(90, 0)[0]).toBe(1);
    expect(() => bodyAt(SKY, 'earth', Number.NaN)).toThrow(RangeError);
    expect(() => bodyAt(SKY, 'earth', -1)).toThrow(RangeError);
    expect(() => bodyAt(SKY, 'earth', 900)).toThrow(RangeError);
    expect(utcAt(SKY, 0)).toBe('2024-10-09 09:00:00 UTC');
  });
});
