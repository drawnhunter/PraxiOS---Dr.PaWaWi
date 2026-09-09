import {
  createRouter,
  rechtQuery,
} from "./middleware";
import { getDb } from "./queries/connection";
import { customers, invoices, planEntries, reminders, therapyPlans, users } from "@db/schema";
import { and, asc, count, eq, gte, lt } from "drizzle-orm";
import { heuteIso } from "./lib/kalender";

export const dashboardRouter = createRouter({
  stats: rechtQuery("abrechnung").query(async () => {
    const db = getDb();
    const alle = await db.select().from(invoices);

    const finalisiert = alle.filter((r) => r.status !== "entwurf");
    const heute = new Date().toISOString().slice(0, 10);
    const monatStart = heute.slice(0, 7) + "-01";

    const offene = finalisiert.filter((r) => {
      const bezahltCent = Math.round(Number(r.bezahltBetrag) * 100);
      const bruttoCent = Math.round(Number(r.brutto) * 100);
      return r.status === "finalisiert" && bezahltCent < bruttoCent;
    });

    const ueberfaellig = offene.filter((r) => r.faelligkeitsdatum < heute);

    const summe = (rows: typeof alle, f: (r: (typeof alle)[0]) => number) =>
      rows.reduce((a, r) => a + f(r), 0);

    const umsatzMonat = summe(
      finalisiert.filter((r) => r.rechnungsdatum >= monatStart),
      (r) => Number(r.brutto),
    );
    const offenGesamt = summe(
      offene,
      (r) => Number(r.brutto) - Number(r.bezahltBetrag),
    );

    const entwuerfe = alle.filter((r) => r.status === "entwurf").length;

    return {
      anzahlOffen: offene.length,
      anzahlUeberfaellig: ueberfaellig.length,
      offenGesamt,
      umsatzMonat,
      anzahlEntwuerfe: entwuerfe,
      anzahlFinalisiert: finalisiert.length,
      letzteRechnungen: alle
        .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
        .slice(0, 8),
    };
  }),

  recentPaid: rechtQuery("abrechnung").query(async () => {
    const db = getDb();
    const start = new Date();
    start.setDate(start.getDate() - 30);
    const seit = start.toISOString().slice(0, 10);
    return db
      .select()
      .from(invoices)
      .where(gte(invoices.bezahltAm, seit));
  }),

  // ── PraxisWerk-Akte: Heutige Termine + Praxis-Kennzahlen ────────────────
  heute: rechtQuery("kalender").query(async () => {
    const heute = heuteIso();
    const rows = await getDb()
      .select({
        entry: planEntries,
        planTitel: therapyPlans.titel,
        patientId: customers.id,
        patientName: customers.name,
        therapeutName: users.name,
        therapeutFarbe: users.kalenderFarbe,
      })
      .from(planEntries)
      .innerJoin(therapyPlans, eq(planEntries.planId, therapyPlans.id))
      .innerJoin(customers, eq(therapyPlans.patientId, customers.id))
      .leftJoin(users, eq(planEntries.therapeutId, users.id))
      .where(eq(planEntries.datum, heute))
      .orderBy(asc(planEntries.zeitVon));
    return rows;
  }),

  uebersicht: rechtQuery("kalender").query(async () => {
    const db = getDb();
    const heute = heuteIso();
    const [patientenGesamt] = await db
      .select({ n: count() })
      .from(customers)
      .where(eq(customers.archiviert, false));
    const [aktivePlaene] = await db
      .select({ n: count() })
      .from(therapyPlans)
      .where(eq(therapyPlans.status, "aktiv"));
    const [dokumentationsfaellig] = await db
      .select({ n: count() })
      .from(therapyPlans)
      .where(and(eq(therapyPlans.status, "aktiv"), lt(therapyPlans.bisDatum, heute)));
    const [termineHeute] = await db
      .select({ n: count() })
      .from(planEntries)
      .where(eq(planEntries.datum, heute));
    return {
      patientenGesamt: patientenGesamt.n,
      aktivePlaene: aktivePlaene.n,
      dokumentationsfaellig: dokumentationsfaellig.n,
      termineHeute: termineHeute.n,
    };
  }),

  mahnFaellig: rechtQuery("abrechnung").query(async () => {
    const db = getDb();
    const heute = new Date().toISOString().slice(0, 10);
    const alle = await db.select().from(invoices);
    const alleMahnungen = await db.select().from(reminders);

    const offene = alle.filter((r) => {
      if (r.status !== "finalisiert") return false;
      const offen = Number(r.brutto) - Number(r.bezahltBetrag);
      return offen > 0.004 && r.faelligkeitsdatum < heute;
    });

    return offene
      .map((r) => {
        const stufen = alleMahnungen.filter((m) => m.invoiceId === r.id);
        const hoechste = stufen.reduce((a, m) => Math.max(a, m.stufe), 0);
        const letzte = stufen.sort((a, b) => (a.datum < b.datum ? 1 : -1))[0];
        // Fällig wenn: noch keine Stufe verschickt ODER Frist der letzten Stufe abgelaufen
        const faellig = stufen.length === 0 || (letzte ? letzte.zahlungsfrist < heute : true);
        return {
          id: r.id,
          nummer: r.nummer,
          kunde: r.kundeName,
          faelligkeitsdatum: r.faelligkeitsdatum,
          offenBetrag: Number(r.brutto) - Number(r.bezahltBetrag),
          anzahlStufen: stufen.length,
          letzteStufe: hoechste || null,
          naechsteStufe: Math.min(3, hoechste + 1),
          faellig,
        };
      })
      .sort((a, b) => (a.faelligkeitsdatum < b.faelligkeitsdatum ? -1 : 1));
  }),

});
