import { and, desc, eq, gte, ilike, inArray, or, sql } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import { percentSaved } from '@/lib/money';
import { effectivePrice, typicalPrice } from '@/lib/pricing';
import type {
  DailyPrice,
  Deal,
  OfferKind,
  PackUnit,
  PriceBasis,
  Product,
  StorePrice,
  StoreSlug,
} from '@/lib/types';
import { STORES, storeName } from './catalogue';
import type { Repository } from './repository';

const HISTORY_DAYS = 120;

function historyCutoff(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - HISTORY_DAYS);
  return d.toISOString().slice(0, 10);
}

export class PostgresRepository implements Repository {
  async listStores() {
    const rows = await db().select().from(schema.stores).where(eq(schema.stores.active, true));
    if (rows.length === 0) return STORES;
    return rows.map((row) => ({
      id: row.id,
      slug: row.slug as StoreSlug,
      name: row.name,
      loyaltyScheme: row.loyaltyScheme,
    }));
  }

  async getProduct(id: number): Promise<Product | null> {
    const [row] = await db()
      .select()
      .from(schema.products)
      .where(eq(schema.products.id, id))
      .limit(1);
    return row ? toProduct(row) : null;
  }

  async listProducts(opts: { query?: string; limit?: number } = {}): Promise<Product[]> {
    const { query, limit = 100 } = opts;
    const base = db().select().from(schema.products);
    const rows = query?.trim()
      ? await base
          .where(
            or(
              ilike(schema.products.canonicalName, `%${query.trim()}%`),
              ilike(schema.products.brand, `%${query.trim()}%`),
            ),
          )
          .limit(limit)
      : await base.limit(limit);
    return rows.map(toProduct);
  }

  async getPrices(productId: number): Promise<StorePrice[]> {
    const map = await this.getPricesForProducts([productId]);
    return map.get(productId) ?? [];
  }

  /**
   * Latest observation per store_product for the requested products.
   * DISTINCT ON keeps this one round trip rather than N queries.
   */
  async getPricesForProducts(
    productIds: readonly number[],
  ): Promise<Map<number, StorePrice[]>> {
    const out = new Map<number, StorePrice[]>();
    if (productIds.length === 0) return out;
    for (const id of productIds) out.set(id, []);

    const rows = await db().execute<{
      product_id: number;
      slug: string;
      store_sku: string;
      store_url: string;
      observed_at: string;
      shelf_pence: number | null;
      loyalty_pence: number | null;
      offer_kind: string;
      offer_ends_on: string | null;
      offer_first_seen_on: string | null;
      in_stock: boolean;
    }>(sql`
      SELECT DISTINCT ON (sp.id)
        sp.product_id,
        s.slug,
        sp.store_sku,
        sp.store_url,
        po.observed_at,
        po.shelf_pence,
        po.loyalty_pence,
        po.offer_kind,
        po.offer_ends_on,
        po.offer_first_seen_on,
        po.in_stock
      FROM store_products sp
      JOIN stores s ON s.id = sp.store_id
      JOIN price_observations po ON po.store_product_id = sp.id
      WHERE sp.product_id IN ${sql.raw(`(${productIds.join(',')})`)}
      ORDER BY sp.id, po.observed_at DESC
    `);

    for (const row of rows) {
      const list = out.get(row.product_id);
      if (!list) continue;
      list.push({
        storeSlug: row.slug as StoreSlug,
        storeSku: row.store_sku,
        storeUrl: row.store_url,
        observedAt: new Date(row.observed_at).toISOString(),
        shelfPence: row.shelf_pence,
        loyaltyPence: row.loyalty_pence,
        offerKind: row.offer_kind as OfferKind,
        offerEndsOn: row.offer_ends_on,
        offerFirstSeenOn: row.offer_first_seen_on,
        inStock: row.in_stock,
      });
    }

    return out;
  }

  async getHistory(productId: number, storeSlug?: StoreSlug): Promise<DailyPrice[]> {
    const conditions = [
      eq(schema.storeProducts.productId, productId),
      gte(schema.priceDaily.day, historyCutoff()),
    ];
    if (storeSlug) conditions.push(eq(schema.stores.slug, storeSlug));

    const rows = await db()
      .select({
        day: schema.priceDaily.day,
        slug: schema.stores.slug,
        shelf: schema.priceDaily.shelfMinPence,
        loyalty: schema.priceDaily.loyaltyMinPence,
      })
      .from(schema.priceDaily)
      .innerJoin(
        schema.storeProducts,
        eq(schema.storeProducts.id, schema.priceDaily.storeProductId),
      )
      .innerJoin(schema.stores, eq(schema.stores.id, schema.storeProducts.storeId))
      .where(and(...conditions))
      .orderBy(schema.priceDaily.day);

    return rows.map((row) => ({
      day: row.day,
      storeSlug: row.slug as StoreSlug,
      shelfPence: row.shelf,
      loyaltyPence: row.loyalty,
    }));
  }

  /**
   * Deals are computed, never stored: today's effective price against the
   * product's own 90-day typical price at that store.
   */
  async listDeals(opts: {
    basis: PriceBasis;
    limit?: number;
    store?: StoreSlug;
  }): Promise<Deal[]> {
    const { basis, limit = 24, store } = opts;

    // Candidates: anything whose latest price is under its 30-day average, so
    // we only pull history for plausible deals rather than the whole catalogue.
    const candidates = await db().execute<{ product_id: number }>(sql`
      SELECT DISTINCT sp.product_id
      FROM store_products sp
      JOIN stores s ON s.id = sp.store_id
      JOIN price_daily pd ON pd.store_product_id = sp.id
      WHERE pd.day >= ${historyCutoff()}
        ${store ? sql`AND s.slug = ${store}` : sql``}
      LIMIT 500
    `);

    const productIds = candidates.map((row) => row.product_id);
    if (productIds.length === 0) return [];

    const [products, priceMap] = await Promise.all([
      db().select().from(schema.products).where(inArray(schema.products.id, productIds)),
      this.getPricesForProducts(productIds),
    ]);

    const deals: Deal[] = [];
    for (const row of products) {
      const product = toProduct(row);
      const prices = priceMap.get(product.id) ?? [];
      const history = await this.getHistory(product.id);

      for (const price of prices) {
        if (store && price.storeSlug !== store) continue;
        const now = effectivePrice(price, basis);
        if (now === null) continue;

        const typical = typicalPrice(
          history.filter((h) => h.storeSlug === price.storeSlug),
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
    const [row] = await db()
      .select({ at: schema.priceObservations.observedAt })
      .from(schema.priceObservations)
      .orderBy(desc(schema.priceObservations.observedAt))
      .limit(1);
    return row?.at ? new Date(row.at).toISOString() : null;
  }
}

function toProduct(row: typeof schema.products.$inferSelect): Product {
  return {
    id: row.id,
    ean: row.ean,
    name: row.canonicalName,
    brand: row.brand,
    packLabel: row.packLabel,
    packQty: row.packQty,
    packUnit: row.packUnit as PackUnit | null,
    category: row.category,
  };
}
