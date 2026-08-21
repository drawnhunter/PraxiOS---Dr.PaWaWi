import { z } from "zod";
import {
  createRouter,
  rechtQuery,
} from "./middleware";
import { getDb } from "./queries/connection";
import {
  invoices,
  invoiceItems,
  invoiceTherapieWochen,
  creditNotes,
  creditNoteItems,
  customers,
  companySettings,
  bankAccounts,
  bankTransaktionen,
  mailLog,
  therapyPlans,
} from "@db/schema";
import { schreibeTimeline } from "./lib/timeline";
import { eq, desc, and, ne, inArray } from "drizzle-orm";
import {
  computeTotals,
  centToDecimal,
  nextNumber,
  formatInvoiceNumber,
} from "./queries/invoicing";

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Format: JJJJ-MM-TT");

const itemInput = z.object({
  bezeichnung: z.string().min(1),
  beschreibung: z.string().nullable().optional(),
  menge: z.string().regex(/^\d+(\.\d{1,3})?$/, "Menge mit max. 3 Dezimalstellen"),
  einheit: z.string().min(1).default("Stück"),
  einzelpreis: z.string().regex(/^-?\d+(\.\d{1,2})?$/, "Preis mit max. 2 Dezimalstellen"),
  ustSatz: z.number().int().refine((v) => [19, 7, 0].includes(v), "Nur 19 %, 7 % oder 0 %"),
});

const kopfInput = z.object({
  customerId: z.number(),
  rechnungsdatum: dateString,
  faelligkeitsdatum: dateString,
  leistungsdatum: z.string().nullable().optional(),
  bankAccountId: z.number().nullable().optional(),
  kundeName: z.string().min(1),
  kundeZusatz: z.string().nullable().optional(),
  kundeStrasse: z.string().min(1),
  kundePlz: z.string().min(1),
  kundeOrt: z.string().min(1),
  kundeLand: z.string().default("Deutschland"),
  pdfNotiz: z.string().nullable().optional(),
  bereitsBezahlt: z.boolean().optional(),
  bemerkung: z.string().nullable().optional(),
});

async function ladeRechnungMitDetails(id: number) {
  const db = getDb();
  const rechnung = await db.query.invoices.findFirst({
    where: eq(invoices.id, id),
    with: {
      items: true,
      customer: true,
      bankAccount: true,
      creditNotes: { with: { items: true } },
    },
  });
  if (rechnung?.items) {
    rechnung.items.sort((a, b) => a.position - b.position);
  }
  return rechnung;
}

