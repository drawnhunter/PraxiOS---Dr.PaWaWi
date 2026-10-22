// ── PraxiOS: Kostenpläne / HKP (1.25.0) ────────────────────────────────────
// Eigener Bereich (nicht nur Akte-Tab): erstellen, bearbeiten (Entwurf),
// finalisieren, als PDF/DOCX erzeugen, am Patienten ablegen, duplizieren.
// Kein GoBD-Beleg — kein Nummernkreis; Nummer = HKP-<id>-<JJJJ> bei Finalisierung.
import { z } from "zod";
import crypto from "node:crypto";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { TRPCError } from "@trpc/server";
import { desc, eq } from "drizzle-orm";
import { createRouter, rechtQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  companySettings,
  customers,
  documents,
  kostenplaene,
  kostenplanPositionen,
} from "@db/schema";
import { env } from "./lib/env";
import { renderKostenplanPdf, type KostenplanPdfInput } from "./kostenplanPdf";
import { schreibeTimeline } from "./lib/timeline";

const diagnose = z.object({
  code: z.string().trim().min(2).max(10),
  text: z.string().trim().min(1).max(300),
  kurzbegruendung: z.string().trim().max(500).optional(),
});
const position = z.object({
  gruppe: z.string().trim().max(120).optional(),
  leistungId: z.number().int().nullable().optional(),
  bezeichnung: z.string().trim().min(1, "Bezeichnung fehlt").max(500),
  beschreibung: z.string().trim().max(1000).optional(),
  menge: z.string().or(z.number()).default("1"),
  einheit: z.string().trim().max(30).default("Stück"),
  einzelpreis: z.string().or(z.number()),
  ustSatz: z.number().int().min(0).max(19).default(0),
  goaeText: z.string().trim().max(120).optional(),
});

const planInput = z.object({
  patientId: z.number().int(),
  titel: z.string().trim().max(255).default("Kostenvoranschlag"),
  zeitraumVon: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  zeitraumBis: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().optional(),
  diagnosen: z.array(diagnose).max(12).optional(),
  begruendung: z.string().max(6000).optional(),
  klartextNote: z.string().max(2000).optional(),
  positionen: z.array(position).min(1, "Mindestens eine Position").max(80),
});

function isoNachDe(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : null;
}

function zeitraumDe(von: string | null, bis: string | null): string | null {
  const v = isoNachDe(von);
  const b = isoNachDe(bis);
  if (v && b) return `${v}–${b}`;
  return v ?? b;
}

/** Baut das PDF-Input aus Plan + Positionen + Akte + Praxis. */
async function bauePdfInput(planId: number): Promise<KostenplanPdfInput & { patientId: number }> {
  const db = getDb();
  const plan = await db.query.kostenplaene.findFirst({
    where: eq(kostenplaene.id, planId),
    with: { positionen: true, patient: true },
  });
  if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Kostenplan nicht gefunden." });
  const praxis = await db.query.companySettings.findFirst({ where: eq(companySettings.id, 1) });
  if (!praxis) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Bitte zuerst die Praxisdaten hinterlegen (Einstellungen)." });
  }
  const heute = new Date().toLocaleDateString("de-DE");
  return {
    nummer: plan.nummer ?? `Entwurf #${plan.id}`,
    istEntwurf: plan.status === "entwurf",
    datum: plan.status === "finalisiert" && plan.finalizedAt
      ? plan.finalizedAt.toLocaleDateString("de-DE")
      : heute,
    patient: {
      name: plan.patient.name,
      geburtsdatum: isoNachDe(plan.patient.geburtsdatum),
      strasse: plan.patient.strasse,
      plz: plan.patient.plz,
      ort: plan.patient.ort,
    },
    praxis: {
      name: praxis.name,
      strasse: praxis.strasse,
      plz: praxis.plz,
      ort: praxis.ort,
      telefon: praxis.telefon,
      email: praxis.email,
      fachrichtung: praxis.fachrichtung,
    },
    titel: plan.titel,
    zeitraum: zeitraumDe(plan.zeitraumVon, plan.zeitraumBis),
    diagnosen: plan.diagnosenJson ? (JSON.parse(plan.diagnosenJson) as KostenplanPdfInput["diagnosen"]) : undefined,
    begruendung: plan.begruendung,
    positionen: [...plan.positionen].sort((a, b) => a.position - b.position),
    klartextNote: plan.klartextNote,
    patientId: plan.patientId,
  };
}

