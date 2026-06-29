// Exchange rates as of 2026-05-01 (base: USD)
export const RATES: Record<string, number> = {
  USD: 1.0,
  EUR: 0.9201,
  GBP: 0.7887,
  INR: 83.47,
  JPY: 153.82,
  AUD: 1.5312,
  CAD: 1.3641,
  SGD: 1.3478,
  AED: 3.6725,
  MXN: 17.154,
};

export type Currency = keyof typeof RATES;
export type Category = "Travel" | "Software" | "Food" | "Entertainment";

export interface Expense {
  id: number;
  date: string;
  merchant: string;
  amount: number;
  currency: string;
  category: Category;
}

export const EXPENSES: Expense[] = [
  { id: 1,  date: "2026-02-03", merchant: "Indigo Airlines",      amount: 8200,  currency: "INR", category: "Travel" },
  { id: 2,  date: "2026-02-10", merchant: "Slack Pro",            amount: 12.5,  currency: "USD", category: "Software" },
  { id: 3,  date: "2026-02-14", merchant: "Dishoom London",       amount: 68.4,  currency: "GBP", category: "Food" },
  { id: 4,  date: "2026-02-19", merchant: "AWS",                  amount: 143.0, currency: "USD", category: "Software" },
  { id: 5,  date: "2026-02-25", merchant: "Singapore Taxi",       amount: 32.0,  currency: "SGD", category: "Travel" },
  { id: 6,  date: "2026-03-02", merchant: "Figma",                amount: 15.0,  currency: "USD", category: "Software" },
  { id: 7,  date: "2026-03-07", merchant: "Boulangerie Utopie",   amount: 9.8,   currency: "EUR", category: "Food" },
  { id: 8,  date: "2026-03-11", merchant: "JR Rail Pass",         amount: 50000, currency: "JPY", category: "Travel" },
  { id: 9,  date: "2026-03-15", merchant: "Netflix",              amount: 15.49, currency: "USD", category: "Entertainment" },
  { id: 10, date: "2026-03-20", merchant: "Swiggy",               amount: 620,   currency: "INR", category: "Food" },
  { id: 11, date: "2026-03-28", merchant: "Air Canada",           amount: 410.0, currency: "CAD", category: "Travel" },
  { id: 12, date: "2026-04-02", merchant: "GitHub Copilot",       amount: 10.0,  currency: "USD", category: "Software" },
  { id: 13, date: "2026-04-08", merchant: "Burj Khalifa tickets", amount: 149.0, currency: "AED", category: "Entertainment" },
  { id: 14, date: "2026-04-12", merchant: "Qantas",               amount: 520.0, currency: "AUD", category: "Travel" },
  { id: 15, date: "2026-04-15", merchant: "Linear",               amount: 8.0,   currency: "USD", category: "Software" },
  { id: 16, date: "2026-04-18", merchant: "Tacos el Califa",      amount: 180,   currency: "MXN", category: "Food" },
  { id: 17, date: "2026-04-22", merchant: "Spotify",              amount: 10.99, currency: "USD", category: "Entertainment" },
  { id: 18, date: "2026-04-25", merchant: "Zoom",                 amount: 15.99, currency: "USD", category: "Software" },
  { id: 19, date: "2026-04-29", merchant: "Lune Croissanterie",   amount: 22.0,  currency: "AUD", category: "Food" },
  { id: 20, date: "2026-05-01", merchant: "Emirates flight",      amount: 1850,  currency: "AED", category: "Travel" },
];

export const CATEGORIES: Category[] = ["Travel", "Software", "Food", "Entertainment"];

export const MONTHS = ["Feb", "Mar", "Apr", "May"] as const;
export type Month = typeof MONTHS[number];

function monthOf(date: string): Month | null {
  const m = date.slice(5, 7);
  if (m === "02") return "Feb";
  if (m === "03") return "Mar";
  if (m === "04") return "Apr";
  if (m === "05") return "May";
  return null;
}

