import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { authedQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";
import { documents } from "@db/schema";
import { env } from "./lib/env";
import { unlink } from "node:fs/promises";
import path from "node:path";

// Nur Metadaten — Upload/Download der Dateien läuft über Hono (siehe boot.ts:
// POST /api/dokumente und GET /api/dokumente/:id/datei).
export const documentRouter = createRouter({
  list: authedQuery
    .input(z.object({ patientId: z.number().int() }))
    .query(async ({ input }) => {
      return getDb().query.documents.findMany({
        where: eq(documents.patientId, input.patientId),
        orderBy: [desc(documents.createdAt)],
        with: { uploader: { columns: { id: true, name: true, username: true } } },
      });
    }),

  byId: authedQuery
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const doc = await getDb().query.documents.findFirst({
        where: eq(documents.id, input.id),
      });
      if (!doc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Dokument nicht gefunden." });
      }
      return doc;
    }),

  update: authedQuery
    .input(
      z.object({
        id: z.number().int(),
        data: z.object({
          kategorie: z
            .enum([
              "befund",
              "arztbrief",
              "rezept",
              "einverstaendnis",
              "anamnesebogen",
              "sonstiges",
            ])
            .optional(),
          notiz: z.string().max(500).nullable().optional(),
          planId: z.number().int().nullable().optional(),
        }),
      }),
    )
    .mutation(async ({ input }) => {
      await getDb()
        .update(documents)
        .set(input.data)
        .where(eq(documents.id, input.id));
      return { ok: true };
    }),

  // Datei von der Platte + DB-Eintrag loeschen
  loeschen: authedQuery
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const doc = await db.query.documents.findFirst({
        where: eq(documents.id, input.id),
      });
      if (!doc) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Dokument nicht gefunden." });
      }
      await unlink(path.join(env.uploadDir, doc.dateipfad)).catch(() => {
        // Datei fehlt bereits — DB-Eintrag trotzdem entfernen
      });
      await db.delete(documents).where(eq(documents.id, input.id));
      return { ok: true };
    }),
});
