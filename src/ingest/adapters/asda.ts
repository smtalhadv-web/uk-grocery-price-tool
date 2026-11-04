import { z } from 'zod';
import { fetchJson } from '../fetcher';
import { normaliseEan, parsePackSize, toIsoDate, toPence } from '../normalise';
import type { FetchOptions, NormalisedProduct, RawProduct, RetailerAdapter } from '../types';

/**
 * Asda. No loyalty price layer on the shelf, so the shelf price is what
 * everyone pays — which makes it the clean baseline in a comparison.
 * Promotions appear as "Rollback".
 *
 * The response shape below is unverified against a live capture. See the
 * README in this folder before enabling it.
 */

const AsdaItem = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  brand: z.string().nullish(),
  gtin: z.string().nullish(),
  size: z.string().nullish(),
  price: z
    .object({
      current: z.union([z.string(), z.number()]).nullish(),
      was: z.union([z.string(), z.number()]).nullish(),
    })
    .nullish(),
  promotion: z
    .object({
      type: z.string().nullish(),
      endDate: z.string().nullish(),
    })
    .nullish(),
  availability: z.string().nullish(),
  slug: z.string().nullish(),
});

const AsdaResponse = z.object({
  data: z
    .object({
      items: z.array(z.unknown()).nullish(),
    })
    .nullish(),
  items: z.array(z.unknown()).nullish(),
});

export const asdaAdapter: RetailerAdapter = {
  slug: 'asda',
  name: 'Asda',
  loyaltyScheme: null,

  async search(term, opts: FetchOptions = {}) {
    const url = new URL('https://groceries.asda.com/api/items/search');
    url.searchParams.set('keyword', term);
    url.searchParams.set('limit', String(opts.limit ?? 24));

    const json = await fetchJson({ slug: 'asda', url: url.toString(), signal: opts.signal });
    const parsed = AsdaResponse.safeParse(json);
    if (!parsed.success) return [];
    return parsed.data.data?.items ?? parsed.data.items ?? [];
  },

  parse(raw: RawProduct): NormalisedProduct | null {
    const result = AsdaItem.safeParse(raw);
    if (!result.success) return null;
    const item = result.data;

    const shelfPence = toPence(item.price?.current);
    if (shelfPence === null) return null; // no readable price → park it (R2)

    const pack = item.size ? parsePackSize(item.size) : null;
    const isRollback = (item.promotion?.type ?? '').toLowerCase().includes('rollback');

    return {
      storeSlug: 'asda',
      storeSku: String(item.id),
      storeUrl: `https://groceries.asda.com/product/${item.slug ?? item.id}`,
      title: item.name,
      brand: item.brand ?? null,
      ean: normaliseEan(item.gtin),
      packLabel: item.size ?? '',
      packQty: pack?.qty ?? null,
      packUnit: pack?.unit ?? null,
      shelfPence,
      loyaltyPence: null, // Asda runs no shelf loyalty price
      offerKind: isRollback ? 'rollback' : item.promotion ? 'shelf_offer' : 'shelf',
      offerEndsOn: toIsoDate(item.promotion?.endDate),
      inStock: (item.availability ?? 'A').toUpperCase() !== 'U',
      raw,
    };
  },
};
