import type { Pence } from './money';

export type StoreSlug = 'asda' | 'morrisons' | 'sainsburys' | 'tesco';

export type PackUnit = 'g' | 'ml' | 'item';

/** How a retailer is presenting the current price. */
export type OfferKind =
  | 'shelf' // ordinary price, no promotion
  | 'shelf_offer' // promotion open to everyone
  | 'loyalty' // Clubcard / Nectar / More Card price
  | 'rollback' // Asda's own long-run price cut
  | 'multibuy'; // e.g. 2 for £3 — stored but never folded into a basket total

/** Which price basis a total is computed on. The two are never mixed (R3). */
export type PriceBasis = 'shelf' | 'loyalty_where_available';

export interface Store {
  id: number;
  slug: StoreSlug;
  name: string;
  /** Null when the retailer runs no loyalty price layer. */
  loyaltyScheme: string | null;
}

export interface Product {
  id: number;
  ean: string | null;
  name: string;
  brand: string | null;
  packLabel: string;
  packQty: number | null;
  packUnit: PackUnit | null;
  category: string;
}

/** One retailer's price for one product, as last observed. */
export interface StorePrice {
  storeSlug: StoreSlug;
  storeSku: string;
  storeUrl: string;
  observedAt: string; // ISO 8601
  shelfPence: Pence | null;
  loyaltyPence: Pence | null;
  offerKind: OfferKind;
  /** Only ever set when the retailer published it (R2). */
  offerEndsOn: string | null;
  /** Fallback when no end date is published: when we first saw this offer. */
  offerFirstSeenOn: string | null;
  inStock: boolean;
}

export interface ProductWithPrices {
  product: Product;
  prices: StorePrice[];
}

/** A point on the price-history chart: one day's minimum for one store. */
export interface DailyPrice {
  day: string; // YYYY-MM-DD
  storeSlug: StoreSlug;
  shelfPence: Pence | null;
  loyaltyPence: Pence | null;
}

export interface BasketItem {
  productId: number;
  qty: number;
  addedBy?: string;
}

export interface Basket {
  id: string;
  name: string;
  items: BasketItem[];
}

/** A deal as shown in the feed — computed, never stored. */
export interface Deal {
  product: Product;
  storeSlug: StoreSlug;
  storeName: string;
  nowPence: Pence;
  typicalPence: Pence;
  percent: number;
  offerKind: OfferKind;
  offerEndsOn: string | null;
  offerFirstSeenOn: string | null;
  observedAt: string;
}
