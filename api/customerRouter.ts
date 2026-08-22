import { z } from "zod";
import {
  adminQuery,
  createRouter,
  rechtQuery,
} from "./middleware";
import { TRPCError } from "@trpc/server";
import { getDb } from "./queries/connection";
import { naechstePatientenNr } from "./lib/patientenNr";
import {
  customers,
  patientContacts,
  therapyPlans,
  planEntries,
  documents,
  timelineEvents,
  loeschprotokoll,
  invoices,
  invoiceTherapieWochen,
} from "@db/schema";
import { eq, like, or, and, inArray, count, desc } from "drizzle-orm";
import { schreibeTimeline } from "./lib/timeline";
import { env } from "./lib/env";
import { rm } from "node:fs/promises";
import path from "node:path";

// MySQL-Duplicate-Key (z. B. patients.patientenNr unique)
function istUniqueVerletzung(e: unknown): boolean {
  return (
    typeof e === "object" &&
    e !== null &&
    "code" in e &&
    (e as { code?: string }).code === "ER_DUP_ENTRY"
  );
}

const kontaktInput = z.object({
  patientId: z.number().int(),
  name: z.string().trim().min(1, "Name ist Pflicht").max(255),
  verhaeltnis: z.string().max(100).nullable().optional(),
  telefon: z.string().max(50).nullable().optional(),
  email: z.string().max(320).nullable().optional(),
  adresse: z.string().max(500).nullable().optional(),
  istRechnungsempfaenger: z.boolean().default(false),
  notiz: z.string().max(500).nullable().optional(),
});

const customerInput = z.object({
  name: z.string().min(1),
  zusatz: z.string().nullable().optional(),
  // Adresse fachlich wichtig für Rechnungen, beim Anlegen aber optional
  // (PraxisWerk: Akte zuerst, Rechnung später)
  strasse: z.string().default(""),
  plz: z.string().default(""),
  ort: z.string().default(""),
  land: z.string().default("Deutschland"),
  email: z.string().nullable().optional(),
  telefon: z.string().nullable().optional(),
  geburtsdatum: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Format: JJJJ-MM-TT")
    .nullable()
    .optional(),
  patientenNr: z.string().max(50).nullable().optional(),
  krankenkasse: z.string().max(255).nullable().optional(),
  versichertennummer: z.string().max(50).nullable().optional(),
  aerztlicherAnsprechpartner: z.string().max(255).nullable().optional(),
  tags: z.string().max(500).nullable().optional(),
  ustIdNr: z.string().nullable().optional(),
  zahlungszielTage: z.number().int().min(0).max(120).nullable().optional(),
  notizen: z.string().nullable().optional(),
});

