# Spendlens — Multi-currency expense dashboard

Converts 20 multi-currency expenses into a clean USD summary the finance head can drop into a board report. One page: category totals, top merchants, sortable/filterable table, add-expense form, and a What-if EUR rate slider.

**Live URL:** [deploy to Netlify/Vercel and paste URL here]

## Run locally

```bash
bun install
bun run dev
```

Open http://localhost:8080.

## Structure

```
src/
  routes/
    __root.tsx          # html shell, fonts, meta
    index.tsx           # the whole dashboard (single page by design)
  lib/
    expenses-data.ts    # RATES, EXPENSES, toUSD(), buildSummary() — pure, testable
  styles.css            # design tokens (oklch), typography, utilities
docs/
  ceo-brief.md          # one-page plain-English brief
  edge-cases.md         # bonus: 8+ failure modes
```

All conversion + aggregation lives in `buildSummary(expenses, rates)` — one pure function that takes the rate table as an argument. That's what made the What-if slider trivial (call the same function with a mutated rate table) and what makes the code easy to unit-test.

## Assumptions

- Rate table is "1 USD = X currency", so USD = `amount / rate`.
- Sums are kept in full precision; rounding happens at display time only.
- New expenses are in-memory — no persistence layer in this build.
- The four categories are fixed (Travel / Software / Food / Entertainment) because the dataset is fixed. Categories in the summary are derived from the data, so new categories from the form would still appear in the table but not in the filter chips.

## Known limitations & what I'd fix with another 4 hours

1. **No persistence.** Refresh wipes added rows. Wire to Lovable Cloud (Supabase) with a single `expenses` table + RLS.
2. **Static rates.** Add a daily-cached fetch from an FX API with fallback to the snapshot.
3. **Form is minimal.** No edit/delete, no CSV import, no duplicate detection. CSV import is the highest-leverage finance ask.
4. **No tests.** `buildSummary` and `toUSD` are pure — three Vitest cases would lock in the math.
5. **Accessibility pass.** Sort buttons need `aria-sort`; the slider could use a `aria-valuetext` with the formatted rate.
