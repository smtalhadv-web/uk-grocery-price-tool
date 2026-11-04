import { describe, expect, it } from 'vitest';
import { firstPrice, isMultibuy, moneyTokens, offerEndDate } from './money-text';
import { morrisonsBrowserAdapter } from './morrisons';
import { sainsburysBrowserAdapter } from './sainsburys';
import { tescoBrowserAdapter } from './tesco';
import type { ScrapedRow } from './types';

/**
 * Every string below was captured from the live site on 2026-11-04, not
 * invented. That is the point: these tests fail the day a retailer changes
 * how a tile reads, which is the failure mode that would otherwise ship a
 * wrong price.
 */

describe('moneyTokens', () => {
  it('ignores unit prices in brackets', () => {
    const tokens = moneyTokens('£2.95 Clubcard Price | (£1.78/kg) | £3.30');
    expect(tokens.map((t) => t.pence)).toEqual([295, 330]);
  });

  it('ignores an unbracketed unit price', () => {
    expect(moneyTokens('£0.39 | £0.93/kg').map((t) => t.pence)).toEqual([39]);
  });

  it('keeps the text after an amount so a Clubcard price is identifiable', () => {
    const tokens = moneyTokens('£2.95 Clubcard Price | £3.30');
    expect(tokens[0]?.trailing.trim().startsWith('Clubcard Price')).toBe(true);
    expect(tokens[1]?.trailing.trim()).toBe('');
  });
});

describe('firstPrice', () => {
  it('takes the price, not the unit price glued to it', () => {
    // Sainsbury's price elements read "£3.90£2.35 / kg".
    expect(firstPrice('£3.90£2.35 / kg')).toBe(390);
    expect(firstPrice('37p93p / kg')).toBeNull();
  });

  it('is null for nothing', () => {
    expect(firstPrice(null)).toBeNull();
    expect(firstPrice('')).toBeNull();
  });
});

describe('isMultibuy', () => {
  it('spots the real wordings', () => {
    expect(isMultibuy('Any 2 for £7 Clubcard Price')).toBe(true);
    expect(isMultibuy('Offer name: Buy 3 for £4')).toBe(true);
    expect(isMultibuy('Now £3, Was £3.90')).toBe(false);
  });
});

describe('offerEndDate', () => {
  it('reads Tesco’s published window', () => {
    expect(
      offerEndDate('Offer valid for delivery from 27/10/2026 until 23/11/2026'),
    ).toBe('2026-11-23');
  });

  it('is null when no end date is published', () => {
    expect(offerEndDate('Now £3, Was £3.90')).toBeNull();
  });
});

/* ------------------------------------------------------------- Sainsbury's */

describe("Sainsbury's parse", () => {
  const plain: ScrapedRow = {
    href: '/groceries/product/heinz-baked-beans-in-a-rich-tomato-sauce-4-x-415g',
    title: 'Heinz Baked Beans in a Rich Tomato Sauce 4 x 415g',
    text: 'Add to Favourites | Heinz Baked Beans in a Rich Tomato Sauce 4 x 415g | 4.3/5(275) | £3.90£2.35 / kg | Add',
    price: '£3.90£2.35 / kg',
    memberPrice: null,
    badges: [],
  };

  const nectar: ScrapedRow = {
    href: '/groceries/product/rodds-250ml-maple-sea-salt-oat-latte',
    title: "Rodd's 250ml Maple Sea Salt Oat Latte",
    text: "Nectar price | Add to Favourites | Sponsored | Rodd's 250ml Maple Sea Salt Oat Latte | 4.7/5(10) | CHILLED | £1.70£6.80 / ltr | £2.20£8.80 / ltr | Add",
    price: '£2.20£8.80 / ltr',
    memberPrice: '£1.70£6.80 / ltr',
    badges: ['Nectar price'],
  };

  it('reads a plain shelf price', () => {
    const out = sainsburysBrowserAdapter.parse(plain);
    expect(out?.shelfPence).toBe(390);
    expect(out?.loyaltyPence).toBeNull();
    expect(out?.offerKind).toBe('shelf');
    expect(out?.packQty).toBe(1660);
  });

  it('separates the Nectar price from the shelf price', () => {
    const out = sainsburysBrowserAdapter.parse(nectar);
    expect(out?.shelfPence).toBe(220);
    expect(out?.loyaltyPence).toBe(170);
    expect(out?.offerKind).toBe('loyalty');
  });

  it('does not treat a contextual price as a member price without the badge', () => {
    const out = sainsburysBrowserAdapter.parse({
      ...nectar,
      text: 'Sponsored | some product | £1.70 | £2.20',
      badges: [],
    });
    expect(out?.loyaltyPence).toBeNull();
    expect(out?.offerKind).toBe('shelf_offer');
    expect(out?.shelfPence).toBe(170);
  });

  it('publishes no barcode, so the row carries none', () => {
    expect(sainsburysBrowserAdapter.parse(plain)?.ean).toBeNull();
  });
});

/* ---------------------------------------------------------------- Morrisons */

