// ── PraxiOS: Terminerinnerungen per E-Mail (Scheduler + manueller Versand) ─
// Läuft alle 30 Minuten im App-Prozess: findet geplante Einträge in
// `erinnerung_tage_vorher` Tagen, verschickt Erinnerung per SMTP an die
// Patienten-E-Mail — genau einmal pro Eintrag (termin_erinnerungen).
import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "./queries/connection";
import {
  companySettings,
  customers,
  planEntries,
  terminErinnerungen,
  therapyPlans,
  users,
} from "@db/schema";
import { ladeSmtp, smtpKonfiguriert } from "./lib/smtp";

const fmtDe = (iso: string) => {
  const [j, m, t] = iso.split("-");
  return `${t}.${m}.${j}`;
};
const TAGE = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
function wochentag(iso: string): string {
  return TAGE[new Date(iso + "T12:00:00Z").getUTCDay()];
}

async function verarbeiteFaellige(): Promise<{ gesendet: number; uebersprungen: number }> {
  const db = getDb();
  const s = await db.query.companySettings.findFirst({
    where: eq(companySettings.id, 1),
  });
  if (!s?.erinnerungAktiv) return { gesendet: 0, uebersprungen: 0 };

  const ziel = new Date();
  ziel.setDate(ziel.getDate() + (s.erinnerungTageVorher ?? 1));
  const zielIso = ziel.toISOString().slice(0, 10);

  const rows = await db
    .select({
      entry: planEntries,
      planTitel: therapyPlans.titel,
      patientId: customers.id,
      patientName: customers.name,
      patientEmail: customers.email,
      therapeutName: users.name,
    })
    .from(planEntries)
    .innerJoin(therapyPlans, eq(planEntries.planId, therapyPlans.id))
    .innerJoin(customers, eq(therapyPlans.patientId, customers.id))
    .leftJoin(users, eq(planEntries.therapeutId, users.id))
    .where(
      and(
        eq(planEntries.datum, zielIso),
        eq(planEntries.status, "geplant"),
        isNull(therapyPlans.geloeschtAm),
      ),
    );

  // Bereits versendete herausfiltern
  const schon = await db.select({ entryId: terminErinnerungen.entryId }).from(terminErinnerungen);
  const schonSet = new Set(schon.map((x) => x.entryId));
  const faellig = rows.filter((r) => !schonSet.has(r.entry.id));
  if (faellig.length === 0) return { gesendet: 0, uebersprungen: 0 };

  const { transporter, absender, praxisName, praxisEmail } = await ladeSmtp();
  let gesendet = 0;
  let uebersprungen = 0;

  for (const r of faellig) {
    const email = r.patientEmail?.trim();
    if (!email || !email.includes("@")) {
      uebersprungen++;
      continue;
    }
    const zeit = r.entry.zeitVon ? ` um ${r.entry.zeitVon} Uhr` : "";
    const betreff = `Terminerinnerung: ${wochentag(r.entry.datum)}, ${fmtDe(r.entry.datum)}${zeit} — ${praxisName}`;
    const text =
      `Guten Tag ${r.patientName},\n\n` +
      `dies ist eine freundliche Erinnerung an Ihren Termin am **${wochentag(r.entry.datum)}, ${fmtDe(r.entry.datum)}${zeit}**` +
      `${r.entry.leistungText ? ` (${r.entry.leistungText})` : ""}` +
      `${r.entry.raum ? `, ${r.entry.raum}` : ""} in der Praxis ${praxisName}.\n\n` +
      `Sollten Sie den Termin nicht wahrnehmen können, sagen Sie bitte so früh wie möglich ab` +
      `${praxisEmail ? ` — am besten kurz per Antwort auf diese E-Mail an ${praxisEmail}` : " telefonisch"}.\n\n` +
      `Mit freundlichen Grüßen\n${praxisName}`;

    try {
      await transporter.sendMail({
        from: `"${absender}" <${praxisEmail ?? absender}>`,
        to: email,
        subject: betreff.replace(/\*\*/g, ""),
        text: text.replace(/\*\*/g, ""),
      });
      await db
        .insert(terminErinnerungen)
        .values({ entryId: r.entry.id, gesendetAn: email })
        .onDuplicateKeyUpdate({ set: { gesendetAn: email } });
      gesendet++;
    } catch (e) {
      console.error(`[erinnerung] Versand an ${email} fehlgeschlagen:`, e);
      uebersprungen++;
    }
  }
  return { gesendet, uebersprungen };
}

/** Startet den Erinnerungs-Scheduler (Produktion, alle 30 min + einmal beim Start). */
export function starteErinnerungsScheduler() {
  const lauf = async () => {
    if (!(await smtpKonfiguriert())) return;
    try {
      const { gesendet, uebersprungen } = await verarbeiteFaellige();
      if (gesendet + uebersprungen > 0) {
        console.log(`[erinnerung] ${gesendet} gesendet, ${uebersprungen} übersprungen`);
      }
    } catch (e) {
      console.error("[erinnerung] Lauf fehlgeschlagen:", e);
    }
  };
  // Erster Lauf 2 min nach Start, dann alle 30 min
  setTimeout(lauf, 2 * 60 * 1000);
  setInterval(lauf, 30 * 60 * 1000);
}

/** Manueller Testlauf (Einstellungen → „Jetzt prüfen"). */
export async function erinnerungJetztPruefen() {
  if (!(await smtpKonfiguriert())) {
    throw new Error("SMTP ist noch nicht eingerichtet (Einstellungen → E-Mail).");
  }
  return verarbeiteFaellige();
}
