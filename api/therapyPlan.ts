// ── Dr.ReWaWi: Parser für die IMTZ-Therapieplan-Vorlage (XLSX oder CSV) ───────
//
// Aufbau der Vorlage (siehe „Q3-Therapieplan Wochenplan 2026.xlsx"):
// - Ein Tabellenblatt pro Kalenderwoche: „KW04", „KW05", … („Vorlage" = leer)
// - Pro Blatt bis zu 3 Patientenblöcke. Block-Kopf: Spalte B = „Name:",
//   C = Patientenname, D = „Von, Bis:", F = Zeitraum-Text
// - Darunter eine Datumszeile (bis zu 5 Behandlungstage, Spalten C/F/I/L/O)
//   und die Spaltenköpfe Menge | Name | Erledigt je Tag
// - Danach die Leistungszeilen (eine Zeile = bis zu 5 Tages-Einträge)
// - „Erledigt"-Häkchen werden ignoriert (Festlegung mit Dr. Kühnel:
//   jede Zeile mit Menge + Name zählt als erbrachte Leistung)
import * as XLSX from "xlsx";
import Papa from "papaparse";
import type { SheetInfo, Unklarheit } from "@contracts/therapy";
import { PRAXISAKTE_BLATTNAME } from "@contracts/therapy";

export interface PlanEintrag {
  sheet: string;
  kw: number;
  zeile: number; // Excel-Zeile (1-basiert)
  patient: string; // Name aus dem Block-Kopf
  datum: string | null; // ISO JJJJ-MM-TT
  menge: number;
  name: string; // bereinigte Leistungsbezeichnung
  unsicher: boolean; // „(?)" im Namen — IMTZ ist selbst unsicher
  kwAbweichung: boolean; // Datum passt nicht zur Blatt-KW (Tippfehler?)
  hinweis: string | null; // Therapeut/Bemerkung (PraxisAkte-Export), sonst null
}

/** Patientendaten aus dem Block-Kopf (Vorlage v2; in alten Dateien leer). */
export interface PatientInfo {
  geburtsdatum: string | null;
  strasse: string | null;
  plz: string | null;
  ort: string | null;
  email: string | null;
  telefon: string | null;
  patientenNr: string | null;
  empfaengerAbweichend: boolean;
  empfaengerText: string | null; // Freitext „Name, Straße, PLZ Ort"
}

// ── Geteilte Namens-Normalisierung (Parser, Katalog-Matching, Tests) ───────
export function normBasis(s: string): string {
  return s.toLowerCase().replace(/\s+/g, " ").trim();
}
export function normKompakt(s: string): string {
  return normBasis(s).replace(/ /g, "");
}
// Stuft Mengenangaben am Anfang ans Ende um und vereinheitlicht Komma/Punkt:
// „600mg Clindamycin" -> „clindamycin600mg",
// „250ml NaCl 0.9%"  -> „nacl0.9%250ml"  (matcht „NaCl 0,9 % 250 ml")
const MENGE_VORNE = /^(\d+(?:[.,]\d+)?)\s*(ml|mg|g|mmol|µg|ug|ie)\s+(.+)$/i;
export function normMenge(s: string): string {
  let t = normBasis(s).replace(/,/g, ".");
  const m = t.match(MENGE_VORNE);
  if (m) t = `${m[3]} ${m[1]}${m[2]}`;
  return t.replace(/ /g, "");
}

/** ISO-8601-Kalenderwoche eines ISO-Datums (JJJJ-MM-TT). */
export function isoKalenderwoche(iso: string): number {
  const [j, m, t] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(j, m - 1, t));
  const tag = (d.getUTCDay() + 6) % 7; // Mo=0 … So=6
  d.setUTCDate(d.getUTCDate() - tag + 3); // Donnerstag dieser Woche
  const ersterDo = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  ersterDo.setUTCDate(ersterDo.getUTCDate() - ((ersterDo.getUTCDay() + 6) % 7) + 3);
  return 1 + Math.round((d.getTime() - ersterDo.getTime()) / (7 * 86400000));
}

// Tagesspalten (0-basiert): je [Menge, Name, Erledigt]
const TAG_SPALTEN: [number, number, number][] = [
  [1, 2, 3],
  [4, 5, 6],
  [7, 8, 9],
  [10, 11, 12],
  [13, 14, 15],
];
// Datumszellen der 5 Tage in der Datumszeile (0-basiert)
const DATUM_SPALTEN = [2, 5, 8, 11, 14];

