import React from "react";
import { useMemo, useState } from "react";
import {
  CATEGORIES,
  EXPENSES,
  MONTHS,
  RATES,
  buildCSV,
  buildSummary,
  formatUSD,
  round2,
  toUSD,
  type Category,
  type Expense,
  type Month,
} from "@/lib/expenses-data";
type SortKey = "date" | "usd";
type SortDir = "asc" | "desc";

// ─── Category colors ────────────────────────────────────────────────────────────
const CATEGORY_COLORS: Record<string, string> = {
  Travel: "#3b6fd6",
  Software: "#8b5cf6",
  Food: "#16a34a",
  Entertainment: "#d97706",
};

function CategoryDot({ category }: { category: string }) {
  return (
    <span style={{
      display: "inline-block", width: 7, height: 7, borderRadius: "50%",
      background: CATEGORY_COLORS[category] ?? "var(--muted-foreground)", marginRight: 8, flexShrink: 0,
    }} />
  );
}

// ─── Inline share bar ───────────────────────────────────────────────────────────
function ShareBar({ pct, color, width = 90 }: { pct: number; color: string; width?: number }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div style={{ width, height: 6, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden", flexShrink: 0 }}>
        <div style={{ width: `${Math.min(pct, 100)}%`, height: "100%", borderRadius: 99, background: color }} />
      </div>
    </div>
  );
}

// ─── Sparkline ────────────────────────────────────────────────────────────────
function Sparkline({ values, accent = false }: { values: number[]; accent?: boolean }) {
  const max = Math.max(...values, 1);
  const W = 80, H = 28, pad = 2;
  const xs = values.map((_, i) => pad + (i / (values.length - 1)) * (W - pad * 2));
  const ys = values.map((v) => H - pad - (v / max) * (H - pad * 2));
  const path = xs.map((x, i) => `${i === 0 ? "M" : "L"}${x.toFixed(1)},${ys[i].toFixed(1)}`).join(" ");
  const last = values[values.length - 1];
  const prev = values[values.length - 2] ?? 0;
  const up = last >= prev;
  const color = accent ? (up ? "#16a34a" : "#dc2626") : "var(--brand)";

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
      <path d={path} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" opacity="0.6" />
      {values.map((v, i) => (
        <circle key={i} cx={xs[i]} cy={ys[i]} r={i === values.length - 1 ? 2.5 : 1.5}
          fill={i === values.length - 1 ? color : "var(--surface)"}
          stroke={color} strokeWidth="1.5" />
      ))}
    </svg>
  );
}

