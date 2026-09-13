// ── PraxiOS: Patienten-Portal — Verwaltung (Praxis-Seite) ───────────────────
import { z } from "zod";
import crypto from "node:crypto";
import { TRPCError } from "@trpc/server";
import { and, desc, eq } from "drizzle-orm";
import { createRouter, rechtQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  customers,
  patientDatenAntraege,
  patientPortalLinks,
  patientPortalZugriffe,
  terminAnfragen,
} from "@db/schema";

export const portalAdminRouter = createRouter({
  // ── Links verwalten ──────────────────────────────────────────────────────
  links: rechtQuery("akte")
    .input(z.object({ patientId: z.number().int() }))
    .query(async ({ input }) => {
      return getDb().query.patientPortalLinks.findMany({
        where: eq(patientPortalLinks.patientId, input.patientId),
        orderBy: [desc(patientPortalLinks.createdAt)],
      });
    }),

  linkErstellen: rechtQuery("akte")
    .input(z.object({ patientId: z.number().int(), tage: z.number().int().min(1).max(365).default(30) }))
    .mutation(async ({ ctx, input }) => {
      const patient = await getDb().query.customers.findFirst({
        where: eq(customers.id, input.patientId),
      });
      if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Patient nicht gefunden." });
      const token = crypto.randomBytes(24).toString("hex");
      const gueltigBis = new Date(Date.now() + input.tage * 86400000).toISOString().slice(0, 10);
      await getDb().insert(patientPortalLinks).values({
        patientId: input.patientId,
        token,
        gueltigBis,
        createdBy: ctx.user.id,
      });
      return { token, gueltigBis };
    }),

  linkLoeschen: rechtQuery("akte")
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      await getDb().delete(patientPortalLinks).where(eq(patientPortalLinks.id, input.id));
      return { ok: true };
    }),

  zugriffe: rechtQuery("akte")
    .input(z.object({ patientId: z.number().int(), limit: z.number().int().min(1).max(200).default(50) }))
    .query(async ({ input }) => {
      return getDb().query.patientPortalZugriffe.findMany({
        where: eq(patientPortalZugriffe.patientId, input.patientId),
        orderBy: [desc(patientPortalZugriffe.zeitpunkt)],
        limit: input.limit,
      });
    }),

  // ── Datenänderungs-Anträge ───────────────────────────────────────────────
  antraege: rechtQuery("akte")
    .input(z.object({ status: z.enum(["offen", "bestaetigt", "abgelehnt"]).optional(), patientId: z.number().int().optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      const bed = [
        ...(input.status ? [eq(patientDatenAntraege.status, input.status)] : []),
        ...(input.patientId ? [eq(patientDatenAntraege.patientId, input.patientId)] : []),
      ];
      return db.query.patientDatenAntraege.findMany({
        where: bed.length ? and(...bed) : undefined,
        orderBy: [desc(patientDatenAntraege.createdAt)],
        with: { patient: { columns: { id: true, name: true } } },
        limit: 100,
      });
    }),

  antragBestaetigen: rechtQuery("akte")
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const antrag = await db.query.patientDatenAntraege.findFirst({
        where: eq(patientDatenAntraege.id, input.id),
      });
      if (!antrag) throw new TRPCError({ code: "NOT_FOUND", message: "Antrag nicht gefunden." });
      if (antrag.status !== "offen") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Antrag wurde bereits bearbeitet." });
      }
      // Änderungen WIRKLICH übernehmen (nur nach Bestätigung durch die Praxis)
      const felder = JSON.parse(antrag.felder) as { feld: string; alt: string; neu: string }[];
      const setze: Record<string, string> = {};
      for (const f of felder) setze[f.feld] = f.neu;
      await db.transaction(async (tx) => {
        await tx.update(customers).set(setze).where(eq(customers.id, antrag.patientId));
        await tx
          .update(patientDatenAntraege)
          .set({ status: "bestaetigt", bearbeitetAm: new Date(), bearbeitetVon: ctx.user.id })
          .where(eq(patientDatenAntraege.id, input.id));
      });
      return { ok: true, uebernommen: Object.keys(setze) };
    }),

  antragAblehnen: rechtQuery("akte")
    .input(z.object({ id: z.number().int(), kommentar: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      await getDb()
        .update(patientDatenAntraege)
        .set({ status: "abgelehnt", kommentar: input.kommentar ?? null, bearbeitetAm: new Date(), bearbeitetVon: ctx.user.id })
        .where(eq(patientDatenAntraege.id, input.id));
      return { ok: true };
    }),

  // ── Termin-Anfragen ──────────────────────────────────────────────────────
  terminAnfragen: rechtQuery("akte")
    .input(z.object({ status: z.enum(["offen", "bestaetigt", "abgelehnt"]).optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      return db.query.terminAnfragen.findMany({
        where: input.status ? eq(terminAnfragen.status, input.status) : undefined,
        orderBy: [desc(terminAnfragen.createdAt)],
        with: { patient: { columns: { id: true, name: true } } },
        limit: 100,
      });
    }),

  terminAnfrageBestaetigen: rechtQuery("akte")
    .input(z.object({ id: z.number().int(), kommentar: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      await getDb()
        .update(terminAnfragen)
        .set({ status: "bestaetigt", praxisKommentar: input.kommentar ?? null, bearbeitetAm: new Date(), bearbeitetVon: ctx.user.id })
        .where(eq(terminAnfragen.id, input.id));
      return { ok: true };
    }),

  terminAnfrageAblehnen: rechtQuery("akte")
    .input(z.object({ id: z.number().int(), kommentar: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      await getDb()
        .update(terminAnfragen)
        .set({ status: "abgelehnt", praxisKommentar: input.kommentar ?? null, bearbeitetAm: new Date(), bearbeitetVon: ctx.user.id })
        .where(eq(terminAnfragen.id, input.id));
      return { ok: true };
    }),
});
