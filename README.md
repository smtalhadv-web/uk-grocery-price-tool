# Trolleywise

Compare a whole shopping list across UK supermarkets: where it is cheapest
today, what is on offer, and until when.

Two things shape this codebase:

- **No AI anywhere.** Every figure on screen is arithmetic over stored prices.
- **No server and no database.** The site is static files on GitHub Pages. A
  scheduled GitHub Action scrapes the retailers, commits the prices as JSON,
  and the site rebuilds itself. Hosting costs nothing and there is nothing to
  keep running.

See [`docs/RULES.md`](docs/RULES.md) for the constraints this holds to and
[`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) for how it fits together.

---

## Run it

```bash
npm install
npm run dev        # http://localhost:3000
```

If no prices have been published yet, the first build writes a **sample**
dataset from fixtures so every page works. The Data page says so in plain
words — sample prices never pass for real ones.

```bash
npm test           # 90 unit tests
npm run typecheck
npm run build      # static export into out/
```

## Fetch real prices

```bash
npx playwright install chromium   # once
npm run refresh:static            # all retailers
npm run refresh:static -- asda    # one of them
HEADED=1 npm run refresh:static -- tesco   # watch it work
```

This writes `public/data/` — commit those files and the site redeploys.

**Why two kinds of adapter:** no UK supermarket publishes a developer API.
Asda's site searches an Algolia index, so it can be read over plain HTTP.
Sainsbury's, Morrisons and Tesco are server-rendered behind consent walls and
bot protection, so they are read with a real browser. Details, including the
parsing traps that cost real debugging time, are in
[`src/ingest/adapters/README.md`](src/ingest/adapters/README.md).

## Deploy

1. Push to `main`. The **Build and deploy to Pages** workflow runs.
2. In the repository settings, under Pages, set the source to **GitHub
   Actions**.
3. The site lands at `https://<owner>.github.io/<repo>/`.

Prices refresh themselves: **Refresh prices** runs daily at 03:17 UTC, commits
the new JSON, and that commit triggers a redeploy. You can also run it by hand
from the Actions tab, choosing which stores and how many items to cover.

Nothing needs a secret. There is no public endpoint to protect, because there
is no server.

## Layout

```
docs/                PRD, architecture, rules, design, tasks, memory
public/data/         the published dataset — the whole backend
src/app/             pages: deals, store, product, basket, search, data
src/components/      shared UI
src/data/            catalogue, fixtures, JSON store, repositories
src/ingest/          adapters (HTTP + browser), matcher, normaliser, publisher
src/lib/             config, money, types, pricing engine
src/db/              Postgres schema, unused today, kept for when accounts land
scripts/             ensure-dataset, seed, refresh-static
```

## What it does not do

- **No accounts.** A shared family list, reminder emails and price alerts all
  need a server. They are deferred, not forgotten — see `docs/TASKS.md`.
- No checkout. No supermarket offers an ordering API, so the app deep-links to
  the retailer.
- No full catalogue — a curated set of popular products.
- No store-level or postcode-level pricing.
- No Aldi, Lidl, Waitrose or Ocado yet.
