import { z } from "zod";
import { TRPCError } from "@trpc/server";
import { and, asc, eq, inArray, isNotNull, isNull, lt } from "drizzle-orm";
import {
  createRouter,
  rechtQuery,
} from "./middleware";
import { getDb } from "./queries/connection";
import { customers, planEntries, products, therapyPlans, users } from "@db/schema";
import { schreibeTimeline } from "./lib/timeline";
import { datumZuKw, heuteIso } from "./lib/kalender";
import { eintraegeSortieren, erstelleEntwurfAusEintraegen } from "./abrechnung";
import {
  DR_REWAWI_CSV_SPALTEN,
  DR_REWAWI_CSV_TRENNZEICHEN,
  DR_REWAWI_CSV_BOM,
  KATEGORIE_LABEL,
  PLAN_STATUS,
  type PlanStatus,
} from "@contracts/constants";

const datumInput = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum im Format JJJJ-MM-TT");
const zeitInput = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Uhrzeit im Format HH:MM")
  .nullable()
  .optional();

const planInput = z.object({
  patientId: z.number().int(),
  titel: z.string().max(255).nullable().optional(),
  vonDatum: datumInput,
  bisDatum: datumInput,
  diagnoseZiele: z.string().nullable().optional(),
  status: z.enum(["geplant", "aktiv", "dokumentiert", "abgerechnet"]).optional(),
  rechnungsempfaengerAbweichend: z.boolean().optional(),
  abweichenderEmpfaenger: z.string().nullable().optional(),
  notizen: z.string().nullable().optional(),
});

const entryInput = z.object({
  planId: z.number().int(),
  datum: datumInput,
  zeitVon: zeitInput,
  zeitBis: zeitInput,
  leistungId: z.number().int().nullable().optional(),
  leistungText: z.string().max(255).nullable().optional(),
  menge: z.string().regex(/^\d+(\.\d{1})?$/, "Menge mit max. 1 Dezimalstelle").optional(),
  therapeutId: z.number().int().nullable().optional(),
  raum: z.string().max(100).nullable().optional(),
  status: z.enum(["geplant", "stattgefunden", "abgesagt", "ausgefallen"]).optional(),
  bemerkung: z.string().max(500).nullable().optional(),
});

