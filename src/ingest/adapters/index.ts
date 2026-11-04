import type { StoreSlug } from '@/lib/types';
import type { RetailerAdapter } from '../types';
import { asdaAdapter } from './asda';
import { morrisonsAdapter } from './morrisons';
import { sainsburysAdapter } from './sainsburys';
import { tescoAdapter } from './tesco';

export const ADAPTERS: Record<StoreSlug, RetailerAdapter> = {
  asda: asdaAdapter,
  morrisons: morrisonsAdapter,
  sainsburys: sainsburysAdapter,
  tesco: tescoAdapter,
};

export function adapterFor(slug: StoreSlug): RetailerAdapter {
  return ADAPTERS[slug];
}

export function allAdapters(): RetailerAdapter[] {
  return Object.values(ADAPTERS);
}
