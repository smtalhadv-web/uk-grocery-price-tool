/**
 * The read API the UI uses. Two implementations behind one interface:
 * fixtures (no DB, no network) and Postgres. Pages never know which.
 */

import { config } from '@/lib/config';
import { percentSaved } from '@/lib/money';
import { effectivePrice, typicalPrice } from '@/lib/pricing';
import type {
  Deal,
  DailyPrice,
  PriceBasis,
  Product,
  StorePrice,
  StoreSlug,
} from '@/lib/types';
import { STORES, storeName } from './catalogue';
import { fixtures } from './fixtures';

export interface Repository {
  listStores(): Promise<typeof STORES>;
  getProduct(id: number): Promise<Product | null>;
  listProducts(opts?: { query?: string; limit?: number }): Promise<Product[]>;
  getPrices(productId: number): Promise<StorePrice[]>;
  getPricesForProducts(productIds: readonly number[]): Promise<Map<number, StorePrice[]>>;
  getHistory(productId: number, storeSlug?: StoreSlug): Promise<DailyPrice[]>;
  listDeals(opts: { basis: PriceBasis; limit?: number; store?: StoreSlug }): Promise<Deal[]>;
  lastRefreshAt(): Promise<string | null>;
}

/* ------------------------------------------------------------- fixtures impl */

class FixtureRepository implements Repository {
  async listStores() {
    return STORES;
  }

  async getProduct(id: number) {
    return fixtures().products.find((product) => product.id === id) ?? null;
  }

  async listProducts(opts: { query?: string; limit?: number } = {}) {
    const { query, limit = 100 } = opts;
    let rows = fixtures().products;
    if (query?.trim()) {
      const needle = query.trim().toLowerCase();
      rows = rows.filter((product) =>
        `${product.brand ?? ''} ${product.name} ${product.packLabel}`
          .toLowerCase()
          .includes(needle),
      );
    }
    return rows.slice(0, limit);
  }

  async getPrices(productId: number) {
    return fixtures().pricesByProduct.get(productId) ?? [];
  }

  async getPricesForProducts(productIds: readonly number[]) {
    const out = new Map<number, StorePrice[]>();
    for (const id of productIds) {
      out.set(id, fixtures().pricesByProduct.get(id) ?? []);
    }
    return out;
  }

  async getHistory(productId: number, storeSlug?: StoreSlug) {
    const rows = fixtures().historyByProduct.get(productId) ?? [];
    return storeSlug ? rows.filter((row) => row.storeSlug === storeSlug) : rows;
  }

  async listDeals(opts: { basis: PriceBasis; limit?: number; store?: StoreSlug }) {
    const { basis, limit = 24, store } = opts;
    const data = fixtures();
    const deals: Deal[] = [];

    for (const product of data.products) {
      const prices = data.pricesByProduct.get(product.id) ?? [];
      const history = data.historyByProduct.get(product.id) ?? [];

      for (const price of prices) {
        if (store && price.storeSlug !== store) continue;
        const now = effectivePrice(price, basis);
        if (now === null) continue;

        const storeHistory = history.filter((row) => row.storeSlug === price.storeSlug);
        const typical = typicalPrice(storeHistory, basis);
        if (typical === null) continue;

        const percent = percentSaved(typical, now);
        if (percent < 10) continue;

        deals.push({
          product,
          storeSlug: price.storeSlug,
          storeName: storeName(price.storeSlug),
          nowPence: now,
          typicalPence: typical,
          percent,
          offerKind: price.offerKind,
          offerEndsOn: price.offerEndsOn,
          offerFirstSeenOn: price.offerFirstSeenOn,
          observedAt: price.observedAt,
        });
      }
    }

    return deals.sort((a, b) => b.percent - a.percent).slice(0, limit);
  }

  async lastRefreshAt() {
    const first = fixtures().pricesByProduct.values().next().value as StorePrice[] | undefined;
    return first?.[0]?.observedAt ?? null;
  }
}

/* ------------------------------------------------------------ postgres impl */

/**
 * Loaded lazily so `DATA_SOURCE=fixtures` never imports the driver and the
 * app boots with no DATABASE_URL at all.
 */
async function postgresRepository(): Promise<Repository> {
  const { PostgresRepository } = await import('./repository.postgres');
  return new PostgresRepository();
}

/**
 * Reads the committed JSON dataset. Falls back to fixtures when no dataset
 * has been generated yet, so a fresh clone still runs — and the Data page
 * says which of the two is in use, so sample prices are never mistaken for
 * real ones (R2).
 */
async function staticRepository(): Promise<Repository> {
  const { datasetExists } = await import('./json-store');
  if (!datasetExists()) return new FixtureRepository();
  const { StaticRepository } = await import('./repository.static');
  return new StaticRepository();
}

let instance: Repository | null = null;

export async function repo(): Promise<Repository> {
  if (instance) return instance;
  if (config.dataSource === 'db') instance = await postgresRepository();
  else if (config.dataSource === 'fixtures') instance = new FixtureRepository();
  else instance = await staticRepository();
  return instance;
}
