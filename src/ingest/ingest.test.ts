import { describe, expect, it } from 'vitest';
import { matchProduct, similarity, type MatchCandidate } from './match';
import { normaliseEan, normaliseTitle, parsePackSize, toIsoDate, toPence } from './normalise';

describe('parsePackSize', () => {
  it('multiplies a multipack', () => {
    expect(parsePackSize('4 x 415g')).toEqual({ qty: 1660, unit: 'g', label: '4 x 415g' });
    expect(parsePackSize('6x330ml')?.qty).toBe(1980);
  });

  it('converts kilos and litres to the base unit', () => {
    expect(parsePackSize('1.5kg')).toEqual({ qty: 1500, unit: 'g', label: '1.5kg' });
    expect(parsePackSize('2 litres')?.qty).toBe(2000);
    expect(parsePackSize('2L')?.unit).toBe('ml');
  });

  it('counts countable packs', () => {
    expect(parsePackSize('12 pack')).toEqual({ qty: 12, unit: 'item', label: '12 pack' });
    expect(parsePackSize('9 rolls')?.qty).toBe(9);
    expect(parsePackSize('38 washes')?.qty).toBe(38);
  });

  it('returns null rather than guessing an unreadable label', () => {
    expect(parsePackSize('')).toBeNull();
    expect(parsePackSize('family size')).toBeNull();
    expect(parsePackSize('each')).toBeNull();
  });
});

describe('normaliseTitle', () => {
  it('strips the pack size so two retailers compare', () => {
    expect(normaliseTitle('Heinz Baked Beans 4 x 415g')).toBe('heinz baked beans');
    expect(normaliseTitle('HEINZ Baked Beanz 415G')).toBe('heinz baked beanz');
  });

  it('strips marketing noise and punctuation', () => {
    expect(normaliseTitle("McVitie's Digestives – NEW 400g")).toBe('mcvities digestives');
  });
});

describe('normaliseEan', () => {
  it('accepts 8 and 13 digit barcodes', () => {
    expect(normaliseEan('5000157024671')).toBe('5000157024671');
    expect(normaliseEan('50015724')).toBe('50015724');
  });

  it('pads a 12-digit UPC', () => {
    expect(normaliseEan('012345678905')).toBe('0012345678905');
  });

  it('rejects anything else rather than half-matching', () => {
    expect(normaliseEan('12345')).toBeNull();
    expect(normaliseEan('')).toBeNull();
    expect(normaliseEan(null)).toBeNull();
  });
});

describe('toPence', () => {
  it('treats a bare number as pounds', () => {
    expect(toPence(1.45)).toBe(145);
    expect(toPence(10)).toBe(1000);
  });

  it('parses strings with a currency symbol', () => {
    expect(toPence('£1.45')).toBe(145);
    expect(toPence(' 1.45 ')).toBe(145);
    expect(toPence('65p')).toBe(65);
  });

  it('returns null for unusable input', () => {
    expect(toPence(null)).toBeNull();
    expect(toPence('')).toBeNull();
    expect(toPence('see offer')).toBeNull();
  });
});

describe('toIsoDate', () => {
  it('accepts ISO and UK formats', () => {
    expect(toIsoDate('2026-11-10')).toBe('2026-11-10');
    expect(toIsoDate('2026-11-10T23:59:00Z')).toBe('2026-11-10');
    expect(toIsoDate('10/11/2026')).toBe('2026-11-10');
  });

  it('returns null rather than inventing a date', () => {
    expect(toIsoDate('')).toBeNull();
    expect(toIsoDate('while stocks last')).toBeNull();
    expect(toIsoDate(undefined)).toBeNull();
  });
});

describe('similarity', () => {
  it('scores identical strings 1', () => {
    expect(similarity('heinz baked beans', 'heinz baked beans')).toBe(1);
  });

  it('scores unrelated strings low', () => {
    expect(similarity('heinz baked beans', 'andrex toilet tissue')).toBeLessThan(0.3);
  });

  it('is not punished much when the retailer title is wordier', () => {
    expect(similarity('heinz baked beans', 'heinz baked beans in tomato sauce')).toBeGreaterThan(
      0.86,
    );
  });

  it('ignores a trailing plural', () => {
    expect(similarity('heinz baked bean', 'heinz baked beans')).toBe(1);
  });

  it('stays low when a key word differs', () => {
    expect(similarity('heinz baked beans', 'butter beans')).toBeLessThan(0.6);
  });
});

describe('matchProduct', () => {
  const candidates: MatchCandidate[] = [
    {
      productId: 3,
      ean: '5000157024671',
      name: 'Baked beans',
      brand: 'Heinz',
      packQty: 1660,
      packUnit: 'g',
    },
    {
      productId: 26,
      ean: '5000168203706',
      name: 'Digestive biscuits',
      brand: "McVitie's",
      packQty: 400,
      packUnit: 'g',
    },
  ];

  it('matches on EAN outright', () => {
    const result = matchProduct(
      {
        ean: '5000157024671',
        title: 'Completely different wording',
        brand: null,
        packQty: null,
        packUnit: null,
      },
      candidates,
    );
    expect(result).toEqual({ productId: 3, method: 'ean', score: 1 });
  });

  it('falls back to a name match when the pack size agrees', () => {
    const result = matchProduct(
      {
        ean: null,
        title: 'Baked Beans in Tomato Sauce 4 x 415g',
        brand: 'Heinz',
        packQty: 1660,
        packUnit: 'g',
      },
      candidates,
    );
    expect(result.productId).toBe(3);
    expect(result.method).toBe('name');
  });

  it('refuses a name match when the pack size differs', () => {
    const result = matchProduct(
      {
        ean: null,
        title: 'Heinz Baked Beans 415g',
        brand: 'Heinz',
        packQty: 415,
        packUnit: 'g',
      },
      candidates,
    );
    expect(result.productId).toBeNull();
  });

  it('refuses a weak name match rather than guessing', () => {
    const result = matchProduct(
      {
        ean: null,
        title: 'Butter beans',
        brand: null,
        packQty: 1660,
        packUnit: 'g',
      },
      candidates,
    );
    expect(result.productId).toBeNull();
    expect(result.method).toBeNull();
  });

  it('refuses when there is nothing to go on', () => {
    const result = matchProduct(
      { ean: null, title: '', brand: null, packQty: null, packUnit: null },
      candidates,
    );
    expect(result.productId).toBeNull();
  });
});
