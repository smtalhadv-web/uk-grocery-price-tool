import { describe, expect, it } from 'vitest';
import {
  formatDelta,
  formatPence,
  parsePriceToPence,
  percentSaved,
  sumPence,
  unitPrice,
} from './money';

describe('parsePriceToPence', () => {
  it('parses pounds and pence', () => {
    expect(parsePriceToPence('£1.45')).toBe(145);
    expect(parsePriceToPence('1.45')).toBe(145);
    expect(parsePriceToPence('£12.00')).toBe(1200);
  });

  it('pads a single decimal digit', () => {
    expect(parsePriceToPence('£1.5')).toBe(150);
  });

  it('parses whole pounds', () => {
    expect(parsePriceToPence('£2')).toBe(200);
  });

  it('parses pence-only strings', () => {
    expect(parsePriceToPence('45p')).toBe(45);
    expect(parsePriceToPence('99P')).toBe(99);
  });

  it('returns null rather than guessing', () => {
    expect(parsePriceToPence('')).toBeNull();
    expect(parsePriceToPence('free')).toBeNull();
    expect(parsePriceToPence('£1.456')).toBeNull();
    expect(parsePriceToPence('2 for £3')).toBeNull();
  });
});

describe('formatPence', () => {
  it('formats to two decimals', () => {
    expect(formatPence(145)).toBe('£1.45');
    expect(formatPence(5)).toBe('£0.05');
    expect(formatPence(1000)).toBe('£10.00');
  });

  it('renders missing values as an em dash, never as zero', () => {
    expect(formatPence(null)).toBe('—');
    expect(formatPence(undefined)).toBe('—');
    expect(formatPence(0)).toBe('£0.00');
  });
});

describe('formatDelta', () => {
  it('signs the difference', () => {
    expect(formatDelta(325)).toBe('+£3.25');
    expect(formatDelta(-120)).toBe('−£1.20');
    expect(formatDelta(0)).toBe('same');
  });
});

describe('sumPence', () => {
  it('stays exact where floats would drift', () => {
    expect(sumPence([10, 20, 30])).toBe(60);
    expect(sumPence(Array.from({ length: 10 }, () => 10))).toBe(100);
  });
});

describe('unitPrice', () => {
  it('computes per 100g', () => {
    expect(unitPrice(300, 1660, 'g')?.text).toBe('18.1p / 100g');
  });

  it('computes per item', () => {
    expect(unitPrice(265, 12, 'item')?.text).toBe('£0.22 each');
  });

  it('returns null when the pack size is unknown', () => {
    expect(unitPrice(300, null, 'g')).toBeNull();
    expect(unitPrice(300, 500, null)).toBeNull();
    expect(unitPrice(300, 0, 'g')).toBeNull();
  });
});

describe('percentSaved', () => {
  it('rounds to a whole percent', () => {
    expect(percentSaved(450, 300)).toBe(33);
    expect(percentSaved(590, 425)).toBe(28);
  });

  it('is zero when there is no saving', () => {
    expect(percentSaved(300, 300)).toBe(0);
    expect(percentSaved(300, 350)).toBe(0);
    expect(percentSaved(0, 100)).toBe(0);
  });
});
