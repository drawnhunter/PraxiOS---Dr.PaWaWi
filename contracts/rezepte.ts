// ── PraxiOS: Geteilte Typen für Privat-Rezepte & Atteste ───────────────────

export interface RezeptMedikament {
  /** Handelsname / Wirkstoff (Pflicht). */
  name: string;
  /** z. B. „600 mg" — optional. */
  staerke?: string;
  /** z. B. „20 Tabletten" / „N1" — optional. */
  menge?: string;
  /** Dosierungsanweisung, z. B. „3× täglich 1 Tablette" — optional. */
  dosierung?: string;
  /** Pharmazentralnummer (optional, v. a. für Praxisbedarf-Bestellungen). */
  pzn?: string;
}

export interface RezeptInhalt {
  medikamente: RezeptMedikament[];
  /** Freitext-Hinweis unter den Verordnungen (optional). */
  hinweis?: string;
}

export interface IcdCode {
  code: string;
  text: string;
}

export interface AttestInhalt {
  /** krankschreibung = AU-Bescheinigung mit Zeitraum; attest = freies Attest. */
  art: "krankschreibung" | "attest";
  /** AU-Zeitraum (TT.MM.JJJJ), nur bei krankschreibung. */
  auVon?: string;
  auBis?: string;
  /** Diagnose-/Bescheinigungstext. */
  text: string;
  /** Datum der ärztlichen Feststellung (TT.MM.JJJJ), Standard = Ausstellungsdatum. */
  feststellungsdatum?: string;
  /** true = Erstbescheinigung, false = Folgebescheinigung (nur AU relevant). */
  erstbescheinigung?: boolean;
  /** Ort der Feststellung: Praxis (Standard) / Hausbesuch / Videosprechstunde / Freitext. */
  feststellungsOrt?: string;
  /** Diagnose/ICD auf dem Attest ausweisen (Standard: false — Arbeitgeber-Exemplar-Regel). */
  diagnoseAusweisen?: boolean;
  /** Gewählte ICD-10-GM-Codes (nur gerendert, wenn diagnoseAusweisen). */
  icdCodes?: IcdCode[];
}

export const REZEPT_TYP_LABEL: Record<"rezept" | "attest" | "praxisbedarf", string> = {
  rezept: "Privatrezept",
  attest: "Attest / Krankschreibung",
  praxisbedarf: "Praxisbedarf",
};
