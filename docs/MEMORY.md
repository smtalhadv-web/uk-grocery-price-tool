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
