import { isStale } from '@/lib/pricing';

function relative(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const hours = Math.round(diffMs / 3_600_000);
  if (hours < 1) return 'just now';
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/London',
  });
}

/**
 * Every data surface says when it was priced, and a stale price says so
 * out loud rather than passing for current (R2).
 */
export function Freshness({ observedAt }: { observedAt: string | null }) {
  if (!observedAt) {
    return <span className="text-ink-faint">Not yet priced</span>;
  }

  if (isStale(observedAt)) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-save-tint px-2.5 py-1 text-[12px] font-semibold text-save">
        Stale — last priced {relative(observedAt)}
      </span>
    );
  }

  return <span className="text-ink-faint">Priced {clockTime(observedAt)} today</span>;
}
