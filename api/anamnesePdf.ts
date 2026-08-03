// ── PraxiOS: Anamnesebogen als PDF (leer zum Drucken / ausgefüllt) ─────────
import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";
import {
  HAEUFIGKEIT_STUFEN,
  KOPFBOGEN_FELDER,
  type FormBlock,
  type KopfbogenKey,
  type SubmissionDaten,
} from "@contracts/anamnese";

function fontPath(name: string): string {
  const p = path.join(process.cwd(), "api", "assets", "fonts", name);
  if (fs.existsSync(p)) return p;
  throw new Error(`Font nicht gefunden: ${name}`);
}

const PETROL = "#0F766E";
const DUNKEL = "#0B4F4A";
const GRAU = "#555555";
const HELL = "#8AB5B0";
const PAGE_W = 595.28;
const MARGIN = 50;
const W = PAGE_W - 2 * MARGIN;

export interface BogenPdfInput {
  formTitel: string;
  beschreibung?: string | null;
  bloecke: FormBlock[];
  praxisName?: string | null;
  // Ausgefüllt (optional): Kopfbogen-Werte + Antworten + Unterschrift
  kopfbogen?: Partial<Record<KopfbogenKey, string>>;
  antworten?: SubmissionDaten["antworten"];
  unterschriftName?: string;
  datum?: string; // TT.MM.JJJJ
  // Übersetzungs-Overrides (bei Patientensprache statt Deutsch)
  kopfbogenLabels?: Partial<Record<KopfbogenKey, string>>;
  haeufigkeitStufen?: string[];
}

