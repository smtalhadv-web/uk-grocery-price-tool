# DESIGN — Trolleywise

The approved mockups (Claude Design canvas, 4 Nov 2026) are the reference. This file is the token-level record so the code matches them.

---

## 1. Direction

Plain, dense, trustworthy. This is a money tool, not a lifestyle brand: numbers are the largest thing on screen, decoration is minimal, and nothing animates for its own sake. Warm off-white ground rather than clinical white, one deep green for "this is the cheapest", one rust for "this is a discount".

## 2. Colour tokens

| Token | Hex | Use |
|---|---|---|
| `paper` | `#FAF9F5` | Page ground |
| `surface` | `#FFFFFF` | Cards, tables, headers |
| `surface-sunk` | `#F3F1EA` | Table head, total row |
| `ink` | `#14211C` | Primary text, dark panels |
| `ink-muted` | `#3C4844` | Secondary text |
| `ink-faint` | `#5A6560` | Labels, metadata |
| `line` | `#E3E0D8` | Borders |
| `line-soft` | `#EFEDE6` | Row dividers |
| `brand` | `#15694F` | Cheapest, primary action, links |
| `brand-deep` | `#0D4738` | Link hover |
| `brand-tint` | `#E8F1ED` | Info panels |
| `brand-tint-line` | `#C6DED4` | Info panel border |
| `brand-on-dark` | `#9FE0C6` | Accent on the ink panel |
| `save` | `#9C2F12` | Discount percentage text |
| `save-tint` | `#FBE9E2` | Discount badge ground |

Dark mode: not in Phase 1. When added, redefine these on `:root` under `prefers-color-scheme` rather than introducing a second palette.

## 3. Type

- Body / UI: **Inter** — 400, 500, 600
- Headings and figures: **Inter Tight** — 600, 700, letter-spacing −0.02em
- All prices and counts: `font-variant-numeric: tabular-nums`

Scale: 12 / 13 / 14 / 15 / 16 / 19 / 20 / 26 / 28 / 34 / 38 / 52.

## 4. Shape and space

- Radius: 8px buttons, 10–12px inputs and small cards, 14–16px panels, 999px pills.
- Card padding: 14–16px mobile, 20–24px desktop.
- Gaps: 8 / 10 / 16 / 24 / 32.
- Page gutter: 20px mobile, 32px desktop. Max content width 1120px.

## 5. Components

**Price cell** — tabular numerals; cheapest in a row is `brand` + weight 700 + a "cheapest" text label for screen readers and colour-blind users (R11).

**Store total card** — the winner is the inverted card (`ink` ground); the rest are `surface`. A progress bar underneath shows relative position, never as the only signal.

**Deal card** — store name, discount badge (`save` on `save-tint`), product, now price large with struck-through was price, footer row with offer window and offer kind.

**Offer window** — "Ends Tue 10 Nov" when the retailer publishes a date; "Seen since 2 Nov" when it does not. Never a guess.

**Price basis control** — a visible radio pair, not a hidden setting. Changing it re-renders every total on the page.

**Freshness line** — every data surface carries "priced HH:MM today" or "last priced <relative>" when stale.

**Chart** — inline SVG bars from the daily rollup. Lowest bar in `brand`, the rest in a muted sage. Axis labels in `ink-faint`, 12px. No tooltips required to read it.

## 6. Screens built

Mobile (390 × 844): Home, Product compare, Basket result, Family list, Restock reminder.
Web (1280 fluid): Home / deals, Basket comparison matrix, Product + price history.

Mobile web is the same Next.js app at narrow width; the mobile artboards describe how the layout collapses, not a separate codebase.

## 7. Responsive rules

- Side-by-side sections are `flex-wrap: wrap`; content takes `flex: 999 1 <basis>` so the sidebar drops below it on phones.
- The basket matrix scrolls horizontally inside an `overflow-x: auto` box below 900px rather than shrinking the price columns.
- Bottom nav appears below 768px only.
