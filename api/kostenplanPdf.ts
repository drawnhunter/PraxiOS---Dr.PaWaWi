// ── PraxiOS: Heil- und Kostenplan (HKP) als PDF (1.25.0) ───────────────────
// Bewusst EIGENES Layout (nicht 1:1 die Rechnung): Bernstein-Akzent,
// Diagnose-Sektion mit ICD + Kurzbegründung, pathophysiologische Begründung,
// gruppierte Kostenaufstellung mit Zwischensummen, Unterschriftsfeld Patient.
import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";

function fontPath(name: string): string {
  const p = path.join(process.cwd(), "api", "assets", "fonts", name);
  if (fs.existsSync(p)) return p;
  throw new Error(`Font nicht gefunden: ${name}`);
}

const AKZENT = "#92610f"; // warmes Bernstein — bewusst NICHT das Rechnungs-Petrol
const DUNKEL = "#1c1917";
const GRAU = "#57534e";
const LINIE = "#e7e0d5";

export interface KostenplanPositionIn {
  gruppe?: string | null;
  bezeichnung: string;
  beschreibung?: string | null;
  menge: string | number;
  einheit?: string | null;
  einzelpreis: string | number;
  ustSatz: number;
  goaeText?: string | null;
}

export interface KostenplanPdfInput {
  nummer: string; // HKP-<id>-<JJJJ> oder „Entwurf #id"
  istEntwurf: boolean;
  datum: string; // TT.MM.JJJJ
  patient: {
    name: string;
    geburtsdatum?: string | null;
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
    fachrichtung?: string | null;
  };
  titel: string;
  zeitraum?: string | null; // z. B. „05.10.–09.10.2026"
  diagnosen?: { code: string; text: string; kurzbegruendung?: string }[];
  begruendung?: string | null;
  positionen: KostenplanPositionIn[];
  klartextNote?: string | null;
}

