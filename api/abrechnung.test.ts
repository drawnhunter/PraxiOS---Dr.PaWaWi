// Tests für die Abrechnungs-Helfer (Sortierung der Tageseinträge)
import { describe, it, expect } from "vitest";
import { eintraegeSortieren } from "./abrechnung";

const e = (id: number, datum: string, zeitVon: string | null = null) => ({
  id,
  datum,
  zeitVon,
});

describe("eintraegeSortieren (Tagesreihenfolge)", () => {
  it("mit Uhrzeit zuerst, dann ohne, dann nach id (neue unten)", () => {
    const sortiert = eintraegeSortieren([
      e(5, "2026-09-28"),
      e(2, "2026-09-28", "09:00"),
      e(1, "2026-09-28", "08:00"),
      e(6, "2026-09-28"),
      e(3, "2026-09-28", "10:00"),
      e(4, "2026-09-28"),
    ]);
    expect(sortiert.map((x) => x.id)).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("über Tage hinweg nach Datum, innerhalb des Tages stabil", () => {
    const sortiert = eintraegeSortieren([
      e(3, "2026-09-29"),
      e(1, "2026-09-28", "12:00"),
      e(2, "2026-09-28"),
    ]);
    expect(sortiert.map((x) => x.id)).toEqual([1, 2, 3]);
  });

  it("mutiert das Eingabe-Array nicht", () => {
    const liste = [e(2, "2026-09-28"), e(1, "2026-09-28")];
    eintraegeSortieren(liste);
    expect(liste.map((x) => x.id)).toEqual([2, 1]);
  });

  it("manuelle Reihenfolge (reihenfolge) schlägt Uhrzeit, 0/unsortiert fällt nach hinten", () => {
    const sortiert = eintraegeSortieren([
      { id: 1, datum: "2026-09-28", zeitVon: "08:00", reihenfolge: 3 },
      { id: 2, datum: "2026-09-28", zeitVon: "12:00", reihenfolge: 1 },
      { id: 3, datum: "2026-09-28", zeitVon: "07:00", reihenfolge: 2 },
      { id: 4, datum: "2026-09-28", zeitVon: "06:00", reihenfolge: 0 },
    ]);
    expect(sortiert.map((x) => x.id)).toEqual([2, 3, 1, 4]);
  });

  it("fehlende reihenfolge-Felder (Altbestand) bleiben zeitbasiert sortiert", () => {
    const sortiert = eintraegeSortieren([
      { id: 1, datum: "2026-09-28", zeitVon: "12:00" },
      { id: 2, datum: "2026-09-28", zeitVon: "08:00" },
    ]);
    expect(sortiert.map((x) => x.id)).toEqual([2, 1]);
  });
});
