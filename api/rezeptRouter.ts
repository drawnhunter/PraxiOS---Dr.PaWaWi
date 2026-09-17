// ── PraxiOS: Privat-Rezepte & Atteste ───────────────────────────────────────
// Erstellt Verordnungen/Bescheinigungen als PDF (mit Unterschrifts-Stempel aus
// den Praxis-Einstellungen), legt sie als Dokument in der Akte ab und
// protokolliert Erstellung/Löschung.
import { z } from "zod";
import crypto from "node:crypto";
import path from "node:path";
import { mkdirSync } from "node:fs";
import { readFile, unlink, writeFile } from "node:fs/promises";
import { TRPCError } from "@trpc/server";
import { desc, eq, isNull } from "drizzle-orm";
import { createRouter, rechtQuery } from "./middleware";
import { getDb } from "./queries/connection";
import { companySettings, customers, documents, loeschprotokoll, rezepte } from "@db/schema";
import { env } from "./lib/env";
import { renderRezeptPdf } from "./rezeptPdf";
import { renderAuPdf } from "./auPdf";
import { icdSuche } from "./lib/icd";
import { schreibeTimeline } from "./lib/timeline";
import type { AttestInhalt, RezeptInhalt } from "@contracts/rezepte";

const medikamentInput = z.object({
  name: z.string().trim().min(1, "Medikament fehlt").max(300),
  staerke: z.string().trim().max(100).optional(),
  menge: z.string().trim().max(100).optional(),
  dosierung: z.string().trim().max(300).optional(),
  pzn: z.string().trim().max(20).optional(),
});

const DATUM_RE = /^\d{2}\.\d{2}\.\d{4}$/;

const erstellenInput = z.discriminatedUnion("typ", [
  z.object({
    typ: z.literal("rezept"),
    patientId: z.number().int(),
    inhalt: z.object({
      medikamente: z.array(medikamentInput).min(1, "Mindestens ein Medikament").max(10),
      hinweis: z.string().max(1000).optional(),
    }),
  }),
  // Praxisbedarf (1.12.0): „zur Anwendung in der Praxis" — bewusst OHNE
  // Patienten. Kein Schein-Patient mehr nötig.
  z.object({
    typ: z.literal("praxisbedarf"),
    inhalt: z.object({
      medikamente: z.array(medikamentInput).min(1, "Mindestens ein Medikament").max(10),
      hinweis: z.string().max(1000).optional(),
    }),
  }),
  z.object({
    typ: z.literal("attest"),
    patientId: z.number().int(),
    inhalt: z.object({
      art: z.enum(["krankschreibung", "attest"]),
      auVon: z.string().regex(DATUM_RE, "Format TT.MM.JJJJ").optional(),
      auBis: z.string().regex(DATUM_RE, "Format TT.MM.JJJJ").optional(),
      text: z.string().max(4000).default(""),
      feststellungsdatum: z.string().regex(DATUM_RE, "Format TT.MM.JJJJ").optional(),
      erstbescheinigung: z.boolean().optional(),
      feststellungsOrt: z.string().trim().max(120).optional(),
      diagnoseAusweisen: z.boolean().optional(),
      icdCodes: z
        .array(z.object({ code: z.string().trim().min(2).max(10), text: z.string().trim().min(1).max(300) }))
        .max(10)
        .optional(),
      // AU-Formular v2 (1.16.0)
      ausfertigung: z.enum(["arbeitgeber", "krankenkasse"]).optional(),
      arbeitsunfall: z.boolean().optional(),
      durchgangsarzt: z.boolean().optional(),
      sonstigerUnfall: z.boolean().optional(),
      versorgungsleiden: z.boolean().optional(),
      reha: z.boolean().optional(),
      wiedereingliederung: z.boolean().optional(),
      krankengeld: z.enum(["7woche", "sonstiger", "endbescheinigung"]).nullable().optional(),
    }),
  }),
]);

