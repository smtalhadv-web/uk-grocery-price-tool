import type { NormalisedProduct } from '../types';
import type { StoreSlug } from '@/lib/types';

/**
 * One product tile as read off a rendered page, still entirely strings.
 *
 * Keeping the scrape and the parse apart is what makes this testable: the
 * extractor runs inside the page and returns these rows, and `parse()` is a
 * pure function over them, exercised in unit tests against text captured from
 * the real sites.
 */
export interface ScrapedRow {
  /** Absolute or site-relative product URL, query string already stripped. */
  href: string;
  /** Product title as the retailer writes it. */
  title: string;
  /** The tile's whole visible text, newlines collapsed to " | ". */
  text: string;
  /** The headline price, where the tile exposes it on its own. */
  price?: string | null;
  /** A struck-through "was" price, where shown. */
  wasPrice?: string | null;
  /** A loyalty-member price, where shown separately. */
  memberPrice?: string | null;
  /** Unit price string, e.g. "(£1.78/kg)". Informational only. */
  perUnit?: string | null;
  /** Badge labels on the tile, e.g. "Nectar price", "More Card". */
  badges?: string[];
}

export interface BrowserRetailerAdapter {
  slug: StoreSlug;
  name: string;
  loyaltyScheme: string | null;
  /** Search results URL for a term. */
  searchUrl(term: string): string;
  /**
   * Runs inside the page via `page.evaluate`, so it must be entirely
   * self-contained — no imports, no closure over anything out here.
   */
  extract: () => ScrapedRow[];
  /** Pure: a scraped row in, a normalised product or null out. */
  parse(row: ScrapedRow): NormalisedProduct | null;
}
