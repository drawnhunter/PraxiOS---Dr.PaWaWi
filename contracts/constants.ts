export const Session = {
  cookieName: "kimi_sid",
  maxAgeMs: 365 * 24 * 60 * 60 * 1000,
} as const;

export const ErrorMessages = {
  unauthenticated: "Authentication required",
  insufficientRole: "Insufficient permissions",
} as const;

export const Paths = {
  login: "/login",
  oauthCallback: "/api/oauth/callback",
} as const;

// ── Therapieplan-CSV-Export (PraxisWerk → Dr.ReWaWi-kompatibel) ────────────
// Spiegelt PraxisAkte contracts/constants.ts — bei Änderungen beidseitig abstimmen!
export const DR_REWAWI_CSV_SPALTEN = [
  "Patienten-Nr.",
  "Nachname",
  "Vorname",
  "Geburtsdatum",
  "Straße",
  "PLZ",
  "Ort",
  "E-Mail",
  "Telefon",
  "Rechnungsempfänger abweichend",
  "Abweichender Empfänger",
  "Datum",
  "Leistung",
  "Menge",
  "Abrechnungsabschnitt",
  "Therapeut",
  "Bemerkung",
] as const;
export const DR_REWAWI_CSV_TRENNZEICHEN = ";";
export const DR_REWAWI_CSV_BOM = "﻿";

// Kategorie-Enum -> Anzeigelabel (Abrechnungsabschnitt)
export const KATEGORIE_LABEL = {
  leistung: "1 · GOÄ-Leistung",
  auslage: "2 · Auslage § 10",
} as const;

// ── Fachliche Label-Konstanten (PraxisWerk-Akte) ────────────────────────────
export const DOKUMENT_KATEGORIEN = {
  befund: "Befund",
  arztbrief: "Arztbrief",
  rezept: "Rezept",
  einverstaendnis: "Einverständnis",
  sonstiges: "Sonstiges",
} as const;
export type DokumentKategorie = keyof typeof DOKUMENT_KATEGORIEN;

export const PLAN_STATUS = {
  geplant: "Geplant",
  aktiv: "Aktiv",
  dokumentiert: "Dokumentiert",
  abgerechnet: "Abgerechnet",
} as const;
export type PlanStatus = keyof typeof PLAN_STATUS;

export const ENTRY_STATUS = {
  geplant: "Geplant",
  stattgefunden: "Stattgefunden",
  abgesagt: "Abgesagt",
  ausgefallen: "Ausgefallen",
} as const;
export type EntryStatus = keyof typeof ENTRY_STATUS;
