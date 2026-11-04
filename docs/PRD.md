# PRD — Trolleywise (UK grocery price & sale comparison)

Status: Phase 1 build
Owner: smtalhadv-web
Last updated: 2026-11-04

---

## 1. Problem

A UK household doing a weekly shop has no quick way to answer two questions:

1. **"Which store is cheapest for *my* list this week?"** Prices move daily, and four of the big grocers now run a loyalty price layer (Tesco Clubcard, Sainsbury's Nectar, Morrisons More Card, Asda Rewards) so the shelf price is not what most baskets actually pay.
2. **"What that I normally buy is on offer right now, and until when?"** Offers are scattered across four websites and rarely show an end date in one place.

Existing comparison sites exist but are either catalogue-wide and overwhelming, or they do not let a household keep a shared, reusable list.

## 2. Product in one sentence

Put your usual shopping list in once; the app prices it at every tracked supermarket every day, tells you where it is cheapest, what is on offer, and nudges you when your usual items drop.

## 3. Non-goals (Phase 1)

- No checkout. No supermarket exposes an ordering API; we deep-link to the retailer instead.
- No full catalogue. We track a curated set of popular SKUs, not 100k+ products.
- No store-level / postcode-level pricing. National online prices only.
- No AI. Every number is arithmetic over stored prices. No LLM in the runtime path.
- No Aldi / Lidl / M&S in Phase 1.

## 4. Users

| User | Need |
|---|---|
| Weekly shopper | One number per store for their list |
| Household organiser | A list the whole family adds to during the week |
| Deal hunter | A feed of the biggest genuine drops, with end dates |

## 5. Phase 1 scope

### 5.1 Retailers
Asda, Morrisons, Sainsbury's, Tesco. Each behind an adapter so more can be added.

### 5.2 Catalogue
~1,000–2,000 popular SKUs across grocery, household and health & beauty. Matched across retailers by EAN where available, by normalised name + pack size otherwise.

### 5.3 Features

**F1 — Deals feed**
Products whose current price is meaningfully below their own recent typical price, ranked by percent saved. Each card shows store, now/was, percent, offer type (shelf / loyalty / rollback) and the offer window.

**F2 — Product compare**
One product, every tracked store, shelf price and loyalty price shown separately, unit price (per 100g / per litre), cheapest flagged.

**F3 — Price history**
Per product per store, 30 / 90 / 365 day chart, plus lowest seen, typical price, today, and whether today is a good time to buy. "Good time to buy" is a threshold rule over stored prices, not a prediction.

**F4 — Basket comparison**
A list of items → a full matrix of item × store, each row's cheapest highlighted, a total per store, and a split-shopping total if the user is willing to visit more than one store.

**F5 — Ready-made baskets**
Starter baskets (single, couple, family of four) the user can clone and edit.

**F6 — Household shared list**
One account, several members. Anyone adds items during the week; the list rolls into F4. Members join by invite link.

**F7 — Restock reminder**
Every N days (default 14, user-settable), if items on the household's saved list are currently below their typical price, send one digest: what is cheaper, where, by how much, and when the offer ends.

**F8 — Price alerts**
Per product, "tell me when this drops below £X" or "when it drops at all".

### 5.4 Price basis

Both the shelf price and the loyalty price are stored and displayed. The user chooses which basis the basket total uses; default is loyalty price where the store publishes one. Totals never silently mix the two.

### 5.5 Data honesty rules

- Every price carries the timestamp it was observed at, and the UI shows it.
- A price we could not refresh today is shown as stale, not quietly reused.
- Where a retailer does not publish an offer end date, the UI says "offer seen since <date>", never an invented end date.
- Out-of-stock or unmatched items are excluded from a store's total and the store is marked "N of M items".

## 6. Success criteria (Phase 1)

- A basket of 18 common items returns a total for all four retailers in under 2 seconds from cached data.
- Daily refresh completes for ≥ 90% of tracked SKUs per retailer.
- Comparison correctness: a manual spot-check of 20 random items matches the retailer site on the day.

## 7. Later phases (not built now)

- WhatsApp list input (Meta Cloud API)
- Aldi, Lidl, Waitrose, Iceland, Ocado
- Postcode-level availability
- Paid data provider fallback (Apify actors) when scrapers are blocked
- Native mobile wrapper

## 8. Open decisions

| # | Decision | Default taken |
|---|---|---|
| D1 | Hosting | Vercel + Supabase Postgres |
| D2 | Data source | Own fetchers first; paid provider slot left in the adapter interface |
| D3 | Auth | Email magic link; household = one owner + invited members |
| D4 | Monetisation | None in Phase 1; ads/sponsorship considered later |
