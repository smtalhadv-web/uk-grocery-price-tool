# TASKS — Trolleywise

Legend: `[ ]` todo · `[~]` in progress · `[x]` done

---

## Milestone 0 — Foundations

- [x] Create repo `smtalhadv-web/uk-grocery-price-tool`
- [x] `docs/` — PRD, ARCHITECTURE, RULES, DESIGN, TASKS, MEMORY
- [ ] Next.js 15 + TypeScript + Tailwind scaffold
- [ ] `.env.example`, config loader, `DATA_SOURCE` switch (`fixtures` | `db`)
- [ ] Money helpers (integer pence, formatting) + tests
- [ ] Base layout, design tokens as CSS variables

## Milestone 1 — Data layer

- [ ] Drizzle schema: stores, products, store_products, price_observations, price_daily, runs
- [ ] Drizzle schema: users, households, household_members, lists, list_items, alerts, digests_sent
- [ ] Migrations + seed script (4 stores, ~60 starter products)
- [ ] Fixture dataset mirroring the schema so the UI runs with no DB
- [ ] Repository layer: one typed query module per domain

## Milestone 2 — Pricing engine (pure functions, tested)

- [ ] `typicalPrice` — 90-day median of daily minimums
- [ ] `percentSaved`
- [ ] `basketTotals` — per store, with missing-item counting
- [ ] `splitTotal` — cheapest per item across stores
- [ ] `goodTimeToBuy` — threshold rule
- [ ] `shouldSendDigest` — reminder trigger
- [ ] Unit tests for each, including the mixed-basis guard (R3)

## Milestone 3 — UI

- [ ] Home / deals feed
- [ ] Product page: cross-store compare + price history chart
- [ ] Basket comparison matrix + totals + price-basis control
- [ ] Ready-made starter baskets
- [ ] Basket editing (add / remove / qty)
- [ ] Mobile layouts for all of the above
- [ ] Freshness and stale-data indicators throughout

## Milestone 4 — Ingest

- [ ] `RetailerAdapter` interface + registry
- [ ] Normaliser: price strings → pence, pack size → (qty, unit)
- [ ] Matcher: EAN first, name+size fallback with confidence floor, unmatched queue
- [ ] Adapter: Asda
- [ ] Adapter: Morrisons
- [ ] Adapter: Sainsbury's
- [ ] Adapter: Tesco (expect the most resistance; may land last)
- [ ] Fixture-based parser tests per adapter
- [ ] Run reporter → `runs` table, surfaced on the admin page

## Milestone 5 — Automation

- [ ] `POST /api/cron/refresh` (bearer `CRON_SECRET`), enqueue + return fast
- [ ] GitHub Actions daily refresh workflow
- [ ] `POST /api/cron/digest` + weekly reminder workflow
- [ ] Admin page with manual "Refresh now" trigger and last-run report

## Milestone 6 — Accounts and household

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
