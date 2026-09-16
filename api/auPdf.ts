// ── PraxiOS: Arbeitsunfähigkeitsbescheinigung (A4, Gehalt Muster 1b) ────────
// Moderne Form mit dem vollständigen Informationsgehalt der klassischen
// Muster-1b-Ausfertigungen „Arbeitgeber" und „Krankenkasse" (1.16.0).
// Arbeitgeber-Exemplar: ohne Diagnose (Datenschutz-Regel).
// Kassen-Exemplar: AU-begründende Diagnose(n) ICD-10, Reha/Wiedereingliederung,
// Krankengeld-Block.
import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";
import type { AttestInhalt } from "@contracts/rezepte";

function fontPath(name: string): string {
  const p = path.join(process.cwd(), "api", "assets", "fonts", name);
  if (fs.existsSync(p)) return p;
  throw new Error(`Font nicht gefunden: ${name}`);
}

const PETROL = "#0F766E";
const DUNKEL = "#1c1917";
const GRAU = "#57534e";
const HELL = "#f5f5f4";
const LINIE = "#d6d3d1";

export interface AuPdfInput {
  inhalt: AttestInhalt; // art === "krankschreibung"
  patient: {
    name: string; // „Nachname, Vorname"
    geburtsdatum?: string | null;
    strasse?: string | null;
    plz?: string | null;
    ort?: string | null;
    krankenkasse?: string | null;
    versichertennummer?: string | null;
  };
  praxis: {
    name: string;
    strasse: string;
    plz: string;
    ort: string;
    telefon?: string | null;
    email?: string | null;
    arztNr?: string | null;
    betriebsstaettenNr?: string | null;
    fachrichtung?: string | null;
  };
  signaturBild?: string | null;
  /** Ausstellungsdatum TT.MM.JJJJ. */
  datum: string;
}

/** Checkbox: Kästchen + (Kreuz) + Label. Gibt die Breite zurück. */
function checkbox(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  aktiv: boolean,
  label: string,
  opts?: { labelBreite?: number; groesse?: number },
): number {
  const k = 9;
  doc.save().rect(x, y, k, k).lineWidth(0.9).strokeColor(DUNKEL).stroke().restore();
  if (aktiv) {
    doc
      .save()
      .moveTo(x + 1.6, y + 1.6)
      .lineTo(x + k - 1.6, y + k - 1.6)
      .moveTo(x + k - 1.6, y + 1.6)
      .lineTo(x + 1.6, y + k - 1.6)
      .lineWidth(1.1)
      .strokeColor(DUNKEL)
      .stroke()
      .restore();
  }
  doc
    .font("Regular")
    .fontSize(opts?.groesse ?? 7.5)
    .fillColor(DUNKEL)
    .text(label, x + k + 5, y + 1.2, { width: opts?.labelBreite ?? 150, lineBreak: false });
  return k + 5 + doc.widthOfString(label) + 14;
}

/** Feld mit kleinem Label oben und Wert darunter (Formular-Look). */
function feld(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  label: string,
  wert: string,
  opts?: { fett?: boolean; groesse?: number },
): void {
  doc.font("Regular").fontSize(6.3).fillColor(GRAU).text(label, x, y, { width: w, lineBreak: false });
  doc
    .font(opts?.fett ? "Bold" : "Regular")
    .fontSize(opts?.groesse ?? 9.5)
    .fillColor(DUNKEL)
    .text(wert || " ", x, y + 8.5, { width: w });
}

/** Box mit Trennlinien zwischen den Feldern (wie im Muster-Block). */
function feldReihe(
  doc: PDFKit.PDFDocument,
  x: number,
  y: number,
  w: number,
  h: number,
  felder: { anteil: number; label: string; wert: string; fett?: boolean }[],
): void {
  doc.save().rect(x, y, w, h).lineWidth(0.9).strokeColor(LINIE).stroke().restore();
  let fx = x;
  felder.forEach((f, i) => {
    const fw = w * f.anteil;
    if (i > 0) {
      doc.save().moveTo(fx, y).lineTo(fx, y + h).lineWidth(0.6).strokeColor(LINIE).stroke().restore();
    }
    feld(doc, fx + 5, y + 4, fw - 10, f.label, f.wert, { fett: f.fett });
    fx += fw;
  });
}

