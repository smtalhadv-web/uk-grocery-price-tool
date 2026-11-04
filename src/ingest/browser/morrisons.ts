import { parsePackSize } from '../normalise';
import type { NormalisedProduct } from '../types';
import { firstPrice, isMultibuy, offerEndDate } from './money-text';
import type { BrowserRetailerAdapter, ScrapedRow } from './types';

/**
 * Morrisons.
 *
 * Verified live on 2026-11-04. GraphQL behind an AWS WAF, so the page is read
 * rather than the API called. Stable `data-test` hooks:
 *
 *   fop-product-link    the anchor, /products/<slug>/<sku>
 *   fop-title           title
 *   fop-price           the price charged now
 *   fop-original-price  the "was" price when on offer
 *   fop-price-per-unit  unit price, in brackets
 *
 * The tile also carries an accessibility string, "Offer name: …", which is
 * where a multibuy shows up ("Buy 3 for £4"). The grid lazy-loads, so the
 * driver scrolls before extracting.
 */

const BASE = 'https://groceries.morrisons.com';

export const morrisonsBrowserAdapter: BrowserRetailerAdapter = {
  slug: 'morrisons',
  name: 'Morrisons',
  loyaltyScheme: 'More Card price',

  searchUrl(term: string) {
    return `${BASE}/search?q=${encodeURIComponent(term)}`;
  },

  extract: () => {
    const rows: { href: string; title: string; text: string; price?: string | null; wasPrice?: string | null; perUnit?: string | null; badges?: string[] }[] = [];
    const seen = new Set<string>();

    document.querySelectorAll('[data-test="fop-product-link"]').forEach((link) => {
      // Climb to the nearest ancestor that holds both a title and a price.
      let card: HTMLElement | null = link as HTMLElement;
      for (let i = 0; i < 8 && card; i += 1) {
        card = card.parentElement;
        if (card?.querySelector('[data-test="fop-price"]') && card.querySelector('[data-test="fop-title"]')) {
          break;
        }
      }
      if (!card) return;

      const href = (link.getAttribute('href') ?? '').split('?')[0] ?? '';
      if (!href || seen.has(href)) return;
      seen.add(href);

      const textOf = (selector: string): string | null => {
        const node = card?.querySelector(selector);
        const value = (node as HTMLElement | null)?.innerText;
        return value ? value.trim() : null;
      };

      const title = textOf('[data-test="fop-title"]');
      if (!title) return;

      rows.push({
        href,
        title,
        text: (card.innerText ?? '').replace(/\n+/g, ' | '),
        price: textOf('[data-test="fop-price"]'),
        wasPrice: textOf('[data-test="fop-original-price"]'),
        perUnit: textOf('[data-test="fop-price-per-unit"]'),
        badges: /more card/i.test(card.innerText ?? '') ? ['More Card'] : [],
      });
    });

    return rows;
  },

  parse(row: ScrapedRow): NormalisedProduct | null {
    const current = firstPrice(row.price);
    if (current === null) return null;

    const was = firstPrice(row.wasPrice);
    const hasMoreCard = (row.badges ?? []).some((badge) => /more card/i.test(badge));

    let offerKind: NormalisedProduct['offerKind'] = 'shelf';
    if (isMultibuy(row.text)) offerKind = 'multibuy';
    else if (hasMoreCard) offerKind = 'loyalty';
    else if (was !== null && was > current) offerKind = 'shelf_offer';

    // With a More Card price the tile shows the member price as the current
    // one, so the shelf price is the "was" figure beside it.
    const shelfPence = hasMoreCard ? (was ?? current) : current;
    const loyaltyPence = hasMoreCard && was !== null && current < was ? current : null;

    const pack = parsePackSize(row.title);
    // /products/<slug>/<sku>
    const sku = row.href.split('/').filter(Boolean).pop() ?? row.href;

    return {
      storeSlug: 'morrisons',
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
      inStock: !/out of stock|unavailable/i.test(row.text),
      raw: row,
    };
  },
};
