// ── PraxiOS: Online-Termine (Video) — Verwaltung Praxis-Seite (1.19.0) ─────
// Eigene Seite: erstellen, bearbeiten, absagen, Gäste verwalten, beitreten.
// Der Raum ist Jitsi-kompatibel (Basis-URL in den Einstellungen, Standard
// meet.jit.si — eigener Server später nur per Eintrag).
import { z } from "zod";
import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, gte } from "drizzle-orm";
import { createRouter, rechtQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { companySettings, customers, onlineTerminGaeste, onlineTermine } from "@db/schema";

const DATUM_RE = /^\d{4}-\d{2}-\d{2}$/;
const ZEIT_RE = /^\d{2}:\d{2}$/;

const terminInput = z.object({
  patientId: z.number().int(),
  titel: z.string().trim().min(1).max(255),
  datum: z.string().regex(DATUM_RE, "Format JJJJ-MM-TT"),
  zeitVon: z.string().regex(ZEIT_RE, "Format SS:MM"),
  zeitBis: z.string().regex(ZEIT_RE).nullable().optional(),
  notiz: z.string().trim().max(500).optional(),
});

async function ladeJitsiBasis(): Promise<string> {
  const s = await getDb().query.companySettings.findFirst({
    where: eq(companySettings.id, 1),
    columns: { jitsiBaseUrl: true },
  });
  return (s?.jitsiBaseUrl?.trim().replace(/\/+$/, "") || "https://meet.jit.si");
}

export const onlineTerminRouter = createRouter({
  /** Kommende + alle Online-Termine (mit Patient + Gästen). */
  liste: rechtQuery("kalender")
    .input(z.object({ nurKommende: z.boolean().default(false) }).optional())
    .query(async ({ input }) => {
      const heute = new Date().toISOString().slice(0, 10);
      return getDb().query.onlineTermine.findMany({
        where: input?.nurKommende
          ? and(eq(onlineTermine.status, "geplant"), gte(onlineTermine.datum, heute))
          : undefined,
        orderBy: [asc(onlineTermine.datum), asc(onlineTermine.zeitVon)],
        with: {
          patient: { columns: { id: true, name: true } },
          gaeste: true,
        },
        limit: 200,
      });
    }),

  erstellen: rechtQuery("kalender")
    .input(terminInput)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const patient = await db.query.customers.findFirst({
        where: eq(customers.id, input.patientId),
        columns: { id: true },
      });
      if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Patient nicht gefunden." });
      const [{ id }] = await db
        .insert(onlineTermine)
        .values({
          patientId: input.patientId,
          titel: input.titel,
          datum: input.datum,
          zeitVon: input.zeitVon,
          zeitBis: input.zeitBis ?? null,
          raumCode: `praxios-${crypto.randomBytes(12).toString("hex")}`,
          notiz: input.notiz ?? null,
          createdBy: ctx.user.id,
        })
        .$returningId();
      return { id };
    }),

  bearbeiten: rechtQuery("kalender")
    .input(terminInput.partial().extend({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const { id, ...felder } = input;
      const t = await getDb().query.onlineTermine.findFirst({ where: eq(onlineTermine.id, id) });
      if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "Termin nicht gefunden." });
      await getDb()
        .update(onlineTermine)
        .set({
          ...(felder.titel !== undefined ? { titel: felder.titel } : {}),
          ...(felder.datum !== undefined ? { datum: felder.datum } : {}),
          ...(felder.zeitVon !== undefined ? { zeitVon: felder.zeitVon } : {}),
          ...(felder.zeitBis !== undefined ? { zeitBis: felder.zeitBis } : {}),
          ...(felder.notiz !== undefined ? { notiz: felder.notiz || null } : {}),
        })
        .where(eq(onlineTermine.id, id));
      return { ok: true };
    }),

  statusSetzen: rechtQuery("kalender")
    .input(z.object({ id: z.number().int(), status: z.enum(["geplant", "abgesagt", "dokumentiert"]) }))
    .mutation(async ({ input }) => {
      await getDb().update(onlineTermine).set({ status: input.status }).where(eq(onlineTermine.id, input.id));
      return { ok: true };
    }),

  loeschen: rechtQuery("kalender")
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      // Gäste hängen per ON DELETE CASCADE am Termin
      await getDb().delete(onlineTermine).where(eq(onlineTermine.id, input.id));
      return { ok: true };
    }),

  // ── Gäste ────────────────────────────────────────────────────────────────
  gastHinzufuegen: rechtQuery("kalender")
    .input(z.object({
      terminId: z.number().int(),
      name: z.string().trim().min(1).max(255),
      email: z.string().trim().email().max(320).optional().or(z.literal("")),
    }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const t = await db.query.onlineTermine.findFirst({ where: eq(onlineTermine.id, input.terminId) });
      if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "Termin nicht gefunden." });
      const token = crypto.randomBytes(24).toString("hex");
      const [{ id }] = await db
        .insert(onlineTerminGaeste)
        .values({ terminId: input.terminId, name: input.name, email: input.email || null, token })
        .$returningId();
      return { id, token };
    }),

  gastLoeschen: rechtQuery("kalender")
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      await getDb().delete(onlineTerminGaeste).where(eq(onlineTerminGaeste.id, input.id));
      return { ok: true };
    }),

  /** Beitritts-Infos für die Praxis (Raum-URL + eigener Gast-Zugang). */
  beitritt: rechtQuery("kalender")
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = getDb();
      const t = await db.query.onlineTermine.findFirst({
        where: eq(onlineTermine.id, input.id),
        with: { gaeste: true },
      });
      if (!t) throw new TRPCError({ code: "NOT_FOUND", message: "Termin nicht gefunden." });
      const basis = await ladeJitsiBasis();
      return {
        raumUrl: `${basis}/${t.raumCode}`,
        gaeste: t.gaeste.map((g) => ({ id: g.id, name: g.name, token: g.token })),
      };
    }),
});
