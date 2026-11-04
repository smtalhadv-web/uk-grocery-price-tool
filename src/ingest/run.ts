import { and, eq, sql } from 'drizzle-orm';
import { db, schema } from '@/db/client';
import type { StoreSlug } from '@/lib/types';
import { adapterFor } from './adapters';
import { matchProduct, type MatchCandidate } from './match';
import type { NormalisedProduct } from './types';
import { AdapterBlockedError } from './types';

export interface RunReport {
  storeSlug: StoreSlug;
  fetched: number;
  parsed: number;
  matched: number;
  unmatched: number;
  failed: number;
  status: 'ok' | 'partial' | 'failed';
  note: string | null;
}

/** Search terms come from the catalogue itself, so we only fetch what we track. */
async function searchTerms(): Promise<string[]> {
  const rows = await db()
    .select({ brand: schema.products.brand, name: schema.products.canonicalName })
    .from(schema.products);
  return rows.map((row) => (row.brand ? `${row.brand} ${row.name}` : row.name));
}

async function candidates(): Promise<MatchCandidate[]> {
  const rows = await db().select().from(schema.products);
  return rows.map((row) => ({
    productId: row.id,
    ean: row.ean,
    name: row.canonicalName,
    brand: row.brand,
    packQty: row.packQty,
    packUnit: row.packUnit,
  }));
}

async function storeIdFor(slug: StoreSlug): Promise<number> {
  const [row] = await db()
    .select({ id: schema.stores.id })
    .from(schema.stores)
    .where(eq(schema.stores.slug, slug))
    .limit(1);
  if (!row) throw new Error(`Store "${slug}" is not seeded`);
  return row.id;
}

/** Links a retailer SKU to a catalogue product, creating the link on first sight. */
async function upsertStoreProduct(args: {
  storeId: number;
  productId: number;
  item: NormalisedProduct;
  method: 'ean' | 'name';
  score: number;
}): Promise<number> {
  const { storeId, productId, item, method, score } = args;

  const [existing] = await db()
    .select({ id: schema.storeProducts.id })
    .from(schema.storeProducts)
    .where(
      and(
        eq(schema.storeProducts.storeId, storeId),
        eq(schema.storeProducts.storeSku, item.storeSku),
      ),
    )
    .limit(1);

  if (existing) return existing.id;

  const [inserted] = await db()
    .insert(schema.storeProducts)
    .values({
      storeId,
      productId,
      storeSku: item.storeSku,
      storeUrl: item.storeUrl,
      titleAtStore: item.title,
      matchMethod: method,
      matchScore: score,
    })
    .returning({ id: schema.storeProducts.id });

  if (!inserted) throw new Error('Failed to insert store_product');
  return inserted.id;
}

/**
 * Carries an offer's first-seen date forward. When the retailer publishes no
 * end date this is all the UI has to show, so it must not reset every run (R2).
 */
async function offerFirstSeen(
  storeProductId: number,
  hasOffer: boolean,
): Promise<string | null> {
  if (!hasOffer) return null;

  const [previous] = await db()
    .select({
      firstSeen: schema.priceObservations.offerFirstSeenOn,
      kind: schema.priceObservations.offerKind,
    })
    .from(schema.priceObservations)
    .where(eq(schema.priceObservations.storeProductId, storeProductId))
    .orderBy(sql`observed_at DESC`)
    .limit(1);

  const today = new Date().toISOString().slice(0, 10);
  if (!previous) return today;
  const wasOnOffer = previous.kind !== 'shelf';
  return wasOnOffer ? (previous.firstSeen ?? today) : today;
}

async function writeObservation(
  storeProductId: number,
  item: NormalisedProduct,
): Promise<void> {
  const hasOffer = item.offerKind !== 'shelf';
  const firstSeen = await offerFirstSeen(storeProductId, hasOffer);

  await db().insert(schema.priceObservations).values({
    storeProductId,
    shelfPence: item.shelfPence,
    loyaltyPence: item.loyaltyPence,
    offerKind: item.offerKind,
    offerEndsOn: item.offerEndsOn,
    offerFirstSeenOn: firstSeen,
    inStock: item.inStock,
    raw: item.raw as object,
  });

  // Roll today's minimum up so charts never scan the raw table.
  const today = new Date().toISOString().slice(0, 10);
  await db()
    .insert(schema.priceDaily)
    .values({
      storeProductId,
      day: today,
      shelfMinPence: item.shelfPence,
      loyaltyMinPence: item.loyaltyPence,
    })
    .onConflictDoUpdate({
      target: [schema.priceDaily.storeProductId, schema.priceDaily.day],
      set: {
        shelfMinPence: sql`LEAST(${schema.priceDaily.shelfMinPence}, EXCLUDED.shelf_min_pence)`,
        loyaltyMinPence: sql`LEAST(${schema.priceDaily.loyaltyMinPence}, EXCLUDED.loyalty_min_pence)`,
      },
    });
}

export interface PersistCounts {
  matched: number;
  unmatched: number;
  failed: number;
}

/**
 * Matches a batch of normalised products to the catalogue and records their
 * prices. Shared by the HTTP runner and the browser runner, so both go
 * through the same matching rules and the same append-only write path.
 */
