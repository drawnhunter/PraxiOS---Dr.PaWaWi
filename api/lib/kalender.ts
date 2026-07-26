// ISO-8601-Kalenderwochen-Logik (reine Datumsrechnung, ohne Bibliothek).

// Liefert das Datum (als „JJJJ-MM-TT“) eines Wochentags in einer ISO-KW.
// wochentag: 1 = Montag … 7 = Sonntag.
export function kwZuDatum(jahr: number, kw: number, wochentag: number): string {
  // 4. Januar liegt immer in KW 1 (ISO-8601)
  const vierterJanuar = new Date(Date.UTC(jahr, 0, 4));
  const tagDerWoche = vierterJanuar.getUTCDay() === 0 ? 7 : vierterJanuar.getUTCDay();
  // Montag der KW 1
  const montagKw1 = new Date(vierterJanuar);
  montagKw1.setUTCDate(vierterJanuar.getUTCDate() - (tagDerWoche - 1));
  // Ziel-Datum
  const ziel = new Date(montagKw1);
  ziel.setUTCDate(montagKw1.getUTCDate() + (kw - 1) * 7 + (wochentag - 1));
  return ziel.toISOString().slice(0, 10);
}

// ISO-Kalenderwoche + zugehöriges Jahr eines Datums („JJJJ-MM-TT“).
export function datumZuKw(datum: string): { jahr: number; kw: number } {
  const d = new Date(datum + "T00:00:00Z");
  const tag = d.getUTCDay() === 0 ? 7 : d.getUTCDay();
  // Auf Donnerstag der Woche verschieben — dessen Jahr ist das KW-Jahr
  d.setUTCDate(d.getUTCDate() + (4 - tag));
  const jahr = d.getUTCFullYear();
  const jahresanfang = new Date(Date.UTC(jahr, 0, 1));
  const kw = Math.ceil(((d.getTime() - jahresanfang.getTime()) / 86400000 + 1) / 7);
  return { jahr, kw };
}

// Heutiges Datum als „JJJJ-MM-TT“ (lokale Serverzeit).
export function heuteIso(): string {
  const jetzt = new Date();
  const j = jetzt.getFullYear();
  const m = String(jetzt.getMonth() + 1).padStart(2, "0");
  const t = String(jetzt.getDate()).padStart(2, "0");
  return `${j}-${m}-${t}`;
}
