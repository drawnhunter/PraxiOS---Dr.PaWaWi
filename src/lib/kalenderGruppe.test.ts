import { describe, it, expect } from "vitest";
import { gruppiereNachPatient } from "./kalenderGruppe";
import type { KalenderEintrag } from "@/pages/Kalender";

const e = (
  id: number,
  patientId: number,
  patientName: string,
  zeitVon: string | null = null,
  zeitBis: string | null = null,
): KalenderEintrag =>
  ({
    entry: { id, zeitVon, zeitBis },
    patientId,
    patientName,
  }) as KalenderEintrag;

describe("Kalender: Gruppierung nach Patient", () => {
  it("gruppiert Einträge pro Patient in Reihenfolge des Auftretens", () => {
    const g = gruppiereNachPatient([
      e(1, 5, "Mustermann, Max", "09:00", "09:45"),
      e(2, 3, "Esser, Christian", "09:30", "10:00"),
      e(3, 5, "Mustermann, Max", "11:00", "11:45"),
    ]);
    expect(g.map((x) => x.patientId)).toEqual([5, 3]);
    expect(g[0].eintraege.map((x) => x.entry.id)).toEqual([1, 3]);
  });

  it("Zeitspanne = früheste Von- bis späteste Bis-Zeit", () => {
    const g = gruppiereNachPatient([
      e(1, 5, "Mustermann, Max", "11:00", "11:30"),
      e(2, 5, "Mustermann, Max", "09:00", "12:00"),
      e(3, 5, "Mustermann, Max"),
    ]);
    expect(g[0].zeitspanne).toBe("09:00–12:00");
  });

  it("ohne Zeiten bleibt die Zeitspanne leer", () => {
    const g = gruppiereNachPatient([e(1, 5, "Mustermann, Max")]);
    expect(g[0].zeitspanne).toBeNull();
  });
});
