// ── ReWaKi: Unklarheiten-Report (Text + PDF) ────────────────────────────────
// Geht zurück an IMTZ: enthält je Punkt die Fundstelle in der Vorlage
// (Sheet + Excel-Zeile + Patient), damit die Rückfrage ohne Raten klappt.
import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";
import type { ImportErgebnis, Unklarheit } from "@contracts/therapy";

function fontPath(name: string): string {
  const p = path.join(process.cwd(), "api", "assets", "fonts", name);
  if (fs.existsSync(p)) return p;
  throw new Error(`Font nicht gefunden: ${name}`);
}

function fundstelle(u: Unklarheit): string {
  const teile: string[] = [];
  if (u.sheet) teile.push(`Sheet ${u.sheet}`);
  if (u.zeile) teile.push(`Zeile ${u.zeile}`);
  if (u.patient) teile.push(`Patient: ${u.patient}`);
  return teile.length > 0 ? ` (${teile.join(", ")})` : "";
}

export function baueReportText(
  dateiname: string,
  jahr: number,
  sheets: string[],
  ergebnis: ImportErgebnis,
  erstelltAm: Date,
): string {
  const L: string[] = [];
  const klare = ergebnis.rechnungen.filter((r) => r.klar).length;
  const unklare = ergebnis.rechnungen.length - klare;

  L.push("UNKLARHEITEN-REPORT — Therapieplan-Import");
  L.push("=".repeat(60));
  L.push(`Datei:      ${dateiname}`);
  L.push(`Wochen:     ${sheets.join(", ")} (Jahr ${jahr})`);
  L.push(`Erstellt:   ${erstelltAm.toLocaleString("de-DE")}`);
  L.push("");
  L.push(
    `Ergebnis:   ${ergebnis.rechnungen.length} Rechnung(en) als Entwurf angelegt` +
      ` (${klare} klar, ${unklare} mit Unklarheiten), ` +
      `${ergebnis.uebersprungen.length} Patient(en) übersprungen, ` +
      `${ergebnis.unklarheiten.length} offene(r) Punkt(e)`,
  );
  L.push("");

  if (ergebnis.unklarheiten.length > 0) {
    L.push("OFFENE PUNKTE");
    L.push("-".repeat(60));
    ergebnis.unklarheiten.forEach((u, i) => {
      L.push(`${i + 1}. ${u.grund}${fundstelle(u)}`);
    });
    L.push("");
  }

  if (ergebnis.uebersprungen.length > 0) {
    L.push("ÜBERSPRUNGEN (keine Rechnung angelegt)");
    L.push("-".repeat(60));
    ergebnis.uebersprungen.forEach((u, i) => {
      L.push(`${i + 1}. ${u.patient}: ${u.grund}`);
    });
    L.push("");
  }

  L.push("Bitte die Punkte prüfen und Rückmeldung an die Praxis geben.");
  L.push("Die betroffenen Rechnungen liegen als Entwurf vor und werden");
  L.push("nach Klärung ergänzt und finalisiert.");
  return L.join("\n");
}

export function renderReportPdf(
  dateiname: string,
  jahr: number,
  sheets: string[],
  ergebnis: ImportErgebnis,
  erstelltAm: Date,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: 50, bottom: 50, left: 50, right: 50 },
      bufferPages: true,
      font: fontPath("DejaVuSans.ttf"),
      info: { Title: `Unklarheiten-Report ${dateiname}`, Author: "ReWaKi" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const bold = fontPath("DejaVuSans-Bold.ttf");
    const regular = fontPath("DejaVuSans.ttf");
    const W = 595.28 - 100;

    doc.font(bold).fontSize(15).text("Unklarheiten-Report — Therapieplan-Import");
    doc.moveDown(0.6);
    doc.font(regular).fontSize(9).fillColor("#444444");
    doc.text(`Datei: ${dateiname}`);
    doc.text(`Wochen: ${sheets.join(", ")} (Jahr ${jahr})`);
    doc.text(`Erstellt: ${erstelltAm.toLocaleString("de-DE")}`);

    const klare = ergebnis.rechnungen.filter((r) => r.klar).length;
    doc.moveDown(0.8);
    doc.font(bold).fontSize(10).fillColor("#1a1a1a");
    doc.text(
      `${ergebnis.rechnungen.length} Rechnung(en) als Entwurf angelegt ` +
        `(${klare} klar, ${ergebnis.rechnungen.length - klare} mit Unklarheiten), ` +
        `${ergebnis.uebersprungen.length} übersprungen, ${ergebnis.unklarheiten.length} offene(r) Punkt(e)`,
      { width: W },
    );

    if (ergebnis.unklarheiten.length > 0) {
      doc.moveDown(1);
      doc.font(bold).fontSize(12).text("Offene Punkte");
      doc.moveDown(0.4);
      ergebnis.unklarheiten.forEach((u, i) => {
        doc.font(bold).fontSize(9.5).fillColor("#1a1a1a").text(`${i + 1}. ${u.grund}`, {
          width: W,
          continued: false,
        });
        const f = fundstelle(u);
        if (f) {
          doc.font(regular).fontSize(8.5).fillColor("#666666").text(`    Fundstelle:${f}`, {
            width: W,
          });
        }
        doc.moveDown(0.35);
      });
    }

    if (ergebnis.uebersprungen.length > 0) {
      doc.moveDown(0.8);
      doc.font(bold).fontSize(12).fillColor("#1a1a1a").text("Übersprungen (keine Rechnung angelegt)");
      doc.moveDown(0.4);
      ergebnis.uebersprungen.forEach((u, i) => {
        doc.font(regular).fontSize(9.5).text(`${i + 1}. ${u.patient}: ${u.grund}`, { width: W });
        doc.moveDown(0.25);
      });
    }

    doc.moveDown(1.2);
    doc.font(regular).fontSize(9).fillColor("#444444");
    doc.text(
      "Bitte die Punkte prüfen und Rückmeldung an die Praxis geben. Die betroffenen " +
        "Rechnungen liegen als Entwurf vor und werden nach Klärung ergänzt und finalisiert.",
      { width: W },
    );

    doc.end();
  });
}
