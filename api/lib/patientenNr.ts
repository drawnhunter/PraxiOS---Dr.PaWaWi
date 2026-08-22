// ── PraxiOS: Patientennummern-Nummernkreis ──────────────────────────────────
// Vergabe in Transaktion (kollisionssicher, wie die Rechnungsnummern).
// Format: reine Zahl (Standard) oder frei konfigurierbarer Präfix, z. B.
// „P-1001", „IMTZ-1001" — Startzahl + Präfix in den Einstellungen.
import { and, eq } from "drizzle-orm";
import { companySettings, numberSequences } from "@db/schema";
import { getDb } from "../queries/connection";

type Tx = Pick<Parameters<Parameters<ReturnType<typeof getDb>["transaction"]>[0]>[0], "select" | "insert" | "update">;

/** Nächste freie Patientennummer (zählt hoch, garantiert einmalig in Folge). */
export async function naechstePatientenNr(tx: Tx): Promise<string> {
  // Zeile sicherstellen
  await tx
    .insert(numberSequences)
    .values({ typ: "patient", jahr: 0, letzteNummer: 0 })
    .onDuplicateKeyUpdate({ set: { typ: "patient" } });

  const [seq] = await tx
    .select()
    .from(numberSequences)
    .where(and(eq(numberSequences.typ, "patient"), eq(numberSequences.jahr, 0)))
    .for("update");

  // Beim ersten Gebrauch den konfigurierten Startwert anwenden
  if (seq.letzteNummer === 0) {
    const settings = await tx
      .select({ start: companySettings.patientenNrStart })
      .from(companySettings)
      .limit(1);
    const start = Math.max(settings[0]?.start ?? 1, 1);
    await tx
      .update(numberSequences)
      .set({ letzteNummer: start - 1 })
      .where(and(eq(numberSequences.typ, "patient"), eq(numberSequences.jahr, 0)));
    seq.letzteNummer = start - 1;
  }

  const n = seq.letzteNummer + 1;
  await tx
    .update(numberSequences)
    .set({ letzteNummer: n })
    .where(and(eq(numberSequences.typ, "patient"), eq(numberSequences.jahr, 0)));

  const [s] = await tx
    .select({
      aktiv: companySettings.patientenNrPrefixAktiv,
      prefix: companySettings.patientenNrPrefix,
    })
    .from(companySettings)
    .limit(1);
  return s?.aktiv && s.prefix.trim() ? `${s.prefix.trim()}-${n}` : String(n);
}

/** Nur zur Vorschau in den Einstellungen (zählt NICHT hoch). */
export async function patientenNrVorschau(): Promise<string> {
  const db = getDb();
  const seq = await db.query.numberSequences.findFirst({
    where: and(eq(numberSequences.typ, "patient"), eq(numberSequences.jahr, 0)),
  });
  const s = await db.query.companySettings.findFirst();
  const n = (seq?.letzteNummer ?? 0) > 0 ? (seq!.letzteNummer + 1) : (s?.patientenNrStart ?? 1);
  return s?.patientenNrPrefixAktiv && s.patientenNrPrefix.trim()
    ? `${s.patientenNrPrefix.trim()}-${n}`
    : String(n);
}
