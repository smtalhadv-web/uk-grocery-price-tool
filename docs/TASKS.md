# TASKS — Trolleywise

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Milestone 0 — Foundations

- [x] Create repo `smtalhadv-web/uk-grocery-price-tool`
- [x] `docs/` — PRD, ARCHITECTURE, RULES, DESIGN, TASKS, MEMORY
- [x] Next.js 15 + TypeScript + Tailwind scaffold
- [x] `.env.example`, config loader, `DATA_SOURCE` switch (`fixtures` | `db`)
- [x] Money helpers (integer pence, formatting) + tests
- [x] Base layout, design tokens as CSS variables

## Milestone 1 — Data layer

- [x] Drizzle schema: stores, products, store_products, price_observations, price_daily, runs
- [x] Drizzle schema: users, households, household_members, lists, list_items, alerts, digests_sent
- [x] Seed script (4 stores, 40 starter products)
- [x] Fixture dataset mirroring the schema so the UI runs with no DB
- [x] Repository layer: one interface, fixtures and Postgres implementations
- [ ] Generate and commit the first SQL migration (`npm run db:generate`) — needs a live DB

## Milestone 2 — Pricing engine (pure functions, tested)

- [x] `typicalPrice` — 90-day median of daily minimums
- [x] `percentSaved`
- [x] `basketTotals` — per store, with missing-item counting
- [x] `splitTotal` — cheapest per item across stores
- [x] `goodTimeToBuy` — threshold rule
- [x] `shouldSendDigest` — reminder trigger
- [x] Unit tests for each, including the mixed-basis guard (R3)

## Milestone 3 — UI

- [x] Home / deals feed
- [x] Product page: cross-store compare + price history chart
- [x] Basket comparison matrix + totals + price-basis control
- [x] Ready-made starter baskets
- [x] Basket editing (add / remove / qty) via the URL
- [x] Responsive layouts for all of the above
- [x] Freshness and stale-data indicators throughout
- [ ] Product search beyond the tracked catalogue

## Milestone 4 — Ingest

- [x] `RetailerAdapter` interface + registry
- [x] Polite fetcher: per-host queue, jittered delay, backoff, honest UA
- [x] Normaliser: price strings → pence, pack size → (qty, unit), dates
- [x] Matcher: EAN first, name+size fallback with confidence floor, unmatched queue
- [x] Adapter: Asda — **verified live**, queries the site's own Algolia index
- [x] Run reporter → `runs` table, surfaced on the Data page
- [x] Decision taken: browser adapters, driven by Playwright in the Actions job
- [x] Browser adapter framework — in-page `extract` + pure `parse`, so parsing
      is unit-testable without a browser
- [x] Adapter: Sainsbury's — verified live, Nectar price split from shelf
- [x] Adapter: Morrisons — verified live, More Card price split from shelf
- [x] Adapter: Tesco — verified live, Clubcard price and published end date
- [x] Parser tests against text captured verbatim from all three live sites
- [ ] Save the captured Asda response to `fixtures/asda.json` + a parser test
- [ ] First real run against a live database (nothing has been run end to end yet)

## Milestone 5 — Automation and hosting

Hosting decision: **GitHub Pages**, static. No server, no database, £0.
Accounts are the price paid, and they were already a later phase.

- [x] Static export (`output: 'export'`), base path for a project site
- [x] JSON dataset under `public/data/` — products, prices, per-product history
- [x] Build-time rendering for deals, store and product pages
- [x] Client-side basket and search, because a static export has no server to
      read a query string — same pricing functions, run in the browser
- [x] Sample dataset written on first build, flagged so it cannot pass for real
- [x] `refresh.yml` — daily scrape, writes JSON, commits
- [x] `deploy.yml` — builds and publishes to Pages on every push to main
- [x] Data page showing the per-retailer run report and how to refresh by hand
- [ ] Turn Pages on in repository settings (source: GitHub Actions)
- [ ] First real refresh run

## Milestone 6 — Accounts and household *(needs a server — blocked by the Pages choice)*

Everything here needs something Pages cannot do. When it comes up, the options
are a small Cloudflare Worker or going back to Vercel + Supabase; the Postgres
schema and repository are still in the repo for exactly that.


- [ ] Email magic-link auth
- [ ] Household creation, invite link, member roles
- [ ] Shared list with per-member attribution
- [ ] Reminder interval setting (default 14 days)
- [ ] Price alerts (any drop / below threshold)
- [ ] Email delivery via Resend

## Milestone 7 — Ship

- [ ] Vercel project + Supabase project + env wiring
- [ ] README: run locally, run a refresh, deploy
- [ ] Spot-check 20 products against retailer sites
- [ ] Lighthouse + axe pass on the three main pages

---

## Deferred (do not build now — R14)

- WhatsApp list input via Meta Cloud API
- Aldi, Lidl, Waitrose, Iceland, Ocado adapters
- Postcode / store-level pricing
- Paid provider fallback adapter (Apify) when scrapers are blocked
- Native app wrapper
- Monetisation
