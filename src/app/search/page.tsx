import Link from 'next/link';
import { repo } from '@/data/repository';
import { formatPence } from '@/lib/money';
import { effectivePrice } from '@/lib/pricing';
import { storeName } from '@/data/catalogue';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Search' };

export default async function SearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = '' } = await searchParams;
  const repository = await repo();
  const products = q.trim() ? await repository.listProducts({ query: q, limit: 40 }) : [];
  const priceMap = await repository.getPricesForProducts(products.map((p) => p.id));

  return (
    <div className="mx-auto max-w-[1120px] px-5 py-10 sm:px-8">
      <h1 className="display m-0 mb-1 text-[32px]">
        {q.trim() ? `Results for “${q.trim()}”` : 'Search'}
      </h1>
      <p className="m-0 mb-8 text-[15px] text-ink-faint">
        {products.length} tracked {products.length === 1 ? 'product' : 'products'}
      </p>

      {products.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-6 text-ink-muted">
          Nothing tracked matches that yet. Phase 1 follows a curated catalogue rather than every
          product a supermarket sells.
        </p>
      ) : (
        <ul className="m-0 list-none space-y-2.5 p-0">
          {products.map((product) => {
            const prices = priceMap.get(product.id) ?? [];
            const best = prices
              .map((price) => ({
                price,
                value: effectivePrice(price, 'loyalty_where_available'),
              }))
              .filter((row): row is { price: (typeof prices)[number]; value: number } =>
                row.value !== null,
              )
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
      )}
    </div>
  );
}
