// ── PraxiOS: Einverständniserklärung Datenaustausch (PDF-Generator) ────────
import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";

function fontPath(name: string): string {
  const p = path.join(process.cwd(), "api", "assets", "fonts", name);
  if (fs.existsSync(p)) return p;
  throw new Error(`Font nicht gefunden: ${name}`);
}

const PETROL = "#0F766E";
const DUNKEL = "#0B4F4A";
const GRAU = "#555555";
const PAGE_W = 595.28;
const MARGIN = 50;
const W = PAGE_W - 2 * MARGIN;

export interface EinverstaendnisInput {
  praxisName: string;
  praxisAdresse: string; // „Straße, PLZ Ort"
  patientName: string;
  patientGeburtsdatum: string | null; // TT.MM.JJJJ oder null
  kollegeName: string; // Empfänger-Praxis
  datum: string; // TT.MM.JJJJ
}

export function renderEinverstaendnisPdf(input: EinverstaendnisInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: MARGIN, bottom: 60, left: MARGIN, right: MARGIN },
      font: fontPath("DejaVuSans.ttf"),
      info: { Title: "Einverständniserklärung Datenaustausch", Author: input.praxisName },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const bold = fontPath("DejaVuSans-Bold.ttf");
    const regular = fontPath("DejaVuSans.ttf");

    doc.rect(0, 0, PAGE_W, 58).fill(PETROL);
    doc
      .font(bold)
      .fontSize(15)
      .fillColor("#ffffff")
      .text("Einverständniserklärung zur Übermittlung von Patientendaten", MARGIN, 22, {
        width: W,
      });

    let y = 84;
    doc.font(bold).fontSize(11).fillColor(DUNKEL).text("Patientin / Patient", MARGIN, y, { width: W });
    y += 18;
    doc.font(regular).fontSize(10).fillColor("#1a1a1a");
    doc.text(`Name: ${input.patientName}`, MARGIN, y, { width: W });
    y += 15;
    if (input.patientGeburtsdatum) {
      doc.text(`Geburtsdatum: ${input.patientGeburtsdatum}`, MARGIN, y, { width: W });
      y += 15;
    }
    y += 14;

    const absatz = (text: string) => {
      doc.font(regular).fontSize(10).fillColor("#1a1a1a").text(text, MARGIN, y, {
        width: W,
        align: "left",
      });
      y = doc.y + 10;
    };

    absatz(
      `Ich erkläre mich damit einverstanden, dass ${input.praxisName} (${input.praxisAdresse}) ` +
        `die zu meiner Behandlung dokumentierten Daten (Stammdaten, Therapiepläne, Befunde und ` +
        `Dokumente) an folgende Praxis übermittelt:`,
    );
    y += 2;
    doc.font(bold).fontSize(10.5).text(input.kollegeName, MARGIN + 14, y, { width: W - 14 });
    y = doc.y + 12;
    absatz(
      "Die Übermittlung erfolgt verschlüsselt (age-Verschlüsselung, öffentlicher Schlüssel der " +
        "Empfänger-Praxis). Der Zweck ist die Fortsetzung bzw. Abstimmung meiner Behandlung. " +
        "Ich weiß, dass ich diese Einwilligung jederzeit mit Wirkung für die Zukunft " +
        "widerrufen kann (Art. 6 Abs. 1 lit. a, Art. 9 Abs. 2 lit. a DSGVO).",
    );
    absatz(
      "Mir ist bekannt, dass nach Übermittlung die Empfänger-Praxis für die dortige " +
        "Speicherung und Verarbeitung der Daten verantwortlich ist.",
    );

    y += 26;
    const zeile = (label: string, x1: number, x2: number) => {
      doc.moveTo(x1, y).lineTo(x2, y).lineWidth(0.5).strokeColor("#999999").stroke();
      doc.font(regular).fontSize(8).fillColor(GRAU).text(label, x1, y + 4, { width: x2 - x1 });
    };
    doc.font(regular).fontSize(9).fillColor("#1a1a1a").text(`Ort, Datum: ${input.datum}`, MARGIN, y - 16, { width: 200 });
    zeile("Ort, Datum", MARGIN, MARGIN + 200);
    zeile("Unterschrift Patient:in bzw. gesetzliche:r Vertreter:in", MARGIN + 250, PAGE_W - MARGIN);

    doc.end();
  });
}
