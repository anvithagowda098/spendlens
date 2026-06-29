# Spendlens dashboard — CEO brief

## What I built
A live web dashboard that takes our messy multi-currency expense data and turns it into a single USD view: total spend, category breakdown, top merchants, and a filterable transaction list. Finance can open one URL on the first of the month and get the numbers for the board pack — no spreadsheet, no manual rate lookups.

## Why it matters to Spendlens
This is the smallest version of the product we sell. If it's useful internally on day one, it's evidence the wedge is real. It also gives finance back the half-day they spend each month Googling rates.

## Three trade-offs I made
1. **In-memory data, no database.** New entries vanish on refresh. I chose this because the dataset is fixed for evaluation and a fake database would have eaten the budget needed to make the math and UX correct. Persistence is the first thing I'd add.
2. **Static rate snapshot, not a live FX feed.** A real feed needs auth, caching, and a fallback strategy for outages — non-trivial in 48 hours. To prove we're ready for it, I shipped the What-if EUR slider: the whole app recomputes from a pure function, so swapping in a live rate is a one-line change.
3. **One page, no auth, no charts.** A chart looks impressive but doesn't change a board number. I spent that time on correctness (rounding, missing-rate handling, the skipped-row warning) because a wrong total is worse than a missing chart.

## Three priorities for next sprint
1. **Persist expenses + audit log.** Impact: the tool actually becomes usable beyond a demo, and we get a defensible audit trail finance will need before this touches a board pack.
2. **Live FX with daily cache + last-known fallback.** Impact: removes the manual rate work entirely; the original ask from the head of finance.
3. **CSV import.** Impact: gets us from "20 rows we typed" to "everything in the corporate card export" in one step. This is the difference between a demo and a tool finance opens every week.

## What's honestly half-finished
The add-expense form has no edit or delete. There are no unit tests, though the math is isolated in a pure function so adding them is straightforward. Mobile layout works but I'd want a design pass before showing it to anyone external.
