/**
 * Money is always integer pence (R4). Floats never touch a price.
 * Formatting to a string happens only here, at the edge.
 */

export type Pence = number;

export function isPence(value: unknown): value is Pence {
  return typeof value === 'number' && Number.isInteger(value) && Number.isFinite(value);
}

export function assertPence(value: number, label = 'value'): Pence {
  if (!Number.isInteger(value)) {
    throw new Error(`${label} must be integer pence, got ${value}`);
  }
  return value;
}

/** "£1.45", "1.45", "£2", "45p" → 145, 145, 200, 45. Returns null if unparseable. */
export function parsePriceToPence(input: string): Pence | null {
  const text = input.trim().replace(/\s+/g, '');
  if (!text) return null;

  const penceOnly = /^(\d{1,3})p$/i.exec(text);
  if (penceOnly?.[1]) return Number(penceOnly[1]);

  const pounds = /^£?(\d+)(?:\.(\d{1,2}))?$/.exec(text);
  if (!pounds?.[1]) return null;

  const whole = Number(pounds[1]);
  const fractionText = (pounds[2] ?? '').padEnd(2, '0');
  return whole * 100 + Number(fractionText);
}

/** 145 → "£1.45". Values under £1 still render as pounds for column alignment. */
export function formatPence(value: Pence | null | undefined): string {
  if (value === null || value === undefined) return '—';
  const negative = value < 0;
  const abs = Math.abs(value);
  const text = `£${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
  return negative ? `−${text}` : text;
}

/** Signed difference for deltas: 325 → "+£3.25", -120 → "−£1.20", 0 → "same". */
export function formatDelta(value: Pence): string {
  if (value === 0) return 'same';
  return value > 0 ? `+${formatPence(value)}` : formatPence(value);
}

export function sumPence(values: readonly Pence[]): Pence {
  return values.reduce<Pence>((total, value) => total + value, 0);
}

/**
 * Unit price in pence per 100g / 100ml / item, rounded to one decimal for display.
 * Returns null when the pack size is unknown rather than guessing (R2).
 */
export function unitPrice(
  price: Pence,
  packQty: number | null,
  packUnit: 'g' | 'ml' | 'item' | null,
): { text: string; perHundred: number } | null {
  if (!packQty || packQty <= 0 || !packUnit) return null;

  if (packUnit === 'item') {
    const each = price / packQty;
    return { text: `${formatPence(Math.round(each))} each`, perHundred: each };
  }

  const perHundred = (price / packQty) * 100;
  const rounded = Math.round(perHundred * 10) / 10;
  return { text: `${rounded}p / 100${packUnit}`, perHundred };
}

/** Whole-number percent saved, e.g. typical 450, now 300 → 33. */
export function percentSaved(typical: Pence, now: Pence): number {
  if (typical <= 0 || now >= typical) return 0;
  return Math.round(((typical - now) / typical) * 100);
}
