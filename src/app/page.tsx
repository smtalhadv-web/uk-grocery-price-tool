import Link from 'next/link';
import { DealCard } from '@/components/deal-card';
import { Freshness } from '@/components/freshness';
import { STARTER_BASKETS, STORES } from '@/data/catalogue';
import { repo } from '@/data/repository';
import { basketHref, parseBasis } from '@/lib/basket-url';
import { basketTotals } from '@/lib/pricing';
import { formatPence } from '@/lib/money';
import { SearchBox } from './search-box';

async function starterBasketPrices() {
  const repository = await repo();
  const stores = STORES.map((store) => store.slug);

  return Promise.all(
    STARTER_BASKETS.map(async (basket) => {
      const pricesByProduct = await repository.getPricesForProducts(
        basket.items.map((item) => item.productId),
      );
      const { totals } = basketTotals({
        lines: basket.items.map((item) => ({ productId: item.productId, qty: item.qty })),
        pricesByProduct,
        stores,
        basis: 'loyalty_where_available',
      });
      return { basket, best: totals[0] ?? null };
    }),
  );
}

export default async function HomePage() {
  // A static export renders one page, so the deals feed is unfiltered and the
  // store pills link to the per-store pages generated below.
  const basis = parseBasis(undefined);

  const repository = await repo();
  const [deals, starters, lastRefresh] = await Promise.all([
    repository.listDeals({ basis, limit: 12 }),
    starterBasketPrices(),
    repository.lastRefreshAt(),
  ]);

  return (
    <>
      <section className="mx-auto max-w-[1120px] px-5 pb-10 pt-12 sm:px-8 sm:pt-14">
        <div className="flex flex-wrap items-start gap-10">
          <div className="min-w-0 flex-[999_1_520px]">
            <p className="m-0 mb-3.5 text-[13px] uppercase tracking-[0.08em] text-ink-muted">
              Updated daily · {STORES.length} supermarkets
            </p>
            <h1 className="display m-0 mb-4 text-[40px] font-bold leading-[1.05] sm:text-[52px]">
              See where this week’s shop is cheapest.
            </h1>
            <p className="m-0 mb-7 max-w-[52ch] text-[17px] leading-relaxed text-ink-muted sm:text-lg">
              Put your usual items in one list. Every tracked store is priced overnight, so you
              can see the total at each, what is on offer right now, and until when.
            </p>

            <SearchBox />

            <p className="mt-3.5 text-sm text-ink-faint">
              Tracking {STORES.map((store) => store.name).join(', ')}. Shelf price and loyalty
              price are shown separately, never mixed in one total.
            </p>
          </div>

          <div className="min-w-[300px] flex-[1_1_320px] rounded-2xl border border-line bg-surface p-6">
            <h2 className="display m-0 mb-1 text-lg">Ready-made baskets</h2>
            <p className="m-0 mb-4 text-sm text-ink-faint">
              Start from a typical weekly shop, then edit it.
            </p>

            <div className="flex flex-col gap-2.5">
              {starters.map(({ basket, best }) => (
                <Link
                  key={basket.id}
                  href={basketHref(
                    basket.items.map((item) => ({ productId: item.productId, qty: item.qty })),
                  )}
                  className="flex min-h-11 items-center justify-between gap-3 rounded-xl border border-line px-4 py-3.5 text-ink no-underline hover:border-brand-tint-line"
                >
                  <span>
                    <span className="block text-[15px] font-semibold">{basket.name}</span>
                    <span className="block text-[13px] text-ink-faint">
                      {basket.items.length} everyday items
                    </span>
                  </span>
                  <span className="num text-sm font-semibold text-brand">
                    {best ? formatPence(best.totalPence) : '—'}
                  </span>
                </Link>
              ))}

              <Link
                href="/basket"
                className="flex min-h-11 items-center justify-center rounded-xl border border-dashed border-line px-4 py-3.5 text-[15px] font-semibold text-brand no-underline hover:border-brand"
              >
                Build a custom basket
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1120px] px-5 pb-16 sm:px-8">
        <div className="mb-5 flex flex-wrap items-baseline justify-between gap-4">
          <div>
            <h2 className="display m-0 text-[28px]">Biggest drops this week</h2>
            <p className="m-0 mt-1 text-[13px]">
              <Freshness observedAt={lastRefresh} />
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <StoreFilterLink label="All stores" href="/" active />
            {STORES.map((store) => (
              <StoreFilterLink
                key={store.slug}
                label={store.name}
                href={`/store/${store.slug}`}
                active={false}
              />
            ))}
          </div>
        </div>

        {deals.length === 0 ? (
          <p className="rounded-2xl border border-line bg-surface p-6 text-ink-muted">
            No offers above 10% are live for this filter right now.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {deals.map((deal) => (
              <DealCard key={`${deal.product.id}-${deal.storeSlug}`} deal={deal} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function StoreFilterLink({
  label,
  href,
  active,
}: {
  label: string;
  href: string;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'true' : undefined}
      className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2.5 text-sm no-underline ${
        active
          ? 'border-ink bg-ink font-semibold text-paper'
          : 'border-line bg-surface text-ink hover:border-ink'
      }`}
    >
      {label}
    </Link>
  );
}
