# MEMORY — Trolleywise

Running record of decisions, findings and gotchas. Append, don't rewrite.

---

## 2026-11-04 — Project start

**Context.** Goal is a UK supermarket price and sale comparison tool: show where a shop is cheapest, what is on offer and until when, for a reusable household list.

**Finding: there is no official UK grocery API.** Tesco, Sainsbury's, Asda, Morrisons and Ocado publish no developer API — no OAuth, no REST, no webhooks. Every comparison product in this space is built on either its own fetchers or a paid data provider. This is the central constraint of the project, not a detail.

**Decision: own fetchers first.** Paid providers (Apify actors, data vendors) are left as a drop-in adapter, not a dependency. Cost target for Phase 1 is roughly $5–30/month: Vercel + Supabase free tiers, no AI spend, no proxy spend until blocking forces it.

**Decision: no AI anywhere.** The user explicitly does not want AI APIs. Everything the product does — totals, percentages, "good time to buy", restock reminders — is arithmetic over stored prices. Recorded as R1.

**Finding: dual pricing is the hard part.** Four of the big grocers run a loyalty price layer (Tesco Clubcard, Sainsbury's Nectar, Morrisons More Card, Asda Rewards) and the gap can be large. A comparison that silently picks one basis per store is wrong. Both bases are stored; the user chooses; totals never mix. Recorded as R3.

**Decision: Phase 1 retailers** — Asda, Morrisons, Sainsbury's, Tesco. Tesco expected to be the most protected, so it may land last. Aldi and Lidl deferred.

**Decision: scope** — ~1,000–2,000 curated SKUs, national online prices, no store-level pricing, no checkout (no retailer offers one). Deep links to the retailer instead.

**Decision: stack** — Next.js 15 App Router + TypeScript + Tailwind, Postgres via Drizzle on Supabase, GitHub Actions for cron, Vercel for hosting, Resend for email.

**Decision: `DATA_SOURCE=fixtures` mode.** The UI must be runnable and reviewable with no database and no network, so the product can be judged before any scraper is reliable.

**Design approved.** Eight artboards: five mobile screens (home, product compare, basket result, family list, restock reminder) and three web screens (deals, basket matrix, product + history). Tokens recorded in DESIGN.md. Numbers in the mockups are placeholder sample data.

**Open:** final product name. "Trolleywise" is a working title used throughout the mockups and code; not checked for availability or trademark.

**Repo note.** The session's GitHub credential cannot create repositories, only push to ones already attached. The repo was created by hand on GitHub and then attached.

## 2026-11-04 — Live reconnaissance of all four retailers

Done through the user's own browser, since the build sandbox cannot reach
retailer domains. This replaces the earlier "endpoint shapes unverified" note
for Asda and sharpens it for the other three.

**Asda — solved.** The site searches an Algolia index, `ASDA_PRODUCTS`. The
adapter now queries the same index the browser does. Captured field shape:
`CIN` (sku), `NAME`, `BRAND`, `PACK_SIZE` ("6X200G"), `STATUS`, `STOCK` (keyed
by depot id), `PRICES.EN.{PRICE, OFFER, PRICEPERUOMFORMATTED}` with PRICE in
pounds as a number, and `PROMOS.EN[]` with `NAME`, `TYPE`, `START_DATE`,
`END_DATE` in unix seconds.

Three things that matter:
- **No EAN anywhere in the index.** Asda can only be matched on brand + name +
  pack size. The assumption that EAN matching works for every retailer was
  wrong.
- **A far-future END_DATE is a sentinel**, not an offer end date. Mapped to
  null so the UI says "seen since" instead of printing a date years out (R2).
- **Promotions are often multibuys** ("Any 2 for £7"). Recorded as `multibuy`
  and never folded into a unit price.

The Algolia app id and search-only key are published in the page's own
`__CONFIG__.app.algolia` and rotate, so the adapter reads them from the live
page at run time rather than carrying a copied key in the repo (R9).

**Sainsbury's — needs a browser.** Now server-rendered React; the old
`groceries-api` path is not usable from the page. The PDP carries JSON-LD with
sku and price but no EAN and no Nectar price. Shelf and Nectar prices are in
the DOM under stable hooks (`data-testid="gw-product-price-container"`,
`gw-product-retail-price`).

**Morrisons — GraphQL behind a WAF.** Uses urql (`__URQL_DATA__`) plus
`product-listing-structured-data` JSON-LD, with AWS WAF in front.

**Tesco — hardest, as expected.** Moved to `/shop/en-GB/search`, shows a
consent wall before content, and exposes no preloaded state.

**Architecture consequence.** Only Asda works as a plain `fetch` adapter. The
other three need a real browser (Playwright): accept consent once, read the
rendered page. That cannot run in a serverless function, so those adapters
belong in the scheduled GitHub Actions job writing straight to Postgres —
still free, but a second kind of adapter and a decision to take deliberately
rather than drift into. Not built yet; recorded in TASKS.

## 2026-11-04 — Browser adapters built, all four retailers verified

Decision taken: the three retailers with no JSON endpoint get Playwright-driven
adapters running in a scheduled GitHub Actions job, writing to Postgres
directly. Serverless was never an option for them.

Selectors confirmed on the live sites:

- **Sainsbury's** — tile `[data-testid="gw-product-card"]`, name
  `gw-product-name`, shelf `gw-product-retail-price`, member
  `gw-product-contextual-price`, and `gw-nectar-offer-badge` is what makes a
  contextual price a *Nectar* price rather than an ordinary promotion.
- **Morrisons** — `fop-product-link`, `fop-title`, `fop-price`,
  `fop-original-price`, `fop-price-per-unit`, plus an "Offer name: …" string
  that carries multibuys. The grid lazy-loads, so the driver scrolls.
- **Tesco** — no stable test ids at all, hashed class names. Parsed from the
  tile's text instead, which is more durable here. Tesco is the only retailer
  that publishes a real offer end date ("valid for delivery from … until …").

**Nothing exposes a barcode on a search tile** — not one of the four. Matching
is brand + name + pack size everywhere, carried entirely by the confidence
floor. The EAN column stays for a future source but is unfilled today.

Three parsing traps, all now covered by tests built from captured text:
1. Price nodes contain the unit price glued on ("£3.90£2.35 / kg").
2. Multibuys ("Any 2 for £7", "Buy 3 for £4") are not unit prices. Where a
   tile shows only a multibuy, `parse()` returns null rather than guess.
3. A contextual/discounted price is only a *member* price when the badge says
   so; otherwise it is a promotion everyone gets.

Structure that makes this maintainable: `extract` runs in the page and returns
plain strings; `parse` is pure and unit-tested. A retailer changing their
markup fails a test instead of shipping a wrong price.

**Still not done:** nothing has run end to end against a real database. No
Supabase project, no live run, no spot-check against the retailer sites.

## 2026-11-04 — Moved to GitHub Pages

The user asked about GitHub Pages. It is a good fit for this phase, with one
real cost, so it was taken deliberately rather than drifted into.

**Why it works here.** The data was already being produced by a scheduled
Actions job. So the job now writes JSON into `public/data/` and commits it,
the build renders every page from those files, and Pages serves the result.
Hosting drops to zero, there is no database to operate, no connection string,
no secret to guard — there is no public endpoint to protect — and the price
history ends up versioned in git, which is free backup and a readable audit
trail.

**What it costs.** Accounts. A shared family list, reminder emails and price
alerts all need a server, so Milestone 6 is blocked until we add a small
Worker or go back to Vercel + Supabase. The Postgres schema and the Drizzle
repository are deliberately left in the repo, still wired behind
`DATA_SOURCE=db`, so that is a reconnection rather than a rewrite.

**Consequences worth remembering:**
- A static export cannot read `searchParams` on the server, so basket and
  search moved to the client. They run the *same* pricing functions over the
  same JSON — there is one set of arithmetic, not two.
- The store filter on the deals feed became four real pages, `/store/<slug>`,
  rather than a query parameter.
- The product page shows the cheapest store's history rather than letting the
  user switch, since switching was a query parameter too. Worth revisiting
  with client-side state if it matters.
- `prebuild` writes a fixtures dataset when none exists, flagged
  `sample: true`, so a fresh clone is fully usable and the Data page says
  loudly that the prices are not real.
- The dataset is ~2MB for 40 products with 120 days of history. At 2,000
  products that is closer to 100MB in the repo and growing daily — history
  retention and per-product file splitting will need revisiting well before
  then.

## 2026-11-04 — First real refresh run failed; two bugs

The scheduled job ran and failed in 41 seconds. Both causes were real, and
neither could have been caught by the unit tests.

**1. `__name is not defined`.** The TypeScript runner (tsx) compiles with
esbuild's `keepNames`, which wraps every function in a `__name(...)` call.
That helper exists in Node but not in the browser page, so any function handed
to `page.evaluate` throws the moment it runs. Every browser adapter was dead
on arrival. Fixed with an `addInitScript` that defines a no-op `__name` in the
page, plus an immediate `evaluate` for the already-loaded page, since
`addInitScript` only applies from the next navigation.

**2. Asda returns 403 to datacentre IPs.** Their HTML sits behind a CDN that
refuses CI runners, so reading the published Algolia config with a plain
fetch fails — though the Algolia endpoint itself is happy to serve the same
query the browser makes. Fixed by reading the config in a browser page once
per run and handing it to the adapter via `setCredentials()`. Everything after
that stays a cheap HTTP call.

**3. Isolation was weaker than claimed.** `loadGrid` threw outside the
per-term try, so one retailer's failure aborted the whole run instead of
being recorded against that store (R7). Each store's scrape is now wrapped,
and so is the scroll.

**Caveat worth keeping in mind:** none of this could be verified locally —
Playwright's Chromium download is blocked in the build sandbox, and the
retailer domains are not reachable from it either. The fixes are standard, but
the next run is the first real test of them.

## 2026-11-04 — Second run: Asda works, the rest are IP-blocked

Run #2 on the fixed code, 4m16s, reported green. Green only meant "not every
retailer failed"; the real result is per store:

| Store | Found | Parsed | Matched | Outcome |
|---|---|---|---|---|
| Asda | 419 | 419 | 22 / 40 | **ok** |
| Morrisons | 142 | 142 | 8 | 403 partway through |
| Sainsbury's | 0 | 0 | 0 | 403 immediately |
| Tesco | 0 | 0 | 0 | 403 immediately |

**Both earlier fixes worked.** Asda's browser-read Algolia credentials got
419 results, and Morrisons parsed 142 tiles before being cut off, which only
happens if the `__name` shim did its job.

**The wall is IP reputation, not code.** GitHub Actions runners publish their
IP ranges and the retailers' CDNs refuse them. This is exactly the risk
flagged when the browser adapters were written, and it has landed. Nothing in
the parsing can fix it. The options are a self-hosted runner on a home
connection, a residential proxy (paid), running the scrape locally and
committing, or shipping with Asda alone.

**New bug found by the run, now fixed.** The commit step used
`git diff --quiet -- public/data`, which reports no change for files git has
never tracked. On the first run every data file is untracked, so the run that
finally produced real prices committed nothing and said "No price changes
today". It now stages first and compares against the index.

**Also worth watching:** Asda matched only 22 of 40 catalogue items from 419
results. Some of that is genuine (not every item is stocked), but the
confidence floor and the brand-less titles are the likely cause and the
unmatched queue should be reviewed before widening the catalogue.

## 2026-11-04 — Decision on the 403s: split the refresh

Self-hosted runner was the first instinct and was **rejected**: the repo has
to stay public for free Pages, and GitHub advises against self-hosted runners
on public repositories because a fork's pull request can run arbitrary code
on them. Making the repo private would need a paid plan for Pages, which
defeats the point of the whole hosting choice.

So the refresh is split by where it can run:

- **Asda — cloud.** It passes from GitHub's runners, so the scheduled job now
  covers Asda only, daily, and commits. Fully automatic, still free.
- **Sainsbury's, Morrisons, Tesco — a home connection.** `npm run
  refresh:local` scrapes those three, commits and pushes. Residential IP, so
  the same code works. Can be put on Windows Task Scheduler. Missing a day is
  harmless: the site keeps the last price and marks it stale, which is what
  the staleness rule was for (R2).

Not tried, and worth remembering as the paid escape hatch: a residential
proxy (~$15–30/month) would put all four back in the cloud.

## 2026-11-04 — Residential IP verified; scheduling stays on the user's machine

Tested all three blocked retailers through the user's own Chrome, running the
adapters' own extraction logic against live search pages:

| Store | Tiles | Result |
|---|---|---|
| Sainsbury's | 30 | Nectar price correctly split (£5.00 shelf / £4.50 member) |
| Morrisons | 10 | "was" price correctly read (£3.00 now / £3.90 was) |
| Tesco | 55 | Clubcard price and multibuy both detected |

No 403 anywhere. The selectors still hold and the IP is the only variable.

**Claude's own scheduler cannot run this**, and that was checked rather than
assumed: a scheduled task runs in Anthropic's cloud, which has the same
datacentre-IP problem and cannot reach retailer domains at all, and the
device bridge to the user's machine is not connected (no shell tool on it).
Windows Task Scheduler is the right tool — no AI session, no cost, runs
whenever the machine is on. Added `scripts/refresh-local.cmd` for it.
