import type { OfferKind, PackUnit, StoreSlug } from '@/lib/types';

/** Whatever the retailer's endpoint returned for one product, untouched. */
export type RawProduct = unknown;

/** The single shape every adapter must produce. */
export interface NormalisedProduct {
  storeSlug: StoreSlug;
  storeSku: string;
  storeUrl: string;
  title: string;
  brand: string | null;
  ean: string | null;
  packLabel: string;
  packQty: number | null;
  packUnit: PackUnit | null;
  shelfPence: number | null;
  loyaltyPence: number | null;
  offerKind: OfferKind;
  /** Only when the retailer published it (R2). */
  offerEndsOn: string | null;
  inStock: boolean;
  /** The payload this was parsed from, stored for debugging a bad price. */
  raw: RawProduct;
}

export interface FetchOptions {
  signal?: AbortSignal;
  /** Page size hint where the endpoint supports it. */
  limit?: number;
}

export interface RetailerAdapter {
  slug: StoreSlug;
  name: string;
  loyaltyScheme: string | null;
  /**
   * Search the retailer for a term and return their raw payload items.
   * Throws on a blocked or unparseable response — the runner isolates it.
   */
  search(term: string, opts?: FetchOptions): Promise<RawProduct[]>;
  /** Parse one raw item. Returns null when the payload is not a product we can use. */
  parse(raw: RawProduct): NormalisedProduct | null;
}

export class AdapterBlockedError extends Error {
  constructor(
    public readonly slug: StoreSlug,
    public readonly status: number,
  ) {
    super(`${slug} refused the request with HTTP ${status}`);
    this.name = 'AdapterBlockedError';
  }
}
