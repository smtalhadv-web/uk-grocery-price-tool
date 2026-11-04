/**
 * The pricing engine. Every number the product shows is computed here,
 * by arithmetic over observed prices — no model, no heuristic that cannot
 * be read off this page (R1).
 */

import { config } from '../config';
import type { Pence } from '../money';
import type { DailyPrice, PriceBasis, StorePrice, StoreSlug } from '../types';

/**
 * The price a given basis would actually charge.
 * Returns null when the store has no usable price, so the caller must
 * decide what to do rather than silently substituting one (R2).
 */
export function effectivePrice(price: StorePrice, basis: PriceBasis): Pence | null {
  if (!price.inStock) return null;
  if (basis === 'shelf') return price.shelfPence;
  // loyalty_where_available: the loyalty price if the store publishes one, else the shelf price.
  return price.loyaltyPence ?? price.shelfPence;
}

/** Median of a list of pence values. Even counts round down to the lower middle. */
export function median(values: readonly Pence[]): Pence | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[mid] ?? null;
  const lower = sorted[mid - 1];
  const upper = sorted[mid];
  if (lower === undefined || upper === undefined) return null;
  return Math.floor((lower + upper) / 2);
}

/**
 * Typical price = median of the daily minimums over the window.
 * Median, not mean, so a single deep promotion does not drag the baseline down.
 */
export function typicalPrice(
  history: readonly DailyPrice[],
  basis: PriceBasis,
  windowDays = 90,
): Pence | null {
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const values: Pence[] = [];
  for (const row of history) {
    if (row.day < cutoff) continue;
    const value = basis === 'shelf' ? row.shelfPence : (row.loyaltyPence ?? row.shelfPence);
    if (value !== null) values.push(value);
  }
  return median(values);
}

export function lowestSeen(
  history: readonly DailyPrice[],
  basis: PriceBasis,
  windowDays = 90,
): Pence | null {
  const cutoff = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  let lowest: Pence | null = null;
  for (const row of history) {
    if (row.day < cutoff) continue;
    const value = basis === 'shelf' ? row.shelfPence : (row.loyaltyPence ?? row.shelfPence);
    if (value === null) continue;
    if (lowest === null || value < lowest) lowest = value;
  }
  return lowest;
}

/**
 * Good time to buy: today is at least 15% under typical AND within 10% of
 * the cheapest this product has been in the window. A threshold rule over
 * stored prices — explicitly not a prediction.
 */
export function goodTimeToBuy(args: {
  now: Pence;
  typical: Pence | null;
  lowest: Pence | null;
}): boolean {
  const { now, typical, lowest } = args;
  if (typical === null || lowest === null) return false;
  return now <= typical * 0.85 && now <= lowest * 1.1;
}

export interface StoreTotal {
  storeSlug: StoreSlug;
  /** Sum over the items this store can actually supply. */
  totalPence: Pence;
  itemsPriced: number;
  itemsRequested: number;
  /** Product ids this store could not supply or does not stock. */
  missingProductIds: number[];
  /** Oldest observation feeding this total — drives the staleness label. */
  oldestObservedAt: string | null;
}

export interface BasketLine {
  productId: number;
  qty: number;
  /** Price per store for this line, null where unavailable. */
  byStore: Partial<Record<StoreSlug, Pence | null>>;
  cheapestStore: StoreSlug | null;
  cheapestPence: Pence | null;
}

/**
 * Prices a basket at every store on one basis.
 *
 * A store's total covers only the items it can supply; `itemsPriced` and
 * `missingProductIds` tell the UI what was left out, so a store is never
 * made to look cheap by quietly dropping items (R2).
 */
export function basketTotals(args: {
  lines: readonly { productId: number; qty: number }[];
  pricesByProduct: ReadonlyMap<number, readonly StorePrice[]>;
  stores: readonly StoreSlug[];
  basis: PriceBasis;
}): { totals: StoreTotal[]; lines: BasketLine[] } {
  const { lines, pricesByProduct, stores, basis } = args;

  const totals = new Map<StoreSlug, StoreTotal>(
    stores.map((slug) => [
      slug,
      {
        storeSlug: slug,
        totalPence: 0,
        itemsPriced: 0,
        itemsRequested: lines.length,
        missingProductIds: [],
        oldestObservedAt: null,
      },
    ]),
  );

  const outLines: BasketLine[] = [];

  for (const line of lines) {
    const prices = pricesByProduct.get(line.productId) ?? [];
    const byStore: Partial<Record<StoreSlug, Pence | null>> = {};
    let cheapestStore: StoreSlug | null = null;
    let cheapestPence: Pence | null = null;

    for (const slug of stores) {
      const price = prices.find((candidate) => candidate.storeSlug === slug);
      const value = price ? effectivePrice(price, basis) : null;
      byStore[slug] = value;

      const total = totals.get(slug);
      if (!total) continue;

      if (value === null) {
        total.missingProductIds.push(line.productId);
        continue;
      }

      total.totalPence += value * line.qty;
      total.itemsPriced += 1;
      if (price && (total.oldestObservedAt === null || price.observedAt < total.oldestObservedAt)) {
        total.oldestObservedAt = price.observedAt;
      }

      if (cheapestPence === null || value < cheapestPence) {
        cheapestPence = value;
        cheapestStore = slug;
      }
    }

    outLines.push({ productId: line.productId, qty: line.qty, byStore, cheapestStore, cheapestPence });
  }

  const ordered = [...totals.values()].sort((a, b) => {
    // A store that cannot supply the basket should not win on a short total.
    if (a.itemsPriced !== b.itemsPriced) return b.itemsPriced - a.itemsPriced;
    return a.totalPence - b.totalPence;
  });

  return { totals: ordered, lines: outLines };
}

/** What the basket costs if the shopper buys each item wherever it is cheapest. */
export function splitTotal(lines: readonly BasketLine[]): {
  totalPence: Pence;
  itemsPriced: number;
  storesNeeded: number;
} {
  let totalPence = 0;
  let itemsPriced = 0;
  const stores = new Set<StoreSlug>();

  for (const line of lines) {
    if (line.cheapestPence === null || line.cheapestStore === null) continue;
    totalPence += line.cheapestPence * line.qty;
    itemsPriced += 1;
    stores.add(line.cheapestStore);
  }

  return { totalPence, itemsPriced, storesNeeded: stores.size };
}

/** A price older than the configured window is stale and must be labelled (R2). */
export function isStale(observedAt: string, now = new Date()): boolean {
  const ageMs = now.getTime() - new Date(observedAt).getTime();
  return ageMs > config.staleAfterHours * 60 * 60 * 1000;
}

/**
 * Restock digest trigger: enough days have passed AND there is enough
 * genuinely on offer to be worth an email.
 */
export function shouldSendDigest(args: {
  lastSentAt: string | null;
  reminderDays: number;
  itemsBelowTypical: number;
  minItems?: number;
  now?: Date;
}): boolean {
  const { lastSentAt, reminderDays, itemsBelowTypical, minItems = 3, now = new Date() } = args;
  if (itemsBelowTypical < minItems) return false;
  if (lastSentAt === null) return true;
  const daysSince = (now.getTime() - new Date(lastSentAt).getTime()) / (24 * 60 * 60 * 1000);
  return daysSince >= reminderDays;
}
