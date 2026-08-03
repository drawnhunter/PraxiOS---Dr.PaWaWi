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
}

export interface RezeptInhalt {
  medikamente: RezeptMedikament[];
  /** Freitext-Hinweis unter den Verordnungen (optional). */
  hinweis?: string;
}

export interface AttestInhalt {
  /** krankschreibung = AU-Bescheinigung mit Zeitraum; attest = freies Attest. */
  art: "krankschreibung" | "attest";
  /** AU-Zeitraum (TT.MM.JJJJ), nur bei krankschreibung. */
  auVon?: string;
  auBis?: string;
  /** Diagnose-/Bescheinigungstext. */
  text: string;
}

export const REZEPT_TYP_LABEL: Record<"rezept" | "attest", string> = {
  rezept: "Privatrezept",
  attest: "Attest / Krankschreibung",
};
