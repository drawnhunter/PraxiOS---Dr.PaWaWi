// ── ReWaKi: Parser für die IMTZ-Therapieplan-Vorlage (XLSX oder CSV) ───────
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
import type { SheetInfo, Unklarheit } from "@contracts/therapy";

export interface PlanEintrag {
  sheet: string;
  kw: number;
  zeile: number; // Excel-Zeile (1-basiert)
  patient: string; // Name aus dem Block-Kopf
  datum: string | null; // ISO JJJJ-MM-TT
  menge: number;
  name: string; // bereinigte Leistungsbezeichnung
  unsicher: boolean; // „(?)" im Namen — IMTZ ist selbst unsicher
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

export function parseTherapieplan(
  dateiname: string,
  base64: string,
  jahr: number,
  auswahl?: string[],
): { eintraege: PlanEintrag[]; probleme: Unklarheit[] } {
  const wb = ladeArbeitsmappe(dateiname, base64);
  const eintraege: PlanEintrag[] = [];
  const probleme: Unklarheit[] = [];

  const blattInfos = interneBlattInfos(wb, dateiname).filter(
    (s) => !auswahl || auswahl.includes(s.name),
  );

  for (const { name: blattName, kw } of blattInfos) {
    const ws = wb.Sheets[blattName];
    const grid = XLSX.utils.sheet_to_json<Zelle[]>(ws, {
      header: 1,
      raw: true,
      defval: null,
    });

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

      // Datumszeile = Kopf + 1, Leistungszeilen ab Kopf + 3
      const datumsZeile = grid[kopf + 1] ?? [];
      const tage = DATUM_SPALTEN.map((c) => datumLesen(datumsZeile[c], jahr));

      let blockHatEintraege = false;
      for (let r = kopf + 3; r < ende; r++) {
        const zeile = grid[r] ?? [];
        for (let t = 0; t < TAG_SPALTEN.length; t++) {
          const [mengeCol, nameCol] = TAG_SPALTEN[t];
          const name = bereinigeName(alsText(zeile[nameCol]));
          if (!name) continue;
          // Summenzeilen o. ä. enthalten in der Name-Spalte nichts — sie
          // werden hier automatisch übersprungen.
          blockHatEintraege = true;
          eintraege.push({
            sheet: blattName,
            kw,
            zeile: r + 1,
            patient,
            datum: tage[t],
            menge: mengeLesen(zeile[mengeCol]),
            name,
            unsicher: /\(\s*\?\s*\)/.test(name),
          });
        }
      }

      if (blockHatEintraege && !patient) {
        probleme.push({
          sheet: blattName,
          zeile: kopf + 1,
          patient: null,
          grund: `Patientenblock ab Zeile ${kopf + 1} hat keinen Namen — Einträge werden „(ohne Namen)“ zugeordnet`,
        });
      }
      if (blockHatEintraege && tage.every((d) => d === null)) {
        probleme.push({
          sheet: blattName,
          zeile: kopf + 2,
          patient: patient || null,
          grund: "Datumszeile fehlt oder ist nicht lesbar — Tage ohne Datum landen im Report",
        });
      }
    }
  }

  return { eintraege, probleme };
}
