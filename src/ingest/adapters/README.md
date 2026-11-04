# Retailer adapters

One file per retailer, each implementing `RetailerAdapter`. The runner treats
them as interchangeable and isolates their failures (R7).

## Status — read this before trusting a price

No UK supermarket publishes a developer API. Each adapter here targets the
JSON endpoint the retailer's own website calls, which means:

- **The endpoint shapes in these files are unverified.** They were written from
  the documented/observed shape of each site's search response, not from a
  live capture, because the build environment cannot reach retailer domains.
  Before any adapter is enabled in production, capture one real response,
  save it under `fixtures/<slug>.json`, and make the parser test read it.
- **They will break.** A retailer changing their payload is normal, not
  exceptional. The run reporter exists so a parse-rate collapse is visible the
  same day rather than weeks later.
- **A blocked adapter is not an error to route around.** `AdapterBlockedError`
  means the retailer refused us; the runner records it, the UI marks that store
  stale, and we leave it alone (R6).

| Adapter | Endpoint style | Expected difficulty |
|---|---|---|
| `asda.ts` | Search JSON, EANs usually present | Moderate |
| `morrisons.ts` | Search JSON | Moderate |
| `sainsburys.ts` | `groceries-api` product search | Moderate |
| `tesco.ts` | Site search | Hardest — most protected |

## Adding one

1. Capture a real search response and save it to `fixtures/<slug>.json`.
2. Write `parse()` against that fixture, with a test that asserts the
   extracted price, pack size, loyalty price and offer end date.
3. Return `null` from `parse()` for anything you cannot read confidently —
   a parked row is better than a wrong price (R2).
4. Register the adapter in `index.ts`.
