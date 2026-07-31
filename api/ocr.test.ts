// Tests für die OCR-Feld-Extraktion (lokale Heuristik, deutscher Geschäftsbrief)
import { describe, it, expect } from "vitest";
import { extrahiereFelder } from "./ocr";

const BELEG = `
Medizinbedarf GmbH
Musterstraße 12
12345 Berlin

Rechnung
Rechnungs-Nr.: MB-2026-0187
Rechnungsdatum: 20.07.2026

Artikel                    Menge    Einzelpreis    Gesamt
Infusionslösung 500 ml       10         6,50 €      65,00 €
Natriumbicarbonat 100 ml     20         5,41 €     108,20 €

Zwischensumme netto                                 173,20 €
19 % MwSt.                                           32,91 €
Rechnungsbetrag                                     206,11 €

Zahlbar bis spätestens den 03.08.2026
IBAN: DE85 1009 0000 1631 5290 00
Berliner Volksbank
`;

describe("OCR-Feld-Extraktion (lokale Heuristik)", () => {
  it("extrahiert Betrag, IBAN, Nummer, Datum und Fälligkeit aus einem Beleg", () => {
    const f = extrahiereFelder(BELEG);
    expect(f.betrag.wert).toBe("206.11");
    expect(f.betrag.konfidenz).toBe("hoch");
    expect(f.iban.wert).toBe("DE85100900001631529000");
    expect(f.iban.konfidenz).toBe("hoch");
    expect(f.rechnungsnummer.wert).toBe("MB-2026-0187");
    expect(f.rechnungsdatum.wert).toBe("2026-07-20");
    expect(f.faellig.wert).toBe("2026-08-03");
    expect(f.absender.wert).toBe("Medizinbedarf GmbH");
  });

  it("bleibt robust bei leerem Text", () => {
    const f = extrahiereFelder("");
    expect(f.betrag.wert).toBeNull();
    expect(f.iban.wert).toBeNull();
    expect(f.rechnungsnummer.wert).toBeNull();
  });

  it("erkennt relative Zahlungsziele (in X Tagen)", () => {
    const f = extrahiereFelder(
      "Rechnung vom 10.07.2026\nZahlbar innerhalb von 14 Tagen\nGesamt 99,99 €",
    );
    expect(f.faellig.wert).toBe("2026-07-24");
    expect(f.faellig.konfidenz).toBe("mittel");
  });
});
