# RULES — Trolleywise

Non-negotiable constraints for this codebase. If a change breaks one of these, the change is wrong.

---

## R1 — No AI in the product

No LLM, embedding service, or AI API is used at runtime or in the data pipeline. Every displayed number is arithmetic over stored prices, and every formula lives in `lib/pricing/` with a unit test. Product matching uses EAN and deterministic string normalisation, not a model.

## R2 — No invented data

- Never display a price that was not observed and timestamped.
- Never display an offer end date the retailer did not publish. Use "seen since <date>" instead.
- Never fill a missing price with an average, a nearby store's price, or last week's price. Show "not tracked" or "unavailable today".
- A stale price must be visibly labelled stale with its age.

## R3 — Never mix price bases

A basket total is computed entirely on shelf prices or entirely on loyalty-where-available. The basis is shown on screen. Mixed totals are a correctness bug, not a rounding detail.

## R4 — Money is integer pence

All prices are stored and computed as integer pence. Floats never touch money. Formatting to "£1.45" happens only at the edge, in one helper.

## R5 — Matching has a confidence floor

Cross-store matching accepts an EAN match outright. A name-based match must clear the configured confidence floor; below it the row goes to the unmatched queue. Guessing a match is worse than showing nothing.

## R6 — Polite fetching

One adapter per retailer. Per-host concurrency cap, randomised delay between requests, exponential backoff on 429/5xx, an honest `User-Agent` with a contact URL, and no attempt to defeat a bot challenge. If a retailer blocks us, we degrade to stale and say so; we do not escalate.

## R7 — One retailer's failure is not the run's failure

The refresh job isolates each retailer. A failed retailer is recorded in `runs`, marked stale in the UI, and the other three still update.

## R8 — Append-only price history

`price_observations` is never updated or deleted in normal operation. Corrections are new rows. History is the product.

## R9 — Secrets and config

No secret in the repo. Everything through env vars, documented in `.env.example`. `CRON_SECRET` protects every job route; an unauthenticated call returns 401 before any work.

## R10 — Honest UI about what we are

Every page states the last refresh time and that prices should be checked in store. We are not affiliated with any retailer; retailer names are used factually and every product deep-links to the retailer's own page.

## R11 — Accessibility

Real `<button>`, `<a href>`, `<label>` elements. Touch targets ≥ 44px. Text contrast ≥ 4.5:1. The cheapest option is never indicated by colour alone — it carries a text label too.

## R12 — Tests before a pipeline change ships

Parsers, normalisers, matchers and pricing formulas each have unit tests with recorded fixtures. A retailer payload change is caught by a failing fixture test, not by a user seeing a wrong price.

## R13 — Code conventions

TypeScript strict. No `any` in `lib/`. Server Components by default; `'use client'` only where interaction requires it. One module per concern; no file over ~300 lines without a reason.

## R14 — Scope discipline

Anything listed as a later phase in the PRD does not get built early "while we're here". Add it to TASKS.md instead.
