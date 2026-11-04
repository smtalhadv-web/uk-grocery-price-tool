import { z } from 'zod';
import { fetchJson } from '../fetcher';
import { parsePackSize, toPence } from '../normalise';
import type { FetchOptions, NormalisedProduct, RawProduct, RetailerAdapter } from '../types';

/**
 * Asda.
 *
 * Verified against a live capture on 2026-11-04 (see docs/MEMORY.md). Asda's
 * site searches an Algolia index, `ASDA_PRODUCTS`, so this adapter queries the
 * same index the website does rather than scraping the page.
 *
 * Two things that shape the code below:
 *
 * - **No barcode.** The index exposes no EAN, so Asda rows can only be matched
 *   by brand + name + pack size. The confidence floor does the work (R5).
 * - **No shelf loyalty price.** Asda runs no member price on the shelf, which
 *   is exactly what makes it the clean baseline in a comparison.
 *
 * Credentials: the app id and the search-only key are published in the page's
 * own `__CONFIG__.app.algolia`, and they rotate. They are read from the live
 * page at run time rather than committed here — a copied key would be both a
 * secret in the repo (R9) and a time bomb.
 */

const CONFIG_URL = 'https://www.asda.com/groceries';

/** Unix seconds in the payload; anything else is not a date we will show (R2). */
function fromUnixSeconds(value: unknown): string | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  const date = new Date(value * 1000);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getUTCFullYear();
  // The feed uses a far-future sentinel for "no end date". Treat it as none.
  if (year > new Date().getUTCFullYear() + 5) return null;
  return date.toISOString().slice(0, 10);
}

const AsdaPromo = z.object({
  ID: z.union([z.string(), z.number()]).nullish(),
  NAME: z.string().nullish(),
  TYPE: z.number().nullish(),
  START_DATE: z.number().nullish(),
  END_DATE: z.number().nullish(),
});

const AsdaHit = z.object({
  objectID: z.union([z.string(), z.number()]),
  CIN: z.union([z.string(), z.number()]).nullish(),
  NAME: z.string(),
  BRAND: z.string().nullish(),
  PACK_SIZE: z.string().nullish(),
  STATUS: z.string().nullish(),
  PRICES: z
    .object({
      EN: z
        .object({
          PRICE: z.union([z.string(), z.number()]).nullish(),
          OFFER: z.string().nullish(),
          PRICEPERUOMFORMATTED: z.string().nullish(),
        })
        .nullish(),
    })
    .nullish(),
  PROMOS: z.object({ EN: z.array(AsdaPromo).nullish() }).nullish(),
  STOCK: z.record(z.string(), z.number()).nullish(),
});

const AlgoliaResponse = z.object({
  hits: z.array(z.unknown()).nullish(),
});

const AlgoliaCredentials = z.object({
  appId: z.string().min(1),
  searchAPIKey: z.string().min(1),
  productsIndex: z.string().min(1),
});

export type Credentials = z.infer<typeof AlgoliaCredentials>;

let cachedCredentials: Credentials | null = null;

/**
 * Supplies credentials fetched elsewhere.
 *
 * Asda's HTML is behind a CDN that refuses datacentre IPs — a plain fetch
 * from a CI runner gets a 403 — but the Algolia endpoint itself is happy to
 * serve the same request the browser makes. So the refresh job reads the
 * config out of a real browser page and hands it over here, and everything
 * after that stays a cheap HTTP call.
 */
export function setCredentials(value: Credentials): void {
  cachedCredentials = value;
}

export const ASDA_CONFIG_URL = CONFIG_URL;

/** Extracts the published Algolia config from a loaded Asda page. */
export function parseAlgoliaConfig(value: unknown): Credentials | null {
  const parsed = AlgoliaCredentials.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/**
 * Pulls the published Algolia app id, search-only key and index name out of
 * the page config, the same values the browser uses. Cached for the process.
 */
async function credentials(signal?: AbortSignal): Promise<Credentials> {
  if (cachedCredentials) return cachedCredentials;

  const response = await fetch(CONFIG_URL, {
    signal,
    headers: {
      accept: 'text/html',
      'accept-language': 'en-GB,en;q=0.9',
      'user-agent': 'TrolleywiseBot/0.1',
    },
  });
  if (!response.ok) {
    throw new Error(
      `asda: could not load page config (HTTP ${response.status}). ` +
        'From a datacentre IP this is expected — the refresh job reads the ' +
        'config in a browser and calls setCredentials() instead.',
    );
  }

  const html = await response.text();
  const match = /"algolia"\s*:\s*(\{[^}]*\})/.exec(html);
  if (!match?.[1]) {
    throw new Error('asda: algolia config not found in the page — the site layout changed');
  }

  const parsed = AlgoliaCredentials.safeParse(JSON.parse(match[1]));
  if (!parsed.success) {
    throw new Error('asda: algolia config is not in the expected shape');
  }

  cachedCredentials = parsed.data;
  return parsed.data;
}

