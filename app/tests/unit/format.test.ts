import { describe, expect, it } from "vitest";
import { cleanPhone, esc, fdate, inWords, localDay, money, numVal, plural, pnum, round2, shortDay } from "../../src/lib/format";

describe("money and words", () => {
  it("formats rupees the Indian way", () => {
    expect(money(1800000)).toBe("₹18,00,000");
    expect(money(15150)).toBe("₹15,150");
    expect(money(0.1 + 0.2)).toBe("₹0.3");
    expect(money("abc")).toBe("₹0");
  });
  it("writes amounts in crore / lakh words", () => {
    expect(inWords(15150)).toBe("Fifteen thousand one hundred fifty rupees");
    expect(inWords(125000)).toBe("One lakh twenty-five thousand rupees");
    expect(inWords(12345678)).toBe("One crore twenty-three lakh forty-five thousand six hundred seventy-eight rupees");
    expect(inWords(1)).toBe("One rupee");
    expect(inWords(0)).toBe("Zero rupees");
    expect(inWords(10.5)).toBe("Ten rupees and fifty paise");
  });
});

describe("numbers from text boxes", () => {
  it("numVal accepts units and currency around the number", () => {
    expect(numVal("285 rs")).toBe(285);
    expect(numVal("₹285/sq ft")).toBe(285);
    expect(numVal("7000 sq ft")).toBe(7000);
    expect(numVal("1,25,000")).toBe(125000);
    expect(numVal("Rs. 50")).toBe(50);
    expect(numVal(".5")).toBe(0.5);
    expect(numVal("Labour only")).toBeNull();
    expect(numVal("")).toBeNull();
  });
  it("pnum gives 0 for junk", () => {
    expect(pnum("1,500")).toBe(1500);
    expect(pnum("")).toBe(0);
    expect(pnum(null)).toBe(0);
  });
  it("round2", () => expect(round2(0.1 + 0.2)).toBe(0.3));
});

describe("dates and text", () => {
  it("formats dates", () => {
    expect(fdate(new Date(2026, 9, 27, 11))).toBe("27 Oct 2026");
    expect(shortDay("2026-11-01")).toBe("1 Nov 2026");
    expect(localDay(new Date(2026, 0, 5, 23, 30))).toBe("2026-01-05");
  });
  it("misc", () => {
    expect(plural(1, "entry", "entries")).toBe("1 entry");
    expect(plural(3, "entry", "entries")).toBe("3 entries");
    expect(cleanPhone(" +91 98260-12345 ")).toBe("+919826012345");
    expect(esc(`<b a="1">&'`)).toBe("&lt;b a=&quot;1&quot;&gt;&amp;&#39;");
  });
});
