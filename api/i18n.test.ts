// Tests für Mehrsprachigkeit (Sprachliste, UI-Strings, Rückwärts-Mapping)
import { describe, it, expect } from "vitest";
import { SPRACHEN, UI_STRINGS, type UiKey } from "@contracts/anamnese";

describe("Mehrsprachige Bögen (1.1.0)", () => {
  it("jede Sprache hat Flagge, Namen und vollständige UI-Strings", () => {
    const keys = Object.keys(UI_STRINGS.de) as UiKey[];
    expect(SPRACHEN.length).toBeGreaterThanOrEqual(7);
    for (const s of SPRACHEN) {
      expect(s.flagge.length).toBeGreaterThan(0);
      expect(s.name.length).toBeGreaterThan(1);
      const strings = UI_STRINGS[s.code];
      expect(strings, `UI_STRINGS fehlt für ${s.code}`).toBeDefined();
      for (const k of keys) {
        expect(strings[k]?.length, `${s.code}.${k} leer`).toBeGreaterThan(0);
      }
    }
  });

  it("Pflicht-Sprachen aus der Anforderung sind dabei", () => {
    const codes = SPRACHEN.map((s) => s.code);
    for (const code of ["de", "en", "tr", "ar", "ru", "uk", "sk"]) {
      expect(codes).toContain(code);
    }
  });
});
