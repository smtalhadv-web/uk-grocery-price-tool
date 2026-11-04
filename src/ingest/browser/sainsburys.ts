import { parsePackSize } from '../normalise';
import type { NormalisedProduct } from '../types';
import { firstPrice, isMultibuy, offerEndDate } from './money-text';
import type { BrowserRetailerAdapter, ScrapedRow } from './types';

/**
 * Sainsbury's.
 *
 * Verified live on 2026-11-04. The site is server-rendered React with no
 * usable JSON endpoint, but it carries stable `data-testid` hooks:
 *
 *   gw-product-card          one tile
 *   gw-product-name          title
 *   gw-product-retail-price  the shelf price
 *   gw-product-contextual-price  the price actually charged in this context
 *   gw-nectar-offer-badge    present only when that context is a Nectar price
 *
 * When a Nectar offer is on, retail-price holds the shelf price and
 * contextual-price holds the member price, which is exactly the pair the
 * comparison needs (R3).
 *
 * Price elements also contain the unit price ("£3.90£2.35 / kg"), so only the
 * first amount is taken.
 */

const BASE = 'https://www.sainsburys.co.uk';

export const sainsburysBrowserAdapter: BrowserRetailerAdapter = {
  slug: 'sainsburys',
  name: "Sainsbury's",
  loyaltyScheme: 'Nectar price',

  searchUrl(term: string) {
    return `${BASE}/groceries/search?searchTerm=${encodeURIComponent(term)}`;
  },

  extract: () => {
    const rows: { href: string; title: string; text: string; price?: string | null; memberPrice?: string | null; perUnit?: string | null; badges?: string[] }[] = [];
    const seen = new Set<string>();

    document.querySelectorAll('[data-testid="gw-product-card"]').forEach((card) => {
      const anchor = card.querySelector('a[href*="/groceries/product/"]');
      const href = (anchor?.getAttribute('href') ?? '').split('?')[0] ?? '';
      if (!href || seen.has(href)) return;
      seen.add(href);

      const textOf = (selector: string): string | null => {
        const node = card.querySelector(selector);
        const value = (node as HTMLElement | null)?.innerText;
        return value ? value.trim() : null;
      };

      const title = textOf('[data-testid="gw-product-name"]') ?? (anchor as HTMLElement | null)?.innerText?.trim() ?? '';
      if (!title) return;

      const badges: string[] = [];
      card.querySelectorAll('[data-testid]').forEach((node) => {
        const id = node.getAttribute('data-testid') ?? '';
        if (/badge/i.test(id)) {
          const label = (node as HTMLElement).innerText?.trim();
          if (label) badges.push(label);
        }
      });

      rows.push({
        href,
        title,
        text: ((card as HTMLElement).innerText ?? '').replace(/\n+/g, ' | '),
        price: textOf('[data-testid="gw-product-retail-price"]'),
        memberPrice: textOf('[data-testid="gw-product-contextual-price"]'),
        badges,
      });
    });

    return rows;
  },

  parse(row: ScrapedRow): NormalisedProduct | null {
    const shelfPence = firstPrice(row.price);
    if (shelfPence === null) return null;

    const contextual = firstPrice(row.memberPrice);
    const badgeText = (row.badges ?? []).join(' ');
    const hasNectarBadge = /nectar/i.test(badgeText) || /nectar price/i.test(row.text);

    // A contextual price only counts as a member price when the Nectar badge
    // says so. Otherwise it is an ordinary promotion open to everyone.
    const loyaltyPence =
      hasNectarBadge && contextual !== null && contextual < shelfPence ? contextual : null;

    const promoPence =
      !hasNectarBadge && contextual !== null && contextual < shelfPence ? contextual : null;

    let offerKind: NormalisedProduct['offerKind'] = 'shelf';
    if (isMultibuy(row.text)) offerKind = 'multibuy';
    else if (loyaltyPence !== null) offerKind = 'loyalty';
    else if (promoPence !== null || /price match|offer/i.test(badgeText)) offerKind = 'shelf_offer';

    const pack = parsePackSize(row.title);
    const slug = row.href.split('/').filter(Boolean).pop() ?? row.href;

    return {
      storeSlug: 'sainsburys',
      storeSku: slug,
      storeUrl: row.href.startsWith('http') ? row.href : `${BASE}${row.href}`,
      title: row.title,
      brand: null, // the tile does not separate the brand from the title
      ean: null, // not published anywhere on the page
      packLabel: pack?.label ?? '',
      packQty: pack?.qty ?? null,
      packUnit: pack?.unit ?? null,
      // An everyday promotion is the price everyone pays, so it replaces shelf.
      shelfPence: promoPence ?? shelfPence,
      loyaltyPence,
      offerKind,
      offerEndsOn: offerEndDate(row.text),
      inStock: !/out of stock|unavailable/i.test(row.text),
      raw: row,
    };
  },
};
