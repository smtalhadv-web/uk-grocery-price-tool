import { describe, expect, it } from 'vitest';
import type { DailyPrice, StorePrice, StoreSlug } from '../types';
import {
  basketTotals,
  effectivePrice,
  goodTimeToBuy,
  isStale,
  lowestSeen,
  median,
  shouldSendDigest,
  splitTotal,
  typicalPrice,
} from './index';

const NOW = new Date('2026-11-04T09:00:00Z').toISOString();

function price(partial: Partial<StorePrice> & { storeSlug: StoreSlug }): StorePrice {
  return {
    storeSku: 'sku',
    storeUrl: 'https://example.invalid/p',
    observedAt: NOW,
    shelfPence: 100,
    loyaltyPence: null,
    offerKind: 'shelf',
    offerEndsOn: null,
    offerFirstSeenOn: null,
    inStock: true,
    ...partial,
  };
}

function day(offsetDays: number): string {
  return new Date(Date.now() - offsetDays * 86_400_000).toISOString().slice(0, 10);
}

describe('effectivePrice', () => {
  it('uses the shelf price on the shelf basis even when a loyalty price exists', () => {
    const p = price({ storeSlug: 'tesco', shelfPence: 450, loyaltyPence: 300 });
    expect(effectivePrice(p, 'shelf')).toBe(450);
  });

  it('prefers the loyalty price on the loyalty basis', () => {
    const p = price({ storeSlug: 'tesco', shelfPence: 450, loyaltyPence: 300 });
    expect(effectivePrice(p, 'loyalty_where_available')).toBe(300);
  });

  it('falls back to shelf when the store runs no loyalty price', () => {
    const p = price({ storeSlug: 'asda', shelfPence: 340, loyaltyPence: null });
    expect(effectivePrice(p, 'loyalty_where_available')).toBe(340);
  });

  it('returns null when out of stock rather than a last-known price', () => {
    const p = price({ storeSlug: 'asda', inStock: false });
    expect(effectivePrice(p, 'shelf')).toBeNull();
  });
});

describe('median', () => {
  it('handles odd and even counts', () => {
    expect(median([100, 300, 200])).toBe(200);
    expect(median([100, 200, 300, 400])).toBe(250);
  });

  it('returns null for an empty window', () => {
    expect(median([])).toBeNull();
  });
});

describe('typicalPrice and lowestSeen', () => {
  const history: DailyPrice[] = [
    { day: day(1), storeSlug: 'tesco', shelfPence: 300, loyaltyPence: null },
    { day: day(2), storeSlug: 'tesco', shelfPence: 450, loyaltyPence: null },
    { day: day(3), storeSlug: 'tesco', shelfPence: 450, loyaltyPence: null },
    { day: day(4), storeSlug: 'tesco', shelfPence: 435, loyaltyPence: null },
    { day: day(400), storeSlug: 'tesco', shelfPence: 100, loyaltyPence: null },
  ];

  it('ignores days outside the window', () => {
    expect(typicalPrice(history, 'shelf', 90)).toBe(442);
    expect(lowestSeen(history, 'shelf', 90)).toBe(300);
  });

  it('is not dragged down by one deep promotion', () => {
    const withSpike: DailyPrice[] = [
      ...history.slice(0, 4),
      { day: day(5), storeSlug: 'tesco', shelfPence: 99, loyaltyPence: null },
    ];
    expect(typicalPrice(withSpike, 'shelf', 90)).toBe(435);
  });
});

describe('goodTimeToBuy', () => {
  it('is true well under typical and near the floor', () => {
    expect(goodTimeToBuy({ now: 300, typical: 435, lowest: 285 })).toBe(true);
  });

  it('is false at a shallow discount', () => {
    expect(goodTimeToBuy({ now: 400, typical: 435, lowest: 285 })).toBe(false);
  });

  it('is false without history rather than optimistic', () => {
    expect(goodTimeToBuy({ now: 300, typical: null, lowest: null })).toBe(false);
  });
});