describe('Morrisons parse', () => {
  const onOffer: ScrapedRow = {
    href: '/products/heinz-baked-beans-4x415g/100369227',
    title: 'Heinz Baked Beans 4x415g',
    text: 'Heinz Baked Beans 4x415g | (59) | £3.00 | £3.90 | (£2.35/kg) | Offer name: Now £3, Was £3.90',
    price: '£3.00',
    wasPrice: '£3.90',
    perUnit: '(£2.35/kg)',
    badges: [],
  };

  const multibuy: ScrapedRow = {
    href: '/products/heinz-baked-beans-vegan-sausages-415g/100369228',
    title: 'Heinz Baked Beans & Vegan Sausages 415g',
    text: 'Heinz Baked Beans & Vegan Sausages 415g | £2.00 | (£4.82/kg) | Offer name: Buy 3 for £4',
    price: '£2.00',
    wasPrice: null,
    badges: [],
  };

  it('reads a straightforward offer', () => {
    const out = morrisonsBrowserAdapter.parse(onOffer);
    expect(out?.shelfPence).toBe(300);
    expect(out?.offerKind).toBe('shelf_offer');
    expect(out?.storeSku).toBe('100369227');
    expect(out?.packQty).toBe(1660);
  });

  it('keeps a multibuy out of the unit price', () => {
    const out = morrisonsBrowserAdapter.parse(multibuy);
    expect(out?.shelfPence).toBe(200);
    expect(out?.offerKind).toBe('multibuy');
  });

  it('splits a More Card price from the shelf price', () => {
    const out = morrisonsBrowserAdapter.parse({
      ...onOffer,
      text: 'Heinz Baked Beans 4x415g | More Card Price | £3.00 | £3.90',
      badges: ['More Card'],
    });
    expect(out?.shelfPence).toBe(390);
    expect(out?.loyaltyPence).toBe(300);
    expect(out?.offerKind).toBe('loyalty');
  });
});

/* -------------------------------------------------------------------- Tesco */

describe('Tesco parse', () => {
  const clubcard: ScrapedRow = {
    href: 'https://www.tesco.com/shop/en-GB/products/252004443',
    title: 'Heinz Baked Beans In Tomato Sauce 4X415g',
    text: 'Sponsored | Heinz Baked Beans In Tomato Sauce 4X415g | 4.4 (129) | More like this | £2.95 Clubcard Price | (£1.78/kg) | Offer valid for delivery from 27/10/2026 until 23/11/2026 | £3.30 | £1.99/kg',
  };

  const plain: ScrapedRow = {
    href: 'https://www.tesco.com/shop/en-GB/products/258510116',
    title: 'Tesco Baked Beans In Tomato Sauce 420G',
    text: 'Tesco Baked Beans In Tomato Sauce 420G | 3.4 (257) | More like this | £0.39 | £0.93/kg',
  };

  const clubcardMultibuy: ScrapedRow = {
    href: 'https://www.tesco.com/shop/en-GB/products/317202645',
    title: 'Heinz Baked Beans in Tomato Sauce 6x200G',
    text: 'Sponsored | Heinz Baked Beans in Tomato Sauce 6x200G | 4.9 (86) | Any 2 for £7 Clubcard Price - Selected Heinz Baked Beans In Tomato Sauce | Offer valid for delivery from 24/10/2026 until 23/11/2026 | £3.75 | £3.13/kg',
  };

  it('separates the Clubcard price from the shelf price', () => {
    const out = tescoBrowserAdapter.parse(clubcard);
    expect(out?.loyaltyPence).toBe(295);
    expect(out?.shelfPence).toBe(330);
    expect(out?.offerKind).toBe('loyalty');
    expect(out?.offerEndsOn).toBe('2026-11-23');
    expect(out?.storeSku).toBe('252004443');
  });

  it('reads a tile with no promotion', () => {
    const out = tescoBrowserAdapter.parse(plain);
    expect(out?.shelfPence).toBe(39);
    expect(out?.loyaltyPence).toBeNull();
    expect(out?.offerKind).toBe('shelf');
    expect(out?.offerEndsOn).toBeNull();
  });

  it('never turns a Clubcard multibuy into a unit price', () => {
    const out = tescoBrowserAdapter.parse(clubcardMultibuy);
    expect(out?.offerKind).toBe('multibuy');
    expect(out?.shelfPence).toBe(375);
    // £7 is the price of two, so it must not appear as this product's price.
    expect(out?.loyaltyPence).toBeNull();
  });

  it('records nothing rather than guessing when no unit price is shown', () => {
    const out = tescoBrowserAdapter.parse({
      href: 'https://www.tesco.com/shop/en-GB/products/1',
      title: 'Something 500g',
      text: 'Something 500g | Any 2 for £7 Clubcard Price',
    });
    expect(out).toBeNull();
  });

  it('reads the pack size out of the title', () => {
    expect(tescoBrowserAdapter.parse(clubcard)?.packQty).toBe(1660);
  });
});
