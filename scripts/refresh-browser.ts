/**
 * Browser-driven refresh for the retailers that publish no usable JSON:
 * Sainsbury's, Morrisons and Tesco.
 *
 * Runs in the scheduled GitHub Actions job, not in a serverless function.
 *
 *   DATA_SOURCE=db DATABASE_URL=... npm run refresh:browser
 *   DATA_SOURCE=db DATABASE_URL=... npm run refresh:browser -- tesco
 *   HEADED=1 npm run refresh:browser -- tesco     # watch it work
 */

import { chromium } from 'playwright';
import { BROWSER_SLUGS } from '../src/ingest/browser';
import { scrapeWithBrowser } from '../src/ingest/browser/runtime';
import { catalogueSearchTerms, closeRun, openRun, persistProducts } from '../src/ingest/run';
import type { StoreSlug } from '../src/lib/types';

/** How many catalogue terms one run covers. Keeps a scheduled run bounded. */
const TERM_LIMIT = Number(process.env.TERM_LIMIT ?? 40);

async function main() {
  const arg = process.argv[2];
  const slugs: StoreSlug[] = arg
    ? arg
        .split(',')
        .map((value) => value.trim())
        .filter((value): value is StoreSlug => BROWSER_SLUGS.includes(value as StoreSlug))
    : BROWSER_SLUGS;

  if (slugs.length === 0) {
    console.error(`No valid store given. Choose from: ${BROWSER_SLUGS.join(', ')}`);
    process.exit(1);
  }

  const allTerms = await catalogueSearchTerms();
  const terms = allTerms.slice(0, TERM_LIMIT);
  if (terms.length === 0) {
    console.error('The catalogue is empty — run `npm run db:seed` first.');
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: process.env.HEADED !== '1' });
  let anySucceeded = false;

  try {
    for (const slug of slugs) {
      const { runId } = await openRun(slug);

      const scrape = await scrapeWithBrowser({ slug, terms, browser });
      const counts = scrape.products.length
        ? await persistProducts({ slug, products: scrape.products })
        : { matched: 0, unmatched: 0, failed: 0 };

      let status: 'ok' | 'partial' | 'failed' = 'ok';
      let note = scrape.note;

      if (scrape.blocked) {
        status = 'failed';
      } else if (counts.matched === 0) {
        status = 'failed';
        note = note ?? 'Nothing matched — the page layout has probably changed.';
      } else if (scrape.parsed < scrape.fetched * 0.5 || counts.failed > 0) {
        status = 'partial';
        note =
          note ??
          `Parsed ${scrape.parsed} of ${scrape.fetched} tiles, ${counts.failed} write failures.`;
      }

      if (status !== 'failed') anySucceeded = true;

      await closeRun(runId, {
        fetched: scrape.fetched,
        parsed: scrape.parsed,
        matched: counts.matched,
        unmatched: counts.unmatched,
        failed: counts.failed,
        status,
        note,
      });

      console.log(
        [
          slug.padEnd(12),
          status.padEnd(8),
          `tiles ${scrape.fetched}`.padEnd(12),
          `parsed ${scrape.parsed}`.padEnd(13),
          `matched ${counts.matched}`.padEnd(14),
          `unmatched ${counts.unmatched}`.padEnd(16),
          note ?? '',
        ].join(' '),
      );
    }
  } finally {
    await browser.close().catch(() => undefined);
  }

  // One retailer failing is not the job failing (R7).
  process.exit(anySucceeded ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