export async function persistProducts(args: {
  slug: StoreSlug;
  products: readonly NormalisedProduct[];
}): Promise<PersistCounts> {
  const { slug, products } = args;
  const counts: PersistCounts = { matched: 0, unmatched: 0, failed: 0 };

  const storeId = await storeIdFor(slug);
  const catalogue = await candidates();

  for (const item of products) {
    const match = matchProduct(
      {
        ean: item.ean,
        title: item.title,
        brand: item.brand,
        packQty: item.packQty,
        packUnit: item.packUnit,
      },
      catalogue,
    );

    if (match.productId === null || match.method === null) {
      counts.unmatched += 1;
      await db()
        .insert(schema.unmatched)
        .values({ storeId, storeSku: item.storeSku, title: item.title, bestScore: match.score })
        .onConflictDoNothing();
      continue;
    }

    try {
      const storeProductId = await upsertStoreProduct({
        storeId,
        productId: match.productId,
        item,
        method: match.method,
        score: match.score,
      });
      await writeObservation(storeProductId, item);
      counts.matched += 1;
    } catch {
      counts.failed += 1;
    }
  }

  return counts;
}

/** The search terms a run should cover, taken from the catalogue itself. */
export async function catalogueSearchTerms(): Promise<string[]> {
  return searchTerms();
}

/** Opens a run row and returns its id, so a runner can close it later. */
export async function openRun(slug: StoreSlug): Promise<{ runId: number; storeId: number }> {
  const storeId = await storeIdFor(slug);
  const [run] = await db()
    .insert(schema.runs)
    .values({ storeId, status: 'running' })
    .returning({ id: schema.runs.id });
  if (!run) throw new Error('could not open run');
  return { runId: run.id, storeId };
}

export async function closeRun(runId: number, report: Omit<RunReport, 'storeSlug'>): Promise<void> {
  await db()
    .update(schema.runs)
    .set({
      finishedAt: new Date(),
      fetched: report.fetched,
      parsed: report.parsed,
      matched: report.matched,
      failed: report.failed,
      status: report.status,
      note: report.note,
    })
    .where(eq(schema.runs.id, runId));
}

/**
 * Refreshes one retailer. Never throws for an ordinary failure: the caller
 * runs the others regardless (R7).
 */
export async function refreshStore(slug: StoreSlug): Promise<RunReport> {
  const adapter = adapterFor(slug);
  if (!adapter) {
    return {
      storeSlug: slug,
      fetched: 0,
      parsed: 0,
      matched: 0,
      unmatched: 0,
      failed: 0,
      status: 'failed',
      note: `${slug} has no HTTP adapter — it is refreshed by the browser job.`,
    };
  }

  const report: RunReport = {
    storeSlug: slug,
    fetched: 0,
    parsed: 0,
    matched: 0,
    unmatched: 0,
    failed: 0,
    status: 'ok',
    note: null,
  };

  let storeId: number;
  let runId: number | null = null;

  try {
    storeId = await storeIdFor(slug);
    const [run] = await db()
      .insert(schema.runs)
      .values({ storeId, status: 'running' })
      .returning({ id: schema.runs.id });
    runId = run?.id ?? null;
  } catch (error) {
    report.status = 'failed';
    report.note = error instanceof Error ? error.message : 'could not start run';
    return report;
  }

  const [terms, catalogue] = await Promise.all([searchTerms(), candidates()]);

  for (const term of terms) {
    let rawItems: unknown[] = [];
    try {
      rawItems = await adapter.search(term);
      report.fetched += rawItems.length;
    } catch (error) {
      report.failed += 1;
      if (error instanceof AdapterBlockedError) {
        report.status = 'failed';
        report.note = `Blocked with HTTP ${error.status} — left alone, store marked stale.`;
        break;
      }
      continue;
    }

    for (const raw of rawItems) {
      const item = adapter.parse(raw);
      if (!item) continue;
      report.parsed += 1;

      const match = matchProduct(
        {
          ean: item.ean,
          title: item.title,
          brand: item.brand,
          packQty: item.packQty,
          packUnit: item.packUnit,
        },
        catalogue,
      );

      if (match.productId === null || match.method === null) {
        report.unmatched += 1;
        // Parked for review rather than guessed (R5).
        await db()
          .insert(schema.unmatched)
          .values({
            storeId,
            storeSku: item.storeSku,
            title: item.title,
            bestScore: match.score,
          })
          .onConflictDoNothing();
        continue;
      }

      try {
        const storeProductId = await upsertStoreProduct({
          storeId,
          productId: match.productId,
          item,
          method: match.method,
          score: match.score,
        });
        await writeObservation(storeProductId, item);
        report.matched += 1;
      } catch {
        report.failed += 1;
      }
    }
  }

  if (report.status !== 'failed') {
    const parseRate = report.fetched === 0 ? 0 : report.parsed / report.fetched;
    if (report.matched === 0) {
      report.status = 'failed';
      report.note = 'Nothing matched — the payload shape has probably changed.';
    } else if (parseRate < 0.5 || report.failed > 0) {
      report.status = 'partial';
      report.note = `Parse rate ${Math.round(parseRate * 100)}%, ${report.failed} failures.`;
    }
  }

  if (runId !== null) {
    await db()
      .update(schema.runs)
      .set({
        finishedAt: new Date(),
        fetched: report.fetched,
        parsed: report.parsed,
        matched: report.matched,
        failed: report.failed,
        status: report.status,
        note: report.note,
      })
      .where(eq(schema.runs.id, runId));
  }

  return report;
}

/**
 * Refreshes every store that has an HTTP adapter, isolating each from the
 * others (R7). Retailers that need a browser are refreshed by the separate
 * browser job — see scripts/refresh-browser.ts.
 */
export async function refreshAll(slugs?: readonly StoreSlug[]): Promise<RunReport[]> {
  const targets = slugs ?? (['asda'] as const);
  const reports: RunReport[] = [];
  for (const slug of targets) {
    reports.push(await refreshStore(slug));
  }
  return reports;
}
