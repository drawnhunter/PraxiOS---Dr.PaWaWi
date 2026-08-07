// ── PraxiOS: Geteilte Typen für Behandlungsprotokolle ──────────────────────
// Block-Baukasten: Text, Tabelle (mit optionalem Zeit-x-Werte-Diagramm),
// Skala 1–10, Foto/Dokument, Vitalparameter-Schnellzeile, Ankreuz-Block.
// Wird von Editor, Vorlagen-Verwaltung und Router gemeinsam genutzt.

export interface VitalWerte {
  /** ISO-Datum/Uhrzeit oder freier Text (z. B. „08:30"). */
  zeitpunkt?: string;
  rrSys?: string;
  rrDia?: string;
  puls?: string;
  temperatur?: string;
  spo2?: string;
}

export interface AnkreuzOption {
  label: string;
  gewaehlt: boolean;
}

export type ProtokollBlock =
  | { id: string; typ: "text"; titel: string; inhalt: string }
  | {
      id: string;
      typ: "tabelle";
      titel: string;
      /** Spaltenköpfe; Konvention: erste Spalte = Zeit/Datum (für das Diagramm). */
      spalten: string[];
      /** Zeilen mit je spalten.length Zellen (Text; Zahlen gern „123,4"). */
      zeilen: string[][];
      /** Unter der Tabelle ein Diagramm (X = Spalte 1, Y = Zahlen-Spalten) zeichnen. */
      diagramm: boolean;
    }
  | { id: string; typ: "skala"; titel: string; wert: number | null }
  | { id: string; typ: "foto"; titel: string; dokumentId: number | null }
  | { id: string; typ: "vital"; titel: string; werte: VitalWerte }
  | { id: string; typ: "ankreuz"; titel: string; optionen: AnkreuzOption[] };

export type ProtokollBlockTyp = ProtokollBlock["typ"];

export const BLOCK_TYP_LABEL: Record<ProtokollBlockTyp, string> = {
  text: "Textfeld",
  tabelle: "Tabelle",
  skala: "Skala 1–10",
  foto: "Foto/Dokument",
  vital: "Vitalparameter",
  ankreuz: "Ankreuz-Block",
};

export interface ProtokollNachtrag {
  text: string;
  autorId: number | null;
  autorName: string;
  createdAt: string; // ISO
}

/** Protokolle sind 48 h nach Anlage frei editierbar, danach automatisch
 *  gesperrt (medizinische Dokumentation). Nachträge bleiben immer möglich. */
export const PROTOKOLL_SPERRE_STUNDEN = 48;

export function protokollGesperrt(createdAt: Date | string): boolean {
  const t = createdAt instanceof Date ? createdAt.getTime() : new Date(createdAt).getTime();
  return Date.now() > t + PROTOKOLL_SPERRE_STUNDEN * 3600 * 1000;
}

/** Werte aus Blöcken entfernen — für Vorlagen (Struktur ohne Inhalt). */
export function strukturOhneWerte(bloecke: ProtokollBlock[]): ProtokollBlock[] {
  return bloecke.map((b) => {
    switch (b.typ) {
      case "text":
        return { ...b, inhalt: "" };
      case "tabelle":
        return { ...b, zeilen: [] };
      case "skala":
        return { ...b, wert: null };
      case "foto":
        return { ...b, dokumentId: null };
      case "vital":
        return { ...b, werte: {} };
      case "ankreuz":
        return { ...b, optionen: b.optionen.map((o) => ({ label: o.label, gewaehlt: false })) };
    }
  });
}

/** Zahl aus einer Tabellen-Zelle lesen („120,5", „36,5 °C", „120") — für das Diagramm. */
export function zahlAusZelle(zelle: string): number | null {
  const m = /-?\d+(?:[.,]\d+)?/.exec(zelle.trim());
  if (!m) return null;
  const v = Number(m[0].replace(",", "."));
  return Number.isFinite(v) ? v : null;
}

let zaehler = 0;
/** Eindeutige Block-IDs (clientseitig). */
export function neueBlockId(): string {
  zaehler += 1;
  return `b${Date.now().toString(36)}-${zaehler}`;
}
