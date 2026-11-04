import { parsePackSize } from '../normalise';
import type { NormalisedProduct } from '../types';
import { isMultibuy, moneyTokens, offerEndDate } from './money-text';
import type { BrowserRetailerAdapter, ScrapedRow } from './types';

/**
 * Tesco.
 *
 * Verified live on 2026-11-04, and the most awkward of the four: a consent
 * wall before any content, and hashed CSS class names with almost no
 * `data-testid` hooks, so there is nothing stable to select on.
 *
 * What *is* stable is the copy. A tile reads like:
 *
 *   Heinz Baked Beans In Tomato Sauce 4X415g | 4.4 (129) |
 *   £2.95 Clubcard Price | (£1.78/kg) |
 *   Offer valid for delivery from 27/10/2026 until 23/11/2026 | £3.30 | £1.99/kg
 *
 * So the tile is found by climbing from the product anchor to the nearest
 * small ancestor containing a price, and the numbers are read out of the text.
 * Parsing words is more durable here than parsing a hashed class name.
 *
 * Tesco is also the one retailer that publishes a real offer end date, which
 * is worth the trouble.
 */

const BASE = 'https://www.tesco.com';

export const tescoBrowserAdapter: BrowserRetailerAdapter = {
  slug: 'tesco',
  name: 'Tesco',
  loyaltyScheme: 'Clubcard price',

  searchUrl(term: string) {
    return `${BASE}/groceries/en-GB/search?query=${encodeURIComponent(term)}`;
  },

  extract: () => {
    const rows: { href: string; title: string; text: string }[] = [];
    const seen = new Set<string>();

    document.querySelectorAll('a[href*="/products/"]').forEach((anchor) => {
      let card: HTMLElement | null = anchor as HTMLElement;
      for (let i = 0; i < 9 && card; i += 1) {
        card = card.parentElement;
        const text = card?.innerText ?? '';
        // A tile is the smallest ancestor that shows a price.
        if (text.includes('£') && text.length < 400) break;
      }
      if (!card) return;

      const href = (anchor.getAttribute('href') ?? '').split('?')[0] ?? '';
      if (!href || seen.has(href)) return;

      const text = (card.innerText ?? '').replace(/\n+/g, ' | ');
      if (!text.includes('£')) return;

      // The anchor text is the cleanest title available on the tile.
      const title = ((anchor as HTMLElement).innerText ?? '').trim().split('\n')[0] ?? '';
      if (!title) return;

      seen.add(href);
      rows.push({ href, title, text });
    });

    return rows;
  },

  parse(row: ScrapedRow): NormalisedProduct | null {
    const tokens = moneyTokens(row.text);
    if (tokens.length === 0) return null;

    const clubcardToken = tokens.find((token) => /^\s*clubcard price/i.test(token.trailing));
    const others = tokens.filter((token) => token !== clubcardToken);

    let shelfPence: number | null;
    let loyaltyPence: number | null = null;
    let offerKind: NormalisedProduct['offerKind'] = 'shelf';

    if (clubcardToken) {
      if (isMultibuy(row.text)) {
        // "Any 2 for £7 Clubcard Price" — the amount is a bundle price, not a
        // unit price, so it must not become this product's price (R2).
        offerKind = 'multibuy';
        shelfPence = others[0]?.pence ?? null;
      } else {
        offerKind = 'loyalty';
        loyaltyPence = clubcardToken.pence;
        // The shelf price is the other plain amount on the tile.
        shelfPence = others.find((token) => token.pence > clubcardToken.pence)?.pence
          ?? others[0]?.pence
          ?? null;
      }
    } else {
      shelfPence = tokens[0]?.pence ?? null;
      if (isMultibuy(row.text)) offerKind = 'multibuy';
    }

    if (shelfPence === null) {
      // A Clubcard-only multibuy tile with no plain price left: we cannot say
      // what one unit costs, so we record nothing rather than guess.
      return null;
    }

    const pack = parsePackSize(row.title);
    const sku = row.href.split('/').filter(Boolean).pop() ?? row.href;

    return {
      storeSlug: 'tesco',
      storeSku: sku,
      storeUrl: row.href.startsWith('http') ? row.href : `${BASE}${row.href}`,
      title: row.title,
      brand: null,
      ean: null,
      packLabel: pack?.label ?? '',
      packQty: pack?.qty ?? null,
      packUnit: pack?.unit ?? null,
      shelfPence,
      loyaltyPence,
      offerKind,
      offerEndsOn: offerEndDate(row.text),
      inStock: !/out of stock|currently unavailable/i.test(row.text),
      raw: row,
    };
  },
};
