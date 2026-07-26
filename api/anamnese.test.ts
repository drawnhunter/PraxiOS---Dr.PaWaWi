// Tests für die Anamnese-Helfer (Patientenzuordnung + PDF-Smoke)
import { describe, it, expect } from "vitest";
import { patientZuordnen } from "./anamneseRouter";
import { renderBogenPdf } from "./anamnesePdf";
import type { customers } from "@db/schema";

type Kunde = typeof customers.$inferSelect;
const kunde = (id: number, name: string, geburtsdatum: string | null = null): Kunde =>
  ({ id, name, geburtsdatum }) as Kunde;

describe("patientZuordnen (Anamnese → Patientenstamm)", () => {
  const stamm = [
    kunde(1, "Essler, Christian", "1992-05-10"),
    kunde(2, "Mustermann, Max", "1970-01-01"),
    kunde(3, "Mustermann, Erika", "1975-03-15"),
  ];

  it("findet exakte Namensübereinstimmung", () => {
    const t = patientZuordnen(stamm, { nachname: "Essler", vorname: "Christian", geburtsdatum: "1992-05-10" });
    expect(t?.id).toBe(1);
  });

  it("findet über Nachname + Geburtsdatum (Vorname abweichend)", () => {
    const t = patientZuordnen(stamm, { nachname: "Essler", vorname: "Chris", geburtsdatum: "1992-05-10" });
    expect(t?.id).toBe(1);
  });

  it("findet NICHT bei abweichendem Nachnamen (Tippfehler)", () => {
    const t = patientZuordnen(stamm, { nachname: "Esser", vorname: "Christian", geburtsdatum: "1992-05-10" });
    expect(t).toBeNull();
  });

  it("findet NICHT bei mehrdeutigem Nachnamen ohne DOB", () => {
    const t = patientZuordnen(stamm, { nachname: "Mustermann", vorname: "X", geburtsdatum: null });
    expect(t).toBeNull();
  });

  it("unterscheidet Mustermann Max vs. Erika über DOB", () => {
    const max = patientZuordnen(stamm, { nachname: "Mustermann", vorname: "Max", geburtsdatum: "1970-01-01" });
    const erika = patientZuordnen(stamm, { nachname: "Mustermann", vorname: "Erika", geburtsdatum: "1975-03-15" });
    expect(max?.id).toBe(2);
    expect(erika?.id).toBe(3);
  });

  it("gibt null bei Unbekanntem", () => {
    expect(patientZuordnen(stamm, { nachname: "Neu", vorname: "Person", geburtsdatum: null })).toBeNull();
  });
});

describe("renderBogenPdf", () => {
  it("erzeugt ein leeres PDF", async () => {
    const pdf = await renderBogenPdf({
      formTitel: "Erstanamnese",
      beschreibung: "Bitte ausfüllen.",
      praxisName: "Praxis PraxiOS",
      bloecke: [
        { typ: "checkboxen", titel: "Beschwerden", config: { fragen: ["Kopfschmerzen", "Müdigkeit"], spalten: 2 } },
        { typ: "skala_1_10", titel: "Schmerz", config: { frage: "Wie stark?" } },
        { typ: "haeufigkeit", titel: "Häufigkeit", config: { fragen: ["Schlafstörungen"] } },
      ],
    });
    expect(pdf.length).toBeGreaterThan(2000);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("erzeugt ein ausgefülltes PDF", async () => {
    const pdf = await renderBogenPdf({
      formTitel: "Erstanamnese",
      praxisName: "Praxis PraxiOS",
      bloecke: [
        { typ: "checkboxen", titel: "Beschwerden", config: { fragen: ["Kopfschmerzen", "Müdigkeit"], spalten: 2 } },
        { typ: "textfeld_schreibfeld", titel: "Sonstiges", config: { frage: "Was soll die Praxis wissen?" } },
      ],
      kopfbogen: { nachname: "Mustermann", vorname: "Max", geburtsdatum: "1970-01-01", strasse: "Musterweg 1", plz: "14480", ort: "Potsdam" },
      antworten: [
        { titel: "Beschwerden", typ: "checkboxen", wert: ["Müdigkeit"] },
        { titel: "Sonstiges", typ: "textfeld_schreibfeld", wert: "Nichts weiter." },
      ],
      unterschriftName: "Max Mustermann",
      datum: "24.07.2026",
    });
    expect(pdf.length).toBeGreaterThan(2000);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
