// ── PraxiOS: QES-Signatur über Sproof Sign (eIDAS, 1.28.0) ─────────────────
// Qualifizierte elektronische Signatur = rechtlich gleichwertig mit der
// eigenhändigen Unterschrift → das Rezept wird zur gültigen elektronischen
// Verschreibung (AMVV). API: https://sign.sproof.com/api/v1 (Token in Body).
import { eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { companySettings } from "@db/schema";
import { entschluesseln } from "./secrets";

const BASIS = "https://sign.sproof.com/api/v1";

interface SproofAntwort {
  ok: boolean;
  fehler?: string;
  // Create-Signature-Response
  id?: string;
  member?: { id?: string };
  members?: { id?: string }[];
  signingUrl?: string;
  memberId?: string;
  // Status-Response
  state?: string;
  allSignersSigned?: boolean;
  // Get-Document-Response
  data?: string;
}

async function ladeQes(): Promise<{ token: string; signerEmail: string }> {
  const s = await getDb().query.companySettings.findFirst({
    where: eq(companySettings.id, 1),
    columns: { qesTokenEnc: true, qesSignerEmail: true },
  });
  const token = entschluesseln(s?.qesTokenEnc ?? null);
  if (!token) throw new Error("QES ist nicht eingerichtet (Einstellungen → Praxis: Sproof-Token fehlt).");
  if (!s?.qesSignerEmail) {
    throw new Error("QES: Signierer-E-Mail fehlt (Einstellungen → Praxis) — das ist das Sproof-Konto des Unterzeichners (z. B. des Arztes).");
  }
  return { token, signerEmail: s.qesSignerEmail };
}

async function aufruf(pfad: string, payload: Record<string, unknown>): Promise<SproofAntwort> {
  const { token } = await ladeQes();
  const res = await fetch(`${BASIS}${pfad}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, ...payload }),
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let daten: SproofAntwort;
  try {
    daten = JSON.parse(text) as SproofAntwort;
  } catch {
    throw new Error(`Sproof antwortete nicht mit JSON (HTTP ${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) throw new Error(`Sproof ${res.status}: ${daten.fehler ?? text.slice(0, 200)}`);
  return daten;
}

/** Signatur-Auftrag anlegen: PDF per base64, Signierer = der Arzt (QES). */
export async function qesSignaturAuftrag(e: {
  pdfBase64: string;
  dateiname: string;
  arztName: string;
  betreff?: string;
  nachricht?: string;
}): Promise<{ memberId: string; signingUrl: string | null }> {
  const { signerEmail } = await ladeQes();
  const [vn, nn] = e.arztName.includes(",")
    ? [e.arztName.split(",")[1].trim(), e.arztName.split(",")[0].trim()]
    : [e.arztName, ""];
  const antwort = await aufruf("/documents/signature", {
    email: signerEmail,
    firstName: vn,
    lastName: nn,
    role: "signer",
    data: e.pdfBase64,
    mimetype: "application/pdf",
    fileName: e.dateiname.replace(/\.pdf$/i, ""),
    subject: e.betreff ?? `Zur Signatur: ${e.dateiname}`,
    message: e.nachricht ?? "Bitte qualifiziert signieren (QES).",
    inviteLanguage: "de",
    sendOutFinishedPdf: false,
    focusedSigningMode: true,
    signatureTypes: ["qualified"],
    recipientDetails: {
      [signerEmail]: {
        role: "signer",
        signaturePositions: [{ page: 0, x: 0.53, y: 0.845, width: 0.4, height: 0.1 }],
      },
    },
  });
  // memberId: aus der Antwort extrahieren (member.id oder members[0].id)
  const memberId = antwort.memberId ?? antwort.member?.id ?? antwort.members?.[0]?.id ?? antwort.id;
  if (!memberId) throw new Error("Sproof-Antwort ohne memberId — Signatur-Auftrag nicht nachvollziehbar.");
  return { memberId: String(memberId), signingUrl: antwort.signingUrl ?? null };
}

/** Status abrufen (memberId). state: draft/pending/declined/completed/… */
export async function qesStatus(memberId: string): Promise<{ state: string; fertig: boolean }> {
  const antwort = await aufruf("/documents/signature/status", { memberId });
  const state = antwort.state ?? "unbekannt";
  return { state, fertig: state === "completed" || state === "manuallyCompleted" || antwort.allSignersSigned === true };
}

/** Signiertes Dokument holen (base64-PDF). */
export async function qesDokument(memberId: string): Promise<string> {
  const antwort = await aufruf("/documents/signature/document", { memberId });
  if (!antwort.data) throw new Error("Sproof lieferte kein signiertes Dokument (noch nicht fertig?).");
  return antwort.data;
}
