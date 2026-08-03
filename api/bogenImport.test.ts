// Tests für den Bogen-Importer (docx/pdf → Block-Vorschau)
import { describe, it, expect } from "vitest";
import { analysiereBogenText } from "./bogenImport";

describe("analysiereBogenText", () => {
  it("erkennt Ankreuz-Listen als checkboxen-Block", () => {
    const { bloecke } = analysiereBogenText(
      [
        "Behandlungsanlass",
        "☐ Gesundheitsvorsorge",
        "☐ Ausheilen einer akuten Erkrankung",
        "☐ Linderung aktueller Beschwerden",
      ].join("\n"),
    );
    const cb = bloecke.find((b) => b.typ === "checkboxen");
    expect(cb).toBeTruthy();
    expect(cb!.config.fragen).toHaveLength(3);
    expect(cb!.config.fragen![0]).toBe("Gesundheitsvorsorge");
  });

  it("erkennt Ja/Nein-Fragen inkl. Tabellen-Zeilen ohne ☐ in der Frage", () => {
    const { bloecke } = analysiereBogenText(
      [
        "Medizinische Vorgeschichte",
        "Herz-Kreislauf-Erkrankungen ☐ Ja ☐ Nein",
        "Operationen",
        "☐ Ja ☐ Nein",
      ].join("\n"),
    );
    const jn = bloecke.find((b) => b.typ === "jaNein");
    expect(jn).toBeTruthy();
    expect(jn!.config.fragen).toContain("Herz-Kreislauf-Erkrankungen");
    // Tabellen-Zeile „☐ Ja ☐ Nein" gehört zur vorherigen Frage
    expect(jn!.config.fragen).toContain("Operationen");
    expect(jn!.config.fragen).toHaveLength(2);
  });

  it("erkennt Skala- und Schreibfeld-Blöcke", () => {
    const { bloecke } = analysiereBogenText(
      [
        "Stressbelastung",
        "Wie hoch ist Ihre aktuelle Stressbelastung auf einer Skala von 1–10?",
        "Weitere Beschwerden",
        "Haben Sie weitere Beschwerden?",
        "____________________________________",
      ].join("\n"),
    );
    expect(bloecke.some((b) => b.typ === "skala_1_10")).toBe(true);
    const sf = bloecke.find((b) => b.typ === "textfeld_schreibfeld");
    expect(sf).toBeTruthy();
  });

  it("erkennt DSGVO-Absätze als infotext mit Pflicht-Zustimmung", () => {
    const { bloecke } = analysiereBogenText(
      [
        "Rechtliche Hinweise",
        "Ich willige ein, dass meine personenbezogenen Daten gespeichert und verarbeitet werden.",
        "Ich kann diese Einwilligung jederzeit widerrufen.",
      ].join("\n"),
    );
    const info = bloecke.find((b) => b.typ === "infotext");
    expect(info).toBeTruthy();
    expect(info!.config.text).toContain("willige ein");
    expect(info!.config.checkboxLabel).toBeTruthy();
  });

  it("entfernt den Stammdaten-Block (Kopfbogen ist im System fest)", () => {
    const { bloecke, hinweise } = analysiereBogenText(
      [
        "Persönliche Daten",
        "Name, Vorname ____________________",
        "Straße ____________________",
        "PLZ, Ort ____________________",
        "Beschwerden",
        "☐ Rückenschmerzen",
      ].join("\n"),
    );
    expect(bloecke.every((b) => b.titel !== "Persönliche Daten")).toBe(true);
    expect(hinweise.some((h) => /Kopfbogen|Stammdaten/i.test(h))).toBe(true);
  });

  it("beschneidet Nummerierungen nur am Zeilenanfang (keine Titel-Verstümmelung)", () => {
    const { bloecke } = analysiereBogenText(
      ["A. Datenweitergabe und Einwilligung", "Ich willige ein, dass meine Daten zur Behandlung übermittelt werden."].join("\n"),
    );
    expect(bloecke[0]?.titel).toBe("Datenweitergabe und Einwilligung");
    expect(bloecke[0]?.typ).toBe("infotext");
  });

  it("überspringt Anweisungszeilen („Bitte kreuzen …“)", () => {
    const { bloecke } = analysiereBogenText(
      [
        "Symptome",
        "Bitte kreuzen Sie Zutreffendes an:",
        "☐ Kopfschmerzen",
      ].join("\n"),
    );
    const cb = bloecke.find((b) => b.typ === "checkboxen");
    expect(cb!.config.fragen).toEqual(["Kopfschmerzen"]);
  });
});
