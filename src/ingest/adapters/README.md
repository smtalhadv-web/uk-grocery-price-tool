# Retailer adapters

One file per retailer, each implementing `RetailerAdapter`. The runner treats
them as interchangeable and isolates their failures (R7).

## What each retailer actually looks like

Observed live on **4 November 2026**. No UK supermarket publishes a developer
API, so each of these is the retailer's own front end being read the way the
retailer's own browser reads it.

| Retailer | How its site gets prices | Barcode exposed? | Reachable with plain `fetch`? |
|---|---|---|---|
| **Asda** | Algolia index `ASDA_PRODUCTS` — a JSON query, the cleanest of the four | No | **Yes** |
| **Sainsbury's** | Server-rendered React; price lives in the DOM and in JSON-LD | No | No — needs a browser |
| **Morrisons** | GraphQL via urql (`__URQL_DATA__`), plus JSON-LD; AWS WAF in front | Unknown | Unlikely |
| **Tesco** | Server-rendered, consent wall before content, no exposed state | Unknown | No — needs a browser |

So there are two kinds of adapter, and only Asda is the easy kind:

- **HTTP adapters** call a JSON endpoint and parse it. Cheap, fast, run
  anywhere. Asda only.
- **Browser adapters** would drive a real browser (Playwright), accept the
  consent banner once, and read the rendered page. Needed for Sainsbury's and
  Tesco, probably Morrisons. These cannot run in a serverless function; they
  belong in the scheduled GitHub Actions job, which can run Playwright on the
  free tier and write straight to Postgres.

That second kind is **not built yet** — it is an architecture decision, not a
missing function. See `docs/TASKS.md`.

## Status per adapter

| File | Status |
|---|---|
| `asda.ts` | **Verified** against a live capture. Queries the same Algolia index the site does, reading the published app id and search-only key from the page config at run time. |
| `sainsburys.ts` | **Unverified placeholder.** Targets the older `groceries-api` shape. The current site is server-rendered; treat this file as a sketch, not a working adapter. |
| `morrisons.ts` | **Unverified placeholder.** The live site is GraphQL behind a WAF. |
| `tesco.ts` | **Unverified placeholder.** The live site moved to `/shop/en-GB/search` behind a consent wall. |

Only Asda should be enabled in production today.

## Notes that cost real debugging time

- **Asda publishes no EAN.** Nothing in the search index carries a barcode, so
  Asda rows match on brand + name + pack size alone, against the confidence
  floor. Do not assume EAN matching works everywhere (R5).
- **Asda runs no shelf loyalty price**, which is why it is the clean baseline
  when comparing against Clubcard or Nectar prices.
- **Asda dates are unix seconds**, and a far-future value is a "no end date"
  sentinel, not a real date. It is mapped to `null` so the UI falls back to
  "seen since" rather than printing a date from 2031 (R2).
- **Multibuys are not unit prices.** Asda returns promotions like "Any 2 for
  £7". These are recorded as `multibuy` and never folded into a single-unit
  price, because doing so understates the basket for anyone buying one.
- **Credentials rotate.** The Algolia app id and search key are published in
  the page's own config. They are read at run time, never committed (R9).

## Adding or fixing one

1. Capture a real search response and save it to `fixtures/<slug>.json`.
2. Write `parse()` against that fixture, with a test asserting the extracted
   price, pack size, loyalty price and offer end date.
3. Return `null` from `parse()` for anything you cannot read confidently — a
   parked row beats a wrong price (R2).
4. Register the adapter in `index.ts`.
