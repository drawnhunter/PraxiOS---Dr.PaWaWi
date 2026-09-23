// ── PraxiOS: Jitsi-JWT (HS256, 1.19.2) ──────────────────────────────────────
// Signiert Raum-Beitritte: wer Moderator ist, entscheidet der SERVER — der
// Nutzer sieht nie die „Wer leitet die Sitzung?"-Frage. Außerdem sind
// Raum-Zugänge token-geschützt (Jitsi mit JWT-Auth), Fremde ohne Link kommen
// nicht rein. Ohne konfiguriertes Secret wird kein Token erzeugt (funktioniert
// dann mit JWT-abgeschalteten Jitsis, z. B. zur Testphase).
import crypto from "node:crypto";
import { eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { companySettings } from "@db/schema";

export interface JitsiJwtResult {
  token: string | null;
  basis: string;
}

function b64url(buf: Buffer | string): string {
  return Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function ladeJitsiConfig(): Promise<{ basis: string; appId: string | null; geheim: string | null }> {
  const s = await getDb().query.companySettings.findFirst({
    where: eq(companySettings.id, 1),
    columns: { jitsiBaseUrl: true, jitsiAppId: true, jitsiAppSecret: true },
  });
  return {
    basis: (s?.jitsiBaseUrl?.trim().replace(/\/+$/, "") || "https://meet.jit.si"),
    appId: s?.jitsiAppId?.trim() || null,
    geheim: s?.jitsiAppSecret?.trim() || null,
  };
}

/**
 * Baut ein Jitsi-JWT (HS256). Einsteigerrollen:
 * - moderator: true → Praxis (darf andere entfernen, Raum schließen)
 * - moderator: false → Patient/Gast
 * Gültigkeit: ab jetzt bis +2 h (Termin lief dann längst).
 */
export function baueJitsiJwt(
  geheim: string,
  appId: string,
  basisUrl: string,
  raumCode: string,
  anzeigeName: string,
  moderator: boolean,
): string {
  const u = new URL(basisUrl);
  const kopf = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const jetzt = Math.floor(Date.now() / 1000);
  const inhalt = b64url(
    JSON.stringify({
      context: {
        user: { name: anzeigeName, moderator, lobbybypass: moderator },
        features: { livestreaming: false, recording: moderator },
      },
      aud: "jitsi",
      iss: appId,
      sub: u.host,
      room: raumCode,
      exp: jetzt + 2 * 3600,
      nbf: jetzt - 10,
    }),
  );
  const signatur = b64url(crypto.createHmac("sha256", geheim).update(`${kopf}.${inhalt}`).digest());
  return `${kopf}.${inhalt}.${signatur}`;
}

/** Komplett-Paket für einen Beitritt: Raum-URL + (optional) JWT. */
export async function jitsiBeitritt(raumCode: string, anzeigeName: string, moderator: boolean): Promise<JitsiJwtResult> {
  const cfg = await ladeJitsiConfig();
  return {
    basis: cfg.basis,
    token: cfg.geheim && cfg.appId
      ? baueJitsiJwt(cfg.geheim, cfg.appId, cfg.basis, raumCode, anzeigeName, moderator)
      : null,
  };
}
