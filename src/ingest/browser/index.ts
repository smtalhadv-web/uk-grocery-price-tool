import type { StoreSlug } from '@/lib/types';
import { morrisonsBrowserAdapter } from './morrisons';
import { sainsburysBrowserAdapter } from './sainsburys';
import { tescoBrowserAdapter } from './tesco';
import type { BrowserRetailerAdapter } from './types';

/**
 * Retailers that cannot be read over plain HTTP and need a real browser.
 * Asda is not here: it has a JSON index and stays an HTTP adapter.
 */
export const BROWSER_ADAPTERS: Partial<Record<StoreSlug, BrowserRetailerAdapter>> = {
  sainsburys: sainsburysBrowserAdapter,
  morrisons: morrisonsBrowserAdapter,
  tesco: tescoBrowserAdapter,
};

export function browserAdapterFor(slug: StoreSlug): BrowserRetailerAdapter | null {
  return BROWSER_ADAPTERS[slug] ?? null;
}

export const BROWSER_SLUGS = Object.keys(BROWSER_ADAPTERS) as StoreSlug[];

export type { BrowserRetailerAdapter, ScrapedRow } from './types';
