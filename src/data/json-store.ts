/**
 * Reading and writing the published dataset on disk. Node only — the build
 * and the refresh job use this; the browser uses `client-data.ts`.
 */

import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { DailyPrice, Product, StorePrice } from '@/lib/types';
import {
  DATA_DIR,
  HISTORY_RETENTION_DAYS,
  historyPath,
  type DatasetMeta,
  type PricesFile,
  type ProductsFile,
} from './dataset';

function root(): string {
  return path.join(process.cwd(), DATA_DIR);
}

export function datasetExists(): boolean {
  return existsSync(path.join(root(), 'meta.json'));
}

async function readJson<T>(relative: string): Promise<T | null> {
  try {
    const text = await readFile(path.join(root(), relative), 'utf8');
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function writeJson(relative: string, value: unknown): Promise<void> {
  const target = path.join(root(), relative);
  await mkdir(path.dirname(target), { recursive: true });
  // Pretty-printed on purpose: these files are committed, and a readable diff
  // is how a bad price gets spotted in review.
  await writeFile(target, `${JSON.stringify(value, null, 1)}\n`, 'utf8');
}

/* ---------------------------------------------------------------- reading */

export async function readMeta(): Promise<DatasetMeta | null> {
  return readJson<DatasetMeta>('meta.json');
}

export async function readProducts(): Promise<ProductsFile> {
  return (await readJson<ProductsFile>('products.json')) ?? [];
}

export async function readPrices(): Promise<PricesFile> {
  return (await readJson<PricesFile>('prices.json')) ?? {};
}

export async function readHistory(productId: number): Promise<DailyPrice[]> {
  return (await readJson<DailyPrice[]>(historyPath(productId))) ?? [];
}

export async function listHistoryProductIds(): Promise<number[]> {
  try {
    const names = await readdir(path.join(root(), 'history'));
    return names
      .filter((name) => name.endsWith('.json'))
      .map((name) => Number(name.replace('.json', '')))
      .filter((id) => Number.isInteger(id));
  } catch {
    return [];
  }
}

/* ---------------------------------------------------------------- writing */

/**
 * The near misses from the last run — rows a retailer returned that did not
 * clear the match floor. Not used by the site; it exists so a low match rate
 * can be diagnosed instead of guessed at (R5).
 */
export async function writeUnmatched(rows: readonly unknown[]): Promise<void> {
  await writeJson('unmatched.json', rows);
}

export async function writeMeta(meta: DatasetMeta): Promise<void> {
  await writeJson('meta.json', meta);
}

export async function writeProducts(products: readonly Product[]): Promise<void> {
  await writeJson('products.json', products);
}

export async function writePrices(prices: PricesFile): Promise<void> {
  await writeJson('prices.json', prices);
}

/**
 * Appends today's point to a product's series and trims the tail.
 *
 * One point per store per day, holding that day's lowest. Re-running the job
 * on the same day corrects the day in place rather than adding a second
 * point, so history stays one row per day without ever losing a lower price.
 */
export async function appendHistory(
  productId: number,
  todaysPrices: readonly StorePrice[],
): Promise<void> {
  const existing = await readHistory(productId);
  const day = new Date().toISOString().slice(0, 10);
  const byKey = new Map(existing.map((row) => [`${row.day}|${row.storeSlug}`, row]));

  for (const price of todaysPrices) {
    const key = `${day}|${price.storeSlug}`;
    const previous = byKey.get(key);

    const shelf = lowest(previous?.shelfPence, price.shelfPence);
    const loyalty = lowest(previous?.loyaltyPence, price.loyaltyPence);

    byKey.set(key, {
      day,
      storeSlug: price.storeSlug,
      shelfPence: shelf,
      loyaltyPence: loyalty,
    });
  }

  const cutoff = new Date(Date.now() - HISTORY_RETENTION_DAYS * 86_400_000)
    .toISOString()
    .slice(0, 10);

  const rows = [...byKey.values()]
    .filter((row) => row.day >= cutoff)
    .sort((a, b) => (a.day === b.day ? a.storeSlug.localeCompare(b.storeSlug) : a.day.localeCompare(b.day)));

  await writeJson(historyPath(productId), rows);
}

function lowest(a: number | null | undefined, b: number | null | undefined): number | null {
  if (a === null || a === undefined) return b ?? null;
  if (b === null || b === undefined) return a;
  return Math.min(a, b);
}
