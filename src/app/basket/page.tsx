import Link from 'next/link';
import { Freshness } from '@/components/freshness';
import { STARTER_BASKETS, STORES, storeName } from '@/data/catalogue';
import { repo } from '@/data/repository';
import { basketHref, parseBasis, parseItems, setQty } from '@/lib/basket-url';
import { formatDelta, formatPence } from '@/lib/money';
import { basketTotals, splitTotal } from '@/lib/pricing';
import type { PriceBasis, StoreSlug } from '@/lib/types';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Compare a basket' };

const STORE_SLUGS = STORES.map((store) => store.slug);

export default async function BasketPage({
  searchParams,
}: {
  searchParams: Promise<{ items?: string; basis?: string; preset?: string }>;
}) {
  const params = await searchParams;
  const basis = parseBasis(params.basis);

  const preset = STARTER_BASKETS.find((basket) => basket.id === params.preset);
  const items = params.items
    ? parseItems(params.items)
    : preset
      ? preset.items.map((item) => ({ productId: item.productId, qty: item.qty }))
      : [];

  if (items.length === 0) {
    return <EmptyBasket />;
  }

  const repository = await repo();
  const pricesByProduct = await repository.getPricesForProducts(
    items.map((item) => item.productId),
  );
  const products = await Promise.all(
    items.map((item) => repository.getProduct(item.productId)),
  );
  const productById = new Map(
    products.filter((product) => product !== null).map((product) => [product.id, product]),
  );

  const { totals, lines } = basketTotals({
    lines: items,
    pricesByProduct,
    stores: STORE_SLUGS,
    basis,
  });
  const split = splitTotal(lines);

  const winner = totals[0] ?? null;
  const oldest = totals
    .map((total) => total.oldestObservedAt)
    .filter((value): value is string => value !== null)
    .sort()[0] ?? null;

  return (
    <div className="mx-auto max-w-[1120px] px-5 py-9 sm:px-8">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="display m-0 mb-1.5 text-[32px] sm:text-[36px]">
            {preset ? preset.name : 'My basket'}
          </h1>
          <p className="m-0 text-[15px] text-ink-faint">
            {items.length} {items.length === 1 ? 'item' : 'items'} ·{' '}
            <Freshness observedAt={oldest} />
          </p>
        </div>
        <BasisToggle current={basis} items={items} />
      </div>

      <div className="mb-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {totals.map((total, index) => {
          const isWinner = index === 0;
          const incomplete = total.itemsPriced < total.itemsRequested;
          // A delta is only meaningful between stores pricing the same items.
          // Comparing a short basket to a full one would make a store that
          // cannot supply your list look like the cheap option (R2).
          const comparable = winner !== null && total.itemsPriced === winner.itemsPriced;
          const delta = winner ? total.totalPence - winner.totalPence : 0;
          return (
            <div
              key={total.storeSlug}
              className={`rounded-2xl border p-5 ${
                isWinner ? 'border-ink bg-ink text-paper' : 'border-line bg-surface text-ink'
              }`}
            >
              <p className={`m-0 mb-2.5 text-sm font-semibold ${isWinner ? 'text-paper' : ''}`}>
                {storeName(total.storeSlug)}
              </p>
              <p className="display num m-0 mb-2 text-[32px] font-bold">
                {formatPence(total.totalPence)}
              </p>
              <p
                className={`m-0 text-[13px] ${isWinner ? 'text-brand-on-dark' : 'text-ink-faint'}`}
              >
                {isWinner
                  ? 'Cheapest for the most items'
                  : comparable
                    ? formatDelta(delta)
                    : 'Fewer items — totals not comparable'}
              </p>
              <p
                className={`m-0 mt-1 text-[13px] ${
                  incomplete && !isWinner
                    ? 'font-semibold text-save'
                    : isWinner
                      ? 'text-brand-on-dark'
                      : 'text-ink-faint'
                }`}
              >
                {total.itemsPriced} of {total.itemsRequested} items priced
              </p>
            </div>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <caption className="sr-only">
            Price of each item at each store. The cheapest price in a row is marked “cheapest”.
          </caption>
          <thead>
            <tr className="border-b border-line bg-sunk text-[12px] uppercase tracking-[0.06em] text-ink-muted">
              <th scope="col" className="px-6 py-3.5 font-medium">
                Item
              </th>
              {STORE_SLUGS.map((slug) => (
                <th key={slug} scope="col" className="px-6 py-3.5 text-right font-medium">
                  {storeName(slug)}
                </th>
              ))}
              <th scope="col" className="px-6 py-3.5 text-right font-medium">
                Qty
              </th>
            </tr>
          </thead>
          <tbody>
            {lines.map((line) => {
              const product = productById.get(line.productId);
              return (
                <tr key={line.productId} className="border-b border-line-soft">
                  <th scope="row" className="px-6 py-3.5 font-normal">
                    <Link
                      href={`/product/${line.productId}`}
                      className="text-[15px] font-medium text-ink no-underline hover:text-brand"
                    >
                      {product
                        ? `${product.brand ? `${product.brand} ` : ''}${product.name}`
                        : `Product ${line.productId}`}
                    </Link>
                    <span className="block text-[12px] text-ink-faint">
                      {product?.packLabel ?? ''}
                    </span>
                  </th>

                  {STORE_SLUGS.map((slug) => {
                    const value = line.byStore[slug] ?? null;
                    const cheapest = line.cheapestStore === slug;
                    return (
                      <td
                        key={slug}
                        className={`num px-6 py-3.5 text-right text-[15px] ${
                          cheapest ? 'font-bold text-brand' : 'text-ink-muted'
                        }`}
                      >
                        {formatPence(value)}
                        {cheapest ? <span className="sr-only"> — cheapest</span> : null}
                        {value === null ? <span className="sr-only">not available</span> : null}
                      </td>
                    );
                  })}

                  <td className="px-6 py-3.5 text-right">
                    <QtyControls items={items} productId={line.productId} qty={line.qty} basis={basis} />
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-sunk">
              <th scope="row" className="px-6 py-4 text-[15px] font-semibold">
                Basket total
              </th>
              {STORE_SLUGS.map((slug) => {
                const total = totals.find((row) => row.storeSlug === slug);
                const isWinner = winner?.storeSlug === slug;
                const incomplete =
                  total !== undefined && total.itemsPriced < total.itemsRequested;
                return (
                  <td
                    key={slug}
                    className={`num px-6 py-4 text-right text-[17px] font-bold ${
                      isWinner ? 'text-brand' : 'text-ink'
                    }`}
                  >
                    {total ? formatPence(total.totalPence) : '—'}
                    {incomplete ? (
                      <span className="num block text-[11px] font-normal text-save">
                        {total.itemsPriced}/{total.itemsRequested} items
                      </span>
                    ) : null}
                  </td>
                );
              })}
              <td />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-6 flex flex-wrap gap-4">
        <div className="flex-[999_1_420px] rounded-2xl border border-brand-tint-line bg-brand-tint p-5">
          <p className="m-0 mb-1.5 text-base font-semibold">
            {winner
              ? `One-store winner: ${storeName(winner.storeSlug)} at ${formatPence(winner.totalPence)}`
              : 'No store can price this basket yet'}
          </p>
          <p className="m-0 text-sm leading-relaxed text-ink-muted">
            Buying each item wherever it is cheapest comes to{' '}
            <strong className="num font-semibold text-ink">
              {formatPence(split.totalPence)}
            </strong>{' '}
            — {winner ? formatDelta(split.totalPence - winner.totalPence) : '—'} against one shop,
            but it means {split.storesNeeded} {split.storesNeeded === 1 ? 'trip' : 'trips'}.
          </p>
        </div>

        <div className="flex-[1_1_280px] rounded-2xl border border-line bg-surface p-5">
          <p className="m-0 mb-2 text-sm font-semibold">What these prices are</p>
          <p className="m-0 text-[13px] leading-relaxed text-ink-muted">
            {basis === 'shelf'
              ? 'Shelf prices only — what anyone pays without a loyalty card.'
              : 'Loyalty price where the store publishes one, shelf price everywhere else. Every store on this page uses the same basis.'}
          </p>
        </div>
      </div>
    </div>
  );
}

function BasisToggle({
  current,
  items,
}: {
  current: PriceBasis;
  items: readonly { productId: number; qty: number }[];
}) {
  return (
    <fieldset className="m-0 flex flex-wrap gap-2 border-0 p-0">
      <legend className="sr-only">Price basis</legend>
      {(
        [
          { value: 'loyalty_where_available', label: 'Loyalty price where offered' },
          { value: 'shelf', label: 'Shelf price only' },
        ] as const
      ).map((option) => (
        <Link
          key={option.value}
          href={basketHref(items, option.value)}
          aria-current={current === option.value ? 'true' : undefined}
          className={`inline-flex min-h-11 items-center rounded-lg border px-4 py-2.5 text-sm no-underline ${
            current === option.value
              ? 'border-ink bg-ink font-semibold text-paper'
              : 'border-line bg-surface text-ink hover:border-ink'
          }`}
        >
          {option.label}
        </Link>
      ))}
    </fieldset>
  );
}

function QtyControls({
  items,
  productId,
  qty,
  basis,
}: {
  items: readonly { productId: number; qty: number }[];
  productId: number;
  qty: number;
  basis: PriceBasis;
}) {
  return (
    <span className="inline-flex items-center gap-1">
      <Link
        href={basketHref(setQty(items, productId, qty - 1), basis)}
        aria-label={`Reduce quantity of item ${productId}`}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line text-ink no-underline hover:border-ink"
      >
        −
      </Link>
      <span className="num w-8 text-center text-[15px]">{qty}</span>
      <Link
        href={basketHref(setQty(items, productId, qty + 1), basis)}
        aria-label={`Increase quantity of item ${productId}`}
        className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-line text-ink no-underline hover:border-ink"
      >
        +
      </Link>
    </span>
  );
}

function EmptyBasket() {
  return (
    <div className="mx-auto max-w-[1120px] px-5 py-14 sm:px-8">
      <h1 className="display m-0 mb-2 text-[32px]">Your basket is empty</h1>
      <p className="m-0 mb-7 max-w-[52ch] text-[15px] text-ink-muted">
        Start from one of the ready-made baskets, or add items from any product page. Your basket
        lives in the page address, so you can bookmark it or send it to someone.
      </p>
      <div className="flex flex-wrap gap-3">
        {STARTER_BASKETS.map((basket) => (
          <Link
            key={basket.id}
            href={`/basket?preset=${basket.id}`}
            className="inline-flex min-h-11 items-center rounded-lg border border-line bg-surface px-4 py-3 text-[15px] font-semibold text-ink no-underline hover:border-ink"
          >
            {basket.name}
          </Link>
        ))}
      </div>
    </div>
  );
}
