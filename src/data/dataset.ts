/**
 * The published dataset.
 *
 * On GitHub Pages there is no database, so the refresh job writes these files
 * into `public/data/` and commits them. They are the entire backend: the
 * build reads them with `fs`, and the browser fetches them for the pages that
 * compute in the client.
 *
 * Keeping the shapes here, apart from both the writer and the readers, is
 * what stops the two drifting.
 */

import type { DailyPrice, Product, StorePrice, StoreSlug } from '@/lib/types';

export const DATA_DIR = 'public/data';
export const DATA_URL_PREFIX = 'data';

export interface DatasetMeta {
  /** When the most recent refresh finished. */
  generatedAt: string;
  /** Per-retailer outcome of that refresh, so staleness is visible (R2). */
  runs: DatasetRun[];
  productCount: number;
  /** True when the files were produced from fixtures rather than real prices. */
  sample: boolean;
}

export interface DatasetRun {
  storeSlug: StoreSlug;
  status: 'ok' | 'partial' | 'failed' | 'skipped';
  fetched: number;
  parsed: number;
  matched: number;
  unmatched: number;
  note: string | null;
  finishedAt: string;
}

/** `products.json` — the catalogue as published. */
export type ProductsFile = Product[];

/** `prices.json` — today's price at every store, keyed by product id. */
export type PricesFile = Record<string, StorePrice[]>;

/** `history/<productId>.json` — the daily series for one product. */
export type HistoryFile = DailyPrice[];

export function historyPath(productId: number): string {
  return `history/${productId}.json`;
}

/** How long a product's daily series is kept. Older points are dropped. */
export const HISTORY_RETENTION_DAYS = 120;
