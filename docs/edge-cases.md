# Edge cases & failure modes

Trying to break the dashboard, on purpose. For each: what could go wrong, what the code does today, what it *should* do.

---

### 1. A rate entry is `null`, `undefined`, or missing
- **Risk:** A category total silently drops, board pack is wrong.
- **Today:** `toUSD()` returns `null` for any rate that is missing, non-finite, or ≤ 0. `buildSummary` collects affected rows into a `skipped` array and the UI shows a red banner with the count.
- **Correct:** Same as today, plus log the currency code so we can chase down the rate gap. Should arguably block report export entirely.

### 2. Amount is 0 or negative
- **Risk:** Refunds and corrections show as "spend"; zeros pad transaction counts.
- **Today:** The form rejects ≤ 0. Existing data is trusted as-is (the dataset has none).
- **Correct:** Allow negative amounts as refunds with a `refund` flag, and surface them separately in the summary so net spend is clear.

### 3. Form submitted with empty fields
- **Risk:** `NaN` rows poison the table and totals.
- **Today:** Native `required` on every field + `min="0.01"` on amount + an explicit `Number.isFinite` + trim check in the submit handler. A no-op submit just silently fails.
- **Correct:** Show inline validation messages so the user understands *why* the click did nothing.

### 4. Merchant name with special characters / scripts / emoji
- **Risk:** XSS, layout breakage with RTL or very long names.
- **Today:** React escapes by default — safe from XSS. Long names wrap in the table cell.
- **Correct:** Cap at, say, 80 chars on input; add `dir="auto"` to merchant cells for RTL scripts.

### 5. Very large amounts (¥9,999,999,999)
- **Risk:** Number overflow visually, table column widens and pushes content off-screen.
- **Today:** Tabular numerics + horizontal scroll on the table container. Math is fine — JS `number` handles it.
- **Correct:** Compact format (`$1.2M`) above a threshold, with the full number on hover.

### 6. Filtering produces zero results
- **Risk:** User sees an empty table and assumes the app broke.
- **Today:** Explicit empty state: "No expenses match this filter."
- **Correct:** Same, plus a one-click "clear filter" inside the empty state.

### 7. EUR slider at extremes (0.80 or 1.10)
- **Risk:** Totals look "wrong" vs the displayed base total; users forget they moved the slider.
- **Today:** Slider is clamped 0.80–1.10. The header total shows the delta vs base, and a "reset" link snaps back to the snapshot rate. Recompute is a pure function so totals can't go stale.
- **Correct:** Add a visible "What-if mode" badge on the header when the slider has been moved.

### 8. Narrow mobile screen (320–375px)
- **Risk:** Header overlaps total, table overflows, form fields squash.
- **Today:** Header flex-wraps, the summary cards stack, the table container scrolls horizontally, the form switches to single column. Tested at 375px.
- **Correct:** A dedicated card view for the table on <480px instead of horizontal scroll — easier to scan on phone.

### 9. Adding a 25th currency tomorrow
- **Risk:** Hardcoded currency lists go stale.
- **Today:** The form's currency dropdown is generated from `Object.keys(RATES)`, so a single edit to `RATES` adds it everywhere. Categories are derived from the data the same way.
- **Correct:** Move rates to a config endpoint so finance can update them without a code deploy.

### 10. Two expenses with the same merchant name but different casing ("AWS" vs "aws")
- **Risk:** Top-merchants list splits the same vendor in two; the #1 merchant looks smaller than it is.
- **Today:** Case-sensitive grouping — they'd be counted separately.
- **Correct:** Normalise merchant strings (trim + casefold) before grouping, and store a canonical display name.
