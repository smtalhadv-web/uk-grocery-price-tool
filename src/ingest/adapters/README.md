# Retailer adapters

There are two kinds, because the retailers are two kinds. All four were read
live on **4 November 2026**; no UK supermarket publishes a developer API, so
each adapter reads the retailer's own front end the way the retailer's own
browser does.

| Retailer | How its site gets prices | Adapter kind | Barcode? |
|---|---|---|---|
| **Asda** | Algolia index `ASDA_PRODUCTS` — a JSON query | HTTP, `adapters/asda.ts` | No |
| **Sainsbury's** | Server-rendered React, stable `data-testid` hooks | Browser, `browser/sainsburys.ts` | No |
| **Morrisons** | GraphQL behind an AWS WAF, stable `data-test` hooks | Browser, `browser/morrisons.ts` | No |
| **Tesco** | Server-rendered, consent wall, hashed class names | Browser, `browser/tesco.ts` | No |

**No retailer publishes a barcode on a search tile.** Everything matches on
brand + name + pack size against the confidence floor (R5). The EAN column in
the catalogue is still worth keeping for a future source, but nothing fills it
today.

## HTTP adapters — `src/ingest/adapters/`

Call a JSON endpoint, parse it, done. Cheap, fast, runs anywhere, including
the `POST /api/cron/refresh` route. Asda only.

Asda notes that cost real debugging time:

- Prices arrive as pounds (`3.94`) under `PRICES.EN.PRICE`.
- Offer dates are unix seconds, and a far-future value is a "no end date"
  sentinel. Mapped to null so the UI says "seen since" rather than printing a
  date years out (R2).
- Promotions are often multibuys ("Any 2 for £7"), recorded as `multibuy` and
  never folded into a unit price.
- The Algolia app id and search-only key are published in the page's own
  `__CONFIG__.app.algolia` and rotate, so they are read at run time rather
  than committed (R9).

## Browser adapters — `src/ingest/browser/`

Drive a real Chromium through Playwright, dismiss the consent wall, scroll the
lazy-loaded grid, and read the rendered tiles. These cannot run in a
serverless function, so they run in `.github/workflows/refresh-browser.yml`
and write to Postgres directly.

Each one splits into two halves on purpose:

- `extract` runs **inside the page** and returns `ScrapedRow`s — plain strings,
  no logic.
- `parse(row)` is **pure**, and is unit-tested against text captured verbatim
  from the live sites (`browser.test.ts`). When a retailer changes how a tile
  reads, that test fails — which is the whole point, because the alternative
  is shipping a wrong price quietly.

What each retailer gives up:

| Retailer | Shelf price | Loyalty price | Offer end date |
|---|---|---|---|
| Sainsbury's | `gw-product-retail-price` | `gw-product-contextual-price`, only when `gw-nectar-offer-badge` is present | Rarely published |
| Morrisons | `fop-price`, or `fop-original-price` when a More Card price is shown | "More Card" badge | Rarely published |
| Tesco | the plain amount on the tile | the amount trailed by "Clubcard Price" | **Yes** — "valid for delivery from … until …" |

Three traps that are handled and should stay handled:

1. **Price elements contain the unit price.** Sainsbury's renders
   `£3.90£2.35 / kg` in one node. Only the first amount is the price.
2. **Multibuys are not unit prices.** "Any 2 for £7" and "Buy 3 for £4" are
   detected and kept out of the price fields. Where a tile shows *only* a
   multibuy and no single-unit price, `parse()` returns null rather than
   guessing (R2).
3. **A contextual price is not automatically a member price.** On Sainsbury's
   it only counts as a Nectar price when the Nectar badge says so; otherwise
   it is an ordinary promotion that everyone gets.

## When one breaks

It will. A parse-rate collapse shows up the same day on the Data page, via the
`runs` table. The fix is usually: open the site, look at a tile, update the
selector or the text pattern, and add the new wording to `browser.test.ts`.

A `403` or `429` is taken at face value. The run records it, the store is
marked stale, and we leave it alone (R6).
