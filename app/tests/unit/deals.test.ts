import { afterEach, describe, expect, it, vi } from "vitest";
import { addMonths, agLabel, balText, dealAgreed, dealFormula, normDeal, salaryCalc, termsText, workedText } from "../../src/lib/deals";
import type { DealTerms, LegacyDeal } from "../../src/types";

const at = (s: string) => new Date(s).getTime();

describe("agreed totals", () => {
  it("multiplies the × fields", () => {
    const d: DealTerms = { type: "calc", fields: [{ label: "Rate", value: "285 rs", mul: true }, { label: "Quantity", value: "7000 sq ft", mul: true }, { label: "Work", value: "Labour only" }] };
    expect(dealAgreed(d)).toBe(1995000);
    expect(dealFormula(d)).toBe("Rate 285 × Quantity 7,000");
    expect(termsText(d)).toEqual(["Work: Labour only"]);
  });
  it("fixed amount", () => {
    expect(dealAgreed({ type: "fixed", fields: [], amount: 75000 })).toBe(75000);
    expect(dealFormula({ type: "fixed", fields: [] })).toBe("Fixed amount");
  });
  it("no number fields gives 0", () => expect(dealAgreed({ type: "calc", fields: [{ label: "Rate", value: "ask", mul: true }] })).toBe(0));
});

describe("old deal shapes are upgraded", () => {
  it("rate × qty with terms", () => {
    const d = { id: "d", projectId: "p", title: "t", type: "rate", rate: 285, qty: 7000, unit: "sq ft", terms: [{ label: "Work", value: "Brick" }] } as LegacyDeal;
    expect(normDeal(d)).toBe(true);
    expect(d.type).toBe("calc");
    expect(d.fields?.map(f => f.label)).toEqual(["Rate", "Quantity", "Unit", "Work"]);
    expect(dealAgreed(d as DealTerms)).toBe(1995000);
    expect(normDeal(d)).toBe(false);
  });
  it("missing type becomes fixed", () => {
    const d = { id: "d", projectId: "p", title: "t", amount: 5 } as LegacyDeal;
    expect(normDeal(d)).toBe(true);
    expect(d.type).toBe("fixed");
  });
});

describe("monthly salary, day by day", () => {
  afterEach(() => { vi.useRealTimers(); });
  const w: DealTerms = { type: "monthly", fields: [], amount: 9300, start: "2026-10-23" };
  it("part month: 23 Oct to 1 Nov is 10 of 31 days", () => {
    const c = salaryCalc(w, at("2026-11-01T10:00:00"));
    expect(c).toMatchObject({ earned: 3000, months: 0, days: 10, started: true, ended: false });
    expect(c.next?.getDate()).toBe(23);
  });
  it("first day counts", () => expect(salaryCalc(w, at("2026-10-23T08:00:00")).earned).toBe(300));
  it("full month completes on 22 Nov", () => {
    expect(salaryCalc(w, at("2026-11-22T20:00:00"))).toMatchObject({ earned: 9300, months: 1, days: 0 });
  });
  it("two months and 3 days on 25 Dec", () => {
    expect(salaryCalc(w, at("2026-12-25T10:00:00"))).toMatchObject({ earned: 19500, months: 2, days: 3 });
  });
  it("stops at the last working day", () => {
    const c = salaryCalc({ ...w, end: "2026-11-30" }, at("2026-12-25T10:00:00"));
    expect(c).toMatchObject({ earned: 11780, months: 1, days: 8, ended: true });
    vi.useFakeTimers(); vi.setSystemTime(new Date("2026-12-25T10:00:00"));
    expect(agLabel({ ...w, end: "2026-11-30" })).toBe("Earned");
    vi.setSystemTime(new Date("2026-11-10T10:00:00"));
    expect(agLabel({ ...w, end: "2026-11-30" })).toBe("Earned till today");
  });
  it("not started yet", () => {
    expect(salaryCalc(w, at("2026-10-01T10:00:00"))).toMatchObject({ earned: 0, started: false });
  });
  it("month ends are clamped (31 Jan → 28 Feb)", () => {
    expect(addMonths(new Date(2027, 0, 31), 1).getDate()).toBe(28);
    // 31 Jan – 27 Feb is the whole first period (28 days)
    const f: DealTerms = { type: "monthly", fields: [], amount: 28000, start: "2027-01-31" };
    expect(salaryCalc(f, at("2027-02-26T09:00:00"))).toMatchObject({ months: 0, days: 27, earned: 27000 });
    expect(salaryCalc(f, at("2027-02-27T09:00:00"))).toMatchObject({ months: 1, days: 0, earned: 28000 });
  });
  it("texts", () => {
    expect(dealFormula({ ...w, end: "2026-11-30" })).toBe("₹9,300 a month from 23 Oct 2026 to 30 Nov 2026");
    expect(balText(-500, w)).toBe("₹500 paid ahead");
    expect(balText(-500, { type: "fixed", fields: [] })).toBe("₹500 over");
    expect(typeof workedText(w)).toBe("string");
  });
});
