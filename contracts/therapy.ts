// ── Dr.ReWaWi: Geteilte Typen für den Therapieplan-Import ─────────────────────
// Werden von Frontend (Vorschau) und Backend (Parser/Router) genutzt.

/** Ein Punkt im Unklarheiten-Report — immer mit Fundstelle in der Vorlage. */
export interface Unklarheit {
  sheet: string | null; // z. B. "KW28"
  zeile: number | null; // Excel-Zeilennummer (1-basiert)
  patient: string | null;
  grund: string;
}

/** Eine Rechnungsposition aus dem Import (nach Katalog-Matching). */
export interface ImportPosition {
  datum: string | null; // ISO JJJJ-MM-TT
  bezeichnung: string; // Katalogname des Produkts
  menge: string; // aggregiert je (Tag, Produkt)
  einheit: string;
  einzelpreis: string; // Leistung: VK netto / Auslage: EK netto
  ustSatz: number;
  kategorie: "leistung" | "auslage";
  quelle: string; // Originalbezeichnung aus der Vorlage
}

export interface PatientVorschau {
  patientName: string; // Name aus der Vorlage
  kundeId: number | null; // gematchter Patientenstamm-Eintrag
  kundeName: string | null; // Name im Stamm (bei Abweichung)
  kundeNeu: boolean;
  wochen: { jahr: number; kw: number }[];
  zeitraum: { von: string; bis: string } | null; // ISO
  positionen: ImportPosition[];
  summeCent: number;
  klar: boolean;
}

export interface AnalyseErgebnis {
  patienten: PatientVorschau[];
  unklarheiten: Unklarheit[];
  uebersprungen: { patient: string; grund: string }[];
  eintraegeGesamt: number;
}

export interface ImportErgebnis {
  rechnungen: { id: number; patient: string; klar: boolean }[];
  unklarheiten: Unklarheit[];
  uebersprungen: { patient: string; grund: string }[];
}

export interface SheetInfo {
  name: string;
  kw: number;
}

export interface ImportProtokoll {
  id: number;
  dateiname: string;
  jahr: number;
  sheets: string[];
  erstelltAm: string;
  anzahlRechnungen: number;
  anzahlUnklarheiten: number;
}

/** Abschnitts-Überschriften auf der Rechnung (spiegeln Dr. Kühnel's Layout). */
export const ABSCHNITT_LEISTUNGEN = "1. Ärztliche Leistungen (GOÄ / Honorarvereinbarung)";
export const ABSCHNITT_AUSLAGEN = "2. Auslagen gemäß § 10 GOÄ (Arzneimittel zu Selbstkosten)";

/** Kennzeichen einer Abschnitts-Zeile in invoice_items (Menge 0, Preis 0). */
export const istAbschnittszeile = (it: { menge: string; einzelpreis: string }) =>
  Number(it.menge) === 0 && Number(it.einzelpreis) === 0;
