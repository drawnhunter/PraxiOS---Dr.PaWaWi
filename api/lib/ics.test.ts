import { describe, it, expect } from "vitest";
import { baueIcs, type IcsEintrag } from "./ics";

const E: IcsEintrag = {
  id: 42,
  datum: "2026-09-28",
  zeitVon: "09:00",
  zeitBis: "09:45",
  patientName: "Mustermann, Max",
  leistungText: "mGKHT",
  therapeutName: "Dr. A",
  raum: "Raum 2",
  bemerkung: "Zeile 1\nZeile 2",
  status: "stattgefunden",
  planTitel: "Plan KW40",
};

describe("ICS-Feed (RFC 5545)", () => {
  const ics = baueIcs([E], "Praxis PraxiOS");

  it("hat Kalender-Grundgerüst und VEVENT-Felder", () => {
    expect(ics).toContain("BEGIN:VCALENDAR");
    expect(ics).toContain("END:VCALENDAR");
    expect(ics).toContain("BEGIN:VEVENT");
    expect(ics).toContain("UID:planentry-42@praxios");
    expect(ics).toContain("DTSTART:20260928T090000");
    expect(ics).toContain("DTEND:20260928T094500");
    expect(ics).toContain("SUMMARY:Mustermann\\, Max — mGKHT");
    expect(ics).toContain("STATUS:CONFIRMED");
    expect(ics).toContain("X-WR-TIMEZONE:Europe/Berlin");
  });

  it("escaped Sonderzeichen und Zeilenumbrüche", () => {
    expect(ics).toContain("Zeile 1\\nZeile 2");
    expect(ics).toContain("Therapeut: Dr. A");
  });

  it("faltet lange Zeilen auf max. 75 Oktette", () => {
    const laengste = Math.max(...ics.split("\r\n").map((z) => Buffer.byteLength(z, "utf-8")));
    expect(laengste).toBeLessThanOrEqual(75);
  });

  it("mappt Status korrekt", () => {
    expect(baueIcs([{ ...E, status: "geplant" }], "P")).toContain("STATUS:TENTATIVE");
    expect(baueIcs([{ ...E, status: "abgesagt" }], "P")).toContain("STATUS:CANCELLED");
  });
});
