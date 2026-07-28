// Tests für die GOÄ-Basisbibliothek (Praxis-Mapping)
import { describe, it, expect } from "vitest";
import { GOAE_BIBLIOTHEK, goaeVorschlaege } from "@db/goaeBibliothek";

describe("GOÄ-Basisbibliothek (Praxis-Mapping)", () => {
  it("enthält die Praxis-Ziffern mit kurzen eigenen Texten (kein Katalogtext)", () => {
    const ziffern = GOAE_BIBLIOTHEK.map((e) => e.ziffer);
    for (const z of ["1", "3", "34", "272", "285", "286A", "532", "§ 2"]) {
      expect(ziffern).toContain(z);
    }
    for (const e of GOAE_BIBLIOTHEK) {
      expect(e.kurztext.length).toBeGreaterThan(4);
      expect(e.hinweis.length).toBeGreaterThan(10);
    }
  });

  it("schlägt zur Suche passende Ziffern vor", () => {
    expect(goaeVorschlaege("hyperthermie").some((e) => e.ziffer === "532")).toBe(true);
    expect(goaeVorschlaege("infusion").some((e) => e.ziffer === "272")).toBe(true);
    expect(goaeVorschlaege("ozon").some((e) => e.ziffer === "285")).toBe(true);
    expect(goaeVorschlaege("honorar").some((e) => e.ziffer === "§ 2")).toBe(true);
    expect(goaeVorschlaege("xyz-nichts").length).toBe(0);
  });
});
