// Tests für den Therapieplan-Parser (Block-Layout der IMTZ-Vorlage)
import { describe, it, expect } from "vitest";
import * as XLSX from "xlsx";
import {
  parseTherapieplan,
  blaetterDesPlans,
  normMenge,
  normKompakt,
  isoKalenderwoche,
} from "./therapyPlan";
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

describe("normMenge / normKompakt (Katalog-Matching)", () => {
  it("stellt Mengenangaben ans Ende um und matcht Katalogschreibweise", () => {
    expect(normMenge("600mg Clindamycin")).toBe(normMenge("Clindamycin 600 mg"));
    expect(normMenge("250ml NaCl 0.9%")).toBe(normMenge("NaCl 0,9 % 250 ml"));
    expect(normMenge("500ml Ringer")).toBe(normMenge("Ringer 500 ml"));
    expect(normKompakt("Neuro-Amino ½ Amp.")).toBe(normKompakt("neuro-amino ½ amp."));
  });
});

describe("isoKalenderwoche", () => {
  it("rechnet ISO-8601 korrekt, auch über Jahresgrenzen", () => {
    expect(isoKalenderwoche("2026-01-01")).toBe(1); // Do in KW 1
    expect(isoKalenderwoche("2025-12-29")).toBe(1); // Mo gehört zu KW 1/2026
    expect(isoKalenderwoche("2026-10-01")).toBe(40); // der Tippfehler aus der Vorlage
    expect(isoKalenderwoche("2026-07-06")).toBe(28);
  });
});

describe("KW-Plausibilitätscheck", () => {
  it("markiert Daten, die nicht zur Blatt-KW passen (Tippfehler)", () => {
    const zeilen = BLOCK("Mustermann, Max");
    // Datumszeile auf KW01 stellen, Tag 1 mit Tippfehler (Oktober statt Januar)
    zeilen[1][2] = "01.10.2026";
    zeilen[1][5] = "02.01.2026";
    zeilen[1][8] = "03.01.2026";
    zeilen[1][11] = "04.01.2026";
    zeilen[1][14] = "05.01.2026";
    zeilen.push([null, 1, "mGKHT", true, 1, "EECP", true]);
    const { eintraege } = parseTherapieplan("p.xlsx", mappeBauen("KW01", zeilen), 2026);
    const tag1 = eintraege.find((e) => e.name === "mGKHT")!;
    const tag2 = eintraege.find((e) => e.name === "EECP")!;
    expect(tag1.datum).toBe("2026-10-01");
    expect(tag1.kwAbweichung).toBe(true);
    expect(tag2.kwAbweichung).toBe(false);
  });
});

describe("Vorlage v2: Patientendaten im Block-Kopf", () => {
  const BLOCK_V2 = [
    [1, "Name:", "Mustermann, Max", "Von, Bis:", null, "28.09.–02.10.2026"],
    [null, "Geburtsdatum:", "10.05.1992", null, "Patienten-Nr.:", "IMTZ26001"],
    [null, "Straße:", "Am Käppele 15", null, "PLZ:", "88487", null, "Ort:", "Walpertshofen"],
    [null, "E-Mail:", "max@example.de", null, "Telefon:", "0151 2345678"],
    [null, "Rechnungsempfänger abweichend:", "ja", null, "abweichender Empfänger:", "Mustermann, Erika, Am Käppele 15, 88487 Walpertshofen"],
    [null, "Datum:", "28.09.2026", null, "Datum:", "29.09.2026", null, "Datum:", "30.09.2026", null, "Datum:", "01.10.2026", null, "Datum:", "02.10.2026"],
    [null, "Menge", "Name", "Erledigt", "Menge", "Name", "Erledigt", "Menge", "Name", "Erledigt", "Menge", "Name", "Erledigt", "Menge", "Name", "Erledigt"],
  ];

  it("liest Patientendaten und Leistungen aus dem v2-Layout", () => {
    const zeilen = [...BLOCK_V2, [null, 1, "mGKHT", true, 2, "EECP", true]];
    const { eintraege, probleme, patientenInfos } = parseTherapieplan(
      "p.xlsx", mappeBauen("KW40", zeilen), 2026,
    );
    expect(probleme).toHaveLength(0);
    expect(eintraege).toHaveLength(2);
    // Datumszeile korrekt gefunden (trotz Patientendaten-Zeilen davor)
    expect(eintraege[0]).toMatchObject({ datum: "2026-09-28", kwAbweichung: false });
    expect(eintraege[1]).toMatchObject({ datum: "2026-09-29", menge: 2 });

    const info = patientenInfos["mustermann, max"];
    expect(info).toMatchObject({
      geburtsdatum: "1992-05-10",
      strasse: "Am Käppele 15",
      plz: "88487",
      ort: "Walpertshofen",
      email: "max@example.de",
      telefon: "0151 2345678",
      patientenNr: "IMTZ26001",
      empfaengerAbweichend: true,
    });
    expect(info.empfaengerText).toContain("Erika");
  });

  it("alte Vorlage (ohne Patientendaten) liefert leeres Info-Objekt", () => {
    const zeilen = [...BLOCK("Esser, Christian"), [null, 1, "EECP", true]];
    const { patientenInfos } = parseTherapieplan("p.xlsx", mappeBauen("KW28", zeilen), 2026);
    const info = patientenInfos["esser, christian"];
    expect(info.empfaengerAbweichend).toBe(false);
    expect(info.strasse).toBeNull();
  });
});