export async function renderAuPdf(input: AuPdfInput): Promise<Buffer> {
  const W_SEITE = 595.28;
  const H_SEITE = 841.89;
  const M = 40;
  const W = W_SEITE - 2 * M;
  const kassenExemplar = input.inhalt.ausfertigung === "krankenkasse";

  const doc = new PDFDocument({
    size: [W_SEITE, H_SEITE],
    margin: M,
    font: fontPath("DejaVuSans.ttf"),
    info: { Title: "Arbeitsunfähigkeitsbescheinigung" },
  });
  doc.registerFont("Regular", fontPath("DejaVuSans.ttf"));
  doc.registerFont("Bold", fontPath("DejaVuSans-Bold.ttf"));
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const fertig = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const { praxis, patient, inhalt, datum } = input;
  const [nachname, vorname] = patient.name.includes(",")
    ? patient.name.split(",").map((s) => s.trim())
    : [patient.name, ""];
  const geb = patient.geburtsdatum ?? "";
  const auSeit = inhalt.auVon || datum;
  const auBis = inhalt.auBis || "…";
  const festgestellt = inhalt.feststellungsdatum || datum;

  // ── Kopf: Praxis + Titel ──────────────────────────────────────────────────
  doc.font("Bold").fontSize(13).fillColor(PETROL).text(praxis.name, M, M);
  doc
    .font("Regular")
    .fontSize(7.5)
    .fillColor(GRAU)
    .text(`${praxis.strasse} · ${praxis.plz} ${praxis.ort}`, M, doc.y + 1);
  const kontakt = [praxis.telefon ? `Tel. ${praxis.telefon}` : null, praxis.email].filter(Boolean).join(" · ");
  if (kontakt) doc.text(kontakt);

  // Titelblock rechts oben (feste Positionen — kein doc.y-Fluss, damit
  // Titel und Checkboxen sich nicht überlagern)
  const titelY = M - 4;
  doc.font("Bold").fontSize(14).fillColor(DUNKEL).text("Arbeitsunfähigkeits-", M + W - 210, titelY, { width: 196, align: "right", lineBreak: false });
  doc.text("bescheinigung", M + W - 210, titelY + 17, { width: 196, align: "right", lineBreak: false });
  doc.font("Bold").fontSize(13).text("1", M + W - 10, titelY, { lineBreak: false });

  // Erst-/Folgebescheinigung rechts, klar UNTER dem Titel
  const cbY = titelY + 40;
  checkbox(doc, M + W - 175, cbY, inhalt.erstbescheinigung !== false, "Erstbescheinigung", { labelBreite: 100 });
  checkbox(doc, M + W - 175, cbY + 15, inhalt.erstbescheinigung === false, "Folgebescheinigung", { labelBreite: 100 });

  const kopfEnde = Math.max(doc.y + 4, cbY + 30);
  doc.save().moveTo(M, kopfEnde).lineTo(M + W, kopfEnde).lineWidth(1.4).strokeColor(PETROL).stroke().restore();

  let y = kopfEnde + 10;

  // ── Block 1: Kostenträger + Patient ───────────────────────────────────────
  feld(doc, M, y, W * 0.55, "Krankenkasse bzw. Kostenträger", patient.krankenkasse ?? "", { fett: true, groesse: 10 });
  y += 30;
  feldReihe(doc, M, y, W, 34, [
    { anteil: 0.62, label: "Name, Vorname des Versicherten", wert: `${nachname}${vorname ? `, ${vorname}` : ""}`, fett: true },
    { anteil: 0.38, label: "geb. am", wert: geb, fett: true },
  ]);
  y += 34;
  const adresse = [patient.strasse, [patient.plz, patient.ort].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  feld(doc, M, y + 4, W, "Anschrift", adresse, { fett: true, groesse: 10 });
  y += 30;

  // ── Block 2: Nummern ──────────────────────────────────────────────────────
  feldReihe(doc, M, y, W, 30, [
    { anteil: 0.3, label: "Kostenträgerkennung", wert: "" },
    { anteil: 0.4, label: "Versicherten-Nr.", wert: patient.versichertennummer ?? "" },
    { anteil: 0.3, label: "Status", wert: "" },
  ]);
  y += 30;
  feldReihe(doc, M, y, W, 30, [
    { anteil: 0.3, label: "Betriebsstätten-Nr.", wert: praxis.betriebsstaettenNr ?? "" },
    { anteil: 0.4, label: "Arzt-Nr.", wert: praxis.arztNr ?? "" },
    { anteil: 0.3, label: "Datum", wert: datum },
  ]);
  y += 42;

  // ── Block 3: Checkboxen + AU-Daten + Arztstempel ─────────────────────────
  const arztX = M + W * 0.56;
  const linksW = W * 0.52;
  let cy = y;
  let cx = M;
  checkbox(doc, M, cy, inhalt.arbeitsunfall === true, "Arbeitsunfall, Arbeitsunfallfolgen,\nBerufskrankheit", { labelBreite: 160 });
  cy += 22;
  checkbox(doc, M, cy, inhalt.durchgangsarzt === true, "dem Durchgangsarzt zugewiesen", { labelBreite: 160 });
  cy += 24;

  feld(doc, M, cy, linksW, "arbeitsunfähig seit", auSeit, { fett: true, groesse: 11 });
  doc.save().moveTo(M, cy + 26).lineTo(M + linksW, cy + 26).lineWidth(0.6).strokeColor(LINIE).stroke().restore();
  cy += 34;
  feld(doc, M, cy, linksW, "voraussichtlich arbeitsunfähig bis einschließlich oder letzter Tag der Arbeitsunfähigkeit", auBis, { fett: true, groesse: 11 });
  doc.save().moveTo(M, cy + 26).lineTo(M + linksW, cy + 26).lineWidth(0.6).strokeColor(LINIE).stroke().restore();
  cy += 34;
  feld(doc, M, cy, linksW, "festgestellt am", festgestellt, { fett: true, groesse: 11 });
  doc.save().moveTo(M, cy + 26).lineTo(M + linksW, cy + 26).lineWidth(0.6).strokeColor(LINIE).stroke().restore();
  cy += 34;
  checkbox(doc, M, cy, inhalt.sonstigerUnfall === true, "sonstiger Unfall,\nUnfallfolgen", { labelBreite: 100 });
  cy += 26;

  // Arzt-Block rechts
  const arztW = M + W - arztX;
  doc.save().rect(arztX, y - 4, arztW, cy - y - 2).lineWidth(0.9).strokeColor(LINIE).stroke().restore();
  let ay = y + 4;
  const az = (t: string, fett = false, groesse = 8.5) => {
    doc.font(fett ? "Bold" : "Regular").fontSize(groesse).fillColor(DUNKEL).text(t, arztX + 8, ay, { width: arztW - 16 });
    ay = doc.y + 1.5;
  };
  if (praxis.betriebsstaettenNr) az(praxis.betriebsstaettenNr);
  az(`${praxis.strasse}`);
  az(`${praxis.plz} ${praxis.ort}`);
  if (praxis.telefon) az(`Tel: ${praxis.telefon}`);
  ay += 4;
  az(praxis.name, true, 10);
  if (praxis.fachrichtung) az(praxis.fachrichtung);
  if (praxis.arztNr) az(praxis.arztNr);
  ay += 6;
  doc.font("Regular").fontSize(6.3).fillColor(GRAU).text("Vertragsarztstempel / Unterschrift des Arztes", arztX + 8, ay, { width: arztW - 16 });
  ay = doc.y + 2;
  if (input.signaturBild) {
    try {
      const buf = Buffer.from(input.signaturBild.split(",")[1] ?? "", "base64");
      if (buf.length > 100) doc.image(buf, arztX + 8, ay, { fit: [arztW - 30, 46] });
    } catch { /* nur Linie */ }
  }

  y = cy + 8;

  // ── Ausfertigungs-Balken ──────────────────────────────────────────────────
  doc.save().rect(M, y, W, 18).fill(HELL).restore();
  doc.save().rect(M, y, W, 18).lineWidth(0.9).strokeColor(LINIE).stroke().restore();
  doc
    .font("Bold")
    .fontSize(9)
    .fillColor(DUNKEL)
    .text(
      kassenExemplar
        ? "Ausfertigung zur Vorlage bei der Krankenkasse"
        : "Ausfertigung zur Vorlage beim Arbeitgeber",
      M,
      y + 4.5,
      { width: W, align: "center" },
    );
  y += 26;

  // ── Kassen-Exemplar: Diagnose + Reha + Krankengeld ────────────────────────
  if (kassenExemplar) {
    doc.font("Bold").fontSize(8.5).fillColor(DUNKEL).text("AU-begründende Diagnose(n)", M, y);
    doc.font("Regular").fontSize(6.5).fillColor(GRAU).text("(ICD-10)", M + doc.widthOfString("AU-begründende Diagnose(n)") + 4, y + 1.5);
    y += 14;
    const codes = (inhalt.diagnoseAusweisen ? inhalt.icdCodes : undefined) ?? [];
    const zellenW = W / 3;
    for (let z = 0; z < 6; z++) {
      const zx = M + (z % 3) * zellenW;
      const zy = y + Math.floor(z / 3) * 26;
      const c = codes[z];
      doc.save().rect(zx, zy, zellenW - 4, 24).lineWidth(0.6).strokeColor(LINIE).stroke().restore();
      doc.font("Regular").fontSize(6.3).fillColor(GRAU).text("ICD-10 - Code", zx + 4, zy + 3);
      if (c) {
        doc.font("Bold").fontSize(9).fillColor(DUNKEL).text(c.code, zx + 4, zy + 10, { lineBreak: false });
        doc.font("Regular").fontSize(6.3).fillColor(GRAU).text(c.text, zx + 44, zy + 10, { width: zellenW - 52, height: 12, ellipsis: true });
      }
    }
    y += 56;

    cy = y + 4;
    cx = M;
    cx += checkbox(doc, cx, cy, inhalt.sonstigerUnfall === true, "sonstiger Unfall,\nUnfallfolgen", { labelBreite: 90 });
    checkbox(doc, M + W * 0.45, cy, inhalt.versorgungsleiden === true, "Versorgungsleiden\n(z. B. BVG)", { labelBreite: 90 });
    cy += 30;
    doc.font("Regular").fontSize(7.5).fillColor(GRAU).text("Es wird die Einleitung folgender besonderer Maßnahmen für erforderlich gehalten", M, cy);
    cy += 12;
    cx = M;
    cx += checkbox(doc, cx, cy, inhalt.reha === true, "Leistungen zur\nmedizinischen Rehabilitation", { labelBreite: 110 });
    checkbox(doc, M + W * 0.45, cy, inhalt.wiedereingliederung === true, "stufenweise\nWiedereingliederung", { labelBreite: 100 });
    cy += 32;

    // Krankengeld-Block
    const kg = inhalt.krankengeld ?? null;
    doc.save().rect(M, cy, W, 30).lineWidth(1.2).strokeColor(DUNKEL).stroke().restore();
    doc.font("Bold").fontSize(8).fillColor(DUNKEL).text("Im Krankengeldfall", M + 8, cy + 11, { lineBreak: false });
    cx = M + 130;
    cx += checkbox(doc, cx, cy + 5, kg === "7woche" || kg === "sonstiger", "ab 7. AU-Woche oder\nsonstiger Krankengeldfall", { labelBreite: 110, groesse: 7 });
    checkbox(doc, cx + 20, cy + 10, kg === "endbescheinigung", "Endbescheinigung", { groesse: 7 });
    cy += 38;
    doc.font("Bold").fontSize(7.5).fillColor(DUNKEL).text("Hinweis für Versicherte zum Krankengeld", M, cy);
    cy += 10;
    doc
      .font("Regular")
      .fontSize(6.8)
      .fillColor(GRAU)
      .text(
        "Wird Ihnen in der Arztpraxis die Bescheinigung über die Arbeitsunfähigkeit für die Krankenkasse ausgehändigt, leiten Sie diese bitte an Ihre Krankenkasse weiter. Dadurch können zeitliche Verzögerungen bei der Gewährung von Kranken- bzw. Verletztengeld vermieden werden.",
        M,
        cy,
        { width: W },
      );
    y = doc.y + 10;
  }

  // ── Freitext (falls ergänzt) ──────────────────────────────────────────────
  if (inhalt.text?.trim()) {
    doc.font("Regular").fontSize(8.5).fillColor(DUNKEL).text(inhalt.text.trim(), M, y, { width: W, lineGap: 2 });
    y = doc.y + 8;
  }

  // ── Fuß ───────────────────────────────────────────────────────────────────
  const fussY = H_SEITE - 60;
  doc
    .font("Regular")
    .fontSize(6.3)
    .fillColor(GRAU)
    .text("Dokumentenversion 1.0.2 · Dokumententyp e010 (Layout angelehnt an Muster 1b)", M, fussY);
  doc.text(`${praxis.ort}, den ${datum}`, M, fussY + 12);
  doc.text("Erstellt mit Dr.PaWaWi (PraxiOS)", M + W - 160, fussY, { width: 160, align: "right" });

  doc.end();
  return fertig;
}
