// ── PraxiOS: ICS-Feed (iCalendar, RFC 5545) für Google/Outlook-Abo ─────────
// Reine Erzeugung, testbar. Floating Local Time + X-WR-TIMEZONE (Europe/Berlin).

export interface IcsEintrag {
  id: number;
  datum: string; // ISO
  zeitVon: string | null; // "HH:MM"
  zeitBis: string | null;
  patientName: string;
  leistungText: string | null;
  therapeutName: string | null;
  raum: string | null;
  bemerkung: string | null;
  status: "geplant" | "stattgefunden" | "abgesagt" | "ausgefallen";
  planTitel: string | null;
}

const ICS_STATUS: Record<IcsEintrag["status"], string> = {
  geplant: "TENTATIVE",
  stattgefunden: "CONFIRMED",
  abgesagt: "CANCELLED",
  ausgefallen: "CANCELLED",
};

function esc(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/** RFC-Faltung: max. 75 Oktette pro Zeile (Fortsetzung mit Leerzeichen). */
function falte(zeile: string): string[] {
  const out: string[] = [];
  let rest = zeile;
  while (Buffer.byteLength(rest, "utf-8") > 74) {
    let cut = 74;
    while (cut > 0 && Buffer.byteLength(rest.slice(0, cut), "utf-8") > 74) cut--;
    out.push(rest.slice(0, cut));
    rest = " " + rest.slice(cut);
  }
  out.push(rest);
  return out;
}

const zahl = (s: string) => s.replace(/\D/g, "");

export function baueIcs(eintraege: IcsEintrag[], praxisName: string): string {
  const jetzt = new Date()
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const zeilen: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PraxiOS//Kalender//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(praxisName)} — Termine`,
    "X-WR-TIMEZONE:Europe/Berlin",
  ];

  for (const e of eintraege) {
    const von = e.zeitVon ?? "08:00";
    const bis = e.zeitBis ?? von;
    const beschreibung = [
      e.planTitel,
      e.therapeutName ? `Therapeut: ${e.therapeutName}` : null,
      e.raum ? `Raum: ${e.raum}` : null,
      e.bemerkung,
    ]
      .filter(Boolean)
      .join("\\n");
    const block = [
      "BEGIN:VEVENT",
      `UID:planentry-${e.id}@praxios`,
      `DTSTAMP:${jetzt}`,
      `DTSTART:${zahl(e.datum)}T${zahl(von)}00`,
      `DTEND:${zahl(e.datum)}T${zahl(bis)}00`,
      `SUMMARY:${esc(`${e.patientName} — ${e.leistungText ?? "Termin"}`)}`,
      ...(beschreibung ? [`DESCRIPTION:${esc(beschreibung)}`] : []),
      `STATUS:${ICS_STATUS[e.status]}`,
      "TRANSP:OPAQUE",
      "END:VEVENT",
    ];
    for (const z of block) zeilen.push(...falte(z));
  }

  zeilen.push("END:VCALENDAR");
  return zeilen.join("\r\n") + "\r\n";
}

// ── Zahlungsziele-Kalender (Eingangsrechnungen fällig + Wiedervorlagen) ────
import { and, eq, isNotNull, isNull } from "drizzle-orm";
import { getDb } from "../queries/connection";
import { incomingInvoices, postEingang, suppliers } from "@db/schema";

function icsDatum(iso: string): string {
  return iso.replace(/-/g, "");
}
function plusTag(iso: string): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + 1);
  return icsDatum(d.toISOString().slice(0, 10));
}
function geldFmt(dec: string): string {
  return `${Number(dec).toFixed(2).replace(".", ",")} €`;
}

export async function baueZahlungszieleIcs(): Promise<string> {
  const db = getDb();
  const jetzt = new Date().toISOString().replace(/[-:]/g, "").replace(/\..+/, "");
  const events: string[] = [];

  const offene = await db
    .select({
      id: incomingInvoices.id,
      lieferantName: incomingInvoices.lieferantName,
      nummer: incomingInvoices.nummer,
      brutto: incomingInvoices.brutto,
      faelligkeitsdatum: incomingInvoices.faelligkeitsdatum,
    })
    .from(incomingInvoices)
    .where(and(isNull(incomingInvoices.bezahltAm), isNotNull(incomingInvoices.faelligkeitsdatum)));

  for (const r of offene) {
    events.push(
      [
        "BEGIN:VEVENT",
        `UID:eingangsrechnung-${r.id}@praxios`,
        `DTSTAMP:${jetzt}`,
        `DTSTART;VALUE=DATE:${icsDatum(r.faelligkeitsdatum!)}`,
        `DTEND;VALUE=DATE:${icsDatum(plusTag(r.faelligkeitsdatum!))}`,
        `SUMMARY:${esc(`Zahlung fällig: ${r.lieferantName} — ${r.nummer} (${geldFmt(r.brutto)})`)}`,
        "END:VEVENT",
      ].join("\r\n"),
    );
  }

  const posts = await db
    .select({
      id: postEingang.id,
      stichwort: postEingang.stichwort,
      wiedervorlageAm: postEingang.wiedervorlageAm,
      status: postEingang.status,
      lieferantName: suppliers.name,
      absenderFreitext: postEingang.absenderFreitext,
    })
    .from(postEingang)
    .leftJoin(suppliers, eq(postEingang.absenderLieferantId, suppliers.id))
    .where(and(isNotNull(postEingang.wiedervorlageAm), eq(postEingang.status, "neu")));

  for (const p of posts) {
    const absender = p.lieferantName ?? p.absenderFreitext ?? "";
    events.push(
      [
        "BEGIN:VEVENT",
        `UID:wiedervorlage-${p.id}@praxios`,
        `DTSTAMP:${jetzt}`,
        `DTSTART;VALUE=DATE:${icsDatum(p.wiedervorlageAm!)}`,
        `DTEND;VALUE=DATE:${icsDatum(plusTag(p.wiedervorlageAm!))}`,
        `SUMMARY:${esc(`Wiedervorlage: ${p.stichwort ?? "Dokument"}${absender ? " — " + absender : ""}`)}`,
        "END:VEVENT",
      ].join("\r\n"),
    );
  }

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PraxiOS//Zahlungsziele//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Zahlungsziele",
    "X-WR-TIMEZONE:Europe/Berlin",
    ...events,
    "END:VCALENDAR",
    "",
  ].join("\r\n");
}
