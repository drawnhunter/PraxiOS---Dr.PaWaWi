import { z } from "zod";
import { TRPCError } from "@trpc/server";
import {
  adminQuery,
  authedQuery,
  createRouter,
} from "./middleware";
import { getDb } from "./queries/connection";
import { verschluesseln } from "./lib/secrets";
import { patientenNrVorschau } from "./lib/patientenNr";
import crypto from "node:crypto";
import { companySettings, numberSequences } from "@db/schema";
import { eq, and } from "drizzle-orm";

const settingsInput = z.object({
  name: z.string().min(1),
  strasse: z.string().min(1),
  plz: z.string().min(1),
  ort: z.string().min(1),
  land: z.string().default("Deutschland"),
  handelsregister: z.string().nullable().optional(),
  steuernummer: z.string().nullable().optional(),
  ustIdNr: z.string().nullable().optional(),
  email: z.string().nullable().optional(),
  telefon: z.string().nullable().optional(),
  webseite: z.string().nullable().optional(),
  standardZahlungsziel: z.number().int().min(0).max(120),
  fussText: z.string().nullable().optional(),
  datevBeraternummer: z.string().nullable().optional(),
  datevMandantennummer: z.string().nullable().optional(),
  datevKontenrahmen: z.enum(["SKR03", "SKR04"]).default("SKR03"),
  erloeskonto19: z.string().default("8400"),
  erloeskonto7: z.string().default("8300"),
  erloeskonto0: z.string().default("8120"),
  debitorStartnummer: z.number().int().min(1).default(10000),
  kreditorStartnummer: z.number().int().min(1).default(70000),
  aufwandskontoDefault: z.string().max(10).nullable().optional(),
  // Company Control (ReWaWi v1.6): registrierte Kennnummern
  eori: z.string().max(30).nullable().optional(),
  betriebsnummer: z.string().max(30).nullable().optional(),
  bgMitgliedsnummer: z.string().max(50).nullable().optional(),
  ihk: z.string().max(60).nullable().optional(),
  glaeubigerId: z.string().max(30).nullable().optional(),
  // Patientennummern-Nummernkreis (1.7.0)
  patientenNrStart: z.number().int().min(1).optional(),
  patientenNrPrefixAktiv: z.boolean().optional(),
  patientenNrPrefix: z.string().trim().min(1).max(20).optional(),
  akzentfarbe: z
    .enum(["petrol", "neutral", "blau", "gruen", "bernstein", "violett", "rot"])
    .default("petrol"),
  pdfLayout: z.enum(["klassisch", "modern", "kompakt"]).default("klassisch"),
  // SMTP (E-Mail-Versand); smtpPasswort wird nur gesetzt, wenn nicht leer
  smtpHost: z.string().nullable().optional(),
  smtpPort: z.number().int().min(1).max(65535).default(587),
  smtpUser: z.string().nullable().optional(),
  smtpAbsender: z.string().nullable().optional(),
  smtpPasswort: z.string().max(200).optional(),
  erinnerungAktiv: z.boolean().optional(),
  erinnerungTageVorher: z.number().int().min(1).max(7).optional(),
});

