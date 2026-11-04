# ARCHITECTURE — Trolleywise

Last updated: 2026-11-04

---

## 1. Shape

```
                    GitHub Actions (cron, daily 03:00 UTC)
                                  │  POST /api/cron/refresh  (bearer CRON_SECRET)
                                  ▼
  retailer sites ──► fetchers ──► normaliser ──► matcher ──► Postgres
                     (adapters)                              │
                                                             ▼
                              Next.js App Router  ──►  browser / PWA
                              (server components read Postgres directly)
```

No AI service anywhere. No third-party price API required. Every figure the user sees is arithmetic over rows in `price_observations`.

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| App | Next.js 15, App Router, TypeScript | One deploy for UI + API + cron endpoint |
| Styling | Tailwind CSS | Matches the mockup system quickly |
| DB | Postgres (Supabase free tier) | Relational price history, cheap |
| ORM | Drizzle | Thin, typed, no heavy runtime |
| Fetch | Node 22 `fetch` + `undici` | No browser needed for JSON endpoints |
| Scheduler | GitHub Actions `schedule` | Free, outside the host's cron limits |
| Deploy | Vercel | Free tier, zero-config for Next |
| Email | Resend | Free tier for digests and alerts |

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

| Mode | `DATA_SOURCE` | Use |
|---|---|---|
| `fixtures` | local JSON under `fixtures/` | UI work with no DB and no network |
| `db` | Postgres | Normal |

This keeps the UI buildable and reviewable before any scraper is reliable.

## 8. Scheduling

`.github/workflows/refresh.yml` runs daily and calls `POST /api/cron/refresh` with `Authorization: Bearer $CRON_SECRET`. The route is a thin trigger: it enqueues the retailers and returns immediately, so it never hits a serverless timeout. A second workflow runs the reminder digest job.

An admin page exposes the same trigger with a button, which satisfies the "manual bhi ho, automate bhi ho" requirement.

## 9. Risk register

| Risk | Mitigation |
|---|---|
| Retailer blocks the fetcher | Per-retailer adapter, degrade to stale, proxy slot in config, paid-provider adapter can be dropped in |
| Retailer changes their payload | Schema validation at parse time; run report shows a parse-rate collapse immediately |
| Wrong cross-store match | EAN first, confidence floor, unmatched queue, never a silent guess |
| Loyalty pricing confuses the comparison | Both bases stored, user-selectable, never mixed in one total |
| Legal / ToS | Public pages only, polite rate limits, no reselling raw data, retailer attribution and deep links |
