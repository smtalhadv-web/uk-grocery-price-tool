import type { OfferKind } from '@/lib/types';

const OFFER_LABEL: Record<OfferKind, string> = {
  shelf: 'Shelf price',
  shelf_offer: 'Shelf offer',
  loyalty: 'Loyalty price',
  rollback: 'Rollback',
  multibuy: 'Multibuy',
};

export function offerKindLabel(kind: OfferKind): string {
  return OFFER_LABEL[kind];
}

function formatDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  });
}

/**
 * Shows the retailer's own end date when they publish one. When they do not,
 * it says how long we have been seeing the offer — never an invented date (R2).
 */
export function OfferWindow({
  endsOn,
  firstSeenOn,
}: {
  endsOn: string | null;
  firstSeenOn: string | null;
}) {
  if (endsOn) return <>Ends {formatDay(endsOn)}</>;
  if (firstSeenOn) return <>Seen since {formatDay(firstSeenOn)}</>;
  return <>No end date published</>;
}
