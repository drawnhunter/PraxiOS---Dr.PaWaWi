import { z } from "zod";
import {
  authedQuery,
  createRouter,
} from "./middleware";
import { getDb } from "./queries/connection";
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
  akzentfarbe: z
    .enum(["petrol", "neutral", "blau", "gruen", "bernstein", "violett", "rot"])
    .default("petrol"),
  pdfLayout: z.enum(["klassisch", "modern", "kompakt"]).default("klassisch"),
});

export const settingsRouter = createRouter({
  get: authedQuery.query(async () => {
    const row = await getDb().query.companySettings.findFirst({
      where: eq(companySettings.id, 1),
    });
    if (!row) return null;
    // age_secret verlässt den Server nie (geheimer Schlüssel für den Austausch)
    const { ageSecret: _geheim, ...oeffentlich } = row;
    return { ...oeffentlich, ageSecretVorhanden: !!row.ageSecret };
  }),

  update: authedQuery.input(settingsInput).mutation(async ({ input }) => {
    await getDb()
      .insert(companySettings)
      .values({ id: 1, ...input })
      .onDuplicateKeyUpdate({ set: { ...input } });
    return { ok: true };
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
