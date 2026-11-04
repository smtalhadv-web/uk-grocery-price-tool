import { z } from 'zod';
import { fetchJson } from '../fetcher';
import { normaliseEan, parsePackSize, toIsoDate, toPence } from '../normalise';
import type { FetchOptions, NormalisedProduct, RawProduct, RetailerAdapter } from '../types';

/**
 * Tesco. Runs Clubcard prices, and the gap between the shelf price and the
 * Clubcard price can be large, so capturing both is the whole point here (R3).
 *
 * Expect this one to be the most resistant of the four. If it returns 403 the
 * runner records it, the UI marks Tesco stale, and we leave it alone (R6).
 *
 * The response shape below is unverified against a live capture. See the
 * README in this folder before enabling it.
 */

const TescoItem = z.object({
  id: z.union([z.string(), z.number()]),
  tpnb: z.union([z.string(), z.number()]).nullish(),
  title: z.string(),
  brandName: z.string().nullish(),
  gtin: z.string().nullish(),
  price: z.union([z.string(), z.number()]).nullish(),
  unitPrice: z.union([z.string(), z.number()]).nullish(),
  promotions: z
    .array(
      z.object({
        offerText: z.string().nullish(),
        endDate: z.string().nullish(),
        attributes: z.array(z.string()).nullish(),
        price: z.union([z.string(), z.number()]).nullish(),
      }),
    )
    .nullish(),
  status: z.string().nullish(),
});

const TescoResponse = z.object({
  results: z
    .object({
      productItems: z.array(z.unknown()).nullish(),
    })
    .nullish(),
  products: z.array(z.unknown()).nullish(),
});

/** A Clubcard promotion is tagged, not merely a lower number. */
function clubcardPrice(
  promotions: z.infer<typeof TescoItem>['promotions'],
): { pence: number | null; endsOn: string | null } {
  for (const promotion of promotions ?? []) {
    const attributes = (promotion.attributes ?? []).map((value) => value.toLowerCase());
    const text = (promotion.offerText ?? '').toLowerCase();
    const isClubcard =
      attributes.some((value) => value.includes('clubcard')) || text.includes('clubcard');
    if (!isClubcard) continue;
    return { pence: toPence(promotion.price), endsOn: toIsoDate(promotion.endDate) };
  }
  return { pence: null, endsOn: null };
}

export const tescoAdapter: RetailerAdapter = {
  slug: 'tesco',
  name: 'Tesco',
  loyaltyScheme: 'Clubcard price',

  async search(term, opts: FetchOptions = {}) {
    const url = new URL('https://www.tesco.com/groceries/en-GB/search');
    url.searchParams.set('query', term);
    url.searchParams.set('count', String(opts.limit ?? 24));
    url.searchParams.set('_data', 'routes/search');

    const json = await fetchJson({ slug: 'tesco', url: url.toString(), signal: opts.signal });
    const parsed = TescoResponse.safeParse(json);
    if (!parsed.success) return [];
    return parsed.data.results?.productItems ?? parsed.data.products ?? [];
  },

  parse(raw: RawProduct): NormalisedProduct | null {
    const result = TescoItem.safeParse(raw);
    if (!result.success) return null;
    const item = result.data;

    const shelfPence = toPence(item.price);
    if (shelfPence === null) return null;

    const clubcard = clubcardPrice(item.promotions);
    const pack = parsePackSize(item.title);
    const hasOtherPromotion = (item.promotions?.length ?? 0) > 0 && clubcard.pence === null;

    return {
      storeSlug: 'tesco',
      storeSku: String(item.tpnb ?? item.id),
      storeUrl: `https://www.tesco.com/groceries/en-GB/products/${item.id}`,
      title: item.title,
      brand: item.brandName ?? null,
      ean: normaliseEan(item.gtin),
      packLabel: pack?.label ?? '',
      packQty: pack?.qty ?? null,
      packUnit: pack?.unit ?? null,
      shelfPence,
      loyaltyPence:
        clubcard.pence !== null && clubcard.pence < shelfPence ? clubcard.pence : null,
      offerKind: clubcard.pence !== null ? 'loyalty' : hasOtherPromotion ? 'shelf_offer' : 'shelf',
      offerEndsOn: clubcard.endsOn ?? toIsoDate(item.promotions?.[0]?.endDate),
      inStock: (item.status ?? 'AvailableForSale') !== 'OutOfStock',
      raw,
    };
  },
};
