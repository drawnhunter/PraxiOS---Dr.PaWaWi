import { z } from "zod";
import { and, asc, eq, gte, lte } from "drizzle-orm";
import {
  createRouter,
  rechtQuery,
} from "./middleware";
import { getDb } from "./queries/connection";
import { companySettings, customers, planEntries, therapyPlans, users } from "@db/schema";
import { kwZuDatum } from "./lib/kalender";
import { eintraegeSortieren } from "./abrechnung";
import crypto from "node:crypto";

// Wochenansicht des Kalenders (Montag–Freitag einer ISO-Kalenderwoche).
export const calendarRouter = createRouter({
  woche: rechtQuery("kalender")
    .input(z.object({ jahr: z.number().int(), kw: z.number().int().min(1).max(53) }))
    .query(async ({ input }) => {
      const montag = kwZuDatum(input.jahr, input.kw, 1);
      const freitag = kwZuDatum(input.jahr, input.kw, 5);

      const db = getDb();
      const rows = await db
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
        .where(and(gte(planEntries.datum, montag), lte(planEntries.datum, freitag)))
        .orderBy(asc(planEntries.datum), asc(planEntries.zeitVon));

      const tage = [1, 2, 3, 4, 5].map((wt) => {
        const datum = kwZuDatum(input.jahr, input.kw, wt);
        const tagesRows = eintraegeSortieren(rows.map((r) => r.entry)).filter(
          (e) => e.datum === datum,
        );
        const nachId = new Map(rows.map((r) => [r.entry.id, r]));
        return {
          datum,
          eintraege: tagesRows.map((e) => {
            const r = nachId.get(e.id)!;
            return {
              entry: r.entry,
              planTitel: r.planTitel,
              patientId: r.patientId,
              patientName: r.patientName,
              therapeutName: r.therapeutName,
              therapeutFarbe: r.therapeutFarbe,
            };
          }),
        };
      });
      return { tage };
    }),

  /** Feed-URL für Google/Outlook-Abo (Token wird bei Bedarf einmalig erzeugt). */
  feedUrl: rechtQuery("kalender").query(async () => {
    const db = getDb();
    const s = await db.query.companySettings.findFirst({
      where: eq(companySettings.id, 1),
    });
    if (!s) throw new Error("Praxisdaten fehlen.");
    let token = s.kalenderToken;
    if (!token) {
      token = crypto.randomBytes(24).toString("base64url");
      await db
        .update(companySettings)
        .set({ kalenderToken: token })
        .where(eq(companySettings.id, 1));
    }
    return { token, pfad: `/api/ics/${token}.ics` };
  }),

  /** Token neu erzeugen (alter Feed-Link wird ungültig). */
  feedTokenNeu: rechtQuery("kalender").mutation(async () => {
    const token = crypto.randomBytes(24).toString("base64url");
    await getDb()
      .update(companySettings)
      .set({ kalenderToken: token })
      .where(eq(companySettings.id, 1));
    return { token, pfad: `/api/ics/${token}.ics` };
  }),
});