const KW_BLATT = /^kw\s*0*(\d{1,2})$/i;

const LEERES_PATIENTINFO: PatientInfo = {
  geburtsdatum: null,
  strasse: null,
  plz: null,
  ort: null,
  email: null,
  telefon: null,
  patientenNr: null,
  empfaengerAbweichend: false,
  empfaengerText: null,
};

type Zelle = string | number | boolean | Date | null | undefined;

function ladeArbeitsmappe(dateiname: string, base64: string): XLSX.WorkBook {
  const buf = Buffer.from(base64, "base64");
  if (/\.csv$/i.test(dateiname)) {
    // Trenner erkennen (deutsche CSVs nutzen „;")
    const text = buf.toString("utf-8");
    const erste = text.split(/\r?\n/, 1)[0] ?? "";
    const fs =
      (erste.match(/;/g)?.length ?? 0) >= (erste.match(/,/g)?.length ?? 0) ? ";" : ",";
    return XLSX.read(text, { type: "string", FS: fs });
  }
  // cellDates bleibt aus: Datumswerte kommen als Seriennummern und werden
  // über XLSX.SSF.parse_date_code gelesen — kalendergenau, ohne Zeitzonen.
  return XLSX.read(buf, { type: "buffer" });
}

/** KW-Blätter bestimmen; bei CSV-Dateien kommt die KW aus dem Dateinamen. */
function interneBlattInfos(wb: XLSX.WorkBook, dateiname: string): SheetInfo[] {
  const kwBlaetter = wb.SheetNames.map((name) => {
    const m = name.trim().match(KW_BLATT);
    return m ? { name, kw: Number(m[1]) } : null;
  }).filter((s): s is SheetInfo => s !== null);
  if (kwBlaetter.length > 0) return kwBlaetter;
  const m = dateiname.replace(/\.[^.]+$/, "").trim().match(KW_BLATT);
  if (m && wb.SheetNames.length > 0) {
    return [{ name: wb.SheetNames[0], kw: Number(m[1]) }];
  }
  return [];
}

export function blaetterDesPlans(dateiname: string, base64: string): SheetInfo[] {
  if (/\.csv$/i.test(dateiname)) {
    const text = Buffer.from(base64, "base64").toString("utf-8");
    if (istPraxisAkteCsv(text)) return [{ name: PRAXISAKTE_BLATTNAME, kw: 0 }];
  }
  const wb = ladeArbeitsmappe(dateiname, base64);
  return interneBlattInfos(wb, dateiname);
}

function alsText(z: Zelle): string {
  if (z === null || z === undefined) return "";
  if (z instanceof Date) return "";
  return String(z);
}

function bereinigeName(roh: string): string {
  return roh.replace(/\s+/g, " ").trim();
}

/** Datum aus Zelle lesen: Excel-Seriennummer, „06.07", „06.07.26" oder „06.07.2026". */
function datumLesen(z: Zelle, jahr: number): string | null {
  // Excel-Datumsseriennummer -> Kalenderdatum (zeitzonenfrei)
  if (typeof z === "number" && z > 20000 && z < 80000) {
    const d = XLSX.SSF.parse_date_code(z);
    if (d) {
      return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
    }
  }
  if (z instanceof Date && !isNaN(z.getTime())) {
    return `${z.getFullYear()}-${String(z.getMonth() + 1).padStart(2, "0")}-${String(z.getDate()).padStart(2, "0")}`;
  }
  const s = alsText(z).trim();
  const m = s.match(/^(\d{1,2})\.(\d{1,2})(?:\.(\d{2,4}))?/);
  if (!m) return null;
  const tag = Number(m[1]);
  const monat = Number(m[2]);
  if (monat < 1 || monat > 12 || tag < 1 || tag > 31) return null;
  let j = m[3] ? Number(m[3]) : jahr;
  if (j < 100) j += 2000;
  return `${j}-${String(monat).padStart(2, "0")}-${String(tag).padStart(2, "0")}`;
}