export async function renderKostenplanPdf(input: KostenplanPdfInput): Promise<Buffer> {
  const doc = new PDFDocument({
    size: "A4",
    margin: 46,
    font: fontPath("DejaVuSans.ttf"),
    info: { Title: `${input.titel} ${input.nummer}` },
  });
  doc.registerFont("Regular", fontPath("DejaVuSans.ttf"));
  doc.registerFont("Bold", fontPath("DejaVuSans-Bold.ttf"));
  doc.registerFont("Italic", fontPath("DejaVuSans-Oblique.ttf"));
  const chunks: Buffer[] = [];
  doc.on("data", (c: Buffer) => chunks.push(c));
  const fertig = new Promise<Buffer>((resolve) => doc.on("end", () => resolve(Buffer.concat(chunks))));

  const M = 46;
  const W = 595.28 - 2 * M;

  // ── Briefkopf ─────────────────────────────────────────────────────────────
  doc.font("Bold").fontSize(13.5).fillColor(AKZENT).text(input.praxis.name, M, M);
  doc
    .font("Regular")
    .fontSize(8)
    .fillColor(GRAU)
    .text(`${input.praxis.strasse} · ${input.praxis.plz} ${input.praxis.ort}`, M, doc.y + 1);
  const kontakt = [input.praxis.telefon ? `Tel. ${input.praxis.telefon}` : null, input.praxis.email]
    .filter(Boolean)
    .join(" · ");
  if (kontakt) doc.text(kontakt);
  if (input.praxis.fachrichtung) {
    doc.fontSize(7).fillColor(GRAU).text(input.praxis.fachrichtung, M, doc.y + 1);
  }
  const kopfEnde = doc.y + 5;
  doc.save().moveTo(M, kopfEnde).lineTo(M + W, kopfEnde).lineWidth(1.2).strokeColor(AKZENT).stroke().restore();

  // ── Titelblock ────────────────────────────────────────────────────────────
  let y = kopfEnde + 12;
  doc.font("Bold").fontSize(16).fillColor(DUNKEL).text(input.titel, M, y, { width: W });
  doc.font("Regular").fontSize(8.5).fillColor(GRAU).text(
    `${input.nummer} · Datum: ${input.datum}${input.zeitraum ? ` · Zeitraum: ${input.zeitraum}` : ""}`,
    M,
    doc.y + 2,
  );
  y = doc.y + 10;

  // ── Patientenblock ────────────────────────────────────────────────────────
  const geb = input.patient.geburtsdatum ? `, geb. am ${input.patient.geburtsdatum}` : "";
  const adresse = [input.patient.strasse, [input.patient.plz, input.patient.ort].filter(Boolean).join(" ")]
    .filter(Boolean)
    .join(", ");
  doc.font("Bold").fontSize(10).fillColor(DUNKEL).text(`${input.patient.name}${geb}`, M, y);
  if (adresse) doc.font("Regular").fontSize(8.5).fillColor(GRAU).text(adresse, M, doc.y + 1);
  y = doc.y + 8;

  // ── Diagnosen (ICD-10) ────────────────────────────────────────────────────
  if (input.diagnosen && input.diagnosen.length > 0) {
    doc.font("Bold").fontSize(9.5).fillColor(AKZENT).text("Diagnosen (ICD-10)", M, y);
    y = doc.y + 3;
    for (const d of input.diagnosen) {
      doc.font("Bold").fontSize(8.5).fillColor(DUNKEL).text(d.code, M, y, { width: 60, lineBreak: false });
      doc.font("Regular").fontSize(8.5).fillColor(DUNKEL).text(d.text, M + 62, y, { width: W - 62 });
      y = doc.y + 2;
      if (d.kurzbegruendung) {
        doc.font("Italic").fontSize(7.8).fillColor(GRAU).text(d.kurzbegruendung, M + 62, y, { width: W - 62 });
        y = doc.y + 2;
      }
      y += 3;
    }
    y += 4;
  }

  // ── Pathophysiologische Begründung ────────────────────────────────────────
  if (input.begruendung?.trim()) {
    doc.font("Bold").fontSize(9.5).fillColor(AKZENT).text("Pathophysiologische Begründung", M, y);
    y = doc.y + 3;
    doc.font("Regular").fontSize(8.8).fillColor(DUNKEL).text(input.begruendung.trim(), M, y, {
      width: W,
      lineGap: 2.5,
    });
    y = doc.y + 10;
  }

  // ── Kostenaufstellung (gruppiert) ─────────────────────────────────────────
  doc.font("Bold").fontSize(9.5).fillColor(AKZENT).text("Kostenaufstellung", M, y);
  y = doc.y + 6;
  const colX = { pos: M, bez: M + 30, menge: M + W - 260, preis: M + W - 190, ust: M + W - 122, betrag: M + W - 62 };
  const zelle = (t: string, x: number, fett = false, rechts = false) =>
    doc.font(fett ? "Bold" : "Regular").fontSize(8.5).fillColor(DUNKEL).text(t, x, y, {
      width: rechts ? 62 : undefined,
      align: rechts ? "right" : "left",
      lineBreak: false,
    });

  // Gruppen in Reihenfolge des Vorkommens
  const gruppen = new Map<string, KostenplanPositionIn[]>();
  for (const p of input.positionen) {
    const g = p.gruppe?.trim() || "Positionen";
    gruppen.set(g, [...(gruppen.get(g) ?? []), p]);
  }

  let summeNetto = 0;
  let summeUst = 0;
  const geld = (v: number) =>
    new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);

  for (const [gruppe, positionen] of gruppen) {
    // Gruppenkopf
    doc.save().rect(M, y - 2, W, 16).fill("#faf6ef").restore();
    doc.font("Bold").fontSize(8.8).fillColor(AKZENT).text(gruppe, M + 4, y + 1.5, { lineBreak: false });
    y += 20;
    // Kopfzeile
    doc.font("Bold").fontSize(7).fillColor(GRAU);
    zelle("Pos.", colX.pos);
    zelle("Bezeichnung", colX.bez);
    doc.text("Menge", colX.menge, y, { width: 50, align: "right" });
    doc.text("Preis", colX.preis, y, { width: 62, align: "right" });
    doc.text("USt.", colX.ust, y, { width: 50, align: "right" });
    doc.text("Betrag", colX.betrag, y, { width: 62, align: "right" });
    y += 12;
    doc.save().moveTo(M, y).lineTo(M + W, y).lineWidth(0.6).strokeColor(LINIE).stroke().restore();
    y += 4;

    let gruppenNetto = 0;
    positionen.forEach((p, i) => {
      const menge = Number(p.menge);
      const einzel = Number(p.einzelpreis);
      const betrag = menge * einzel;
      const ust = betrag * (p.ustSatz / 100);
      gruppenNetto += betrag;
      summeNetto += betrag;
      summeUst += ust;
      doc.font("Regular").fontSize(8.5).fillColor(DUNKEL);
      doc.text(String(i + 1), colX.pos, y, { width: 24, lineBreak: false });
      const bez = p.goaeText ? `${p.bezeichnung} — ${p.goaeText}` : p.bezeichnung;
      doc.text(bez, colX.bez, y, { width: colX.menge - colX.bez - 8 });
      const h1 = doc.y;
      doc.text(new Intl.NumberFormat("de-DE", { maximumFractionDigits: 3 }).format(menge), colX.menge, y, { width: 50, align: "right" });
      doc.text(geld(einzel), colX.preis, y, { width: 62, align: "right" });
      doc.text(p.ustSatz === 0 ? "0 %" : `${p.ustSatz} %`, colX.ust, y, { width: 50, align: "right" });
      doc.text(geld(betrag), colX.betrag, y, { width: 62, align: "right" });
      y = Math.max(h1, doc.y) + 2;
      if (p.beschreibung?.trim()) {
        doc.font("Italic").fontSize(7.6).fillColor(GRAU).text(p.beschreibung.trim(), colX.bez, y, { width: colX.menge - colX.bez - 8 });
        y = doc.y + 2;
      }
      y += 3;
    });

    // Zwischensumme je Gruppe (nur wenn mehr als eine Gruppe)
    if (gruppen.size > 1) {
      doc.save().moveTo(M, y).lineTo(M + W, y).lineWidth(0.5).strokeColor(LINIE).stroke().restore();
      y += 3;
      doc.font("Bold").fontSize(8.3).fillColor(GRAU).text(`Zwischensumme: ${gruppe}`, M, y, { width: W - 100, lineBreak: false });
      doc.font("Bold").fontSize(8.3).fillColor(DUNKEL).text(geld(gruppenNetto), colX.betrag - 18, y, { width: 80, align: "right", lineBreak: false });
      y += 14;
    }
  }

  // ── Summen ────────────────────────────────────────────────────────────────
  y += 6;
  doc.save().moveTo(M, y).lineTo(M + W, y).lineWidth(1).strokeColor(AKZENT).stroke().restore();
  y += 6;
  const sumX = M + W - 190;
  doc.font("Regular").fontSize(8.8).fillColor(GRAU).text("Summe netto", sumX, y, { width: 120, align: "right" });
  doc.font("Bold").fontSize(9).fillColor(DUNKEL).text(`${geld(summeNetto)} €`, colX.betrag - 18, y, { width: 80, align: "right", lineBreak: false });
  y += 13;
  if (summeUst > 0.005) {
    doc.font("Regular").fontSize(8.8).fillColor(GRAU).text("Umsatzsteuer", sumX, y, { width: 120, align: "right" });
    doc.font("Regular").fontSize(9).fillColor(DUNKEL).text(`${geld(summeUst)} €`, colX.betrag - 18, y, { width: 80, align: "right", lineBreak: false });
    y += 13;
  }
  doc.font("Bold").fontSize(10.5).fillColor(AKZENT).text("Gesamtkosten", sumX - 10, y, { width: 110, align: "right" });
  doc.font("Bold").fontSize(10.5).fillColor(DUNKEL).text(`${geld(summeNetto + summeUst)} €`, colX.betrag - 18, y, { width: 80, align: "right", lineBreak: false });
  y += 26;

  // ── KV-/Hinweis-Textbaustein ──────────────────────────────────────────────
  if (input.klartextNote?.trim()) {
    doc.save().rect(M, y, W, 1).fill(LINIE).restore();
    y += 6;
    doc.font("Regular").fontSize(7.6).fillColor(GRAU).text(input.klartextNote.trim(), M, y, { width: W, lineGap: 2 });
    y = doc.y + 8;
  }

  // ── Unterschriften (Praxis + Patient) ─────────────────────────────────────
  const sigY = Math.max(y + 10, 700);
  doc.font("Regular").fontSize(8.5).fillColor(DUNKEL).text(`${input.praxis.ort}, den ${input.datum}`, M, sigY);
  const linie = (x: number, label: string) => {
    doc.save().moveTo(x, sigY + 46).lineTo(x + 170, sigY + 46).lineWidth(0.7).strokeColor(DUNKEL).stroke().restore();
    doc.font("Regular").fontSize(6.8).fillColor(GRAU).text(label, x, sigY + 50, { width: 170, align: "center" });
  };
  linie(M + W - 190, "Unterschrift Heilberufler/in");
  linie(M, "Unterschrift Patient/in (Kenntnisnahme & Kostenübernahme)");

  // Entwurfs-Wasserzeichen
  if (input.istEntwurf) {
    doc.save().rotate(-30, { origin: [297, 420] }).font("Bold").fontSize(60).fillColor(AKZENT).opacity(0.07)
      .text("ENTWURF", 120, 380, { lineBreak: false }).restore();
  }

  doc.end();
  return fertig;
}
