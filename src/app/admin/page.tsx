import { Freshness } from '@/components/freshness';
import { STORES } from '@/data/catalogue';
import { repo } from '@/data/repository';
import { config } from '@/lib/config';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Data' };

interface RunRow extends Record<string, unknown> {
  slug: string;
  startedAt: string;
  finishedAt: string | null;
  fetched: number;
  parsed: number;
  matched: number;
  failed: number;
  status: string;
  note: string | null;
}

async function latestRuns(): Promise<RunRow[]> {
  if (config.dataSource !== 'db') return [];
  const { db } = await import('@/db/client');
  const { sql } = await import('drizzle-orm');
  const rows = await db().execute<RunRow>(sql`
    SELECT DISTINCT ON (s.slug)
      s.slug,
      r.started_at  AS "startedAt",
      r.finished_at AS "finishedAt",
      r.fetched, r.parsed, r.matched, r.failed, r.status, r.note
    FROM runs r
    JOIN stores s ON s.id = r.store_id
    ORDER BY s.slug, r.started_at DESC
  `);
  return [...rows];
}

const STATUS_STYLE: Record<string, string> = {
  ok: 'bg-brand-tint text-brand',
  partial: 'bg-save-tint text-save',
  failed: 'bg-save-tint text-save',
  running: 'bg-sunk text-ink-muted',
};

export default async function AdminPage() {
  const repository = await repo();
  const [lastRefresh, runs] = await Promise.all([repository.lastRefreshAt(), latestRuns()]);

  return (
    <div className="mx-auto max-w-[1120px] px-5 py-9 sm:px-8">
      <h1 className="display m-0 mb-1.5 text-[32px]">Data</h1>
      <p className="m-0 mb-8 text-[15px] text-ink-faint">
        Where today’s prices came from. <Freshness observedAt={lastRefresh} />
      </p>

      <div className="mb-8 rounded-2xl border border-line bg-surface p-6">
        <h2 className="display m-0 mb-3 text-lg">How this runs</h2>
        <dl className="m-0 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Row label="Source" value={config.dataSource === 'db' ? 'Postgres' : 'Fixtures (sample data)'} />
          <Row label="Schedule" value="Daily at 03:00 UTC via GitHub Actions" />
          <Row label="Stale after" value={`${config.staleAfterHours} hours`} />
          <Row label="Match confidence floor" value={String(config.matchConfidenceFloor)} />
          <Row label="Fetch delay" value={`${config.fetchDelayMs}–${config.fetchDelayMs * 2} ms per request`} />
          <Row label="AI used" value="None, anywhere" />
        </dl>
      </div>

      {config.dataSource !== 'db' ? (
        <p className="rounded-2xl border border-brand-tint-line bg-brand-tint p-5 text-sm leading-relaxed text-ink-muted">
          Running on fixtures. Everything you see across the site is deterministic sample data,
          not observed prices. Set <code>DATA_SOURCE=db</code> with a <code>DATABASE_URL</code>{' '}
          to read real prices, then trigger a refresh.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[720px] border-collapse text-left">
            <caption className="sr-only">Most recent refresh run per retailer</caption>
            <thead>
              <tr className="border-b border-line bg-sunk text-[12px] uppercase tracking-[0.06em] text-ink-muted">
                <th scope="col" className="px-6 py-3.5 font-medium">Store</th>
                <th scope="col" className="px-6 py-3.5 font-medium">Status</th>
                <th scope="col" className="px-6 py-3.5 text-right font-medium">Fetched</th>
                <th scope="col" className="px-6 py-3.5 text-right font-medium">Parsed</th>
                <th scope="col" className="px-6 py-3.5 text-right font-medium">Matched</th>
                <th scope="col" className="px-6 py-3.5 font-medium">Note</th>
              </tr>
            </thead>
            <tbody>
              {STORES.map((store) => {
                const run = runs.find((row) => row.slug === store.slug);
                return (
                  <tr key={store.slug} className="border-b border-line-soft">
                    <th scope="row" className="px-6 py-3.5 text-[15px] font-medium">
                      {store.name}
                    </th>
                    <td className="px-6 py-3.5">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-1 text-[12px] font-semibold ${
                          STATUS_STYLE[run?.status ?? ''] ?? 'bg-sunk text-ink-muted'
                        }`}
                      >
                        {run?.status ?? 'never run'}
                      </span>
                    </td>
                    <td className="num px-6 py-3.5 text-right">{run?.fetched ?? '—'}</td>
                    <td className="num px-6 py-3.5 text-right">{run?.parsed ?? '—'}</td>
                    <td className="num px-6 py-3.5 text-right">{run?.matched ?? '—'}</td>
                    <td className="px-6 py-3.5 text-[13px] text-ink-faint">{run?.note ?? ''}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <div className="mt-8 rounded-2xl border border-line bg-surface p-6">
        <h2 className="display m-0 mb-2 text-lg">Refresh manually</h2>
        <p className="m-0 mb-3 text-sm leading-relaxed text-ink-muted">
          The same job the schedule runs. It needs the shared secret, so it is triggered from a
          terminal rather than a button here — a button would have to ship the secret to the
          browser.
        </p>
        <pre className="m-0 overflow-x-auto rounded-xl bg-ink p-4 text-[13px] leading-relaxed text-paper">
          <code>{`curl -X POST "$APP_URL/api/cron/refresh" \\
  -H "Authorization: Bearer $CRON_SECRET"

# one retailer only
curl -X POST "$APP_URL/api/cron/refresh?stores=asda" \\
  -H "Authorization: Bearer $CRON_SECRET"`}</code>
        </pre>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-b border-line-soft pb-2 last:border-0">
      <dt className="m-0 text-sm text-ink-faint">{label}</dt>
      <dd className="m-0 text-sm font-medium text-ink">{value}</dd>
    </div>
  );
}
