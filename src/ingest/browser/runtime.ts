import type { Browser, BrowserContext, Page } from 'playwright';
import { config } from '@/lib/config';
import type { NormalisedProduct } from '../types';
import { browserAdapterFor } from './index';
import type { BrowserRetailerAdapter, ScrapedRow } from './types';
import type { StoreSlug } from '@/lib/types';

/**
 * Drives a real browser over the retailers that have no usable JSON endpoint.
 *
 * This cannot run in a serverless function, so it runs in the scheduled
 * GitHub Actions job and writes to Postgres directly. Politeness is the same
 * as the HTTP fetcher (R6): one page at a time per retailer, a jittered pause
 * between searches, and no attempt to defeat a bot challenge — if a retailer
 * blocks us, the run records it and stops for that store (R7).
 */

const NAV_TIMEOUT_MS = 45_000;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function politePause(): Promise<void> {
  const base = config.fetchDelayMs;
  return sleep(base + Math.floor(Math.random() * base));
}

/**
 * Consent walls sit in front of the content on some retailers. We always take
 * the most privacy-preserving option — reject everything that is not
 * strictly necessary — and carry on if no banner is shown.
 */
async function dismissConsent(page: Page): Promise<void> {
  const rejectLabels = [
    /^reject all$/i,
    /^reject all cookies$/i,
    /^decline all$/i,
    /^only necessary/i,
    /^necessary cookies only/i,
  ];

  for (const label of rejectLabels) {
    try {
      const button = page.getByRole('button', { name: label });
      if (await button.first().isVisible({ timeout: 2500 })) {
        await button.first().click({ timeout: 5000 });
        await page.waitForTimeout(1200);
        return;
      }
    } catch {
      // No banner, or it vanished on its own. Either is fine.
    }
  }
}

/** Grids lazy-load, so scroll until the row count stops growing. */
async function loadGrid(page: Page, adapter: BrowserRetailerAdapter): Promise<void> {
  let previous = -1;
  for (let pass = 0; pass < 6; pass += 1) {
    const count = await page.evaluate(adapter.extract).then((rows) => rows.length);
    if (count === previous) return;
    previous = count;
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight * 2);
    });
    await page.waitForTimeout(900);
  }
}

export interface BrowserScrapeResult {
  slug: StoreSlug;
  products: NormalisedProduct[];
  fetched: number;
  parsed: number;
  blocked: boolean;
  note: string | null;
}

export async function scrapeWithBrowser(args: {
  slug: StoreSlug;
  terms: readonly string[];
  browser: Browser;
}): Promise<BrowserScrapeResult> {
  const { slug, terms, browser } = args;
  const adapter = browserAdapterFor(slug);

  const result: BrowserScrapeResult = {
    slug,
    products: [],
    fetched: 0,
    parsed: 0,
    blocked: false,
    note: null,
  };

  if (!adapter) {
    result.note = `No browser adapter for ${slug}`;
    return result;
  }

  const context: BrowserContext = await browser.newContext({
    locale: 'en-GB',
    timezoneId: 'Europe/London',
    viewport: { width: 1366, height: 900 },
    userAgent: `Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 TrolleywiseBot/0.1 (+${config.fetchContactUrl})`,
  });

  const page = await context.newPage();
  page.setDefaultTimeout(NAV_TIMEOUT_MS);

  try {
    // Consent is per-context, so it only needs dismissing once per retailer.
    let consentDone = false;

    for (const term of terms) {
      await politePause();

      let response;
      try {
        response = await page.goto(adapter.searchUrl(term), {
          waitUntil: 'domcontentloaded',
          timeout: NAV_TIMEOUT_MS,
        });
      } catch (error) {
        result.note = error instanceof Error ? error.message.slice(0, 160) : 'navigation failed';
        continue;
      }

      const status = response?.status() ?? 0;
      if (status === 403 || status === 429) {
        // Taken at face value. We do not work around it (R6).
        result.blocked = true;
        result.note = `Blocked with HTTP ${status} — left alone, store marked stale.`;
        break;
      }

      if (!consentDone) {
        await dismissConsent(page);
        consentDone = true;
      }

      await loadGrid(page, adapter);

      let rows: ScrapedRow[] = [];
      try {
        rows = await page.evaluate(adapter.extract);
      } catch (error) {
        result.note = error instanceof Error ? error.message.slice(0, 160) : 'extract failed';
        continue;
      }

      result.fetched += rows.length;

      for (const row of rows) {
        const product = adapter.parse(row);
        if (product) {
          result.parsed += 1;
          result.products.push(product);
        }
      }
    }
  } finally {
    await page.close().catch(() => undefined);
    await context.close().catch(() => undefined);
  }

  return result;
}