/**
 * Promotion types we can price. A multibuy ("Any 2 for £7") changes the price
 * only if you buy the qualifying quantity, so it is recorded but never folded
 * into a single-unit price — doing so would understate the basket (R2).
 */
function classifyPromo(
  promos: z.infer<typeof AsdaPromo>[] | null | undefined,
  offerFlag: string | null | undefined,
): { kind: NormalisedProduct['offerKind']; endsOn: string | null } {
  const promo = promos?.[0];
  const name = (promo?.NAME ?? '').toLowerCase();
  const endsOn = fromUnixSeconds(promo?.END_DATE);

  if (/\bfor £|\bany \d|\d for \d/.test(name)) return { kind: 'multibuy', endsOn };
  if ((offerFlag ?? '').toLowerCase().includes('rollback')) return { kind: 'rollback', endsOn };
  if (promo) return { kind: 'shelf_offer', endsOn };
  return { kind: 'shelf', endsOn: null };
}

export const asdaAdapter: RetailerAdapter = {
  slug: 'asda',
  name: 'Asda',
  loyaltyScheme: null,

  async search(term, opts: FetchOptions = {}) {
    const { appId, searchAPIKey, productsIndex } = await credentials(opts.signal);
    const url = `https://${appId}-dsn.algolia.net/1/indexes/${productsIndex}/query`;

    const json = await fetchJson({
      slug: 'asda',
      url,
      method: 'POST',
      headers: {
        'x-algolia-application-id': appId,
        'x-algolia-api-key': searchAPIKey,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        query: term,
        hitsPerPage: opts.limit ?? 12,
        attributesToRetrieve: [
          'CIN',
          'NAME',
          'BRAND',
          'PACK_SIZE',
          'STATUS',
          'PRICES.EN',
          'PROMOS.EN',
          'STOCK',
        ],
      }),
      signal: opts.signal,
    });

    const parsed = AlgoliaResponse.safeParse(json);
    if (!parsed.success) return [];
    return parsed.data.hits ?? [];
  },

  parse(raw: RawProduct): NormalisedProduct | null {
    const result = AsdaHit.safeParse(raw);
    if (!result.success) return null;
    const hit = result.data;

    // The feed gives pounds as a number: 3.94 → 394p.
    const shelfPence = toPence(hit.PRICES?.EN?.PRICE);
    if (shelfPence === null) return null;

    const pack = hit.PACK_SIZE ? parsePackSize(hit.PACK_SIZE) : parsePackSize(hit.NAME);
    const promo = classifyPromo(hit.PROMOS?.EN, hit.PRICES?.EN?.OFFER);
    const sku = String(hit.CIN ?? hit.objectID);

    // STOCK is keyed by depot id; any positive figure means it is orderable.
    const stockValues = Object.values(hit.STOCK ?? {});
    const inStock =
      (hit.STATUS ?? 'A').toUpperCase() === 'A' &&
      (stockValues.length === 0 || stockValues.some((value) => value > 0));

    return {
      storeSlug: 'asda',
      storeSku: sku,
      storeUrl: `https://www.asda.com/groceries/product/${sku}`,
      title: hit.NAME,
      brand: hit.BRAND ?? null,
      // The index publishes no barcode, so Asda is matched on name + pack size.
      ean: null,
      packLabel: hit.PACK_SIZE ?? '',
      packQty: pack?.qty ?? null,
      packUnit: pack?.unit ?? null,
      shelfPence,
      loyaltyPence: null,
      offerKind: promo.kind,
      offerEndsOn: promo.endsOn,
      inStock,
      raw,
    };
  },
};
