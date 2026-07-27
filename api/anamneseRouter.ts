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
  HAEUFIGKEIT_STUFEN,
  KOPFBOGEN_FELDER,
  SPRACHEN,
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

/** Basis-Bogen (unübersetzt, deutsch) für den öffentlichen Zugang laden. */
async function ladeOeffentlichenBogen(token: string): Promise<OeffentlicherBogen> {
  const db = getDb();
  const link = await db.query.anamnesisLinks.findFirst({
    where: eq(anamnesisLinks.token, token),
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
    sprache: "de",
  };
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
  /** Verfügbare Sprachen für die Auswahl im öffentlichen Bogen. */
  sprachen: publicQuery.query(async () => {
    const { translateVerfuegbar } = await import("./lib/translate");
    return { sprachen: SPRACHEN, mtVerfuegbar: await translateVerfuegbar() };
  }),

  /** Bogen in einer Zielsprache (übersetzt via LibreTranslate, gecacht). */
  bogenInSprache: publicQuery
    .input(z.object({ token: z.string().min(10), sprache: z.string().length(2) }))
    .query(async ({ input }): Promise<OeffentlicherBogen> => {
      const db = getDb();
      const link = await db.query.anamnesisLinks.findFirst({
        where: eq(anamnesisLinks.token, input.token),
      });
      if (!link) throw new TRPCError({ code: "NOT_FOUND", message: "Dieser Link ist ungültig." });
      const form = await db.query.anamnesisForms.findFirst({
        where: eq(anamnesisForms.id, link.formId),
      });
      if (!form) throw new TRPCError({ code: "NOT_FOUND", message: "Bogen nicht gefunden." });

      const basis = await ladeOeffentlichenBogen(input.token);
      if (input.sprache === "de") return { ...basis, sprache: "de" };

      // Alle übersetzbaren Texte sammeln (Titel, Fragen, Beschreibung, Labels)
      const texte: string[] = [basis.formTitel];
      if (basis.formBeschreibung) texte.push(basis.formBeschreibung);
      const kopfLabels = KOPFBOGEN_FELDER.map((f) => f.label);
      texte.push(...kopfLabels);
      for (const b of basis.bloecke) {
        texte.push(b.titel);
        for (const f of b.config.fragen ?? []) texte.push(f);
        if (b.config.frage) texte.push(b.config.frage);
        if (b.config.vonLabel) texte.push(b.config.vonLabel);
        if (b.config.bisLabel) texte.push(b.config.bisLabel);
      }
      texte.push(...HAEUFIGKEIT_STUFEN);

      const { uebersetzeBatch } = await import("./lib/translate");
      const ue = await uebersetzeBatch(texte, input.sprache, "de");
      const m = new Map(texte.map((t, i) => [t, ue[i]]));

      let i = 0;
      const naechste = () => ue[i++];
      const t = (orig: string) => m.get(orig) ?? orig;
      const formTitel = naechste();
      const formBeschreibung = basis.formBeschreibung ? naechste() : null;
      const kopfbogenLabels: OeffentlicherBogen["kopfbogenLabels"] = {};
      for (const feld of KOPFBOGEN_FELDER) kopfbogenLabels[feld.key] = t(feld.label);

      const rueckMap: Record<string, string> = {};
      for (const [orig, ziel] of m) if (orig !== ziel) rueckMap[ziel] = orig;

      const bloecke = basis.bloecke.map((b) => ({
        ...b,
        titel: t(b.titel),
        config: {
          ...b.config,
          fragen: b.config.fragen?.map((f) => t(f)),
          frage: b.config.frage ? t(b.config.frage) : undefined,
          vonLabel: b.config.vonLabel ? t(b.config.vonLabel) : undefined,
          bisLabel: b.config.bisLabel ? t(b.config.bisLabel) : undefined,
        },
      }));
      const haeufigkeitStufen = HAEUFIGKEIT_STUFEN.map((s) => t(s));

      return {
        ...basis,
        formTitel,
        formBeschreibung,
        bloecke,
        kopfbogenLabels,
        haeufigkeitStufen,
        rueckMap,
        sprache: input.sprache,
      };
    }),

  bogenByToken: publicQuery
    .input(z.object({ token: z.string().min(10) }))
    .query(async ({ input }): Promise<OeffentlicherBogen> => {
      const basis = await ladeOeffentlichenBogen(input.token);
      return { ...basis, sprache: "de" };
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
        sprache: z.string().length(2).default("de"),
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

      const praxis = await db.query.companySettings.findFirst({
        where: eq(companySettings.id, 1),
      });
      const formBloecke = parseBlocks(form);
      const zielVerzeichnis = path.join(env.uploadDir, String(patient.id));
      mkdirSync(zielVerzeichnis, { recursive: true });
      const sprachName = SPRACHEN.find((s) => s.code === input.sprache)?.name ?? input.sprache;

      // ── Deutsche Arbeitsversion (datenDe + PDF) ─────────────────────────
      let datenDe: SubmissionDaten = daten;
      if (input.sprache !== "de") {
        datenDe = await rueckUebersetzeAntworten(formBloecke, daten, input.sprache);
      }
      const pdfDe = await renderBogenPdf({
        formTitel: form.titel,
        beschreibung: form.beschreibung,
        bloecke: formBloecke,
        praxisName: praxis?.name ?? null,
        kopfbogen: datenDe.kopfbogen,
        antworten: datenDe.antworten,
        unterschriftName: input.unterschriftName,
        datum: fmtDe(new Date()),
      });
      const dateinameDe = `${form.titel.replace(/[^\wäöüÄÖÜß-]+/g, "_")}_${patient.name.split(",")[0].trim()}_${fmtDe(new Date()).replace(/\./g, "-")}${input.sprache !== "de" ? "_DE-Uebersetzung" : ""}.pdf`;
      const dateipfadDe = `${patient.id}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}.pdf`;
      await writeFile(path.join(env.uploadDir, dateipfadDe), pdfDe);

      // ── Original-PDF in Patientensprache (bei sprache != de) ────────────
      let pdfOriginal: Buffer | null = null;
      let dateinameOriginal: string | null = null;
      let dateipfadOriginal: string | null = null;
      if (input.sprache !== "de") {
        const ue = await uebersetzeForm(form, input.sprache);
        pdfOriginal = await renderBogenPdf({
          formTitel: ue.formTitel,
          beschreibung: ue.formBeschreibung,
          bloecke: ue.bloecke,
          praxisName: praxis?.name ?? null,
          kopfbogen: daten.kopfbogen,
          antworten: daten.antworten,
          unterschriftName: input.unterschriftName,
          datum: fmtDe(new Date()),
          kopfbogenLabels: ue.kopfbogenLabels,
          haeufigkeitStufen: ue.haeufigkeitStufen,
        });
        dateinameOriginal = `${form.titel.replace(/[^\wäöüÄÖÜß-]+/g, "_")}_${patient.name.split(",")[0].trim()}_${fmtDe(new Date()).replace(/\./g, "-")}_Original-${input.sprache.toUpperCase()}.pdf`;
        dateipfadOriginal = `${patient.id}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}.pdf`;
        await writeFile(path.join(env.uploadDir, dateipfadOriginal), pdfOriginal);
      }

      const ergebnis = await db.transaction(async (tx) => {
        const [doc] = await tx
          .insert(documents)
          .values({
            patientId: patient!.id,
            kategorie: "anamnesebogen",
            dateiname: dateinameDe,
            dateipfad: dateipfadDe,
            mimeType: "application/pdf",
            groesse: pdfDe.length,
            notiz: `Anamnesebogen online eingereicht (${input.unterschriftName})${input.sprache !== "de" ? ` — deutsche Übersetzung aus ${sprachName}` : ""}`,
          })
          .$returningId();
        if (pdfOriginal && dateinameOriginal && dateipfadOriginal) {
          await tx.insert(documents).values({
            patientId: patient!.id,
            kategorie: "anamnesebogen",
            dateiname: dateinameOriginal,
            dateipfad: dateipfadOriginal,
            mimeType: "application/pdf",
            groesse: pdfOriginal.length,
            notiz: `Anamnesebogen online eingereicht (${input.unterschriftName}) — Original (${sprachName})`,
          });
        }
        const [sub] = await tx
          .insert(anamnesisSubmissions)
          .values({
            linkId: link.id,
            formId: form.id,
            patientId: patient!.id,
            sprache: input.sprache,
            daten: JSON.stringify(daten),
            datenDe: input.sprache !== "de" ? JSON.stringify(datenDe) : null,
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
        beschreibung: `Bestätigt durch ${input.unterschriftName}${input.sprache !== "de" ? ` · Sprache: ${sprachName}` : ""}`,
      });

      return { ok: true, ...ergebnis };
    }),
});

// ── Übersetzungs-Helfer (Form-Texte + Rückübersetzung kategorialer Antworten) ─
async function uebersetzeForm(form: { titel: string; beschreibung: string | null; schemaJson: string }, sprache: string) {
  const bloecke = parseBlocks(form);
  const texte: string[] = [form.titel];
  if (form.beschreibung) texte.push(form.beschreibung);
  const kopfLabels = KOPFBOGEN_FELDER.map((f) => f.label);
  texte.push(...kopfLabels);
  for (const b of bloecke) {
    texte.push(b.titel);
    for (const f of b.config.fragen ?? []) texte.push(f);
    if (b.config.frage) texte.push(b.config.frage);
    if (b.config.vonLabel) texte.push(b.config.vonLabel);
    if (b.config.bisLabel) texte.push(b.config.bisLabel);
  }
  texte.push(...HAEUFIGKEIT_STUFEN);
  const { uebersetzeBatch } = await import("./lib/translate");
  const ue = await uebersetzeBatch(texte, sprache, "de");
  const m = new Map(texte.map((t, i) => [t, ue[i]]));
  const t = (orig: string) => m.get(orig) ?? orig;

  let i = 0;
  const naechste = () => ue[i++];
  const formTitel = naechste();
  const formBeschreibung = form.beschreibung ? naechste() : null;
  const kopfbogenLabels: OeffentlicherBogen["kopfbogenLabels"] = {};
  for (const feld of KOPFBOGEN_FELDER) kopfbogenLabels[feld.key] = t(feld.label);
  return {
    formTitel,
    formBeschreibung,
    bloecke: bloecke.map((b) => ({
      ...b,
      titel: t(b.titel),
      config: {
        ...b.config,
        fragen: b.config.fragen?.map((f) => t(f)),
        frage: b.config.frage ? t(b.config.frage) : undefined,
        vonLabel: b.config.vonLabel ? t(b.config.vonLabel) : undefined,
        bisLabel: b.config.bisLabel ? t(b.config.bisLabel) : undefined,
      },
    })),
    kopfbogenLabels,
    haeufigkeitStufen: HAEUFIGKEIT_STUFEN.map((s) => t(s)),
    rueckMap: new Map([...m].filter(([o, z]) => o !== z).map(([o, z]) => [z, o] as [string, string])),
  };
}

/** Antworten aus Patientensprache zurück ins Deutsche mappen (kategorial via
 * Rueckwärts-Map, Freitext via MT). */
export async function rueckUebersetzeAntworten(
  formBloecke: FormBlock[],
  daten: SubmissionDaten,
  sprache: string,
): Promise<SubmissionDaten> {
  const ue = await uebersetzeForm(
    { titel: "x", beschreibung: null, schemaJson: JSON.stringify(formBloecke) },
    sprache,
  );
  const rueck = ue.rueckMap;
  const { uebersetzeBatch } = await import("./lib/translate");

  const freitexte: { i: number; text: string }[] = [];
  const antworten = daten.antworten.map((a, i) => {
    const block = formBloecke[i];
    const titelDe = block?.titel ?? a.titel;
    if (a.typ === "checkboxen" && Array.isArray(a.wert)) {
      return {
        ...a,
        titel: titelDe,
        wert: a.wert.map((w) => rueck.get(w) ?? w),
      };
    }
    if ((a.typ === "textfeld" || a.typ === "textfeld_schreibfeld") && typeof a.wert === "string" && a.wert.trim()) {
      freitexte.push({ i, text: a.wert });
      return { ...a, titel: titelDe };
    }
    if (a.typ === "haeufigkeit" && typeof a.wert === "object" && a.wert !== null && !Array.isArray(a.wert)) {
      const mapped: Record<string, string> = {};
      for (const [frage, stufe] of Object.entries(a.wert as Record<string, string>) ) {
        mapped[rueck.get(frage) ?? frage] = rueck.get(stufe) ?? stufe;
      }
      return { ...a, titel: titelDe, wert: mapped };
    }
    return { ...a, titel: titelDe };
  });

  if (freitexte.length > 0) {
    const ue2 = await uebersetzeBatch(freitexte.map((f) => f.text), "de", sprache);
    freitexte.forEach((f, j) => {
      antworten[f.i] = { ...antworten[f.i], wert: ue2[j] ?? f.text };
    });
  }
  return { kopfbogen: daten.kopfbogen, antworten };
}
