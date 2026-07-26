// ── PraxiOS: Geteilte Typen für den Fragebogen-Creator ─────────────────────
// Kopfbogen (Pflicht-Stammdaten, bei jedem Bogen identisch) + Blocksystem
// aus fünf Blocktypen. Wird vom Bogen-Editor, der Ausfüll-Seite und dem
// PDF-Renderer gemeinsam genutzt.

export const BLOCK_TYPEN = [
  "checkboxen",
  "textfeld",
  "textfeld_schreibfeld",
  "skala_1_10",
  "haeufigkeit",
] as const;
export type BlockTyp = (typeof BLOCK_TYPEN)[number];

export const BLOCK_TYP_LABEL: Record<BlockTyp, string> = {
  checkboxen: "Ankreuz-Fragen",
  textfeld: "Textfeld",
  textfeld_schreibfeld: "Textfeld mit Schreibfeld",
  skala_1_10: "Skala 1–10",
  haeufigkeit: "Häufigkeitsskala",
};

export const HAEUFIGKEIT_STUFEN = [
  "gar nicht",
  "wenig",
  "normal",
  "häufig",
  "sehr häufig",
] as const;

/** Konfiguration je Blocktyp (als JSON in anamnesis_blocks.config). */
export interface BlockConfig {
  /** checkboxen: Fragen + Spaltenzahl (1|2). */
  fragen?: string[];
  spalten?: 1 | 2;
  /** textfeld / textfeld_schreibfeld / skala_1_10: die eine Frage. */
  frage?: string;
  /** textfeld_schreibfeld: Anzahl Schreibzeilen (default 4). */
  zeilen?: number;
  /** skala_1_10: Endpunkt-Beschriftungen. */
  vonLabel?: string;
  bisLabel?: string;
}

/** Ein Block im Bogen (Referenz zum Katalog ODER Inline-Definition). */
export interface FormBlock {
  blockId?: number; // Referenz zum Block-Katalog
  typ: BlockTyp; // gespiegelt (robust gegen Katalog-Umbenennungen)
  titel: string;
  config: BlockConfig;
}

/** Kopfbogen: Pflicht-Stammdaten (Schlüssel -> Label, Pflicht-Flag). */
export type KopfbogenKey =
  | "nachname"
  | "vorname"
  | "geburtsdatum"
  | "strasse"
  | "plz"
  | "ort"
  | "telefon"
  | "email"
  | "krankenkasse";

export const KOPFBOGEN_FELDER: readonly {
  key: KopfbogenKey;
  label: string;
  pflicht: boolean;
  typ?: "datum" | "email";
}[] = [
  { key: "nachname", label: "Nachname", pflicht: true },
  { key: "vorname", label: "Vorname", pflicht: true },
  { key: "geburtsdatum", label: "Geburtsdatum", pflicht: true, typ: "datum" },
  { key: "strasse", label: "Straße", pflicht: true },
  { key: "plz", label: "PLZ", pflicht: true },
  { key: "ort", label: "Ort", pflicht: true },
  { key: "telefon", label: "Telefon", pflicht: false },
  { key: "email", label: "E-Mail", pflicht: false, typ: "email" },
  { key: "krankenkasse", label: "Krankenkasse", pflicht: false },
];

/** Antworten einer Einreichung (JSON in anamnesis_submissions.daten). */
export interface SubmissionDaten {
  kopfbogen: Partial<Record<KopfbogenKey, string>>;
  antworten: {
    titel: string;
    typ: BlockTyp;
    // checkboxen: gewählte Fragen; textfeld/schreibfeld: Text; skala: 1-10; haeufigkeit: je Frage Stufe
    wert: string[] | string | number | Record<string, string>;
  }[];
}

/** Öffentliche (loginfreie) Sicht auf einen Link + Bogen. */
export interface OeffentlicherBogen {
  formTitel: string;
  formBeschreibung: string | null;
  bloecke: FormBlock[];
  praxisName: string | null;
  vorbefuellung: Partial<Record<KopfbogenKey, string>> | null;
  linkStatus: "offen" | "eingereicht" | "abgelaufen";
  eingereichtAm: string | null;
}
