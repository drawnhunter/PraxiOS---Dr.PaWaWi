// ── PraxiOS: Mojibake-Reparatur (1.28.2, Bus #189) ─────────────────────────
// Doppel-UTF-8-Kodierung entsteht beim Zusammenbau aus fremden Systemen
// (z. B. „Therapieplan KW 41 Ã‚Â· 2026-10-05Ã¢â‚¬"2026-10-09"). Reparatur
// NUR wenn eindeutige Marker vorhanden sind — deutsche Texte bleiben sicher.
const MARKER = /[ÃÂâ]/g;

function zaehleMarker(s: string): number {
  return (s.match(MARKER) ?? []).length;
}

/** Repariert einen Text, falls er mojibake-kodiert ist. Idempotent. */
export function repariereText(s: string | null | undefined): string | null {
  if (!s) return s ?? null;
  if (zaehleMarker(s) === 0) return s;
  try {
    const repariert = Buffer.from(s, "latin1").toString("utf8");
    // Nur akzeptieren, wenn Marker komplett weg sind oder deutlich weniger
    if (zaehleMarker(repariert) < zaehleMarker(s)) return repariert;
    return s;
  } catch {
    return s;
  }
}

/** Auf allen Textfeldern eines Objekts anwenden (Strings only, flach). */
export function repariereFelder<T extends Record<string, unknown>>(obj: T, felder: (keyof T)[]): T {
  const kopie = { ...obj };
  for (const f of felder) {
    if (typeof kopie[f] === "string") {
      kopie[f] = repariereText(kopie[f] as string) as T[keyof T];
    }
  }
  return kopie;
}
