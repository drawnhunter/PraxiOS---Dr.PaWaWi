// ── PraxiOS: Anamnesebögen (Creator, Magic-Links, öffentliche Abgabe) ──────
import { z } from "zod";
import crypto from "node:crypto";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import QRCode from "qrcode";
import { desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  createRouter,
  publicQuery,
  rechtQuery,
} from "./middleware";
import { getDb } from "./queries/connection";
import {
  anamnesisBlocks,
  anamnesisForms,
  anamnesisLinks,
  anamnesisSubmissions,
  companySettings,
  customers,
  documents,
} from "@db/schema";
import {
  BLOCK_TYPEN,
  KOPFBOGEN_FELDER,
  type FormBlock,
  type OeffentlicherBogen,
  type SubmissionDaten,
} from "@contracts/anamnese";
import { renderBogenPdf } from "./anamnesePdf";
import { schreibeTimeline } from "./lib/timeline";
import { env } from "./lib/env";
import { normBasis as norm } from "./therapyPlan";

const blockConfigInput = z.object({
  fragen: z.array(z.string().trim().min(1)).max(60).optional(),
  spalten: z.union([z.literal(1), z.literal(2)]).optional(),
  frage: z.string().trim().max(500).optional(),
  zeilen: z.number().int().min(1).max(20).optional(),
  vonLabel: z.string().trim().max(100).optional(),
  bisLabel: z.string().trim().max(100).optional(),
});

const formBlockInput = z.object({
  blockId: z.number().int().optional(),
  typ: z.enum(BLOCK_TYPEN),
  titel: z.string().trim().min(1).max(255),
  config: blockConfigInput,
});

const formInput = z.object({
  titel: z.string().trim().min(1).max(255),
  beschreibung: z.string().max(2000).nullable().optional(),
  schemaJson: z.array(formBlockInput).min(1, "Mindestens ein Block").max(80),
});

const blockInput = z.object({
  typ: z.enum(BLOCK_TYPEN),
  titel: z.string().trim().min(1).max(255),
  config: blockConfigInput,
});

function parseBlocks(form: { schemaJson: string }): FormBlock[] {
  try {
    return JSON.parse(form.schemaJson) as FormBlock[];
  } catch {
    return [];
  }
}

