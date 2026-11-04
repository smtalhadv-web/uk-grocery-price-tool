import { parsePriceToPence } from '@/lib/money';

/**
 * Helpers for pulling money out of tile text. Price tiles mix the price, the
 * unit price and promotional copy into one string, so these exist to keep the
 * wrong number out of a basket total.
 */

export interface MoneyToken {
  pence: number;
  /** Text immediately after the amount, used to tell a price from a unit price. */
  trailing: string;
}

/**
 * Money amounts in a tile, excluding unit prices.
 *
 * Two things get dropped: anything inside parentheses, which is where every
 * retailer puts "(£1.78/kg)", and anything immediately followed by "/", which
 * is the same thing written without brackets. What is left is money a shopper
 * actually pays.
 */
export function moneyTokens(text: string): MoneyToken[] {
  const withoutBrackets = text.replace(/\([^)]*\)/g, ' ');
  const out: MoneyToken[] = [];

  for (const match of withoutBrackets.matchAll(/£\s?(\d+(?:\.\d{1,2})?)/g)) {
    const amount = match[1];
    if (amount === undefined || match.index === undefined) continue;

    const after = withoutBrackets.slice(match.index + match[0].length);
    if (after.startsWith('/')) continue; // a unit price, e.g. £1.99/kg

    const pence = parsePriceToPence(`£${amount}`);
    if (pence === null) continue;

    out.push({ pence, trailing: after.slice(0, 40) });
  }

  return out;
}

/** The first money amount in a string, ignoring unit prices. */
export function firstPrice(text: string | null | undefined): number | null {
  if (!text) return null;
  return moneyTokens(text)[0]?.pence ?? null;
}

/**
 * Multibuys ("Any 2 for £7", "Buy 3 for £4") are not a unit price. Recording
 * one as the price would understate a basket for anyone buying a single item,
 * so they are detected and kept out of the price fields (R2).
 */
export function isMultibuy(text: string): boolean {
  return /\b(?:any|buy)\s*\d+\s*for\s*£|\b\d+\s*for\s*£/i.test(text);
}

/** "27/10/2026" or "until 23/11/2026" → "2026-11-23". Null when absent (R2). */
export function offerEndDate(text: string): string | null {
  const match = /until\s+(\d{1,2})\/(\d{1,2})\/(\d{4})/i.exec(text);
  if (!match?.[1] || !match[2] || !match[3]) return null;
  const day = match[1].padStart(2, '0');
  const month = match[2].padStart(2, '0');
  return `${match[3]}-${month}-${day}`;
}
