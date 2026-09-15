// ── PraxiOS: Patienten-Portal (öffentlicher Teil) ────────────────────────────
// Geschützter Zugang pro Patient: Link (30 Tage) + Geburtsdatum als 2. Faktor
// → Session (24 h). Nur eigene Daten, Zugriffe auditiert (DSGVO Art. 9).
// Rate-Limit: 5 Fehlversuche → 60 min Sperre je Link.
import { z } from "zod";
import crypto from "node:crypto";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { TRPCError } from "@trpc/server";
import { and, desc, eq, gt } from "drizzle-orm";
import { createRouter, publicQuery } from "./middleware";
import { getDb } from "./queries/connection";
import {
  companySettings,
  customers,
  documents,
  patientDatenAntraege,
  patientPortalLinks,
  patientPortalSessions,
  patientPortalZugriffe,
  rezepte,
  terminAnfragen,
  therapyPlans,
} from "@db/schema";
import { env } from "./lib/env";

const DATUM_RE = /^\d{2}\.\d{2}\.\d{4}$/;
const SESSION_STUNDEN = 24;

interface PortalBereiche {
  termine: boolean;
  therapieplan: boolean;
  dokumente: boolean;
  atteste: boolean;
  daten: boolean;
  terminanfragen: boolean;
}

const BEREICHE_STANDARD: PortalBereiche = {
  termine: true,
  therapieplan: true,
  dokumente: true,
  atteste: true,
  daten: true,
  terminanfragen: true,
};

async function ladeBereiche(): Promise<{ aktiv: boolean; bereiche: PortalBereiche }> {
  const s = await getDb().query.companySettings.findFirst({
    where: eq(companySettings.id, 1),
    columns: { portalAktiv: true, portalBereiche: true },
  });
  let bereiche = BEREICHE_STANDARD;
  if (s?.portalBereiche) {
    try {
      bereiche = { ...BEREICHE_STANDARD, ...(JSON.parse(s.portalBereiche) as Partial<PortalBereiche>) };
    } catch { /* Standard */ }
  }
  return { aktiv: s?.portalAktiv ?? true, bereiche };
}

/** Link prüfen (gültig, nicht gesperrt). Wirft TRPCError mit Meldung. */
async function ladeLink(token: string) {
  const db = getDb();
  const link = await db.query.patientPortalLinks.findFirst({
    where: eq(patientPortalLinks.token, token),
    with: { patient: true },
  });
  if (!link) throw new TRPCError({ code: "NOT_FOUND", message: "Link ungültig oder abgelaufen." });
  if (link.gesperrtBis && link.gesperrtBis > new Date()) {
    const min = Math.ceil((link.gesperrtBis.getTime() - Date.now()) / 60000);
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: `Zu viele Fehlversuche — Zugang für ${min} Minuten gesperrt.`,
    });
  }
  if (link.gueltigBis < new Date().toISOString().slice(0, 10)) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Link abgelaufen — bitte bei der Praxis einen neuen anfordern." });
  }
  const { aktiv } = await ladeBereiche();
  if (!aktiv) {
    throw new TRPCError({ code: "PRECONDITION_FAILED", message: "Das Patientenportal ist derzeit deaktiviert." });
  }
  return link;
}

/** Session prüfen → patientId + Patient. Wirft TRPCError. */
async function ladeSession(sessionToken: string) {
  const db = getDb();
  const sess = await db.query.patientPortalSessions.findFirst({
    where: and(eq(patientPortalSessions.token, sessionToken), gt(patientPortalSessions.gueltigBis, new Date())),
    with: { patient: true },
  });
  if (!sess) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Sitzung abgelaufen — bitte über den Link und das Geburtsdatum neu anmelden.",
    });
  }
  return sess;
}

async function audit(patientId: number, bereich: string) {
  try {
    await getDb().insert(patientPortalZugriffe).values({ patientId, bereich });
  } catch { /* Audit darf nie blockieren */ }
}

function bereichPruefen(bereiche: PortalBereiche, name: keyof PortalBereiche) {
  if (!bereiche[name]) {
    throw new TRPCError({ code: "FORBIDDEN", message: "Dieser Bereich ist in der Praxis deaktiviert." });
  }
}

