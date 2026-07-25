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
