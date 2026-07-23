// Tests für den Therapieplan-Parser (Block-Layout der IMTZ-Vorlage)
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import { parseTherapieplan, blaetterDesPlans } from "./therapyPlan";
import { baueReportText } from "./therapyReport";
import type { ImportErgebnis } from "@contracts/therapy";

function mappeBauen(blattName: string, zeilen: unknown[][]): string {
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(zeilen), blattName);
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["x"]]), "Vorlage");
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
  return buf.toString("base64");
}

// Block-Layout wie in „Q3-Therapieplan Wochenplan 2026.xlsx"
const BLOCK = (patient: string | null): unknown[][] => [
  [1, "Name:", patient, "Von, Bis:", null, "06.07-10.07", "Patient 1"],
  [null, "Datum:", "06.07", null, "Datum:", "07.07", null, "Datum:", "08.07", null, "Datum:", "09.07", null, "Datum:", "10.07"],
  [null, "Menge", "Name", "Erledigt", "Menge", "Name", "Erledigt", "Menge", "Name", "Erledigt", "Menge", "Name", "Erledigt", "Menge", "Name", "Erledigt"],
];

describe("blaetterDesPlans", () => {
  it("erkennt nur KW-Blätter", () => {
    const b64 = mappeBauen("KW28", []);
    expect(blaetterDesPlans("plan.xlsx", b64)).toEqual([{ name: "KW28", kw: 28 }]);
  });
});

describe("parseTherapieplan", () => {
  it("liest Tage, Mengen und Namen aus dem Block-Layout", () => {
    const zeilen = [
      ...BLOCK("Esser, Christian"),
      [null, 1, "500 ml NaCl", true, 2, "Procain 2 % Amp.", false, 0.5, "Neuro-Amino ½ Amp.", true],
      [null, 1, "100 ml NaBic (?)", true],
      [null, null, null, 14, null, null, 14], // Summenzeile -> ignoriert
    ];
    const { eintraege, probleme } = parseTherapieplan("p.xlsx", mappeBauen("KW28", zeilen), 2026);
    expect(probleme).toHaveLength(0);
    expect(eintraege).toHaveLength(4);

    expect(eintraege[0]).toMatchObject({
      sheet: "KW28", kw: 28, zeile: 4, patient: "Esser, Christian",
      datum: "2026-07-06", menge: 1, name: "500 ml NaCl", unsicher: false,
    });
    // Tag 2, Menge 2, fehlendes Erledigt-Häkchen ist egal
    expect(eintraege[1]).toMatchObject({ datum: "2026-07-07", menge: 2, name: "Procain 2 % Amp." });
    // Halbe Ampullen (Komma/Dezimal) + Tag 3
    expect(eintraege[2]).toMatchObject({ datum: "2026-07-08", menge: 0.5, name: "Neuro-Amino ½ Amp." });
    // „(?)" markiert Unsicherheit
    expect(eintraege[3]).toMatchObject({ datum: "2026-07-06", unsicher: true });
  });

  it("übernimmt echte Datumszellen (Excel-Seriennummer) mit eigenem Jahr", () => {
    const zeilen = BLOCK("Müller, Hans");
    // 26.01.2026 als Excel-Seriennummer (so speichert Excel Datumszellen)
    zeilen[1][2] = 46048;
    zeilen.push([null, 1, "EECP", true]);
    const { eintraege } = parseTherapieplan("p.xlsx", mappeBauen("KW04", zeilen), 2025);
    expect(eintraege[0].datum).toBe("2026-01-26"); // Jahr aus der Zelle, nicht 2025
  });

  it("meldet Blöcke ohne Patientennamen und Blätter ohne Block", () => {
    const zeilen = [...BLOCK(null), [null, 1, "EECP", true]];
    const b64 = mappeBauen("KW05", zeilen);
    const r1 = parseTherapieplan("p.xlsx", b64, 2026);
    expect(r1.eintraege[0].patient).toBe("");
    expect(r1.probleme.some((p) => p.grund.includes("keinen Namen"))).toBe(true);

    const b64leer = (() => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["nichts"]]), "KW06");
      return (XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer).toString("base64");
    })();
    const r2 = parseTherapieplan("p.xlsx", b64leer, 2026);
    expect(r2.probleme.some((p) => p.grund.includes("Kein Patientenblock"))).toBe(true);
  });

  it("liest auch CSV-Dateien im selben Block-Layout", () => {
    const csv = [
      '1;"Name:";"Esser, Christian";"Von, Bis:";;"06.07-10.07"',
      ';"Datum:";"06.07";;"Datum:";"07.07"',
      ';"Menge";"Name";"Erledigt";"Menge";"Name";"Erledigt"',
      ';1;"500 ml NaCl";WAHR;2;"Procain 2 %";WAHR',
    ].join("\r\n");
    const b64 = Buffer.from(csv, "utf-8").toString("base64");
    const { eintraege } = parseTherapieplan("KW28.csv", b64, 2026);
    expect(eintraege).toHaveLength(2);
    expect(eintraege[1]).toMatchObject({ datum: "2026-07-07", menge: 2 });
  });
});

describe("baueReportText", () => {
  it("enthält Fundstellen und Zusammenfassung", () => {
    const erg: ImportErgebnis = {
      rechnungen: [
        { id: 1, patient: "Esser, Christian", klar: false },
        { id: 2, patient: "Müller, Hans", klar: true },
      ],
      unklarheiten: [
        { sheet: "KW28", zeile: 23, patient: "Esser, Christian", grund: "Leistung „KT-60“ nicht im Katalog" },
      ],
      uebersprungen: [{ patient: "Schmidt", grund: "Duplikat: KW 28 bereits in Rechnung RK 01 2026" }],
    };
    const txt = baueReportText("plan.xlsx", 2026, ["KW28"], erg, new Date("2026-07-23T12:00:00Z"));
    expect(txt).toContain("2 Rechnung(en)");
    expect(txt).toContain("Sheet KW28, Zeile 23, Patient: Esser, Christian");
    expect(txt).toContain("KT-60");
    expect(txt).toContain("ÜBERSPRUNGEN");
  });
});
