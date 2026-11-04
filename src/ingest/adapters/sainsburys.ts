import { z } from 'zod';
import { fetchJson } from '../fetcher';
import { normaliseEan, parsePackSize, toIsoDate, toPence } from '../normalise';
import type { FetchOptions, NormalisedProduct, RawProduct, RetailerAdapter } from '../types';

/**
 * Sainsbury's. Runs Nectar prices, so both bases must be captured: the
 * shelf price and the lower member price, never collapsed into one number (R3).
 *
 * The response shape below is unverified against a live capture. See the
 * README in this folder before enabling it.
 */

const SainsburysItem = z.object({
  product_uid: z.union([z.string(), z.number()]),
  name: z.string(),
  brand: z.string().nullish(),
  ean: z.string().nullish(),
  unit_price: z
    .object({
      price: z.union([z.string(), z.number()]).nullish(),
      measure: z.string().nullish(),
    })
    .nullish(),
  retail_price: z
    .object({
      price: z.union([z.string(), z.number()]).nullish(),
    })
    .nullish(),
  nectar_price: z
    .object({
      retail_price: z.union([z.string(), z.number()]).nullish(),
      end_date: z.string().nullish(),
    })
    .nullish(),
  promotions: z
    .array(
      z.object({
        end_date: z.string().nullish(),
        strap_line: z.string().nullish(),
      }),
    )
    .nullish(),
  is_available: z.boolean().nullish(),
  full_url: z.string().nullish(),
});

const SainsburysResponse = z.object({
  products: z.array(z.unknown()).nullish(),
});

export const sainsburysAdapter: RetailerAdapter = {
  slug: 'sainsburys',
  name: "Sainsbury's",
  loyaltyScheme: 'Nectar price',

  async search(term, opts: FetchOptions = {}) {
    const url = new URL(
      'https://www.sainsburys.co.uk/groceries-api/gol-services/product/v1/product',
    );
    url.searchParams.set('filter[keyword]', term);
    url.searchParams.set('page_size', String(opts.limit ?? 24));

    const json = await fetchJson({
      slug: 'sainsburys',
      url: url.toString(),
      signal: opts.signal,
    });
    const parsed = SainsburysResponse.safeParse(json);
    if (!parsed.success) return [];
    return parsed.data.products ?? [];
  },

  parse(raw: RawProduct): NormalisedProduct | null {
    const result = SainsburysItem.safeParse(raw);
    if (!result.success) return null;
    const item = result.data;

    const shelfPence = toPence(item.retail_price?.price);
    if (shelfPence === null) return null;

    const loyaltyPence = toPence(item.nectar_price?.retail_price);
    const pack = parsePackSize(item.name);
    const promotion = item.promotions?.[0];

    return {
      storeSlug: 'sainsburys',
      storeSku: String(item.product_uid),
      storeUrl: item.full_url ?? `https://www.sainsburys.co.uk/gol-ui/product/${item.product_uid}`,
      title: item.name,
      brand: item.brand ?? null,
      ean: normaliseEan(item.ean),
      packLabel: pack?.label ?? '',
      packQty: pack?.qty ?? null,
      packUnit: pack?.unit ?? null,
      shelfPence,
      // A Nectar price above the shelf price is a parse error, not a bargain.
      loyaltyPence: loyaltyPence !== null && loyaltyPence < shelfPence ? loyaltyPence : null,
      offerKind: loyaltyPence !== null ? 'loyalty' : promotion ? 'shelf_offer' : 'shelf',
      offerEndsOn: toIsoDate(item.nectar_price?.end_date ?? promotion?.end_date),
      inStock: item.is_available ?? true,
      raw,
    };
  },
};
