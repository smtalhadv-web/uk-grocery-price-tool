import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Freshness } from '@/components/freshness';
import { OfferWindow, offerKindLabel } from '@/components/offer-window';
import { PriceChart } from '@/components/price-chart';
import { storeName } from '@/data/catalogue';
import { repo } from '@/data/repository';
import { basketHref, parseBasis } from '@/lib/basket-url';
import { formatPence, unitPrice } from '@/lib/money';
import { effectivePrice, goodTimeToBuy, lowestSeen, typicalPrice } from '@/lib/pricing';
import type { StoreSlug } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function ProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ basis?: string; store?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const basis = parseBasis(query.basis);
  const productId = Number(id);
  if (!Number.isInteger(productId)) notFound();

  const repository = await repo();
  const product = await repository.getProduct(productId);
  if (!product) notFound();

  const [prices, history] = await Promise.all([
    repository.getPrices(productId),
    repository.getHistory(productId),
  ]);

  const rows = prices
    .map((price) => {
      const value = effectivePrice(price, basis);
      const storeHistory = history.filter((row) => row.storeSlug === price.storeSlug);
      return {
        price,
        value,
        typical: typicalPrice(storeHistory, basis),
        lowest: lowestSeen(storeHistory, basis),
      };
    })
    .sort((a, b) => {
      if (a.value === null) return 1;
      if (b.value === null) return -1;
      return a.value - b.value;
    });

  const best = rows.find((row) => row.value !== null) ?? null;
  const chartStore = (query.store as StoreSlug | undefined) ?? best?.price.storeSlug ?? null;
  const chartHistory = chartStore
    ? history.filter((row) => row.storeSlug === chartStore)
    : [];

  const buyNow =
    best?.value != null &&
    goodTimeToBuy({ now: best.value, typical: best.typical, lowest: best.lowest });

  return (
    <div className="mx-auto max-w-[1120px] px-5 py-9 sm:px-8">
      <p className="m-0 mb-2.5 text-[13px] text-ink-faint">
        <Link href="/" className="text-brand no-underline hover:text-brand-deep">
          Deals
        </Link>{' '}
        · {product.category}
      </p>

      <h1 className="display m-0 mb-1.5 text-[32px] sm:text-[38px]">
        {product.brand ? `${product.brand} ` : ''}
        {product.name}, {product.packLabel}
      </h1>
      <p className="m-0 mb-8 text-[15px] text-ink-faint">
        {product.ean ? 'Matched across stores by barcode' : 'Matched by name and pack size'} ·{' '}
        <Freshness observedAt={best?.price.observedAt ?? null} />
      </p>

      <div className="flex flex-wrap items-start gap-6">
        <section className="min-w-0 flex-[999_1_560px] rounded-2xl border border-line bg-surface p-6">
          <div className="mb-5 flex flex-wrap items-baseline justify-between gap-4">
            <h2 className="display m-0 text-xl">
              Price over the last 90 days{chartStore ? ` at ${storeName(chartStore)}` : ''}
            </h2>
            <div className="flex flex-wrap gap-1.5">
              {prices.map((price) => (
                <Link
                  key={price.storeSlug}
                  href={`/product/${product.id}?store=${price.storeSlug}${
                    basis === 'shelf' ? '&basis=shelf' : ''
                  }`}
                  aria-current={chartStore === price.storeSlug ? 'true' : undefined}
                  className={`inline-flex min-h-11 items-center rounded-full border px-3.5 py-2 text-[13px] no-underline ${
                    chartStore === price.storeSlug
                      ? 'border-ink bg-ink font-semibold text-paper'
                      : 'border-line bg-surface text-ink hover:border-ink'
                  }`}
                >
                  {storeName(price.storeSlug)}
                </Link>
              ))}
            </div>
          </div>

          <PriceChart history={chartHistory} basis={basis} days={90} />

          <dl className="m-0 mt-5 flex flex-wrap gap-6 border-t border-line-soft pt-5">
            <Stat label="Lowest seen" value={formatPence(best?.lowest ?? null)} />
            <Stat label="Typical" value={formatPence(best?.typical ?? null)} />
            <Stat
              label="Cheapest today"
              value={formatPence(best?.value ?? null)}
              highlight
            />
            <Stat
              label="Offer"
              value={
                best ? (
                  <OfferWindow
                    endsOn={best.price.offerEndsOn}
                    firstSeenOn={best.price.offerFirstSeenOn}
                  />
                ) : (
                  '—'
                )
              }
            />
          </dl>
        </section>

        <aside className="flex min-w-[300px] flex-[1_1_320px] flex-col gap-4">
          <section className="rounded-2xl border border-line bg-surface p-6">
            <h2 className="display m-0 mb-4 text-lg">Today, by store</h2>
            <ul className="m-0 list-none space-y-3 p-0">
              {rows.map(({ price, value }) => {
                const unit = value === null ? null : unitPrice(value, product.packQty, product.packUnit);
                const isBest = best?.price.storeSlug === price.storeSlug;
                return (
                  <li
                    key={price.storeSlug}
                    className="flex items-center justify-between gap-3 border-b border-line-soft pb-3 last:border-0 last:pb-0"
                  >
                    <span className="min-w-0">
                      <span className="block text-[15px] font-medium">
                        {storeName(price.storeSlug)}
                      </span>
                      <span className="block text-[12px] text-ink-faint">
                        {offerKindLabel(price.offerKind)}
                        {price.loyaltyPence !== null && basis !== 'shelf'
                          ? ` · ${formatPence(price.shelfPence)} without`
                          : ''}
                        {!price.inStock ? ' · out of stock' : ''}
                      </span>
                    </span>
                    <span className="text-right">
                      <span
                        className={`num block text-[17px] font-bold ${
                          isBest ? 'text-brand' : 'text-ink'
                        }`}
                      >
                        {formatPence(value)}
                        {isBest ? <span className="sr-only"> — cheapest</span> : null}
                      </span>
                      <span className="block text-[12px] text-ink-faint">{unit?.text ?? ''}</span>
                    </span>
                  </li>
                );
              })}
            </ul>
          </section>

          <section
            className={`rounded-2xl p-6 ${
              buyNow ? 'bg-ink text-paper' : 'border border-line bg-surface text-ink'
            }`}
          >
            <p className="m-0 mb-2 text-[15px] font-semibold">
              {buyNow ? 'Good time to buy' : 'Nothing special about today’s price'}
            </p>
            <p
              className={`m-0 mb-4 text-sm leading-relaxed ${
                buyNow ? 'text-[#c9d4cf]' : 'text-ink-muted'
              }`}
            >
              {best?.value != null && best.typical != null
                ? buyNow
                  ? `${formatPence(best.value)} is well under the typical ${formatPence(best.typical)} and close to the lowest price we have recorded in 90 days.`
                  : `Typical is ${formatPence(best.typical)} and the lowest we have recorded in 90 days is ${formatPence(best.lowest)}.`
                : 'Not enough price history yet to judge.'}
            </p>
            <Link
              href={basketHref([{ productId: product.id, qty: 1 }], basis)}
              className={`inline-flex min-h-12 w-full items-center justify-center rounded-xl px-4 text-[15px] font-semibold no-underline ${
                buyNow ? 'bg-paper text-ink' : 'bg-brand text-white hover:bg-brand-deep'
              }`}
            >
              Add to a basket
            </Link>
          </section>

          {best ? (
            <p className="m-0 text-[13px] text-ink-faint">
              <a
                href={best.price.storeUrl}
                rel="nofollow noopener"
                className="text-brand hover:text-brand-deep"
              >
                View at {storeName(best.price.storeSlug)}
              </a>{' '}
              — prices can change at any time.
            </p>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

function Stat({
  label,
  value,
  highlight,
}: {
  label: string;
  value: React.ReactNode;
  highlight?: boolean;
}) {
  return (
    <div>
      <dt className="m-0 mb-1 text-[13px] text-ink-faint">{label}</dt>
      <dd
        className={`num m-0 text-xl font-bold ${highlight ? 'text-brand' : 'text-ink'}`}
      >
        {value}
      </dd>
    </div>
  );
}