export const invoiceRouter = createRouter({
  list: rechtQuery("abrechnung")
    .input(
      z
        .object({
          status: z.enum(["entwurf", "finalisiert", "storniert"]).optional(),
          archiviert: z.boolean().optional(), // Standard: nur nicht-archivierte
        })
        .optional(),
    )
    .query(async ({ input }) => {
      const db = getDb();
      const bed = [
        ...(input?.status ? [eq(invoices.status, input.status)] : []),
        eq(invoices.archiviert, input?.archiviert ?? false),
      ];
      const rows = await db.query.invoices.findMany({
        where: and(...bed),
        orderBy: [desc(invoices.createdAt)],
        with: { creditNotes: true },
      });
      return rows;
    }),

  get: rechtQuery("abrechnung")
    .input(z.object({ id: z.number() }))
    .query(({ input }) => ladeRechnungMitDetails(input.id)),

  /** Neuen Entwurf anlegen — Kundenadresse wird als Snapshot kopiert. */
  createDraft: rechtQuery("abrechnung")
    .input(
      z.object({
        customerId: z.number(),
        typ: z.enum(["standard", "proforma"]).default("standard"),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const kunde = await db.query.customers.findFirst({
        where: eq(customers.id, input.customerId),
      });
      if (!kunde) throw new Error("Kunde nicht gefunden.");

      const settings = await db.query.companySettings.findFirst({
        where: eq(companySettings.id, 1),
      });
      // Kundenspezifisches Zahlungsziel hat Vorrang vor dem Standard
      const zielTage =
        kunde.zahlungszielTage ?? settings?.standardZahlungsziel ?? 14;

      const heute = new Date();
      const faellig = new Date(heute);
      faellig.setDate(faellig.getDate() + zielTage);
      const fmt = (d: Date) => d.toISOString().slice(0, 10);

      const standardBank = await db.query.bankAccounts.findFirst({
        where: eq(bankAccounts.istStandard, true),
      });

      const [{ id }] = await db
        .insert(invoices)
        .values({
          customerId: kunde.id,
          typ: input.typ,
          rechnungsdatum: fmt(heute),
          faelligkeitsdatum: fmt(faellig),
          bankAccountId: standardBank?.id ?? null,
          kundeName: kunde.name,
          kundeZusatz: kunde.zusatz,
          kundeStrasse: kunde.strasse,
          kundePlz: kunde.plz,
          kundeOrt: kunde.ort,
          kundeLand: kunde.land,
        })
        .$returningId();
      return { id };
    }),

  /** Entwurf speichern (Kopf + Positionen). Nicht-finalisierte Belege only. */
  updateDraft: rechtQuery("abrechnung")
    .input(z.object({ id: z.number(), kopf: kopfInput, items: z.array(itemInput) }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const rechnung = await db.query.invoices.findFirst({
        where: eq(invoices.id, input.id),
      });
      if (!rechnung) throw new Error("Rechnung nicht gefunden.");
      if (rechnung.status !== "entwurf") {
        throw new Error("Nur Entwürfe können bearbeitet werden (GoBD).");
      }

      const totals = computeTotals(input.items);

      await db.transaction(async (tx) => {
        await tx
          .update(invoices)
          .set({
            ...input.kopf,
            leistungsdatum: input.kopf.leistungsdatum ?? null,
            bankAccountId: input.kopf.bankAccountId ?? null,
            pdfNotiz: input.kopf.pdfNotiz ?? null,
            bereitsBezahlt: input.kopf.bereitsBezahlt ?? false,
            netto: centToDecimal(totals.nettoCent),
            ust: centToDecimal(totals.ustCent),
            brutto: centToDecimal(totals.bruttoCent),
          })
          .where(eq(invoices.id, input.id));

        await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, input.id));
        if (input.items.length > 0) {
          await tx.insert(invoiceItems).values(
            input.items.map((it, i) => ({
              invoiceId: input.id,
              position: i + 1,
              bezeichnung: it.bezeichnung,
              beschreibung: it.beschreibung ?? null,
              menge: it.menge,
              einheit: it.einheit,
              einzelpreis: it.einzelpreis,
              ustSatz: it.ustSatz,
            })),
          );
        }
      });
      return { ok: true };
    }),

  /** Finalisieren: Nummer vergeben, Snapshots einfrieren. Danach unveränderbar. */
  finalize: rechtQuery("abrechnung")
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const rechnung = await db.query.invoices.findFirst({
        where: eq(invoices.id, input.id),
        with: { items: true },
      });
      if (!rechnung) throw new Error("Rechnung nicht gefunden.");
      if (rechnung.status !== "entwurf") throw new Error("Rechnung ist bereits finalisiert.");
      if (rechnung.items.length === 0) {
        throw new Error("Eine Rechnung ohne Positionen kann nicht finalisiert werden.");
      }

      const settings = await db.query.companySettings.findFirst({
        where: eq(companySettings.id, 1),
      });
      if (!settings) throw new Error("Firmen-Einstellungen fehlen.");

      let bank: typeof bankAccounts.$inferSelect | undefined;
      if (rechnung.bankAccountId) {
        bank = await db.query.bankAccounts.findFirst({
          where: eq(bankAccounts.id, rechnung.bankAccountId),
        });
      }

      const jahr = Number(rechnung.rechnungsdatum.slice(0, 4));
      const firmenSnapshot = JSON.stringify({
        name: settings.name,
        strasse: settings.strasse,
        plz: settings.plz,
        ort: settings.ort,
        land: settings.land,
        handelsregister: settings.handelsregister,
        steuernummer: settings.steuernummer,
        ustIdNr: settings.ustIdNr,
        email: settings.email,
        telefon: settings.telefon,
        webseite: settings.webseite,
        fussText: settings.fussText,
      });
      const bankSnapshot = bank
        ? JSON.stringify({
            bezeichnung: bank.bezeichnung,
            bankName: bank.bankName,
            kontoinhaber: bank.kontoinhaber,
            iban: bank.iban,
            bic: bank.bic,
          })
        : null;

      // Proforma/Vorkasse: kein GoBD-Beleg → keine Nummer aus dem Kreis,
      // aber trotzdem Snapshots einfrieren und unveränderbar machen.
      if (rechnung.typ === "proforma") {
        const bezahltSet = rechnung.bereitsBezahlt
          ? {
              bezahltBetrag: rechnung.brutto,
              bezahltAm: rechnung.rechnungsdatum,
            }
          : {};
        await db
          .update(invoices)
          .set({
            status: "finalisiert",
            finalizedAt: new Date(),
            firmenSnapshot,
            bankSnapshot,
            ...bezahltSet,
          })
          .where(eq(invoices.id, input.id));
        return { nummer: `Proforma #${rechnung.id}` };
      }

      // Verknüpfte Vorkasse: Abschlag auf den aktuellen Zahlungsstand ziehen
      // und Doppel-Verrechnung (falls parallel verknüpft) verhindern.
      let abschlagSet: { abschlagBetrag: string } | Record<string, never> = {};
      if (rechnung.proformaVonId) {
        const p = await db.query.invoices.findFirst({
          where: eq(invoices.id, rechnung.proformaVonId),
        });
        if (!p || p.status !== "finalisiert") {
          throw new Error("Die verknüpfte Vorkasse ist nicht mehr finalisiert.");
        }
        const vergeben = await db.query.invoices.findFirst({
          where: and(
            eq(invoices.proformaVonId, p.id),
            ne(invoices.status, "storniert"),
            ne(invoices.id, rechnung.id),
          ),
          columns: { id: true, nummer: true },
        });
        if (vergeben) {
          throw new Error(
            `Die Vorkasse wurde zwischenzeitlich mit Rechnung ${vergeben.nummer ?? `#${vergeben.id}`} verknüpft — bitte im Entwurf neu wählen.`,
          );
        }
        abschlagSet = { abschlagBetrag: p.bezahltBetrag };
      }

      const nummer = await db.transaction(async (tx) => {
        const n = await nextNumber(tx, "invoice", jahr);
        const nr = formatInvoiceNumber(jahr, n);
        // Zahlungsziel „bereits bezahlt“ → direkt als bezahlt verbuchen
        const bezahltSet = rechnung.bereitsBezahlt
          ? {
              bezahltBetrag: rechnung.brutto,
              bezahltAm: rechnung.rechnungsdatum,
            }
          : {};
        await tx
          .update(invoices)
          .set({
            nummer: nr,
            status: "finalisiert",
            finalizedAt: new Date(),
            firmenSnapshot,
            bankSnapshot,
            ...bezahltSet,
            ...abschlagSet,
          })
          .where(eq(invoices.id, input.id));
        return nr;
      });

      return { nummer };
    }),

  /** Proforma/Vorkasse in die Schlussrechnung umwandeln (Therapiedepot).
   *  Kopiert Positionen + Kunden-Snapshot in einen neuen Standard-Entwurf und
   *  hinterlegt die bereits gezahlte Vorkasse als Abschlag. */
  inRechnungUmwandeln: rechtQuery("abrechnung")
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const proforma = await db.query.invoices.findFirst({
        where: eq(invoices.id, input.id),
        with: { items: true },
      });
      if (!proforma) throw new Error("Proforma nicht gefunden.");
      if (proforma.typ !== "proforma") {
        throw new Error("Nur Proforma-Belege können umgewandelt werden.");
      }
      if (proforma.status !== "finalisiert") {
        throw new Error("Die Proforma muss zuerst finalisiert werden.");
      }
      const bereitsUmgewandelt = await db.query.invoices.findFirst({
        where: and(eq(invoices.proformaVonId, proforma.id), ne(invoices.status, "storniert")),
        columns: { id: true, nummer: true },
      });
      if (bereitsUmgewandelt) {
        throw new Error(
          `Diese Proforma wurde bereits verrechnet (Rechnung ${bereitsUmgewandelt.nummer ?? `#${bereitsUmgewandelt.id}`}).`,
        );
      }

      const heute = new Date();
      const fmt = (d: Date) => d.toISOString().slice(0, 10);
      const settings = await db.query.companySettings.findFirst({
        where: eq(companySettings.id, 1),
      });
      const kunde = await db.query.customers.findFirst({
        where: eq(customers.id, proforma.customerId),
      });
      const zielTage = kunde?.zahlungszielTage ?? settings?.standardZahlungsziel ?? 14;
      const faellig = new Date(heute);
      faellig.setDate(faellig.getDate() + zielTage);

      const neueId = await db.transaction(async (tx) => {
        const [{ id }] = await tx
          .insert(invoices)
          .values({
            customerId: proforma.customerId,
            typ: "standard",
            rechnungsdatum: fmt(heute),
            faelligkeitsdatum: fmt(faellig),
            leistungsdatum: proforma.leistungsdatum,
            bankAccountId: proforma.bankAccountId,
            kundeName: proforma.kundeName,
            kundeZusatz: proforma.kundeZusatz,
            kundeStrasse: proforma.kundeStrasse,
            kundePlz: proforma.kundePlz,
            kundeOrt: proforma.kundeOrt,
            kundeLand: proforma.kundeLand,
            netto: proforma.netto,
            ust: proforma.ust,
            brutto: proforma.brutto,
            // Depot: was auf die Vorkasse tatsächlich gezahlt wurde
            abschlagBetrag: proforma.bezahltBetrag,
            proformaVonId: proforma.id,
            pdfNotiz: proforma.pdfNotiz,
          })
          .$returningId();
        if (proforma.items.length > 0) {
          await tx.insert(invoiceItems).values(
            proforma.items.map((it, i) => ({
              invoiceId: id,
              position: i + 1,
              bezeichnung: it.bezeichnung,
              beschreibung: it.beschreibung,
              menge: it.menge,
              einheit: it.einheit,
              einzelpreis: it.einzelpreis,
              ustSatz: it.ustSatz,
            })),
          );
        }
        return id;
      });
      return { id: neueId };
    }),

  /** Offene (bezahlbare, noch nicht verrechnete) Vorkassen eines Patienten.
   *  Grundlage für „Vorkasse im Rechnungsentwurf anhängen". */
  offeneVorkassen: rechtQuery("abrechnung")
    .input(z.object({ customerId: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const rows = await db.query.invoices.findMany({
        where: and(
          eq(invoices.customerId, input.customerId),
          eq(invoices.typ, "proforma"),
          eq(invoices.status, "finalisiert"),
        ),
        orderBy: [desc(invoices.rechnungsdatum)],
      });
      if (rows.length === 0) return [];
      // Bereits verrechnete (Verknüpfung auf einer nicht-stornierten Rechnung) ausblenden
      const verknuepfungen = await db.query.invoices.findMany({
        where: and(
          inArray(
            invoices.proformaVonId,
            rows.map((r) => r.id),
          ),
          ne(invoices.status, "storniert"),
        ),
        columns: { proformaVonId: true },
      });
      const verrechnet = new Set(verknuepfungen.map((v) => v.proformaVonId));
      return rows.filter((r) => !verrechnet.has(r.id));
    }),

  /** Vorkasse im Entwurf anhängen/ablösen — setzt proformaVonId + Abschlag
   *  (Abschlag = bisher auf die Vorkasse gezahlter Betrag). */
  vorkasseSetzen: rechtQuery("abrechnung")
    .input(z.object({ id: z.number(), proformaId: z.number().nullable() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const r = await db.query.invoices.findFirst({
        where: eq(invoices.id, input.id),
      });
      if (!r) throw new Error("Rechnung nicht gefunden.");
      if (r.status !== "entwurf") {
        throw new Error("Nur Entwürfe können geändert werden (GoBD).");
      }
      if (r.typ === "proforma") {
        throw new Error("Eine Proforma kann selbst keine Vorkasse verrechnen.");
      }

      if (input.proformaId === null) {
        await db
          .update(invoices)
          .set({ proformaVonId: null, abschlagBetrag: null })
          .where(eq(invoices.id, input.id));
        return { ok: true };
      }

      const p = await db.query.invoices.findFirst({
        where: eq(invoices.id, input.proformaId),
      });
      if (!p || p.typ !== "proforma") throw new Error("Vorkasse nicht gefunden.");
      if (p.status !== "finalisiert") {
        throw new Error("Die Vorkasse muss erst finalisiert (ausgestellt) sein.");
      }
      if (p.customerId !== r.customerId) {
        throw new Error("Die Vorkasse gehört zu einem anderen Patienten.");
      }
      const vergeben = await db.query.invoices.findFirst({
        where: and(
          eq(invoices.proformaVonId, p.id),
          ne(invoices.status, "storniert"),
          ne(invoices.id, r.id),
        ),
        columns: { id: true, nummer: true },
      });
      if (vergeben) {
        throw new Error(
          `Diese Vorkasse ist bereits mit Rechnung ${vergeben.nummer ?? `#${vergeben.id}`} verknüpft.`,
        );
      }

      await db
        .update(invoices)
        .set({ proformaVonId: p.id, abschlagBetrag: p.bezahltBetrag })
        .where(eq(invoices.id, input.id));
      return { ok: true };
    }),

  /** Zahlungseingang verbuchen. */
  markPaid: rechtQuery("abrechnung")
    .input(
      z.object({
        id: z.number(),
        betrag: z.string().regex(/^\d+(\.\d{1,2})?$/).optional(),
        datum: dateString.optional(),
      }),
    )
    .mutation(async ({ input }) => {
      const db = getDb();
      const rechnung = await db.query.invoices.findFirst({
        where: eq(invoices.id, input.id),
      });
      if (!rechnung) throw new Error("Rechnung nicht gefunden.");
      if (rechnung.status === "entwurf") {
        throw new Error("Entwurf muss zuerst finalisiert werden.");
      }
      await db
        .update(invoices)
        .set({
          bezahltBetrag: input.betrag ?? rechnung.brutto,
          bezahltAm: input.datum ?? new Date().toISOString().slice(0, 10),
        })
        .where(eq(invoices.id, input.id));
      return { ok: true };
    }),

  /** Zahlung zurücksetzen (Korrektur, z.B. falscher Betrag eingetragen). */
  unmarkPaid: rechtQuery("abrechnung")
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      await getDb()
        .update(invoices)
        .set({ bezahltBetrag: "0", bezahltAm: null })
        .where(eq(invoices.id, input.id));
      return { ok: true };
    }),

  /** Löschen nur im Entwurfsstadium — danach greift GoBD. */
  delete: rechtQuery("abrechnung")
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const rechnung = await db.query.invoices.findFirst({
        where: eq(invoices.id, input.id),
      });
      if (!rechnung) throw new Error("Rechnung nicht gefunden.");
      if (rechnung.status !== "entwurf") {
        throw new Error(
          "Finalisierte Rechnungen können nicht gelöscht werden (GoBD) — bitte stornieren.",
        );
      }
      await db.transaction(async (tx) => {
        await tx.delete(invoiceItems).where(eq(invoiceItems.invoiceId, input.id));
        // Dr.ReWaWi: berechnete Therapiewochen wieder freigeben
        await tx
          .delete(invoiceTherapieWochen)
          .where(eq(invoiceTherapieWochen.invoiceId, input.id));
        await tx.delete(invoices).where(eq(invoices.id, input.id));
      });
      // Plan→Rechnung: Entwurf gelöscht → Herkunfts-Plan zurück auf „dokumentiert",
      // damit die Rechnung neu erzeugt werden kann (war sonst Endstation).
      if (rechnung.therapieplanId) {
        const plan = await db.query.therapyPlans.findFirst({
          where: eq(therapyPlans.id, rechnung.therapieplanId),
        });
        if (plan && plan.status === "abgerechnet") {
          await db
            .update(therapyPlans)
            .set({ status: "dokumentiert" })
            .where(eq(therapyPlans.id, plan.id));
          await schreibeTimeline({
            patientId: plan.patientId,
            typ: "status",
            titel: `Rechnungsentwurf gelöscht — Therapieplan #${plan.id} zurück auf „dokumentiert"`,
            beschreibung: `Gelöschter Entwurf #${rechnung.id}; der Plan kann erneut abgerechnet werden.`,
          });
        }
      }
      return { ok: true };
    }),

  /** ReWaWi-Sync (1.5): Beleg duplizieren — Kopf + Positionen in einen neuen Entwurf. */
  duplicate: rechtQuery("abrechnung")
    .input(z.object({ id: z.number() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const r = await db.query.invoices.findFirst({
        where: eq(invoices.id, input.id),
        with: { items: true },
      });
      if (!r) throw new Error("Rechnung nicht gefunden.");
      const heute = new Date().toISOString().slice(0, 10);
      const [{ id }] = await db
        .insert(invoices)
        .values({
          customerId: r.customerId,
          typ: r.typ,
          rechnungsdatum: heute,
          faelligkeitsdatum: r.faelligkeitsdatum,
          leistungsdatum: r.leistungsdatum,
          bankAccountId: r.bankAccountId,
          kundeName: r.kundeName,
          kundeZusatz: r.kundeZusatz,
          kundeStrasse: r.kundeStrasse,
          kundePlz: r.kundePlz,
          kundeOrt: r.kundeOrt,
          kundeLand: r.kundeLand,
          netto: r.netto,
          ust: r.ust,
          brutto: r.brutto,
          bereitsBezahlt: false,
          pdfNotiz: r.pdfNotiz,
          bemerkung: r.bemerkung,
        })
        .$returningId();
      if (r.items.length > 0) {
        await db.insert(invoiceItems).values(
          r.items.map((it) => ({
            invoiceId: id,
            position: it.position,
            bezeichnung: it.bezeichnung,
            beschreibung: it.beschreibung,
            menge: it.menge,
            einheit: it.einheit,
            einzelpreis: it.einzelpreis,
            ustSatz: it.ustSatz,
          })),
        );
      }
      return { id };
    }),

  /** ReWaWi-Sync (1.5): Archivieren/Entarchivieren — GoBD-sicher (Beleg bleibt). */
  setArchiviert: rechtQuery("abrechnung")
    .input(z.object({ id: z.number(), archiviert: z.boolean() }))
    .mutation(async ({ input }) => {
      await getDb()
        .update(invoices)
        .set({ archiviert: input.archiviert })
        .where(eq(invoices.id, input.id));
      return { ok: true };
    }),

  /** ReWaWi-Sync (1.5): Aktivitäts-Timeline einer Rechnung (Seitenpanel). */
  aktivitaeten: rechtQuery("abrechnung")
    .input(z.object({ id: z.number() }))
    .query(async ({ input }) => {
      const db = getDb();
      const r = await db.query.invoices.findFirst({
        where: eq(invoices.id, input.id),
        with: { creditNotes: true },
      });
      if (!r) throw new Error("Rechnung nicht gefunden.");
      const mails = await db
        .select()
        .from(mailLog)
        .where(and(eq(mailLog.belegArt, "rechnung"), eq(mailLog.belegId, input.id)))
        .orderBy(desc(mailLog.gesendetAm));
      const bank = await db
        .select({
          datum: bankTransaktionen.datum,
          betrag: bankTransaktionen.zugeordneterBetrag,
          zugeordnetAm: bankTransaktionen.zugeordnetAm,
        })
        .from(bankTransaktionen)
        .where(and(eq(bankTransaktionen.invoiceId, input.id), eq(bankTransaktionen.status, "zugeordnet")))
        .orderBy(desc(bankTransaktionen.datum));
      return {
        erstelltAm: r.createdAt,
        finalizedAm: r.finalizedAt,
        bezahltAm: r.bezahltAm,
        bezahltBetrag: r.bezahltBetrag,
        mails,
        bankZuordnungen: bank,
        gutschriften: r.creditNotes.map((g) => ({ id: g.id, nummer: g.nummer, datum: g.datum, brutto: g.brutto })),
      };
    }),

  /** Gutschrift (Storno) aus einer finalisierten Rechnung erzeugen. */
  createCreditNote: rechtQuery("abrechnung")
    .input(z.object({ invoiceId: z.number(), grund: z.string().optional() }))
    .mutation(async ({ input }) => {
      const db = getDb();
      const rechnung = await db.query.invoices.findFirst({
        where: eq(invoices.id, input.invoiceId),
        with: { items: true },
      });
      if (!rechnung) throw new Error("Rechnung nicht gefunden.");
      if (rechnung.status === "entwurf") {
        throw new Error("Nur finalisierte Rechnungen können storniert werden.");
      }
      if (rechnung.typ === "proforma") {
        throw new Error(
          "Proforma-Belege brauchen kein Storno (kein GoBD-Beleg) — gezahlte Vorkasse ggf. als Gutschrift über die Schlussrechnung ausweisen.",
        );
      }

      const heute = new Date().toISOString().slice(0, 10);
      const [{ id }] = await db
        .insert(creditNotes)
        .values({
          invoiceId: rechnung.id,
          datum: heute,
          grund: input.grund ?? null,
          bankAccountId: rechnung.bankAccountId,
          kundeName: rechnung.kundeName,
          kundeZusatz: rechnung.kundeZusatz,
          kundeStrasse: rechnung.kundeStrasse,
          kundePlz: rechnung.kundePlz,
          kundeOrt: rechnung.kundeOrt,
          kundeLand: rechnung.kundeLand,
          netto: rechnung.netto,
          ust: rechnung.ust,
          brutto: rechnung.brutto,
        })
        .$returningId();

      if (rechnung.items.length > 0) {
        await db.insert(creditNoteItems).values(
          rechnung.items.map((it) => ({
            creditNoteId: id,
            position: it.position,
            bezeichnung: it.bezeichnung,
            beschreibung: it.beschreibung,
            menge: it.menge,
            einheit: it.einheit,
            einzelpreis: it.einzelpreis,
            ustSatz: it.ustSatz,
          })),
        );
      }
      return { id };
    }),
});
