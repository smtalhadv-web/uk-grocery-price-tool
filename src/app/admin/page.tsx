import { Freshness } from '@/components/freshness';
import { STORES, storeName } from '@/data/catalogue';
import { readMeta } from '@/data/json-store';
import type { DatasetRun } from '@/data/dataset';
import { config } from '@/lib/config';

export const metadata = { title: 'Data' };

const STATUS_STYLE: Record<string, string> = {
  ok: 'bg-brand-tint text-brand',
  partial: 'bg-save-tint text-save',
  failed: 'bg-save-tint text-save',
  skipped: 'bg-sunk text-ink-muted',
};

export default async function DataPage() {
  const meta = await readMeta();
  const runs: DatasetRun[] = meta?.runs ?? [];

  return (
    <div className="mx-auto max-w-[1120px] px-5 py-9 sm:px-8">
      <h1 className="display m-0 mb-1.5 text-[32px]">Data</h1>
      <p className="m-0 mb-8 text-[15px] text-ink-faint">
        Where these prices came from. <Freshness observedAt={meta?.generatedAt ?? null} />
      </p>

      {meta === null || meta.sample ? (
        <p className="mb-8 rounded-2xl border border-save-tint bg-save-tint p-5 text-sm leading-relaxed text-save">
          <strong className="font-semibold">These are sample prices, not real ones.</strong> No
          refresh has published a dataset yet, so the site is running on fixtures. Everything you
          see is deterministic placeholder data.
        </p>
      ) : null}

      <div className="mb-8 rounded-2xl border border-line bg-surface p-6">
        <h2 className="display m-0 mb-3 text-lg">How this runs</h2>
        <dl className="m-0 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          <Row label="Hosting" value="GitHub Pages — static files, no server" />
          <Row label="Data" value="JSON committed to the repo by the refresh job" />
          <Row label="Schedule" value="Daily, via GitHub Actions" />
          <Row label="Products tracked" value={String(meta?.productCount ?? 0)} />
          <Row label="Stale after" value={`${config.staleAfterHours} hours`} />
          <Row label="AI used" value="None, anywhere" />
        </dl>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[720px] border-collapse text-left">
          <caption className="sr-only">Most recent refresh per retailer</caption>
          <thead>
            <tr className="border-b border-line bg-sunk text-[12px] uppercase tracking-[0.06em] text-ink-muted">
              <th scope="col" className="px-6 py-3.5 font-medium">Store</th>
              <th scope="col" className="px-6 py-3.5 font-medium">Status</th>
              <th scope="col" className="px-6 py-3.5 text-right font-medium">Found</th>
              <th scope="col" className="px-6 py-3.5 text-right font-medium">Parsed</th>
              <th scope="col" className="px-6 py-3.5 text-right font-medium">Matched</th>
              <th scope="col" className="px-6 py-3.5 font-medium">Note</th>
            </tr>
          </thead>
          <tbody>
            {STORES.map((store) => {
              const run = runs.find((row) => row.storeSlug === store.slug);
              return (
                <tr key={store.slug} className="border-b border-line-soft">
                  <th scope="row" className="px-6 py-3.5 text-[15px] font-medium">
                    {storeName(store.slug)}
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

      <div className="mt-8 rounded-2xl border border-line bg-surface p-6">
        <h2 className="display m-0 mb-2 text-lg">Refresh manually</h2>
        <p className="m-0 mb-3 text-sm leading-relaxed text-ink-muted">
          There is no server to call, so a refresh is a workflow run: open the repository’s
          Actions tab and run <strong className="font-semibold">Refresh prices</strong>. It
          scrapes, commits the new JSON, and redeploys the site. Locally:
        </p>
        <pre className="m-0 overflow-x-auto rounded-xl bg-ink p-4 text-[13px] leading-relaxed text-paper">
          <code>{`npm run refresh:static          # all retailers
npm run refresh:static -- asda  # just one`}</code>
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
