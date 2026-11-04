import Link from 'next/link';
import { formatPence } from '@/lib/money';
import type { Deal } from '@/lib/types';
import { OfferWindow, offerKindLabel } from './offer-window';

export function DealCard({ deal }: { deal: Deal }) {
  return (
    <Link
      href={`/product/${deal.product.id}`}
      className="block rounded-2xl border border-line bg-surface p-5 no-underline transition-colors hover:border-brand-tint-line"
    >
      <div className="mb-3.5 flex items-start justify-between gap-3">
        <span className="text-[13px] font-semibold text-ink-muted">{deal.storeName}</span>
        <span className="rounded-full bg-save-tint px-2.5 py-1 text-[13px] font-bold text-save">
          −{deal.percent}%
        </span>
      </div>

      <p className="m-0 text-base font-semibold leading-snug text-ink">
        {deal.product.brand ? `${deal.product.brand} ` : ''}
        {deal.product.name}
      </p>
      <p className="mb-4 mt-1 text-[13px] text-ink-faint">{deal.product.packLabel}</p>

      <div className="mb-3 flex items-baseline gap-2.5">
        <span className="display num text-[26px] font-bold text-ink">
          {formatPence(deal.nowPence)}
        </span>
        <span className="num text-[15px] text-ink-faint line-through">
          {formatPence(deal.typicalPence)}
        </span>
        <span className="sr-only">
          usually {formatPence(deal.typicalPence)}, now {formatPence(deal.nowPence)}
        </span>
      </div>

      <div className="flex justify-between gap-2.5 border-t border-line-soft pt-3 text-[13px] text-ink-faint">
        <span>
          <OfferWindow endsOn={deal.offerEndsOn} firstSeenOn={deal.offerFirstSeenOn} />
        </span>
        <span>{offerKindLabel(deal.offerKind)}</span>
      </div>
    </Link>
  );
}
