/**
 * A basket lives in the URL: `?items=1x2,14x1`. That makes every comparison
 * shareable and bookmarkable with no account, and lets the whole page render
 * on the server. Accounts and saved lists layer on top later.
 */

import type { PriceBasis } from './types';

export interface ParsedBasketItem {
  productId: number;
  qty: number;
}

const MAX_ITEMS = 100;
const MAX_QTY = 20;

export function parseItems(raw: string | undefined | null): ParsedBasketItem[] {
  if (!raw) return [];
  const out: ParsedBasketItem[] = [];
  const seen = new Set<number>();

  for (const chunk of raw.split(',')) {
    const [idPart, qtyPart] = chunk.split('x');
    const productId = Number(idPart);
    const qty = qtyPart === undefined ? 1 : Number(qtyPart);
    if (!Number.isInteger(productId) || productId <= 0) continue;
    if (!Number.isInteger(qty) || qty <= 0) continue;
    if (seen.has(productId)) continue;
    seen.add(productId);
    out.push({ productId, qty: Math.min(qty, MAX_QTY) });
    if (out.length >= MAX_ITEMS) break;
  }

  return out;
}

export function serialiseItems(items: readonly ParsedBasketItem[]): string {
  return items.map((item) => `${item.productId}x${item.qty}`).join(',');
}

export function withItem(
  items: readonly ParsedBasketItem[],
  productId: number,
  qty = 1,
): ParsedBasketItem[] {
  const existing = items.find((item) => item.productId === productId);
  if (!existing) return [...items, { productId, qty }];
  return items.map((item) =>
    item.productId === productId
      ? { ...item, qty: Math.min(MAX_QTY, item.qty + qty) }
      : item,
  );
}

export function setQty(
  items: readonly ParsedBasketItem[],
  productId: number,
  qty: number,
): ParsedBasketItem[] {
  if (qty <= 0) return items.filter((item) => item.productId !== productId);
  return items.map((item) =>
    item.productId === productId ? { ...item, qty: Math.min(MAX_QTY, qty) } : item,
  );
}

export function parseBasis(raw: string | undefined | null): PriceBasis {
  return raw === 'shelf' ? 'shelf' : 'loyalty_where_available';
}

export function basketHref(
  items: readonly ParsedBasketItem[],
  basis: PriceBasis = 'loyalty_where_available',
): string {
  const params = new URLSearchParams();
  if (items.length > 0) params.set('items', serialiseItems(items));
  if (basis === 'shelf') params.set('basis', 'shelf');
  const query = params.toString();
  return query ? `/basket?${query}` : '/basket';
}
