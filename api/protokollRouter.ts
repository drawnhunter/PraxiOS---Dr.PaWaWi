// ── PraxiOS: Behandlungsprotokolle ──────────────────────────────────────────
// Block-Baukasten (Text, Tabelle+Diagramm, Skala, Foto, Vital, Ankreuz) mit
// Vorlagen-Verwaltung. 48-h-Fenster: danach gesperrt, Nachträge append-only.
import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { createRouter, rechtQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { customers, loeschprotokoll, protokolle, protokollVorlagen } from "@db/schema";
import {
  strukturOhneWerte,
  protokollGesperrt,
  normalisiereBloecke,
  type ProtokollBlock,
  type ProtokollNachtrag,
} from "@contracts/protokolle";

const blockInput = z.discriminatedUnion("typ", [
  z.object({ id: z.string().max(60), typ: z.literal("text"), titel: z.string().max(255), inhalt: z.string().max(20000) }),
  z.object({
    id: z.string().max(60),
    typ: z.literal("tabelle"),
    titel: z.string().max(255),
    spalten: z.array(z.string().max(100)).min(1).max(12),
    zeilen: z.array(z.array(z.string().max(500)).max(12)).max(200),
    diagramm: z.boolean(),
  }),
  z.object({ id: z.string().max(60), typ: z.literal("skala"), titel: z.string().max(255), wert: z.number().int().min(1).max(10).nullable() }),
  z.object({ id: z.string().max(60), typ: z.literal("foto"), titel: z.string().max(255), dokumentId: z.number().int().nullable() }),
  z.object({
    id: z.string().max(60),
    typ: z.literal("vital"),
    titel: z.string().max(255),
    spalten: z.union([z.literal(2), z.literal(3)]),
    felder: z.array(z.object({ label: z.string().max(255), wert: z.string().max(500) })).max(24),
  }),
  z.object({
    id: z.string().max(60),
    typ: z.literal("ankreuz"),
    titel: z.string().max(255),
    optionen: z.array(z.object({ label: z.string().max(255), gewaehlt: z.boolean() })).max(60),
  }),
]);

const parseBloecke = (json: string): ProtokollBlock[] => {
  try {
    // normalisiereBloecke wandelt das 1.4.0-Altformat (festes werte-Objekt)
    // in das freie Felder-Format um
    return normalisiereBloecke(JSON.parse(json) as ProtokollBlock[]);
  } catch {
    return [];
  }
};

const parseNachtraege = (json: string | null): ProtokollNachtrag[] => {
  if (!json) return [];
  try {
    return JSON.parse(json) as ProtokollNachtrag[];
  } catch {
    return [];
  }
};

export const protokollRouter = createRouter({
  // ── Vorlagen-Verwaltung ──────────────────────────────────────────────────
  vorlagen: rechtQuery("plaene").query(async () => {
    const rows = await getDb().query.protokollVorlagen.findMany({
      orderBy: [desc(protokollVorlagen.updatedAt)],
      with: { ersteller: { columns: { id: true, name: true, username: true } } },
    });
    return rows.map((v) => ({ ...v, bloecke: parseBloecke(v.schemaJson) }));
  }),

  vorlageSpeichern: rechtQuery("plaene")
    .input(
      z.object({
        id: z.number().int().optional(),
        titel: z.string().trim().min(1).max(255),
        beschreibung: z.string().max(2000).nullable().optional(),
        bloecke: z.array(blockInput).max(60),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const struktur = strukturOhneWerte(input.bloecke as ProtokollBlock[]);
      if (input.id) {
        await db
          .update(protokollVorlagen)
          .set({
            titel: input.titel,
            beschreibung: input.beschreibung ?? null,
            schemaJson: JSON.stringify(struktur),
          })
          .where(eq(protokollVorlagen.id, input.id));
        return { id: input.id };
      }
      const [{ id }] = await db
        .insert(protokollVorlagen)
        .values({
          titel: input.titel,
          beschreibung: input.beschreibung ?? null,
          schemaJson: JSON.stringify(struktur),
          createdBy: ctx.user.id,
        })
        .$returningId();
      return { id };
    }),

  vorlageLoeschen: rechtQuery("plaene")
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      await getDb().delete(protokollVorlagen).where(eq(protokollVorlagen.id, input.id));
      return { ok: true };
    }),

  // ── Protokolle ───────────────────────────────────────────────────────────
  liste: rechtQuery("plaene")
    .input(z.object({ patientId: z.number().int() }))
    .query(async ({ input }) => {
      const rows = await getDb().query.protokolle.findMany({
        where: eq(protokolle.patientId, input.patientId),
        orderBy: [desc(protokolle.createdAt)],
        with: {
          ersteller: { columns: { id: true, name: true, username: true } },
          vorlage: { columns: { id: true, titel: true } },
        },
      });
      return rows.map((p) => ({ ...p, gesperrt: protokollGesperrt(p.createdAt) }));
    }),

  letzte: rechtQuery("plaene")
    .input(z.object({ limit: z.number().int().min(1).max(50).default(15) }).optional())
    .query(async ({ input }) => {
      const rows = await getDb().query.protokolle.findMany({
        orderBy: [desc(protokolle.createdAt)],
        limit: input?.limit ?? 15,
        with: {
          patient: { columns: { id: true, name: true } },
          ersteller: { columns: { id: true, name: true, username: true } },
        },
      });
      return rows.map((p) => ({ ...p, gesperrt: protokollGesperrt(p.createdAt) }));
    }),

  byId: rechtQuery("plaene")
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const p = await getDb().query.protokolle.findFirst({
        where: eq(protokolle.id, input.id),
        with: {
          patient: { columns: { id: true, name: true } },
          ersteller: { columns: { id: true, name: true, username: true } },
          vorlage: { columns: { id: true, titel: true } },
        },
      });
      if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Protokoll nicht gefunden." });
      return {
        ...p,
        bloecke: parseBloecke(p.schemaJson),
        nachtraegeListe: parseNachtraege(p.nachtraege),
        gesperrt: protokollGesperrt(p.createdAt),
      };
    }),

  erstellen: rechtQuery("plaene")
    .input(
      z.object({
        patientId: z.number().int(),
        titel: z.string().trim().min(1).max(255),
        vorlageId: z.number().int().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const patient = await db.query.customers.findFirst({
        where: eq(customers.id, input.patientId),
        columns: { id: true },
      });
      if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Patient nicht gefunden." });

      let bloecke: ProtokollBlock[] = [];
      if (input.vorlageId) {
        const vorlage = await db.query.protokollVorlagen.findFirst({
          where: eq(protokollVorlagen.id, input.vorlageId),
        });
        if (!vorlage) throw new TRPCError({ code: "NOT_FOUND", message: "Vorlage nicht gefunden." });
        bloecke = strukturOhneWerte(parseBloecke(vorlage.schemaJson));
      }

      const [{ id }] = await db
        .insert(protokolle)
        .values({
          patientId: input.patientId,
          vorlageId: input.vorlageId ?? null,
          titel: input.titel,
          schemaJson: JSON.stringify(bloecke),
          createdBy: ctx.user.id,
        })
        .$returningId();
      return { id };
    }),

  aktualisieren: rechtQuery("plaene")
    .input(
      z.object({
        id: z.number().int(),
        titel: z.string().trim().min(1).max(255),
        bloecke: z.array(blockInput).max(60),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const p = await db.query.protokolle.findFirst({
        where: eq(protokolle.id, input.id),
      });
      if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Protokoll nicht gefunden." });
      if (protokollGesperrt(p.createdAt)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message:
            "Das Protokoll ist älter als 48 h und gesperrt (medizinische Dokumentation) — bitte einen Nachtrag hinzufügen.",
        });
      }
      await db
        .update(protokolle)
        .set({ titel: input.titel, schemaJson: JSON.stringify(input.bloecke) })
        .where(eq(protokolle.id, input.id));
      return { ok: true };
    }),

  nachtrag: rechtQuery("plaene")
    .input(z.object({ id: z.number().int(), text: z.string().trim().min(1).max(5000) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const p = await db.query.protokolle.findFirst({
        where: eq(protokolle.id, input.id),
      });
      if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Protokoll nicht gefunden." });
      const liste = parseNachtraege(p.nachtraege);
      liste.push({
        text: input.text,
        autorId: ctx.user.id,
        autorName: ctx.user.name || ctx.user.username || "—",
        createdAt: new Date().toISOString(),
      });
      await db
        .update(protokolle)
        .set({ nachtraege: JSON.stringify(liste) })
        .where(eq(protokolle.id, input.id));
      return { ok: true };
    }),

  loeschen: rechtQuery("plaene")
    .input(z.object({ id: z.number().int(), grund: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const p = await db.query.protokolle.findFirst({
        where: eq(protokolle.id, input.id),
        with: { patient: { columns: { id: true, name: true, patientenNr: true } } },
      });
      if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Protokoll nicht gefunden." });
      if (protokollGesperrt(p.createdAt)) {
        throw new TRPCError({
          code: "FORBIDDEN",
          message: "Gesperrte Protokolle (älter als 48 h) können nicht gelöscht werden.",
        });
      }
      await db.delete(protokolle).where(eq(protokolle.id, input.id));
      await db.insert(loeschprotokoll).values({
        patientenNr: p.patient?.patientenNr ?? null,
        patientKuerzel: p.patient?.name?.slice(0, 20) ?? null,
        umfang: `Behandlungsprotokoll #${p.id} „${p.titel}"`,
        grund: input.grund ?? "Löschung innerhalb des 48-h-Fensters",
        geloeschtVon: ctx.user.name || ctx.user.username || `#${ctx.user.id}`,
      });
      return { ok: true };
    }),
});
