# ARCHITECTURE — Trolleywise

Last updated: 2026-11-04

---

## 1. Shape

```
                 GitHub Actions (cron, daily 03:17 UTC)
                                │
  retailer sites ──► adapters ──► matcher ──► public/data/*.json
                     (HTTP + browser)              │
                                                   │ git commit
                                                   ▼
                                        GitHub Actions (deploy)
                                                   │ next build --output export
                                                   ▼
                                           GitHub Pages ──► browser
```

**There is no server and no database.** The refresh job is the backend: it
scrapes, matches, and commits JSON. The build renders every page from those
files. Pages serves the result.

No AI anywhere. Every figure is arithmetic over committed prices.

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js 15, App Router, `output: 'export'` | One toolchain for build-time pages and client-side ones |
| Styling | Tailwind CSS | Matches the mockup system quickly |
| Data | JSON under `public/data/`, committed | No database to pay for or keep alive; history is versioned in git for free |
| Fetch | Node 22 `fetch` (Asda) + Playwright (the rest) | Only Asda publishes usable JSON |
| Scheduler | GitHub Actions | Free, and it is also where the scraping runs |
| Hosting | GitHub Pages | Free, static, nothing to operate |

### What this costs us

Accounts. A static site cannot hold a shared family list, send a reminder
email, or keep a per-user alert — all of those need a server. They are
deliberately deferred (PRD §7); when they land, the Postgres schema and the
Drizzle repository in `src/db/` and `src/data/repository.postgres.ts` are
still here and still wired behind `DATA_SOURCE=db`.

### Where a page is rendered

| Page | Rendered | Why |
|---|---|---|
| Deals, store pages, product pages | Build time | Fixed content per deploy |
| Basket, search | Browser | They read the query string, which a static export has no server to see. The basket lives in the URL so it stays shareable without an account |

Both paths run the *same* pricing functions from `src/lib/pricing/`, over the
same JSON. There is one set of arithmetic, not two.

## 2b. The published dataset

```
public/data/
  meta.json            generatedAt, per-retailer run report, sample flag
  products.json        the catalogue
  prices.json          today's price at every store, keyed by product id
  history/<id>.json    that product's daily series, 120 days
```

`meta.sample` is true when the files came from fixtures rather than a real
run, and the Data page says so loudly. Sample prices must never be able to
pass for observed ones (R2).

History is append-and-trim: one point per store per day holding that day's
lowest, so re-running a refresh corrects the day rather than adding a second
point. Git stores the diffs, so the price history is backed up and auditable
without any extra machinery.

## 3. Data model

```
stores            id, slug, name, loyalty_scheme, active
products          id, ean, canonical_name, brand, pack_size, unit, unit_qty, category
store_products    id, store_id, product_id, store_sku, store_url, title_at_store
price_observations id, store_product_id, observed_at,
                   shelf_price_pence, loyalty_price_pence,
                   offer_kind, offer_ends_on, offer_first_seen_on,
                   in_stock, raw  (jsonb, the parsed payload we derived it from)
price_daily        store_product_id, day, shelf_min, loyalty_min   -- rollup for charts
users              id, email, created_at
households         id, name, owner_id, reminder_days (default 14)
household_members  household_id, user_id, role
lists              id, household_id, name, is_default
list_items         id, list_id, product_id, qty, added_by_user_id, added_at, ticked
alerts             id, user_id, product_id, kind ('any_drop'|'below'), threshold_pence
digests_sent       id, household_id, sent_at, payload
```

Key points:

- `price_observations` is append-only. Nothing is overwritten, so history is free and "lowest seen" is a query, not a cached guess.
- `price_daily` is a rollup written by the same job, so charts do not scan the raw table.
- `offer_first_seen_on` lets the UI say "seen since 2 Nov" when the retailer gives no end date.
- `products` is the matching spine. `store_products` is the per-retailer identity.

## 4. Fetch pipeline

Each retailer is an adapter implementing one interface:

```ts
interface RetailerAdapter {
  slug: string;
  name: string;
  loyaltyScheme: string | null;
  search(term: string, opts): Promise<RawProduct[]>;
  fetchBySku(sku: string, opts): Promise<RawProduct | null>;
  parse(raw: unknown): NormalisedProduct;
}
```

`NormalisedProduct` carries: store sku, title, brand, pack size + unit, ean (if given), shelf price, loyalty price, offer kind, offer end date, stock flag, source url.

Pipeline stages, each a pure function with its own test:

1. **fetch** — adapter hits the retailer's own JSON endpoint. Retries with backoff, per-host concurrency cap, randomised delay, honest `User-Agent`.
2. **normalise** — strings to pence, pack size parsed to `(qty, unit)`, loyalty price separated from shelf price.
3. **match** — EAN first; fallback to `brand + normalised name + pack size` fuzzy match above a confidence floor. Below the floor the row is parked in `unmatched` for manual review rather than guessed.
4. **persist** — one `price_observations` row per store_product per run; `price_daily` upserted.
5. **report** — per-run counts (fetched / parsed / matched / failed) written to a `runs` table so a silent breakage is visible.

Failure of one retailer never fails the run; that store is simply marked stale for the day.

## 5. Computation (all plain arithmetic)

- **Basket total per store** = Σ (qty × chosen price basis), items missing at that store excluded and counted.
- **Split total** = Σ (qty × min price across stores).
- **Typical price** = median of the last 90 days of daily minimums for that store_product.
- **Percent saved** = (typical − today) / typical.
- **Good time to buy** = today ≤ typical × 0.85 **and** today ≤ 90-day lowest × 1.10.
- **Reminder trigger** = days since last digest ≥ household.reminder_days **and** ≥ 3 list items currently below typical.

Every one of these is a documented formula in `lib/pricing/`. No model, no heuristic that cannot be read off the page.

## 6. Rendering

- Server Components read Postgres directly for Deals, Product, Basket. No client fetch waterfall.
- The basket matrix is computed server-side and streamed; the price-basis toggle is a client component that re-requests with a search param.
- Charts are inline SVG from the `price_daily` rollup. No chart library, no client JS needed to see the data.

## 7. Environments

| `DATA_SOURCE` | Reads from | Use |
|---|---|---|
| `static` (default) | `public/data/` | Normal. Falls back to fixtures when no dataset has been published yet |
| `fixtures` | generated in memory | UI work with nothing on disk |
| `db` | Postgres | Kept for when accounts arrive; not used by the Pages build |

## 8. Scheduling

Two workflows, and no secret to guard because there is no public endpoint:

- `refresh.yml` — daily at 03:17 UTC. Scrapes, writes `public/data`, commits.
  Also runnable by hand from the Actions tab, with inputs for which stores and
  how many catalogue items to cover. That is the manual trigger.
- `deploy.yml` — on every push to `main`. Builds the static export and
  publishes it to Pages. The refresh commit triggers it, so the site updates
  itself.

## 9. Risk register

| Risk | Mitigation |
|---|---|
| Retailer blocks the fetcher | Per-retailer adapter, degrade to stale, proxy slot in config, paid-provider adapter can be dropped in |
| Retailer changes their payload | Schema validation at parse time; run report shows a parse-rate collapse immediately |
| Wrong cross-store match | EAN first, confidence floor, unmatched queue, never a silent guess |
| Loyalty pricing confuses the comparison | Both bases stored, user-selectable, never mixed in one total |
| Legal / ToS | Public pages only, polite rate limits, no reselling raw data, retailer attribution and deep links |
