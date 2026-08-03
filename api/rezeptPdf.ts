// ── PraxiOS: Privat-Rezept & Attest als PDF ─────────────────────────────────
// A4, klassisches Privatrezept-Layout: Praxis-Kopf, Patient, „Rp.“-Block mit
// Verordnungszeilen, Hinweis, Unterschrifts-Stempel (Bild aus den Einstellungen
// oder Name/Datum als Text).
import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";
import type { AttestInhalt, RezeptInhalt } from "@contracts/rezepte";

function fontPath(name: string): string {
  const p = path.join(process.cwd(), "api", "assets", "fonts", name);
  if (fs.existsSync(p)) return p;
  throw new Error(`Font nicht gefunden: ${name}`);
}

const PETROL = "#0F766E";
const GRAU = "#555555";
const MARGIN = 56;
const PAGE_W = 595.28;
const W = PAGE_W - 2 * MARGIN;

export interface RezeptPdfInput {
  typ: "rezept" | "attest";
  inhalt: RezeptInhalt | AttestInhalt;
  patient: {
    name: string;
    geburtsdatum?: string | null; // TT.MM.JJJJ oder null
    strasse?: string | null;
    plz?: string | null;
    ort?: string | null;
  };
  praxis: {
    name: string;
    strasse: string;
    plz: string;
    ort: string;
    telefon?: string | null;
    email?: string | null;
  };
  /** base64-Data-URL (PNG/JPG) oder null → Text-Stempel. */
  signaturBild?: string | null;
  /** Ausstellungsdatum TT.MM.JJJJ. */
  datum: string;
}

function signaturBlock(
  doc: PDFKit.PDFDocument,
  praxis: RezeptPdfInput["praxis"],
  signaturBild: string | null | undefined,
  datum: string,
) {
  const y = Math.max(doc.y + 40, 640);
  if (y > 720) doc.addPage();
  const x = MARGIN + W - 230;

  // Ort/Datum links neben der Unterschriftszeile
  doc
    .font("Regular")
    .fontSize(10)
    .fillColor("#000000")
    .text(`${praxis.ort}, den ${datum}`, MARGIN, y + 34, { width: 240 });

  // Unterschriftsbild über der Linie
  if (signaturBild) {
    try {
      const b64 = signaturBild.split(",")[1] ?? "";
      const buf = Buffer.from(b64, "base64");
      if (buf.length > 100) {
        doc.image(buf, x + 15, y - 34, { fit: [170, 62] });
      }
    } catch {
      // defektes Bild → nur Linie
    }
  }
  doc
    .moveTo(x, y + 40)
    .lineTo(x + 230, y + 40)
    .lineWidth(0.8)
    .strokeColor("#000000")
    .stroke();
  doc
    .font("Regular")
    .fontSize(8.5)
    .fillColor(GRAU)
    .text("Unterschrift Arzt/Ärztin", x, y + 44, { width: 230, align: "center" });
}

