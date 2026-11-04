'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { storeName } from '@/data/catalogue';
import { loadCatalogue } from '@/data/client-data';
import { formatPence } from '@/lib/money';
import { effectivePrice } from '@/lib/pricing';
import type { Product, StorePrice } from '@/lib/types';

export function SearchView() {
  const [query, setQuery] = useState('');
  const [data, setData] = useState<{
    products: Map<number, Product>;
    prices: Map<number, StorePrice[]>;
  } | null>(null);

  useEffect(() => {
    const read = () => {
      setQuery(new URLSearchParams(window.location.search).get('q') ?? '');
    };
    read();
    window.addEventListener('popstate', read);
    return () => {
      window.removeEventListener('popstate', read);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void loadCatalogue().then((loaded) => {
      if (!cancelled) setData(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const results = useMemo(() => {
    if (!data || !query.trim()) return [];
    const needle = query.trim().toLowerCase();
    return [...data.products.values()]
      .filter((product) =>
        `${product.brand ?? ''} ${product.name} ${product.packLabel}`
          .toLowerCase()
          .includes(needle),
      )
      .slice(0, 40);
  }, [data, query]);

  return (
    <div className="mx-auto max-w-[1120px] px-5 py-10 sm:px-8">
      <h1 className="display m-0 mb-1 text-[32px]">
        {query.trim() ? `Results for “${query.trim()}”` : 'Search'}
      </h1>
      <p className="m-0 mb-8 text-[15px] text-ink-faint">
        {data === null
          ? 'Loading the catalogue…'
          : `${results.length} tracked ${results.length === 1 ? 'product' : 'products'}`}
      </p>

      {data !== null && results.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-6 text-ink-muted">
          Nothing tracked matches that yet. Phase 1 follows a curated catalogue rather than every
          product a supermarket sells.
        </p>
      ) : null}

      <ul className="m-0 list-none space-y-2.5 p-0">
        {results.map((product) => {
          const prices = data?.prices.get(product.id) ?? [];
          const best = prices
            .map((price) => ({ price, value: effectivePrice(price, 'loyalty_where_available') }))
            .filter((row): row is { price: StorePrice; value: number } => row.value !== null)
            .sort((a, b) => a.value - b.value)[0];

          return (
            <li key={product.id}>
              <Link
                href={`/product/${product.id}`}
                className="flex items-center justify-between gap-4 rounded-xl border border-line bg-surface px-4 py-3.5 text-ink no-underline hover:border-brand-tint-line"
              >
                <span className="min-w-0">
                  <span className="block text-[15px] font-semibold">
                    {product.brand ? `${product.brand} ` : ''}
                    {product.name}
                  </span>
                  <span className="block text-[13px] text-ink-faint">
                    {product.packLabel} · {product.category}
                  </span>
                </span>
                <span className="text-right">
                  <span className="num block text-base font-bold">
                    {best ? formatPence(best.value) : '—'}
                  </span>
                  <span className="block text-[12px] text-ink-faint">
                    {best ? `cheapest at ${storeName(best.price.storeSlug)}` : 'not priced'}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
