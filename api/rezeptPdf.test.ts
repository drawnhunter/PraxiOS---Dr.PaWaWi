import { describe, it, expect } from "vitest";
import { renderRezeptPdf } from "./rezeptPdf";
import { DRX_BOGEN } from "@db/anamneseDrx";
import { z } from "zod";
import { BLOCK_TYPEN } from "@contracts/anamnese";

const praxis = {
  name: "Praxis Dr. X",
  strasse: "Musterstr. 1",
  plz: "12345",
  ort: "Musterstadt",
  telefon: "0123/4567",
  email: "praxis@example.de",
};
const patient = {
  name: "Max Mustermann",
  geburtsdatum: "01.02.1980",
  strasse: "Weg 2",
  plz: "12345",
  ort: "Musterstadt",
};

// 1×1-Pixel-PNG als Platzhalter-Unterschrift
const PNG_1PX =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

describe("renderRezeptPdf", () => {
  it("Privatrezept mit zwei Verordnungen, ohne Signaturbild", async () => {
    const pdf = await renderRezeptPdf({
      typ: "rezept",
      inhalt: {
        medikamente: [
          { name: "Clindamycin", staerke: "600 mg", menge: "20 Tbl.", dosierung: "3× täglich 1 Tablette" },
          { name: "Ibuprofen", staerke: "400 mg", dosierung: "bei Bedarf" },
        ],
        hinweis: "Nicht mit Alkohol kombinieren.",
      },
      patient,
      praxis,
      signaturBild: null,
      datum: "03.08.2026",
    });
    expect(pdf.length).toBeGreaterThan(2000);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("Krankschreibung mit Signaturbild", async () => {
    const pdf = await renderRezeptPdf({
      typ: "attest",
      inhalt: {
        art: "krankschreibung",
        auVon: "03.08.2026",
        auBis: "07.08.2026",
        text: "Eine Wiedereingliederung wird empfohlen.",
      },
      patient,
      praxis,
      signaturBild: PNG_1PX,
      datum: "03.08.2026",
    });
    expect(pdf.length).toBeGreaterThan(2000);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("defektes Signaturbild bricht das Rendering nicht", async () => {
    const pdf = await renderRezeptPdf({
      typ: "attest",
      inhalt: { art: "attest", text: "Ist voll belastbar." },
      patient,
      praxis,
      signaturBild: "data:image/png;base64,kaputt",
      datum: "03.08.2026",
    });
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
  });
});

// Der Muster-Seed muss das Router-Eingabeschema (anamnese.create) bestehen.
describe("DrX-Musterbogen", () => {
  const blockConfigInput = z.object({
    fragen: z.array(z.string().trim().min(1)).max(60).optional(),
    spalten: z.union([z.literal(1), z.literal(2)]).optional(),
    frage: z.string().trim().max(500).optional(),
    zeilen: z.number().int().min(1).max(20).optional(),
    vonLabel: z.string().trim().max(100).optional(),
    bisLabel: z.string().trim().max(100).optional(),
    notizFrage: z.string().trim().max(500).optional(),
    text: z.string().max(10000).optional(),
    checkboxLabel: z.string().trim().max(300).optional(),
    pflicht: z.boolean().optional(),
  });
  const formInput = z.object({
    titel: z.string().trim().min(1).max(255),
    beschreibung: z.string().max(2000).nullable().optional(),
    schemaJson: z
      .array(
        z.object({
          blockId: z.number().int().optional(),
          typ: z.enum(BLOCK_TYPEN),
          titel: z.string().trim().min(1).max(255),
          config: blockConfigInput,
        }),
      )
      .min(1)
      .max(80),
  });

  it("Seed erfüllt das create-Schema", () => {
    const res = formInput.safeParse({
      titel: DRX_BOGEN.titel,
      beschreibung: DRX_BOGEN.beschreibung,
      schemaJson: DRX_BOGEN.bloecke,
    });
    if (!res.success) console.error(res.error.issues);
    expect(res.success).toBe(true);
  });

  it("enthält Pflicht-Zustimmungen und Kernabschnitte", () => {
    const infos = DRX_BOGEN.bloecke.filter((b) => b.typ === "infotext");
    expect(infos.length).toBeGreaterThanOrEqual(3);
    // Mindestens die beiden rechtlich bindenden Zustimmungen (IMTZ + Einwilligung)
    const pflichtig = infos.filter((b) => b.config.checkboxLabel && (b.config.pflicht ?? true));
    expect(pflichtig.length).toBeGreaterThanOrEqual(2);
    const titel = DRX_BOGEN.bloecke.map((b) => b.titel).join(" ");
    expect(titel).toContain("Medizinische Vorgeschichte");
    expect(titel).toContain("Symptomanalyse");
    expect(titel).toContain("Einwilligung");
  });
});
