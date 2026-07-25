// ── PraxiOS: Arzt-zu-Arzt-Austausch (age-verschlüsselte Akten-Pakete) ──────
import { z } from "zod";
import crypto from "node:crypto";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { and, desc, eq } from "drizzle-orm";
import { TRPCError } from "@trpc/server";
import {
  Encrypter,
  Decrypter,
  generateIdentity,
  identityToRecipient,
  armor,
} from "age-encryption";
import { adminQuery, authedQuery, createRouter } from "./middleware";
import { getDb } from "./queries/connection";
import {
  aktenExporte,
  companySettings,
  customers,
  documents,
  kollegen,
  patientContacts,
  planEntries,
  products,
  therapyPlans,
  timelineEvents,
  users,
} from "@db/schema";
import { env } from "./lib/env";
import { normBasis, normKompakt, normMenge } from "./therapyPlan";
import { paketVorschau, parsePaket, PAKET_FORMAT, PAKET_VERSION, type AktePaket } from "./aktePaket";
import { renderEinverstaendnisPdf } from "./austauschPdf";

const fmtDe = (iso: string | null | undefined) => {
  if (!iso) return null;
  const [j, m, t] = iso.split("-");
  return `${t}.${m}.${j}`;
};

async function ladeEinstellungenMitSecret() {
  const s = await getDb().query.companySettings.findFirst({
    where: eq(companySettings.id, 1),
  });
  if (!s) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Praxisdaten fehlen (Einstellungen)." });
  return s;
}

const kollegeInput = z.object({
  name: z.string().trim().min(1).max(255),
  ageRecipient: z
    .string()
    .trim()
    .regex(/^age1[02-9ac-hj-np-z]{58}$/, "Ungültiger age-Empfänger (age1…, 63 Zeichen)"),
  notiz: z.string().trim().max(500).nullable().optional(),
});

