import { describe, it, expect } from "vitest";
import { icdSuche } from "./lib/icd";

describe("icdSuche (ICD-10-GM 2026, lokal)", () => {
  it("findet per Code-Präfix", () => {
    const t = icdSuche("J06");
    expect(t.length).toBeGreaterThan(0);
    expect(t[0].code.startsWith("J06")).toBe(true);
  });

  it('findet per Krankheitsname (Katalog nutzt „Diarrhoe", Synonym-Map schlägt Brücke)', () => {
    const t = icdSuche("Durchfall");
    expect(t.length).toBeGreaterThan(0);
    expect(t.some((x) => /diarrhoe|gastroenteritis/i.test(x.text))).toBe(true);
    const t2 = icdSuche("Diarrhoe");
    expect(t2.length).toBeGreaterThan(0);
  });

  it("mehrere Wörter müssen alle vorkommen", () => {
    const t = icdSuche("akute bronchitis");
    expect(t.length).toBeGreaterThan(0);
    expect(t.every((x) => /akute/i.test(x.text) && /bronchitis/i.test(x.text))).toBe(true);
  });

  it("zu kurze Suche liefert nichts", () => {
    expect(icdSuche("J")).toEqual([]);
    expect(icdSuche("")).toEqual([]);
  });

  it("Borreliose ist drin (Synonym → Lyme-Krankheit)", () => {
    const t = icdSuche("Borreliose");
    expect(t.some((x) => x.code.startsWith("A69.2"))).toBe(true);
  });

  it("Praxis-Klassiker direkt auffindbar", () => {
    expect(icdSuche("J06.9")[0]?.text).toContain("Akute Infektion der oberen Atemwege");
    expect(icdSuche("K59.0")[0]?.text).toBe("Obstipation");
    expect(icdSuche("Kreuzschmerz").length).toBeGreaterThan(0);
  });
});