/**
 * Convert amount → USD. Returns null if the rate is missing, non-finite, or ≤ 0.
 * Rates are "1 USD = X currency", so: USD = amount / rate.
 */
export function toUSD(
  amount: number,
  currency: string,
  rates: Record<string, number> = RATES,
): number | null {
  const rate = rates[currency];
  if (rate == null || !Number.isFinite(rate) || rate <= 0) return null;
  if (!Number.isFinite(amount) || amount < 0) return null;
  return amount / rate;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function formatUSD(n: number | null, compact = false): string {
  if (n == null) return "—";
  if (compact && Math.abs(n) >= 10000) {
    return "$" + (n / 1000).toFixed(1) + "k";
  }
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export interface CategorySummary {
  category: string;
  count: number;
  totalUSD: number;
  pctOfTotal: number;
  largestUSD: number;
  largestMerchant: string;
  monthlyUSD: Record<Month, number>; // spend per month, USD
}

export interface MerchantSummary {
  merchant: string;
  totalUSD: number;
}

export interface Summary {
  byCategory: CategorySummary[];
  totalUSD: number;
  topMerchants: MerchantSummary[];
  skipped: Expense[];
}

export function buildSummary(
  expenses: Expense[],
  rates: Record<string, number> = RATES,
): Summary {
  const catMap = new Map<string, CategorySummary>();
  const merchMap = new Map<string, number>();
  const skipped: Expense[] = [];
  let total = 0;

  for (const e of expenses) {
    const usd = toUSD(e.amount, e.currency, rates);
    if (usd == null) { skipped.push(e); continue; }
    total += usd;

    const cat = catMap.get(e.category) ?? {
      category: e.category,
      count: 0,
      totalUSD: 0,
      pctOfTotal: 0,
      largestUSD: 0,
      largestMerchant: "",
      monthlyUSD: { Feb: 0, Mar: 0, Apr: 0, May: 0 },
    };
    cat.count += 1;
    cat.totalUSD += usd;
    if (usd > cat.largestUSD) { cat.largestUSD = usd; cat.largestMerchant = e.merchant; }
    const mo = monthOf(e.date);
    if (mo) cat.monthlyUSD[mo] += usd;
    catMap.set(e.category, cat);

    // normalise merchant key: trim + lowercase for grouping, display original
    const key = e.merchant.trim().toLowerCase();
    merchMap.set(key, (merchMap.get(key) ?? 0) + usd);
  }

  const byCategory = [...catMap.values()]
    .map((c) => ({
      ...c,
      totalUSD: round2(c.totalUSD),
      largestUSD: round2(c.largestUSD),
      monthlyUSD: Object.fromEntries(
        MONTHS.map((m) => [m, round2(c.monthlyUSD[m])])
      ) as Record<Month, number>,
    }))
    .sort((a, b) => b.totalUSD - a.totalUSD)
    .map((c) => ({ ...c, pctOfTotal: round2((c.totalUSD / (round2(total) || 1)) * 100) }));

  const topMerchants = [...merchMap.entries()]
    .map(([merchant, totalUSD]) => ({ merchant, totalUSD: round2(totalUSD) }))
    .sort((a, b) => b.totalUSD - a.totalUSD)
    .slice(0, 3);

  return { byCategory, totalUSD: round2(total), topMerchants, skipped };
}

/** Build a CSV string from the current expense list */
export function buildCSV(
  expenses: Expense[],
  rates: Record<string, number> = RATES,
): string {
  const header = ["ID", "Date", "Merchant", "Category", "Original Amount", "Currency", "USD Equivalent"].join(",");
  const rows = expenses.map((e) => {
    const usd = toUSD(e.amount, e.currency, rates);
    return [
      e.id,
      e.date,
      `"${e.merchant.replace(/"/g, '""')}"`,
      e.category,
      e.amount,
      e.currency,
      usd != null ? round2(usd) : "N/A",
    ].join(",");
  });
  return [header, ...rows].join("\n");
}
