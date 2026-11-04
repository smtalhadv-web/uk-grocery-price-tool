import { z } from 'zod';
import { fetchJson } from '../fetcher';
import { normaliseEan, parsePackSize, toIsoDate, toPence } from '../normalise';
import type { FetchOptions, NormalisedProduct, RawProduct, RetailerAdapter } from '../types';

/**
 * Morrisons. Runs More Card prices, so both bases are captured (R3).
 *
 * The response shape below is unverified against a live capture. See the
 * README in this folder before enabling it.
 */

const MorrisonsItem = z.object({
  sku: z.union([z.string(), z.number()]),
  name: z.string(),
  brand: z.string().nullish(),
  gtin: z.string().nullish(),
  packSize: z.string().nullish(),
  price: z
    .object({
      current: z.union([z.string(), z.number()]).nullish(),
      moreCard: z.union([z.string(), z.number()]).nullish(),
    })
    .nullish(),
  offer: z
    .object({
      description: z.string().nullish(),
      endsOn: z.string().nullish(),
    })
    .nullish(),
  available: z.boolean().nullish(),
  url: z.string().nullish(),
});

const MorrisonsResponse = z.object({
  products: z.array(z.unknown()).nullish(),
  results: z.array(z.unknown()).nullish(),
});

export const morrisonsAdapter: RetailerAdapter = {
  slug: 'morrisons',
  name: 'Morrisons',
  loyaltyScheme: 'More Card price',

  async search(term, opts: FetchOptions = {}) {
    const url = new URL('https://groceries.morrisons.com/webshop/api/v1/search');
    url.searchParams.set('entry', term);
    url.searchParams.set('limit', String(opts.limit ?? 24));

    const json = await fetchJson({
      slug: 'morrisons',
      url: url.toString(),
      signal: opts.signal,
    });
    const parsed = MorrisonsResponse.safeParse(json);
    if (!parsed.success) return [];
    return parsed.data.products ?? parsed.data.results ?? [];
  },

  parse(raw: RawProduct): NormalisedProduct | null {
    const result = MorrisonsItem.safeParse(raw);
    if (!result.success) return null;
    const item = result.data;

    const shelfPence = toPence(item.price?.current);
    if (shelfPence === null) return null;

    const loyaltyPence = toPence(item.price?.moreCard);
    const pack = item.packSize ? parsePackSize(item.packSize) : parsePackSize(item.name);

    return {
      storeSlug: 'morrisons',
      storeSku: String(item.sku),
      storeUrl: item.url ?? `https://groceries.morrisons.com/products/${item.sku}`,
      title: item.name,
      brand: item.brand ?? null,
      ean: normaliseEan(item.gtin),
      packLabel: item.packSize ?? pack?.label ?? '',
      packQty: pack?.qty ?? null,
      packUnit: pack?.unit ?? null,
      shelfPence,
      loyaltyPence: loyaltyPence !== null && loyaltyPence < shelfPence ? loyaltyPence : null,
      offerKind: loyaltyPence !== null ? 'loyalty' : item.offer ? 'shelf_offer' : 'shelf',
      offerEndsOn: toIsoDate(item.offer?.endsOn),
      inStock: item.available ?? true,
      raw,
    };
  },
};