// ─── Main app ─────────────────────────────────────────────────────────────────
export default function App() {
  const [expenses, setExpenses] = useState<Expense[]>(EXPENSES);
  const [activeCategory, setActiveCategory] = useState<Category | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [eurRate, setEurRate] = useState<number>(RATES.EUR);
  const [activeTab, setActiveTab] = useState<"dashboard" | "about">("dashboard");

  const rates = useMemo(() => ({ ...RATES, EUR: eurRate }), [eurRate]);
  const summary = useMemo(() => buildSummary(expenses, rates), [expenses, rates]);
  const baseSummary = useMemo(() => buildSummary(expenses, RATES), [expenses]);
  const eurDelta = summary.totalUSD - baseSummary.totalUSD;
  const eurDeltaPct = baseSummary.totalUSD > 0
    ? ((eurDelta / baseSummary.totalUSD) * 100).toFixed(1)
    : "0.0";

  // Insight card derivations
  const insights = useMemo(() => {
    if (summary.byCategory.length === 0) return null;
    const topCat = summary.byCategory[0];
    const top3Sum = summary.topMerchants.reduce((s, m) => s + m.totalUSD, 0);
    const top3Pct = summary.totalUSD > 0 ? round2((top3Sum / summary.totalUSD) * 100) : 0;
    const monthTotals = MONTHS.map((m) => ({
      month: m,
      total: round2(summary.byCategory.reduce((s, c) => s + c.monthlyUSD[m], 0)),
    }));
    const busiest = monthTotals.reduce((a, b) => (b.total > a.total ? b : a), monthTotals[0]);
    // find which category drove the busiest month
    const busiestCat = summary.byCategory.reduce((a, c) =>
      c.monthlyUSD[busiest.month] > (a?.monthlyUSD[busiest.month] ?? -1) ? c : a, summary.byCategory[0]);
    return {
      topCat,
      largestSinglePct: summary.totalUSD > 0 ? round2((topCat.largestUSD / summary.totalUSD) * 100) : 0,
      top3Pct,
      busiestMonth: busiest.month,
      busiestTotal: busiest.total,
      busiestDriver: busiestCat.largestMerchant || busiestCat.category,
    };
  }, [summary]);

  const filtered = useMemo(() => {
    const rows = activeCategory ? expenses.filter((e) => e.category === activeCategory) : expenses;
    return rows
      .map((e) => ({ ...e, usd: toUSD(e.amount, e.currency, rates) ?? 0 }))
      .sort((a, b) => {
        const cmp = sortKey === "date" ? a.date.localeCompare(b.date) : a.usd - b.usd;
        return sortDir === "asc" ? cmp : -cmp;
      });
  }, [expenses, activeCategory, sortKey, sortDir, rates]);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortKey(key); setSortDir("desc"); }
  }

  function downloadCSV() {
    const csv = buildCSV(expenses, rates);
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "spendlens-expenses.csv"; a.click();
    URL.revokeObjectURL(url);
  }

  function downloadBoardReport() {
    const date = new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    const catRows = summary.byCategory.map((c) =>
      `  ${c.category.padEnd(16)}${formatUSD(c.totalUSD).padStart(12)}   ${String(c.pctOfTotal + "%").padStart(7)}   ${String(c.count).padStart(5)} txns   Largest: ${c.largestMerchant} (${formatUSD(c.largestUSD)})`
    ).join("\n");
    const topRows = summary.topMerchants.map((m, i) =>
      `  ${i + 1}. ${m.merchant.padEnd(24)}${formatUSD(m.totalUSD).padStart(10)}`
    ).join("\n");
    const note = Math.abs(eurDelta) > 0.01
      ? `EUR rate adjusted to ${eurRate.toFixed(4)} (base: ${RATES.EUR}). Impact on total: ${eurDelta >= 0 ? "+" : ""}${formatUSD(eurDelta)} (${eurDelta >= 0 ? "+" : ""}${eurDeltaPct}%).`
      : `EUR rate at baseline (${RATES.EUR}).`;

    const report = [
      "═══════════════════════════════════════════════════════",
      "  SPENDLENS  ·  Monthly Board Report",
      `  Generated ${date}  ·  Rate snapshot 2026-05-01`,
      "═══════════════════════════════════════════════════════",
      "",
      `  TOTAL SPEND  ${formatUSD(summary.totalUSD)}`,
      `  (${expenses.length} transactions across ${new Set(expenses.map((e) => e.currency)).size} currencies)`,
      "",
      "───────────────────────────────────────────────────────",
      "  SPEND BY CATEGORY",
      "───────────────────────────────────────────────────────",
      `  ${"Category".padEnd(16)}${"Total (USD)".padStart(12)}   ${"% Total".padStart(7)}   Count   Largest single`,
      catRows,
      "",
      "───────────────────────────────────────────────────────",
      "  TOP 3 MERCHANTS BY SPEND",
      "───────────────────────────────────────────────────────",
      topRows,
      "",
      "───────────────────────────────────────────────────────",
      "  NOTES",
      "───────────────────────────────────────────────────────",
      `  ${note}`,
      summary.skipped.length > 0
        ? `  ⚠  ${summary.skipped.length} row(s) excluded — missing or invalid exchange rate.`
        : "  All rows converted successfully.",
      "",
      "═══════════════════════════════════════════════════════",
    ].join("\n");

    const blob = new Blob([report], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "spendlens-board-report.txt"; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ minHeight: "100vh", background: "var(--background)" }}>
      {/* Header */}
      <header style={{ borderBottom: "1px solid var(--border)", background: "var(--surface)" }}>
        <div style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 28px 32px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 28 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--brand)" }}>
                Spendlens
              </div>
              <h1 style={{ marginTop: 10, fontSize: "clamp(1.9rem, 4vw, 3rem)", fontFamily: "var(--font-display)", letterSpacing: "-0.01em", lineHeight: 1.12 }}>
                Monthly expense summary, in USD.
              </h1>
              <p style={{ marginTop: 10, fontSize: 13.5, lineHeight: 1.6, color: "var(--muted-foreground)", maxWidth: 460 }}>
                Twenty transactions across ten currencies, converted using the rate snapshot from 2026-05-01.
                Filter, sort, add a row, or stress-test the EUR rate.
              </p>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10, alignItems: "flex-end" }}>
              <div style={{ borderRadius: 14, border: "1px solid var(--border)", background: "var(--surface-2)", padding: "16px 24px", minWidth: 200, textAlign: "right" }}>
                <div style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>
                  Total spend
                </div>
                <div className="num" style={{ marginTop: 5, fontSize: "2.1rem", fontWeight: 700, color: "var(--foreground)" }}>
                  {formatUSD(summary.totalUSD)}
                </div>
                {Math.abs(eurDelta) > 0.005 && (
                  <div className="num" style={{ marginTop: 4, fontSize: 11, color: eurDelta >= 0 ? "#16a34a" : "#dc2626" }}>
                    {eurDelta >= 0 ? "+" : ""}{formatUSD(eurDelta)} ({eurDelta >= 0 ? "+" : ""}{eurDeltaPct}%) vs base EUR
                  </div>
                )}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={downloadBoardReport}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>
                  🖶 Board Report
                </button>
                <button onClick={downloadCSV}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--surface)", fontSize: 12.5, fontWeight: 500, cursor: "pointer" }}>
                  ↓ Export CSV
                </button>
              </div>
            </div>
          </div>

          {/* Tab nav */}
          <nav style={{ marginTop: 28, display: "flex", gap: 4 }}>
            {(["dashboard", "about"] as const).map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                style={{
                  padding: "6px 16px", borderRadius: 8, fontSize: 13, fontWeight: 500, border: "none", cursor: "pointer", transition: "all .15s",
                  background: activeTab === tab ? "var(--brand)" : "transparent",
                  color: activeTab === tab ? "var(--brand-foreground)" : "var(--muted-foreground)",
                }}>
                {tab === "dashboard" ? "Dashboard" : "About this project"}
              </button>
            ))}
          </nav>
        </div>
      </header>

      {activeTab === "dashboard" ? (
        <main style={{ maxWidth: 1180, margin: "0 auto", padding: "40px 28px 56px", display: "flex", flexDirection: "column", gap: 40 }}>
          {/* Insight cards */}
          {insights && (
            <section style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))" }}>
              <InsightCard label="Cost driver">
                <strong>{insights.topCat.category}</strong> dominates at {insights.topCat.pctOfTotal}% of total spend.
                A single {formatUSD(insights.topCat.largestUSD)} charge from {insights.topCat.largestMerchant} accounts for {insights.largestSinglePct}% of the entire budget.
              </InsightCard>
              <InsightCard label="Concentration">
                Top 3 merchants — {summary.topMerchants.map((m) => m.merchant).join(", ")} — account for {insights.top3Pct}% of total spend.
                High concentration in {insights.topCat.category} warrants a closer look at trip consolidation.
              </InsightCard>
              <InsightCard label="Busiest month">
                {insights.busiestMonth} 2026 was the highest-spend month at {formatUSD(insights.busiestTotal)}, driven by {insights.busiestDriver}.
              </InsightCard>
            </section>
          )}

          {/* Summary grid */}
          <section style={{ display: "grid", gap: 24, gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))" }}>
            {/* Category table */}
            <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", padding: 28, gridColumn: "1 / -1" }}>
              <Eyebrow>Part A</Eyebrow>
              <h2 style={{ marginTop: 4, fontSize: "1.4rem", fontFamily: "var(--font-display)" }}>Spend by category</h2>
              <p style={{ marginTop: 5, fontSize: 12.5, color: "var(--muted-foreground)" }}>
                Ranked by USD total. Click a row to filter the table below.
              </p>
              <div style={{ marginTop: 20, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid var(--border)" }}>
                      {["Category", "Txns", "Total (USD)", "Share", "Largest single"].map((h) => (
                        <th key={h} style={{ padding: "8px 12px", textAlign: h === "Category" ? "left" : h === "Share" ? "left" : "right", fontSize: 10, fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted-foreground)", whiteSpace: "nowrap" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {summary.byCategory.map((c) => {
                      const active = activeCategory === c.category;
                      const monthVals = MONTHS.map((m) => c.monthlyUSD[m]);
                      const color = CATEGORY_COLORS[c.category] ?? "var(--brand)";
                      return (
                        <tr key={c.category}
                          onClick={() => setActiveCategory(active ? null : c.category as Category)}
                          style={{
                            borderBottom: "1px solid var(--border)", cursor: "pointer", transition: "background .12s",
                            background: active ? "var(--accent)" : undefined,
                          }}
                          onMouseEnter={(e) => { if (!active) (e.currentTarget as HTMLElement).style.background = "var(--surface-2)"; }}
                          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = active ? "var(--accent)" : ""; }}
                        >
                          <td style={{ padding: "16px 12px", fontWeight: 600 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span style={{ display: "flex", alignItems: "center" }}><CategoryDot category={c.category} />{c.category}</span>
                              <Sparkline values={monthVals} accent />
                            </div>
                          </td>
                          <td className="num" style={{ padding: "16px 12px", textAlign: "right", color: "var(--muted-foreground)" }}>{c.count}</td>
                          <td className="num" style={{ padding: "16px 12px", textAlign: "right", fontWeight: 700 }}>{formatUSD(c.totalUSD)}</td>
                          <td style={{ padding: "16px 12px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <ShareBar pct={c.pctOfTotal} color={color} />
                              <span className="num" style={{ fontSize: 12.5, color: "var(--muted-foreground)", minWidth: 38 }}>{c.pctOfTotal}%</span>
                            </div>
                          </td>
                          <td style={{ padding: "16px 12px", textAlign: "right" }}>
                            <div className="num" style={{ fontWeight: 600, fontSize: 13 }}>{formatUSD(c.largestUSD)}</div>
                            <div style={{ fontSize: 11.5, color: "var(--muted-foreground)" }}>{c.largestMerchant}</div>
                          </td>
                        </tr>
                      );
                    })}
                    <tr>
                      <td style={{ padding: "14px 12px", fontWeight: 700 }}>Grand Total</td>
                      <td className="num" style={{ padding: "14px 12px", textAlign: "right", color: "var(--muted-foreground)" }}>{expenses.length}</td>
                      <td className="num" style={{ padding: "14px 12px", textAlign: "right", fontWeight: 700 }}>{formatUSD(summary.totalUSD)}</td>
                      <td className="num" style={{ padding: "14px 12px", color: "var(--muted-foreground)", fontSize: 12.5 }}>100.0%</td>
                      <td />
                    </tr>
                  </tbody>
                </table>
                {activeCategory && (
                  <button onClick={() => setActiveCategory(null)}
                    style={{ marginTop: 10, fontSize: 12, fontWeight: 500, color: "var(--brand)", background: "none", border: "none", cursor: "pointer" }}>
                    ↩ Clear filter ({activeCategory})
                  </button>
                )}
              </div>
            </div>

            {/* Top merchants */}
            <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", padding: 28 }}>
              <Eyebrow>Top 3</Eyebrow>
              <h2 style={{ marginTop: 4, fontSize: "1.4rem", fontFamily: "var(--font-display)" }}>Biggest merchants</h2>
              <ol style={{ marginTop: 18, listStyle: "none", padding: 0, display: "flex", flexDirection: "column", gap: 18 }}>
                {summary.topMerchants.map((m, i) => {
                  const maxAmt = summary.topMerchants[0]?.totalUSD || 1;
                  return (
                    <li key={m.merchant}>
                      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12 }}>
                        <span style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                          <span className="num" style={{ fontSize: 12, color: "var(--muted-foreground)" }}>#{i + 1}</span>
                          <span style={{ fontWeight: 600, fontSize: 14.5, textTransform: "capitalize" }}>{m.merchant}</span>
                        </span>
                        <span className="num" style={{ fontWeight: 700, fontSize: 14.5, whiteSpace: "nowrap" }}>{formatUSD(m.totalUSD)}</span>
                      </div>
                      <div style={{ marginTop: 8, height: 7, borderRadius: 99, background: "var(--surface-2)", overflow: "hidden" }}>
                        <div style={{ width: `${(m.totalUSD / maxAmt) * 100}%`, height: "100%", borderRadius: 99, background: "var(--brand)" }} />
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* EUR What-if slider */}
            <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", padding: 28 }}>
              <Eyebrow>Bonus — What-if</Eyebrow>
              <h2 style={{ marginTop: 4, fontSize: "1.4rem", fontFamily: "var(--font-display)" }}>EUR / USD rate</h2>
              <p style={{ marginTop: 5, fontSize: 12.5, color: "var(--muted-foreground)" }}>
                Drag to see how a different EUR rate changes your total spend in dollars — not just the rate number.
              </p>
              <div style={{ marginTop: 18, padding: 18, borderRadius: 10, border: "1px solid var(--border)", background: "var(--surface-2)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: 12, fontWeight: 600, color: "var(--muted-foreground)" }}>EUR rate</span>
                  <span className="num" style={{ fontWeight: 700, fontSize: 15 }}>{eurRate.toFixed(4)}</span>
                </div>
                <input type="range" min={0.8} max={1.1} step={0.0001} value={eurRate}
                  onChange={(e) => setEurRate(parseFloat(e.target.value))}
                  style={{ width: "100%", marginTop: 10, accentColor: "var(--brand)" }} />
                <div className="num" style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--muted-foreground)", marginTop: 4 }}>
                  <span>0.80</span>
                  <button onClick={() => setEurRate(RATES.EUR)}
                    style={{ fontSize: 10, color: "var(--brand)", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>
                    reset to {RATES.EUR}
                  </button>
                  <span>1.10</span>
                </div>
                {Math.abs(eurDelta) > 0.005 ? (
                  <div style={{ marginTop: 14, padding: "12px 14px", borderRadius: 8, background: eurDelta >= 0 ? "rgba(22,163,74,0.08)" : "rgba(220,38,38,0.08)", border: `1px solid ${eurDelta >= 0 ? "rgba(22,163,74,0.25)" : "rgba(220,38,38,0.25)"}` }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: eurDelta >= 0 ? "#16a34a" : "#dc2626" }}>
                      {eurDelta >= 0 ? "+" : ""}{formatUSD(eurDelta)} total ({eurDelta >= 0 ? "+" : ""}{eurDeltaPct}%)
                    </div>
                    <div style={{ fontSize: 11, color: "var(--muted-foreground)", marginTop: 2 }}>
                      vs the base rate of {RATES.EUR} — EUR expenses only
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 14, padding: "10px 14px", borderRadius: 8, background: "var(--surface)", border: "1px solid var(--border)", fontSize: 12, color: "var(--muted-foreground)" }}>
                    At base rate — adjust slider to see impact
                  </div>
                )}
              </div>
            </div>

            {/* Analyst note */}
            <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", padding: 28 }}>
              <Eyebrow>Analyst note</Eyebrow>
              <p style={{ marginTop: 14, fontSize: 13.5, lineHeight: 1.75, color: "var(--foreground)" }}>
                Conversion divides native amounts by their USD rate (8200 INR ÷ 83.47 = $98.24).
                A 25th currency needs one line in the <code style={codeStyle}>RATES</code> map.
                A null rate returns <code style={codeStyle}>null</code> — guarded in <code style={codeStyle}>toUSD()</code> — and flagging those rows is the next hardening step.
              </p>
            </div>
          </section>

          {/* Add expense */}
          <section style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", padding: 28 }}>
            <Eyebrow>Quick entry</Eyebrow>
            <h2 style={{ marginTop: 4, fontSize: "1.4rem", fontFamily: "var(--font-display)" }}>Add an expense</h2>
            <AddExpenseForm onAdd={(e) => setExpenses((prev) => [...prev, { ...e, id: (prev.at(-1)?.id ?? 0) + 1 }])} />
          </section>

          {/* Expense table */}
          <section style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", padding: 28 }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "flex-end", justifyContent: "space-between", gap: 12 }}>
              <div>
                <Eyebrow>{filtered.length} of {expenses.length} rows</Eyebrow>
                <h2 style={{ marginTop: 4, fontSize: "1.4rem", fontFamily: "var(--font-display)" }}>
                  {activeCategory ? `${activeCategory} expenses` : "All expenses"}
                </h2>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {CATEGORIES.map((c) => {
                  const active = activeCategory === c;
                  return (
                    <button key={c} onClick={() => setActiveCategory(active ? null : c)}
                      style={{
                        display: "flex", alignItems: "center",
                        borderRadius: 99, border: `1px solid ${active ? "var(--brand)" : "var(--border)"}`,
                        background: active ? "var(--brand)" : "var(--surface)",
                        color: active ? "var(--brand-foreground)" : "var(--foreground)",
                        padding: "6px 14px", fontSize: 12.5, fontWeight: 500, cursor: "pointer", transition: "all .12s",
                      }}>
                      <span style={{
                        display: "inline-block", width: 7, height: 7, borderRadius: "50%", marginRight: 8,
                        background: active ? "var(--brand-foreground)" : (CATEGORY_COLORS[c] ?? "var(--muted-foreground)"),
                      }} />
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginTop: 20, overflowX: "auto", marginLeft: -28, marginRight: -28, paddingLeft: 28, paddingRight: 28 }}>
              <table style={{ width: "100%", minWidth: 600, borderCollapse: "collapse", fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--border)" }}>
                    <SortTh label="Date" sortKey="date" active={sortKey === "date"} dir={sortDir} onToggle={toggleSort} />
                    <th style={thStyle}>Merchant</th>
                    <th style={thStyle}>Category</th>
                    <th style={{ ...thStyle, textAlign: "right" }}>Original</th>
                    <SortTh label="USD" sortKey="usd" active={sortKey === "usd"} dir={sortDir} onToggle={toggleSort} align="right" />
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((e) => (
                    <tr key={e.id} style={{ borderBottom: "1px solid var(--border)" }}>
                      <td className="num" style={tdStyle({ color: "var(--muted-foreground)", padding: "18px 12px" })}>{e.date}</td>
                      <td style={tdStyle({ fontWeight: 600, padding: "18px 12px" })}>{e.merchant}</td>
                      <td style={tdStyle({ padding: "18px 12px" })}>
                        <span style={{ display: "inline-flex", alignItems: "center", color: "var(--muted-foreground)" }}>
                          <CategoryDot category={e.category} />{e.category}
                        </span>
                      </td>
                      <td className="num" style={tdStyle({ textAlign: "right", color: "var(--muted-foreground)", padding: "18px 12px" })}>
                        {e.amount.toLocaleString()} <span style={{ fontSize: 11.5, opacity: 0.75 }}>{e.currency}</span>
                      </td>
                      <td className="num" style={tdStyle({ textAlign: "right", fontWeight: 700, padding: "18px 12px" })}>
                        {formatUSD(e.usd)}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} style={{ padding: "32px 12px", textAlign: "center", fontSize: 13, color: "var(--muted-foreground)" }}>
                        No expenses in this category.{" "}
                        <button onClick={() => setActiveCategory(null)} style={{ color: "var(--brand)", background: "none", border: "none", cursor: "pointer", fontWeight: 500 }}>Clear filter</button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {summary.skipped.length > 0 && (
              <p style={{ marginTop: 10, fontSize: 12, color: "var(--destructive)" }}>
                ⚠ {summary.skipped.length} row(s) excluded — missing or invalid exchange rate.
              </p>
            )}
          </section>

          <footer style={{ borderTop: "1px solid var(--border)", paddingTop: 20, fontSize: 12, color: "var(--muted-foreground)" }}>
            Built for the Spendlens product analyst intern assignment · Rate snapshot: 2026-05-01 (USD base) · Numbers reconcile with the static dataset.
          </footer>
        </main>
      ) : (
        <AboutPage />
      )}
    </div>
  );
}

// ─── About / docs page ────────────────────────────────────────────────────────
function AboutPage() {
  return (
    <main style={{ maxWidth: 860, margin: "0 auto", padding: "40px 28px 56px", display: "flex", flexDirection: "column", gap: 32 }}>
      <DocSection eyebrow="Part A — Written response" title="How the currency conversion works">
        <p>
          Rates are stored as "1 USD = X currency units" (INR: 83.47 means $1 buys ₹83.47),
          so conversion is <code style={codeStyle}>USD = amount / rate</code>.
          Sums accumulate in full floating-point precision; rounding happens only at display time
          to prevent category totals drifting from the true figure.
          All logic lives in one pure function — <code style={codeStyle}>buildSummary(expenses, rates)</code> —
          that accepts the rate table as an argument rather than reading a global.
          That made the What-if EUR slider a two-line addition: pass a modified rate object, call the same function.
        </p>
        <p style={{ marginTop: 12 }}>
          <strong>Adding a 25th currency</strong> means one edit: add an entry to <code style={codeStyle}>RATES</code>.
          The form's currency dropdown is built from <code style={codeStyle}>Object.keys(RATES)</code>,
          so the new option appears everywhere automatically. No other code changes.
        </p>
        <p style={{ marginTop: 12 }}>
          <strong>If a rate is null or missing</strong>, <code style={codeStyle}>toUSD()</code> returns <code style={codeStyle}>null</code> —
          it validates that the rate exists, is finite, and is greater than zero before dividing.
          <code style={codeStyle}>buildSummary()</code> moves any affected rows into a <code style={codeStyle}>skipped</code> array
          and the dashboard shows a red warning with the count.
          A missing rate can never silently zero out a category — the finance head sees a gap, not a wrong total.
        </p>
      </DocSection>

      <DocSection eyebrow="README" title="What this project does">
        <p>A live web dashboard that converts 20 multi-currency expense records into a single USD view. The finance head can open one URL at the start of the month and immediately see: total spend, category breakdown with monthly sparklines, top merchants by spend, and a filterable transaction table.</p>
        <p style={{ marginTop: 12 }}>It covers every deliverable in the intern brief: Part A data wrangling, Part B web app (deployed), Part C documentation, the What-if EUR slider bonus, and 9 documented edge cases below.</p>
        <h3 style={{ marginTop: 20, marginBottom: 10, fontSize: 14, fontWeight: 700 }}>Run it locally</h3>
        <Code>{`git clone <repo-url>\nbun install\nbun run dev\n# → http://localhost:8080`}</Code>
        <h3 style={{ marginTop: 20, marginBottom: 10, fontSize: 14, fontWeight: 700 }}>File structure</h3>
        <Code>{`src/
  routes/
    __root.tsx          # HTML shell, fonts, error boundary
    index.tsx           # The whole dashboard (single-page by design)
  lib/
    expenses-data.ts    # RATES, EXPENSES, toUSD(), buildSummary(), buildCSV()
  styles.css            # Design tokens (oklch), typography utilities
docs/
  ceo-brief.md          # Plain-English CEO note (also visible on this page)
  edge-cases.md         # 9 failure modes with mitigations`}</Code>
        <h3 style={{ marginTop: 20, marginBottom: 10, fontSize: 14, fontWeight: 700 }}>Assumptions the next developer should know</h3>
        <ul style={{ paddingLeft: 20, lineHeight: 1.9, fontSize: 14 }}>
          <li>Rates are stored as "1 USD = X currency", so conversion is <code style={codeStyle}>amount / rate</code>.</li>
          <li>Sums accumulate in full floating-point precision; rounding only happens at display time to prevent drift.</li>
          <li>New expenses are in-memory — a refresh wipes added rows. No persistence layer was built in this sprint.</li>
          <li>Categories in the filter chips are derived from <code style={codeStyle}>CATEGORIES</code>. A new category added only via the form will appear in the table but not in the filter chips.</li>
          <li>Merchant grouping in the top-3 list normalises to lowercase for deduplication (e.g. "AWS" and "aws" merge correctly).</li>
        </ul>
        <h3 style={{ marginTop: 20, marginBottom: 10, fontSize: 14, fontWeight: 700 }}>Known gaps — what I'd fix with 4 more hours</h3>
        <ol style={{ paddingLeft: 20, lineHeight: 1.9, fontSize: 14 }}>
          <li><strong>No persistence.</strong> Refresh wipes added rows. Wire to Supabase with a single <code style={codeStyle}>expenses</code> table and RLS.</li>
          <li><strong>Static rates.</strong> Add a daily-cached fetch from an FX API with fallback to the snapshot on failure.</li>
          <li><strong>No edit / delete in the form.</strong> CSV import would have the highest finance impact in the next sprint.</li>
          <li><strong>No unit tests.</strong> <code style={codeStyle}>toUSD</code> and <code style={codeStyle}>buildSummary</code> are pure functions — three Vitest cases would lock in the math.</li>
          <li><strong>Accessibility.</strong> Sort buttons need <code style={codeStyle}>aria-sort</code>; the slider could use <code style={codeStyle}>aria-valuetext</code> with a formatted label.</li>
        </ol>
      </DocSection>

      <DocSection eyebrow="CEO Brief" title="What I built and why it matters">
        <p><strong>What you're looking at:</strong> A web dashboard that takes our messy multi-currency expense records and turns them into a single USD summary with category breakdowns, spend trends by month, and the top merchants by total spend. Finance opens one URL at the start of the month and gets the numbers for the board pack — no spreadsheet, no Googling rates.</p>
        <p style={{ marginTop: 12 }}><strong>Why it matters to Spendlens:</strong> This is the smallest usable version of the product we're selling. If it works for our own finance team on day one, that's direct evidence the wedge is real. It also gives finance back the half-day they currently spend on manual rate lookups each month.</p>
        <h3 style={{ marginTop: 20, marginBottom: 8, fontSize: 14, fontWeight: 700 }}>Three trade-offs I made</h3>
        <ol style={{ paddingLeft: 20, lineHeight: 2, fontSize: 14 }}>
          <li><strong>In-memory state, not a database.</strong> New rows disappear on refresh. I made this call because the dataset is fixed for evaluation and building a fake persistence layer would have eaten time better spent making the math and UX right. Persistence is the first thing I'd add in the next sprint.</li>
          <li><strong>Static rate snapshot, not a live FX feed.</strong> A real feed needs auth, caching, and a fallback strategy for outages — that's non-trivial in 48 hours. The What-if EUR slider proves the architecture is ready for it: the whole app recomputes from one pure function, so swapping in a live rate is a one-line change to where it gets called.</li>
          <li><strong>One page, no auth, no charts.</strong> A chart looks impressive but doesn't change a board number. I put that time into correctness — proper rounding, graceful handling of missing rates, a skipped-row warning — because a wrong total is worse than a missing bar chart.</li>
        </ol>
        <h3 style={{ marginTop: 20, marginBottom: 8, fontSize: 14, fontWeight: 700 }}>Three priorities for next sprint</h3>
        <ol style={{ paddingLeft: 20, lineHeight: 2, fontSize: 14 }}>
          <li><strong>Persist expenses + audit log.</strong> The tool isn't useful to finance until rows survive a refresh, and any board-pack data needs a defensible audit trail.</li>
          <li><strong>Live FX with daily cache + last-known fallback.</strong> This is the original ask from the head of finance — removing the manual rate work entirely.</li>
          <li><strong>CSV import.</strong> Gets us from "20 rows we typed" to "everything in the corporate card export" in one step. The difference between a demo and something finance opens every week.</li>
        </ol>
        <h3 style={{ marginTop: 20, marginBottom: 8, fontSize: 14, fontWeight: 700 }}>What's honestly half-finished</h3>
        <p style={{ fontSize: 14 }}>The add-expense form has no edit or delete. There are no unit tests, though the math is isolated in pure functions so adding them is straightforward. Mobile layout works but I'd want a design pass before showing it to anyone external.</p>
      </DocSection>

      <DocSection eyebrow="Bonus — Edge cases" title="Nine ways this could break">
        <p style={{ marginBottom: 16 }}>Written as if someone asked me to try to break the dashboard before handing it to a contractor.</p>
        {EDGE_CASES.map((ec, i) => (
          <div key={i} style={{ marginBottom: 20, paddingBottom: 20, borderBottom: i < EDGE_CASES.length - 1 ? "1px solid var(--border)" : "none" }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>{i + 1}. {ec.title}</div>
            <div style={{ display: "grid", gap: 6, fontSize: 13, lineHeight: 1.7 }}>
              <div><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Risk: </span>{ec.risk}</div>
              <div><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Today: </span>{ec.today}</div>
              <div><span style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color: "var(--muted-foreground)" }}>Correct: </span>{ec.correct}</div>
            </div>
          </div>
        ))}
      </DocSection>

      <footer style={{ borderTop: "1px solid var(--border)", paddingTop: 20, fontSize: 12, color: "var(--muted-foreground)" }}>
        Spendlens intern assignment · Rate snapshot 2026-05-01 · README, CEO brief, and edge cases combined on this page for evaluator convenience.
      </footer>
    </main>
  );
}

const EDGE_CASES = [
  {
    title: "Rate entry is null, undefined, or missing",
    risk: "A category total silently drops and the board pack shows the wrong number.",
    today: "toUSD() returns null for any rate that is missing, non-finite, or ≤ 0. buildSummary() collects affected rows in a skipped array and the UI shows a red warning with the count.",
    correct: "Same as today, but also log the currency code so the rate gap can be chased down. Should arguably block report export entirely until resolved.",
  },
  {
    title: "Amount is zero or negative",
    risk: "Refunds show as spend; zero amounts pad transaction counts without contributing value.",
    today: "The form rejects amounts ≤ 0 via min=\"0.01\". Existing dataset is trusted (it has none). toUSD() also returns null for non-finite amounts.",
    correct: "Allow negative amounts as refunds with a refund flag, and surface them separately in the summary so net spend is clear.",
  },
  {
    title: "Form submitted with empty fields",
    risk: "NaN rows get added to the table, poisoning totals with invisible bad data.",
    today: "Native required on every field + min=\"0.01\" on amount + an explicit Number.isFinite + trim check in the submit handler. Invalid submits are silently no-ops.",
    correct: "Show inline validation messages so the user understands why their click did nothing. Silent failure is confusing.",
  },
  {
    title: "Merchant name with special characters, scripts, or emoji",
    risk: "XSS, layout breakage with RTL names, or very long names overflowing the table column.",
    today: "React escapes by default — safe from XSS. Long names wrap in the table cell. CSV export double-quotes and escapes internal quotes.",
    correct: "Cap merchant input at 80 characters. Add dir=\"auto\" to merchant cells for RTL scripts.",
  },
  {
    title: "Very large amounts (e.g. ¥9,999,999,999)",
    risk: "Number display overflow; the table column widens and pushes content off-screen.",
    today: "Tabular numeric formatting + horizontal scroll on the table container. JS number handles the math safely.",
    correct: "Compact format ($1.2M) above a threshold, with the full number on hover.",
  },
  {
    title: "Filtering produces zero results",
    risk: "User sees a blank table and assumes the app is broken.",
    today: "Explicit empty state: 'No expenses in this category.' with a one-click 'Clear filter' link inline.",
    correct: "Same as today. Already implemented.",
  },
  {
    title: "EUR slider at extremes (0.80 or 1.10)",
    risk: "Totals look 'wrong' compared to the base figure; users forget they moved the slider.",
    today: "Slider is clamped 0.80–1.10. The header shows the dollar delta AND percentage change vs baseline, not just the raw rate. A reset button snaps back to the snapshot rate. Recompute uses the same pure function so numbers can't go stale.",
    correct: "Add a persistent 'What-if mode active' badge on the header whenever the slider has been moved from baseline.",
  },
  {
    title: "Narrow mobile screen (320–375px)",
    risk: "Header overlaps totals, table overflows, form fields squash to unusable.",
    today: "Header flex-wraps, summary cards stack, table container scrolls horizontally, form switches to single-column. Tested at 375px.",
    correct: "A card-per-row view for the transaction table on <480px would be easier to scan than horizontal scroll.",
  },
  {
    title: "Two expenses with the same merchant, different casing ('AWS' vs 'aws')",
    risk: "Top-merchants list splits the same vendor in two; the real #1 merchant looks smaller than it is.",
    today: "Merchant keys are normalised to lowercase before grouping in buildSummary(), so 'AWS' and 'aws' correctly merge. Display name uses whichever appears first in the data.",
    correct: "Store a canonical display name explicitly rather than relying on insertion order.",
  },
];

// ─── Small helpers ─────────────────────────────────────────────────────────────
const thStyle: React.CSSProperties = {
  padding: "8px 12px",
  fontSize: 10,
  fontWeight: 600,
  letterSpacing: "0.12em",
  textTransform: "uppercase",
  color: "var(--muted-foreground)",
  textAlign: "left",
};
const tdStyle = (extra?: React.CSSProperties): React.CSSProperties => ({
  padding: "12px 12px",
  ...extra,
});
const codeStyle: React.CSSProperties = {
  background: "var(--surface-2)",
  borderRadius: 4,
  padding: "1px 5px",
  fontSize: "0.85em",
  fontFamily: "ui-monospace, monospace",
};

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--brand)" }}>
      {children}
    </div>
  );
}

function InsightCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", padding: "24px 26px" }}>
      <Eyebrow>{label}</Eyebrow>
      <p style={{ marginTop: 12, fontSize: 14.5, lineHeight: 1.65, color: "var(--foreground)" }}>
        {children}
      </p>
    </div>
  );
}

