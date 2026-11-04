/**
 * The refresh job. Scrapes every retailer, matches against the catalogue and
 * writes the published JSON under `public/data/`. No database anywhere.
 *
 *   npm run refresh:static              # all retailers
 *   npm run refresh:static -- asda      # one of them
 *   HEADED=1 npm run refresh:static -- tesco
 *
 * Asda is read over HTTP (it has a JSON index); the other three need a real
 * browser. One retailer failing never fails the run (R7) — that store is
 * simply recorded as failed and shown as stale on the site.
 */

import { chromium, type Browser } from 'playwright';
import { adapterFor } from '../src/ingest/adapters';
import { BROWSER_SLUGS, browserAdapterFor } from '../src/ingest/browser';
import { scrapeWithBrowser } from '../src/ingest/browser/runtime';
import {
  catalogueTerms,
  matchToCatalogue,
  publishDataset,
} from '../src/ingest/publish';
import { AdapterBlockedError, type NormalisedProduct } from '../src/ingest/types';
import type { DatasetRun } from '../src/data/dataset';
import type { StorePrice, StoreSlug } from '../src/lib/types';

const ALL: StoreSlug[] = ['asda', 'morrisons', 'sainsburys', 'tesco'];
const TERM_LIMIT = Number(process.env.TERM_LIMIT ?? 40);

function now(): string {
  return new Date().toISOString();
}

async function runHttpStore(slug: StoreSlug, terms: readonly string[]) {
  const adapter = adapterFor(slug);
  const products: NormalisedProduct[] = [];
  let fetched = 0;
  let blocked = false;
  let note: string | null = null;

  if (!adapter) return { products, fetched, blocked, note: `no HTTP adapter for ${slug}` };

  for (const term of terms) {
    try {
      const raws = await adapter.search(term, { limit: 12 });
      fetched += raws.length;
      for (const raw of raws) {
        const parsed = adapter.parse(raw);
        if (parsed) products.push(parsed);
      }
    } catch (error) {
      if (error instanceof AdapterBlockedError) {
        blocked = true;
        note = `Blocked with HTTP ${error.status} — left alone, store marked stale.`;
        break;
      }
      note = error instanceof Error ? error.message.slice(0, 160) : 'search failed';
    }
  }

  return { products, fetched, blocked, note };
}

async function main() {
  const arg = process.argv[2]?.trim();
  const slugs: StoreSlug[] = arg
    ? arg
        .split(',')
        .map((value) => value.trim())
        .filter((value): value is StoreSlug => ALL.includes(value as StoreSlug))
    : ALL;

  if (slugs.length === 0) {
    console.error(`No valid store given. Choose from: ${ALL.join(', ')}`);
    process.exit(1);
  }

  const terms = catalogueTerms().slice(0, TERM_LIMIT);
  const pricesBySlug = new Map<StoreSlug, ReadonlyMap<number, StorePrice>>();
  const runs: DatasetRun[] = [];

  let browser: Browser | null = null;
  const needsBrowser = slugs.some((slug) => BROWSER_SLUGS.includes(slug));
  if (needsBrowser) {
    browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
  }

  try {
    for (const slug of slugs) {
      const usesBrowser = browserAdapterFor(slug) !== null;

      const outcome =
        usesBrowser && browser
          ? await scrapeWithBrowser({ slug, terms, browser })
          : await runHttpStore(slug, terms);

      const products = outcome.products;
      const fetched = outcome.fetched;
      const blocked = outcome.blocked;
      let note = outcome.note;

      const match = matchToCatalogue(products);
      pricesBySlug.set(slug, match.matched);

      let status: DatasetRun['status'] = 'ok';
      if (blocked) {
        status = 'failed';
      } else if (match.matchedCount === 0) {
        status = 'failed';
        note = note ?? 'Nothing matched — the site layout has probably changed.';
      } else if (match.matchedCount < terms.length * 0.4) {
        status = 'partial';
        note = note ?? `Only ${match.matchedCount} of ${terms.length} catalogue items matched.`;
      }

      runs.push({
        storeSlug: slug,
        status,
        fetched,
        parsed: products.length,
        matched: match.matchedCount,
        unmatched: match.unmatchedCount,
        note,
        finishedAt: now(),
      });

      console.log(
        [
          slug.padEnd(12),
          status.padEnd(8),
          `found ${fetched}`.padEnd(12),
          `parsed ${products.length}`.padEnd(14),
          `matched ${match.matchedCount}`.padEnd(14),
          note ?? '',
        ].join(' '),
      );
    }
  } finally {
    await browser?.close().catch(() => undefined);
  }

  const result = await publishDataset({ pricesBySlug, runs });
  console.log(`\nPublished ${result.productCount} products to public/data.`);

  const anySucceeded = runs.some((run) => run.status !== 'failed');
  process.exit(anySucceeded ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
