'use client';

/**
 * Browser-side access to the published dataset.
 *
 * The basket and search pages compute in the client, because a static export
 * has no server to read query strings. They fetch the same JSON files the
 * build reads, so both sides see identical data.
 */

import { config } from '@/lib/config';
import type { DailyPrice, Product, StorePrice } from '@/lib/types';
import { DATA_URL_PREFIX, historyPath, type DatasetMeta, type PricesFile } from './dataset';

function url(relative: string): string {
  const prefix = config.basePath ? `${config.basePath}/` : '/';
  return `${prefix}${DATA_URL_PREFIX}/${relative}`;
}

const cache = new Map<string, Promise<unknown>>();

async function load<T>(relative: string, fallback: T): Promise<T> {
  const key = relative;
  const existing = cache.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  const request = fetch(url(relative))
    .then((response) => (response.ok ? (response.json() as Promise<T>) : fallback))
    .catch(() => fallback);

  cache.set(key, request as Promise<unknown>);
  return request;
}

export function loadProducts(): Promise<Product[]> {
  return load<Product[]>('products.json', []);
}

export function loadPrices(): Promise<PricesFile> {
  return load<PricesFile>('prices.json', {});
}

export function loadMeta(): Promise<DatasetMeta | null> {
  return load<DatasetMeta | null>('meta.json', null);
}

export function loadHistory(productId: number): Promise<DailyPrice[]> {
  return load<DailyPrice[]>(historyPath(productId), []);
}

/** Convenience for the basket: products and prices together, once. */
export async function loadCatalogue(): Promise<{
  products: Map<number, Product>;
  prices: Map<number, StorePrice[]>;
}> {
  const [products, prices] = await Promise.all([loadProducts(), loadPrices()]);
  return {
    products: new Map(products.map((product) => [product.id, product])),
    prices: new Map(
      Object.entries(prices).map(([id, rows]) => [Number(id), rows] as const),
    ),
  };
}