export const portalRouter = createRouter({
  // ── Öffentlich: Info + Login ─────────────────────────────────────────────
  info: publicQuery
    .input(z.object({ token: z.string().min(10).max(80) }))
    .query(async ({ input }) => {
      const link = await ladeLink(input.token);
      const { bereiche } = await ladeBereiche();
      const vorname = link.patient.name.split(",")[1]?.trim().split(" ")[0] ?? link.patient.name;
      return {
        patientenName: vorname,
        bereiche,
      };
    }),

  einloggen: publicQuery
    .input(
      z.object({
        token: z.string().min(10).max(80),
        geburtsdatum: z.string().regex(DATUM_RE, "Format TT.MM.JJJJ"),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const link = await ladeLink(input.token);

      const patient = await db.query.customers.findFirst({
        where: eq(customers.id, link.patientId),
        columns: { id: true, geburtsdatum: true },
      });
      const erwartet = patient?.geburtsdatum
        ? patient.geburtsdatum.split("-").reverse().join(".")
        : null;
      const stimmt = erwartet !== null && erwartet === input.geburtsdatum;

      if (!stimmt) {
        const versuche = link.fehlversuche + 1;
        const gesperrt = versuche >= 5;
        await db
          .update(patientPortalLinks)
          .set({
            fehlversuche: versuche,
            gesperrtBis: gesperrt ? new Date(Date.now() + 60 * 60 * 1000) : link.gesperrtBis,
          })
          .where(eq(patientPortalLinks.id, link.id));
        throw new TRPCError({
          code: "UNAUTHORIZED",
          message: gesperrt
            ? "Zu viele Fehlversuche — Zugang für 60 Minuten gesperrt."
            : "Geburtsdatum stimmt nicht mit den Praxis-Unterlagen überein.",
        });
      }

      // Erfolg: Fehlversuche zurücksetzen, Session anlegen (24 h)
      await db
        .update(patientPortalLinks)
        .set({ fehlversuche: 0, letzterZugriffAm: new Date() })
        .where(eq(patientPortalLinks.id, link.id));
      const sessionToken = crypto.randomBytes(24).toString("hex");
      const gueltigBis = new Date(Date.now() + SESSION_STUNDEN * 3600 * 1000);
      await db.insert(patientPortalSessions).values({
        linkId: link.id,
        patientId: link.patientId,
        token: sessionToken,
        gueltigBis,
      });
      await audit(link.patientId, "login");
      return { session: sessionToken, gueltigBis: gueltigBis.toISOString() };
    }),

  abmelden: publicQuery
    .input(z.object({ session: z.string().min(10).max(80) }))
    .mutation(async ({ input }) => {
      await getDb().delete(patientPortalSessions).where(eq(patientPortalSessions.token, input.session));
      return { ok: true };
    }),

  // ── Geschützt per Session: Termine ────────────────────────────────────────
  termine: publicQuery
    .input(z.object({ session: z.string().min(10).max(80) }))
    .query(async ({ input }) => {
      const sess = await ladeSession(input.session);
      const { bereiche } = await ladeBereiche();
      bereichPruefen(bereiche, "termine");
      await audit(sess.patientId, "termine");
      const heute = new Date().toISOString().slice(0, 10);
      const plaene = await getDb().query.therapyPlans.findMany({
        where: and(eq(therapyPlans.patientId, sess.patientId), gt(therapyPlans.bisDatum, heute)),
        orderBy: [desc(therapyPlans.vonDatum)],
        with: { entries: true },
      });
      const eintraege = plaene
        .flatMap((p) =>
          p.entries
            .filter((e) => e.datum >= heute && e.status !== "ausgefallen" && e.status !== "abgesagt")
            .map((e) => ({
              datum: e.datum,
              zeitVon: e.zeitVon,
              zeitBis: e.zeitBis,
              leistung: e.leistungText,
              raum: e.raum,
            })),
        )
        .sort((a, b) => (a.datum + (a.zeitVon ?? "99")).localeCompare(b.datum + (b.zeitVon ?? "99")));
      return { eintraege };
    }),

  // ── Geschützt per Session: Therapieplan (eigener Verlauf, Art. 15) ───────
  therapieplan: publicQuery
    .input(z.object({ session: z.string().min(10).max(80) }))
    .query(async ({ input }) => {
      const sess = await ladeSession(input.session);
      const { bereiche } = await ladeBereiche();
      bereichPruefen(bereiche, "therapieplan");
      await audit(sess.patientId, "therapieplan");
      const plaene = await getDb().query.therapyPlans.findMany({
        where: eq(therapyPlans.patientId, sess.patientId),
        orderBy: [desc(therapyPlans.vonDatum)],
        with: { entries: true },
      });
      return {
        plaene: plaene.map((p) => ({
          titel: p.titel,
          vonDatum: p.vonDatum,
          bisDatum: p.bisDatum,
          status: p.status,
          eintraege: p.entries
            .sort((a, b) => a.datum.localeCompare(b.datum))
            .map((e) => ({
              datum: e.datum,
              zeitVon: e.zeitVon,
              zeitBis: e.zeitBis,
              leistung: e.leistungText,
              status: e.status,
              raum: e.raum,
            })),
        })),
      };
    }),

  // ── Geschützt per Session: Dokumente ─────────────────────────────────────
  dokumente: publicQuery
    .input(z.object({ session: z.string().min(10).max(80) }))
    .query(async ({ input }) => {
      const sess = await ladeSession(input.session);
      const { bereiche } = await ladeBereiche();
      bereichPruefen(bereiche, "dokumente");
      await audit(sess.patientId, "dokumente");
      // Alle eigenen Dokumente, unabhängig von der Kategorie: Früher waren nur
      // 4 Kategorien freigegeben — in der Praxis landet fast alles als
      // „sonstiges" in der Akte und das Portal blieb leer (Bug v1.10.0).
      // Es sind ohnehin ausschließlich EIGENE Daten (Art. 15); die Praxis
      // steuert die Sichtbarkeit über Einstellungen → Patienten-Portal.
      const rows = await getDb().query.documents.findMany({
        where: eq(documents.patientId, sess.patientId),
        orderBy: [desc(documents.createdAt)],
      });
      return {
        dokumente: rows
          .map((d) => ({
            id: d.id,
            kategorie: d.kategorie,
            dateiname: d.dateiname,
            groesse: d.groesse,
            erstelltAm: d.createdAt,
          })),
      };
    }),

  dokumentDatei: publicQuery
    .input(z.object({ session: z.string().min(10).max(80), id: z.number().int() }))
    .query(async ({ input }) => {
      const sess = await ladeSession(input.session);
      const { bereiche } = await ladeBereiche();
      bereichPruefen(bereiche, "dokumente");
      const doc = await getDb().query.documents.findFirst({ where: eq(documents.id, input.id) });
      // Zugriff nur auf EIGENE Dokumente (DSGVO: kein Fremdzugriff)
      if (!doc || doc.patientId !== sess.patientId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Dokument nicht gefunden." });
      }
      await audit(sess.patientId, "dokument-datei");
      const buf = await readFile(path.join(env.uploadDir, doc.dateipfad));
      return { dateiname: doc.dateiname, base64: buf.toString("base64"), mime: doc.mimeType ?? "application/pdf" };
    }),

  // ── Geschützt per Session: Atteste/Rezepte ────────────────────────────────
  atteste: publicQuery
    .input(z.object({ session: z.string().min(10).max(80) }))
    .query(async ({ input }) => {
      const sess = await ladeSession(input.session);
      const { bereiche } = await ladeBereiche();
      bereichPruefen(bereiche, "atteste");
      await audit(sess.patientId, "atteste");
      const rows = await getDb().query.rezepte.findMany({
        where: eq(rezepte.patientId, sess.patientId),
        orderBy: [desc(rezepte.createdAt)],
      });
      return {
        atteste: rows.map((r) => ({
          id: r.id,
          typ: r.typ,
          erstelltAm: r.createdAt,
          zusammenfassung:
            r.typ === "rezept"
              ? (JSON.parse(r.inhalt) as { medikamente?: { name: string }[] }).medikamente
                  ?.map((m) => m.name)
                  .join(", ") ?? "Rezept"
              : (JSON.parse(r.inhalt) as { art?: string }).art === "krankschreibung"
                ? "Krankschreibung"
                : "Attest",
        })),
      };
    }),

  attestPdf: publicQuery
    .input(z.object({ session: z.string().min(10).max(80), id: z.number().int() }))
    .query(async ({ input }) => {
      const sess = await ladeSession(input.session);
      const { bereiche } = await ladeBereiche();
      bereichPruefen(bereiche, "atteste");
      const r = await getDb().query.rezepte.findFirst({
        where: eq(rezepte.id, input.id),
        with: { dokument: true },
      });
      if (!r?.dokument || r.patientId !== sess.patientId) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Attest nicht gefunden." });
      }
      await audit(sess.patientId, "attest-pdf");
      const buf = await readFile(path.join(env.uploadDir, r.dokument.dateipfad));
      return { dateiname: r.dokument.dateiname, base64: buf.toString("base64") };
    }),

  // ── Geschützt per Session: eigene Daten + Anträge ────────────────────────
  daten: publicQuery
    .input(z.object({ session: z.string().min(10).max(80) }))
    .query(async ({ input }) => {
      const sess = await ladeSession(input.session);
      const { bereiche } = await ladeBereiche();
      bereichPruefen(bereiche, "daten");
      await audit(sess.patientId, "daten");
      const p = sess.patient;
      const antraege = await getDb().query.patientDatenAntraege.findMany({
        where: eq(patientDatenAntraege.patientId, sess.patientId),
        orderBy: [desc(patientDatenAntraege.createdAt)],
        limit: 10,
      });
      return {
        patient: {
          name: p.name,
          strasse: p.strasse,
          plz: p.plz,
          ort: p.ort,
          email: p.email,
          telefon: p.telefon,
        },
        antraege: antraege.map((a) => ({
          id: a.id,
          felder: JSON.parse(a.felder) as { feld: string; alt: string; neu: string }[],
          status: a.status,
          kommentar: a.kommentar,
          erstelltAm: a.createdAt,
        })),
      };
    }),

  datenAntrag: publicQuery
    .input(
      z.object({
        session: z.string().min(10).max(80),
        felder: z
          .array(
            z.object({
              feld: z.enum(["strasse", "plz", "ort", "email", "telefon"]),
              neu: z.string().trim().min(1).max(320),
            }),
          )
          .min(1)
          .max(6),
      }),
    )
    .mutation(async ({ input }) => {
      const sess = await ladeSession(input.session);
      const { bereiche } = await ladeBereiche();
      bereichPruefen(bereiche, "daten");
      const p = sess.patient;
      const altKarte: Record<string, string> = {
        strasse: p.strasse,
        plz: p.plz,
        ort: p.ort,
        email: p.email ?? "",
        telefon: p.telefon ?? "",
      };
      const felder = input.felder.map((f) => ({ feld: f.feld, alt: altKarte[f.feld], neu: f.neu }));
      await getDb().insert(patientDatenAntraege).values({
        patientId: sess.patientId,
        felder: JSON.stringify(felder),
      });
      await audit(sess.patientId, "daten-antrag");
      return { ok: true, hinweis: "Ihre Änderungsanfrage wurde übermittelt — die Praxis bestätigt sie vor Übernahme." };
    }),

  // ── Geschützt per Session: Terminanfragen ────────────────────────────────
  terminAnfragen: publicQuery
    .input(z.object({ session: z.string().min(10).max(80) }))
    .query(async ({ input }) => {
      const sess = await ladeSession(input.session);
      const { bereiche } = await ladeBereiche();
      bereichPruefen(bereiche, "terminanfragen");
      await audit(sess.patientId, "terminanfragen");
      const rows = await getDb().query.terminAnfragen.findMany({
        where: eq(terminAnfragen.patientId, sess.patientId),
        orderBy: [desc(terminAnfragen.createdAt)],
        limit: 10,
      });
      return {
        anfragen: rows.map((a) => ({
          id: a.id,
          wunschDatum: a.wunschDatum,
          wunschVon: a.wunschVon,
          wunschBis: a.wunschBis,
          notiz: a.notiz,
          status: a.status,
          praxisKommentar: a.praxisKommentar,
          erstelltAm: a.createdAt,
        })),
      };
    }),

  terminAnfrageErstellen: publicQuery
    .input(
      z.object({
        session: z.string().min(10).max(80),
        wunschDatum: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format JJJJ-MM-TT"),
        wunschVon: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        wunschBis: z.string().regex(/^\d{2}:\d{2}$/).optional(),
        notiz: z.string().max(500).optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const sess = await ladeSession(input.session);
      const { bereiche } = await ladeBereiche();
      bereichPruefen(bereiche, "terminanfragen");
      const heute = new Date().toISOString().slice(0, 10);
      if (input.wunschDatum < heute) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Das Wunschdatum liegt in der Vergangenheit." });
      }
      await getDb().insert(terminAnfragen).values({
        patientId: sess.patientId,
        wunschDatum: input.wunschDatum,
        wunschVon: input.wunschVon ?? null,
        wunschBis: input.wunschBis ?? null,
        notiz: input.notiz ?? null,
      });
      await audit(sess.patientId, "terminanfrage");
      return { ok: true, hinweis: "Ihre Terminanfrage wurde übermittelt — die Praxis meldet sich." };
    }),
});