describe('basketTotals', () => {
  const stores: StoreSlug[] = ['asda', 'morrisons', 'sainsburys', 'tesco'];

  const pricesByProduct = new Map<number, StorePrice[]>([
    [
      1,
      [
        price({ storeSlug: 'asda', shelfPence: 145 }),
        price({ storeSlug: 'morrisons', shelfPence: 150 }),
        price({ storeSlug: 'sainsburys', shelfPence: 169 }),
        price({ storeSlug: 'tesco', shelfPence: 175, loyaltyPence: 155 }),
      ],
    ],
    [
      2,
      [
        price({ storeSlug: 'asda', shelfPence: 340 }),
        price({ storeSlug: 'tesco', shelfPence: 450, loyaltyPence: 300 }),
        price({ storeSlug: 'morrisons', shelfPence: 350, inStock: false }),
      ],
    ],
  ]);

  it('totals each store on the shelf basis', () => {
    const { totals } = basketTotals({
      lines: [
        { productId: 1, qty: 1 },
        { productId: 2, qty: 2 },
      ],
      pricesByProduct,
      stores,
      basis: 'shelf',
    });

    const asda = totals.find((t) => t.storeSlug === 'asda');
    expect(asda?.totalPence).toBe(145 + 340 * 2);
    expect(asda?.itemsPriced).toBe(2);
  });

  it('switches every store together when the basis changes (R3)', () => {
    const { totals } = basketTotals({
      lines: [
        { productId: 1, qty: 1 },
        { productId: 2, qty: 1 },
      ],
      pricesByProduct,
      stores,
      basis: 'loyalty_where_available',
    });

    const tesco = totals.find((t) => t.storeSlug === 'tesco');
    const asda = totals.find((t) => t.storeSlug === 'asda');
    // Tesco uses its loyalty prices; Asda has none so it stays on shelf.
    expect(tesco?.totalPence).toBe(155 + 300);
    expect(asda?.totalPence).toBe(145 + 340);
  });

  it('counts missing items instead of quietly dropping them', () => {
    const { totals } = basketTotals({
      lines: [
        { productId: 1, qty: 1 },
        { productId: 2, qty: 1 },
      ],
      pricesByProduct,
      stores,
      basis: 'shelf',
    });

    const sainsburys = totals.find((t) => t.storeSlug === 'sainsburys');
    expect(sainsburys?.itemsPriced).toBe(1);
    expect(sainsburys?.itemsRequested).toBe(2);
    expect(sainsburys?.missingProductIds).toEqual([2]);

    const morrisons = totals.find((t) => t.storeSlug === 'morrisons');
    expect(morrisons?.missingProductIds).toEqual([2]);
  });

  it('does not let a store win by supplying fewer items', () => {
    const { totals } = basketTotals({
      lines: [
        { productId: 1, qty: 1 },
        { productId: 2, qty: 1 },
      ],
      pricesByProduct,
      stores,
      basis: 'shelf',
    });

    expect(totals[0]?.itemsPriced).toBe(2);
  });

  it('marks the cheapest store per line', () => {
    const { lines } = basketTotals({
      lines: [{ productId: 1, qty: 1 }],
      pricesByProduct,
      stores,
      basis: 'shelf',
    });

    expect(lines[0]?.cheapestStore).toBe('asda');
    expect(lines[0]?.cheapestPence).toBe(145);
  });
});

describe('splitTotal', () => {
  it('sums the per-item cheapest and counts the trips', () => {
    const result = splitTotal([
      {
        productId: 1,
        qty: 1,
        byStore: { asda: 145, tesco: 175 },
        cheapestStore: 'asda',
        cheapestPence: 145,
      },
      {
        productId: 2,
        qty: 2,
        byStore: { asda: 340, tesco: 300 },
        cheapestStore: 'tesco',
        cheapestPence: 300,
      },
    ]);

    expect(result.totalPence).toBe(145 + 600);
    expect(result.storesNeeded).toBe(2);
    expect(result.itemsPriced).toBe(2);
  });
});

describe('isStale', () => {
  const now = new Date('2026-11-04T12:00:00Z');

  it('accepts a fresh observation', () => {
    expect(isStale('2026-11-04T04:00:00Z', now)).toBe(false);
  });

  it('flags an old observation', () => {
    expect(isStale('2026-11-01T04:00:00Z', now)).toBe(true);
  });
});

describe('shouldSendDigest', () => {
  const now = new Date('2026-11-04T08:00:00Z');

  it('sends the first digest once there is enough on offer', () => {
    expect(
      shouldSendDigest({ lastSentAt: null, reminderDays: 14, itemsBelowTypical: 4, now }),
    ).toBe(true);
  });

  it('stays quiet when too little is on offer', () => {
    expect(
      shouldSendDigest({ lastSentAt: null, reminderDays: 14, itemsBelowTypical: 1, now }),
    ).toBe(false);
  });

  it('respects the household interval', () => {
    expect(
      shouldSendDigest({
        lastSentAt: '2026-10-30T08:00:00Z',
        reminderDays: 14,
        itemsBelowTypical: 5,
        now,
      }),
    ).toBe(false);

    expect(
      shouldSendDigest({
        lastSentAt: '2026-10-18T08:00:00Z',
        reminderDays: 14,
        itemsBelowTypical: 5,
        now,
      }),
    ).toBe(true);
  });
});