function heuteDe(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()}`;
}

function isoNachDe(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : null;
}

export const rezeptRouter = createRouter({
  /** ICD-10-GM-Katalog-Suche (lokal, kodierbare Endpunkte). */
  icdSuche: rechtQuery("dokumente")
    .input(z.object({ q: z.string().trim().min(2).max(100) }))
    .query(async ({ input }) => icdSuche(input.q)),

  liste: rechtQuery("dokumente")
    .input(z.object({ patientId: z.number().int() }))
    .query(async ({ input }) => {
      return getDb().query.rezepte.findMany({
        where: eq(rezepte.patientId, input.patientId),
        orderBy: [desc(rezepte.createdAt)],
        with: { ersteller: { columns: { id: true, name: true, username: true } } },
      });
    }),

  // Praxisbedarf-Bestellungen (patientenlos, 1.12.0) — eigene Liste auf der
  // Menü-Seite, damit Bestellungen nachvollziehbar bleiben.
  listePraxisbedarf: rechtQuery("dokumente").query(async () => {
    return getDb().query.rezepte.findMany({
      where: isNull(rezepte.patientId),
      orderBy: [desc(rezepte.createdAt)],
      with: { ersteller: { columns: { id: true, name: true, username: true } } },
      limit: 100,
    });
  }),

  // Zuletzt erstellte Rezepte/Atteste praxisweit (für die eigene Menü-Seite)
  letzte: rechtQuery("dokumente")
    .input(z.object({ limit: z.number().int().min(1).max(50).default(15) }).optional())
    .query(async ({ input }) => {
      return getDb().query.rezepte.findMany({
        orderBy: [desc(rezepte.createdAt)],
        limit: input?.limit ?? 15,
        with: {
          patient: { columns: { id: true, name: true } },
          ersteller: { columns: { id: true, name: true, username: true } },
        },
      });
    }),

  erstellen: rechtQuery("dokumente")
    .input(erstellenInput)
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const istPraxisbedarf = input.typ === "praxisbedarf";
      // Patient nur bei rezept/attest — Praxisbedarf hat bewusst keinen.
      const patient = "patientId" in input
        ? await db.query.customers.findFirst({
            where: eq(customers.id, input.patientId),
          })
        : null;
      if (!istPraxisbedarf && !patient) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Patient nicht gefunden." });
      }

      const praxis = await db.query.companySettings.findFirst({
        where: eq(companySettings.id, 1),
      });
      if (!praxis) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "Bitte zuerst die Praxisdaten in den Einstellungen hinterlegen.",
        });
      }

      const datum = heuteDe();
      const istAU =
        input.typ === "attest" && (input.inhalt as AttestInhalt).art === "krankschreibung";

      // ── AU (1.16.1): IMMER beide Ausfertigungen (Arbeitgeber + Krankenkasse)
      // — wie auf dem echten Vordruck. Zwei Dokumente, zwei Einträge.
      if (istAU) {
        const exemplare = [
          { key: "arbeitgeber" as const, suffix: "Arbeitgeber" },
          { key: "krankenkasse" as const, suffix: "Krankenkasse" },
        ];
        const ergebnisse: { id: number; documentId: number }[] = [];
        for (const ex of exemplare) {
          const pdfBuf = await renderAuPdf({
            inhalt: { ...(input.inhalt as AttestInhalt), ausfertigung: ex.key },
            patient: {
              name: patient!.name,
              geburtsdatum: isoNachDe(patient!.geburtsdatum),
              strasse: patient!.strasse,
              plz: patient!.plz,
              ort: patient!.ort,
              krankenkasse: patient!.krankenkasse,
              versichertennummer: patient!.versichertennummer,
            },
            praxis: {
              name: praxis.name,
              strasse: praxis.strasse,
              plz: praxis.plz,
              ort: praxis.ort,
              telefon: praxis.telefon,
              email: praxis.email,
              arztNr: praxis.arztNr,
              betriebsstaettenNr: praxis.betriebsstaettenNr,
              fachrichtung: praxis.fachrichtung,
            },
            signaturBild: praxis.signaturBild,
            datum,
          });

          const dateinameIntern = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.pdf`;
          const ordner = String(patient!.id);
          const relativerPfad = `${ordner}/${dateinameIntern}`;
          mkdirSync(path.join(env.uploadDir, ordner), { recursive: true });
          await writeFile(path.join(env.uploadDir, relativerPfad), pdfBuf);

          const [{ id: documentId }] = await db
            .insert(documents)
            .values({
              patientId: patient!.id,
              kategorie: "arztbrief",
              dateiname: `Krankschreibung-${ex.suffix} ${datum}.pdf`,
              dateipfad: relativerPfad,
              mimeType: "application/pdf",
              groesse: pdfBuf.length,
              uploadedBy: ctx.user.id,
            })
            .$returningId();

          const [{ id }] = await db
            .insert(rezepte)
            .values({
              patientId: patient!.id,
              typ: "attest",
              inhalt: JSON.stringify({ ...(input.inhalt as AttestInhalt), ausfertigung: ex.key }),
              documentId,
              createdBy: ctx.user.id,
            })
            .$returningId();
          ergebnisse.push({ id, documentId });
        }

        await schreibeTimeline({
          patientId: patient!.id,
          typ: "dokument",
          titel: "Krankschreibung erstellt (beide Ausfertigungen)",
          beschreibung: `AU ${(input.inhalt as AttestInhalt).auVon ?? datum} – ${(input.inhalt as AttestInhalt).auBis ?? "?"}`,
          createdBy: ctx.user.id,
        });

        return {
          id: ergebnisse[0].id,
          documentId: ergebnisse[0].documentId,
          ids: ergebnisse.map((e) => e.id),
        };
      }

      const pdfBuf = await renderRezeptPdf({
            typ: input.typ,
            inhalt: input.inhalt as RezeptInhalt | AttestInhalt,
            patient: patient
              ? {
                  name: patient.name,
                  geburtsdatum: isoNachDe(patient.geburtsdatum),
                  strasse: patient.strasse,
                  plz: patient.plz,
                  ort: patient.ort,
                }
              : null,
            praxis: {
              name: praxis.name,
              strasse: praxis.strasse,
              plz: praxis.plz,
              ort: praxis.ort,
              telefon: praxis.telefon,
              email: praxis.email,
              arztNr: praxis.arztNr,
              betriebsstaettenNr: praxis.betriebsstaettenNr,
              fachrichtung: praxis.fachrichtung,
            },
            signaturBild: praxis.signaturBild,
            datum,
          });

      // Datei ablegen — Praxisbedarf im praxisweiten Ordner, nicht in einer Akte
      const dateinameIntern = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}.pdf`;
      const ordner = patient ? String(patient.id) : "_praxis";
      const relativerPfad = `${ordner}/${dateinameIntern}`;
      mkdirSync(path.join(env.uploadDir, ordner), { recursive: true });
      await writeFile(path.join(env.uploadDir, relativerPfad), pdfBuf);

      const anzeigeName =
        input.typ === "rezept"
          ? `Privatrezept ${datum}.pdf`
          : istPraxisbedarf
            ? `Praxisbedarf ${datum}.pdf`
            : (input.inhalt as AttestInhalt).art === "krankschreibung"
              ? `Krankschreibung ${datum}.pdf`
              : `Attest ${datum}.pdf`;

      const [{ id: documentId }] = await db
        .insert(documents)
        .values({
          patientId: patient?.id ?? null,
          kategorie: input.typ === "attest" ? "arztbrief" : "rezept",
          dateiname: anzeigeName,
          dateipfad: relativerPfad,
          mimeType: "application/pdf",
          groesse: pdfBuf.length,
          uploadedBy: ctx.user.id,
        })
        .$returningId();

      const [{ id }] = await db
        .insert(rezepte)
        .values({
          patientId: patient?.id ?? null,
          typ: input.typ,
          inhalt: JSON.stringify(input.inhalt),
          documentId,
          createdBy: ctx.user.id,
        })
        .$returningId();

      // Timeline nur bei Patientenbezug (Praxisbedarf taucht in keiner Akte auf)
      if (patient) {
        await schreibeTimeline({
          patientId: patient.id,
          typ: "dokument",
          titel: input.typ === "rezept" ? "Privatrezept erstellt" : "Attest erstellt",
          beschreibung:
            input.typ === "rezept"
              ? (input.inhalt as RezeptInhalt).medikamente
                  .map((m) => [m.name, m.staerke].filter(Boolean).join(" "))
                  .join(", ")
              : (input.inhalt as AttestInhalt).art === "krankschreibung"
                ? `AU ${(input.inhalt as AttestInhalt).auVon ?? datum} – ${(input.inhalt as AttestInhalt).auBis ?? "?"}`
                : null,
          createdBy: ctx.user.id,
        });
      }

      return { id, documentId };
    }),

  pdf: rechtQuery("dokumente")
    .input(z.object({ id: z.number().int(), format: z.enum(["a5", "a4"]).optional() }))
    .query(async ({ input }) => {
      const db = getDb();
      const r = await db.query.rezepte.findFirst({
        where: eq(rezepte.id, input.id),
        with: { dokument: true },
      });
      if (!r?.dokument) {
        throw new TRPCError({ code: "NOT_FOUND", message: "PDF nicht gefunden." });
      }
      // A5 (Standard): das beim Erstellen abgelegte PDF; A4: frisch im
      // Querformat neu gerendert (Inhalt aus der DB)
      if ((input.format ?? "a5") === "a5") {
        const buf = await readFile(path.join(env.uploadDir, r.dokument.dateipfad));
        return { dateiname: r.dokument.dateiname, base64: buf.toString("base64") };
      }
      const patient = r.patientId
        ? await db.query.customers.findFirst({
            where: eq(customers.id, r.patientId),
          })
        : null;
      const praxis = await db.query.companySettings.findFirst({
        where: eq(companySettings.id, 1),
      });
      if ((r.patientId && !patient) || !praxis) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Daten fehlen." });
      }
      const datum = r.createdAt.toLocaleDateString("de-DE");
      const inhaltParsed = JSON.parse(r.inhalt) as AttestInhalt;
      const istAU = r.typ === "attest" && inhaltParsed.art === "krankschreibung";
      const pdfBuf = istAU
        ? await renderAuPdf({
            inhalt: inhaltParsed,
            patient: {
              name: patient!.name,
              geburtsdatum: isoNachDe(patient!.geburtsdatum),
              strasse: patient!.strasse,
              plz: patient!.plz,
              ort: patient!.ort,
              krankenkasse: patient!.krankenkasse,
              versichertennummer: patient!.versichertennummer,
            },
            praxis: {
              name: praxis.name,
              strasse: praxis.strasse,
              plz: praxis.plz,
              ort: praxis.ort,
              telefon: praxis.telefon,
              email: praxis.email,
              arztNr: praxis.arztNr,
              betriebsstaettenNr: praxis.betriebsstaettenNr,
              fachrichtung: praxis.fachrichtung,
            },
            signaturBild: praxis.signaturBild,
            datum,
          })
        : await renderRezeptPdf({
            typ: r.typ,
            inhalt: JSON.parse(r.inhalt),
            patient: patient
              ? {
                  name: patient.name,
                  geburtsdatum: isoNachDe(patient.geburtsdatum),
                  strasse: patient.strasse,
                  plz: patient.plz,
                  ort: patient.ort,
                }
              : null,
            praxis: {
              name: praxis.name,
              strasse: praxis.strasse,
              plz: praxis.plz,
              ort: praxis.ort,
              telefon: praxis.telefon,
              email: praxis.email,
              arztNr: praxis.arztNr,
              betriebsstaettenNr: praxis.betriebsstaettenNr,
              fachrichtung: praxis.fachrichtung,
            },
            signaturBild: praxis.signaturBild,
            datum,
            format: "a4",
          });
      return { dateiname: r.dokument.dateiname, base64: pdfBuf.toString("base64") };
    }),

  loeschen: rechtQuery("dokumente")
    .input(z.object({ id: z.number().int(), grund: z.string().max(500).optional() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const r = await db.query.rezepte.findFirst({
        where: eq(rezepte.id, input.id),
        with: { dokument: true, patient: { columns: { id: true, name: true, patientenNr: true } } },
      });
      if (!r) throw new TRPCError({ code: "NOT_FOUND", message: "Eintrag nicht gefunden." });

      if (r.dokument) {
        await unlink(path.join(env.uploadDir, r.dokument.dateipfad)).catch(() => {});
        await db.delete(documents).where(eq(documents.id, r.dokument.id));
      }
      await db.delete(rezepte).where(eq(rezepte.id, input.id));

      await db.insert(loeschprotokoll).values({
        patientenNr: r.patient?.patientenNr ?? null,
        patientKuerzel: r.patient?.name?.slice(0, 20) ?? null,
        umfang: `${r.typ === "rezept" ? "Privatrezept" : "Attest"} #${r.id} (${r.dokument?.dateiname ?? "ohne Datei"})`,
        grund: input.grund ?? "Löschung über Rezepte/Atteste",
        geloeschtVon: ctx.user.name || ctx.user.username || `#${ctx.user.id}`,
      });
      return { ok: true };
    }),
});