/** Erzeugt das PDF, legt es als Dokument in der Akte ab (idempotent je Plan). */
async function alsDokumentSpeichern(planId: number, erstelltVon?: number | null) {
  const input = await bauePdfInput(planId);
  const pdfBuf = await renderKostenplanPdf(input);
  const db = getDb();
  const plan = await db.query.kostenplaene.findFirst({ where: eq(kostenplaene.id, planId) });
  if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Kostenplan nicht gefunden." });

  // Bestehendes Dokument ersetzen (gleiche Datei-Position, neue Version)
  const dateiname = `${plan.titel} ${input.nummer}.pdf`.replace(/[\/\\]/g, "-");
  if (plan.documentId) {
    const alt = await db.query.documents.findFirst({ where: eq(documents.id, plan.documentId) });
    if (alt) {
      await writeFile(path.join(env.uploadDir, alt.dateipfad), pdfBuf);
      await db.update(documents).set({ groesse: pdfBuf.length }).where(eq(documents.id, alt.id));
      return { documentId: alt.id, dateiname: alt.dateiname };
    }
  }
  const internerName = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.pdf`;
  const relativerPfad = `${plan.patientId}/${internerName}`;
  mkdirSync(path.join(env.uploadDir, String(plan.patientId)), { recursive: true });
  await writeFile(path.join(env.uploadDir, relativerPfad), pdfBuf);
  const [{ id: documentId }] = await db
    .insert(documents)
    .values({
      patientId: plan.patientId,
      kategorie: "sonstiges",
      dateiname,
      dateipfad: relativerPfad,
      mimeType: "application/pdf",
      groesse: pdfBuf.length,
      uploadedBy: erstelltVon ?? null,
    })
    .$returningId();
  await db.update(kostenplaene).set({ documentId }).where(eq(kostenplaene.id, planId));
  return { documentId, dateiname };
}

export const kostenplanRouter = createRouter({
  liste: rechtQuery("abrechnung")
    .input(z.object({ patientId: z.number().int().optional() }).optional())
    .query(async ({ input }) => {
      const db = getDb();
      const plaene = await db.query.kostenplaene.findMany({
        where: input?.patientId ? eq(kostenplaene.patientId, input.patientId) : undefined,
        orderBy: [desc(kostenplaene.createdAt)],
        with: { patient: { columns: { id: true, name: true } } },
        limit: 100,
      });
      // Register-Anreicherung (1.26.0): Positionsanzahl + Brutto-Summe je Plan
      const ids = plaene.map((p) => p.id);
      const positionen = ids.length
        ? await db.query.kostenplanPositionen.findMany({
            where: (t, { inArray }) => inArray(t.planId, ids),
          })
        : [];
      const agg = new Map<number, { anzahl: number; brutto: number }>();
      for (const pos of positionen) {
        const a = agg.get(pos.planId) ?? { anzahl: 0, brutto: 0 };
        const netto = Number(pos.menge) * Number(pos.einzelpreis);
        a.anzahl += 1;
        a.brutto += netto * (1 + pos.ustSatz / 100);
        agg.set(pos.planId, a);
      }
      return plaene.map((p) => ({
        ...p,
        positionenAnzahl: agg.get(p.id)?.anzahl ?? 0,
        summeBrutto: (agg.get(p.id)?.brutto ?? 0).toFixed(2),
      }));
    }),

  byId: rechtQuery("abrechnung")
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const plan = await getDb().query.kostenplaene.findFirst({
        where: eq(kostenplaene.id, input.id),
        with: { positionen: true, patient: true },
      });
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Kostenplan nicht gefunden." });
      plan.positionen.sort((a, b) => a.position - b.position);
      return plan;
    }),

  erstellen: rechtQuery("abrechnung")
    .input(planInput)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const patient = await db.query.customers.findFirst({ where: eq(customers.id, input.patientId) });
      if (!patient) throw new TRPCError({ code: "NOT_FOUND", message: "Patient nicht gefunden." });
      const id = await db.transaction(async (tx) => {
        const [{ id: neuId }] = await tx
          .insert(kostenplaene)
          .values({
            patientId: input.patientId,
            titel: input.titel,
            zeitraumVon: input.zeitraumVon ?? null,
            zeitraumBis: input.zeitraumBis ?? null,
            diagnosenJson: input.diagnosen?.length ? JSON.stringify(input.diagnosen) : null,
            begruendung: input.begruendung ?? null,
            klartextNote: input.klartextNote ?? null,
            createdBy: ctx.user.id,
          })
          .$returningId();
        await tx.insert(kostenplanPositionen).values(
          input.positionen.map((p, i) => ({
            planId: neuId,
            position: i + 1,
            gruppe: p.gruppe ?? null,
            leistungId: p.leistungId ?? null,
            bezeichnung: p.bezeichnung,
            beschreibung: p.beschreibung ?? null,
            menge: String(p.menge),
            einheit: p.einheit,
            einzelpreis: String(p.einzelpreis),
            ustSatz: p.ustSatz,
            goaeText: p.goaeText ?? null,
          })),
        );
        return neuId;
      });
      await schreibeTimeline({
        patientId: input.patientId,
        typ: "dokument",
        titel: "Kostenplan erstellt (Entwurf)",
        beschreibung: `${input.titel} · ${input.positionen.length} Positionen`,
        createdBy: ctx.user.id,
      });
      return { id };
    }),

  aktualisieren: rechtQuery("abrechnung")
    .input(planInput.partial().extend({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const { id, positionen: neuePositionen, ...felder } = input;
      const db = getDb();
      const plan = await db.query.kostenplaene.findFirst({ where: eq(kostenplaene.id, id) });
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Kostenplan nicht gefunden." });
      if (plan.status !== "entwurf") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nur Entwürfe sind editierbar — finalisierte Pläne bleiben unverändert (duplizieren für eine neue Version)." });
      }
      await db.transaction(async (tx) => {
        await tx.update(kostenplaene).set({
          ...(felder.titel !== undefined ? { titel: felder.titel } : {}),
          ...(felder.zeitraumVon !== undefined ? { zeitraumVon: felder.zeitraumVon } : {}),
          ...(felder.zeitraumBis !== undefined ? { zeitraumBis: felder.zeitraumBis } : {}),
          ...(felder.diagnosen !== undefined ? { diagnosenJson: felder.diagnosen.length ? JSON.stringify(felder.diagnosen) : null } : {}),
          ...(felder.begruendung !== undefined ? { begruendung: felder.begruendung || null } : {}),
          ...(felder.klartextNote !== undefined ? { klartextNote: felder.klartextNote || null } : {}),
        }).where(eq(kostenplaene.id, id));
        if (neuePositionen) {
          await tx.delete(kostenplanPositionen).where(eq(kostenplanPositionen.planId, id));
          await tx.insert(kostenplanPositionen).values(
            neuePositionen.map((p, i) => ({
              planId: id,
              position: i + 1,
              gruppe: p.gruppe ?? null,
              leistungId: p.leistungId ?? null,
              bezeichnung: p.bezeichnung,
              beschreibung: p.beschreibung ?? null,
              menge: String(p.menge),
              einheit: p.einheit,
              einzelpreis: String(p.einzelpreis),
              ustSatz: p.ustSatz,
              goaeText: p.goaeText ?? null,
            })),
          );
        }
      });
      return { ok: true };
    }),

  finalisieren: rechtQuery("abrechnung")
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const plan = await db.query.kostenplaene.findFirst({ where: eq(kostenplaene.id, input.id) });
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Kostenplan nicht gefunden." });
      if (plan.status === "finalisiert") return { ok: true, nummer: plan.nummer };
      const jahr = new Date().getFullYear();
      const nummer = `HKP-${plan.id}-${jahr}`;
      await db
        .update(kostenplaene)
        .set({ status: "finalisiert", finalizedAt: new Date(), nummer })
        .where(eq(kostenplaene.id, input.id));
      // Direkt als PDF in der Akte ablegen
      const ablage = await alsDokumentSpeichern(input.id, ctx.user.id);
      await schreibeTimeline({
        patientId: plan.patientId,
        typ: "dokument",
        titel: `Kostenplan finalisiert: ${nummer}`,
        createdBy: ctx.user.id,
      });
      return { ok: true, nummer, ...ablage };
    }),

  duplizieren: rechtQuery("abrechnung")
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const plan = await db.query.kostenplaene.findFirst({
        where: eq(kostenplaene.id, input.id),
        with: { positionen: true },
      });
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Kostenplan nicht gefunden." });
      const id = await db.transaction(async (tx) => {
        const [{ id: neuId }] = await tx
          .insert(kostenplaene)
          .values({
            patientId: plan.patientId,
            titel: plan.titel,
            zeitraumVon: plan.zeitraumVon,
            zeitraumBis: plan.zeitraumBis,
            diagnosenJson: plan.diagnosenJson,
            begruendung: plan.begruendung,
            klartextNote: plan.klartextNote,
            createdBy: ctx.user.id,
          })
          .$returningId();
        await tx.insert(kostenplanPositionen).values(
          plan.positionen.map((p) => ({
            planId: neuId,
            position: p.position,
            gruppe: p.gruppe,
            leistungId: p.leistungId,
            bezeichnung: p.bezeichnung,
            beschreibung: p.beschreibung,
            menge: p.menge,
            einheit: p.einheit,
            einzelpreis: p.einzelpreis,
            ustSatz: p.ustSatz,
            goaeText: p.goaeText,
          })),
        );
        return neuId;
      });
      return { id };
    }),

  loeschen: rechtQuery("abrechnung")
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const plan = await db.query.kostenplaene.findFirst({ where: eq(kostenplaene.id, input.id) });
      if (!plan) throw new TRPCError({ code: "NOT_FOUND", message: "Kostenplan nicht gefunden." });
      if (plan.status !== "entwurf") {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Nur Entwürfe sind löschbar — finalisierte Pläne bleiben als Dokument bestehen." });
      }
      await db.delete(kostenplaene).where(eq(kostenplaene.id, input.id));
      return { ok: true };
    }),

  pdf: rechtQuery("abrechnung")
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const beleg = await bauePdfInput(input.id);
      const buf = await renderKostenplanPdf(beleg);
      return { dateiname: `${beleg.nummer}.pdf`, base64: buf.toString("base64") };
    }),

  docx: rechtQuery("abrechnung")
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const beleg = await bauePdfInput(input.id);
      const { renderKostenplanDocx } = await import("./kostenplanDocx");
      const buf = await renderKostenplanDocx(beleg);
      return { dateiname: `${beleg.nummer}.docx`, base64: buf.toString("base64") };
    }),

  alsDokument: rechtQuery("abrechnung")
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => alsDokumentSpeichern(input.id, ctx.user.id)),
});
