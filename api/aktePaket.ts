// ── PraxiOS: Akten-Paket (JSON-Struktur für den Arzt-zu-Arzt-Austausch) ────
// Format-Definition + Bau (aus DB) + Parsen/Validieren (nach Entschlüsselung).
// Verschlüsselung selbst passiert in austauschRouter (age-encryption).
import { z } from "zod";

export const PAKET_FORMAT = "praxios-akte";
export const PAKET_VERSION = 1;

// ── Zod-Schema für eingehende Pakete (defensiv parsen) ──────────────────────
const paketPatient = z.object({
  name: z.string(),
  geburtsdatum: z.string().nullable(),
  patientenNr: z.string().nullable(),
  strasse: z.string().nullable(),
  plz: z.string().nullable(),
  ort: z.string().nullable(),
  land: z.string().nullable(),
  telefon: z.string().nullable(),
  email: z.string().nullable(),
  krankenkasse: z.string().nullable(),
  versichertennummer: z.string().nullable(),
  aerztlicherAnsprechpartner: z.string().nullable(),
  tags: z.string().nullable(),
  notizen: z.string().nullable(),
});

const paketKontakt = z.object({
  name: z.string(),
  verhaeltnis: z.string().nullable(),
  telefon: z.string().nullable(),
  email: z.string().nullable(),
  adresse: z.string().nullable(),
  istRechnungsempfaenger: z.boolean(),
  notiz: z.string().nullable(),
});

const paketEntry = z.object({
  datum: z.string(),
  zeitVon: z.string().nullable(),
  zeitBis: z.string().nullable(),
  leistungText: z.string().nullable(),
  leistungName: z.string().nullable(), // Katalog-Name zum Re-Mapping
  menge: z.string(),
  therapeutName: z.string().nullable(), // Re-Mapping über users.name/username
  raum: z.string().nullable(),
  status: z.enum(["geplant", "stattgefunden", "abgesagt", "ausgefallen"]),
  bemerkung: z.string().nullable(),
});

const paketPlan = z.object({
  titel: z.string().nullable(),
  vonDatum: z.string(),
  bisDatum: z.string(),
  diagnoseZiele: z.string().nullable(),
  status: z.enum(["geplant", "aktiv", "dokumentiert", "abgerechnet"]),
  rechnungsempfaengerAbweichend: z.boolean(),
  abweichenderEmpfaenger: z.string().nullable(),
  notizen: z.string().nullable(),
  entries: z.array(paketEntry),
});

const paketDokument = z.object({
  kategorie: z.enum([
    "befund",
    "arztbrief",
    "rezept",
    "einverstaendnis",
    "anamnesebogen",
    "sonstiges",
  ]),
  dateiname: z.string(),
  mimeType: z.string().nullable(),
  notiz: z.string().nullable(),
  dateiBase64: z.string(), // Dateiinhalt
});

const paketTimeline = z.object({
  typ: z.enum(["plan", "termin", "dokument", "notiz", "status"]),
  titel: z.string(),
  beschreibung: z.string().nullable(),
  datum: z.string(),
});

export const paketSchema = z.object({
  format: z.literal(PAKET_FORMAT),
  version: z.literal(PAKET_VERSION),
  exportiertAm: z.string(),
  quellPraxis: z.string().nullable(),
  patient: paketPatient,
  kontakte: z.array(paketKontakt),
  plaene: z.array(paketPlan),
  dokumente: z.array(paketDokument),
  timeline: z.array(paketTimeline),
});

export type AktePaket = z.infer<typeof paketSchema>;

/** Paket aus unbekanntem JSON parsen (wirft verständliche Fehler). */
export function parsePaket(json: unknown): AktePaket {
  const res = paketSchema.safeParse(json);
  if (!res.success) {
    throw new Error(
      "Paket-Format ungültig: " +
        res.error.issues.slice(0, 3).map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
    );
  }
  return res.data;
}

/** Kurz-Vorschau ohne Dateiinhalte (für die Import-Anzeige). */
export function paketVorschau(p: AktePaket) {
  return {
    patientName: p.patient.name,
    geburtsdatum: p.patient.geburtsdatum,
    quellPraxis: p.quellPraxis,
    exportiertAm: p.exportiertAm,
    anzahlKontakte: p.kontakte.length,
    anzahlPlaene: p.plaene.length,
    anzahlEintraege: p.plaene.reduce((n, pl) => n + pl.entries.length, 0),
    anzahlDokumente: p.dokumente.length,
    anzahlTimeline: p.timeline.length,
  };
}