function mengeLesen(z: Zelle): number {
  if (typeof z === "number" && Number.isFinite(z) && z > 0) return z;
  const s = alsText(z).trim().replace(",", ".");
  if (!s) return 1;
  const n = Number(s);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

// ── PraxisAkte-CSV-Export (flaches 17-Spalten-Format) ─────────────────────
// Abgestimmt mit PraxisAkte contracts/constants.ts (DR_REWAWI_CSV_SPALTEN):
// Semikolon, UTF-8 mit BOM, Datum TT.MM.JJJJ, Menge Punkt-Dezimal,
// nur Einträge mit status=stattgefunden.
function istPraxisAkteCsv(text: string): boolean {
  const erste = text.replace(/^\uFEFF/, "").split(/\r?\n/, 1)[0] ?? "";
  const felder = erste.split(";").map((f) => f.trim().replace(/^"|"$/g, ""));
  return ["Nachname", "Vorname", "Datum", "Leistung", "Menge"].every((f) =>
    felder.includes(f),
  );
}

function parsePraxisAkteCsv(
  dateiname: string,
  text: string,
  jahr: number,
): {
  eintraege: PlanEintrag[];
  probleme: Unklarheit[];
  patientenInfos: Record<string, PatientInfo>;
} {
  const res = Papa.parse<Record<string, string>>(text.replace(/^\uFEFF/, ""), {
    header: true,
    delimiter: ";",
    skipEmptyLines: true,
    transformHeader: (h) => h.trim(),
    transform: (v) => (typeof v === "string" ? v.trim() : v),
  });
  const eintraege: PlanEintrag[] = [];
  const probleme: Unklarheit[] = [];
  const patientenInfos: Record<string, PatientInfo> = {};
  const WAHR = ["ja", "x", "1", "true", "wahr", "yes"];
  const INFO_FELDER = [
    "geburtsdatum",
    "strasse",
    "plz",
    "ort",
    "email",
    "telefon",
    "patientenNr",
    "empfaengerText",
  ] as const;

  res.data.forEach((row, i) => {
    const zeile = i + 2; // Kopfzeile = Zeile 1
    const patient = bereinigeName(
      [row["Nachname"], row["Vorname"]].filter((s) => (s ?? "").trim() !== "").join(", "),
    );
    const leistung = bereinigeName(row["Leistung"] ?? "");
    if (!leistung) return; // Leerzeile
    if (!patient) {
      probleme.push({
        sheet: PRAXISAKTE_BLATTNAME,
        zeile,
        patient: null,
        grund: "Nachname/Vorname fehlt — Zeile übersprungen",
      });
      return;
    }
    const datum = datumLesen(row["Datum"] ?? "", jahr);
    if (!datum) {
      probleme.push({
        sheet: PRAXISAKTE_BLATTNAME,
        zeile,
        patient,
        grund: `Datum fehlt/nicht lesbar für „${leistung}“ — Zeile übersprungen`,
      });
      return;
    }
    const mengeN = Number((row["Menge"] ?? "").replace(",", "."));
    eintraege.push({
      sheet: PRAXISAKTE_BLATTNAME,
      kw: isoKalenderwoche(datum),
      zeile,
      patient,
      datum,
      menge: Number.isFinite(mengeN) && mengeN > 0 ? mengeN : 1,
      name: leistung,
      unsicher: /\(\s*\?\s*\)/.test(leistung),
      kwAbweichung: false,
      hinweis:
        [row["Therapeut"], row["Bemerkung"]]
          .map((s) => (s ?? "").trim())
          .filter(Boolean)
          .join(" · ") || null,
    });

    // Patientendaten (identisch in allen Zeilen; erst nicht-leerer Wert gewinnt)
    const key = normBasis(patient);
    const info: PatientInfo = {
      geburtsdatum: datumLesen(row["Geburtsdatum"] ?? "", jahr),
      strasse: (row["Straße"] ?? "").trim() || null,
      plz: (row["PLZ"] ?? "").trim() || null,
      ort: (row["Ort"] ?? "").trim() || null,
      email: (row["E-Mail"] ?? "").trim() || null,
      telefon: (row["Telefon"] ?? "").trim() || null,
      patientenNr: (row["Patienten-Nr."] ?? "").trim() || null,
      empfaengerAbweichend: WAHR.includes(
        normBasis(row["Rechnungsempfänger abweichend"] ?? ""),
      ),
      empfaengerText: (row["Abweichender Empfänger"] ?? "").trim() || null,
    };
    if (!patientenInfos[key]) {
      patientenInfos[key] = info;
    } else {
      const ziel = patientenInfos[key];
      for (const k of INFO_FELDER) {
        if (!ziel[k] && info[k]) ziel[k] = info[k];
      }
      ziel.empfaengerAbweichend = ziel.empfaengerAbweichend || info.empfaengerAbweichend;
    }
  });

  if (eintraege.length === 0 && probleme.length === 0) {
    probleme.push({
      sheet: PRAXISAKTE_BLATTNAME,
      zeile: null,
      patient: null,
      grund: `Keine verwertbaren Zeilen in ${dateiname} (nur status=stattgefunden wird exportiert)`,
    });
  }
  return { eintraege, probleme, patientenInfos };
}

export function parseTherapieplan(
  dateiname: string,
  base64: string,
  jahr: number,
  auswahl?: string[],
): {
  eintraege: PlanEintrag[];
  probleme: Unklarheit[];
  patientenInfos: Record<string, PatientInfo>;
} {
  // PraxisAkte-Export-CSV hat eigenes (flaches) Format -> eigener Pfad
  if (/\.csv$/i.test(dateiname)) {
    const text = Buffer.from(base64, "base64").toString("utf-8");
    if (istPraxisAkteCsv(text)) return parsePraxisAkteCsv(dateiname, text, jahr);
  }
  const wb = ladeArbeitsmappe(dateiname, base64);
  const eintraege: PlanEintrag[] = [];
  const probleme: Unklarheit[] = [];
  const patientenInfos: Record<string, PatientInfo> = {};

  const blattInfos = interneBlattInfos(wb, dateiname).filter(
    (s) => !auswahl || auswahl.includes(s.name),
  );

  const WAHR = ["ja", "x", "1", "true", "wahr", "yes"];

  /** Patientenfelder aus den Zeilen zwischen Block-Kopf und Datumszeile. */
  function lesePatientenFelder(zeilen: Zelle[][], info: PatientInfo) {
    for (const zeile of zeilen) {
      // Label/Wert-Paare an den Spalten B/C, E/F, H/I, K/L (Indizes 1/4/7/10)
      for (const lc of [1, 4, 7, 10]) {
        const label = normBasis(alsText(zeile[lc])).replace(/:$/, "");
        const wert = zeile[lc + 1];
        const text = bereinigeName(alsText(wert));
        if (!label) continue;
        if (label.startsWith("rechnungsempfänger")) {
          info.empfaengerAbweichend =
            wert === true || WAHR.includes(normBasis(text));
        } else if (label.includes("empfänger")) {
          if (text) info.empfaengerText = text;
        } else if (label === "geburtsdatum") {
          info.geburtsdatum = datumLesen(wert, jahr) ?? (text || null);
        } else if (label === "patienten-nr." || label === "patienten-nr" || label === "patientennummer") {
          if (text) info.patientenNr = text;
        } else if (label === "straße" || label === "strasse") {
          if (text) info.strasse = text;
        } else if (label === "plz") {
          if (typeof wert === "number") info.plz = String(Math.trunc(wert));
          else if (text) info.plz = text;
        } else if (label === "ort") {
          if (text) info.ort = text;
        } else if (label === "e-mail" || label === "email") {
          if (text) info.email = text;
        } else if (label === "telefon" || label === "tel.") {
          if (text) info.telefon = text;
        }
      }
    }
  }

  function infoMergen(ziel: PatientInfo, quelle: PatientInfo) {
    for (const k of [
      "geburtsdatum",
      "strasse",
      "plz",
      "ort",
      "email",
      "telefon",
      "patientenNr",
      "empfaengerText",
    ] as const) {
      if (!ziel[k] && quelle[k]) ziel[k] = quelle[k];
    }
    ziel.empfaengerAbweichend = ziel.empfaengerAbweichend || quelle.empfaengerAbweichend;
  }

  for (const { name: blattName, kw } of blattInfos) {
    const ws = wb.Sheets[blattName];
    const grid = XLSX.utils.sheet_to_json<Zelle[]>(ws, {
      header: 1,
      raw: true,
      defval: null,
    });
    // sheet_to_json startet das Grid bei der ersten belegten Zeile (!ref),
    // nicht zwingend bei Zeile 1 — Offset für exakte Fundstellen ausgleichen
    const zeilenOffset = ws["!ref"] ? XLSX.utils.decode_range(ws["!ref"]).s.r : 0;

    // Block-Köpfe finden: Spalte B (Index 1) enthält „Name:"
    const blockStarts: number[] = [];
    for (let r = 0; r < grid.length; r++) {
      if (alsText(grid[r]?.[1]).trim().toLowerCase() === "name:") {
        blockStarts.push(r);
      }
    }
    if (blockStarts.length === 0) {
      probleme.push({
        sheet: blattName,
        zeile: null,
        patient: null,
        grund: "Kein Patientenblock gefunden (Spalte B = „Name:“ fehlt) — Blatt übersprungen",
      });
      continue;
    }

    for (let b = 0; b < blockStarts.length; b++) {
      const kopf = blockStarts[b];
      const ende = b + 1 < blockStarts.length ? blockStarts[b + 1] : grid.length;
      const patient = bereinigeName(alsText(grid[kopf]?.[2]));

      // Datumszeile dynamisch finden (alte Vorlage: Kopf+1, Vorlage v2: später,
      // weil davor die Patientendaten-Zeilen liegen). Erkannt an >= 2 „Datum:"-Labels.
      let dzIdx = -1;
      for (let r = kopf + 1; r < Math.min(kopf + 12, ende); r++) {
        const labels = [1, 4, 7, 10, 13].filter(
          (c) => normBasis(alsText(grid[r]?.[c])).replace(/:$/, "") === "datum",
        ).length;
        if (labels >= 2) {
          dzIdx = r;
          break;
        }
      }

      // Patientendaten (Vorlage v2) zwischen Kopf und Datumszeile lesen
      const info: PatientInfo = { ...LEERES_PATIENTINFO };
      if (dzIdx > kopf + 1) {
        lesePatientenFelder(grid.slice(kopf + 1, dzIdx), info);
      }
      const infoKey = normBasis(patient) || "(ohne namen)";
      if (patientenInfos[infoKey]) infoMergen(patientenInfos[infoKey], info);
      else patientenInfos[infoKey] = info;

      const datumsZeile = dzIdx >= 0 ? (grid[dzIdx] ?? []) : (grid[kopf + 1] ?? []);
      const tage = DATUM_SPALTEN.map((c) => datumLesen(datumsZeile[c], jahr));
      const itemStart = dzIdx >= 0 ? dzIdx + 2 : kopf + 3;

      let blockHatEintraege = false;
      for (let r = itemStart; r < ende; r++) {
        const zeile = grid[r] ?? [];
        for (let t = 0; t < TAG_SPALTEN.length; t++) {
          const [mengeCol, nameCol] = TAG_SPALTEN[t];
          const name = bereinigeName(alsText(zeile[nameCol]));
          if (!name) continue;
          // Summenzeilen o. ä. enthalten in der Name-Spalte nichts — sie
          // werden hier automatisch übersprungen.
          blockHatEintraege = true;
          const datum = tage[t];
          eintraege.push({
            sheet: blattName,
            kw,
            zeile: zeilenOffset + r + 1,
            patient,
            datum,
            menge: mengeLesen(zeile[mengeCol]),
            name,
            unsicher: /\(\s*\?\s*\)/.test(name),
            kwAbweichung: datum !== null && isoKalenderwoche(datum) !== kw,
            hinweis: null,
          });
        }
      }

      if (blockHatEintraege && !patient) {
        probleme.push({
          sheet: blattName,
          zeile: zeilenOffset + kopf + 1,
          patient: null,
          grund: `Patientenblock ab Zeile ${zeilenOffset + kopf + 1} hat keinen Namen — Einträge werden „(ohne Namen)“ zugeordnet`,
        });
      }
      if (blockHatEintraege && tage.every((d) => d === null)) {
        probleme.push({
          sheet: blattName,
          zeile: zeilenOffset + kopf + 2,
          patient: patient || null,
          grund: "Datumszeile fehlt oder ist nicht lesbar — Tage ohne Datum landen im Report",
        });
      }
    }
  }

  return { eintraege, probleme, patientenInfos };
}
