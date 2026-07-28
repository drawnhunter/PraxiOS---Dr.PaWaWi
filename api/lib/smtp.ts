// ── Geteilter SMTP-Loader (Mailversand aus Belegen UND Erinnerungen) ───────
import nodemailer from "nodemailer";
import { eq } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { companySettings } from "@db/schema";
import { entschluesseln } from "./secrets";

export interface SmtpPaket {
  transporter: nodemailer.Transporter;
  absender: string;
  praxisName: string;
  praxisEmail: string | null;
}

/** Lädt die SMTP-Konfiguration (wirft, wenn nicht eingerichtet). */
export async function ladeSmtp(): Promise<SmtpPaket> {
  const s = await getDb().query.companySettings.findFirst({
    where: eq(companySettings.id, 1),
  });
  if (!s?.smtpHost || !s.smtpUser) {
    throw new Error("SMTP ist noch nicht eingerichtet (Einstellungen → E-Mail).");
  }
  const passwort = entschluesseln(s.smtpPasswortEnc);
  // Test-Hook: "stream" als Host erzeugt die Mail ohne Versand (für Tests)
  const transporter =
    s.smtpHost === "stream"
      ? nodemailer.createTransport({ streamTransport: true, buffer: true } as never)
      : nodemailer.createTransport({
          host: s.smtpHost,
          port: s.smtpPort,
          secure: s.smtpPort === 465,
          auth: passwort ? { user: s.smtpUser, pass: passwort } : undefined,
          requireTLS: s.smtpPort === 587,
        });
  return {
    transporter,
    absender: s.smtpAbsender || s.smtpUser,
    praxisName: s.name,
    praxisEmail: s.email,
  };
}

/** Prüft nur, ob SMTP konfiguriert ist (für bedingte Funktionen). */
export async function smtpKonfiguriert(): Promise<boolean> {
  const s = await getDb().query.companySettings.findFirst({
    where: eq(companySettings.id, 1),
    columns: { smtpHost: true, smtpUser: true },
  });
  return !!(s?.smtpHost && s.smtpUser);
}