export const settingsRouter = createRouter({
  get: authedQuery.query(async () => {
    const row = await getDb().query.companySettings.findFirst({
      where: eq(companySettings.id, 1),
    });
    if (!row) return null;
    // age_secret verlässt den Server nie (geheimer Schlüssel für den Austausch);
    // das Unterschriftsbild ist zu groß für den Routine-GET (nur Flag + eigenes Query)
    const { ageSecret: _geheim, smtpPasswortEnc: _smtp, signaturBild: _sig, ...oeffentlich } = row;
    return {
      ...oeffentlich,
      ageSecretVorhanden: !!row.ageSecret,
      smtpPasswortGesetzt: !!row.smtpPasswortEnc,
      signaturVorhanden: !!row.signaturBild,
    };
  }),

  // Unterschriftsbild (base64-Data-URL) für Rezepte/Atteste — nur Verwaltung
  signatur: adminQuery.query(async () => {
    const row = await getDb().query.companySettings.findFirst({
      where: eq(companySettings.id, 1),
      columns: { signaturBild: true },
    });
    return { dataUrl: row?.signaturBild ?? null };
  }),

  signaturSetzen: adminQuery
    .input(
      z.object({
        // PNG/JPG als Data-URL, max. ~1,5 MB base64; null = entfernen
        dataUrl: z
          .string()
          .regex(/^data:image\/(png|jpe?g);base64,[A-Za-z0-9+/=]+$/, "Nur PNG/JPG als Data-URL")
          .max(2_000_000, "Bild zu groß (max. ca. 1,5 MB)")
          .nullable(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const row = await db.query.companySettings.findFirst({
        where: eq(companySettings.id, 1),
        columns: { id: true },
      });
      if (!row) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Bitte zuerst die Praxisdaten oben speichern.",
        });
      }
      await db
        .update(companySettings)
        .set({ signaturBild: input.dataUrl })
        .where(eq(companySettings.id, 1));
      return { ok: true };
    }),

  // PraxiOS: Einstellungen ändern = Verwaltung (admin/Leitung)
  update: adminQuery.input(settingsInput).mutation(async ({ input }) => {
    const { smtpPasswort, ...rest } = input;
    // SMTP-Passwort wird nur ersetzt, wenn ein neues eingegeben wurde —
    // und ausschließlich verschlüsselt abgelegt (AES-256-GCM, Key = APP_SECRET)
    const werte: Record<string, unknown> = { ...rest };
    if (smtpPasswort) werte.smtpPasswortEnc = verschluesseln(smtpPasswort);
    await getDb()
      .insert(companySettings)
      .values({ id: 1, ...werte } as never)
      .onDuplicateKeyUpdate({ set: werte as never });
    return { ok: true };
  }),

  /** Vorschau der nächsten Patientennummer (zählt nicht hoch). */
  patientenNrVorschau: authedQuery.query(async () => {
    return { vorschau: await patientenNrVorschau() };
  }),

  /** Backup-Erinnerung: Nutzer bestätigt „Backup erledigt" (Banner ruht 14 Tage). */
  backupErledigt: authedQuery.mutation(async () => {
    await getDb()
      .insert(companySettings)
      .values({ id: 1, backupZuletztAm: new Date() } as never)
      .onDuplicateKeyUpdate({ set: { backupZuletztAm: new Date() } as never });
    return { ok: true };
  }),

  icsStatus: authedQuery.query(async () => {
    const db = getDb();
    const row = await db.query.companySettings.findFirst({
      where: eq(companySettings.id, 1),
    });
    if (row?.icsToken) return { token: row.icsToken };
    const token = crypto.randomBytes(24).toString("base64url");
    await db.update(companySettings).set({ icsToken: token }).where(eq(companySettings.id, 1));
    return { token };
  }),

  icsNeu: adminQuery.mutation(async () => {
    const token = crypto.randomBytes(24).toString("base64url");
    await getDb().update(companySettings).set({ icsToken: token }).where(eq(companySettings.id, 1));
    return { token };
  }),

  erinnerungPruefen: authedQuery.mutation(async () => {
    const { erinnerungJetztPruefen } = await import("./terminErinnerung");
    return erinnerungJetztPruefen();
  }),

  sequences: authedQuery.query(async () => {
    return getDb().select().from(numberSequences);
  }),

  /** Startwert des Nummernkreises korrigieren — nur aufwärts erlaubt (GoBD). */
  setSequenceStart: authedQuery
    .input(
      z.object({
        typ: z.enum(["invoice", "credit_note", "delivery_note", "purchase_order", "offer"]),
        jahr: z.number().int(),
        naechsteNummer: z.number().int().min(1),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const [row] = await db
        .select()
        .from(numberSequences)
        .where(
          and(
            eq(numberSequences.typ, input.typ),
            eq(numberSequences.jahr, input.jahr),
          ),
        );
      const gewuenschterStand = input.naechsteNummer - 1;
      if (row && gewuenschterStand < row.letzteNummer) {
        throw new Error(
          `Nummernkreis kann nicht zurückgesetzt werden (aktueller Stand: ${row.letzteNummer}).`,
        );
      }
      if (row) {
        await db
          .update(numberSequences)
          .set({ letzteNummer: gewuenschterStand })
          .where(eq(numberSequences.id, row.id));
      } else {
        await db
          .insert(numberSequences)
          .values({ typ: input.typ, jahr: input.jahr, letzteNummer: gewuenschterStand });
      }
      return { ok: true };
    }),
});
