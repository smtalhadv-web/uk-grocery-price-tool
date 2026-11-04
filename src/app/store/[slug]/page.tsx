import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DealCard } from '@/components/deal-card';
import { Freshness } from '@/components/freshness';
import { STORES } from '@/data/catalogue';
import { repo } from '@/data/repository';
import type { StoreSlug } from '@/lib/types';

/** One page per retailer, rendered at build time — a static site has no filters. */
export function generateStaticParams() {
  return STORES.map((store) => ({ slug: store.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = STORES.find((candidate) => candidate.slug === slug);
  return { title: store ? `${store.name} offers` : 'Store' };
}

export default async function StorePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const store = STORES.find((candidate) => candidate.slug === slug);
  if (!store) notFound();

  const repository = await repo();
  const [deals, lastRefresh] = await Promise.all([
    repository.listDeals({
      basis: 'loyalty_where_available',
      limit: 24,
      store: store.slug as StoreSlug,
    }),
    repository.lastRefreshAt(),
  ]);

  return (
    <div className="mx-auto max-w-[1120px] px-5 py-9 sm:px-8">
      <div className="mb-5 flex flex-wrap items-baseline justify-between gap-4">
        <div>
          <h1 className="display m-0 text-[32px]">{store.name} offers</h1>
          <p className="m-0 mt-1 text-[13px]">
            <Freshness observedAt={lastRefresh} />
            {store.loyaltyScheme ? ` · ${store.loyaltyScheme} included` : ' · no loyalty price layer'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/"
            className="inline-flex min-h-11 items-center rounded-full border border-line bg-surface px-4 py-2.5 text-sm text-ink no-underline hover:border-ink"
          >
            All stores
          </Link>
          {STORES.map((other) => (
            <Link
              key={other.slug}
              href={`/store/${other.slug}`}
              aria-current={other.slug === store.slug ? 'true' : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2.5 text-sm no-underline ${
                other.slug === store.slug
                  ? 'border-ink bg-ink font-semibold text-paper'
                  : 'border-line bg-surface text-ink hover:border-ink'
              }`}
            >
              {other.name}
            </Link>
          ))}
        </div>
      </div>

      {deals.length === 0 ? (
        <p className="rounded-2xl border border-line bg-surface p-6 text-ink-muted">
          No offers above 10% are live at {store.name} right now.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {deals.map((deal) => (
            <DealCard key={`${deal.product.id}-${deal.storeSlug}`} deal={deal} />
          ))}
        </div>
      )}
    </div>
  );
}
