/**
 * The database-free ingest path: scrape, match against the catalogue in code,
 * and write the published JSON dataset.
 *
 * There is no Postgres in the GitHub Pages setup, so the catalogue lives in
 * `src/data/catalogue.ts` and the price history lives in committed files. The
 * matching rules and the pricing arithmetic are the same ones the Postgres
 * path uses — only the storage differs.
 */

import { SEED_PRODUCTS } from '@/data/catalogue';
import {
  appendHistory,
  readPrices,
  writeMeta,
  writePrices,
  writeProducts,
  writeUnmatched,
} from '@/data/json-store';
import type { DatasetRun, PricesFile } from '@/data/dataset';
import type { Product, StorePrice, StoreSlug } from '@/lib/types';
import { matchProduct, type MatchCandidate } from './match';
import type { NormalisedProduct } from './types';

export function catalogueProducts(): Product[] {
  return SEED_PRODUCTS.map((seed) => ({
    id: seed.id,
    ean: seed.ean,
    name: seed.name,
    brand: seed.brand,
    packLabel: seed.packLabel,
    packQty: seed.packQty,
    packUnit: seed.packUnit,
    category: seed.category,
  }));
}

export function catalogueCandidates(): MatchCandidate[] {
  return SEED_PRODUCTS.map((seed) => ({
    productId: seed.id,
    ean: seed.ean,
    name: seed.name,
    brand: seed.brand,
    packQty: seed.packQty,
    packUnit: seed.packUnit,
  }));
}

export function catalogueTerms(): string[] {
  return SEED_PRODUCTS.map((seed) => (seed.brand ? `${seed.brand} ${seed.name}` : seed.name));
}

export interface UnmatchedRow {
  storeSlug: StoreSlug;
  title: string;
  /** The best score it managed against the catalogue, below the floor. */
  bestScore: number;
  packLabel: string;
}

export interface MatchOutcome {
  /** productId → the price to publish for that product at this store. */
  matched: Map<number, StorePrice>;
  matchedCount: number;
  unmatchedCount: number;
  /** The near misses, kept so a low match rate can be diagnosed (R5). */
  unmatched: UnmatchedRow[];
}

/**
 * Matches one retailer's scraped products to the catalogue.
 *
 * Where a retailer returns several candidates for one catalogue entry — a
 * search for "Heinz Baked Beans" returns a dozen — the cheapest in-stock one
 * wins, because that is the price a shopper buying that item would pay.
 */
export function matchToCatalogue(products: readonly NormalisedProduct[]): MatchOutcome {
  const candidates = catalogueCandidates();
  const best = new Map<number, { price: StorePrice; effective: number }>();
  const unmatched: UnmatchedRow[] = [];
  let unmatchedCount = 0;

  for (const item of products) {
    // A multibuy carries no usable single-unit price, so it never becomes one.
    if (item.offerKind === 'multibuy' && item.shelfPence === null) {
      continue;
    }

    const match = matchProduct(
      {
        ean: item.ean,
        title: item.title,
        brand: item.brand,
        packQty: item.packQty,
        packUnit: item.packUnit,
      },
      candidates,
    );

    if (match.productId === null) {
      unmatchedCount += 1;
      // Keep the near misses. A low match rate is otherwise invisible: you
      // can see that 13 of 40 matched, but not why the other 27 did not.
      if (match.score > 0.4) {
        unmatched.push({
          storeSlug: item.storeSlug,
          title: item.title,
          bestScore: Math.round(match.score * 100) / 100,
          packLabel: item.packLabel,
        });
      }
      continue;
    }

    const price: StorePrice = {
      storeSlug: item.storeSlug,
      storeSku: item.storeSku,
      storeUrl: item.storeUrl,
      observedAt: new Date().toISOString(),
      shelfPence: item.shelfPence,
      loyaltyPence: item.loyaltyPence,
      offerKind: item.offerKind,
      offerEndsOn: item.offerEndsOn,
      offerFirstSeenOn: null, // filled in by mergeStorePrices, which can see yesterday
      inStock: item.inStock,
    };

    const effective = item.loyaltyPence ?? item.shelfPence;
    if (effective === null) continue;

    const current = best.get(match.productId);
    if (!current || effective < current.effective) {
      best.set(match.productId, { price, effective });
    }
  }

  unmatched.sort((a, b) => b.bestScore - a.bestScore);

  return {
    matched: new Map([...best].map(([id, entry]) => [id, entry.price])),
    matchedCount: best.size,
    unmatchedCount,
    unmatched: unmatched.slice(0, 60),
  };
}

/**
 * Merges this run's prices into the published set.
 *
 * Two things are carried forward deliberately:
 *
 * - **Other retailers' prices.** A run for one store must not wipe the rest.
 * - **`offerFirstSeenOn`.** Most retailers publish no offer end date, so how
 *   long we have been seeing an offer is all the UI can honestly show. It has
 *   to survive across runs or it resets to today every morning (R2).
 */
export function mergeStorePrices(
  existing: PricesFile,
  slug: StoreSlug,
  incoming: ReadonlyMap<number, StorePrice>,
): PricesFile {
  const today = new Date().toISOString().slice(0, 10);
  const out: PricesFile = {};

  const productIds = new Set<number>([
    ...Object.keys(existing).map(Number),
    ...incoming.keys(),
  ]);

  for (const productId of productIds) {
    const previousRows = existing[String(productId)] ?? [];
    const others = previousRows.filter((row) => row.storeSlug !== slug);
    const fresh = incoming.get(productId);

    if (!fresh) {
      // Nothing new for this product at this store: keep what we had, so the
      // UI can show it as stale rather than silently losing it.
      out[String(productId)] = previousRows;
      continue;
    }

    const previousHere = previousRows.find((row) => row.storeSlug === slug);
    const wasOnOffer = previousHere !== undefined && previousHere.offerKind !== 'shelf';
    const isOnOffer = fresh.offerKind !== 'shelf';

    const offerFirstSeenOn = isOnOffer
      ? wasOnOffer
        ? (previousHere?.offerFirstSeenOn ?? today)
        : today
      : null;

    out[String(productId)] = [...others, { ...fresh, offerFirstSeenOn }];
  }

  return out;
}

export interface PublishResult {
  runs: DatasetRun[];
  productCount: number;
}

/** Writes the whole dataset after a run. */
export async function publishDataset(args: {
  pricesBySlug: ReadonlyMap<StoreSlug, ReadonlyMap<number, StorePrice>>;
  runs: readonly DatasetRun[];
  unmatched?: readonly UnmatchedRow[];
}): Promise<PublishResult> {
  const { pricesBySlug, runs, unmatched = [] } = args;

  const products = catalogueProducts();
  await writeProducts(products);

  let prices = await readPrices();
  for (const [slug, incoming] of pricesBySlug) {
    prices = mergeStorePrices(prices, slug, incoming);
  }
  await writePrices(prices);

  for (const product of products) {
    const rows = prices[String(product.id)] ?? [];
    if (rows.length > 0) await appendHistory(product.id, rows);
  }

  await writeUnmatched(unmatched);

  await writeMeta({
    generatedAt: new Date().toISOString(),
    runs: [...runs],
    productCount: products.length,
    sample: false,
  });

  return { runs: [...runs], productCount: products.length };
}