const fmtDe = (d: Date) =>
  `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;

// ── Patient finden/anlegen (exportiert für Tests) ───────────────────────────
export function patientZuordnen(
  kundenListe: (typeof customers.$inferSelect)[],
  kopf: { nachname: string; vorname: string; geburtsdatum: string | null },
): (typeof customers.$inferSelect) | null {
  const voll = norm(`${kopf.nachname}, ${kopf.vorname}`);
  const exakt = kundenListe.find((k) => norm(k.name) === voll);
  if (exakt) return exakt;
  // Gleicher Nachname + gleiches Geburtsdatum = sehr sicher dieselbe Person
  if (kopf.geburtsdatum) {
    const nn = norm(kopf.nachname);
    const treffer = kundenListe.filter(
      (k) => norm(k.name.split(",")[0]) === nn && k.geburtsdatum === kopf.geburtsdatum,
    );
    if (treffer.length === 1) return treffer[0];
  }
  return null;
}

export const anamneseRouter = createRouter({
  // ── Block-Katalog ─────────────────────────────────────────────────────────
  bloecke: rechtQuery("anamnese").query(async () => {
    return getDb().query.anamnesisBlocks.findMany({
      orderBy: [desc(anamnesisBlocks.createdAt)],
    });
  }),

  blockAnlegen: rechtQuery("anamnese").input(blockInput).mutation(async ({ ctx, input }) => {
    const [{ id }] = await getDb()
      .insert(anamnesisBlocks)
      .values({ ...input, config: JSON.stringify(input.config), createdBy: ctx.user.id })
      .$returningId();
    return { id };
  }),

  // ── Bögen ─────────────────────────────────────────────────────────────────
  liste: rechtQuery("anamnese").query(async () => {
    return getDb().query.anamnesisForms.findMany({
      orderBy: [desc(anamnesisForms.createdAt)],
      with: { links: true },
    });
  }),

  byId: rechtQuery("anamnese").input(z.object({ id: z.number().int() })).query(async ({ input }) => {
    const form = await getDb().query.anamnesisForms.findFirst({
      where: eq(anamnesisForms.id, input.id),
      with: { links: { orderBy: [desc(anamnesisLinks.createdAt)] } },
    });
    if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "Bogen nicht gefunden." });
    return { ...form, bloecke: parseBlocks(form) };
  }),

  create: rechtQuery("anamnese").input(formInput).mutation(async ({ ctx, input }) => {
    const [{ id }] = await getDb()
      .insert(anamnesisForms)
      .values({
        titel: input.titel,
        beschreibung: input.beschreibung ?? null,
        schemaJson: JSON.stringify(input.schemaJson),
        createdBy: ctx.user.id,
      })
      .$returningId();
    return { id };
  }),

  update: rechtQuery("anamnese")
    .input(z.object({ id: z.number().int(), data: formInput.partial() }))
    .mutation(async ({ input }) => {
      const { schemaJson, ...rest } = input.data;
      const data: Partial<typeof anamnesisForms.$inferInsert> = { ...rest };
      if (schemaJson) data.schemaJson = JSON.stringify(schemaJson);
      await getDb()
        .update(anamnesisForms)
        .set(data)
        .where(eq(anamnesisForms.id, input.id));
      return { ok: true };
    }),

  setAktiv: rechtQuery("anamnese")
    .input(z.object({ id: z.number().int(), aktiv: z.boolean() }))
    .mutation(async ({ input }) => {
      await getDb()
        .update(anamnesisForms)
        .set({ aktiv: input.aktiv })
        .where(eq(anamnesisForms.id, input.id));
      return { ok: true };
    }),

  loeschen: rechtQuery("anamnese")
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      await getDb().delete(anamnesisForms).where(eq(anamnesisForms.id, input.id));
      return { ok: true };
    }),

  // ── Leerer Bogen als PDF (Base64, zum Drucken/Verschicken) ────────────────
  leerPdf: rechtQuery("anamnese").input(z.object({ id: z.number().int() })).query(async ({ input }) => {
    const db = getDb();
    const form = await db.query.anamnesisForms.findFirst({
      where: eq(anamnesisForms.id, input.id),
    });
    if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "Bogen nicht gefunden." });
    const praxis = await db.query.companySettings.findFirst({
      where: eq(companySettings.id, 1),
    });
    const pdf = await renderBogenPdf({
      formTitel: form.titel,
      beschreibung: form.beschreibung,
      bloecke: parseBlocks(form),
      praxisName: praxis?.name ?? null,
    });
    return {
      dateiname: `${form.titel.replace(/[^\wäöüÄÖÜß-]+/g, "_")} (leer).pdf`,
      base64: pdf.toString("base64"),
    };
  }),

  // ── Magic-Links ───────────────────────────────────────────────────────────
  linkErstellen: rechtQuery("anamnese")
    .input(
      z.object({
        formId: z.number().int(),
        patientId: z.number().int().nullable().optional(),
        notiz: z.string().trim().max(255).nullable().optional(),
        tageGueltig: z.number().int().min(1).max(30).default(3),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const form = await db.query.anamnesisForms.findFirst({
        where: eq(anamnesisForms.id, input.formId),
      });
      if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "Bogen nicht gefunden." });
      const token = crypto.randomBytes(24).toString("base64url");
      const ab = new Date();
      ab.setDate(ab.getDate() + input.tageGueltig);
      const [{ id }] = await db
        .insert(anamnesisLinks)
        .values({
          formId: input.formId,
          patientId: input.patientId ?? null,
          token,
          notiz: input.notiz ?? null,
          laeuftAbAm: ab,
          createdBy: ctx.user.id,
        })
        .$returningId();
      return { id, token };
    }),

  qr: rechtQuery("anamnese")
    .input(z.object({ text: z.string().min(1).max(2000) }))
    .query(async ({ input }) => {
      const dataUrl = await QRCode.toDataURL(input.text, {
        margin: 1,
        width: 320,
        color: { dark: "#0B4F4A", light: "#ffffff" },
      });
      return { dataUrl };
    }),

  // ── Öffentlich (ohne Login): Bogen abrufen + einreichen ───────────────────
  bogenByToken: publicQuery
    .input(z.object({ token: z.string().min(10) }))
    .query(async ({ input }): Promise<OeffentlicherBogen> => {
      const db = getDb();
      const link = await db.query.anamnesisLinks.findFirst({
        where: eq(anamnesisLinks.token, input.token),
      });
      if (!link) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Dieser Link ist ungültig." });
      }
      let status = link.status;
      if (status === "offen" && link.laeuftAbAm < new Date()) {
        await db
          .update(anamnesisLinks)
          .set({ status: "abgelaufen" })
          .where(eq(anamnesisLinks.id, link.id));
        status = "abgelaufen";
      }
      const form = await db.query.anamnesisForms.findFirst({
        where: eq(anamnesisForms.id, link.formId),
      });
      if (!form) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Bogen nicht gefunden." });
      }
      const praxis = await db.query.companySettings.findFirst({
        where: eq(companySettings.id, 1),
      });

      let vorbefuellung: OeffentlicherBogen["vorbefuellung"] = null;
      if (link.patientId) {
        const p = await db.query.customers.findFirst({
          where: eq(customers.id, link.patientId),
        });
        if (p) {
          const komma = p.name.indexOf(",");
          vorbefuellung = {
            nachname: komma >= 0 ? p.name.slice(0, komma).trim() : p.name,
            vorname: komma >= 0 ? p.name.slice(komma + 1).trim() : "",
            geburtsdatum: p.geburtsdatum ?? undefined,
            strasse: p.strasse || undefined,
            plz: p.plz || undefined,
            ort: p.ort || undefined,
            telefon: p.telefon ?? undefined,
            email: p.email ?? undefined,
            krankenkasse: p.krankenkasse ?? undefined,
          };
        }
      }

      return {
        formTitel: form.titel,
        formBeschreibung: form.beschreibung,
        bloecke: parseBlocks(form),
        praxisName: praxis?.name ?? null,
        vorbefuellung,
        linkStatus: status,
        eingereichtAm: link.eingereichtAm?.toISOString() ?? null,
      };
    }),

  einreichen: publicQuery
    .input(
      z.object({
        token: z.string().min(10),
        kopfbogen: z.record(z.string(), z.string().max(300)),
        antworten: z.array(
          z.object({
            titel: z.string().max(255),
            typ: z.enum(BLOCK_TYPEN),
            wert: z.union([
              z.array(z.string().max(300)),
              z.string().max(5000),
              z.number().int().min(1).max(10),
              z.record(z.string(), z.string().max(50)),
            ]),
          }),
        ).max(80),
        unterschriftName: z.string().trim().min(2).max(255),
        datenschutzZugestimmt: z.literal(true),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const link = await db.query.anamnesisLinks.findFirst({
        where: eq(anamnesisLinks.token, input.token),
      });
      if (!link) throw new TRPCError({ code: "NOT_FOUND", message: "Dieser Link ist ungültig." });
      if (link.status === "eingereicht") {
        throw new TRPCError({ code: "CONFLICT", message: "Dieser Bogen wurde bereits eingereicht." });
      }
      if (link.status === "abgelaufen" || link.laeuftAbAm < new Date()) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Dieser Link ist abgelaufen. Bitte wenden Sie sich an die Praxis." });
      }
      const form = await db.query.anamnesisForms.findFirst({
        where: eq(anamnesisForms.id, link.formId),
      });
      if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "Bogen nicht gefunden." });

      // Pflicht-Kopfbogen validieren
      const kopf = input.kopfbogen;
      const fehlend = KOPFBOGEN_FELDER.filter((f) => f.pflicht && !(kopf[f.key] ?? "").trim());
      if (fehlend.length > 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Pflichtfelder fehlen: ${fehlend.map((f) => f.label).join(", ")}`,
        });
      }
      const gebRoh = (kopf.geburtsdatum ?? "").trim();
      const gebIso = /^\d{4}-\d{2}-\d{2}$/.test(gebRoh)
        ? gebRoh
        : (() => {
            const m = gebRoh.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
            return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : null;
          })();

      // Patient zuordnen: Link-Patient > Name/DOB-Match > Neuanlage
      let patient: typeof customers.$inferSelect | null | undefined = null;
      if (link.patientId) {
        patient = await db.query.customers.findFirst({ where: eq(customers.id, link.patientId) });
      }
      if (!patient) {
        const alle = await db.query.customers.findMany({
          where: eq(customers.archiviert, false),
        });
        patient = patientZuordnen(alle, {
          nachname: kopf.nachname!.trim(),
          vorname: kopf.vorname!.trim(),
          geburtsdatum: gebIso,
        });
      }

      const name = `${kopf.nachname!.trim()}, ${kopf.vorname!.trim()}`;
      if (!patient) {
        const [res] = await db
          .insert(customers)
          .values({
            name,
            strasse: kopf.strasse!.trim(),
            plz: kopf.plz!.trim(),
            ort: kopf.ort!.trim(),
            land: "Deutschland",
            telefon: (kopf.telefon ?? "").trim() || null,
            email: (kopf.email ?? "").trim() || null,
            geburtsdatum: gebIso,
            krankenkasse: (kopf.krankenkasse ?? "").trim() || null,
            notizen: `Angelegt durch Anamnesebogen „${form.titel}“ (online)`,
          })
          .$returningId();
        patient = await db.query.customers.findFirst({ where: eq(customers.id, res.id) });
      } else {
        // Nur Lücken ergänzen, nie überschreiben
        const patch: Partial<typeof customers.$inferInsert> = {};
        if (!patient.strasse && kopf.strasse?.trim()) patch.strasse = kopf.strasse.trim();
        if (!patient.plz && kopf.plz?.trim()) patch.plz = kopf.plz.trim();
        if (!patient.ort && kopf.ort?.trim()) patch.ort = kopf.ort.trim();
        if (!patient.geburtsdatum && gebIso) patch.geburtsdatum = gebIso;
        if (!patient.telefon && kopf.telefon?.trim()) patch.telefon = kopf.telefon.trim();
        if (!patient.email && kopf.email?.trim()) patch.email = kopf.email.trim();
        if (!patient.krankenkasse && kopf.krankenkasse?.trim()) patch.krankenkasse = kopf.krankenkasse.trim();
        if (Object.keys(patch).length > 0) {
          await db.update(customers).set(patch).where(eq(customers.id, patient.id));
          patient = { ...patient, ...patch } as typeof patient;
        }
      }
      if (!patient) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Patient konnte nicht angelegt werden." });

      const daten: SubmissionDaten = {
        kopfbogen: { ...input.kopfbogen, geburtsdatum: gebIso ?? input.kopfbogen.geburtsdatum },
        antworten: input.antworten as SubmissionDaten["antworten"],
      };

      // Ausgefüllten Bogen als PDF erzeugen + ablegen
      const praxis = await db.query.companySettings.findFirst({
        where: eq(companySettings.id, 1),
      });
      const pdf = await renderBogenPdf({
        formTitel: form.titel,
        beschreibung: form.beschreibung,
        bloecke: parseBlocks(form),
        praxisName: praxis?.name ?? null,
        kopfbogen: daten.kopfbogen,
        antworten: daten.antworten,
        unterschriftName: input.unterschriftName,
        datum: fmtDe(new Date()),
      });
      const zielVerzeichnis = path.join(env.uploadDir, String(patient.id));
      mkdirSync(zielVerzeichnis, { recursive: true });
      const dateiname = `${form.titel.replace(/[^\wäöüÄÖÜß-]+/g, "_")}_${patient.name.split(",")[0].trim()}_${fmtDe(new Date()).replace(/\./g, "-")}.pdf`;
      const dateipfad = `${patient.id}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}.pdf`;
      await writeFile(path.join(env.uploadDir, dateipfad), pdf);

      const ergebnis = await db.transaction(async (tx) => {
        const [doc] = await tx
          .insert(documents)
          .values({
            patientId: patient!.id,
            kategorie: "anamnesebogen",
            dateiname,
            dateipfad,
            mimeType: "application/pdf",
            groesse: pdf.length,
            notiz: `Anamnesebogen online eingereicht (${input.unterschriftName})`,
          })
          .$returningId();
        const [sub] = await tx
          .insert(anamnesisSubmissions)
          .values({
            linkId: link.id,
            formId: form.id,
            patientId: patient!.id,
            daten: JSON.stringify(daten),
            unterschriftName: input.unterschriftName,
            datenschutzZugestimmt: true,
            documentId: doc.id,
          })
          .$returningId();
        await tx
          .update(anamnesisLinks)
          .set({ status: "eingereicht", eingereichtAm: new Date() })
          .where(eq(anamnesisLinks.id, link.id));
        return { submissionId: sub.id };
      });

      await schreibeTimeline({
        patientId: patient.id,
        typ: "dokument",
        titel: `Anamnesebogen online eingereicht: ${form.titel}`,
        beschreibung: `Bestätigt durch ${input.unterschriftName}`,
      });

      return { ok: true, ...ergebnis };
    }),
});
