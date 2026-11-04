import type { PackUnit } from '@/lib/types';

/**
 * Pack size parsing. Retailers write the same pack a dozen ways, and a wrong
 * pack size produces a wrong unit price, so this returns null rather than
 * guessing when it cannot read the label (R2).
 */

const MULTIPLIERS: Record<string, { factor: number; unit: PackUnit }> = {
  kg: { factor: 1000, unit: 'g' },
  g: { factor: 1, unit: 'g' },
  l: { factor: 1000, unit: 'ml' },
  litre: { factor: 1000, unit: 'ml' },
  litres: { factor: 1000, unit: 'ml' },
  ltr: { factor: 1000, unit: 'ml' },
  cl: { factor: 10, unit: 'ml' },
  ml: { factor: 1, unit: 'ml' },
};

const COUNT_WORDS = /(\d+)\s*(?:x\s*)?(?:pack|pk|bags|rolls|sheets|wipes|washes|capsules|tablets|sachets|pieces|cans|bottles|eggs)\b/i;

export interface PackSize {
  qty: number;
  unit: PackUnit;
  label: string;
}

/**
 * "4 x 415g" → 1660g · "2 litres" → 2000ml · "12 pack" → 12 items.
 * Returns null when the label carries no usable size.
 */
export function parsePackSize(label: string): PackSize | null {
  const text = label.trim().toLowerCase();
  if (!text) return null;

  // "4 x 415g", "6x330ml"
  const multi = /(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(kg|g|ltr|litres|litre|l|cl|ml)\b/.exec(text);
  if (multi?.[1] && multi[2] && multi[3]) {
    const mult = MULTIPLIERS[multi[3]];
    if (mult) {
      return {
        qty: Math.round(Number(multi[1]) * Number(multi[2]) * mult.factor),
        unit: mult.unit,
        label: label.trim(),
      };
    }
  }

  // "415g", "2 litres", "1.5kg"
  const single = /(\d+(?:\.\d+)?)\s*(kg|g|ltr|litres|litre|l|cl|ml)\b/.exec(text);
  if (single?.[1] && single[2]) {
    const mult = MULTIPLIERS[single[2]];
    if (mult) {
      return {
        qty: Math.round(Number(single[1]) * mult.factor),
        unit: mult.unit,
        label: label.trim(),
      };
    }
  }

  // "12 pack", "9 rolls", "38 washes"
  const counted = COUNT_WORDS.exec(text);
  if (counted?.[1]) {
    return { qty: Number(counted[1]), unit: 'item', label: label.trim() };
  }

  // Bare "x6" / "6 x"
  const bareMulti = /\b(\d+)\s*x\b/.exec(text);
  if (bareMulti?.[1]) {
    return { qty: Number(bareMulti[1]), unit: 'item', label: label.trim() };
  }

  return null;
}

/**
 * Strips the pack size and marketing noise from a retailer title so two
 * retailers' titles for the same product come out comparable.
 */
export function normaliseTitle(title: string): string {
  return title
    .toLowerCase()
    .replace(/[‘’'`]/g, '')
    // Multipacks first: stripping the unit on its own would leave a bare "4 x".
    .replace(/\b\d+(?:\.\d+)?\s*x\s*\d+(?:\.\d+)?\s*(?:kg|g|ltr|litres|litre|l|cl|ml)\b/g, ' ')
    .replace(/\b\d+(?:\.\d+)?\s*(?:kg|g|ltr|litres|litre|l|cl|ml)\b/g, ' ')
    .replace(new RegExp(COUNT_WORDS.source, 'gi'), ' ')
    .replace(/\b\d+\s*x\b/g, ' ')
    .replace(/\b(?:new|offer|special|save|only|pm|price marked|multipack|value)\b/g, ' ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * UK EANs are 8 or 13 digits. Anything else is not a barcode we can match on,
 * and a wrong EAN links two different products, so this is strict.
 */
export function normaliseEan(value: string | null | undefined): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, '');
  if (digits.length === 13 || digits.length === 8) return digits;
  // Some feeds pad a 12-digit UPC; a leading zero makes it a valid EAN-13.
  if (digits.length === 12) return `0${digits}`;
  return null;
}

/** Retailers express money as a number of pounds, a string, or pence. */
export function toPence(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    // A plain number from a UK grocery feed is pounds.
    return Math.round(value * 100);
  }
  if (typeof value === 'string') {
    const text = value.trim().replace(/[£\s,]/g, '');
    if (!text) return null;
    const penceSuffix = /^(\d{1,3})p$/i.exec(text);
    if (penceSuffix?.[1]) return Number(penceSuffix[1]);
    const num = Number(text);
    if (!Number.isFinite(num)) return null;
    return Math.round(num * 100);
  }
  return null;
}

/** Retailers write dates several ways; anything unparseable returns null (R2). */
export function toIsoDate(value: unknown): string | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  const text = value.trim();

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const uk = /^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/.exec(text);
  if (uk?.[1] && uk[2] && uk[3]) {
    return `${uk[3]}-${uk[2].padStart(2, '0')}-${uk[1].padStart(2, '0')}`;
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
  return null;
}