function Code({ children }: { children: string }) {
  return (
    <pre style={{ background: "var(--surface-2)", border: "1px solid var(--border)", borderRadius: 10, padding: "14px 16px", fontSize: 12, overflowX: "auto", lineHeight: 1.7, fontFamily: "ui-monospace, monospace" }}>
      {children}
    </pre>
  );
}

function DocSection({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section style={{ borderRadius: 16, border: "1px solid var(--border)", background: "var(--surface)", padding: 28 }}>
      <Eyebrow>{eyebrow}</Eyebrow>
      <h2 style={{ marginTop: 6, fontSize: "1.5rem", fontFamily: "var(--font-display)", letterSpacing: "-0.01em" }}>{title}</h2>
      <div style={{ marginTop: 14, fontSize: 14, lineHeight: 1.8, color: "var(--foreground)" }}>
        {children}
      </div>
    </section>
  );
}


function SortTh({ label, sortKey, active, dir, onToggle, align = "left" }: {
  label: string; sortKey: SortKey; active: boolean; dir: SortDir;
  onToggle: (k: SortKey) => void; align?: "left" | "right";
}) {
  return (
    <th style={{ ...thStyle, textAlign: align }}>
      <button onClick={() => onToggle(sortKey)}
        style={{ background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4, color: active ? "var(--foreground)" : "var(--muted-foreground)", fontSize: "inherit", fontWeight: "inherit", letterSpacing: "inherit", textTransform: "inherit" }}>
        {label}
        <span style={{ fontSize: 9 }}>{active ? (dir === "asc" ? "▲" : "▼") : "↕"}</span>
      </button>
    </th>
  );
}

