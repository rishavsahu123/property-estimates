// Formatting and small pure helpers. No DOM, no app state.

export const esc = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export const inr = new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2, minimumFractionDigits: 0 });
export const money = (n: unknown): string => inr.format(Math.round((Number(n) || 0) * 100) / 100);
export const numfmt = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 });

export const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;
/** 27 Oct 2026 */
export const fdate = (ts: number | Date): string => { const d = new Date(ts); return d.getDate() + " " + MON[d.getMonth()] + " " + d.getFullYear(); };
/** "2026-10-27" → 27 Oct 2026 */
export const shortDay = (s: string): string => { const [y, m, d] = s.split("-").map(Number); return `${d} ${MON[m - 1]} ${y}`; };
/** Local date as YYYY-MM-DD (not UTC). */
export const localDay = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Strict-ish number from a text box; 0 when empty or not a number. */
export const pnum = (v: unknown): number => { const n = parseFloat(String(v ?? "").replace(/,/g, "")); return isFinite(n) ? n : 0; };
export const round2 = (n: number): number => Math.round(n * 100) / 100;
/**
 * Lenient number from a deal field: "285 rs", "₹285/sq ft", "7000 sq ft", "1,25,000".
 * Returns null when the value does not start with a number.
 */
export const numVal = (v: unknown): number | null => {
  const t = String(v ?? "").trim().replace(/^(₹|rs\.?|inr)\s*/i, "").replace(/,/g, "");
  const m = t.match(/^(\d+(?:\.\d+)?|\.\d+)(\s*[^\d.].*)?$/i);
  return m ? parseFloat(m[1]) : null;
};

export const perUnit = (u: string | null | undefined): string => u ? u.replace(/^1000 pcs$/, "1000").replace(/\s*\(.*\)/, "") : "";
export const cleanPhone = (p: unknown): string => String(p || "").trim().replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
export const slug = (s: unknown): string => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "project";
export const newId = (p: string): string => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;

// Indian-style amount in words: crore, lakh, thousand
const W1 = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const W10 = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const w2 = (n: number): string => n < 20 ? W1[n] : W10[Math.floor(n / 10)] + (n % 10 ? "-" + W1[n % 10] : "");
const w3 = (n: number): string => [Math.floor(n / 100) ? W1[Math.floor(n / 100)] + " hundred" : "", n % 100 ? w2(n % 100) : ""].filter(Boolean).join(" ");
function intWords(n: number): string {
  const p: string[] = [];
  const cr = Math.floor(n / 1e7); n %= 1e7; if (cr) p.push(intWords(cr) + " crore");
  const l = Math.floor(n / 1e5); n %= 1e5; if (l) p.push(w2(l) + " lakh");
  const t = Math.floor(n / 1e3); n %= 1e3; if (t) p.push(w2(t) + " thousand");
  if (n) p.push(w3(n));
  return p.join(" ");
}
/** 1,25,000 → "One lakh twenty-five thousand rupees" */
export function inWords(v: unknown): string {
  const a = Math.round(Math.abs(Number(v) || 0) * 100), r = Math.floor(a / 100), ps = a % 100;
  let s = r ? intWords(r) + (r === 1 ? " rupee" : " rupees") : "";
  if (ps) s += (s ? " and " : "") + w2(ps) + " paise";
  s = s || "zero rupees";
  return s[0].toUpperCase() + s.slice(1);
}
