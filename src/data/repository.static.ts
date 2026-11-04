import { percentSaved } from '@/lib/money';
import { effectivePrice, typicalPrice } from '@/lib/pricing';
import type {
  DailyPrice,
  Deal,
  PriceBasis,
  Product,
  StorePrice,
  StoreSlug,
} from '@/lib/types';
import { STORES, storeName } from './catalogue';
import { readHistory, readMeta, readPrices, readProducts } from './json-store';
import type { Repository } from './repository';

/**
 * Reads the committed JSON dataset. This is what the production build uses:
 * every page is rendered at build time from these files, so the deployed site
 * is pure static output with no server behind it.
 */
export class StaticRepository implements Repository {
  private productsCache: Product[] | null = null;
  private pricesCache: Record<string, StorePrice[]> | null = null;

  private async products(): Promise<Product[]> {
    this.productsCache ??= await readProducts();
    return this.productsCache;
  }

  private async prices(): Promise<Record<string, StorePrice[]>> {
    this.pricesCache ??= await readPrices();
    return this.pricesCache;
  }

  async listStores() {
    return STORES;
  }

  async getProduct(id: number): Promise<Product | null> {
    return (await this.products()).find((product) => product.id === id) ?? null;
  }

  async listProducts(opts: { query?: string; limit?: number } = {}): Promise<Product[]> {
    const { query, limit = 100 } = opts;
    let rows = await this.products();
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

  async getPrices(productId: number): Promise<StorePrice[]> {
    return (await this.prices())[String(productId)] ?? [];
  }

  async getPricesForProducts(
    productIds: readonly number[],
  ): Promise<Map<number, StorePrice[]>> {
    const all = await this.prices();
    const out = new Map<number, StorePrice[]>();
    for (const id of productIds) out.set(id, all[String(id)] ?? []);
    return out;
  }

  async getHistory(productId: number, storeSlug?: StoreSlug): Promise<DailyPrice[]> {
    const rows = await readHistory(productId);
    return storeSlug ? rows.filter((row) => row.storeSlug === storeSlug) : rows;
  }

  async listDeals(opts: {
    basis: PriceBasis;
    limit?: number;
    store?: StoreSlug;
  }): Promise<Deal[]> {
    const { basis, limit = 24, store } = opts;
    const products = await this.products();
    const prices = await this.prices();
    const deals: Deal[] = [];

    for (const product of products) {
      const rows = prices[String(product.id)] ?? [];
      if (rows.length === 0) continue;

      const history = await readHistory(product.id);

      for (const price of rows) {
        if (store && price.storeSlug !== store) continue;
        // A multibuy is a bundle price, never a per-unit saving (R2).
        if (price.offerKind === 'multibuy') continue;

        const now = effectivePrice(price, basis);
        if (now === null) continue;

        const typical = typicalPrice(
          history.filter((row) => row.storeSlug === price.storeSlug),
          basis,
        );
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

  async lastRefreshAt(): Promise<string | null> {
    return (await readMeta())?.generatedAt ?? null;
  }
}