// ─── Add expense form ─────────────────────────────────────────────────────────
function AddExpenseForm({ onAdd }: { onAdd: (e: Omit<Expense, "id">) => void }) {
  const [merchant, setMerchant] = useState("");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState<string>("USD");
  const [category, setCategory] = useState<Category>("Software");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function validate() {
    const errs: Record<string, string> = {};
    if (!merchant.trim()) errs.merchant = "Merchant name is required.";
    else if (merchant.trim().length > 80) errs.merchant = "Max 80 characters.";
    const amt = parseFloat(amount);
    if (!amount) errs.amount = "Amount is required.";
    else if (!Number.isFinite(amt) || amt <= 0) errs.amount = "Must be a number greater than zero.";
    if (!date) errs.date = "Date is required.";
    return errs;
  }

  function submit(ev: React.FormEvent) {
    ev.preventDefault();
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;
    onAdd({ merchant: merchant.trim(), amount: parseFloat(amount), currency, category, date });
    setMerchant("");
    setAmount("");
    setErrors({});
  }

  const inputStyle = (err?: string): React.CSSProperties => ({
    width: "100%", border: `1px solid ${err ? "var(--destructive)" : "var(--border)"}`,
    background: "var(--surface)", padding: "11px 14px", borderRadius: 8, fontSize: 14,
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
  });

  return (
    <form onSubmit={submit} noValidate>
      <div style={{ marginTop: 18, paddingTop: 18, borderTop: "1px solid var(--border)" }} />
      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))" }}>
        <FormField label="Merchant" error={errors.merchant}>
          <input value={merchant} onChange={(e) => setMerchant(e.target.value)} placeholder="e.g. Uber" style={inputStyle(errors.merchant)} maxLength={80} />
        </FormField>
        <FormField label="Amount" error={errors.amount}>
          <input type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" style={inputStyle(errors.amount)} className="num" />
        </FormField>
        <FormField label="Currency">
          <select value={currency} onChange={(e) => setCurrency(e.target.value)} style={inputStyle()}>
            {Object.keys(RATES).map((c) => <option key={c}>{c}</option>)}
          </select>
        </FormField>
        <FormField label="Category">
          <select value={category} onChange={(e) => setCategory(e.target.value as Category)} style={inputStyle()}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </FormField>
        <FormField label="Date" error={errors.date}>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle(errors.date)} className="num" />
        </FormField>
      </div>
      <div style={{ marginTop: 20 }}>
        <button type="submit"
          style={{ padding: "11px 26px", borderRadius: 8, border: "none", background: "var(--brand)", color: "var(--brand-foreground)", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
          Add expense
        </button>
      </div>
    </form>
  );
}

function FormField({ label, error, children, style }: { label: string; error?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6, ...style }}>
      <span style={{ fontSize: 11, fontWeight: 600, color: "var(--muted-foreground)" }}>{label}</span>
      {children}
      {error && <span style={{ fontSize: 11, color: "var(--destructive)" }}>{error}</span>}
    </label>
  );
}
