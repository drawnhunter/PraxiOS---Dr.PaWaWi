// ── PraxiOS: Maschinelle Übersetzung über LibreTranslate (on-premise) ──────
// Der Dienst läuft als Sidecar-Container NUR intern (TRANSLATE_URL).
// Übersetzungen werden persistent gecacht (translation_cache) — ein Text wird
// pro Zielsprache nur einmal übersetzt.
import crypto from "node:crypto";
import { eq, inArray, and } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { translationCache } from "@db/schema";

const URL_ = () => process.env.TRANSLATE_URL ?? "http://translate:5000";

function hash(quelle: string, ziel: string): string {
  return crypto.createHash("sha256").update(`${ziel}|${quelle}`).digest("hex").slice(0, 32);
}

/** Ist der Übersetzungsdienst erreichbar? (für Fallback-Anzeige) */
export async function translateVerfuegbar(): Promise<boolean> {
  try {
    const res = await fetch(`${URL_()}/languages`, { signal: AbortSignal.timeout(4000) });
    return res.ok;
  } catch {
    return false;
  }
}

interface LtAntwort {
  translatedText?: string;
  error?: string;
}

async function ltBatch(texte: string[], quelle: string, ziel: string): Promise<string[]> {
  const res = await fetch(`${URL_()}/translate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ q: texte, source: quelle, target: ziel, format: "text" }),
    signal: AbortSignal.timeout(60000),
  });
  if (!res.ok) throw new Error(`LibreTranslate: HTTP ${res.status}`);
  const data = (await res.json()) as LtAntwort | { translatedText: string[] };
  if ("error" in data && data.error) throw new Error(`LibreTranslate: ${data.error}`);
  // LibreTranslate liefert bei Array-Eingabe { translatedText: string[] }
  const out = (data as { translatedText: string[] | string }).translatedText;
  return Array.isArray(out) ? out : [out as string];
}

/**
 * Texte von `quelle` nach `ziel` übersetzen (gecacht in translation_cache).
 * ziel === quelle → identisch zurück (kein Dienst nötig).
 */
export async function uebersetzeBatch(
  texte: string[],
  ziel: string,
  quelle = "de",
): Promise<string[]> {
  if (ziel === quelle || texte.length === 0) return [...texte];
  const db = getDb();
  const ergebnis = new Array<string>(texte.length);
  const fehlende: { idx: number; text: string }[] = [];

  const hashes = texte.map((t) => hash(t, ziel));
  const gecacht = await db
    .select()
    .from(translationCache)
    .where(
      and(
        inArray(translationCache.hash, hashes),
        eq(translationCache.zielSprache, ziel),
      ),
    );
  const cacheMap = new Map(gecacht.map((c) => [c.hash, c.ziel]));

  texte.forEach((t, i) => {
    const hit = cacheMap.get(hashes[i]);
    if (hit !== undefined) ergebnis[i] = hit;
    else fehlende.push({ idx: i, text: t });
  });

  if (fehlende.length > 0) {
    // LibreTranslate verarbeitet Batches; in Häppchen à 50 aufteilen
    for (let i = 0; i < fehlende.length; i += 50) {
      const teil = fehlende.slice(i, i + 50);
      const uebersetzt = await ltBatch(teil.map((x) => x.text), quelle, ziel);
      for (let j = 0; j < teil.length; j++) {
        ergebnis[teil[j].idx] = uebersetzt[j] ?? teil[j].text;
        await db
          .insert(translationCache)
          .values({
            hash: hash(teil[j].text, ziel),
            quelle: teil[j].text,
            zielSprache: ziel,
            ziel: ergebnis[teil[j].idx],
          })
          .onDuplicateKeyUpdate({ set: { ziel: ergebnis[teil[j].idx] } });
      }
    }
  }
  return ergebnis;
}

/** Einzeltext bequem. */
export async function uebersetze(text: string, ziel: string, quelle = "de"): Promise<string> {
  const [out] = await uebersetzeBatch([text], ziel, quelle);
  return out;
}
