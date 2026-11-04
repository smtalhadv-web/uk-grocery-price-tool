import type { StoreSlug } from '@/lib/types';
import type { RetailerAdapter } from '../types';
import { asdaAdapter } from './asda';

/**
 * Retailers readable over plain HTTP. Only Asda qualifies: it has a JSON
 * search index. The other three are read with a real browser instead —
 * see `src/ingest/browser/`.
 */
export const ADAPTERS: Partial<Record<StoreSlug, RetailerAdapter>> = {
  asda: asdaAdapter,
};

export const HTTP_SLUGS = Object.keys(ADAPTERS) as StoreSlug[];

export function adapterFor(slug: StoreSlug): RetailerAdapter | null {
  return ADAPTERS[slug] ?? null;
}
