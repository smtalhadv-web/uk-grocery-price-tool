# Trolleywise

Compare a whole shopping list across UK supermarkets: where it is cheapest
today, what is on offer, and until when.

**No AI anywhere.** Every figure on screen is arithmetic over stored prices.
See [`docs/RULES.md`](docs/RULES.md) for the constraints this codebase holds to
and [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how it fits together.

---

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

It starts on `DATA_SOURCE=fixtures`: deterministic sample data, no database and
no network. Every page works, so you can judge the product before any scraper
is reliable. The Data page tells you which mode you are in.

```bash
npm test           # unit tests
npm run typecheck
npm run build
```

## Run it against real prices

1. Create a Postgres database (Supabase free tier is enough).
2. `cp .env.example .env.local` and fill in `DATABASE_URL`, `CRON_SECRET` and
   `FETCH_CONTACT_URL`. Set `DATA_SOURCE=db`.
3. Create the tables and seed the catalogue:

   ```bash
   npm run db:push
   npm run db:seed
   ```

4. Fetch prices:

   ```bash
   npm run refresh              # all four retailers
   npm run refresh -- asda      # one of them
   ```

**Before trusting a price:** the retailer adapters target each site's own JSON
endpoints, and those endpoint shapes are **unverified** — no UK supermarket
publishes a developer API, and this repo was built without access to the live
sites. Read [`src/ingest/adapters/README.md`](src/ingest/adapters/README.md)
and capture one real response per retailer before enabling any of them in
production.

## Deploy

| Piece | Service | Notes |
|---|---|---|
| App | Vercel | Set the same env vars as `.env.local` |
| Database | Supabase | Use the pooled connection string |
| Schedule | GitHub Actions | `.github/workflows/refresh.yml`, daily 03:07 UTC |

The workflow needs two repository secrets: `APP_URL` (your deployed origin) and
`CRON_SECRET` (the same value the app has). It calls
`POST /api/cron/refresh`, which returns `207` when one retailer failed and the
others updated — that is a success, not an outage (R7).

## Layout

```
docs/                PRD, architecture, rules, design, tasks, memory
src/app/             Pages: deals, search, product, basket, admin, cron route
src/components/      Shared UI
src/data/            Catalogue, fixtures, repository (fixtures + Postgres)
src/db/              Drizzle schema and client
src/ingest/          Fetcher, normaliser, matcher, retailer adapters, runner
src/lib/             Config, money, types, pricing engine
scripts/             seed, refresh
```

## What it does not do

- No checkout. No supermarket offers an ordering API, so the app deep-links to
  the retailer instead.
- No full catalogue — a curated set of popular products.
- No store-level or postcode-level pricing.
- No Aldi, Lidl, Waitrose or Ocado yet.

Deferred work is listed in [`docs/TASKS.md`](docs/TASKS.md).