export const customerRouter = createRouter({
  list: rechtQuery("akte")
    .input(
      z
        .object({
          suche: z.string().optional(),
          tag: z.string().optional(),
          inklArchivierte: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const suche = input?.suche?.trim();
      const tag = input?.tag?.trim();
      const inklArch = input?.inklArchivierte ?? false;
      const bedingungen = [];
      if (suche) {
        bedingungen.push(
          or(
            like(customers.name, `%${suche}%`),
            like(customers.ort, `%${suche}%`),
            like(customers.email, `%${suche}%`),
            like(customers.patientenNr, `%${suche}%`),
          )!,
        );
      }
      if (tag) bedingungen.push(like(customers.tags, `%${tag}%`));
      const rows = await db.query.customers.findMany({
        where: bedingungen.length > 0 ? and(...bedingungen) : undefined,
        orderBy: [desc(customers.createdAt)],
      });
      return inklArch ? rows : rows.filter((r) => !r.archiviert);
    }),

  get: rechtQuery("akte").input(z.object({ id: z.number() })).query(async ({ input }) => {
    const patient = await getDb().query.customers.findFirst({
      where: eq(customers.id, input.id),
      with: {
        kontakte: true,
        timeline: {
          orderBy: [desc(timelineEvents.datum), desc(timelineEvents.id)],
          limit: 100,
        },
      },
    });
    if (!patient) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Patient nicht gefunden." });
    }
    return patient;
  }),

  create: rechtQuery("akte").input(customerInput).mutation(async ({ input }) => {
    try {
      const [{ id }] = await getDb().transaction(async (tx) => {
        // Patientennummer automatisch aus dem Nummernkreis, wenn leer gelassen
        const patientenNr =
          input.patientenNr?.trim() || (await naechstePatientenNr(tx));
        return tx
          .insert(customers)
          .values({ ...input, patientenNr })
          .$returningId();
      });
      return { id };
    } catch (e) {
      if (istUniqueVerletzung(e)) {
        throw new TRPCError({
          code: "CONFLICT",
          message: "Diese Patienten-Nr. ist bereits vergeben.",
        });
      }
      throw e;
    }
  }),

  update: rechtQuery("akte")
    .input(z.object({ id: z.number(), data: customerInput }))
    .mutation(async ({ input }) => {
      try {
        await getDb()
          .update(customers)
          .set(input.data)
          .where(eq(customers.id, input.id));
        return { ok: true };
      } catch (e) {
        if (istUniqueVerletzung(e)) {
          throw new TRPCError({
            code: "CONFLICT",
            message: "Diese Patienten-Nr. ist bereits vergeben.",
          });
        }
        throw e;
      }
    }),

  setArchiviert: rechtQuery("akte")
    .input(z.object({ id: z.number(), archiviert: z.boolean() }))
    .mutation(async ({ input }) => {
      await getDb()
        .update(customers)
        .set({ archiviert: input.archiviert })
        .where(eq(customers.id, input.id));
      return { ok: true };
    }),

  // ── PraxisWerk-Akte: Kontakte, Notizen, Ausfallquote, Löschkonzept ───────
  addKontakt: rechtQuery("akte").input(kontaktInput).mutation(async ({ input }) => {
    const [{ id }] = await getDb().insert(patientContacts).values(input).$returningId();
    return { id };
  }),

  updateKontakt: rechtQuery("akte")
    .input(
      z.object({
        id: z.number().int(),
        data: kontaktInput.omit({ patientId: true }).partial(),
      }),
    )
    .mutation(async ({ input }) => {
      await getDb()
        .update(patientContacts)
        .set(input.data)
        .where(eq(patientContacts.id, input.id));
      return { ok: true };
    }),

  removeKontakt: rechtQuery("akte")
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      await getDb().delete(patientContacts).where(eq(patientContacts.id, input.id));
      return { ok: true };
    }),

  addNotiz: rechtQuery("akte")
    .input(z.object({ patientId: z.number().int(), text: z.string().trim().min(1) }))
    .mutation(async ({ ctx, input }) => {
      await schreibeTimeline({
        patientId: input.patientId,
        typ: "notiz",
        titel: "Notiz",
        beschreibung: input.text,
        createdBy: ctx.user.id,
      });
      return { ok: true };
    }),

  ausfallquote: rechtQuery("akte")
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = getDb();
      const plaene = await db
        .select({ id: therapyPlans.id })
        .from(therapyPlans)
        .where(eq(therapyPlans.patientId, input.id));
      const planIds = plaene.map((p) => p.id);
      if (planIds.length === 0) {
        return { gesamt: 0, stattgefunden: 0, abgesagt: 0, ausgefallen: 0, quoteProzent: 0 };
      }
      const eintraege = await db
        .select({ status: planEntries.status })
        .from(planEntries)
        .where(inArray(planEntries.planId, planIds));
      const gesamt = eintraege.length;
      const stattgefunden = eintraege.filter((e) => e.status === "stattgefunden").length;
      const abgesagt = eintraege.filter((e) => e.status === "abgesagt").length;
      const ausgefallen = eintraege.filter((e) => e.status === "ausgefallen").length;
      const quoteProzent =
        gesamt === 0 ? 0 : Math.round(((abgesagt + ausgefallen) / gesamt) * 100);
      return { gesamt, stattgefunden, abgesagt, ausgefallen, quoteProzent };
    }),

  // Hard-Delete inkl. aller Akte-Daten + Dokument-Dateien — nur Admin.
  // Vorher pseudonymisierter Eintrag ins Loeschprotokoll (DSGVO, Art. 17).
  // Rechnungen bleiben erhalten (GoBD!) — der Kunde wird nur gelöscht, wenn
  // keine Rechnungen existieren; sonst Hinweis auf Archivieren.
  loeschen: adminQuery
    .input(z.object({ id: z.number().int(), grund: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const patient = await db.query.customers.findFirst({
        where: eq(customers.id, input.id),
        with: { kontakte: true },
      });
      if (!patient) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Patient nicht gefunden." });
      }

      // GoBD: abgerechnete Belege duerfen nicht geloescht werden
      const [rechnungen] = await db
        .select({ n: count() })
        .from(invoices)
        .where(eq(invoices.customerId, input.id));
      if (rechnungen.n > 0) {
        throw new TRPCError({
          code: "CONFLICT",
          message: `Zu diesem Patienten existieren ${rechnungen.n} Rechnung(en) — GoBD: bitte archivieren statt löschen.`,
        });
      }

      const plaene = await db
        .select({ id: therapyPlans.id })
        .from(therapyPlans)
        .where(eq(therapyPlans.patientId, input.id));
      const planIds = plaene.map((p) => p.id);
      const [termine] =
        planIds.length > 0
          ? await db
              .select({ n: count() })
              .from(planEntries)
              .where(inArray(planEntries.planId, planIds))
          : [{ n: 0 }];
      const [dokumente] = await db
        .select({ n: count() })
        .from(documents)
        .where(eq(documents.patientId, input.id));

      // Kuerzel aus „Nachname, Vorname" (oder einzelnem Namen)
      const teile = patient.name.split(",").map((s) => s.trim());
      const initial = (s: string | undefined) =>
        s ? s[0].toUpperCase() + "." : "";
      const kuerzel = [initial(teile[1]), initial(teile[0])].filter(Boolean).join(" ");

      await db.transaction(async (tx) => {
        await tx.insert(loeschprotokoll).values({
          patientenNr: patient.patientenNr,
          patientKuerzel: kuerzel || "—",
          umfang: `${plaene.length} Pläne, ${termine.n} Termine, ${dokumente.n} Dokumente`,
          grund: input.grund ?? null,
          geloeschtVon: ctx.user.username ?? ctx.user.name ?? `user-${ctx.user.id}`,
        });
        // invoice_therapie_wochen des Patienten freigeben (keine Belege vorhanden)
        await tx
          .delete(invoiceTherapieWochen)
          .where(eq(invoiceTherapieWochen.customerId, input.id));
        // Kaskade erledigt Kontakte, Pläne, Einträge, Dokumente, Timeline
        await tx.delete(customers).where(eq(customers.id, input.id));
      });

      await rm(path.join(env.uploadDir, String(input.id)), {
        recursive: true,
        force: true,
      });
      return { ok: true };
    }),
});