// CSV-Feld escapen (Semikolon, Anfuehrungszeichen, Zeilenumbrueche)
function csvFeld(wert: string | number | null | undefined): string {
  const s = wert === null || wert === undefined ? "" : String(wert);
  if (/[;"\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

// ISO-Datum (JJJJ-MM-TT) -> deutsches Format TT.MM.JJJJ
function datumDe(iso: string | null | undefined): string {
  if (!iso) return "";
  const [j, m, t] = iso.split("-");
  return `${t}.${m}.${j}`;
}

export const planRouter = createRouter({
  list: rechtQuery("plaene")
    .input(
      z
        .object({
          patientId: z.number().int().optional(),
          status: z.enum(["geplant", "aktiv", "dokumentiert", "abgerechnet"]).optional(),
          geloescht: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      // Lazy-Purge: endgültige Löschung nach 48 h im Papierkorb
      const ablauf = new Date(Date.now() - 48 * 60 * 60 * 1000);
      await db
        .delete(therapyPlans)
        .where(
          and(
            isNotNull(therapyPlans.geloeschtAm),
            lt(therapyPlans.geloeschtAm, ablauf),
          ),
        );

      const bedingungen = [];
      if (input?.patientId) bedingungen.push(eq(therapyPlans.patientId, input.patientId));
      if (input?.status) bedingungen.push(eq(therapyPlans.status, input.status));
      bedingungen.push(
        input?.geloescht
          ? isNotNull(therapyPlans.geloeschtAm)
          : isNull(therapyPlans.geloeschtAm),
      );
      const rows = await db
        .select({
          plan: therapyPlans,
          patientName: customers.name,
        })
        .from(therapyPlans)
        .innerJoin(customers, eq(therapyPlans.patientId, customers.id))
        .where(bedingungen.length > 0 ? and(...bedingungen) : undefined)
        .orderBy(asc(therapyPlans.vonDatum));
      return rows.map((r) => ({
        ...r.plan,
        patient: { name: r.patientName },
        restorable:
          r.plan.geloeschtAm !== null &&
          r.plan.geloeschtAm.getTime() > Date.now() - 48 * 60 * 60 * 1000,
      }));
    }),

  byId: rechtQuery("plaene")
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const plan = await getDb().query.therapyPlans.findFirst({
        where: eq(therapyPlans.id, input.id),
        with: {
          patient: true,
          entries: {
            orderBy: [asc(planEntries.datum), asc(planEntries.zeitVon)],
            with: {
              leistung: true,
              // Niemals die komplette users-Zeile ausliefern (passwordHash!)
              therapeut: {
                columns: {
                  id: true,
                  name: true,
                  username: true,
                  kalenderFarbe: true,
                },
              },
            },
          },
        },
      });
      if (!plan) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Therapieplan nicht gefunden." });
      }
      // Sortierung je Tag: mit Uhrzeit zuerst, dann ohne, neue Einträge unten
      plan.entries = eintraegeSortieren(plan.entries);
      return plan;
    }),

  create: rechtQuery("plaene").input(planInput).mutation(async ({ ctx, input }) => {
    const db = getDb();
    const [{ id }] = await db
      .insert(therapyPlans)
      .values({ ...input, createdBy: ctx.user.id })
      .$returningId();
    await schreibeTimeline({
      patientId: input.patientId,
      typ: "plan",
      titel: `Therapieplan angelegt (${datumDe(input.vonDatum)}–${datumDe(input.bisDatum)})`,
      beschreibung: input.titel ?? null,
      createdBy: ctx.user.id,
    });
    return { id };
  }),

  update: rechtQuery("plaene")
    .input(z.object({ id: z.number().int(), data: planInput.omit({ patientId: true }).partial() }))
    .mutation(async ({ input }) => {
      await getDb()
        .update(therapyPlans)
        .set(input.data)
        .where(eq(therapyPlans.id, input.id));
      return { ok: true };
    }),

  setStatus: rechtQuery("plaene")
    .input(
      z.object({
        id: z.number().int(),
        status: z.enum(["geplant", "aktiv", "dokumentiert", "abgerechnet"]),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const alt = await db.query.therapyPlans.findFirst({
        where: eq(therapyPlans.id, input.id),
      });
      if (!alt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Therapieplan nicht gefunden." });
      }
      await db.update(therapyPlans).set({ status: input.status }).where(eq(therapyPlans.id, input.id));
      if (alt.status !== input.status) {
        await schreibeTimeline({
          patientId: alt.patientId,
          typ: "status",
          titel: `Planstatus: ${PLAN_STATUS[alt.status]} → ${PLAN_STATUS[input.status]}`,
          beschreibung: alt.titel ?? null,
          createdBy: ctx.user.id,
        });
      }
      return { ok: true };
    }),

  // ── Planeinträge ────────────────────────────────────────────────────────
  addEntry: rechtQuery("plaene").input(entryInput).mutation(async ({ input }) => {
    const [{ id }] = await getDb().insert(planEntries).values(input).$returningId();
    return { id };
  }),

  updateEntry: rechtQuery("plaene")
    .input(z.object({ id: z.number().int(), data: entryInput.omit({ planId: true }).partial() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const alt = await db.query.planEntries.findFirst({
        where: eq(planEntries.id, input.id),
      });
      if (!alt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Eintrag nicht gefunden." });
      }
      await db.update(planEntries).set(input.data).where(eq(planEntries.id, input.id));
      // Timeline nur bei Absage/Ausfall — nicht bei jeder Statusaenderung,
      // sonst wird die Chronik geflutet.
      const neuerStatus = input.data.status;
      if (
        neuerStatus &&
        neuerStatus !== alt.status &&
        (neuerStatus === "abgesagt" || neuerStatus === "ausgefallen")
      ) {
        const plan = await db.query.therapyPlans.findFirst({
          where: eq(therapyPlans.id, alt.planId),
        });
        if (plan) {
          await schreibeTimeline({
            patientId: plan.patientId,
            typ: "termin",
            titel: `Termin ${neuerStatus}: ${alt.leistungText ?? "Eintrag"} am ${datumDe(alt.datum)}`,
            beschreibung: input.data.bemerkung ?? alt.bemerkung ?? null,
            datum: alt.datum,
            createdBy: ctx.user.id,
          });
        }
      }
      return { ok: true };
    }),

  removeEntry: rechtQuery("plaene")
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ input }) => {
      await getDb().delete(planEntries).where(eq(planEntries.id, input.id));
      return { ok: true };
    }),

  // ── Serie anlegen: jede Woche × jeden Wochentag ab startDatum ───────────
  // wochentage: 1 = Mo … 5 = Fr. Datumsberechnung rein in TS (Montag-basiert).
  serieAnlegen: rechtQuery("plaene")
    .input(
      z.object({
        planId: z.number().int(),
        leistungId: z.number().int().nullable().optional(),
        leistungText: z.string().max(255).nullable().optional(),
        menge: z.string().regex(/^\d+(\.\d{1})?$/, "Menge mit max. 1 Dezimalstelle").optional(),
        therapeutId: z.number().int().nullable().optional(),
        raum: z.string().max(100).nullable().optional(),
        zeitVon: zeitInput,
        zeitBis: zeitInput,
        wochentage: z.array(z.number().int().min(1).max(5)).min(1),
        startDatum: datumInput,
        anzahlWochen: z.number().int().min(1).max(52),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const plan = await db.query.therapyPlans.findFirst({
        where: eq(therapyPlans.id, input.planId),
      });
      if (!plan) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Therapieplan nicht gefunden." });
      }

      // Montag der Startwoche bestimmen (lokal, ohne Zeitzonen-Falle: String-Rechnung)
      const start = new Date(input.startDatum + "T00:00:00Z");
      const startWochentag = start.getUTCDay() === 0 ? 7 : start.getUTCDay();
      const montag = new Date(start);
      montag.setUTCDate(start.getUTCDate() - (startWochentag - 1));

      const tage: string[] = [];
      const wochentageSortiert = [...new Set(input.wochentage)].sort((a, b) => a - b);
      for (let woche = 0; woche < input.anzahlWochen; woche++) {
        for (const wt of wochentageSortiert) {
          const d = new Date(montag);
          d.setUTCDate(montag.getUTCDate() + woche * 7 + (wt - 1));
          const iso = d.toISOString().slice(0, 10);
          // Nur Tage ab dem Startdatum aufnehmen
          if (iso >= input.startDatum) tage.push(iso);
        }
      }

      if (tage.length > 0) {
        await db.insert(planEntries).values(
          tage.map((datum) => ({
            planId: input.planId,
            datum,
            zeitVon: input.zeitVon ?? null,
            zeitBis: input.zeitBis ?? null,
            leistungId: input.leistungId ?? null,
            leistungText: input.leistungText ?? null,
            menge: input.menge ?? "1",
            therapeutId: input.therapeutId ?? null,
            raum: input.raum ?? null,
          })),
        );
      }
      return { ok: true, anzahl: tage.length };
    }),

  // ── Block-Aktionen: markierte Einträge gemeinsam löschen/duplizieren ─────
  bulk: rechtQuery("plaene")
    .input(
      z.object({
        ids: z.array(z.number().int()).min(1).max(200),
        aktion: z.enum(["loeschen", "duplizieren"]),
        zielDatum: datumInput.optional(), // nur bei duplizieren: sonst selber Tag
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const eintraege = await db.query.planEntries.findMany({
        where: inArray(planEntries.id, input.ids),
      });
      if (eintraege.length === 0) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Keine Einträge gefunden." });
      }
      if (input.aktion === "loeschen") {
        await db.delete(planEntries).where(inArray(planEntries.id, input.ids));
        return { ok: true, anzahl: eintraege.length };
      }
      await db.insert(planEntries).values(
        eintraege.map((e) => ({
          planId: e.planId,
          datum: input.zielDatum ?? e.datum,
          zeitVon: e.zeitVon,
          zeitBis: e.zeitBis,
          leistungId: e.leistungId,
          leistungText: e.leistungText,
          menge: e.menge,
          therapeutId: e.therapeutId,
          raum: e.raum,
          status: "geplant" as const,
          bemerkung: e.bemerkung,
        })),
      );
      return { ok: true, anzahl: eintraege.length };
    }),

  // ── Papierkorb: Soft-Delete + Wiederherstellen (48 h) ───────────────────
  // Löschbar: geplant/aktiv/dokumentiert — abgerechnet NIEMALS (GoBD-Feld).
  loeschen: rechtQuery("plaene")
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const plan = await db.query.therapyPlans.findFirst({
        where: eq(therapyPlans.id, input.id),
      });
      if (!plan) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Therapieplan nicht gefunden." });
      }
      if (plan.status === "abgerechnet") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Abgerechnete Pläne können nicht gelöscht werden.",
        });
      }
      if (plan.geloeschtAm) return { ok: true };
      await db
        .update(therapyPlans)
        .set({ geloeschtAm: new Date() })
        .where(eq(therapyPlans.id, input.id));
      await schreibeTimeline({
        patientId: plan.patientId,
        typ: "status",
        titel: `Therapieplan in den Papierkorb gelegt (${plan.titel ?? `#${plan.id}`})`,
        beschreibung: "48 Stunden wiederherstellbar",
        createdBy: ctx.user.id,
      });
      return { ok: true };
    }),

  wiederherstellen: rechtQuery("plaene")
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const plan = await db.query.therapyPlans.findFirst({
        where: eq(therapyPlans.id, input.id),
      });
      if (!plan || !plan.geloeschtAm) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Plan nicht im Papierkorb." });
      }
      if (plan.geloeschtAm.getTime() <= Date.now() - 48 * 60 * 60 * 1000) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Die 48-Stunden-Frist ist abgelaufen — der Plan wurde endgültig gelöscht.",
        });
      }
      await db
        .update(therapyPlans)
        .set({ geloeschtAm: null })
        .where(eq(therapyPlans.id, input.id));
      await schreibeTimeline({
        patientId: plan.patientId,
        typ: "status",
        titel: `Therapieplan wiederhergestellt (${plan.titel ?? `#${plan.id}`})`,
        createdBy: ctx.user.id,
      });
      return { ok: true };
    }),

  // ── Plan als dokumentiert markieren ─────────────────────────────────────
  dokumentieren: rechtQuery("plaene")
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const plan = await db.query.therapyPlans.findFirst({
        where: eq(therapyPlans.id, input.id),
      });
      if (!plan) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Therapieplan nicht gefunden." });
      }
      // Status-Guard: idempotent bei bereits dokumentiertem Plan; kein
      // Rueckwaertssprung aus 'abgerechnet'
      if (plan.status === "dokumentiert") {
        return { ok: true };
      }
      if (plan.status === "abgerechnet") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Der Plan ist bereits abgerechnet und kann nicht mehr zurueckgesetzt werden.",
        });
      }
      await db
        .update(therapyPlans)
        .set({ status: "dokumentiert" })
        .where(eq(therapyPlans.id, input.id));
      await schreibeTimeline({
        patientId: plan.patientId,
        typ: "status",
        titel: `Planstatus: ${PLAN_STATUS[plan.status]} → ${PLAN_STATUS.dokumentiert}`,
        beschreibung: plan.titel ?? null,
        createdBy: ctx.user.id,
      });
      return { ok: true };
    }),

  // ── Einzelnen Eintrag duplizieren (landet unten am selben oder neuem Tag) ─
  duplicateEntry: rechtQuery("plaene")
    .input(z.object({ id: z.number().int(), datum: datumInput.optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const alt = await db.query.planEntries.findFirst({
        where: eq(planEntries.id, input.id),
      });
      if (!alt) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Eintrag nicht gefunden." });
      }
      const [{ id }] = await db
        .insert(planEntries)
        .values({
          planId: alt.planId,
          datum: input.datum ?? alt.datum,
          zeitVon: alt.zeitVon,
          zeitBis: alt.zeitBis,
          leistungId: alt.leistungId,
          leistungText: alt.leistungText,
          menge: alt.menge,
          therapeutId: alt.therapeutId,
          raum: alt.raum,
          status: "geplant" as const, // Kopien starten als geplant
          bemerkung: alt.bemerkung,
        })
        .$returningId();
      return { id };
    }),

  // ── Alle Einträge eines Tages auf einen anderen Tag duplizieren ──────────
  duplicateDay: rechtQuery("plaene")
    .input(
      z.object({
        planId: z.number().int(),
        vonDatum: datumInput,
        nachDatum: datumInput,
        modus: z.enum(["kopieren", "verschieben"]).default("kopieren"),
      }),
    )
    .mutation(async ({ input }) => {
      if (input.vonDatum === input.nachDatum) {
        throw new TRPCError({ code: "BAD_REQUEST", message: "Quell- und Zieldatum sind gleich." });
      }
      const db = getDb();
      const plan = await db.query.therapyPlans.findFirst({
        where: eq(therapyPlans.id, input.planId),
      });
      if (!plan) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Therapieplan nicht gefunden." });
      }
      if (input.nachDatum < plan.vonDatum || input.nachDatum > plan.bisDatum) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Zieldatum liegt außerhalb des Plan-Zeitraums.",
        });
      }
      const quell = await db.query.planEntries.findMany({
        where: and(eq(planEntries.planId, input.planId), eq(planEntries.datum, input.vonDatum)),
      });
      if (quell.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: `Am ${datumDe(input.vonDatum)} gibt es keine Einträge zum Duplizieren.`,
        });
      }
      if (input.modus === "verschieben") {
        // Verschieben = echtes Move: Quelle aktualisieren statt kopieren
        await db
          .update(planEntries)
          .set({ datum: input.nachDatum })
          .where(
            and(eq(planEntries.planId, input.planId), eq(planEntries.datum, input.vonDatum)),
          );
        return { ok: true, anzahl: quell.length };
      }
      await db.insert(planEntries).values(
        quell.map((e) => ({
          planId: input.planId,
          datum: input.nachDatum,
          zeitVon: e.zeitVon,
          zeitBis: e.zeitBis,
          leistungId: e.leistungId,
          leistungText: e.leistungText,
          menge: e.menge,
          therapeutId: e.therapeutId,
          raum: e.raum,
          status: "geplant" as const,
          bemerkung: e.bemerkung,
        })),
      );
      return { ok: true, anzahl: quell.length };
    }),

  // ── Direkt verrechnen: Plan → Rechnungsentwurf (der Fusion-Weg) ──────────
  rechnungErstellen: rechtQuery("plaene")
    .input(z.object({ id: z.number().int() }))
    .mutation(async ({ ctx, input }) => {
      const db = getDb();
      const plan = await db.query.therapyPlans.findFirst({
        where: eq(therapyPlans.id, input.id),
        with: { entries: true },
      });
      if (!plan) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Therapieplan nicht gefunden." });
      }
      if (plan.status !== "dokumentiert") {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Erst „Woche dokumentieren“, dann die Rechnung erstellen (verrechnet werden nur dokumentierte Pläne).",
        });
      }
      const eintraege = eintraegeSortieren(plan.entries)
        .filter((e) => e.status === "stattgefunden")
        .map((e) => ({
          datum: e.datum,
          menge: Number(e.menge),
          leistungText: e.leistungText ?? "Leistung",
          leistungId: e.leistungId,
        }));
      if (eintraege.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message: "Keine Einträge mit Status „stattgefunden“ — bitte zuerst die tatsächlich erbrachten Leistungen markieren.",
        });
      }

      const quelle = `Therapieplan #${plan.id} (${datumDe(plan.vonDatum)}–${datumDe(plan.bisDatum)})`;
      const ergebnis = await erstelleEntwurfAusEintraegen(
        plan.patientId,
        eintraege,
        quelle,
        ctx.user.id,
      );

      // Plan ist damit abgerechnet + Chronik
      await db
        .update(therapyPlans)
        .set({ status: "abgerechnet" })
        .where(eq(therapyPlans.id, plan.id));
      await schreibeTimeline({
        patientId: plan.patientId,
        typ: "status",
        titel: `Rechnungsentwurf #${ergebnis.invoiceId} aus Therapieplan #${plan.id} erstellt`,
        beschreibung: `Planstatus: Dokumentiert → Abgerechnet · ${eintraege.length} Positionen` +
          (ergebnis.nichtUebernommen.length > 0
            ? ` · ${ergebnis.nichtUebernommen.length} nicht übernommen`
            : ""),
        createdBy: ctx.user.id,
      });

      return ergebnis;
    }),

  // ── Dr.ReWaWi-Export (CSV, nur stattgefundene Einträge) ─────────────────
  exportDrReWaWi: rechtQuery("plaene")
    .input(z.object({ id: z.number().int() }))
    .query(async ({ input }) => {
      const db = getDb();
      const plan = await db.query.therapyPlans.findFirst({
        where: eq(therapyPlans.id, input.id),
        with: { patient: true },
      });
      if (!plan) {
        throw new TRPCError({ code: "NOT_FOUND", message: "Therapieplan nicht gefunden." });
      }
      const rows = await db
        .select({
          entry: planEntries,
          leistungKategorie: products.kategorie,
          therapeutName: users.name,
        })
        .from(planEntries)
        .leftJoin(products, eq(planEntries.leistungId, products.id))
        .leftJoin(users, eq(planEntries.therapeutId, users.id))
        .where(and(eq(planEntries.planId, input.id), eq(planEntries.status, "stattgefunden")))
        .orderBy(asc(planEntries.datum), asc(planEntries.zeitVon));

      if (rows.length === 0) {
        throw new TRPCError({
          code: "BAD_REQUEST",
          message:
            "Der Export wäre leer: Keine Einträge mit Status „stattgefunden“. Bitte zuerst die erbrachten Leistungen markieren (oder direkt „Rechnung erstellen“).",
        });
      }

      const p = plan.patient;
      // Kundenname ist „Nachname, Vorname" (oder nur Nachname)
      const komma = p.name.indexOf(",");
      const nachname = komma >= 0 ? p.name.slice(0, komma).trim() : p.name;
      const vorname = komma >= 0 ? p.name.slice(komma + 1).trim() : "";
      const zeilen = rows.map((r) =>
        [
          p.patientenNr,
          nachname,
          vorname,
          datumDe(p.geburtsdatum),
          p.strasse,
          p.plz,
          p.ort,
          p.email,
          p.telefon,
          plan.rechnungsempfaengerAbweichend ? "ja" : "nein",
          plan.rechnungsempfaengerAbweichend ? plan.abweichenderEmpfaenger : "",
          datumDe(r.entry.datum),
          r.entry.leistungText,
          r.entry.menge, // Punkt-Dezimal (Festlegung, s. contracts/constants.ts)
          r.leistungKategorie ? KATEGORIE_LABEL[r.leistungKategorie] : "",
          r.therapeutName,
          r.entry.bemerkung,
        ]
          .map(csvFeld)
          .join(DR_REWAWI_CSV_TRENNZEICHEN),
      );
      const csv =
        DR_REWAWI_CSV_BOM +
        [DR_REWAWI_CSV_SPALTEN.map(csvFeld).join(DR_REWAWI_CSV_TRENNZEICHEN), ...zeilen].join("\r\n");

      const { kw } = datumZuKw(heuteIso());
      return {
        dateiname: `therapieplan-${input.id}-KW${kw}.csv`,
        csv,
      };
    }),
});

// Type-Helper fuer das Frontend (Status eines Plans)
export type { PlanStatus };