describe("PraxisAkte-CSV-Export", () => {
  const SPALTEN =
    "Patienten-Nr.;Nachname;Vorname;Geburtsdatum;Straße;PLZ;Ort;E-Mail;Telefon;Rechnungsempfänger abweichend;Abweichender Empfänger;Datum;Leistung;Menge;Abrechnungsabschnitt;Therapeut;Bemerkung";
  const csv =
    "\uFEFF" +
    [
      SPALTEN,
      'IMTZ26001;Mustermann;Max;10.05.1992;Am Käppele 15;88487;Walpertshofen;max@example.de;0151 234;nein;;28.09.2026;mGKHT;1;1 · GOÄ-Leistung;Dr. A;',
      'IMTZ26001;Mustermann;Max;10.05.1992;Am Käppele 15;88487;Walpertshofen;max@example.de;0151 234;nein;;28.09.2026;500 ml NaCl;1.5;2 · Auslage § 10;Dr. A;"Nachvertragung; 16 Uhr"',
      'IMTZ26001;Mustermann;Max;10.05.1992;Am Käppele 15;88487;Walpertshofen;max@example.de;0151 234;ja;"Mustermann, Erika, Am Käppele 15, 88487 Walpertshofen";05.10.2026;EECP;1;1 · GOÄ-Leistung;Dr. B;',
    ].join("\r\n");
  const b64 = () => Buffer.from(csv, "utf-8").toString("base64");

  it("erkennt das Format und liefert ein Pseudo-Blatt", () => {
    expect(blaetterDesPlans("therapieplan-3-KW40.csv", b64())).toEqual([
      { name: "PraxisAkte-Export", kw: 0 },
    ]);
  });

  it("liest Einträge mit KW aus dem Datum, Quoting und Hinweisen", () => {
    const { eintraege, probleme, patientenInfos } = parseTherapieplan(
      "therapieplan-3-KW40.csv",
      b64(),
      2026,
    );
    expect(probleme).toHaveLength(0);
    expect(eintraege).toHaveLength(3);
    expect(eintraege[0]).toMatchObject({
      sheet: "PraxisAkte-Export", kw: 40, zeile: 2,
      patient: "Mustermann, Max", datum: "2026-09-28", menge: 1,
      name: "mGKHT", hinweis: "Dr. A",
    });
    // Punkt-Dezimal + quotiertes Semikolon in der Bemerkung
    expect(eintraege[1]).toMatchObject({ menge: 1.5 });
    expect(eintraege[1].hinweis).toContain("Nachvertragung; 16 Uhr");
    // KW wird aus dem Datum abgeleitet (Woche 2 desselben Plans)
    expect(eintraege[2].kw).toBe(41);

    const info = patientenInfos["mustermann, max"];
    expect(info).toMatchObject({
      geburtsdatum: "1992-05-10", strasse: "Am Käppele 15", plz: "88487",
      ort: "Walpertshofen", patientenNr: "IMTZ26001", empfaengerAbweichend: true,
    });
    expect(info.empfaengerText).toContain("Erika");
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
