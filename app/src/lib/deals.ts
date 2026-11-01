// Deal maths: agreed totals, monthly salary, terms. Pure functions, no app state.
import type { DealField, DealTerms, LegacyDeal } from "../types";
import { money, numfmt, numVal, plural, round2, shortDay } from "./format";

type Terms = Partial<DealTerms>;

/** Fields the person actually filled (label or value). */
export const fieldsOf = (d: Terms): DealField[] =>
  (Array.isArray(d.fields) ? d.fields : []).filter(f => f && (String(f.label || "").trim() || String(f.value || "").trim()));

/** "calc" deals: the number fields switched to × are multiplied into the total. */
export const mulFields = (d: Terms): DealField[] =>
  d.type === "calc" ? fieldsOf(d).filter(f => f.mul && numVal(f.value) != null) : [];

/** Upgrades deals saved by older versions in place. Returns true when something changed. */
export function normDeal(d: LegacyDeal): boolean {
  if (d.type === "rate") {
    d.fields = [
      { label: "Rate", value: String(d.rate ?? ""), mul: true },
      { label: "Quantity", value: String(d.qty ?? ""), mul: true },
      ...(d.unit ? [{ label: "Unit", value: d.unit }] : []),
      ...(Array.isArray(d.terms) ? d.terms : []).map(t => ({ label: t.label || "", value: t.value || "" })),
    ];
    d.type = "calc"; delete d.rate; delete d.qty; delete d.unit; delete d.terms;
    return true;
  }
  if (Array.isArray(d.terms)) {
    d.fields = [...(d.fields || []), ...d.terms.map(t => ({ label: t.label || "", value: t.value || "" }))];
    delete d.terms;
    return true;
  }
  if (!d.type) { d.type = "fixed"; return true; }
  return false;
}

/** Same day of month, n months later; clamps 31 Jan + 1 month to 28/29 Feb. */
export const addMonths = (dt: Date | number, n: number): Date => {
  const d = new Date(dt), day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + n);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return d;
};

export interface Salary {
  /** salary earned up to and including today (or the last working day) */
  earned: number;
  months: number;
  days: number;
  /** the day the next full month completes */
  next: Date | null;
  ended: boolean;
  started: boolean;
}

/**
 * Monthly salary counted day by day. Each month runs from the start date's day of month
 * (23 Oct → 22 Nov is month 1); a part month is paid for the days worked, today included.
 */
export function salaryCalc(d: Terms, at: number = Date.now()): Salary {
  const amt = Number(d.amount) || 0;
  if (!d.start) return { earned: 0, months: 0, days: 0, next: null, ended: false, started: false };
  const s = new Date(d.start + "T00:00:00"), endD = d.end ? new Date(d.end + "T00:00:00") : null;
  let end = new Date(at); end.setHours(0, 0, 0, 0);
  const ended = !!endD && endD <= end;
  if (ended && endD) end = endD;
  if (end < s) return { earned: 0, months: 0, days: 0, next: addMonths(s, 1), ended, started: false };
  let m = 0;
  while (addMonths(s, m + 1) <= end) m++;
  const ps = addMonths(s, m), pe = addMonths(s, m + 1), pd = Math.round((+pe - +ps) / 864e5);
  let days = Math.round((+end - +ps) / 864e5) + 1;
  const earned = round2(amt * m + amt * days / pd);
  if (days >= pd) { m++; days = 0; }
  return { earned, months: m, days, next: addMonths(s, m + 1), ended, started: true };
}

export const isMonthly = (d: Terms | null | undefined): boolean => !!d && d.type === "monthly";

export const workedText = (d: Terms): string => {
  const c = salaryCalc(d);
  if (!c.started) return `Starts ${shortDay(d.start || "")}`;
  const p = [c.months ? plural(c.months, "month", "months") : "", c.days ? plural(c.days, "day", "days") : ""].filter(Boolean).join(" ");
  return `${p || "0 days"} worked`;
};

export const agLabel = (d: Terms): string =>
  isMonthly(d) ? (d.end && salaryCalc(d).ended ? "Earned" : "Earned till today") : "Agreed";

/** What is owed in total: agreed (fixed / multiplied) or earned so far (monthly). */
export const dealAgreed = (d: Terms, at?: number): number => {
  if (d.type === "monthly") return salaryCalc(d, at).earned;
  if (d.type === "calc") { const m = mulFields(d); return m.length ? round2(m.reduce((a, f) => a * (numVal(f.value) as number), 1)) : 0; }
  return round2(Number(d.amount) || 0);
};

export const dealFormula = (d: Terms): string =>
  d.type === "monthly" ? `${money(Number(d.amount) || 0)} a month from ${d.start ? shortDay(d.start) : "?"}${d.end ? ` to ${shortDay(d.end)}` : ""}`
    : d.type === "calc" ? (mulFields(d).map(f => `${String(f.label || "").trim() || "Value"} ${numfmt.format(numVal(f.value) as number)}`).join(" × ") || "No number fields to multiply")
      : "Fixed amount";

/** Fields that are not multiplied: shown as the deal's terms. */
export const termsOf = (d: Terms): { label: string; value: string }[] => {
  const m = mulFields(d);
  return fieldsOf(d).filter(f => !m.includes(f)).map(f => ({ label: String(f.label || "").trim(), value: String(f.value || "").trim() }));
};

export const termsText = (d: Terms): string[] =>
  [...termsOf(d).map(t => t.label ? `${t.label}: ${t.value}` : t.value), ...(d.deadline ? [`Deadline: ${shortDay(d.deadline)}`] : [])];

/** Balance text; a negative balance is "over" (paid too much) or "paid ahead" for salaries. */
export const balText = (b: number, d?: Terms | null): string =>
  b >= 0 ? money(b) : `${money(-b)} ${isMonthly(d) ? "paid ahead" : "over"}`;