export async function renderRezeptPdf(input: RezeptPdfInput): Promise<Buffer> {
  const doc = new PDFDocument({ size: "A4", margin: MARGIN, info: { Title: "Verordnung" } });
  doc.registerFont("Regular", fontPath("DejaVuSans.ttf"));
  doc.registerFont("Bold", fontPath("DejaVuSans-Bold.ttf"));
  doc.registerFont("Italic", fontPath("DejaVuSans-Oblique.ttf"));
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const fertig = new Promise<Buffer>((resolve) =>
    doc.on("end", () => resolve(Buffer.concat(chunks))),
  );

  const { praxis, patient, datum } = input;

  // ── Praxis-Kopf ───────────────────────────────────────────────────────────
  doc.font("Bold").fontSize(15).fillColor(PETROL).text(praxis.name, MARGIN, MARGIN);
  doc
    .font("Regular")
    .fontSize(9.5)
    .fillColor(GRAU)
    .text(`${praxis.strasse} · ${praxis.plz} ${praxis.ort}`, MARGIN, doc.y + 2);
  const kontakt = [praxis.telefon ? `Tel. ${praxis.telefon}` : null, praxis.email]
    .filter(Boolean)
    .join(" · ");
  if (kontakt) doc.text(kontakt);
  doc
    .moveTo(MARGIN, doc.y + 8)
    .lineTo(MARGIN + W, doc.y + 8)
    .lineWidth(1.4)
    .strokeColor(PETROL)
    .stroke();
  doc.moveDown(1.2);

  // ── Patient ───────────────────────────────────────────────────────────────
  const geb = patient.geburtsdatum ? `, geb. am ${patient.geburtsdatum}` : "";
  const adresse = [patient.strasse, [patient.plz, patient.ort].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  doc
    .font("Bold")
    .fontSize(11)
    .fillColor("#000000")
    .text(`${patient.name}${geb}`);
  if (adresse) doc.font("Regular").fontSize(9.5).fillColor(GRAU).text(adresse);
  doc.moveDown(1.2);

  if (input.typ === "rezept") {
    const inhalt = input.inhalt as RezeptInhalt;
    // ── Titel ──────────────────────────────────────────────────────────────
    doc.font("Bold").fontSize(17).fillColor("#000000").text("Privatrezept");
    doc.moveDown(0.8);
    // ── Rp.-Block ──────────────────────────────────────────────────────────
    doc.font("Bold").fontSize(26).fillColor(PETROL).text("Rp.", MARGIN, doc.y + 4);
    doc.moveDown(0.6);
    inhalt.medikamente.forEach((m, i) => {
      const zeile1 = [m.name, m.staerke].filter(Boolean).join(" ");
      doc
        .font("Bold")
        .fontSize(12)
        .fillColor("#000000")
        .text(`${inhalt.medikamente.length > 1 ? `${i + 1}. ` : ""}${zeile1}`, MARGIN + 16, doc.y + 6, {
          continued: false,
        });
      if (m.menge) {
        doc.font("Regular").fontSize(10.5).fillColor(GRAU).text(m.menge, MARGIN + 16, doc.y + 1);
      }
      if (m.dosierung) {
        doc
          .font("Italic")
          .fontSize(10.5)
          .fillColor("#000000")
          .text(`Einnahme: ${m.dosierung}`, MARGIN + 16, doc.y + 2);
      }
      doc.moveDown(0.5);
    });
    if (inhalt.hinweis?.trim()) {
      doc.moveDown(0.4);
      doc
        .font("Regular")
        .fontSize(9.5)
        .fillColor(GRAU)
        .text(`Hinweis: ${inhalt.hinweis.trim()}`, MARGIN, doc.y, { width: W });
    }
    doc.moveDown(1);
    doc
      .font("Regular")
      .fontSize(8.5)
      .fillColor(GRAU)
      .text(
        "Privat verordnet — die Kosten dieser Verordnung werden nicht von der gesetzlichen Krankenversicherung übernommen.",
        MARGIN,
        Math.max(doc.y + 8, 600),
        { width: W },
      );
  } else {
    const inhalt = input.inhalt as AttestInhalt;
    const istAU = inhalt.art === "krankschreibung";
    doc
      .font("Bold")
      .fontSize(17)
      .fillColor("#000000")
      .text(istAU ? "Arbeitsunfähigkeitsbescheinigung" : "Ärztliches Attest");
    doc.moveDown(1);
    doc.font("Regular").fontSize(11.5).fillColor("#000000");
    if (istAU) {
      const von = inhalt.auVon || datum;
      const bis = inhalt.auBis || "…";
      doc.text(
        `${patient.name}${geb} ist vom ${von} bis voraussichtlich einschließlich ${bis} arbeitsunfähig erkrankt.`,
        MARGIN,
        doc.y + 4,
        { width: W, lineGap: 3 },
      );
      doc.moveDown(0.8);
    }
    if (inhalt.text.trim()) {
      doc.text(inhalt.text.trim(), MARGIN, doc.y + (istAU ? 0 : 4), {
        width: W,
        lineGap: 3,
      });
    }
  }

  // ── Unterschrift ──────────────────────────────────────────────────────────
  signaturBlock(doc, praxis, input.signaturBild, datum);

  doc.end();
  return fertig;
}
