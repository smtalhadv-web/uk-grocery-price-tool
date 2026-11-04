import { describe, expect, it } from 'vitest';
import { basketHref, parseBasis, parseItems, serialiseItems, setQty, withItem } from './basket-url';

describe('parseItems', () => {
  it('parses id and quantity pairs', () => {
    expect(parseItems('1x2,14x1')).toEqual([
      { productId: 1, qty: 2 },
      { productId: 14, qty: 1 },
    ]);
  });

  it('defaults a missing quantity to one', () => {
    expect(parseItems('7')).toEqual([{ productId: 7, qty: 1 }]);
  });

  it('drops junk instead of throwing on a hand-edited URL', () => {
    expect(parseItems('abc,0x3,-1x2,5xNaN,9x2')).toEqual([{ productId: 9, qty: 2 }]);
    expect(parseItems('')).toEqual([]);
    expect(parseItems(null)).toEqual([]);
  });

  it('de-duplicates and caps the quantity', () => {
    expect(parseItems('3x2,3x5')).toEqual([{ productId: 3, qty: 2 }]);
    expect(parseItems('3x999')).toEqual([{ productId: 3, qty: 20 }]);
  });
});

describe('withItem and setQty', () => {
  it('adds a new product', () => {
    expect(withItem([], 4)).toEqual([{ productId: 4, qty: 1 }]);
  });

  it('increments an existing product', () => {
    expect(withItem([{ productId: 4, qty: 2 }], 4)).toEqual([{ productId: 4, qty: 3 }]);
  });

  it('removes a product when the quantity hits zero', () => {
    expect(setQty([{ productId: 4, qty: 1 }], 4, 0)).toEqual([]);
  });
});

describe('serialiseItems and basketHref', () => {
  it('round-trips', () => {
    const items = [
      { productId: 1, qty: 2 },
      { productId: 9, qty: 1 },
    ];
    expect(parseItems(serialiseItems(items))).toEqual(items);
  });

  it('only adds the basis param when it is not the default', () => {
    const items = [{ productId: 1, qty: 1 }];
    expect(basketHref(items)).toBe('/basket?items=1x1');
    expect(basketHref(items, 'shelf')).toBe('/basket?items=1x1&basis=shelf');
    expect(basketHref([])).toBe('/basket');
  });
});

describe('parseBasis', () => {
  it('defaults to loyalty where available', () => {
    expect(parseBasis(undefined)).toBe('loyalty_where_available');
    expect(parseBasis('nonsense')).toBe('loyalty_where_available');
    expect(parseBasis('shelf')).toBe('shelf');
  });
});