export function renderBogenPdf(input: BogenPdfInput): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      margins: { top: MARGIN, bottom: 60, left: MARGIN, right: MARGIN },
      bufferPages: true,
      font: fontPath("DejaVuSans.ttf"),
      info: { Title: `Anamnesebogen: ${input.formTitel}`, Author: input.praxisName ?? "PraxiOS" },
    });
    const chunks: Buffer[] = [];
    doc.on("data", (c) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const bold = fontPath("DejaVuSans-Bold.ttf");
    const regular = fontPath("DejaVuSans.ttf");
    const ausgefuellt = !!input.antworten;
    const unten = 770;

    let y = MARGIN;

    // ── Kopfzeile ──
    doc.rect(0, 0, PAGE_W, 64).fill(PETROL);
    doc.font(bold).fontSize(16).fillColor("#ffffff").text(input.formTitel, MARGIN, 20, { width: W });
    if (input.praxisName) {
      doc.font(regular).fontSize(9).fillOpacity(0.85).text(input.praxisName, MARGIN, 42, { width: W });
      doc.fillOpacity(1);
    }
    y = 80;

    if (input.beschreibung) {
      doc.font(regular).fontSize(9).fillColor(GRAU).text(input.beschreibung, MARGIN, y, { width: W });
      y = doc.y + 10;
    }

    // ── Kopfbogen (Pflicht-Stammdaten) ──
    y = abschnitt(doc, bold, y, "1 · Persönliche Daten");
    const feldW = W / 2;
    let spalte = 0;
    for (const feld of KOPFBOGEN_FELDER) {
      const x = MARGIN + spalte * feldW;
      sichereSeite(18);
      doc.font(regular).fontSize(7.5).fillColor(GRAU).text(
        (input.kopfbogenLabels?.[feld.key] ?? feld.label) + (feld.pflicht ? " *" : ""),
        x,
        y,
        { width: feldW - 12 },
      );
      const wert = input.kopfbogen?.[feld.key] ?? "";
      if (ausgefuellt && wert) {
        doc.font(bold).fontSize(10).fillColor(DUNKEL).text(wert, x, y + 9, { width: feldW - 12 });
      } else {
        doc.moveTo(x, y + 17).lineTo(x + feldW - 24, y + 17).lineWidth(0.5).strokeColor(HELL).stroke();
      }
      if (spalte === 1) y += 24;
      spalte = 1 - spalte;
    }
    if (spalte === 1) y += 24;
    y += 6;

    // ── Blöcke ──
    input.bloecke.forEach((block, i) => {
      const antwort = input.antworten?.[i]?.wert;
      y = abschnitt(doc, bold, y, `${i + 2} · ${block.titel}`);

      if (block.typ === "checkboxen") {
        const spalten = block.config.spalten ?? 2;
        const fW = W / spalten;
        (block.config.fragen ?? []).forEach((frage, fi) => {
          const x = MARGIN + (fi % spalten) * fW;
          if (fi % spalten === 0 && fi > 0) y += 18;
          sichereSeite(18);
          const an = Array.isArray(antwort) && (antwort as string[]).includes(frage);
          kasten(doc, x, y + 1, an);
          doc.font(regular).fontSize(9).fillColor(DUNKEL).text(frage, x + 16, y, { width: fW - 24 });
          if (fi % spalten === spalten - 1 || fi === (block.config.fragen ?? []).length - 1) y += 18;
        });
      } else if (block.typ === "textfeld") {
        sichereSeite(20);
        doc.font(regular).fontSize(9).fillColor(DUNKEL).text(block.config.frage ?? "", MARGIN, y, { width: W });
        y += 14;
        if (ausgefuellt && typeof antwort === "string" && antwort) {
          doc.font(bold).fontSize(10).text(antwort, MARGIN, y, { width: W });
          y += 22;
        } else {
          doc.moveTo(MARGIN, y + 8).lineTo(MARGIN + W, y + 8).lineWidth(0.5).strokeColor(HELL).stroke();
          y += 20;
        }
      } else if (block.typ === "textfeld_schreibfeld") {
        doc.font(regular).fontSize(9).fillColor(DUNKEL).text(block.config.frage ?? "", MARGIN, y, { width: W });
        y = doc.y + 4;
        const zeilen = ausgefuellt ? 0 : (block.config.zeilen ?? 4);
        if (ausgefuellt && typeof antwort === "string") {
          doc.font(bold).fontSize(10).text(antwort || "—", MARGIN, y, { width: W });
          y = doc.y + 12;
        } else {
          for (let l = 0; l < zeilen; l++) {
            sichereSeite(16);
            doc.moveTo(MARGIN, y + 10).lineTo(MARGIN + W, y + 10).lineWidth(0.5).strokeColor(HELL).stroke();
            y += 16;
          }
        }
      } else if (block.typ === "skala_1_10") {
        sichereSeite(34);
        doc.font(regular).fontSize(9).fillColor(DUNKEL).text(block.config.frage ?? "", MARGIN, y, { width: W });
        y += 16;
        const zellW = W / 10;
        for (let n = 1; n <= 10; n++) {
          const x = MARGIN + (n - 1) * zellW;
          const gewahlt = typeof antwort === "number" && antwort === n;
          doc.rect(x + 2, y, zellW - 4, 16).lineWidth(gewahlt ? 1.2 : 0.5)
            .strokeColor(gewahlt ? PETROL : HELL).stroke();
          if (gewahlt) doc.rect(x + 2, y, zellW - 4, 16).fillOpacity(0.12).fill(PETROL).fillOpacity(1);
          doc.font(bold).fontSize(9).fillColor(gewahlt ? PETROL : GRAU)
            .text(String(n), x, y + 4, { width: zellW, align: "center" });
        }
        y += 20;
        const von = block.config.vonLabel ?? "1 = schwach";
        const bis = block.config.bisLabel ?? "10 = stark";
        doc.font(regular).fontSize(7.5).fillColor(GRAU).text(von, MARGIN, y, { width: W / 2 });
        doc.text(bis, MARGIN + W / 2, y, { width: W / 2, align: "right" });
        y += 22;
      } else if (block.typ === "jaNein") {
        const map = (typeof antwort === "object" && antwort !== null && !Array.isArray(antwort)
          ? (antwort as Record<string, string>)
          : {}) as Record<string, string>;
        for (const frage of block.config.fragen ?? []) {
          sichereSeite(16);
          doc.font(regular).fontSize(9).fillColor(DUNKEL).text(frage, MARGIN, y + 2, { width: W * 0.7 });
          const gewahlt = map[frage];
          (["Ja", "Nein"] as const).forEach((stufe, si) => {
            const x = MARGIN + W * 0.72 + si * (W * 0.14);
            kreis(doc, x + 5, y + 6, gewahlt === stufe);
            doc.font(regular).fontSize(8.5).fillColor(GRAU).text(stufe, x + 13, y, { width: 40 });
          });
          y += 16;
        }
        if (block.config.notizFrage) {
          sichereSeite(20);
          const notiz = map["__notiz"] ?? "";
          doc.font(regular).fontSize(8.5).fillColor(GRAU).text(block.config.notizFrage, MARGIN, y, { width: W * 0.4 });
          if (ausgefuellt && notiz) {
            doc.font(bold).fontSize(9).fillColor(DUNKEL).text(notiz, MARGIN + W * 0.42, y - 2, { width: W * 0.58 });
          } else {
            doc.moveTo(MARGIN + W * 0.42, y + 9).lineTo(MARGIN + W, y + 9).lineWidth(0.5).strokeColor(HELL).stroke();
          }
          y += 20;
        }
        y += 6;
      } else if (block.typ === "infotext") {
        const absaetze = (block.config.text ?? "").split(/\n\s*\n/);
        for (const absatz of absaetze) {
          sichereSeite(14);
          doc.font(regular).fontSize(8.5).fillColor(GRAU).text(absatz.replace(/\n/g, " "), MARGIN, y, { width: W });
          y = doc.y + 6;
        }
        if (block.config.checkboxLabel) {
          sichereSeite(20);
          const an = antwort === "ja";
          kasten(doc, MARGIN, y, an);
          doc.font(regular).fontSize(9).fillColor(DUNKEL).text(block.config.checkboxLabel, MARGIN + 16, y - 1, { width: W - 16 });
          y += 22;
        }
        y += 6;
      } else if (block.typ === "haeufigkeit") {
        const kopfW = W * 0.42;
        const stufW = (W - kopfW) / HAEUFIGKEIT_STUFEN.length;
        sichereSeite(16);
        (input.haeufigkeitStufen ?? [...HAEUFIGKEIT_STUFEN]).forEach((stufe, si) => {
          doc.font(regular).fontSize(6.8).fillColor(GRAU).text(
            stufe,
            MARGIN + kopfW + si * stufW,
            y,
            { width: stufW, align: "center" },
          );
        });
        y += 14;
        for (const frage of block.config.fragen ?? []) {
          sichereSeite(16);
          doc.font(regular).fontSize(9).fillColor(DUNKEL).text(frage, MARGIN, y + 2, { width: kopfW - 10 });
          const gewahlt = typeof antwort === "object" && antwort !== null && !Array.isArray(antwort)
            ? (antwort as Record<string, string>)[frage]
            : undefined;
          const stufen = input.haeufigkeitStufen ?? [...HAEUFIGKEIT_STUFEN];
          stufen.forEach((stufe, si) => {
            const x = MARGIN + kopfW + si * stufW + stufW / 2 - 5;
            kreis(doc, x + 5, y + 6, gewahlt === stufe);
          });
          y += 16;
          doc.moveTo(MARGIN, y - 3).lineTo(MARGIN + W, y - 3).lineWidth(0.3).strokeColor("#e5e5e5").stroke();
        }
        y += 8;
      }
      y += 6;
    });

    // ── Unterschrift ──
    sichereSeite(60);
    y += 10;
    if (ausgefuellt) {
      doc.font(regular).fontSize(9).fillColor(GRAU).text(
        `Ausgefüllt und elektronisch bestätigt am ${input.datum ?? ""} durch:`,
        MARGIN,
        y,
        { width: W },
      );
      y += 14;
      doc.font(bold).fontSize(12).fillColor(DUNKEL).text(input.unterschriftName ?? "", MARGIN, y, { width: W });
    } else {
      doc.font(regular).fontSize(9).fillColor(GRAU).text("Datum:", MARGIN, y, { width: 120 });
      doc.moveTo(MARGIN + 44, y + 9).lineTo(MARGIN + 160, y + 9).lineWidth(0.5).strokeColor(HELL).stroke();
      doc.text("Unterschrift des Patienten / der Patientin:", MARGIN + 220, y, { width: 200 });
      doc.moveTo(MARGIN + 380, y + 9).lineTo(MARGIN + W, y + 9).lineWidth(0.5).strokeColor(HELL).stroke();
    }

    doc.end();

    function sichereSeite(bedarf: number) {
      if (y + bedarf > unten) {
        doc.addPage();
        y = MARGIN;
      }
    }
  });
}

function abschnitt(doc: PDFKit.PDFDocument, bold: string, y: number, titel: string): number {
  doc.rect(MARGIN, y, W, 17).fill("#F0FDFA");
  doc.font(bold).fontSize(10).fillColor(DUNKEL).text(titel, MARGIN + 6, y + 4, { width: W - 12 });
  return y + 24;
}

function kasten(doc: PDFKit.PDFDocument, x: number, y: number, an: boolean) {
  doc.rect(x, y, 10, 10).lineWidth(0.8).strokeColor(an ? PETROL : HELL).stroke();
  if (an) {
    doc.save().translate(x + 2, y + 4).rotate(-45).rect(-1, -2, 8, 3).fill(PETROL).restore();
  }
}

function kreis(doc: PDFKit.PDFDocument, cx: number, cy: number, an: boolean) {
  doc.circle(cx, cy, 5).lineWidth(0.8).strokeColor(an ? PETROL : HELL).stroke();
  if (an) doc.circle(cx, cy, 3).fill(PETROL);
}
