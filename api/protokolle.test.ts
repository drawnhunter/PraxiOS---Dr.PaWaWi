import { describe, it, expect } from "vitest";
import {
  normalisiereBloecke,
  protokollGesperrt,
  strukturOhneWerte,
  zahlAusZelle,
  type ProtokollBlock,
} from "@contracts/protokolle";

describe("protokollGesperrt (48-h-Fenster)", () => {
  it("frisch angelegt = offen", () => {
    expect(protokollGesperrt(new Date())).toBe(false);
  });
  it("47 h alt = offen", () => {
    expect(protokollGesperrt(new Date(Date.now() - 47 * 3600 * 1000))).toBe(false);
  });
  it("49 h alt = gesperrt", () => {
    expect(protokollGesperrt(new Date(Date.now() - 49 * 3600 * 1000))).toBe(true);
  });
  it("akzeptiert ISO-Strings", () => {
    expect(protokollGesperrt(new Date(Date.now() - 100 * 3600 * 1000).toISOString())).toBe(true);
  });
});

describe("strukturOhneWerte (Vorlagen enthalten keine Inhalte)", () => {
  it("leert Inhalte, behält Struktur", () => {
    const bloecke: ProtokollBlock[] = [
      { id: "a", typ: "text", titel: "Verlauf", inhalt: "geheimer Text" },
      { id: "b", typ: "tabelle", titel: "RR", spalten: ["Zeit", "RR"], zeilen: [["08:00", "120"]], diagramm: true },
      { id: "c", typ: "skala", titel: "Schmerz", wert: 7 },
      { id: "d", typ: "foto", titel: "Wunde", dokumentId: 42 },
      { id: "e", typ: "vital", titel: "Vital", spalten: 3, felder: [{ label: "Puls (/min)", wert: "88" }, { label: "RR systolisch (mmHg)", wert: "120" }] },
      { id: "f", typ: "ankreuz", titel: "Check", optionen: [{ label: "Aufklärung", gewaehlt: true }] },
    ];
    const s = strukturOhneWerte(bloecke);
    expect(s[0]).toMatchObject({ typ: "text", inhalt: "" });
    expect(s[1]).toMatchObject({ typ: "tabelle", zeilen: [], spalten: ["Zeit", "RR"], diagramm: true });
    expect(s[2]).toMatchObject({ wert: null });
    expect(s[3]).toMatchObject({ dokumentId: null });
    expect(s[4]).toMatchObject({
      felder: [
        { label: "Puls (/min)", wert: "" },
        { label: "RR systolisch (mmHg)", wert: "" },
      ],
    });
    expect(s[5]).toMatchObject({ optionen: [{ label: "Aufklärung", gewaehlt: false }] });
    // Titel bleiben erhalten (das ist die Struktur)
    expect(s.map((b) => b.titel)).toEqual(bloecke.map((b) => b.titel));
  });
});

describe("normalisiereBloecke (Altformat 1.4.0 → freie Felder)", () => {
  it("wandelt das feste werte-Objekt in Felder um", () => {
    const alt = [
      { id: "v", typ: "vital", titel: "Vital", werte: { puls: "88", rrSys: "120", zeitpunkt: "08:30" } },
    ] as unknown as ProtokollBlock[];
    const n = normalisiereBloecke(alt);
    expect(n[0].typ).toBe("vital");
    if (n[0].typ === "vital") {
      expect(n[0].spalten).toBe(3);
      expect(n[0].felder).toEqual([
        { label: "Zeitpunkt", wert: "08:30" },
        { label: "RR systolisch (mmHg)", wert: "120" },
        { label: "Puls (/min)", wert: "88" },
      ]);
    }
  });
  it("lässt neue Felder-Blöcke unverändert", () => {
    const neu: ProtokollBlock[] = [
      { id: "v", typ: "vital", titel: "Vital", spalten: 2, felder: [{ label: "Puls", wert: "70" }] },
    ];
    const n = normalisiereBloecke(neu);
    expect(n[0]).toMatchObject({ spalten: 2, felder: [{ label: "Puls", wert: "70" }] });
  });
});

describe("zahlAusZelle (Diagramm-Parsing)", () => {
  it("deutsche und englische Zahlen", () => {
    expect(zahlAusZelle("120,5")).toBe(120.5);
    expect(zahlAusZelle("120.5")).toBe(120.5);
    expect(zahlAusZelle("36,5 °C")).toBe(36.5);
    expect(zahlAusZelle("RR 120")).toBe(120);
  });
  it("keine Zahl = null", () => {
    expect(zahlAusZelle("")).toBe(null);
    expect(zahlAusZelle("keine")).toBe(null);
  });
});
