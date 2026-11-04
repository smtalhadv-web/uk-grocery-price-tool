/**
 * Deterministic sample data so the app runs with no database and no network
 * (`DATA_SOURCE=fixtures`). The shapes are identical to what the Postgres
 * adapter returns, so the UI cannot tell the difference.
 *
 * These are plausible figures, not observed ones. Every screen that renders
 * them also renders its observation timestamp, so nothing here can be mistaken
 * for a real price in production: production runs with DATA_SOURCE=db.
 */

import type { DailyPrice, Product, StorePrice, StoreSlug } from '@/lib/types';
import { SEED_PRODUCTS, STORES, type SeedProduct } from './catalogue';

const HISTORY_DAYS = 120;

/** Small deterministic PRNG so fixtures are stable across runs and machines. */
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

/** Each store sits slightly above or below the national baseline. */
const STORE_FACTOR: Record<StoreSlug, number> = {
  asda: 0.94,
  morrisons: 0.98,
  tesco: 1.02,
  sainsburys: 1.06,
};

/** Only these stores publish a lower price to loyalty members. */
const LOYALTY_DISCOUNT: Partial<Record<StoreSlug, number>> = {
  tesco: 0.78,
  sainsburys: 0.82,
  morrisons: 0.88,
};

function roundToRetailPrice(pence: number): number {
  // Retailers land on .00, .25, .45, .49, .50, .75, .95, .99 far more often than random pence.
  const endings = [0, 5, 9, 15, 19, 25, 29, 35, 39, 45, 49, 50, 55, 59, 65, 69, 75, 79, 85, 89, 95, 99];
  const pounds = Math.floor(pence / 100);
  const rest = pence % 100;
  let best = endings[0] ?? 0;
  for (const ending of endings) {
    if (Math.abs(ending - rest) < Math.abs(best - rest)) best = ending;
  }
  return Math.max(5, pounds * 100 + best);
}

function dayString(offsetFromToday: number): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - offsetFromToday);
  return d.toISOString().slice(0, 10);
}

interface Series {
  /** Oldest first, length HISTORY_DAYS, index 0 = HISTORY_DAYS-1 days ago. */
  shelf: number[];
  /** Active promotion window at the end of the series, if any. */
  promo: { startIndex: number; endIndex: number; depth: number } | null;
}

/**
 * Builds one store's shelf-price series: a slow drift plus occasional
 * promotion windows, so "typical" and "lowest seen" have something to chew on.
 */
function buildSeries(product: SeedProduct, store: StoreSlug): Series {
  const random = rng(product.id * 7919 + store.length * 104729 + store.charCodeAt(0) * 31);
  const base = product.basePence * (STORE_FACTOR[store] ?? 1);

  const shelf: number[] = [];
  let drift = 1;
  for (let i = 0; i < HISTORY_DAYS; i += 1) {
    // Gentle inflationary drift with small noise, resampled every ~10 days.
    if (i % 10 === 0) drift = 0.97 + random() * 0.08;
    shelf.push(roundToRetailPrice(base * drift));
  }

  // Zero to three promotion windows across the series.
  const promoCount = Math.floor(random() * 3);
  let active: Series['promo'] = null;
  for (let p = 0; p < promoCount; p += 1) {
    const length = 5 + Math.floor(random() * 10);
    const start = Math.floor(random() * (HISTORY_DAYS - length));
    const depth = 0.65 + random() * 0.2;
    for (let i = start; i < start + length; i += 1) {
      const current = shelf[i];
      if (current !== undefined) shelf[i] = roundToRetailPrice(current * depth);
    }
    if (start + length >= HISTORY_DAYS - 1) {
      active = { startIndex: start, endIndex: start + length - 1, depth };
    }
  }

  // Give roughly a third of products a promotion that is live today, so the
  // deals feed has something to show in fixture mode.
  if (!active && random() < 0.34) {
    const length = 4 + Math.floor(random() * 8);
    const start = HISTORY_DAYS - length;
    const depth = 0.68 + random() * 0.17;
    for (let i = start; i < HISTORY_DAYS; i += 1) {
      const current = shelf[i];
      if (current !== undefined) shelf[i] = roundToRetailPrice(current * depth);
    }
    active = { startIndex: start, endIndex: HISTORY_DAYS - 1, depth };
  }

  return { shelf, promo: active };
}

interface Built {
  products: Product[];
  pricesByProduct: Map<number, StorePrice[]>;
  historyByProduct: Map<number, DailyPrice[]>;
}

function build(): Built {
  const products: Product[] = [];
  const pricesByProduct = new Map<number, StorePrice[]>();
  const historyByProduct = new Map<number, DailyPrice[]>();
  const observedAt = (() => {
    const d = new Date();
    d.setUTCHours(4, 10, 0, 0);
    return d.toISOString();
  })();

  for (const seed of SEED_PRODUCTS) {
    products.push({
      id: seed.id,
      ean: seed.ean,
      name: seed.name,
      brand: seed.brand,
      packLabel: seed.packLabel,
      packQty: seed.packQty,
      packUnit: seed.packUnit,
      category: seed.category,
    });

    const prices: StorePrice[] = [];
    const history: DailyPrice[] = [];

    for (const store of STORES) {
      const slug = store.slug;
      const series = buildSeries(seed, slug);
      const loyaltyFactor = LOYALTY_DISCOUNT[slug];
      const random = rng(seed.id * 31 + slug.charCodeAt(1) * 17);

      // Not every product carries a loyalty price, even at a store that runs one.
      const hasLoyalty = loyaltyFactor !== undefined && random() < 0.45;

      for (let i = 0; i < HISTORY_DAYS; i += 1) {
        const shelfPence = series.shelf[i];
        if (shelfPence === undefined) continue;
        history.push({
          day: dayString(HISTORY_DAYS - 1 - i),
          storeSlug: slug,
          shelfPence,
          loyaltyPence: hasLoyalty ? roundToRetailPrice(shelfPence * (loyaltyFactor ?? 1)) : null,
        });
      }

      const todayShelf = series.shelf[HISTORY_DAYS - 1];
      if (todayShelf === undefined) continue;

      const promoLive = series.promo !== null && series.promo.endIndex >= HISTORY_DAYS - 1;
      const loyaltyPence = hasLoyalty
        ? roundToRetailPrice(todayShelf * (loyaltyFactor ?? 1))
        : null;

      // Some retailers publish an end date, some do not (R2 — never invent one).
      const publishesEndDate = random() < 0.6;
      const daysLeft = 1 + Math.floor(random() * 7);
      const promoStartDay = series.promo
        ? dayString(HISTORY_DAYS - 1 - series.promo.startIndex)
        : null;

      prices.push({
        storeSlug: slug,
        storeSku: `${slug}-${seed.id}`,
        storeUrl: `https://www.${slug === 'sainsburys' ? 'sainsburys' : slug}.co.uk/product/${seed.id}`,
        observedAt,
        shelfPence: todayShelf,
        loyaltyPence,
        offerKind: promoLive
          ? slug === 'asda'
            ? 'rollback'
            : 'shelf_offer'
          : loyaltyPence !== null
            ? 'loyalty'
            : 'shelf',
        offerEndsOn: promoLive && publishesEndDate ? dayString(-daysLeft) : null,
        offerFirstSeenOn: promoLive ? promoStartDay : null,
        inStock: random() > 0.04,
      });
    }

    pricesByProduct.set(seed.id, prices);
    historyByProduct.set(seed.id, history);
  }

  return { products, pricesByProduct, historyByProduct };
}

let cache: Built | null = null;

export function fixtures(): Built {
  cache ??= build();
  return cache;
}