export const austauschRouter = createRouter({
  // ── Eigener Schlüssel (nur der öffentliche Teil wird angezeigt) ──────────
  schluessel: authedQuery.query(async () => {
    const s = await ladeEinstellungenMitSecret();
    return { recipient: s.ageRecipient, vorhanden: !!s.ageSecret };
  }),

  schluesselGenerieren: adminQuery.mutation(async () => {
    const db = getDb();
    await ladeEinstellungenMitSecret();
    const secret = await generateIdentity();
    const recipient = await identityToRecipient(secret);
    await db
      .update(companySettings)
      .set({ ageSecret: secret, ageRecipient: recipient })
      .where(eq(companySettings.id, 1));
    return { recipient };
  }),

  // ── Kollegen-Praxen ───────────────────────────────────────────────────────
  kollegenListe: authedQuery.query(async () => {
    return getDb().query.kollegen.findMany({ orderBy: [desc(kollegen.createdAt)] });
  }),

  kollegeAnlegen: authedQuery.input(kollegeInput).mutation(async ({ input }) => {
    const [{ id }] = await getDb().insert(kollegen).values(input).$returningId();
    return { id };
  }),

  kollegeUpdate: authedQuery
    .input(z.object({ id: z.number().int(), data: kollegeInput.partial() }))
    .mutation(async ({ input }) => {
      await getDb().update(kollegen).set(input.data).where(eq(kollegen.id, input.id));
      return { ok: true };
    }),

  kollegeSetAktiv: authedQuery
    .input(z.object({ id: z.number().int(), aktiv: z.boolean() }))
    .mutation(async ({ input }) => {
      await getDb()
        .update(kollegen)
        .set({ aktiv: input.aktiv })
        .where(eq(kollegen.id, input.id));
      return { ok: true };
    }),

  kollegeLoeschen: authedQuery
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      await getDb().delete(kollegen).where(eq(kollegen.id, input.id));
      return { ok: true };
    }),

  // ── Einverständnis-PDF (Generator) ────────────────────────────────────────
  einverstaendnisPdf: authedQuery
    .input(z.object({ patientId: z.number().int(), kollegeId: z.number().int() }))
    .query(async ({ input }) => {
      const db = getDb();
      const s = await ladeEinstellungenMitSecret();
      const p = await db.query.customers.findFirst({ where: eq(customers.id, input.patientId) });
      if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Patient nicht gefunden." });
      const k = await db.query.kollegen.findFirst({ where: eq(kollegen.id, input.kollegeId) });
      if (!k) throw new TRPCError({ code: "NOT_FOUND", message: "Kollegen-Praxis nicht gefunden." });
      const heute = new Date();
      const datum = `${String(heute.getDate()).padStart(2, "0")}.${String(heute.getMonth() + 1).padStart(2, "0")}.${heute.getFullYear()}`;
      const pdf = await renderEinverstaendnisPdf({
        praxisName: s.name,
        praxisAdresse: `${s.strasse}, ${s.plz} ${s.ort}`,
        patientName: p.name,
        patientGeburtsdatum: fmtDe(p.geburtsdatum),
        kollegeName: k.name,
        datum,
      });
      return {
        dateiname: `Einverstaendnis_Datenaustausch_${p.name.split(",")[0].trim()}_${k.name.replace(/[^\w]+/g, "_").slice(0, 30)}.pdf`,
        base64: pdf.toString("base64"),
      };
    }),

  /** Status für den Export-Tab: Einverständnis vorhanden? Kollegen? Historie? */
  exportStatus: authedQuery
    .input(z.object({ patientId: z.number().int() }))
    .query(async ({ input }) => {
      const db = getDb();
      const einverstaendnis = await db.query.documents.findFirst({
        where: and(
          eq(documents.patientId, input.patientId),
          eq(documents.kategorie, "einverstaendnis"),
        ),
        orderBy: [desc(documents.createdAt)],
      });
      const alleKollegen = await db.query.kollegen.findMany({
        where: eq(kollegen.aktiv, true),
      });
      const historie = await db
        .select({
          id: aktenExporte.id,
          dateiname: aktenExporte.dateiname,
          umfang: aktenExporte.umfang,
          createdAt: aktenExporte.createdAt,
          kollegeName: kollegen.name,
          benutzerName: users.name,
        })
        .from(aktenExporte)
        .innerJoin(kollegen, eq(aktenExporte.kollegeId, kollegen.id))
        .leftJoin(users, eq(aktenExporte.createdBy, users.id))
        .where(eq(aktenExporte.patientId, input.patientId))
        .orderBy(desc(aktenExporte.createdAt))
        .limit(20);
      return {
        einverstaendnis: einverstaendnis
          ? { id: einverstaendnis.id, dateiname: einverstaendnis.dateiname, createdAt: einverstaendnis.createdAt }
          : null,
        kollegen: alleKollegen.map((k) => ({ id: k.id, name: k.name })),
        historie,
      };
    }),

  // ── Export (gated: nur mit Einverständnis-Dokument in der Akte) ──────────
  exportieren: authedQuery
    .input(z.object({ patientId: z.number().int(), kollegeId: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const s = await ladeEinstellungenMitSecret();
      const p = await db.query.customers.findFirst({ where: eq(customers.id, input.patientId) });
      if (!p) throw new TRPCError({ code: "NOT_FOUND", message: "Patient nicht gefunden." });
      const k = await db.query.kollegen.findFirst({ where: eq(kollegen.id, input.kollegeId) });
      if (!k) throw new TRPCError({ code: "NOT_FOUND", message: "Kollegen-Praxis nicht gefunden." });

      // Einverständnis-Pflicht (Art. 9 DSGVO)
      const einverstaendnis = await db.query.documents.findFirst({
        where: and(
          eq(documents.patientId, input.patientId),
          eq(documents.kategorie, "einverstaendnis"),
        ),
        orderBy: [desc(documents.createdAt)],
      });
      if (!einverstaendnis) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message:
            "Kein Einverständnis in der Akte. Bitte zuerst das Formular erzeugen, unterschreiben lassen und als Dokument (Kategorie „Einverständnis“) hochladen.",
        });
      }

      // Paket zusammenstellen
      const [kontakte, plaene, timeline, docs] = await Promise.all([
        db.query.patientContacts.findMany({ where: eq(patientContacts.patientId, input.patientId) }),
        db.query.therapyPlans.findMany({
          where: eq(therapyPlans.patientId, input.patientId),
          with: { entries: true },
        }),
        db.query.timelineEvents.findMany({ where: eq(timelineEvents.patientId, input.patientId) }),
        db.query.documents.findMany({ where: eq(documents.patientId, input.patientId) }),
      ]);

      // Re-Mapping-Namen für Leistungen/Therapeuten sammeln
      const leistungIds = new Set<number>();
      const therapeutIds = new Set<number>();
      for (const pl of plaene) {
        for (const e of pl.entries) {
          if (e.leistungId) leistungIds.add(e.leistungId);
          if (e.therapeutId) therapeutIds.add(e.therapeutId);
        }
      }
      const leistungNamen = new Map<number, string>();
      for (const id of leistungIds) {
        const l = await db.query.products.findFirst({ where: eq(products.id, id) });
        if (l) leistungNamen.set(id, l.name);
      }
      const therapeutNamen = new Map<number, string>();
      for (const id of therapeutIds) {
        const u = await db.query.users.findFirst({ where: eq(users.id, id) });
        if (u) therapeutNamen.set(id, u.name ?? u.username ?? "");
      }

      const dokumentePaket: AktePaket["dokumente"] = [];
      const fehlende: string[] = [];
      for (const d of docs) {
        try {
          const inhalt = await readFile(path.join(env.uploadDir, d.dateipfad));
          dokumentePaket.push({
            kategorie: d.kategorie,
            dateiname: d.dateiname,
            mimeType: d.mimeType,
            notiz: d.notiz,
            dateiBase64: inhalt.toString("base64"),
          });
        } catch {
          fehlende.push(d.dateiname);
        }
      }

      const paket: AktePaket = {
        format: PAKET_FORMAT,
        version: PAKET_VERSION,
        exportiertAm: new Date().toISOString(),
        quellPraxis: s.name,
        patient: {
          name: p.name,
          geburtsdatum: p.geburtsdatum,
          patientenNr: p.patientenNr,
          strasse: p.strasse || null,
          plz: p.plz || null,
          ort: p.ort || null,
          land: p.land,
          telefon: p.telefon,
          email: p.email,
          krankenkasse: p.krankenkasse,
          versichertennummer: p.versichertennummer,
          aerztlicherAnsprechpartner: p.aerztlicherAnsprechpartner,
          tags: p.tags,
          notizen: p.notizen,
        },
        kontakte: kontakte.map((x) => ({
          name: x.name,
          verhaeltnis: x.verhaeltnis,
          telefon: x.telefon,
          email: x.email,
          adresse: x.adresse,
          istRechnungsempfaenger: x.istRechnungsempfaenger,
          notiz: x.notiz,
        })),
        plaene: plaene.map((pl) => ({
          titel: pl.titel,
          vonDatum: pl.vonDatum,
          bisDatum: pl.bisDatum,
          diagnoseZiele: pl.diagnoseZiele,
          status: pl.status,
          rechnungsempfaengerAbweichend: pl.rechnungsempfaengerAbweichend,
          abweichenderEmpfaenger: pl.abweichenderEmpfaenger,
          notizen: pl.notizen,
          entries: pl.entries.map((e) => ({
            datum: e.datum,
            zeitVon: e.zeitVon,
            zeitBis: e.zeitBis,
            leistungText: e.leistungText,
            leistungName: e.leistungId ? (leistungNamen.get(e.leistungId) ?? null) : null,
            menge: e.menge,
            therapeutName: e.therapeutId ? (therapeutNamen.get(e.therapeutId) ?? null) : null,
            raum: e.raum,
            status: e.status,
            bemerkung: e.bemerkung,
          })),
        })),
        dokumente: dokumentePaket,
        timeline: timeline.map((t) => ({
          typ: t.typ,
          titel: t.titel,
          beschreibung: t.beschreibung,
          datum: t.datum,
        })),
      };

      // Verschlüsseln (age, Empfänger = öffentlicher Schlüssel der Kollegen-Praxis)
      const encrypter = new Encrypter();
      encrypter.addRecipient(k.ageRecipient);
      const roh = new TextEncoder().encode(JSON.stringify(paket));
      const verschluesselt = armor.encode(await encrypter.encrypt(roh));

      const umfang = `${dokumentePaket.length} Dokumente, ${plaene.length} Pläne, ${kontakte.length} Kontakte, ${timeline.length} Chronik-Einträge` +
        (fehlende.length > 0 ? ` (${fehlende.length} Datei(en) fehlten auf der Platte)` : "");
      const dateiname =
        `akte_${p.name.split(",")[0].trim().replace(/[^\w]+/g, "_")}_an_${k.name.replace(/[^\w]+/g, "_").slice(0, 30)}_` +
        `${new Date().toISOString().slice(0, 10)}.age`;

      await db.insert(aktenExporte).values({
        patientId: p.id,
        kollegeId: k.id,
        einverstaendnisDocId: einverstaendnis.id,
        dateiname,
        umfang,
        createdBy: ctx.user.id,
      });

      return {
        dateiname,
        base64: Buffer.from(verschluesselt, "utf-8").toString("base64"),
        umfang,
        warnung: fehlende.length > 0 ? `Nicht enthalten (Datei fehlt): ${fehlende.join(", ")}` : null,
      };
    }),

  // ── Import: Vorschau (entschlüsseln + zusammenfassen) ────────────────────
  importVorschau: authedQuery
    .input(z.object({ dateiname: z.string(), base64: z.string().min(1) }))
    .mutation(async ({ input }) => {
      const s = await ladeEinstellungenMitSecret();
      if (!s.ageSecret) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Noch kein eigener Schlüssel — bitte zuerst unter „Eigener Schlüssel“ erzeugen.",
        });
      }
      const paket = await entschluesslePaket(input.base64, s.ageSecret);
      const vorschau = paketVorschau(paket);
      // Patient vorhanden? (Hinweis, kein Blocker)
      const db = getDb();
      const kandidaten = await db.query.customers.findMany({
        where: eq(customers.archiviert, false),
      });
      const treffer = findePatient(kandidaten, paket.patient);
      return { ...vorschau, vorhandenerPatient: treffer ? { id: treffer.id, name: treffer.name } : null };
    }),

  importieren: authedQuery
    .input(z.object({ dateiname: z.string(), base64: z.string().min(1) }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const s = await ladeEinstellungenMitSecret();
      if (!s.ageSecret) {
        throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Kein eigener Schlüssel vorhanden." });
      }
      const paket = await entschluesslePaket(input.base64, s.ageSecret);

      // Katalog + Benutzer für Re-Mapping laden
      const [produktListe, benutzerListe] = await Promise.all([
        db.query.products.findMany({ where: eq(products.aktiv, true) }),
        db.query.users.findMany(),
      ]);
      const produktIndex = new Map<string, number>();
      const indexiere = (schluessel: string, id: number) => {
        if (schluessel && !produktIndex.has(schluessel)) produktIndex.set(schluessel, id);
      };
      for (const pr of produktListe) {
        indexiere(normBasis(pr.name), pr.id);
        indexiere(normKompakt(pr.name), pr.id);
        indexiere(normMenge(pr.name), pr.id);
        for (const a of (pr.importNamen ?? "").split(/[\n;]/)) {
          const t = a.trim();
          if (t) {
            indexiere(normBasis(t), pr.id);
            indexiere(normKompakt(t), pr.id);
            indexiere(normMenge(t), pr.id);
          }
        }
      }
      const findeLeistung = (name: string | null): number | null => {
        if (!name) return null;
        return (
          produktIndex.get(normBasis(name)) ??
          produktIndex.get(normKompakt(name)) ??
          produktIndex.get(normMenge(name)) ??
          null
        );
      };
      const therapeutIndex = new Map<string, number>();
      for (const u of benutzerListe) {
        if (u.name) therapeutIndex.set(normBasis(u.name), u.id);
        if (u.username) therapeutIndex.set(normBasis(u.username), u.id);
      }

      const kandidaten = await db.query.customers.findMany({
        where: eq(customers.archiviert, false),
      });
      let patient: (typeof customers.$inferSelect) | null = findePatient(
        kandidaten,
        paket.patient,
      );
      const p = paket.patient;

      // Patient anlegen oder Lücken ergänzen (nie überschreiben)
      if (!patient) {
        const [res] = await db
          .insert(customers)
          .values({
            name: p.name,
            geburtsdatum: p.geburtsdatum,
            patientenNr: p.patientenNr,
            strasse: p.strasse ?? "",
            plz: p.plz ?? "",
            ort: p.ort ?? "",
            land: p.land ?? "Deutschland",
            telefon: p.telefon,
            email: p.email,
            krankenkasse: p.krankenkasse,
            versichertennummer: p.versichertennummer,
            aerztlicherAnsprechpartner: p.aerztlicherAnsprechpartner,
            tags: p.tags,
            notizen: p.notizen
              ? `${p.notizen}\n[Import aus Akten-Paket (${s.name})]`
              : `Import aus Akten-Paket (${s.name})`,
          })
          .$returningId();
        patient =
          (await db.query.customers.findFirst({ where: eq(customers.id, res.id) })) ?? null;
      } else {
        const patch: Partial<typeof customers.$inferInsert> = {};
        const luecke = (alt: string | null, neu: string | null) => (!alt && neu ? neu : undefined);
        const p1 = luecke(patient.strasse, p.strasse); if (p1) patch.strasse = p1;
        const p2 = luecke(patient.plz, p.plz); if (p2) patch.plz = p2;
        const p3 = luecke(patient.ort, p.ort); if (p3) patch.ort = p3;
        const p4 = luecke(patient.geburtsdatum, p.geburtsdatum); if (p4) patch.geburtsdatum = p4;
        const p5 = luecke(patient.patientenNr, p.patientenNr); if (p5) patch.patientenNr = p5;
        const p6 = luecke(patient.telefon, p.telefon); if (p6) patch.telefon = p6;
        const p7 = luecke(patient.email, p.email); if (p7) patch.email = p7;
        const p8 = luecke(patient.krankenkasse, p.krankenkasse); if (p8) patch.krankenkasse = p8;
        if (Object.keys(patch).length > 0) {
          await db.update(customers).set(patch).where(eq(customers.id, patient!.id));
          patient = { ...patient, ...patch } as typeof patient;
        }
      }
      if (!patient) throw new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "Patient konnte nicht angelegt werden." });
      const patientId = patient.id;

      // Kontakte (Dedupe nach Name)
      const vorhandeneKontakte = await db.query.patientContacts.findMany({
        where: eq(patientContacts.patientId, patientId),
      });
      const kontaktNamen = new Set(vorhandeneKontakte.map((x) => normBasis(x.name)));
      const neueKontakte = paket.kontakte.filter((x) => !kontaktNamen.has(normBasis(x.name)));
      if (neueKontakte.length > 0) {
        await db.insert(patientContacts).values(
          neueKontakte.map((x) => ({ ...x, patientId })),
        );
      }

      // Pläne + Einträge (Dedupe nach titel+von+bis)
      const vorhandenePlaene = await db.query.therapyPlans.findMany({
        where: eq(therapyPlans.patientId, patientId),
      });
      const planSchluessel = new Set(
        vorhandenePlaene.map((pl) => `${normBasis(pl.titel ?? "")}|${pl.vonDatum}|${pl.bisDatum}`),
      );
      let plaeneNeu = 0;
      let eintraegeNeu = 0;
      for (const pl of paket.plaene) {
        const key = `${normBasis(pl.titel ?? "")}|${pl.vonDatum}|${pl.bisDatum}`;
        if (planSchluessel.has(key)) continue;
        const [neuerPlan] = await db
          .insert(therapyPlans)
          .values({
            patientId,
            titel: pl.titel,
            vonDatum: pl.vonDatum,
            bisDatum: pl.bisDatum,
            diagnoseZiele: pl.diagnoseZiele,
            status: pl.status,
            rechnungsempfaengerAbweichend: pl.rechnungsempfaengerAbweichend,
            abweichenderEmpfaenger: pl.abweichenderEmpfaenger,
            notizen: pl.notizen,
            createdBy: ctx.user.id,
          })
          .$returningId();
        plaeneNeu++;
        if (pl.entries.length > 0) {
          await db.insert(planEntries).values(
            pl.entries.map((e) => ({
              planId: neuerPlan.id,
              datum: e.datum,
              zeitVon: e.zeitVon,
              zeitBis: e.zeitBis,
              leistungId: findeLeistung(e.leistungName) ?? findeLeistung(e.leistungText),
              leistungText: e.leistungText ?? e.leistungName,
              menge: e.menge,
              therapeutId: e.therapeutName
                ? (therapeutIndex.get(normBasis(e.therapeutName)) ?? null)
                : null,
              raum: e.raum,
              status: e.status,
              bemerkung: e.bemerkung,
            })),
          );
          eintraegeNeu += pl.entries.length;
        }
      }

      // Dokumente (Dateien ablegen, Dedupe nach dateiname+größe)
      const vorhandeneDocs = await db.query.documents.findMany({
        where: eq(documents.patientId, patientId),
      });
      const docSchluessel = new Set(vorhandeneDocs.map((d) => `${d.dateiname}|${d.groesse ?? 0}`));
      let docsNeu = 0;
      for (const d of paket.dokumente) {
        const inhalt = Buffer.from(d.dateiBase64, "base64");
        if (docSchluessel.has(`${d.dateiname}|${inhalt.length}`)) continue;
        const zielVerzeichnis = path.join(env.uploadDir, String(patientId));
        mkdirSync(zielVerzeichnis, { recursive: true });
        const dateipfad = `${patientId}/${Date.now()}-${crypto.randomBytes(4).toString("hex")}.bin`;
        await writeFile(path.join(env.uploadDir, dateipfad), inhalt);
        await db.insert(documents).values({
          patientId,
          kategorie: d.kategorie,
          dateiname: d.dateiname,
          dateipfad,
          mimeType: d.mimeType,
          groesse: inhalt.length,
          notiz: d.notiz,
          uploadedBy: ctx.user.id,
        });
        docsNeu++;
      }

      // Timeline (Historie mit Originaldaten übernehmen)
      if (paket.timeline.length > 0) {
        await db.insert(timelineEvents).values(
          paket.timeline.map((t) => ({
            patientId,
            typ: t.typ,
            titel: t.titel,
            beschreibung: t.beschreibung,
            datum: t.datum,
            createdBy: ctx.user.id,
          })),
        );
      }
      await db.insert(timelineEvents).values({
        patientId,
        typ: "status",
        titel: `Akten-Paket importiert (${paket.quellPraxis ?? "extern"})`,
        beschreibung: `${plaeneNeu} Pläne, ${eintraegeNeu} Einträge, ${docsNeu} Dokumente, ${neueKontakte.length} Kontakte`,
        datum: new Date().toISOString().slice(0, 10),
        createdBy: ctx.user.id,
      });

      return {
        patientId,
        umfang: `${plaeneNeu} Pläne, ${eintraegeNeu} Einträge, ${docsNeu} Dokumente, ${neueKontakte.length} Kontakte`,
      };
    }),
});

// ── Hilfsfunktionen (paket-intern) ───────────────────────────────────────────
async function entschluesslePaket(base64: string, secret: string): Promise<AktePaket> {
  try {
    const armored = Buffer.from(base64, "base64").toString("utf-8");
    const roh = armor.decode(armored);
    const decrypter = new Decrypter();
    decrypter.addIdentity(secret);
    const json = await decrypter.decrypt(roh);
    return parsePaket(JSON.parse(new TextDecoder().decode(json)));
  } catch (e) {
    if (e instanceof TRPCError) throw e;
    throw new TRPCError({
      code: "BAD_REQUEST",
      message: `Paket konnte nicht entschlüsselt/gelesen werden (${e instanceof Error ? e.message : String(e)}). Falsche Datei oder falscher Schlüssel.`,
    });
  }
}

/** Patient im Stamm finden: patientenNr > exakter Name > Name+Geburtsdatum. */
function findePatient(
  kandidaten: (typeof customers.$inferSelect)[],
  p: AktePaket["patient"],
): (typeof customers.$inferSelect) | null {
  if (p.patientenNr) {
    const perNr = kandidaten.find(
      (k) => k.patientenNr && normBasis(k.patientenNr) === normBasis(p.patientenNr!),
    );
    if (perNr) return perNr;
  }
  const voll = normBasis(p.name);
  const exakt = kandidaten.find((k) => normBasis(k.name) === voll);
  if (exakt) return exakt;
  if (p.geburtsdatum) {
    const nn = normBasis(p.name.split(",")[0]);
    const treffer = kandidaten.filter(
      (k) => normBasis(k.name.split(",")[0]) === nn && k.geburtsdatum === p.geburtsdatum,
    );
    if (treffer.length === 1) return treffer[0];
  }
  return null;
}
